import {afterEach,expect,test,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {JSDOM} from 'jsdom';
import {createCueCore,initializeConfig,type CueCore} from '../../app/core.mjs';
import {registerIpcHandlers} from '../../app/ipc.mjs';
import {saveSelectionPolicy,bindRunSelectionPolicy} from '../src/selection/policy-store.js';
import {validateTaskPlan} from '../src/orchestration/plan.js';
import {createOrchestrationStore} from '../src/orchestration/store.js';
import {readFixedBaselinePlan} from '../src/evaluation/baseline-plan.js';
import {createManualBaselineConfirmation} from '../src/evaluation/baseline-confirmation.js';
import {createEvaluationBaselineStore} from '../src/evaluation/baseline.js';
import {createEvaluationObservationStore} from '../src/evaluation/observations.js';
import {createEvaluationTrialProjectionStore} from '../src/evaluation/trials.js';
import {normalizeEnvelope,envelopeHash} from '../src/envelope.js';

const roots:string[]=[],cores:CueCore[]=[],doms:JSDOM[]=[];
afterEach(async()=>{for(const dom of doms.splice(0))dom.window.close();for(const core of cores.splice(0))await core.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const h=(v:string)=>createHash('sha256').update(v).digest('hex');
function fixture(options:{fallback?:boolean;sameCandidate?:boolean;pin?:boolean}={}){
  const root=mkdtempSync(join(tmpdir(),'cue-fixed-baseline-'));roots.push(root);const workspace=join(root,'work');mkdirSync(workspace);
  const config=initializeConfig(join(root,'state'),{worktreeRoot:workspace}),core=createCueCore(config);cores.push(core);const db=core.daemon.db;
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-22T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['writer','checker','other'],pinnedCandidateId:options.pin?'writer':null}});
  const env=normalizeEnvelope({run_id:'run',worktree_realpath:workspace,allowed_actions:['file_change'],egress:[],expires_at:'2027-01-01T00:00:00.000Z',autonomy_level:'bounded'}),eh=envelopeHash(env);
  db.prepare("INSERT INTO task VALUES('task','awaiting_approval',NULL,'now')").run();db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(eh,workspace);db.prepare("INSERT INTO run VALUES('run','task',?,0,'now')").run(eh);
  bindRunSelectionPolicy(db,{runId:'run',policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-22T00:00:00.000Z'});
  const approval={policyRevision:'policy:1',policyDigest:policy.digest,requirementIds:['code'],allowedCandidateIds:['writer','checker','other'],allowedScopeIds:[]};
  const plan=validateTaskPlan(approval,{revision:'fixed-v1',policyRevision:'policy:1',policyDigest:policy.digest,tasks:[{id:'make',role:'implementation',ownerId:'maker',requirementIds:['code'],dependencyIds:[],candidateIds:options.fallback?['writer','other']:['writer'],scopeIds:[]},{id:'verify',role:'verifier',ownerId:'verifier',requirementIds:['code'],dependencyIds:['make'],candidateIds:[options.sameCandidate?'writer':'checker'],scopeIds:[]}]});
  createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>true,verifyReceipt:()=>({outcomeVerified:true,cleanupVerified:true})}).install('run',plan);
  const dataset={id:'dataset',revision:'v1',cases:[{id:'eval',kind:'code',split:'evaluation',inputDigest:h('eval')},{id:'hold',kind:'code',split:'holdout',inputDigest:h('hold')}]};
  const input={baselineId:'baseline',enrollmentId:'enrollment',runId:'run',dataset,caseId:'eval',metric:{id:'metric',revision:'v1',digest:h('metric')},environment:{id:'env',revision:'v1',digest:h('env')},accountLimits:{id:'limits',revision:'v1',digest:h('limits')}};
  const command={operation:'baseline',baselineId:input.baselineId,enrollmentId:input.enrollmentId,dataset,caseId:'eval',metricId:'metric',metricRevision:'v1',metricDigest:h('metric'),environmentId:'env',environmentRevision:'v1',environmentDigest:h('env'),accountLimitsId:'limits',accountLimitsRevision:'v1',accountLimitsDigest:h('limits')};
  const prepared={runId:'run',taskId:'task',threeLines:['what','extent','excluded'],envelope:{...env},orchestration:null};
  return{root,config,core,db,plan,input,command,prepared};
}
const count=(f:ReturnType<typeof fixture>)=>f.db.prepare('SELECT count(*) n FROM evaluation_baseline_declaration').get();

test('fixed plan pins writer and distinct verifier without changing global selector policy; confirmation persists and reopens',async()=>{
  const f=fixture(),confirm=vi.fn(async(view:any)=>{expect(Object.isFrozen(view.request.dataset.cases)).toBe(true);expect(view.tasks.map((t:any)=>t.candidateId)).toEqual(['writer','checker']);return true;});
  const saved=await f.core.requestManualEvaluationBaseline(f.input,confirm);expect(saved).toMatchObject({planDigest:f.plan.digest,candidate:{id:'writer',revision:'fixed-task-plan-v1'},enrollment:{arm:'manual-baseline',inputBinding:'claimed-not-verified'}});
  expect(f.db.prepare('SELECT count(*) n FROM approval_event').get()).toEqual({n:0});expect(f.db.prepare('SELECT count(*) n FROM orchestration_attempt').get()).toEqual({n:0});
  expect(await f.core.requestManualEvaluationBaseline(f.input,confirm)).toEqual(saved);expect(confirm).toHaveBeenCalledOnce();
  await expect(f.core.requestManualEvaluationBaseline({...f.input,caseId:'hold'},confirm)).rejects.toThrow('replay_conflict');expect(confirm).toHaveBeenCalledOnce();
  f.db.prepare("UPDATE task SET state='failed' WHERE id='task'").run();createEvaluationObservationStore(f.db).observe({enrollmentId:'enrollment',observationId:'observation',expectedPriorRevision:0},Date.now());
  const projection=createEvaluationTrialProjectionStore(f.db).project({projectionId:'projection',enrollmentId:'enrollment',observationId:'observation'});expect(projection).toMatchObject({outcome:'fail',arm:'manual-baseline',trial:null});
  await f.core.close();cores.splice(cores.indexOf(f.core),1);const reopened=createCueCore(f.config);cores.push(reopened);expect(reopened.readManualEvaluationBaseline('baseline')).toEqual(saved);
});

test.each([{fallback:true},{sameCandidate:true},{pin:true}])('unsupported plan refuses before confirmation: %j',async options=>{
  const f=fixture(options),confirm=vi.fn(async()=>true);await expect(f.core.requestManualEvaluationBaseline(f.input,confirm)).rejects.toThrow('fixed_plan');expect(confirm).not.toHaveBeenCalled();expect(count(f)).toEqual({n:0});
});

test('legacy declaration cannot silently opt into fixed-plan authority',()=>{
  const f=fixture(),plan=readFixedBaselinePlan(f.db,'run');
  expect(()=>createEvaluationBaselineStore(f.db,()=>true).declare({...f.input,policy:plan.policy,candidate:plan.candidate,enrolledAtMs:1,authorityRef:{id:'fixture',revision:'v1',digest:h('consent')}})).toThrow('candidate_mismatch');
});

test.each([false,undefined,1,{confirmed:true}])('only literal host confirmation true registers (%j)',async decision=>{
  const f=fixture();await expect(f.core.requestManualEvaluationBaseline(f.input,async()=>decision as any)).rejects.toThrow('denied');expect(count(f)).toEqual({n:0});
});

test('malformed/foreign/late inputs refuse before host UI and leaked promises cannot double register',async()=>{
  const f=fixture(),confirm=vi.fn(async()=>true);let touched=0;
  const getter=Object.defineProperty({...f.input.metric},'digest',{enumerable:true,get(){touched++;return h('metric')}});
  for(const input of [{...f.input,confirmed:true},{...f.input,policy:{}},{...f.input,enrolledAtMs:0},{...f.input,planDigest:f.plan.digest},{...f.input,runId:'foreign'},{...f.input,metric:getter},new Proxy(f.input,{get(){touched++;throw Error('trap')}})])await expect(f.core.requestManualEvaluationBaseline(input as any,confirm)).rejects.toThrow();
  expect(confirm).not.toHaveBeenCalled();expect(touched).toBe(0);
  let finish!:(value:boolean)=>void;const pending=f.core.requestManualEvaluationBaseline(f.input,()=>new Promise(resolve=>finish=resolve));
  await expect(f.core.requestManualEvaluationBaseline(f.input,confirm)).rejects.toThrow('busy');
  f.db.prepare("UPDATE task SET state='failed' WHERE id='task'").run();finish(true);await expect(pending).rejects.toThrow('run_started');expect(count(f)).toEqual({n:0});
});

test('pending consent snapshots renderer values but refuses a replaced task plan at final locked preflight',async()=>{
  const f=fixture(),original=h('metric');
  const saved=await f.core.requestManualEvaluationBaseline(f.input,async view=>{f.input.metric.digest=h('changed');expect(view.request.metric.digest).toBe(original);return true;});expect(saved.metric.digest).toBe(original);
  const other=fixture();
  await expect(other.core.requestManualEvaluationBaseline(other.input,async()=>{
    const old=other.plan,next=validateTaskPlan(old.approval,{revision:'changed',policyRevision:old.approval.policyRevision,policyDigest:old.approval.policyDigest,tasks:old.tasks});
    other.db.exec('DROP TRIGGER orchestration_plan_no_update');other.db.prepare("UPDATE orchestration_plan SET digest=?,payload=? WHERE run_id='run'").run(next.digest,JSON.stringify(next));return true;
  })).rejects.toThrow('fixed_plan');expect(count(other)).toEqual({n:0});
});

test('missing, oversized and post-declaration changed plans cannot be read as fixed baselines',async()=>{
  const f=fixture();await f.core.requestManualEvaluationBaseline(f.input,async()=>true);
  f.db.exec('DROP TRIGGER orchestration_plan_no_update');f.db.prepare("UPDATE orchestration_plan SET payload=? WHERE run_id='run'").run(' '.repeat(1048577));
  expect(()=>f.core.readManualEvaluationBaseline('baseline')).toThrow('fixed_plan');
  expect(()=>readFixedBaselinePlan(f.db,'missing')).toThrow('fixed_plan');
});

test('clock expiry/current-scope change after host confirmation rejects without a declaration',async()=>{
  const f=fixture();let now=100,current=true;const store=createManualBaselineConfirmation(f.db,{now:()=>now,isCurrent:()=>current});
  await expect(store.request(f.input,async()=>{now+=120001;return true;})).rejects.toThrow('stale');
  await expect(store.request(f.input,async()=>{current=false;return true;})).rejects.toThrow('stale');expect(count(f)).toEqual({n:0});
});

test.each(['new-run','approve','stop'])('IPC invalidates pending host consent after %s',async action=>{
  const f=fixture();let runId='run',finish!:(value:boolean)=>void;
  const api=registerIpcHandlers({handle:vi.fn()},{...f.core,prepareGoal:()=>({...f.prepared,runId}),approve:()=>true,stop:()=>true} as any,{confirmManualBaseline:()=>new Promise(resolve=>finish=resolve)});
  api.invoke('cue:prepare',{});const pending=api.invoke('cue:evaluation',f.command);
  if(action==='new-run'){runId='another';api.invoke('cue:prepare',{});}else api.invoke(action==='approve'?'cue:approve':'cue:stop',{runId:'run'});
  finish(true);expect(await pending).toEqual({available:false,reason:'evaluation-unavailable'});expect(count(f)).toEqual({n:0});
});

test('IPC absent host denies, exact replay works, supplied authority fields and untrusted sender reject',async()=>{
  const f=fixture(),core={...f.core,prepareGoal:()=>f.prepared},missing=registerIpcHandlers({handle:vi.fn()},core as any);missing.invoke('cue:prepare',{});
  expect(await missing.invoke('cue:evaluation',f.command)).toEqual({available:false,reason:'evaluation-unavailable'});
  const handlers=new Map<string,Function>(),sender={},confirm=vi.fn(async()=>true),api=registerIpcHandlers({handle:(channel,handler)=>handlers.set(channel,handler)},core as any,{confirmManualBaseline:confirm,isTrustedSender:event=>event===sender});
  api.invoke('cue:prepare',{});expect(()=>handlers.get('cue:evaluation')!({},f.command)).toThrow('sender');
  for(const extra of [{confirmed:true},{authorityRef:{}},{candidateId:'writer'},{policyId:'policy'},{runId:'run'},{enrolledAtMs:0}])expect(()=>api.invoke('cue:evaluation',{...f.command,...extra})).toThrow('input denied');
  const saved=await handlers.get('cue:evaluation')!(sender,f.command);expect(saved).toMatchObject({available:true,operation:'baseline',value:{arm:'manual-baseline',inputBinding:'claimed-not-verified'}});
  expect(await api.invoke('cue:evaluation',f.command)).toEqual(saved);expect(confirm).toHaveBeenCalledOnce();
});

test('real renderer to serialized IPC to Core stores only after host confirmation, without approving execution',async()=>{
  const f=fixture(),confirm=vi.fn(async()=>true),ipc=registerIpcHandlers({handle:vi.fn()},{...f.core,prepareGoal:()=>f.prepared} as any,{confirmManualBaseline:confirm});
  const dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'});doms.push(dom);const doc=dom.window.document;
  const api={prepare:async()=>ipc.invoke('cue:prepare',{}),evaluation:vi.fn(async(value:any)=>ipc.invoke('cue:evaluation',structuredClone(value))),approve:vi.fn(),execute:vi.fn(),stop:vi.fn()};
  Object.assign(dom.window,{cue:api});dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));
  const submit=(id:string)=>doc.getElementById(id)!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
  (doc.getElementById('evaluation-dataset-json') as HTMLTextAreaElement).value=JSON.stringify(f.input.dataset);doc.getElementById('evaluation-dataset-import')!.click();
  submit('goal-form');await vi.waitFor(()=>expect((doc.getElementById('evaluation-baseline') as HTMLButtonElement).disabled).toBe(false));
  for(const [key,value] of Object.entries(f.command)){const field=doc.querySelector(`[name="${key}"]`) as HTMLInputElement;if(field)field.value=String(value);}
  (doc.getElementById('evaluation-dataset-case') as HTMLSelectElement).value='eval';submit('evaluation-baseline-form');
  await vi.waitFor(()=>expect(doc.getElementById('evaluation-status')!.textContent).toContain('수동 기준선 등록됨'));
  expect(api.evaluation.mock.calls[0][0]).toEqual(f.command);expect(confirm).toHaveBeenCalledOnce();expect(count(f)).toEqual({n:1});expect(api.approve).not.toHaveBeenCalled();
  expect((doc.getElementById('evaluation-baseline') as HTMLButtonElement).disabled).toBe(true);expect(f.db.prepare('SELECT count(*) n FROM approval_event').get()).toEqual({n:0});
});

test('production native dialog defaults Cancel and requires both affirmative button and explicit checkbox',async()=>{
  const f=fixture();let view:any;await f.core.requestManualEvaluationBaseline(f.input,async value=>{view=value;return true;});
  const source=readFileSync(resolve('../app/main.mjs'),'utf8'),start=source.indexOf('    async confirmManualBaseline(view){'),end=source.indexOf('\n    },',start)+7;
  expect(start).toBeGreaterThan(0);const method=source.slice(start,end);let response=0,checked=false;const guard={assertCurrent:vi.fn()},window={isDestroyed:()=>false};
  const dialog={showMessageBox:vi.fn(async()=>({response,checkboxChecked:checked}))};
  const callback=runInNewContext(`({${method}}).confirmManualBaseline`,{guard,mainWindow:window,dialog,config:{worktreeRoot:'fixture-workspace'}});
  expect(await callback(view)).toBe(false);response=1;expect(await callback(view)).toBe(false);checked=true;expect(await callback(view)).toBe(true);
  const options=(dialog.showMessageBox.mock.calls[0] as any)[1];expect(options).toMatchObject({defaultId:0,cancelId:0,checkboxChecked:false});expect(options.detail).toContain('writer');expect(options.detail).toContain('checker');expect(options.detail).toContain(f.plan.digest);expect(guard.assertCurrent).toHaveBeenCalledTimes(6);
});
