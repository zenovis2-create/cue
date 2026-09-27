import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test } from 'vitest';
import { createNativeImplementationHost } from '../../app/native-implementation-host.mjs';
import { AppDaemon, initializeConfig } from '../../app/core.mjs';
import { createCodexVerifierCandidate } from '../src/adapters/integration-executors.js';
import { launchHostCodexRun, type RunningHostCodexRun } from '../src/host-codex-runtime.js';
import { normalizeEnvelope } from '../src/envelope.js';
import { openLedger, type Ledger } from '../src/ledger.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { createCleanCodexHome } from '../src/tool-home.js';

const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const result=()=>({threadId:'thread',turnId:'turn',status:'completed' as const,finalMessage:'verified',controllerPid:1,workerPids:[2],successfulToolCalls:0,
  goalVerification:{passed:false,reason:'read_only_result_received' as const,changedPaths:[]}});

test('Codex verifier preserves lifecycle but rejects implementation role and write authority before launch',async()=>{
  let launches=0,stops=0;const bound=(actions:string[]=[])=>({owner:{run_id:'attempt',task_id:'verify',cwd:'C:/fixture'},envelope:{run_id:'attempt',worktree_realpath:'C:/fixture',
    egress:[],expires_at:'2026-09-17T00:00:00.000Z',autonomy_level:'bounded' as const,allowed_actions:actions},options:{codexHome:'C:/isolated',goal:'verify only'}});
  const candidate=createCodexVerifierCandidate({db:{} as Ledger,binary:'C:/vendor/codex.exe',model:'gpt-verifier',tool:{id:'codex',revision:'v1'},availability:'ready',
    buildCurrentSubject:()=>({} as MeasurementSubject),evidenceReferences:()=>({}),resolveBinding:()=>bound(),launch:()=>{launches++;return{session:{handle:'verifier-session'},done:Promise.resolve(result()),stop(){stops++;}} as unknown as RunningHostCodexRun;}});
  expect(candidate.supportedRoles).toEqual(['model']);
  const execution=await candidate.launch({runId:'attempt',candidateId:'verifier',role:'model',subjectDigest:'a'.repeat(64),signal:new AbortController().signal});
  expect(execution.durableRef).toBe('session:verifier-session');expect(await execution.completion).toBe('failed');await execution.cancel();expect(stops).toBe(1);
  await expect(candidate.launch({runId:'attempt',candidateId:'verifier',role:'implementation',subjectDigest:'a'.repeat(64),signal:new AbortController().signal})).rejects.toThrow('role_mismatch');
  const writable=createCodexVerifierCandidate({db:{} as Ledger,binary:'C:/vendor/codex.exe',model:'gpt-verifier',tool:{id:'codex',revision:'v1'},availability:'ready',
    buildCurrentSubject:()=>({} as MeasurementSubject),evidenceReferences:()=>({}),resolveBinding:()=>bound(['file_change']),launch:()=>{launches++;throw Error('must not launch');}});
  await expect(writable.launch({runId:'attempt',candidateId:'verifier',role:'model',subjectDigest:'a'.repeat(64),signal:new AbortController().signal})).rejects.toThrow('write_authority');
  expect(launches).toBe(1);
});

test.skipIf(process.platform!=='win32')('real host runtime completes a read-only verifier without snapshot workers or workspace authority',async()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-native-verifier-runtime-'));roots.push(root);const worktree=join(root,'worktree'),sourceHome=join(root,'source-home'),vendor=join(root,'vendor');
  mkdirSync(worktree);mkdirSync(sourceHome);mkdirSync(vendor);writeFileSync(join(worktree,'unchanged.txt'),'original');writeFileSync(join(sourceHome,'auth.json'),'fixture');
  const codexHome=createCleanCodexHome(join(root,'homes'),join(sourceHome,'auth.json')),binary=join(vendor,'codex.exe');copyFileSync(process.execPath,binary);
  const server=join(worktree,'verifier-server.cjs');writeFileSync(server,String.raw`const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'readonly-thread'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'readonly-turn'}}});send({method:'item/completed',params:{threadId:'readonly-thread',turnId:'readonly-turn',item:{type:'agentMessage',text:'Independent verification passed.'}}});send({method:'turn/completed',params:{threadId:'readonly-thread',turn:{id:'readonly-turn',status:'completed'}}});}});`);
  const db=openLedger(),now=new Date().toISOString();db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task','running',null,now);db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope',worktree,'[]',now);db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('attempt','task','envelope',1,now);db.exec('PRAGMA foreign_keys=OFF; DROP TRIGGER native_runtime_receipt_insert_guard;');
  const envelope=normalizeEnvelope({run_id:'attempt',worktree_realpath:worktree,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:[]});
  const facade:any={get open(){return db.open;},get inTransaction(){return db.inTransaction;},transaction:db.transaction.bind(db),prepare(sql:string){if(sql.startsWith('SELECT a.run_id,a.task_id,a.candidate_id'))return{get:()=>({run_id:'workflow-run',task_id:'verify',candidate_id:'verifier',expected_subject_digest:'d'.repeat(64)})};return db.prepare(sql);}};
  const candidate=createCodexVerifierCandidate({db:facade,binary,model:'fixture',tool:{id:'codex',revision:'v1'},availability:'ready',buildCurrentSubject:()=>({} as MeasurementSubject),evidenceReferences:()=>({}),resolveBinding:()=>({owner:{cwd:worktree,task_id:'task',run_id:'attempt'},envelope,options:{codexHome,goal:'Verify only.',controllerArgs:[server],requestTimeoutMs:5000,runTimeoutMs:10000}})});const execution=await candidate.launch({runId:'attempt',candidateId:'verifier',role:'model',subjectDigest:'d'.repeat(64),signal:new AbortController().signal}) as any;const answer=await execution.result;
  expect(answer).toMatchObject({status:'completed',finalMessage:'Independent verification passed.',successfulToolCalls:0,workerPids:[],goalVerification:{passed:false,reason:'read_only_result_received',changedPaths:[]}});
  expect(db.prepare("SELECT role,boundary FROM session_runtime ORDER BY rowid").all()).toEqual([{role:'controller',boundary:'host-model-only'}]);
  expect(db.prepare("SELECT count(*) n FROM artifact WHERE run_id=?").get('attempt')).toEqual({n:0});
  expect(await execution.runtimeReceipt).toMatch(/^cue-native-runtime-receipt:/u);expect(await execution.completion).toBe('succeeded');expect(db.prepare('SELECT outcome FROM native_runtime_receipt').get()).toEqual({outcome:'succeeded'});
  db.close();
});

test.skipIf(process.platform!=='win32')('real read-only host rejects controller workspace tools without creating a worker',async()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-native-verifier-tool-'));roots.push(root);const worktree=join(root,'worktree'),sourceHome=join(root,'source-home'),vendor=join(root,'vendor');mkdirSync(worktree);mkdirSync(sourceHome);mkdirSync(vendor);writeFileSync(join(sourceHome,'auth.json'),'fixture');
  const codexHome=createCleanCodexHome(join(root,'homes'),join(sourceHome,'auth.json')),binary=join(vendor,'codex.exe');copyFileSync(process.execPath,binary);
  const server=join(worktree,'tool-server.cjs');writeFileSync(server,String.raw`const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'tool-thread'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'tool-turn'}}});send({method:'item/tool/call',id:91,params:{threadId:'tool-thread',turnId:'tool-turn',callId:'forbidden-tool',namespace:null,tool:'cue_workspace',arguments:{program:'cmd.exe',args:['/d','/c','echo forbidden>forbidden.txt']}}});}else if(m.id===91){send({method:'item/completed',params:{threadId:'tool-thread',turnId:'tool-turn',item:{type:'agentMessage',text:'tool was refused'}}});send({method:'turn/completed',params:{threadId:'tool-thread',turn:{id:'tool-turn',status:'completed'}}});}});`);
  const db=openLedger(),now=new Date().toISOString();db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-tool','running',null,now);db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-tool',worktree,'[]',now);db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('attempt-tool','task-tool','envelope-tool',1,now);
  const envelope=normalizeEnvelope({run_id:'attempt-tool',worktree_realpath:worktree,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:[]});
  const answer=await launchHostCodexRun(db,{cwd:worktree,task_id:'task-tool',run_id:'attempt-tool'},envelope,{binary,codexHome,goal:'Verify only.',controllerArgs:[server],verificationMode:'read-only-result',requestTimeoutMs:5000,runTimeoutMs:10000}).done;
  expect(answer).toMatchObject({status:'completed',successfulToolCalls:0,workerPids:[],goalVerification:{passed:false,reason:'model_not_completed',changedPaths:[]}});
  expect(db.prepare("SELECT role,boundary FROM session_runtime ORDER BY rowid").all()).toEqual([{role:'controller',boundary:'host-model-only'}]);
  expect(db.prepare("SELECT count(*) n FROM artifact WHERE run_id=?").get('attempt-tool')).toEqual({n:0});
  expect(()=>launchHostCodexRun(db,{cwd:worktree,task_id:'task-tool',run_id:'attempt-tool'},normalizeEnvelope({...envelope,allowed_actions:['command']}),{binary,codexHome,goal:'Verify only.',controllerArgs:[server],verificationMode:'read-only-result'})).toThrow('empty authority envelope');
  db.close();
});

test.skipIf(process.platform!=='win32')('real read-only host rejects an empty terminal model result',async()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-native-verifier-empty-'));roots.push(root);const worktree=join(root,'worktree'),sourceHome=join(root,'source-home'),vendor=join(root,'vendor');mkdirSync(worktree);mkdirSync(sourceHome);mkdirSync(vendor);writeFileSync(join(sourceHome,'auth.json'),'fixture');
  const codexHome=createCleanCodexHome(join(root,'homes'),join(sourceHome,'auth.json')),binary=join(vendor,'codex.exe');copyFileSync(process.execPath,binary);
  const server=join(worktree,'empty-server.cjs');writeFileSync(server,String.raw`const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'empty-thread'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'empty-turn'}}});send({method:'turn/completed',params:{threadId:'empty-thread',turn:{id:'empty-turn',status:'completed'}}});}});`);
  const db=openLedger(),now=new Date().toISOString();db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-empty','running',null,now);db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-empty',worktree,'[]',now);db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('attempt-empty','task-empty','envelope-empty',1,now);
  const envelope=normalizeEnvelope({run_id:'attempt-empty',worktree_realpath:worktree,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:[]});
  const answer=await launchHostCodexRun(db,{cwd:worktree,task_id:'task-empty',run_id:'attempt-empty'},envelope,{binary,codexHome,goal:'Verify only.',controllerArgs:[server],verificationMode:'read-only-result',requestTimeoutMs:5000,runTimeoutMs:10000}).done;
  expect(answer).toMatchObject({status:'completed',finalMessage:'',successfulToolCalls:0,workerPids:[],goalVerification:{passed:false,reason:'model_not_completed',changedPaths:[]}});
  expect(db.prepare("SELECT role,boundary FROM session_runtime ORDER BY rowid").all()).toEqual([{role:'controller',boundary:'host-model-only'}]);db.close();
});

function fixture(){
  const root=mkdtempSync(join(tmpdir(),'cue-native-verifier-'));roots.push(root);const workspace=join(root,'workspace');mkdirSync(workspace);
  const daemon=new AppDaemon(initializeConfig(join(root,'data'),{worktreeRoot:workspace})),db=daemon.db,now=Date.now(),ids=['codex-writer','codex-verifier'];
  const subject=Object.fromEntries(SUBJECT_FIELDS.map(key=>[key,key.endsWith('Sha256')?'a'.repeat(64):key])) as MeasurementSubject;
  const policies:any={};for(const mode of ['efficiency','performance','value','speed'] as const){const saved=saveSelectionPolicy(db,{policyId:`native-verifier-${mode}`,expectedRevision:null,createdAt:new Date(now).toISOString(),sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode,qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:10000,allowedCandidateIds:ids,pinnedCandidateId:null}});policies[mode]={policyId:saved.policyId,revision:saved.revision,digest:saved.digest};}
  const record=(canonicalId:string,authReference:string)=>({canonicalId,toolId:canonicalId,kind:'agent' as const,aliases:[],installation:'installed' as const,protocol:'verified' as const,authReference,authAvailable:true,sourceVersion:'fixture',observedAt:new Date(now).toISOString(),subjectDigest:subjectDigest(subject),binding:null});
  const observed=(id:string)=>({id,checks:{eligible:true,authenticated:true,compatible:true,dataAllowed:true,resourceAvailable:true,quotaAvailable:true},estimate:{scope:'verified-completion-total',quality:1,expectedCost:1,conservativeMaxCost:1,expectedTimeMs:1,conservativeMaxTimeMs:1,currency:'TEST',source:'fixture',observedAtMs:now}});
  let launches=0;const executor=(actions:string[])=>({db,binary:'C:/vendor/codex.exe',model:'gpt-5',tool:{id:'codex',revision:'v1'},availability:'ready' as const,
    resolveBinding:()=>({owner:{run_id:'attempt',task_id:'verify',cwd:workspace},envelope:{run_id:'attempt',worktree_realpath:workspace,egress:[],expires_at:new Date(now+10000).toISOString(),autonomy_level:'bounded' as const,allowed_actions:actions},options:{codexHome:root,goal:'verify'}}),
    launch:()=>{launches++;return{session:{handle:'native-verifier'},done:Promise.resolve(result()),stop(){}} as unknown as RunningHostCodexRun;}});
  const options:any={db,now:()=>now,workflow:{requirementId:'correct',requirementText:'Verify the implementation.',checkerId:'checker',checkerRevision:'v1',parametersDigest:'b'.repeat(64),targets:[{targetId:'target',relativePath:'target.txt',maxBackupBytes:1024}],launchTimeoutMs:1000,taskTimeoutMs:5000,pollMs:5},policies,
    accounting:{currency:'TEST',unit:'micro',limitUnits:100,unitsPerCost:1,source:'fixture',observedAtMs:now,upperUnitsByRole:{implementation:10,verifier:10}},
    implementation:{record:record(ids[0],'writer-account'),currentSubject:()=>subject,evidenceReferences:()=>({}),observeCandidate:()=>observed(ids[0]),executor:executor(['file_change'])},
    verifier:{record:record(ids[1],'verifier-account'),currentSubject:()=>subject,evidenceReferences:()=>({}),observeCandidate:()=>observed(ids[1]),executor:executor([])},
    requirementCheckers:[],resolveRequirementChecker:()=>undefined,acceptance:{},authorizePublication:()=>true,verifyFinalBilling:()=>false,authority:{},runtime:{evidence:{maxAgeMs:1000},authorizeRun:()=>true},engine:{reservation:()=>({}),verifyBudgetMapping:()=>true}};
  return{daemon,options,ids,subject,launches:()=>launches};
}

test('native implementation host consumes a distinct typed verifier executor without granting writer authority',async()=>{
  const value=fixture();try{const host=createNativeImplementationHost(value.options) as any;expect(host.available).not.toBe(false);
    const candidate=host.runtime.resolveCandidate(value.ids[1]);expect(candidate.supportedRoles).toEqual(['model']);
    const execution=await candidate.launch({runId:'attempt',candidateId:value.ids[1],role:'model',subjectDigest:subjectDigest(value.subject),signal:new AbortController().signal});
    expect(await execution.completion).toBe('failed');expect(value.launches()).toBe(1);
    const shared=createNativeImplementationHost({...value.options,verifier:{...value.options.verifier,record:{...value.options.verifier.record,authReference:'writer-account'}}}) as any;
    expect(shared.available).not.toBe(false);expect(shared.runtime.resolveCandidate(value.ids[1]).supportedRoles).toEqual(['model']);
  }finally{await value.daemon.close();}
});
