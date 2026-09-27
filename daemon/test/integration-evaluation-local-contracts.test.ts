import {afterEach,expect,test,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir,release} from 'node:os';
import {JSDOM} from 'jsdom';
import {openLedger} from '../src/ledger.js';
import {captureLocalEvaluationContracts,LOCAL_ENVIRONMENT_MISSING} from '../src/evaluation/local-contracts.js';
import {createMeasurementContractStore,freezeMeasurementDefinition} from '../src/evaluation/measurement-contracts.js';
import {createCueCore,initializeConfig,type CueCore} from '../../app/core.mjs';
import {registerIpcHandlers} from '../../app/ipc.mjs';
const roots:string[]=[],cores:CueCore[]=[],ledgers:ReturnType<typeof openLedger>[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const core of cores.splice(0))await core.close();for(const db of ledgers.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const db=()=>{const value=openLedger(':memory:');ledgers.push(value);return value;};
function fixture(runtime:any={}){const root=mkdtempSync(join(tmpdir(),'cue-local-contracts-'));roots.push(root);const work=join(root,'work');mkdirSync(work);const config=initializeConfig(join(root,'data'),{worktreeRoot:work}),core=createCueCore(config,undefined,runtime);cores.push(core);return{config,core,db:core.daemon.db};}
const count=(db:ReturnType<typeof openLedger>,table:string)=>(db.prepare(`SELECT count(*) n FROM ${table}`).get() as {n:number}).n;
const tables=['evaluation_metric_contract','evaluation_environment_snapshot','evaluation_account_limits_snapshot','evaluation_price_snapshot','evaluation_measured_fact','approval_event'];

test('fixed local producer records actual OS/runtime and file code bytes, but never a complete execution environment',()=>{
 const ledger=db(),before=Date.now(),result=captureLocalEvaluationContracts(ledger),after=Date.now(),env=result.environment.definition as any;
 expect(result).toMatchObject({version:'cue-local-evaluation-contracts-v1',authority:'local-contract-registration-only',qualityMeasured:false,executedInputVerified:false,trialReady:false,promotionEligible:false});expect(result.missing).toEqual(LOCAL_ENVIRONMENT_MISSING);
 expect(env.complete).toBe(false);expect(env.fields.local).toMatchObject({osRelease:release(),processArchitecture:process.arch,nodeVersion:process.versions.node,v8Version:process.versions.v8});expect(env.fields.scope).toBe('local-process-at-capture-only');
 expect(env.fields.producerCodeDigest).toBe(hash(readFileSync(new URL('../src/evaluation/local-contracts.ts',import.meta.url))));expect(env.fields.checkerCodeDigest).toBe(hash(readFileSync(new URL('../src/verification/native-existing-file-checker.ts',import.meta.url))));
 expect(result.environment.observedAtMs).toBeGreaterThanOrEqual(before);expect(result.environment.observedAtMs).toBeLessThanOrEqual(after);expect(result.environment.authorityClass).toBe('host-observed');expect(result.metric.definition).toMatchObject({scoreMinimum:0,scoreMaximum:1});expect(result.metric.definition.algorithmRevision).toMatch(/^exact-artifacts-v1:[a-f0-9]{64}$/);
 expect(result.environment.sourceDigest).toBe(freezeMeasurementDefinition(env).sourceDigest);expect(Object.isFrozen(env.fields.local)).toBe(true);expect(tables.map(t=>count(ledger,t))).toEqual([1,1,0,0,0,0]);
 const text=JSON.stringify(result);for(const key of ['hostname','username','home','cwd','authProfilePath','environmentVariables'])expect(text).not.toContain('"'+key+'"');
});

test('each explicit capture is a new environment observation, metric replay preserves original timestamp and bytes',()=>{
 const ledger=db();vi.spyOn(Date,'now').mockReturnValue(100);const first=captureLocalEvaluationContracts(ledger);vi.mocked(Date.now).mockReturnValue(200);const second=captureLocalEvaluationContracts(ledger);
 expect(second.metric).toEqual(first.metric);expect(second.metric.observedAtMs).toBe(100);expect(second.environment.observedAtMs).toBe(200);expect(second.environment.revision).not.toBe(first.environment.revision);expect(second.environment.definition).toEqual(first.environment.definition);expect(tables.map(t=>count(ledger,t))).toEqual([1,2,0,0,0,0]);
});

test('default Core exposes only an explicit, workspace-bound Laya shadow read; no model or provider call',()=>{
 const f=fixture(),input={attemptId:'foreign-or-missing',taskSummary:'fixture',options:[]};
 expect(()=>f.core.prepareLayaShadowSelection(input)).toThrow('laya_shadow_unavailable');
 expect(()=>f.core.compareLayaShadowSelection(input,{model:'laya-rl-agent'})).toThrow('laya_shadow_unavailable');
 let read=false;
 expect(()=>(f.core.prepareLayaShadowSelection as any)({get attemptId(){read=true;return 'x';},taskSummary:'fixture',options:[]})).toThrow('resource_input');
 expect(read).toBe(false);
 expect(f.db.prepare('SELECT count(*) n FROM orchestration_attempt').get()).toEqual({n:0});
});

test('default Core works without measuredFactHost and packaged code hashes identify JS rather than TS',async()=>{
 const f=fixture(),saved=f.core.captureLocalEvaluationContracts(),fields=(saved.environment.definition as any).fields;
 expect(fields.producerCodeDigest).toBe(hash(readFileSync(new URL('../dist/src/evaluation/local-contracts.js',import.meta.url))));expect(fields.checkerCodeDigest).toBe(hash(readFileSync(new URL('../dist/src/verification/native-existing-file-checker.js',import.meta.url))));
 expect(()=>f.core.registerEvaluationAccountLimits({id:'fake',revision:'v1'})).toThrow('unavailable');expect(()=>f.core.registerEvaluationPrice({id:'fake',revision:'v1'})).toThrow('unavailable');
 await f.core.close();cores.splice(cores.indexOf(f.core),1);const reopened=createCueCore(f.config);cores.push(reopened);const read=vi.fn(()=>{throw Error('no producer callbacks for saved reads');}),store=createMeasurementContractStore(reopened.daemon.db,{read,nowMs:()=>{throw Error('no time');}});
 expect(store.readEnvironment(saved.environment.digest)).toEqual(saved.environment);expect(store.readMetric(saved.metric.digest)).toEqual(saved.metric);expect(read).not.toHaveBeenCalled();
});

test('local Core producer does not use injected provider/fact callbacks or accept caller definitions',()=>{
 const host={read:vi.fn(),nowMs:vi.fn(),capture:vi.fn(),terminalIntegrity:vi.fn(),resolveEvidence:vi.fn()},f=fixture({measuredFactHost:host});
 expect(()=> (f.core.captureLocalEvaluationContracts as any)({complete:true})).toThrow('input');expect(tables.map(t=>count(f.db,t))).toEqual([0,0,0,0,0,0]);f.core.captureLocalEvaluationContracts();for(const method of Object.values(host))expect(method).not.toHaveBeenCalled();
});

test('bad wall clock or outer transaction refuses before any registration',()=>{
 const ledger=db();vi.spyOn(Date,'now').mockReturnValueOnce(2).mockReturnValueOnce(1);expect(()=>captureLocalEvaluationContracts(ledger)).toThrow('clock');expect(tables.map(t=>count(ledger,t))).toEqual([0,0,0,0,0,0]);
 vi.mocked(Date.now).mockReturnValue(NaN);expect(()=>captureLocalEvaluationContracts(ledger)).toThrow('clock');ledger.exec('BEGIN');expect(()=>captureLocalEvaluationContracts(ledger)).toThrow('boundary');ledger.exec('ROLLBACK');expect(count(ledger,'evaluation_environment_snapshot')).toBe(0);
});

test('second registry failure reports failure without deleting first immutable contract; retry is explicit',()=>{
 const ledger=db();ledger.exec("CREATE TRIGGER fail_local_environment BEFORE INSERT ON evaluation_environment_snapshot BEGIN SELECT RAISE(ABORT,'test-environment-failure'); END");
 expect(()=>captureLocalEvaluationContracts(ledger)).toThrow('test-environment-failure');expect(tables.map(t=>count(ledger,t))).toEqual([1,0,0,0,0,0]);const first=ledger.prepare('SELECT payload FROM evaluation_metric_contract').get();
 ledger.exec('DROP TRIGGER fail_local_environment');captureLocalEvaluationContracts(ledger);expect(ledger.prepare('SELECT payload FROM evaluation_metric_contract').get()).toEqual(first);expect(tables.map(t=>count(ledger,t))).toEqual([1,1,0,0,0,0]);
});

test('IPC accepts only an explicit field-free local capture and returns incomplete references, not raw OS data',()=>{
 const f=fixture(),api=registerIpcHandlers({handle:vi.fn()},f.core),reply=api.invoke('cue:evaluation',{operation:'local-contract-capture'});
 expect(reply).toMatchObject({available:true,operation:'local-contract-capture',value:{environmentComplete:false,scope:'local-process-at-capture-only',qualityMeasured:false,executedInputVerified:false,trialReady:false,promotionEligible:false}});expect(reply.value.metric.id).toBe('cue-exact-artifact-quality');expect(reply.value.environment.id).toBe('cue-local-process-environment');
 for(const key of ['definition','fields','local','osRelease','producerCodeDigest'])expect(JSON.stringify(reply)).not.toContain('"'+key+'"');
 let touched=0;const hostile=Object.defineProperty({},'operation',{enumerable:true,get(){touched++;return 'local-contract-capture';}});for(const command of [{operation:'local-contract-capture',nowMs:1},{operation:'local-contract-capture',definition:{}},{operation:'local-contract-capture',runId:'other'},hostile,new Proxy({operation:'local-contract-capture'},{get(){touched++;throw Error('trap');}})])expect(()=>api.invoke('cue:evaluation',command)).toThrow();expect(touched).toBe(0);expect(count(f.db,'evaluation_environment_snapshot')).toBe(1);
});

test('IPC refuses hostile local output or complete/ready/authority upgrades without touching getters',()=>{
 const ledger=db(),saved=captureLocalEvaluationContracts(ledger),capture=vi.fn(),api=registerIpcHandlers({handle:vi.fn()},{captureLocalEvaluationContracts:capture} as never);let touched=0;
 const hostile=structuredClone(saved);Object.defineProperty((hostile.environment.definition as any).fields.local,'nodeVersion',{enumerable:true,get(){touched++;return 'secret';}});
 for(const value of [hostile,{...saved,trialReady:true},{...saved,environment:{...saved.environment,definition:{...saved.environment.definition,complete:true}}},{...saved,metric:{...saved.metric,authorityClass:'offline-fixture'}}]){capture.mockReturnValueOnce(value);expect(api.invoke('cue:evaluation',{operation:'local-contract-capture'})).toEqual({available:false,reason:'evaluation-unavailable'});}
 capture.mockImplementationOnce(()=>{throw Error('private-path');});expect(api.invoke('cue:evaluation',{operation:'local-contract-capture'})).toEqual({available:false,reason:'evaluation-unavailable'});expect(touched).toBe(0);
});

function desktop(core:CueCore){
 const dom=new JSDOM(readFileSync(new URL('../../app/renderer/index.html',import.meta.url),'utf8'),{runScripts:'outside-only',url:'http://localhost'}),bridge=registerIpcHandlers({handle:vi.fn()},core),evaluation=vi.fn(async(input:any)=>bridge.invoke('cue:evaluation',structuredClone(input)));
 (dom.window as any).cue={evaluation,resources:vi.fn(async()=>({available:false})),retrospective:vi.fn(async()=>({available:false})),prepare:vi.fn(async()=>({runId:'ui-run',taskId:'ui-task',threeLines:['a','b','c'],envelope:{expires_at:'2027-01-01T00:00:00Z',worktree_realpath:'fixture',allowed_actions:[]},orchestration:null})),planningAvailability:vi.fn(async()=>({available:false})),selectionPreferences:vi.fn(async()=>({available:false}))};
 dom.window.eval(readFileSync(new URL('../../app/renderer/renderer.js',import.meta.url),'utf8'));
 const el=(id:string)=>dom.window.document.getElementById('evaluation-local-contract-'+id) as any;return{dom,evaluation,el};
}

test('desktop explicitly captures through real IPC/Core/SQLite; copy touches only metric/environment references',async()=>{
 const f=fixture(),ui=desktop(f.core);try{
  expect(ui.evaluation).not.toHaveBeenCalled();expect(ui.el('copy').disabled).toBe(true);const doc=ui.dom.window.document;await vi.waitFor(()=>expect(doc.getElementById('selection-status')!.textContent).toContain('기본 정책'));(doc.getElementById('goal') as HTMLTextAreaElement).value='prepare fixture';doc.getElementById('goal-form')!.dispatchEvent(new ui.dom.window.Event('submit',{cancelable:true}));await vi.waitFor(()=>expect(doc.getElementById('evaluation-current')!.textContent).toContain('ui-run'));
  const form=doc.getElementById('evaluation-enroll-form') as HTMLFormElement;(form.elements.namedItem('accountLimitsId') as HTMLInputElement).value='untouched-account';
  ui.el('capture').click();await vi.waitFor(()=>expect(ui.el('output').hidden).toBe(false));expect(ui.evaluation.mock.calls[0][0]).toEqual({operation:'local-contract-capture'});expect(ui.el('status').textContent).toContain('불완전');expect(count(f.db,'evaluation_environment_snapshot')).toBe(1);expect((form.elements.namedItem('metricId') as HTMLInputElement).value).toBe('');
  ui.el('copy').click();expect((form.elements.namedItem('metricId') as HTMLInputElement).value).toBe('cue-exact-artifact-quality');expect((form.elements.namedItem('environmentId') as HTMLInputElement).value).toBe('cue-local-process-environment');expect((form.elements.namedItem('accountLimitsId') as HTMLInputElement).value).toBe('untouched-account');expect(ui.evaluation).toHaveBeenCalledTimes(1);expect(count(f.db,'approval_event')).toBe(0);expect(count(f.db,'evaluation_enrollment')).toBe(0);
 }finally{ui.dom.window.close();}
});

test('desktop hides errors and clears stale capture after new run without automatic retry or copy',async()=>{
 const f=fixture(),ui=desktop(f.core);try{
  ui.evaluation.mockRejectedValueOnce(Error('private-path'));ui.el('capture').click();await vi.waitFor(()=>expect(ui.el('status').textContent).toContain('일부 불변 계약'));expect(ui.el('output').hidden).toBe(true);expect(ui.dom.window.document.body.textContent).not.toContain('private-path');
  let finish!:(v:any)=>void;ui.evaluation.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));ui.el('capture').click();expect(ui.el('capture').disabled).toBe(true);const doc=ui.dom.window.document;(doc.getElementById('goal') as HTMLTextAreaElement).value='new run';doc.getElementById('goal-form')!.dispatchEvent(new ui.dom.window.Event('submit',{cancelable:true}));await vi.waitFor(()=>expect(doc.getElementById('evaluation-current')!.textContent).toContain('ui-run'));
  finish({available:true,operation:'local-contract-capture',value:{version:'stale'}});await Promise.resolve();await Promise.resolve();expect(ui.el('output').hidden).toBe(true);expect(ui.el('output').textContent).toBe('');expect(ui.el('copy').disabled).toBe(true);expect(ui.evaluation).toHaveBeenCalledTimes(2);
 }finally{ui.dom.window.close();}
});
