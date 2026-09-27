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
    return {...spec,command:process.execPath,args:[fixture.vendorSpecs===1?fixture.server:fixture.verifierServer]};
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

async function runChain(expireAfterCleanup=false){
  const root=mkdtempSync(join(tmpdir(),'cue-native-chain-')),workspace=join(root,'workspace'),storageRoot=join(root,'staging'),vendor=join(root,'vendor');
  fixture.root=root;mkdirSync(workspace);mkdirSync(storageRoot);mkdirSync(vendor);
  const target=join(workspace,'target.txt'),auth=join(root,'auth.json');writeFileSync(target,'before');writeFileSync(auth,'fixture');
  execFileSync('git',['init'],{cwd:workspace,stdio:'ignore'});execFileSync('git',['add','target.txt'],{cwd:workspace,stdio:'ignore'});
  execFileSync('git',['-c','user.name=Cue Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture'],{cwd:workspace,stdio:'ignore'});
  fixture.server=join(root,'fake-codex-server.cjs');
  writeFileSync(fixture.server,`const fs=require('node:fs');const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');const target=${JSON.stringify(target)};rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'fixture-thread'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'fixture-turn'}}});if(fs.readFileSync(target,'utf8')==='before')send({method:'item/tool/call',id:91,params:{threadId:'fixture-thread',turnId:'fixture-turn',callId:'approved-write',namespace:null,tool:'cue_workspace',arguments:{operation:'write_text',path:'target.txt',content:'after'}}});else{send({method:'item/completed',params:{threadId:'fixture-thread',turnId:'fixture-turn',item:{type:'agentMessage',text:'Independent verification passed.'}}});send({method:'turn/completed',params:{threadId:'fixture-thread',turn:{id:'fixture-turn',status:'completed'}}});}}else if(m.id===91){send({method:'item/completed',params:{threadId:'fixture-thread',turnId:'fixture-turn',item:{type:'agentMessage',text:'Completed the approved write.'}}});send({method:'turn/completed',params:{threadId:'fixture-thread',turn:{id:'fixture-turn',status:'completed'}}});}});`);
  fixture.verifierServer=join(root,'fake-codex-verifier.cjs');
  writeFileSync(fixture.verifierServer,String.raw`const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'verifier-thread'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'verifier-turn'}}});send({method:'item/completed',params:{threadId:'verifier-thread',turnId:'verifier-turn',item:{type:'agentMessage',text:'Independent verification passed.'}}});send({method:'turn/completed',params:{threadId:'verifier-thread',turn:{id:'verifier-turn',status:'completed'}}});}});`);
  const config=initializeConfig(join(root,'data'),{worktreeRoot:workspace}),daemon=new AppDaemon(config),db=daemon.db;
  fixture.now=Date.now();fixture.vendorSpecs=0;fixture.calls=[];fixture.expireAfterCleanup=expireAfterCleanup;fixture.clockAdvanced=false;
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
  const contract=createNativeExistingFileContract(artifacts);
  const configuration:any={installation:{provider:'codex'},authProfilePath:auth,temporaryParent:root,
    workflow:{requirementId:'implementation-correct',requirementText:'Replace target.txt with exactly after.',checkerId:contract.checkerId,
      checkerRevision:contract.checkerRevision,parametersDigest:contract.parametersDigest,targets:[{targetId:'target',relativePath:'target.txt',maxBackupBytes:1024}],
      expectedArtifacts:artifacts,launchTimeoutMs:30000,taskTimeoutMs:90000,pollMs:25},
    accounting:{currency:'TEST',unit:'micro',limitUnits:100,unitsPerCost:1,source:'fixture-conservative-prior',observedAtMs:fixture.now,
      upperUnitsByRole:{implementation:10,verifier:10},conservativeTimeMs:1000},policies,capabilityMaxAgeMs:expireAfterCleanup?1000:120000,model:'fixture-model'};
  const base=await createNativeExistingFileAuthorities({db,now:()=>fixture.now,configuration});
  const factory=await createDeploymentStagingOrchestrationFactory({configuration:JSON.stringify({version:'cue-git-staging-deployment-v1',enabled:true,storageRoot}),
    createOrchestrationFactory:()=>base});
  const core=createCueCore(config,daemon,{orchestrationFactory:factory});
  try {
    const prepared=core.prepareGoal('Replace the approved target with the expected bytes.');core.approve(prepared.runId);core.execute(prepared.runId);
    try {await expect.poll(()=>core.completion(prepared.taskId).state,{timeout:120000,interval:100}).toMatch(/^(completed|blocked)$/);expect(core.completion(prepared.taskId).state).toBe(expireAfterCleanup?'blocked':'completed');}
    catch(error){
      const count=(table:string)=>{try{return(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as any).n;}catch{return 'query-error';}};
      throw Error(JSON.stringify({error:String(error),completion:core.completion(prepared.taskId).state,reason:core.completion(prepared.taskId).blockedReason,
        vendorSpecs:fixture.vendorSpecs,calls:fixture.calls,attempts:count('orchestration_attempt'),staging:count('attempt_staging_setup'),
        stagingAuthority:count('attempt_staging_authority'),launchIntent:count('orchestration_launch_intent'),nativeReceipts:count('native_runtime_receipt'),
        cleanup:count('cleanup_observation'),publication:count('change_publication_intent'),acceptance:count('acceptance_final'),sessions:count('session_handle'),
        receiptRows:db.prepare('SELECT task_id,outcome,CAST(payload AS TEXT) payload FROM native_runtime_receipt').all().map((r:any)=>({taskId:r.task_id,outcome:r.outcome,inputs:JSON.parse(r.payload).outcomeInputs})),
        cleanupRows:db.prepare('SELECT CAST(payload AS TEXT) payload FROM cleanup_observation').all().map((r:any)=>JSON.parse(r.payload)),
        attemptRows:db.prepare('SELECT attempt_id,state,cleanup_verified FROM orchestration_attempt').all(),
        activities:db.prepare('SELECT ordinal,payload FROM orchestration_activity ORDER BY ordinal').all().map((r:any)=>({ordinal:r.ordinal,payload:JSON.parse(r.payload)})),
        acceptanceEvaluations:db.prepare('SELECT CAST(payload AS TEXT) payload FROM acceptance_evaluation').all().map((r:any)=>JSON.parse(r.payload)),
        runRoots:db.prepare('SELECT r.id,e.worktree_realpath FROM run r JOIN envelope e ON e.envelope_hash=r.envelope_hash').all(),
        stagingTarget:db.prepare('SELECT worktree_realpath FROM orchestration_attempt').all().map((r:any)=>{try{return readFileSync(join(r.worktree_realpath,'target.txt'),'utf8')}catch{return 'unavailable'}}),
        original:readFileSync(target,'utf8')}));
    }
    expect(readFileSync(target,'utf8')).toBe('after');
    expect(db.prepare("SELECT task_id,outcome FROM native_runtime_receipt WHERE run_id=? ORDER BY rowid").all(prepared.runId))
      .toEqual(expireAfterCleanup?[{task_id:'implement',outcome:'succeeded'}]:[{task_id:'implement',outcome:'succeeded'},{task_id:'verify',outcome:'succeeded'}]);
    expect(db.prepare("SELECT state FROM change_publication_result").all()).toEqual([{state:'committed'}]);
    const stages=createStageEnvelopeBinder(db,{now:()=>fixture.now,authorizeStage:()=>false,resolveScope:()=>{throw Error('historical-only');}});
    const attempts=db.prepare('SELECT attempt_id,task_id FROM orchestration_attempt WHERE run_id=? ORDER BY task_id').all(prepared.runId) as {attempt_id:string;task_id:string}[];
    expect(attempts.map(row=>row.task_id)).toEqual(expireAfterCleanup?['implement']:['implement','verify']);
    for(const row of attempts){
      expect(stages.readHistorical(row.attempt_id)?.attemptId).toBe(row.attempt_id);
    }
    const cleaned=db.prepare('SELECT attempt_id FROM attempt_staging_cleanup WHERE result=?').all('active_cleanup_verified') as {attempt_id:string}[];
    expect(cleaned).toEqual([{attempt_id:attempts.find(row=>row.task_id==='implement')!.attempt_id}]);
    expect(db.prepare('SELECT COUNT(*) n FROM attempt_staging_cleanup').get()).toEqual({n:1});
    for(const row of cleaned)
      expect(()=>stages.read(row.attempt_id)).toThrow();
    const cleanedId=cleaned[0]!.attempt_id;
    const canonical=(value:any):string=>value===null||typeof value!=='object'?JSON.stringify(value)
      :Array.isArray(value)?`[${value.map(canonical).join(',')}]`
        :`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    function corruptThenRollback(table:'attempt_staging_setup'|'attempt_staging_authority'|'attempt_staging_cleanup',mutate:(row:any,payload:any)=>void){
      const rollback=Symbol('fixture-rollback');let refused=false;
      try{db.transaction(()=>{
        const row=db.prepare(`SELECT * FROM ${table} WHERE attempt_id=?`).get(cleanedId) as any;
        const payload=JSON.parse(Buffer.from(row.payload).toString());mutate(row,payload);
        const encoded=Buffer.from(canonical(payload));
        db.exec(`DROP TRIGGER ${table}_no_update`);
        const columns=Object.keys(row).filter(key=>key!=='attempt_id');
        row.payload=encoded;row.payload_sha256=createHash('sha256').update(encoded).digest('hex');
        db.prepare(`UPDATE ${table} SET ${columns.map(key=>`${key}=?`).join(',')} WHERE attempt_id=?`)
          .run(...columns.map(key=>row[key]),cleanedId);
        try{stages.readHistorical(cleanedId);}catch{refused=true;}
        throw rollback;
      })();}catch(error){if(error!==rollback)throw error;}
      expect(refused).toBe(true);
      expect(stages.readHistorical(cleanedId)?.attemptId).toBe(cleanedId);
    }
    corruptThenRollback('attempt_staging_setup',(row,payload)=>{
      row.publication_worktree_realpath=join(workspace,'other');payload.publicationWorktreeRealpath=row.publication_worktree_realpath;
    });
    corruptThenRollback('attempt_staging_authority',(row,payload)=>{
      row.execution_file_id='0'.repeat(32);payload.executionRootIdentity.fileId=row.execution_file_id;
    });
    corruptThenRollback('attempt_staging_cleanup',(_row,payload)=>{payload.rootAbsent=false;});
    expect(db.prepare("SELECT kind,units,provider_final FROM integration_budget_receipt WHERE run_id=? ORDER BY rowid").all(prepared.runId))
      .toEqual(expireAfterCleanup?[{kind:'unknown',units:null,provider_final:0}]:[{kind:'unknown',units:null,provider_final:0},{kind:'unknown',units:null,provider_final:0}]);
    expect(db.prepare("SELECT COUNT(*) n FROM acceptance_final WHERE run_id=?").get(prepared.runId)).toEqual({n:expireAfterCleanup?0:1});
    expect(fixture.vendorSpecs).toBe(expireAfterCleanup?1:2);
    if(expireAfterCleanup)expect(fixture.clockAdvanced).toBe(true);
  } finally {try{await core.close();rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:50});}catch{ /* Retain unresolved native resources and primary error. */ }}
}
test.skipIf(process.platform!=='win32')('fixed composer completes real native issuer to publication and acceptance with local RPC controller',()=>runChain(),180000);
test.skipIf(process.platform!=='win32')('publication survives expired startup capacity after clean implementation while verifier admission refuses stale evidence',()=>runChain(true),180000);
