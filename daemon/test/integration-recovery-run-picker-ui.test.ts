import {test,expect,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
const runs=(records:any[]=[{runId:'old',state:'failed',recordedAttemptCount:2,identityRecordCount:1,missingIdentityAttemptCount:1,missingStageLinkCount:1,recordStatus:'lineage-incomplete'}])=>({available:true,operation:'runs',value:{version:'cue-native-recovery-runs-v1',authority:'observation-only',records,truncated:true,scanTruncated:true}});
function fixture(){
 const dom=new JSDOM(readFileSync('../app/renderer/index.html','utf8'),{runScripts:'outside-only'}),api={nativeRecovery:vi.fn(async(_:any):Promise<any>=>runs())};
 Object.assign(dom.window,{cue:api});dom.window.eval(readFileSync('../app/renderer/renderer.js','utf8'));
 const doc=dom.window.document,b=(id:string)=>doc.querySelector<HTMLButtonElement>('#native-recovery-'+id)!, select=(id:string)=>(dom.window as any).selectNativeRecoveryRun(id);
 return {dom,doc,api,b,select};
}
test('explicit historical target survives current updates and returns without dispatch or automatic observation',async()=>{
 const f=fixture();try{
  expect(f.api.nativeRecovery).not.toHaveBeenCalled();f.select('a');f.b('runs').click();
  await vi.waitFor(()=>expect(f.doc.querySelector('#native-recovery-runs-list button')).not.toBeNull());
  expect(f.b('runs-status').textContent).toContain('1,000');expect(f.b('runs-list').textContent).toContain('연결 기록 불완전');
  (f.doc.querySelector('#native-recovery-runs-list button') as HTMLButtonElement).click();f.select('b');f.select('c');
  expect(f.b('current').textContent).toContain('old');expect(f.api.nativeRecovery).toHaveBeenCalledTimes(1);
  f.api.nativeRecovery.mockResolvedValueOnce({available:true,operation:'list',value:{authority:'observation-only',runId:'old',records:[],truncated:false}});
  f.b('list').click();await vi.waitFor(()=>expect(f.b('list').disabled).toBe(false));expect(f.api.nativeRecovery).toHaveBeenLastCalledWith({operation:'list',runId:'old'});
  f.b('follow').click();expect(f.b('current').textContent).toContain('c');expect(f.b('follow').disabled).toBe(true);
 }finally{f.dom.window.close();}
});
test.each(['resolve','reject'])('late runs %s cannot publish or unlock a new target query',async how=>{
 const f=fixture();try{
  let finish!:(v:any)=>void,fail!:(v:any)=>void;f.select('a');f.api.nativeRecovery.mockImplementationOnce(()=>new Promise((r,j)=>{finish=r;fail=j;}));f.b('runs').click();
  f.select('b');let current!:(v:any)=>void;f.api.nativeRecovery.mockImplementationOnce(()=>new Promise(r=>{current=r;}));f.b('runs').click();
  if(how==='resolve')finish(runs());else fail(Error('SECRET'));await Promise.resolve();await Promise.resolve();
  expect(f.b('runs').disabled).toBe(true);expect(f.b('runs-list').textContent).toBe('');expect(f.b('runs-status').textContent).not.toContain('SECRET');
  current(runs([]));await vi.waitFor(()=>expect(f.b('runs').disabled).toBe(false));expect(f.b('runs-status').textContent).toContain('전체 실행을 확인하지 못했습니다');
 }finally{f.dom.window.close();}
});
test('metadata stays literal and historical switching discards pending identity lookup',async()=>{
 const f=fixture();try{
  f.select('a');let finish!:(v:any)=>void;f.api.nativeRecovery.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));f.b('list').click();
  f.api.nativeRecovery.mockResolvedValueOnce(runs([{...runs().value.records[0],runId:'<img src=x>'}]));f.b('runs').click();
  await vi.waitFor(()=>expect(f.doc.querySelector('#native-recovery-runs-list button')).not.toBeNull());expect(f.doc.querySelector('#native-recovery-runs-list img')).toBeNull();
  (f.doc.querySelector('#native-recovery-runs-list button') as HTMLButtonElement).click();
  finish({available:true,operation:'list',value:{authority:'observation-only',runId:'a',records:[{attemptId:'stale'}]}});await Promise.resolve();await Promise.resolve();
  expect(f.b('records').textContent).toBe('');expect(f.b('current').textContent).toContain('<img');expect(f.b('list').disabled).toBe(false);
 }finally{f.dom.window.close();}
});
