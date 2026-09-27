import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test, vi } from 'vitest';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import { createDeploymentStagingOrchestrationFactory } from '../../app/deployment-staging-host.mjs';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { createCapabilityEvidenceStore } from '../src/capability-store.js';
import { WRITE_PROBES, MODEL_PROBES } from '../src/capability-admission.js';
import { SUBJECT_FIELDS, subjectDigest } from '../src/measurement-subject.js';
import { createNativeExistingFileContract } from '../src/verification/native-existing-file-checker.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { captureGoalProposal } from '../../app/goal-proposal.mjs';

const fixture=vi.hoisted(()=>({installation:null as any,subject:null as any,digest:'',service:null as any,now:0,
  server:'',verifierServer:'',vendorSpecs:0,root:'',calls:[] as string[],expireAfterCleanup:false,clockAdvanced:false}));
vi.mock('../../app/provider-installation.mjs',()=>({
  identifyProviderInstallation:()=>fixture.installation,
  assertCurrentProviderInstallation:(value:unknown)=>{if(value!==fixture.installation)throw Error('fixture-installation-drift');return true;},
}));
vi.mock('../dist/src/native-provider-measurement-subject.js',()=>({
  measureNativeProviderSubject:()=>({subject:fixture.subject,subjectDigest:fixture.digest,manifest:{installationDigest:'f'.repeat(64)}}),
}));
vi.mock('../dist/src/native-account-observation.js',()=>({
  observeNativeServiceCapacity:async()=>fixture.service,
  readIssuedNativeServiceCapacity:(value:unknown,input:any)=>{if(value!==fixture.service||input.installation!==fixture.installation
    ||input.authProfilePath!==fixture.installation.authProfiles[0].path||input.accountRef!==fixture.service.accountRef
    ||subjectDigest(input.currentSubject)!==fixture.digest)throw Error('fixture-service-drift');
    if(input.nowMs-fixture.service.observedAtMs>input.maxAgeMs)throw Error('fixture-service-expired');
    return {observation:value,available:true,sourceBytes:()=>new Uint8Array([1])};},
}));
vi.mock('../dist/src/tool-home.js',async importOriginal=>{
  const actual=await importOriginal<typeof import('../src/tool-home.js')>();
  return {...actual,vendorCodexLaunchSpec:(binary:string,args:readonly string[],home:string)=>{
    fixture.vendorSpecs++;fixture.calls.push(binary);
    if(binary!==fixture.installation.executablePath)throw Error('fixture-vendor-drift');
    const spec=actual.vendorCodexLaunchSpec(binary,args,home);
    return {...spec,command:process.execPath,args:[fixture.vendorSpecs<=2?fixture.server:fixture.verifierServer]};
  }};
});
vi.mock('../dist/src/native-process-cleanup.js',async importOriginal=>{
  const actual=await importOriginal<typeof import('../src/native-process-cleanup.js')>();
  return {...actual,createNativeProcessCleanup:(...args:Parameters<typeof actual.createNativeProcessCleanup>)=>{
    const cleanup=actual.createNativeProcessCleanup(...args);
    return {...cleanup,observe:(receipt:Parameters<typeof cleanup.observe>[0])=>{
      const observed=cleanup.observe(receipt);
      if(fixture.expireAfterCleanup&&!fixture.clockAdvanced&&receipt.taskId==='implement'&&observed.result==='verified-clean'){
        fixture.now+=2000;fixture.clockAdvanced=true;
      }
      return observed;
    }};
  }};
});
import { createNativeExistingFileAuthorities } from '../../app/native-existing-file-authorities.mjs';

const sha=(value:string)=>createHash('sha256').update(value).digest('hex');

async function runChain(){
  const root=mkdtempSync(join(tmpdir(),'cue-native-chain-')),workspace=join(root,'workspace'),storageRoot=join(root,'staging'),vendor=join(root,'vendor');
  fixture.root=root;mkdirSync(workspace);mkdirSync(storageRoot);mkdirSync(vendor);
  const target=join(workspace,'target.txt'),other=join(workspace,'other.txt'),auth=join(root,'auth.json');writeFileSync(target,'before');writeFileSync(other,'before-other');writeFileSync(auth,'fixture');
  execFileSync('git',['init'],{cwd:workspace,stdio:'ignore'});execFileSync('git',['add','target.txt','other.txt'],{cwd:workspace,stdio:'ignore'});
  execFileSync('git',['-c','user.name=Cue Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture'],{cwd:workspace,stdio:'ignore'});
  fixture.server=join(root,'fake-codex-server.cjs');
  const promptLog=join(root,'prompts.jsonl');
  writeFileSync(fixture.server,`const fs=require('node:fs');const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');const first=${JSON.stringify(target)},second=${JSON.stringify(other)},log=${JSON.stringify(promptLog)};rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'fixture-thread'}}});else if(m.method==='turn/start'){fs.appendFileSync(log,JSON.stringify(m)+'\\n');send({id:m.id,result:{turn:{id:'fixture-turn'}}});const path=fs.readFileSync(first,'utf8')==='before'?'target.txt':'other.txt',content=path==='target.txt'?'after':'after-other';send({method:'item/tool/call',id:91,params:{threadId:'fixture-thread',turnId:'fixture-turn',callId:'approved-write',namespace:null,tool:'cue_workspace',arguments:{operation:'write_text',path,content}}});}else if(m.id===91){send({method:'item/completed',params:{threadId:'fixture-thread',turnId:'fixture-turn',item:{type:'agentMessage',text:'Completed the approved write.'}}});send({method:'turn/completed',params:{threadId:'fixture-thread',turn:{id:'fixture-turn',status:'completed'}}});}});`);
  fixture.verifierServer=join(root,'fake-codex-verifier.cjs');
  writeFileSync(fixture.verifierServer,String.raw`const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'verifier-thread'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'verifier-turn'}}});send({method:'item/completed',params:{threadId:'verifier-thread',turnId:'verifier-turn',item:{type:'agentMessage',text:'Independent verification passed.'}}});send({method:'turn/completed',params:{threadId:'verifier-thread',turn:{id:'verifier-turn',status:'completed'}}});}});`);
  const config=initializeConfig(join(root,'data'),{worktreeRoot:workspace}),daemon=new AppDaemon(config),db=daemon.db;
  fixture.now=Date.now();fixture.vendorSpecs=0;fixture.calls=[];fixture.expireAfterCleanup=false;fixture.clockAdvanced=false;
  fixture.subject=Object.fromEntries(SUBJECT_FIELDS.map(key=>[key,key.endsWith('Sha256')?'b'.repeat(64):`fixture-${key}`]));
  fixture.digest=subjectDigest(fixture.subject);
  fixture.installation={provider:'codex',executablePath:join(vendor,'codex.exe'),executable:{sha256:'b'.repeat(64)},version:{value:'fixture-v1'},authProfiles:[{path:auth}]};
  fixture.service={accountIdentityDigest:'c'.repeat(64),accountRef:'account:'+'c'.repeat(64),observedAtMs:fixture.now};
  const evidence=createCapabilityEvidenceStore(db,()=>fixture.now);
  for(const probe of [...WRITE_PROBES,...MODEL_PROBES])evidence.record({probe,subjectDigest:fixture.digest,measuredAt:new Date(fixture.now).toISOString(),kind:'live',status:'pass',observation:new Uint8Array([1])});
  const candidateIds=['codex-native-implementation','codex-native-verifier'],policies:any={};
  for(const mode of ['efficiency','performance','value','speed'] as const){const saved=saveSelectionPolicy(db,{policyId:`native-${mode}`,expectedRevision:null,
    createdAt:new Date(fixture.now).toISOString(),sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode,qualityMinimum:0,costBasis:1,timeBasisMs:1000,
      currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:300000,allowedCandidateIds:candidateIds,pinnedCandidateId:null}});
    policies[mode]={policyId:saved.policyId,revision:saved.revision,digest:saved.digest};}
  const artifacts=[{targetId:'target',relativePath:'target.txt',maxBytes:1024,expectedSha256:sha('after'),expectedByteLength:5,originalSha256:sha('before')}];
  const otherArtifacts=[{targetId:'other',relativePath:'other.txt',maxBytes:1024,expectedSha256:sha('after-other'),expectedByteLength:11,originalSha256:sha('before-other')}];
  const contract=createNativeExistingFileContract(artifacts);
  const configuration:any={installation:{provider:'codex'},authProfilePath:auth,temporaryParent:root,
    workflow:{requirementId:'implementation-correct',requirementText:'Replace target.txt with exactly after.',checkerId:contract.checkerId,
      checkerRevision:contract.checkerRevision,parametersDigest:contract.parametersDigest,targets:[{targetId:'target',relativePath:'target.txt',maxBackupBytes:1024}],
      expectedArtifacts:artifacts,proposalRequirements:[{requirementId:'first-correct',requirementText:'Write target.txt exactly.',expectedArtifacts:artifacts},{requirementId:'second-correct',requirementText:'Write other.txt exactly.',expectedArtifacts:otherArtifacts}],launchTimeoutMs:30000,taskTimeoutMs:90000,pollMs:25},
    accounting:{currency:'TEST',unit:'micro',limitUnits:100,unitsPerCost:1,source:'fixture-conservative-prior',observedAtMs:fixture.now,
      upperUnitsByRole:{implementation:10,verifier:10},conservativeTimeMs:1000},policies,capabilityMaxAgeMs:120000,model:'fixture-model'};
  const base=await createNativeExistingFileAuthorities({db,now:()=>fixture.now,configuration});
  const factory=await createDeploymentStagingOrchestrationFactory({configuration:JSON.stringify({version:'cue-git-staging-deployment-v1',enabled:true,storageRoot}),createOrchestrationFactory:()=>base});
  const goal='Make two approved existing-file changes and verify both.';
  const first=createNativeExistingFileContract(artifacts),second=createNativeExistingFileContract(otherArtifacts),policy=policies.efficiency;
  const body:any={version:'cue-goal-proposal-v1',goalSha256:sha(goal),plan:{policyRevision:`${policy.policyId}:${policy.revision}`,policyDigest:policy.digest,tasks:[
    {id:'write-first',role:'implementation',ownerId:'maker-one',requirementIds:['first-correct'],dependencyIds:[],candidateIds:['codex-native-implementation'],scopeIds:['approved-existing-files']},
    {id:'write-second',role:'implementation',ownerId:'maker-two',requirementIds:['second-correct'],dependencyIds:['write-first'],candidateIds:['codex-native-implementation'],scopeIds:['approved-existing-files']},
    {id:'audit-final',role:'verifier',ownerId:'independent-checker',requirementIds:['first-correct','second-correct'],dependencyIds:['write-first','write-second'],candidateIds:['codex-native-verifier'],scopeIds:[]}]},
    requirements:[{id:'first-correct',text:'Write target.txt exactly.',kind:'code',required:true,checks:[{checkerId:first.checkerId,revision:first.checkerRevision,parametersDigest:first.parametersDigest,targetIds:['target']}]},
      {id:'second-correct',text:'Write other.txt exactly.',kind:'code',required:true,checks:[{checkerId:second.checkerId,revision:second.checkerRevision,parametersDigest:second.parametersDigest,targetIds:['other']}]}],
    instructions:[{taskId:'write-first',text:'Write target.txt exactly after.'},{taskId:'write-second',text:'Write other.txt exactly after-other.'},{taskId:'audit-final',text:'Independently verify both approved files.'}],
    changeTargets:[{taskId:'write-first',targetId:'target',relativePath:'target.txt',maxBackupBytes:1024},{taskId:'write-second',targetId:'other',relativePath:'other.txt',maxBackupBytes:1024}]};
  const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const proposalRef=`goal-proposal:${sha(JSON.stringify(canonical(body)))}`;
  captureGoalProposal(goal,proposalRef,body);
  const proposals=new Map<string,any>([[proposalRef,body]]);
  const core=createCueCore(config,daemon,{orchestrationFactory:factory,resolveGoalProposal:(ref:string)=>proposals.get(ref)});
  try{
    const before=(db.prepare('SELECT COUNT(*) n FROM run').get() as any).n;
    for(const mutation of [
      (value:any)=>{value.plan.tasks[1].candidateIds=['codex-native-verifier'];},
      (value:any)=>{value.plan.tasks[1].scopeIds=[];},
      (value:any)=>{value.requirements[1].checks[0].parametersDigest='0'.repeat(64);},
      (value:any)=>{value.changeTargets[1].relativePath='target.txt';},
    ]){
      const invalid=structuredClone(body);mutation(invalid);
      const invalidRef=`goal-proposal:${sha(JSON.stringify(canonical(invalid)))}`;proposals.set(invalidRef,invalid);
      expect(()=>core.prepareGoalFromProposal({goal,proposalRef:invalidRef,autonomy:3,selectionMode:'efficiency'})).toThrow();
      expect((db.prepare('SELECT COUNT(*) n FROM run').get() as any).n).toBe(before);
    }
    const prepared=core.prepareGoalFromProposal({goal,proposalRef,autonomy:3,selectionMode:'efficiency'});
    core.approve(prepared.runId);core.execute(prepared.runId);
    await expect.poll(()=>core.completion(prepared.taskId).state,{timeout:120000,interval:100}).toMatch(/^(completed|blocked)$/);
    const completion=core.completion(prepared.taskId);
    if(completion.state!=='completed')throw Error(JSON.stringify({state:completion.state,reason:completion.blockedReason,
      attempts:db.prepare('SELECT task_id,state,cleanup_verified FROM orchestration_attempt').all(),activities:db.prepare('SELECT payload FROM orchestration_activity ORDER BY ordinal').all().map((row:any)=>JSON.parse(row.payload)),
      publications:db.prepare('SELECT publication_id,state,reason FROM change_publication_result').all(),vendorSpecs:fixture.vendorSpecs,first:readFileSync(target,'utf8'),second:readFileSync(other,'utf8')}));
    expect(readFileSync(target,'utf8')).toBe('after');expect(readFileSync(other,'utf8')).toBe('after-other');
    expect(db.prepare('SELECT task_id,outcome FROM native_runtime_receipt WHERE run_id=? ORDER BY rowid').all(prepared.runId)).toEqual([
      {task_id:'write-first',outcome:'succeeded'},{task_id:'write-second',outcome:'succeeded'},{task_id:'audit-final',outcome:'succeeded'}]);
    expect(db.prepare('SELECT state FROM change_publication_result ORDER BY rowid').all()).toEqual([{state:'committed'},{state:'committed'}]);
    const attempts=db.prepare('SELECT attempt_id,task_id,state,cleanup_verified FROM orchestration_attempt WHERE run_id=? ORDER BY rowid').all(prepared.runId) as any[];
    expect(attempts.map(row=>({taskId:row.task_id,state:row.state,cleanupVerified:row.cleanup_verified}))).toEqual([
      {taskId:'write-first',state:'completed',cleanupVerified:1},{taskId:'write-second',state:'completed',cleanupVerified:1},{taskId:'audit-final',state:'completed',cleanupVerified:1}]);
    expect(db.prepare("SELECT COUNT(*) n FROM attempt_staging_cleanup WHERE result='active_cleanup_verified'").get()).toEqual({n:2});
    expect(db.prepare('SELECT COUNT(*) n FROM acceptance_final WHERE run_id=?').get(prepared.runId)).toEqual({n:1});
    const stages=createStageEnvelopeBinder(db,{now:()=>fixture.now,authorizeStage:()=>false,resolveScope:()=>{throw Error('historical-only');}});
    for(const attempt of attempts.filter(row=>row.task_id!=='audit-final')){
      expect(stages.readHistorical(attempt.attempt_id)?.attemptId).toBe(attempt.attempt_id);
      expect(()=>stages.read(attempt.attempt_id)).toThrow();
    }
    expect(fixture.vendorSpecs).toBe(3);
    const prompts=readFileSync(promptLog,'utf8');expect(prompts).toContain('Write target.txt exactly after.');expect(prompts).toContain('Write other.txt exactly after-other.');
  }finally{try{await core.close();rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:50});}catch{ /* Keep unresolved native resources and primary failure. */ }}
}
test.skipIf(process.platform!=='win32')('approved arbitrary native DAG completes two serialized writers and independent verifier on real Core SQLite Git',()=>runChain(),180000);
