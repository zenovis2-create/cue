import { expect, test, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerIpcHandlers } from '../../app/ipc.mjs';
const ref = 'cue-native-identity:' + 'a'.repeat(64);
const record = { attemptId:'attempt-1', identityRef:ref, candidateId:'cue.local.model' };
const list = (runId='run-a') => ({ authority:'observation-only',runId,records:[record],truncated:false });
const observation = (runId='run-a') => ({ authority:'observation-only',runId,attemptId:record.attemptId,identityRef:ref,sourceKind:'fixture',observedAt:'2026-09-12T01:00:00.000Z',processes:{launcher:'matching-alive',client:'pid-reused',guardian:'unknown'},paths:{taskRoot:'present',profileRoot:'absent',profilePath:'unknown'},pathProvenance:'unknown' });
test('IPC accepts exact read-only commands only from trusted main frame and never evaluates hostile input', async () => {
  const handlers=new Map<string,Function>(),sender={},core={listNativeIdentities:vi.fn(()=>list()),observeNativeRecovery:vi.fn(()=>observation())};
  const api=registerIpcHandlers({handle:(c,h)=>{handlers.set(c,h);}},core as never,{isTrustedSender:e=>e===sender});
  expect(()=>handlers.get('cue:native-recovery')!({}, {operation:'list',runId:'run-a'})).toThrow('sender denied');
  expect(await handlers.get('cue:native-recovery')!(sender,{operation:'list',runId:'run-a'})).toMatchObject({available:true});
  let touched=0; const accessor=Object.defineProperty({operation:'list'},'runId',{enumerable:true,get(){touched++;return 'run-a';}});
  for(const input of [null,accessor,new Proxy({operation:'list',runId:'run-a'},{}),{operation:'kill',runId:'run-a'},{operation:'list',runId:'run-a',path:'C:\\secret'},{operation:'observe',runId:'run-a',attemptId:'a',identityRef:'C:\\secret'},{operation:'list',runId:'x'.repeat(129)}]) await expect(api.invoke('cue:native-recovery',input)).rejects.toThrow('input denied');
  await expect(api.invoke('cue:native-recovery',{operation:'list',runId:'run-a'},{})).rejects.toThrow('input denied');
  expect(touched).toBe(0); expect(core.listNativeIdentities).toHaveBeenCalledTimes(1); expect(core.observeNativeRecovery).not.toHaveBeenCalled();
});
test('IPC strips private fields and returns generic unavailability for raw errors or mismatched results', async () => {
  const core={listNativeIdentities:vi.fn(()=>({...list(),privatePath:'C:\\SECRET',records:[{...record,pid:999,subjectDigest:'SECRET'}]})),
    observeNativeRecovery:vi.fn(async()=>({...observation(),pid:999,path:'C:\\SECRET',processes:{...observation().processes,raw:'SECRET'}}))};
  const api=registerIpcHandlers({handle:vi.fn()},core as never);
  const listing=await api.invoke('cue:native-recovery',{operation:'list',runId:'run-a'});
  const command={operation:'observe',runId:'run-a',attemptId:record.attemptId,identityRef:ref};
  const observed=await api.invoke('cue:native-recovery',command);
  expect(JSON.stringify([listing,observed])).not.toMatch(/SECRET|999|privatePath|subjectDigest/); expect(Object.isFrozen(observed.value.processes)).toBe(true);
  core.observeNativeRecovery.mockRejectedValueOnce(Error('C:\\SECRET credential failure'));
  expect(await api.invoke('cue:native-recovery',command)).toEqual({available:false,reason:'native-recovery-unavailable'});
  core.observeNativeRecovery.mockResolvedValueOnce(observation('other') as any);
  expect((await api.invoke('cue:native-recovery',command)).available).toBe(false);
  core.observeNativeRecovery.mockResolvedValueOnce({...observation(),processes:{...observation().processes,client:'C:\\SECRET'}} as any);
  expect((await api.invoke('cue:native-recovery',command)).available).toBe(false);
});
function fixture() {
  const dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'});
  let run='run-a';
  const api={prepare:vi.fn(async()=>({taskId:'task-'+run,runId:run,threeLines:['what','extent','excluded'],envelope:{expires_at:'today',worktree_realpath:'fixture',allowed_actions:[]}})),
    nativeRecovery:vi.fn(async(input:any):Promise<any>=>({available:true,operation:input.operation,value:input.operation==='list'?list(input.runId):observation(input.runId)})),
    approve:vi.fn(async()=>({approved:true})),execute:vi.fn(async(input:any):Promise<any>=>input.operation==='status'?new Promise(()=>{}):({taskId:'task-'+input.runId,runId:input.runId,state:'running',status:'running',stage:'work',executionOwnership:{status:'unresolved'}})),stop:vi.fn(async()=>true)};
  Object.assign(dom.window,{cue:api});dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));
  const doc=dom.window.document,button=(id:string)=>doc.querySelector<HTMLButtonElement>('#'+id)!;
  const prepare=async(next='run-a')=>{run=next;doc.querySelector('#goal-form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await vi.waitFor(()=>expect(doc.querySelector('#native-recovery-current')!.textContent).toContain(next));};
  const observeButton=()=>doc.querySelector<HTMLButtonElement>('#native-recovery-records button')!;
  return {dom,doc,api,button,prepare,observeButton};
}
test('DOM only explicitly lists/observes current run and renders states/timestamp with inert text', async () => {
  const f=fixture();try{
    expect(f.api.nativeRecovery).not.toHaveBeenCalled();await f.prepare();expect(f.api.nativeRecovery).not.toHaveBeenCalled();
    f.api.nativeRecovery.mockResolvedValueOnce({available:true,operation:'list',value:{...list(),records:[{...record,candidateId:'<img src=x onerror=alert(1)>'}]}});
    f.button('native-recovery-list').click();await vi.waitFor(()=>expect(f.observeButton()).not.toBeNull());
    expect(f.doc.querySelector('#native-recovery-records img')).toBeNull();expect(f.doc.querySelector('#native-recovery-records')!.textContent).toContain('<img');
    f.observeButton().click();await vi.waitFor(()=>expect(f.doc.querySelector<HTMLElement>('#native-recovery-observation')!.hidden).toBe(false));
    expect(f.doc.querySelector('#native-recovery-states')!.textContent).toContain('PID 재사용');expect(f.doc.querySelector('#native-recovery-states')!.textContent).toContain('확인 불가');
    expect(f.doc.querySelector('#native-recovery-time')!.textContent).toContain('2026-09-12');expect(f.doc.querySelector('#native-recovery-provenance')!.textContent).toContain('관측 전용');
    expect(f.api.nativeRecovery.mock.calls.map(x=>x[0])).toEqual([{operation:'list',runId:'run-a'},{operation:'observe',runId:'run-a',attemptId:record.attemptId,identityRef:ref}]);
    expect(f.api.stop).not.toHaveBeenCalled();expect(f.api.execute).not.toHaveBeenCalled();
  }finally{f.dom.window.close();}
});

test('IPC projects journal state only and rejects getter or malformed finality without leaking private reasons', async () => {
  const host = vi.fn(async () => ({ ...observation(), journal: { state: 'held', revision: 0, reason: 'C:\\SECRET', caseId: 'private-case' } }));
  const api = registerIpcHandlers({ handle() {} }, { observeNativeRecovery: host } as never);
  const command = { operation:'observe', runId:'run-a', attemptId:record.attemptId, identityRef:ref };
  const first = await api.invoke('cue:native-recovery', command);
  expect(first.value.journal).toEqual({ state:'held', revision:0 });
  expect(JSON.stringify(first)).not.toContain('SECRET'); expect(JSON.stringify(first)).not.toContain('private-case');
  const getter = vi.fn(() => 'eligible-for-disposition');
  host.mockResolvedValueOnce({ ...observation(), journal: Object.defineProperty({ revision:1 }, 'state', { enumerable:true, get:getter }) } as never);
  expect((await api.invoke('cue:native-recovery', command)).value.journal).toEqual({ state:'unavailable' });
  expect(getter).not.toHaveBeenCalled();
  host.mockResolvedValueOnce({ ...observation(), journal:{ state:'eligible-for-disposition', revision:0 } } as never);
  expect((await api.invoke('cue:native-recovery', command)).value.journal).toEqual({ state:'unavailable' });
});

test('IPC allowlists finite journal reason codes without evaluating hostile values', async () => {
  const host=vi.fn(),api=registerIpcHandlers({handle(){}},{observeNativeRecovery:host} as never),command={operation:'observe',runId:'run-a',attemptId:record.attemptId,identityRef:ref};
  host.mockResolvedValueOnce({...observation(),journal:{state:'held',revision:0,reasonCode:'cleanup-or-death-unverified',reason:'C:\\SECRET',caseId:'private'}});
  expect((await api.invoke('cue:native-recovery',command)).value.journal).toEqual({state:'held',revision:0,reasonCode:'cleanup-or-death-unverified'});
  host.mockResolvedValueOnce({...observation(),journal:{state:'unavailable',reasonCode:'handoff-integrity-unavailable'}});
  expect((await api.invoke('cue:native-recovery',command)).value.journal).toEqual({state:'unavailable',reasonCode:'handoff-integrity-unavailable'});
  let touched=0;const accessor=Object.defineProperty({state:'held',revision:0},'reasonCode',{enumerable:true,get(){touched++;return 'handoff-unavailable'}});
  for(const journal of [{state:'held',revision:0,reasonCode:'C:\\SECRET'},accessor,{state:'eligible-for-disposition',revision:1,reasonCode:'handoff-unavailable'},new Proxy({state:'held',revision:0,reasonCode:'handoff-unavailable'},{get(){touched++;return 'secret'}})]){
    host.mockResolvedValueOnce({...observation(),journal});const projected=(await api.invoke('cue:native-recovery',command)).value.journal;
    expect(JSON.stringify(projected)).not.toMatch(/SECRET|handoff-unavailable/);
  }
  expect(touched).toBe(0);
});

test.each([
  { state:'held', label:'보류' }, { state:'eligible-for-disposition', label:'별도 처분 필요' },
  { state:'reconciled-stop', label:'중단 상태로 정리됨' }, { state:'<img src=x>', label:'확인 불가' },
])('journal $state is status only and clears when selecting another run', async ({ state, label }) => {
  const f=fixture(); try {
    await f.prepare(); f.button('native-recovery-list').click();
    await vi.waitFor(() => expect(f.observeButton()).not.toBeNull());
    f.api.nativeRecovery.mockResolvedValueOnce({ available:true, operation:'observe', value:{ ...observation(), journal:{ state, revision:0, reason:'C:\\SECRET' } } });
    f.observeButton().click();
    await vi.waitFor(() => expect(f.doc.querySelector('#native-recovery-journal')!.textContent).toContain(label));
    expect(f.doc.querySelector('#native-recovery-journal')!.textContent).not.toContain('SECRET');
    expect(f.doc.querySelector('#native-recovery-journal img')).toBeNull();
    expect(f.api.execute).not.toHaveBeenCalled(); expect(f.api.stop).not.toHaveBeenCalled();
    await f.prepare('run-b');
    expect(f.doc.querySelector('#native-recovery-journal')!.textContent).toBe('');
  } finally { f.dom.window.close(); }
});
test('journal reason text is finite, inert, and shown only for held or unavailable',async()=>{const f=fixture();try{
  await f.prepare();f.button('native-recovery-list').click();await vi.waitFor(()=>expect(f.observeButton()).not.toBeNull());
  f.api.nativeRecovery.mockResolvedValueOnce({available:true,operation:'observe',value:{...observation(),journal:{state:'held',revision:0,reasonCode:'cleanup-or-death-unverified'}}});f.observeButton().click();
  await vi.waitFor(()=>expect(f.doc.querySelector('#native-recovery-journal')!.textContent).toContain('정리 또는 종료 확인 불가'));
  let touched=0;const hostile=Object.defineProperty({state:'unavailable'},'reasonCode',{enumerable:true,get(){touched++;return '<img src=x>'}});
  f.api.nativeRecovery.mockResolvedValueOnce({available:true,operation:'observe',value:{...observation(),journal:hostile}});f.observeButton().click();
  await vi.waitFor(()=>expect(f.doc.querySelector('#native-recovery-journal')!.textContent).toContain('확인 불가'));
  expect(touched).toBe(0);expect(f.doc.querySelector('#native-recovery-journal img')).toBeNull();
  f.api.nativeRecovery.mockResolvedValueOnce({available:true,operation:'observe',value:{...observation(),journal:{state:'reconciled-stop',revision:1,reasonCode:'cleanup-or-death-unverified'}}});f.observeButton().click();
  await vi.waitFor(()=>expect(f.doc.querySelector('#native-recovery-journal')!.textContent).toContain('중단 상태로 정리됨'));expect(f.doc.querySelector('#native-recovery-journal')!.textContent).not.toContain('정리 또는 종료 확인 불가');
}finally{f.dom.window.close();}});
test.each(['list','observe'])('late %s from A cannot overwrite B or disable its active Stop',async operation=>{
  const f=fixture();try{
    await f.prepare(); if(operation==='observe'){f.button('native-recovery-list').click();await vi.waitFor(()=>expect(f.observeButton()).not.toBeNull());}
    let finish!:(v:any)=>void;f.api.nativeRecovery.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    if(operation==='list') f.button('native-recovery-list').click();else f.observeButton().click();
    await f.prepare('run-b');f.button('approve').click();await vi.waitFor(()=>expect(f.button('stop').hidden).toBe(false));
    const title=f.doc.querySelector('#state-title')!.textContent;
    finish({available:true,operation,value:operation==='list'?list('run-a'):observation('run-a')});await Promise.resolve();await Promise.resolve();
    expect(f.doc.querySelector('#native-recovery-current')!.textContent).toContain('run-b');expect(f.doc.querySelector('#native-recovery-records')!.textContent).toBe('');
    expect(f.doc.querySelector<HTMLElement>('#native-recovery-observation')!.hidden).toBe(true);expect(f.doc.querySelector('#state-title')!.textContent).toBe(title);
    expect(f.button('stop').disabled).toBe(false);f.button('stop').click();await vi.waitFor(()=>expect(f.api.stop).toHaveBeenCalledWith({runId:'run-b'}));
  }finally{f.dom.window.close();}
});
test('busy query is independent of execution; generic errors/empty or unavailable service are explicit',async()=>{
  const f=fixture();try{
    await f.prepare();f.button('approve').click();await vi.waitFor(()=>expect(f.button('stop').hidden).toBe(false));
    let finish!:(v:any)=>void;f.api.nativeRecovery.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));f.button('native-recovery-list').click();
    expect(f.button('native-recovery-list').disabled).toBe(true);expect(f.button('stop').disabled).toBe(false);
    finish({available:false,reason:'C:\\SECRET'});await vi.waitFor(()=>expect(f.button('native-recovery-list').disabled).toBe(false));
    expect(f.doc.querySelector('#native-recovery-status')!.textContent).not.toContain('SECRET');expect(f.button('stop').disabled).toBe(false);
    f.api.nativeRecovery.mockResolvedValueOnce({available:true,operation:'list',value:{...list(),records:[]}});f.button('native-recovery-list').click();await vi.waitFor(()=>expect(f.doc.querySelector('#native-recovery-status')!.textContent).toContain('신원이 없습니다'));
  }finally{f.dom.window.close();}
  const dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'});Object.assign(dom.window,{cue:{}});
  try{dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));expect(dom.window.document.querySelector('#native-recovery-status')!.textContent).toContain('사용할 수 없습니다');}finally{dom.window.close();}
});
