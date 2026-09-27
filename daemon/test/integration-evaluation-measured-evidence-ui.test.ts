import { expect, test, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerIpcHandlers } from '../../app/ipc.mjs';

const h=(value:string)=>value.repeat(64).slice(0,64);
const coreEvidence=(factId='fact')=>({
  version:'cue-evaluation-measured-fact-evidence-v1',authority:'measured-fact-evidence-only',factId,factDigest:h('a'),enrollmentId:'enroll',observationId:'obs',runId:'run-a',datasetDigest:h('b'),caseId:'case',arm:'efficiency',policyDigest:h('c'),
  producer:{class:'host-observed',revision:'producer-v1',digest:h('d'),recordedAtMs:40},executedInput:{expectedDigest:h('e'),actualDigest:h('e'),matches:true,evidenceDigest:h('f')},
  attempts:[{attemptId:'attempt',role:'implementation',state:'completed',retryOf:null,candidateDigest:h('1'),launchIntentDigest:h('2'),identityDigest:h('3'),handoffDigest:h('4'),toolId:'tool',toolRevision:'tool-v2',modelId:'model',modelRevision:'model-r3'}],
  measurements:{quality:{availability:'unavailable'},timing:{availability:'available',elapsedMs:3,clockId:'clock',clockRevision:'v1',clockDigest:h('5'),evidenceDigest:h('6'),scope:'execution'},accounting:{availability:'available',kind:'local-invocation',priceDigest:null}},contracts:{environmentDigest:h('7'),accountLimitsDigest:h('8'),priceDigest:null},uncertaintyReasons:['quality-unavailable','host:/secret/path'],trialReady:false,promotionEligible:false,digest:h('9'),extraSecret:'must-not-copy'
});
const safeEvidence=(factId='fact')=>({version:'cue-evaluation-measured-fact-evidence-v1',authority:'measured-fact-evidence-only',factId,producer:{class:'host-observed',revision:'producer-v1',recordedAtMs:40},attempts:[{attemptId:'attempt',role:'implementation',state:'completed',toolId:'tool',toolRevision:'tool-v2',modelId:'model',modelRevision:'model-r3'}],measurements:{quality:{availability:'unavailable'},timing:{availability:'available',elapsedMs:3},accounting:{availability:'available',kind:'local-invocation'}},uncertaintyCount:2,trialReady:false,promotionEligible:false});
const prepared=(runId='run-a')=>({runId,taskId:'task-'+runId,threeLines:['what','extent','excluded'],envelope:{expires_at:'2027-01-01T00:00:00Z',worktree_realpath:'fixture',allowed_actions:[]},orchestration:null});

test('IPC allows exact measured-fact read before prepare and returns only the bounded safe summary',async()=>{
  const value=coreEvidence();delete (value as any).extraSecret;const core={projectEvaluationMeasuredFactEvidence:vi.fn(()=>value)},api=registerIpcHandlers({handle:vi.fn()},core as never);
  const reply=await api.invoke('cue:evaluation',{operation:'measured-fact-read',factId:'fact'});
  expect(core.projectEvaluationMeasuredFactEvidence).toHaveBeenCalledWith({factId:'fact'});expect(reply).toEqual({available:true,operation:'measured-fact-read',value:safeEvidence()});
  expect(JSON.stringify(reply)).not.toContain('evidenceDigest');expect(JSON.stringify(reply)).not.toContain('priceDigest');expect(JSON.stringify(reply)).not.toContain('host:/secret/path');expect(Object.isFrozen(reply.value.attempts)).toBe(true);
});

test('IPC denies wrong identity, authority, readiness, promotion and hostile shapes without detail leakage',async()=>{
  let touched=0;const core={projectEvaluationMeasuredFactEvidence:vi.fn()},api=registerIpcHandlers({handle:vi.fn()},core as never);
  for(const command of [{operation:'measured-fact-read',factId:'bad id'},{operation:'measured-fact-read',factId:'fact',runId:'caller'},Object.defineProperty({operation:'measured-fact-read'},'factId',{enumerable:true,get(){touched++;return 'fact'}}),new Proxy({operation:'measured-fact-read',factId:'fact'},{})])expect(()=>api.invoke('cue:evaluation',command)).toThrow('input denied');
  expect(core.projectEvaluationMeasuredFactEvidence).not.toHaveBeenCalled();expect(touched).toBe(0);
  for(const change of [{authority:'other'},{factId:'foreign'},{trialReady:true},{promotionEligible:true}]){const value=coreEvidence();delete (value as any).extraSecret;Object.assign(value,change);core.projectEvaluationMeasuredFactEvidence.mockReturnValueOnce(value as any);expect(await api.invoke('cue:evaluation',{operation:'measured-fact-read',factId:'fact'})).toEqual({available:false,reason:'evaluation-unavailable'});}
  const hostile=coreEvidence();delete (hostile as any).extraSecret;Object.defineProperty(hostile.producer,'revision',{enumerable:true,get(){touched++;return 'secret'}});core.projectEvaluationMeasuredFactEvidence.mockReturnValueOnce(hostile as any);expect(await api.invoke('cue:evaluation',{operation:'measured-fact-read',factId:'fact'})).toEqual({available:false,reason:'evaluation-unavailable'});expect(touched).toBe(0);
  core.projectEvaluationMeasuredFactEvidence.mockImplementationOnce(()=>{throw Error('C:/secret/evidence.bin')});expect(await api.invoke('cue:evaluation',{operation:'measured-fact-read',factId:'missing'})).toEqual({available:false,reason:'evaluation-unavailable'});
});

function fixture(){
  const dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'}),evidence=safeEvidence();
  const api={prepare:vi.fn(async()=>prepared()),approve:vi.fn(),execute:vi.fn(),stop:vi.fn(),evaluation:vi.fn(async()=>({available:true,operation:'measured-fact-read',value:evidence}))};Object.assign(dom.window,{cue:api});dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));
  return{dom,doc:dom.window.document,api,evidence,submit(){dom.window.document.querySelector('#evaluation-measured-fact-form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));}};
}

test('DOM reads only on manual request and discloses producer, provenance and unavailable measurements safely',async()=>{const f=fixture();try{
  expect(f.api.evaluation).not.toHaveBeenCalled();f.doc.querySelector<HTMLInputElement>('#evaluation-measured-fact-form [name="factId"]')!.value='fact';f.submit();await vi.waitFor(()=>expect(f.doc.querySelector<HTMLElement>('#evaluation-measured-fact-output')!.hidden).toBe(false));
  expect(f.api.evaluation).toHaveBeenCalledWith({operation:'measured-fact-read',factId:'fact'});expect(f.doc.querySelector('#evaluation-measured-fact-summary')!.textContent).toContain('호스트 관측');expect(f.doc.querySelector('#evaluation-measured-fact-attempts')!.textContent).toContain('tool-v2');expect(f.doc.querySelector('#evaluation-measured-fact-attempts')!.textContent).toContain('model-r3');expect(f.doc.querySelector('#evaluation-measured-fact-measurements')!.textContent).toContain('품질 알 수 없음');expect(f.doc.querySelector('#evaluation-measured-fact-measurements')!.textContent).toContain('시간 3밀리초');expect(f.doc.querySelector('#evaluation-measured-fact-limit')!.textContent).toContain('trial 준비나 정책 승격을 허용하지 않습니다');expect(f.doc.body.textContent).not.toContain('host:/secret/path');
}finally{f.dom.window.close();}});

test('DOM clears mismatched, failed, stale and new-run measured evidence',async()=>{const f=fixture();try{
  const input=f.doc.querySelector<HTMLInputElement>('#evaluation-measured-fact-form [name="factId"]')!;input.value='fact';f.submit();await vi.waitFor(()=>expect(f.doc.querySelector<HTMLElement>('#evaluation-measured-fact-output')!.hidden).toBe(false));
  f.api.evaluation.mockResolvedValueOnce({available:true,operation:'measured-fact-read',value:{...f.evidence,factId:'other'}} as any);f.submit();await vi.waitFor(()=>expect(f.doc.querySelector('#evaluation-measured-fact-status')!.textContent).toContain('사용할 수 없습니다'));expect(f.doc.querySelector<HTMLElement>('#evaluation-measured-fact-output')!.hidden).toBe(true);
  f.api.evaluation.mockResolvedValueOnce({available:false,reason:'C:/secret'} as any);f.submit();await vi.waitFor(()=>expect(f.doc.querySelector('#evaluation-measured-fact-status')!.textContent).toContain('사용할 수 없습니다'));expect(f.doc.body.textContent).not.toContain('C:/secret');
  let finish!:(value:any)=>void;f.api.evaluation.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));f.submit();f.api.prepare.mockResolvedValueOnce(prepared('run-b'));f.doc.querySelector<HTMLTextAreaElement>('#goal')!.value='new run';f.doc.querySelector('#goal-form')!.dispatchEvent(new f.dom.window.Event('submit',{cancelable:true}));await vi.waitFor(()=>expect(f.doc.querySelector('#evaluation-current')!.textContent).toContain('run-b'));finish({available:true,operation:'measured-fact-read',value:f.evidence});await Promise.resolve();expect(f.doc.querySelector<HTMLElement>('#evaluation-measured-fact-output')!.hidden).toBe(true);expect(f.doc.querySelector('#evaluation-measured-fact-summary')!.textContent).toBe('');
}finally{f.dom.window.close();}});


test('IPC restricts accounting disclosure to valid kind and availability pairs',async()=>{
  const core={projectEvaluationMeasuredFactEvidence:vi.fn()},api=registerIpcHandlers({handle:vi.fn()},core as never);
  for(const accounting of [{availability:'available',kind:'C:/secret/private'},{availability:'available',kind:'unknown'},{availability:'unavailable',kind:'monetary'},{availability:'unavailable',kind:'local-invocation'}]){
    const value=coreEvidence();delete (value as any).extraSecret;Object.assign(value.measurements.accounting,accounting);core.projectEvaluationMeasuredFactEvidence.mockReturnValueOnce(value);
    expect(await api.invoke('cue:evaluation',{operation:'measured-fact-read',factId:'fact'})).toEqual({available:false,reason:'evaluation-unavailable'});
  }
  for(const kind of ['unknown','local-invocation','monetary']){
    const value=coreEvidence();delete (value as any).extraSecret;Object.assign(value.measurements.accounting,{kind,availability:kind==='unknown'?'unavailable':'available'});core.projectEvaluationMeasuredFactEvidence.mockReturnValueOnce(value);
    expect((await api.invoke('cue:evaluation',{operation:'measured-fact-read',factId:'fact'})).value.measurements.accounting).toEqual({kind,availability:kind==='unknown'?'unavailable':'available'});
  }
});

test('IPC preserves all attempts through Core maximum and rejects oversized summaries',async()=>{
  const core={projectEvaluationMeasuredFactEvidence:vi.fn()},api=registerIpcHandlers({handle:vi.fn()},core as never);
  for(const count of [65,1024,1025]){
    const value=coreEvidence();delete (value as any).extraSecret;value.attempts=Array.from({length:count},(_,i)=>({...value.attempts[0]!,attemptId:`attempt-${i}`}));core.projectEvaluationMeasuredFactEvidence.mockReturnValueOnce(value);
    const reply=await api.invoke('cue:evaluation',{operation:'measured-fact-read',factId:'fact'});
    if(count>1024)expect(reply).toEqual({available:false,reason:'evaluation-unavailable'});
    else{expect(reply.available).toBe(true);expect(reply.value.attempts).toHaveLength(count);expect(reply.value.attempts[count-1].attemptId).toBe(`attempt-${count-1}`);}
  }
});

test.each(['visible','pending'])('DOM approval clears %s evidence and prevents reads until a new run',async mode=>{
  const f=fixture();try{
    f.doc.querySelector<HTMLTextAreaElement>('#goal')!.value='prepare';f.doc.querySelector('#goal-form')!.dispatchEvent(new f.dom.window.Event('submit',{cancelable:true}));await vi.waitFor(()=>expect(f.doc.querySelector('#evaluation-current')!.textContent).toContain('run-a'));
    let finish!:(value:any)=>void;if(mode==='pending')f.api.evaluation.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));
    f.doc.querySelector<HTMLInputElement>('#evaluation-measured-fact-form [name="factId"]')!.value='fact';f.submit();
    if(mode==='visible')await vi.waitFor(()=>expect(f.doc.querySelector<HTMLElement>('#evaluation-measured-fact-output')!.hidden).toBe(false));
    f.api.approve.mockImplementationOnce(()=>new Promise(()=>{}));f.doc.querySelector<HTMLButtonElement>('#approve')!.click();expect(f.api.approve).toHaveBeenCalledWith({runId:'run-a'});
    expect(f.doc.querySelector<HTMLElement>('#evaluation-measured-fact-output')!.hidden).toBe(true);expect(f.doc.querySelector<HTMLInputElement>('#evaluation-measured-fact-form [name="factId"]')!.disabled).toBe(true);
    if(mode==='pending'){finish({available:true,operation:'measured-fact-read',value:f.evidence});await Promise.resolve();await Promise.resolve();}
    expect(f.doc.querySelector('#evaluation-measured-fact-summary')!.textContent).toBe('');expect(f.doc.querySelector<HTMLElement>('#evaluation-measured-fact-output')!.hidden).toBe(true);const calls=f.api.evaluation.mock.calls.length;f.submit();expect(f.api.evaluation).toHaveBeenCalledTimes(calls);
  }finally{f.dom.window.close();}
});

test('DOM manually refreshes and advances measured facts, then selection revalidates detail',async()=>{const f=fixture();try{
  const list=(records:any[],nextCursor:number|null)=>({available:true,operation:'measured-fact-list',value:{version:'cue-evaluation-measured-fact-list-v1',authority:'bounded-workspace-descriptive-index',order:'sqlite-insertion-desc',records,nextCursor,complete:nextCursor===null}}),row={factId:'fact',producer:{class:'host-observed',revision:'producer-v1',recordedAtMs:40},trialReady:false,promotionEligible:false};f.api.evaluation.mockResolvedValueOnce(list([],17) as any).mockResolvedValueOnce(list([row],null) as any).mockResolvedValueOnce({available:true,operation:'measured-fact-read',value:f.evidence} as any);
  expect(f.api.evaluation).not.toHaveBeenCalled();f.doc.querySelector<HTMLButtonElement>('#evaluation-measured-fact-list-refresh')!.click();await vi.waitFor(()=>expect(f.doc.querySelector<HTMLButtonElement>('#evaluation-measured-fact-list-next')!.disabled).toBe(false));f.doc.querySelector<HTMLButtonElement>('#evaluation-measured-fact-list-next')!.click();await vi.waitFor(()=>expect(f.doc.querySelector('#evaluation-measured-fact-list-records button')).not.toBeNull());f.doc.querySelector<HTMLButtonElement>('#evaluation-measured-fact-list-records button')!.click();await vi.waitFor(()=>expect(f.doc.querySelector<HTMLElement>('#evaluation-measured-fact-output')!.hidden).toBe(false));expect(f.api.evaluation).toHaveBeenLastCalledWith({operation:'measured-fact-read',factId:'fact'});expect(f.doc.querySelector<HTMLInputElement>('#evaluation-measured-fact-form [name="factId"]')!.value).toBe('fact');
}finally{f.dom.window.close();}});

test('DOM list failure preserves typed ID while stale run and approval clear list and detail',async()=>{const f=fixture();try{
  const input=f.doc.querySelector<HTMLInputElement>('#evaluation-measured-fact-form [name="factId"]')!;input.value='typed-fact';f.api.evaluation.mockResolvedValueOnce({available:false,reason:'secret'} as any);f.doc.querySelector<HTMLButtonElement>('#evaluation-measured-fact-list-refresh')!.click();await vi.waitFor(()=>expect(f.doc.querySelector('#evaluation-measured-fact-list-status')!.textContent).toContain('사용할 수 없습니다'));expect(input.value).toBe('typed-fact');
  let finish!:(value:any)=>void;f.api.evaluation.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));f.doc.querySelector<HTMLButtonElement>('#evaluation-measured-fact-list-refresh')!.click();f.api.prepare.mockResolvedValueOnce(prepared('run-b'));f.doc.querySelector<HTMLTextAreaElement>('#goal')!.value='new run';f.doc.querySelector('#goal-form')!.dispatchEvent(new f.dom.window.Event('submit',{cancelable:true}));await vi.waitFor(()=>expect(f.doc.querySelector('#evaluation-current')!.textContent).toContain('run-b'));finish({available:true,operation:'measured-fact-list',value:{version:'cue-evaluation-measured-fact-list-v1',authority:'bounded-workspace-descriptive-index',order:'sqlite-insertion-desc',records:[{factId:'stale',producer:{class:'host-observed',revision:'v1',recordedAtMs:1},trialReady:false,promotionEligible:false}],nextCursor:null,complete:true}});await Promise.resolve();await Promise.resolve();expect(f.doc.querySelector('#evaluation-measured-fact-list-records')!.children).toHaveLength(0);
  await new Promise(resolve=>f.dom.window.setTimeout(resolve,0));f.api.approve.mockImplementationOnce(()=>new Promise(()=>{}));f.doc.querySelector<HTMLButtonElement>('#approve')!.click();expect(f.doc.querySelector<HTMLButtonElement>('#evaluation-measured-fact-list-refresh')!.disabled).toBe(true);expect(f.doc.querySelector<HTMLElement>('#evaluation-measured-fact-output')!.hidden).toBe(true);
}finally{f.dom.window.close();}});


test('IPC measured list validates bounds and hostile requests before any Core call',()=>{
  const core={listEvaluationMeasuredFacts:vi.fn()},api=registerIpcHandlers({handle:vi.fn()},core as never);let traps=0;
  const valid={operation:'measured-fact-list',limit:20,cursor:null};
  const inputs:any[]=[null,{...valid,extra:true},{operation:'measured-fact-list',limit:20},Object.assign(Object.create({}),valid),Object.defineProperty({...valid},'limit',{enumerable:true,get(){traps++;return 20}}),new Proxy(valid,{get(){traps++;throw Error('touched')}})];
  for(const limit of [0,-1,21,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'20',null])inputs.push({...valid,limit});
  for(const cursor of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'1',undefined])inputs.push({...valid,cursor});
  for(const input of inputs)expect(()=>api.invoke('cue:evaluation',input)).toThrow(/^IPC (evaluation|setup) input denied$/);
  expect(core.listEvaluationMeasuredFacts).not.toHaveBeenCalled();expect(traps).toBe(0);
  core.listEvaluationMeasuredFacts.mockReturnValue({version:'cue-evaluation-measured-fact-list-v1',authority:'bounded-workspace-descriptive-index',order:'sqlite-insertion-desc',records:[],nextCursor:null,complete:true});
  for(const [limit,cursor] of [[1,null],[20,Number.MAX_SAFE_INTEGER]])expect(api.invoke('cue:evaluation',{operation:'measured-fact-list',limit,cursor}).available).toBe(true);
  expect(core.listEvaluationMeasuredFacts.mock.calls).toEqual([[{limit:1,cursor:null}],[{limit:20,cursor:Number.MAX_SAFE_INTEGER}]]);
});


test('DOM latest picker selection wins while an earlier detail response is pending',async()=>{const f=fixture();try{
  const list={version:'cue-evaluation-measured-fact-list-v1',authority:'bounded-workspace-descriptive-index',order:'sqlite-insertion-desc',records:['a','b'].map(factId=>({factId,producer:{class:'host-observed',revision:'v1',recordedAtMs:40},trialReady:false,promotionEligible:false})),nextCursor:null,complete:true};
  f.api.evaluation.mockResolvedValueOnce({available:true,operation:'measured-fact-list',value:list} as any);f.doc.querySelector<HTMLButtonElement>('#evaluation-measured-fact-list-refresh')!.click();await vi.waitFor(()=>expect(f.doc.querySelectorAll('#evaluation-measured-fact-list-records button')).toHaveLength(2));
  let finishA!:(value:any)=>void;f.api.evaluation.mockImplementationOnce(()=>new Promise(resolve=>finishA=resolve));f.doc.querySelectorAll<HTMLButtonElement>('#evaluation-measured-fact-list-records button')[0]!.click();
  f.api.evaluation.mockResolvedValueOnce({available:true,operation:'measured-fact-read',value:safeEvidence('b')} as any);f.doc.querySelectorAll<HTMLButtonElement>('#evaluation-measured-fact-list-records button')[1]!.click();await vi.waitFor(()=>expect(f.doc.querySelector('#evaluation-measured-fact-summary')!.textContent).toContain('저장 사실 b'));
  finishA({available:true,operation:'measured-fact-read',value:safeEvidence('a')});await Promise.resolve();await Promise.resolve();expect(f.doc.querySelector('#evaluation-measured-fact-summary')!.textContent).toContain('저장 사실 b');expect(f.doc.querySelector<HTMLInputElement>('#evaluation-measured-fact-form [name="factId"]')!.value).toBe('b');expect(f.api.evaluation).toHaveBeenCalledWith({operation:'measured-fact-read',factId:'b'});
}finally{f.dom.window.close();}});

test('DOM list failure invalidates an in-flight detail without losing the typed ID',async()=>{const f=fixture();try{
  const input=f.doc.querySelector<HTMLInputElement>('#evaluation-measured-fact-form [name="factId"]')!;input.value='fact';let finish!:(value:any)=>void;f.api.evaluation.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));f.submit();
  f.api.evaluation.mockResolvedValueOnce({available:false,reason:'evaluation-unavailable'} as any);f.doc.querySelector<HTMLButtonElement>('#evaluation-measured-fact-list-refresh')!.click();await vi.waitFor(()=>expect(f.doc.querySelector('#evaluation-measured-fact-list-status')!.textContent).toContain('사용할 수 없습니다'));
  finish({available:true,operation:'measured-fact-read',value:f.evidence});await Promise.resolve();await Promise.resolve();expect(f.doc.querySelector<HTMLElement>('#evaluation-measured-fact-output')!.hidden).toBe(true);expect(f.doc.querySelector('#evaluation-measured-fact-summary')!.textContent).toBe('');expect(input.value).toBe('fact');expect(input.disabled).toBe(false);
}finally{f.dom.window.close();}});
