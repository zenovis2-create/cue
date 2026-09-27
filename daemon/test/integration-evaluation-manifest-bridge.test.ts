import {afterEach,expect,test,vi} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {JSDOM} from 'jsdom';
import {createCueCore,initializeConfig,type CueCore} from '../../app/core.mjs';
import {registerIpcHandlers} from '../../app/ipc.mjs';
import {saveSelectionPolicy,bindRunSelectionPolicy} from '../src/selection/policy-store.js';
import {readExistingFileWorkload} from '../src/evaluation/workload-release.js';

const roots:string[]=[],cores:CueCore[]=[],doms:JSDOM[]=[];
afterEach(async()=>{for(const dom of doms.splice(0))dom.window.close();for(const core of cores.splice(0))await core.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const dataset=()=>readExistingFileWorkload().datasetInput;
const command=(policyDigest='a'.repeat(64),caseId=dataset().cases[0].id)=>({operation:'enroll',enrollmentId:'enroll',dataset:dataset(),caseId,arm:'efficiency',policyKind:'monetary',policyId:'policy',policyRevision:1,policyDigest,
  metricId:'metric',metricRevision:'v1',metricDigest:'b'.repeat(64),environmentId:'env',environmentRevision:'v1',environmentDigest:'c'.repeat(64),accountLimitsId:'limits',accountLimitsRevision:'v1',accountLimitsDigest:'d'.repeat(64)});
const prepared=(runId:string)=>({runId,taskId:'task-'+runId,threeLines:['what','extent','excluded'],envelope:{expires_at:'2027-01-01T00:00:00Z',worktree_realpath:'fixture',allowed_actions:[]},orchestration:null});
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'cue-eval-manifest-'));roots.push(root);const workspace=join(root,'workspace');mkdirSync(workspace);
  const config=initializeConfig(join(root,'state'),{worktreeRoot:workspace});const core=createCueCore(config);cores.push(core);const db=core.daemon.db;
  function seed(runId:string,mode='efficiency',path=workspace){
    const policy=saveSelectionPolicy(db,{policyId:'policy-'+runId,expectedRevision:null,createdAt:'2026-09-22T00:00:00.000Z',sourceVersion:'offline-fixture',policy:{version:'cue-selection-v1',mode:mode as any,qualityMinimum:.5,costBasis:1,timeBasisMs:1000,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:null}});
    db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run('task-'+runId,'awaiting_approval','now');
    db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run('env-'+runId,path);db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId,'task-'+runId,'env-'+runId,'now');
    bindRunSelectionPolicy(db,{runId,policyId:policy.policyId,revision:1,digest:policy.digest,boundAt:'2026-09-22T00:00:00.000Z'});
    return policy;
  }
  return{root,workspace,config,core,db,seed};
}

test('actual IPC to Core to SQLite retains every case in all four mode enrollments across reopen, with no execution',async()=>{
  const f=fixture();let active='';const api=registerIpcHandlers({handle:vi.fn()},{...f.core,prepareGoal:()=>prepared(active)} as never);
  const ids:string[]=[];
  for(const mode of ['efficiency','performance','value','speed'])for(const item of dataset().cases){
    active=`${mode}-${item.id}`;const policy=f.seed(active,mode);api.invoke('cue:prepare',{});
    const input={...command(policy.digest,item.id),enrollmentId:active,arm:mode,policyId:policy.policyId};
    const reply=await api.invoke('cue:evaluation',input);expect(reply.available).toBe(true);
    const stored=f.core.readEvaluationEnrollment(active);expect(stored.dataset.cases).toHaveLength(8);expect(stored.dataset.digest).toBe(readExistingFileWorkload().dataset.digest);
    expect(stored).toMatchObject({caseId:item.id,split:item.split,inputBinding:'claimed-not-verified',arm:mode});ids.push(active);
    expect(await api.invoke('cue:evaluation',input)).toEqual(reply);
    expect((await api.invoke('cue:evaluation',{...input,metricDigest:'f'.repeat(64)})).available).toBe(false);
    expect(f.core.readEvaluationEnrollment(active)).toEqual(stored);
  }
  for(const table of ['approval_event','execution_event','orchestration_attempt'])expect(f.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({n:0});
  expect(f.db.prepare('SELECT count(*) n FROM evaluation_enrollment').get()).toEqual({n:32});
  await f.core.close();cores.splice(cores.indexOf(f.core),1);const reopened=createCueCore(f.config);cores.push(reopened);
  for(const id of ids)expect(reopened.readEvaluationEnrollment(id).dataset.digest).toBe(readExistingFileWorkload().dataset.digest);
});

test('foreign scope, policy mismatch and accepted approval still reject the complete manifest with zero enrollment writes',async()=>{
  const f=fixture(),policy=f.seed('local'),other=f.seed('foreign','efficiency',join(f.root,'foreign'));let active='local';
  const api=registerIpcHandlers({handle:vi.fn()},{...f.core,prepareGoal:()=>prepared(active)} as never);api.invoke('cue:prepare',{});
  expect((await api.invoke('cue:evaluation',{...command(policy.digest),policyId:other.policyId})).available).toBe(false);
  active='foreign';api.invoke('cue:prepare',{});expect((await api.invoke('cue:evaluation',{...command(other.digest),policyId:other.policyId})).available).toBe(false);
  active='local';api.invoke('cue:prepare',{});f.db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('local','env-local','t','i',0,'accept','now')").run();
  expect((await api.invoke('cue:evaluation',{...command(policy.digest),policyId:policy.policyId})).available).toBe(false);
  expect(f.db.prepare('SELECT count(*) n FROM evaluation_enrollment').get()).toEqual({n:0});
});

test('hostile manifests, mixed legacy fields, extra authority, unknown membership and excessive cases never call Core or getters',()=>{
  const core={prepareGoal:()=>prepared('run'),enrollEvaluation:vi.fn()},api=registerIpcHandlers({handle:vi.fn()},core as never);api.invoke('cue:prepare',{});let touched=0;
  const copy=()=>JSON.parse(JSON.stringify(dataset()));const getter=copy();Object.defineProperty(getter.cases[0],'inputDigest',{enumerable:true,get(){touched++;return 'a'.repeat(64)}});
  const sparse=copy();delete sparse.cases[0];const extra=copy();extra.cases[0].approved=true;
  const duplicate=copy();duplicate.cases[1].inputDigest=duplicate.cases[0].inputDigest;
  const oneSplit=copy();oneSplit.cases.forEach((x:any)=>x.split='evaluation');
  for(const value of [{...command(),dataset:getter},{...command(),dataset:sparse},{...command(),dataset:extra},{...command(),dataset:duplicate},{...command(),dataset:oneSplit},
    {...command(),dataset:new Proxy(dataset(),{get(){touched++;throw Error('trap')}})}, {...command(),dataset:{...copy(),cases:Array(65).fill(copy().cases[0])}},
    {...command(),caseId:'missing'},{...command(),datasetId:'legacy'},{...command(),runId:'foreign'},{...command(),enrolledAtMs:1},{...command(),arm:'manual-baseline'}])
    expect(()=>api.invoke('cue:evaluation',value)).toThrow();
  expect(core.enrollEvaluation).not.toHaveBeenCalled();expect(touched).toBe(0);
});

function ui(){
  const dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'});doms.push(dom);
  let serial=0;const api={prepare:vi.fn(async()=>prepared('run-'+(++serial))),approve:vi.fn(async()=>true),execute:vi.fn(async()=>new Promise(()=>{})),stop:vi.fn(),evaluation:vi.fn(async(input:any)=>({available:true,operation:'enroll',value:{enrollmentId:input.enrollmentId,runId:'run-'+serial,dataset:input.dataset,caseId:input.caseId,split:input.dataset.cases.find((x:any)=>x.id===input.caseId).split,inputDigest:input.dataset.cases.find((x:any)=>x.id===input.caseId).inputDigest,inputBinding:'claimed-not-verified'}}))};
  Object.assign(dom.window,{cue:api});dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));const doc=dom.window.document;
  const element=(id:string)=>doc.getElementById('evaluation-'+id) as any,submit=(id:string)=>doc.getElementById(id)!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
  for(const [key,value]of Object.entries(command())){const field=doc.querySelector(`[name="${key}"]`) as HTMLInputElement;if(field)field.value=String(value);}
  return{dom,doc,api,element,submit};
}
test('renderer explicitly imports eight cases, requires a selected split member, sends full manifest and locks after enrollment',async()=>{
  const f=ui();expect(f.api.evaluation).not.toHaveBeenCalled();f.element('dataset-json').value=JSON.stringify(dataset());f.element('dataset-import').click();
  expect(f.element('dataset-case').options).toHaveLength(9);expect(f.element('dataset-status').textContent).toContain('홀드아웃 4개');expect(f.api.evaluation).not.toHaveBeenCalled();
  f.submit('goal-form');await vi.waitFor(()=>expect(f.element('enroll').disabled).toBe(false));f.submit('evaluation-enroll-form');expect(f.api.evaluation).not.toHaveBeenCalled();
  const item=dataset().cases.find(x=>x.split==='holdout')!;f.element('dataset-case').value=item.id;f.submit('evaluation-enroll-form');
  await vi.waitFor(()=>expect(f.element('status').textContent).toContain('등록됨'));
  expect(f.api.evaluation.mock.calls[0][0]).toEqual({...command(),caseId:item.id});expect(f.element('dataset-import').disabled).toBe(true);expect(f.element('dataset-case').disabled).toBe(true);
});
test('renderer submit crosses the actual IPC and Core into durable SQLite with the full packaged manifest',async()=>{
  const backend=fixture(),policy=backend.seed('run-1'),f=ui();
  const ipc=registerIpcHandlers({handle:vi.fn()},{...backend.core,prepareGoal:()=>prepared('run-1')} as never);
  f.api.prepare.mockImplementation(async()=>ipc.invoke('cue:prepare',{}));
  // Electron serializes renderer values across realms; a direct JSDOM object
  // has a foreign prototype and must not bypass the real IPC shape guard.
  f.api.evaluation.mockImplementation(async(input:any)=>ipc.invoke('cue:evaluation',structuredClone(input)));
  for(const [name,value]of Object.entries({policyId:policy.policyId,policyDigest:policy.digest}))f.doc.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value=value;
  f.element('dataset-json').value=JSON.stringify(dataset());f.element('dataset-import').click();f.submit('goal-form');
  await vi.waitFor(()=>expect(f.element('enroll').disabled).toBe(false));const item=dataset().cases.at(-1)!;f.element('dataset-case').value=item.id;f.submit('evaluation-enroll-form');
  await vi.waitFor(()=>expect(f.element('status').textContent).toContain('등록됨'));
  expect(backend.core.readEvaluationEnrollment('enroll')).toMatchObject({runId:'run-1',caseId:item.id,split:item.split,inputBinding:'claimed-not-verified',dataset:{digest:readExistingFileWorkload().dataset.digest}});
  expect(backend.core.readEvaluationEnrollment('enroll').dataset.cases).toHaveLength(8);
  expect(backend.db.prepare('SELECT count(*) n FROM approval_event').get()).toEqual({n:0});
});

test('preparation JSON imports without path authority; malformed import clears the previous choice, reset preserves manual inputs',()=>{
  const f=ui();const legacy=f.doc.querySelector<HTMLInputElement>('[name="datasetId"]')!;legacy.value='manual-kept';
  f.element('dataset-json').value=JSON.stringify({version:'cue-evaluation-preparation-v1',authority:'input-materialization-only',executionAuthorized:false,dataset:dataset(),worktreePath:'never opened'});f.element('dataset-import').click();expect(f.element('dataset-case').options).toHaveLength(9);
  f.element('dataset-json').value=JSON.stringify({version:'cue-evaluation-workload-v1',authority:'workload-inventory-only',executionAuthorized:false,dataset:dataset()});f.element('dataset-import').click();expect(f.element('dataset-case').options).toHaveLength(9);
  f.element('dataset-json').value='<img src=x onerror=alert(1)>';f.element('dataset-import').click();expect(f.element('dataset-case').options).toHaveLength(1);expect(f.element('dataset-status').textContent).toContain('실패');expect(f.doc.querySelector('img')).toBeNull();
  f.element('dataset-reset').click();expect(legacy.value).toBe('manual-kept');expect(f.api.evaluation).not.toHaveBeenCalled();
});
test('new run clears explicit case selection and ignores a late enrollment response',async()=>{
  const f=ui();f.element('dataset-json').value=JSON.stringify(dataset());f.element('dataset-import').click();f.submit('goal-form');await vi.waitFor(()=>expect(f.element('enroll').disabled).toBe(false));
  const item=dataset().cases[0];f.element('dataset-case').value=item.id;let finish!:(value:any)=>void;f.api.evaluation.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));f.submit('evaluation-enroll-form');
  f.submit('goal-form');await vi.waitFor(()=>expect(f.element('current').textContent).toContain('run-2'));expect(f.element('dataset-case').value).toBe('');
  finish({available:true,operation:'enroll',value:{runId:'run-1',inputBinding:'claimed-not-verified'}});await Promise.resolve();expect(f.element('status').textContent).not.toContain('등록됨');expect(f.element('enroll').disabled).toBe(false);
});
