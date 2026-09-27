import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test } from 'vitest';
import { launchHostCodexRun, readIssuedNativeRuntimeEvidence, readIssuedHostRuntimeTiming } from '../src/host-codex-runtime.js';
import { identifyChangeSnapshotRoot } from '../src/change-snapshot-host.js';
import { normalizeEnvelope } from '../src/envelope.js';
import { openLedger } from '../src/ledger.js';
import { createCleanCodexHome } from '../src/tool-home.js';
import { createCodexExecutor } from '../src/adapters/integration-executors.js';

const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});

test.skipIf(process.platform!=='win32').each(['accepted', 'rejected'] as const)('real host performs an approved existing-file CAS with timing sink %s',async(timingSink)=>{
  const root=mkdtempSync(join(tmpdir(),'cue-native-existing-runtime-'));roots.push(root);
  const worktree=join(root,'worktree'),sourceHome=join(root,'source-home'),vendor=join(root,'vendor');mkdirSync(worktree);mkdirSync(sourceHome);mkdirSync(vendor);
  writeFileSync(join(worktree,'target.txt'),'before');writeFileSync(join(sourceHome,'auth.json'),'fixture');
  const identity=identifyChangeSnapshotRoot(worktree);expect(identity.state).toBe('ok');if(identity.state!=='ok')return;
  const codexHome=createCleanCodexHome(join(root,'homes'),join(sourceHome,'auth.json')),binary=join(vendor,'codex.exe');copyFileSync(process.execPath,binary);
  const server=join(worktree,'writer-server.cjs');writeFileSync(server,String.raw`const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'writer-thread'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'writer-turn'}}});send({method:'item/tool/call',id:91,params:{threadId:'writer-thread',turnId:'writer-turn',callId:'approved-write',namespace:null,tool:'cue_workspace',arguments:{operation:'write_text',path:'target.txt',content:'after'}}});}else if(m.id===91){send({method:'item/completed',params:{threadId:'writer-thread',turnId:'writer-turn',item:{type:'agentMessage',text:'Completed the approved write.'}}});send({method:'turn/completed',params:{threadId:'writer-thread',turn:{id:'writer-turn',status:'completed'}}});}});`);
  const db=openLedger(),now=new Date().toISOString();db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task','running',null,now);db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope',worktree,'[]',now);db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('attempt','task','envelope',1,now);
  db.exec('PRAGMA foreign_keys=OFF; DROP TRIGGER attempt_staging_authority_insert_guard; DROP TRIGGER native_runtime_receipt_insert_guard;');
  db.prepare('INSERT INTO attempt_staging_authority VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('attempt','stage','parent','a'.repeat(64),'b'.repeat(64),worktree,identity.identity.volumeSerial,identity.identity.fileId,1,'c'.repeat(64),Buffer.from('{}'));
  const envelope=normalizeEnvelope({run_id:'attempt',worktree_realpath:worktree,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:['file_change']});
  const facade:any={get open(){return db.open;},get inTransaction(){return db.inTransaction;},transaction:db.transaction.bind(db),prepare(sql:string){if(sql.startsWith('SELECT a.run_id,a.task_id,a.candidate_id'))return{get:()=>({run_id:'workflow-run',task_id:'make',candidate_id:'writer',expected_subject_digest:'d'.repeat(64)})};return db.prepare(sql);}};
  const activity: { kind: string; data: Readonly<Record<string, unknown>> }[] = [];
  const execute=createCodexExecutor({db:facade,binary,model:'fixture',tool:{id:'codex',revision:'v1'},resolveBinding:()=>({owner:{cwd:worktree,task_id:'task',run_id:'attempt'},envelope,options:{codexHome,codexHomeOwnership:'retained-authorized',goal:'Replace target.txt with exactly this UTF-8 text: after',controllerArgs:[server],verificationMode:'approved-existing-file-change',approvedExistingTargets:[{relativePath:'target.txt',maxBytes:1024}],requestTimeoutMs:5000,runTimeoutMs:10000}})});const execution=await execute({runId:'attempt',candidateId:'writer',role:'implementation',subjectDigest:'d'.repeat(64),signal:new AbortController().signal,emitActivity:(kind,data)=>{activity.push({kind,data});if(timingSink==='rejected'&&kind==='progress'&&String(data.summary).includes('cue-host-runtime-timing-v1'))return Promise.reject(Error('timing sink refused'));}});const running=execution.backend,answer=await execution.result;
  expect(answer).toMatchObject({status:'completed',successfulToolCalls:1,workerPids:[],goalVerification:{passed:true,reason:'workspace_changed',changedPaths:['target.txt']}});
  expect(readFileSync(join(worktree,'target.txt'),'utf8')).toBe('after');
  const timing = readIssuedHostRuntimeTiming(answer, 'attempt', running.session.handle);
  expect(timing).toMatchObject({ version: 'cue-host-runtime-timing-v1', clock: 'process.hrtime.bigint',
    scope: 'runtime-entry-through-local-teardown-settled', localTeardownStatus: 'settled-without-errors',
    queueIncluded: false, remoteCleanupVerified: false, endToEndVerified: false });
  expect(Object.isFrozen(timing)).toBe(true);
  expect(timing!.elapsedMs).toBe(timing!.executionAndVerificationMs + timing!.localTeardownMs);
  expect(timing!.executionAndVerificationMs).toBeGreaterThan(0);
  expect(timing!.localTeardownMs).toBeGreaterThanOrEqual(0);
  expect(Number.isSafeInteger(timing!.elapsedMs)).toBe(true);
  expect(readIssuedHostRuntimeTiming({...answer}, 'attempt', running.session.handle)).toBeNull();
  expect(readIssuedHostRuntimeTiming(answer, 'foreign', running.session.handle)).toBeNull();
  expect(readIssuedHostRuntimeTiming(answer, 'attempt', 'foreign')).toBeNull();
  await execution.completion;
  const timingEvents = activity.filter(item => item.kind === 'progress' && String(item.data.summary).includes('cue-host-runtime-timing-v1'));
  expect(timingEvents).toEqual([{kind: 'progress', data: {summary: JSON.stringify(timing), progress: 0}}]);
  expect(timingEvents[0].data.summary).not.toContain('Replace target.txt');
  expect(Buffer.byteLength(String(timingEvents[0].data.summary))).toBeLessThan(1024);
  const binding={runId:'workflow-run',taskId:'make',attemptId:'attempt',candidateId:'writer',subjectDigest:'d'.repeat(64),sessionHandle:running.session.handle,role:'implementation' as const,verificationMode:'approved-existing-file-change' as const};
  const evidence=readIssuedNativeRuntimeEvidence(answer,binding);expect(evidence).toMatchObject({version:'cue-issued-native-runtime-evidence-v1',controller:{pid:answer.controllerPid},workers:[],resources:[{path:codexHome,ownership:'retained-authorized',cleanup:'retained'}]});expect(readIssuedNativeRuntimeEvidence(answer,binding)).toBe(evidence);expect(()=>readIssuedNativeRuntimeEvidence({...answer},binding)).toThrow('unissued');
  expect(await execution.runtimeReceipt).toMatch(/^cue-native-runtime-receipt:/u);expect(await execution.completion).toBe(timingSink==='accepted'?'succeeded':'failed');expect(db.prepare('SELECT run_id,attempt_id,candidate_id,outcome FROM native_runtime_receipt').get()).toEqual({run_id:'workflow-run',attempt_id:'attempt',candidate_id:'writer',outcome:'succeeded'});
  expect(db.prepare("SELECT role,boundary FROM session_runtime ORDER BY rowid").all()).toEqual([{role:'controller',boundary:'host-model-only'}]);db.close();
},120000);

test.skipIf(process.platform!=='win32')('real host refuses generic, unapproved and contended writes without launching workers',async()=>{
  const cases: {name:string;args:Record<string,unknown>;expected:string|null;race?:boolean}[]=[
    {name:'generic',args:{program:'cmd.exe',args:['/d','/c','echo forbidden']},expected:'before'},
    {name:'unapproved',args:{operation:'write_text',path:'other.txt',content:'after'},expected:'before'},
    {name:'contended',args:{operation:'write_text',path:'target.txt',content:'after'},expected:'raced',race:true},
    {name:'new-file',args:{operation:'write_text',path:'target.txt',content:'after'},expected:null},
  ];
  for(const item of cases){
    const root=mkdtempSync(join(tmpdir(),`cue-native-hostile-${item.name}-`));roots.push(root);const worktree=join(root,'worktree'),sourceHome=join(root,'source-home'),vendor=join(root,'vendor');mkdirSync(worktree);mkdirSync(sourceHome);mkdirSync(vendor);if(item.expected!==null)writeFileSync(join(worktree,'target.txt'),'before');writeFileSync(join(sourceHome,'auth.json'),'fixture');
    const identity=identifyChangeSnapshotRoot(worktree);expect(identity.state).toBe('ok');if(identity.state!=='ok')continue;
    const codexHome=createCleanCodexHome(join(root,'homes'),join(sourceHome,'auth.json')),binary=join(vendor,'codex.exe');copyFileSync(process.execPath,binary);
    const server=join(worktree,'hostile-server.cjs'),race=item.race?`require('node:fs').writeFileSync(${JSON.stringify(join(worktree,'target.txt'))},'raced');`:'';
    writeFileSync(server,`const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'hostile-thread'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'hostile-turn'}}});${race}send({method:'item/tool/call',id:91,params:{threadId:'hostile-thread',turnId:'hostile-turn',callId:'hostile',namespace:null,tool:'cue_workspace',arguments:${JSON.stringify(item.args)}}});}else if(m.id===91){send({method:'item/completed',params:{threadId:'hostile-thread',turnId:'hostile-turn',item:{type:'agentMessage',text:'request refused'}}});send({method:'turn/completed',params:{threadId:'hostile-thread',turn:{id:'hostile-turn',status:'completed'}}});}});`);
    const db=openLedger(),now=new Date().toISOString();db.prepare('INSERT INTO task VALUES(?,?,?,?)').run(`task-${item.name}`,'running',null,now);db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(`envelope-${item.name}`,worktree,'[]',now);db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run(`attempt-${item.name}`,`task-${item.name}`,`envelope-${item.name}`,1,now);db.exec('PRAGMA foreign_keys=OFF; DROP TRIGGER attempt_staging_authority_insert_guard;');db.prepare('INSERT INTO attempt_staging_authority VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(`attempt-${item.name}`,'stage','parent','a'.repeat(64),'b'.repeat(64),worktree,identity.identity.volumeSerial,identity.identity.fileId,1,'c'.repeat(64),Buffer.from('{}'));
    const envelope=normalizeEnvelope({run_id:`attempt-${item.name}`,worktree_realpath:worktree,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:['file_change']});
    const answer=await launchHostCodexRun(db,{cwd:worktree,task_id:`task-${item.name}`,run_id:`attempt-${item.name}`},envelope,{binary,codexHome,goal:'Only approved existing target.',controllerArgs:[server],verificationMode:'approved-existing-file-change',approvedExistingTargets:[{relativePath:'target.txt',maxBytes:1024}],requestTimeoutMs:5000,runTimeoutMs:10000}).done;
    expect(answer).toMatchObject({successfulToolCalls:0,workerPids:[],goalVerification:{passed:false}});if(item.expected===null)expect(existsSync(join(worktree,'target.txt'))).toBe(false);else expect(readFileSync(join(worktree,'target.txt'),'utf8')).toBe(item.expected);expect(existsSync(join(worktree,'other.txt'))).toBe(false);expect(db.prepare("SELECT role,boundary FROM session_runtime ORDER BY rowid").all()).toEqual([{role:'controller',boundary:'host-model-only'}]);db.close();
  }
},60000);

test('runtime timing refuses fabricated observations and proxies without invoking getters or traps',()=>{
  let reads = 0;
  const forged = Object.defineProperty({}, 'timing', {get(){reads++; throw Error('getter');}});
  const proxy = new Proxy({}, {get(){reads++; throw Error('trap');}});
  for (const value of [null, undefined, forged, proxy, {version:'cue-host-runtime-timing-v1'}]) {
    expect(readIssuedHostRuntimeTiming(value, 'attempt', 'session')).toBeNull();
  }
  expect(reads).toBe(0);
});

test('native existing-file mode rejects broader authority before controller launch',()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-native-existing-admission-'));roots.push(root);
  const envelope=normalizeEnvelope({run_id:'attempt',worktree_realpath:root,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:['file_change','command']});
  expect(()=>launchHostCodexRun({} as never,{cwd:root,task_id:'task',run_id:'attempt'},envelope,{binary:'C:/codex.exe',codexHome:'C:/home',goal:'write',verificationMode:'approved-existing-file-change',approvedExistingTargets:[{relativePath:'target.txt',maxBytes:1}]})).toThrow('exact file_change authority');
});

test('invalid target authority is descriptor-safe and fails before controller filesystem or session mutation',()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-native-existing-invalid-'));roots.push(root);let getterCalls=0,queries=0;
  const target:any={maxBytes:1};Object.defineProperty(target,'relativePath',{enumerable:true,get(){getterCalls++;return'target.txt';}});
  const db:any={prepare(){queries++;return{get(){throw Error('ledger must not be read');}}}};
  const envelope=normalizeEnvelope({run_id:'attempt',worktree_realpath:root,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:['file_change']});
  expect(()=>launchHostCodexRun(db,{cwd:root,task_id:'task',run_id:'attempt'},envelope,{binary:'C:/codex.exe',codexHome:join(root,'home'),goal:'write',verificationMode:'approved-existing-file-change',approvedExistingTargets:[target]})).toThrow('invalid approved existing-file target');
  expect({getterCalls,queries,controllerCreated:existsSync(join(root,'home','controller-workspace'))}).toEqual({getterCalls:0,queries:0,controllerCreated:false});
});

test('proxy target arrays are refused without invoking traps or mutating controller state',()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-native-existing-proxy-'));roots.push(root);let traps=0,queries=0;
  const targets=new Proxy([{relativePath:'target.txt',maxBytes:1}],{get(){traps++;throw Error('trap');}});
  const db:any={prepare(){queries++;throw Error('ledger must not be read');}};
  const envelope=normalizeEnvelope({run_id:'attempt',worktree_realpath:root,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:['file_change']});
  expect(()=>launchHostCodexRun(db,{cwd:root,task_id:'task',run_id:'attempt'},envelope,{binary:'C:/codex.exe',codexHome:join(root,'home'),goal:'write',verificationMode:'approved-existing-file-change',approvedExistingTargets:targets})).toThrow('approved existing-file targets required');
  expect({traps,queries,controllerCreated:existsSync(join(root,'home','controller-workspace'))}).toEqual({traps:0,queries:0,controllerCreated:false});
});
