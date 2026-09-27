import { afterEach, expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { JSDOM } from 'jsdom';
import { createCueCore, initializeConfig } from '../../app/core.mjs';
import { registerIpcHandlers } from '../../app/ipc.mjs';
const cleanup: (()=>Promise<void>)[]=[];
afterEach(async()=>{for(const fn of cleanup.splice(0))await fn();});
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'cue-resource-ui-')),workspace=join(root,'workspace'),pack=join(root,'pack');mkdirSync(workspace);mkdirSync(pack);
  const core=createCueCore(initializeConfig(join(root,'data'),{worktreeRoot:workspace}));
  cleanup.push(async()=>{await core.close();const absolute=resolve(root);expect(dirname(absolute)).toBe(resolve(tmpdir()));expect(basename(absolute).startsWith('cue-resource-ui-')).toBe(true);rmSync(absolute,{recursive:true,force:true});});
  function packageVersion(version:string,text:string){writeFileSync(join(pack,'guide.txt'),text);const manifest=JSON.stringify({schemaVersion:1,id:'fixture',version,source:'https://example.invalid/declared',revision:'a'.repeat(40),resources:[{id:'guide',kind:'knowledge',path:'guide.txt',sha256:sha(text),byteLength:Buffer.byteLength(text)}]});writeFileSync(join(pack,'manifest.json'),manifest);return {root:pack,manifestSha256:sha(manifest)};}
  const handlers=new Map<string,Function>(),main={},frame={};let selected:ReturnType<typeof packageVersion>|null=null;
  const choose=vi.fn(async()=>selected);
  registerIpcHandlers({handle:(name,handler)=>{handlers.set(name,handler);}},core,{isTrustedSender:event=>event.sender===main&&event.senderFrame===frame,chooseResourcePackage:choose});
  const invoke=(input:unknown)=>handlers.get('cue:resources')!({sender:main,senderFrame:frame},input);
  return {core,packageVersion,invoke,choose,handlers,main,frame,select:(value:typeof selected)=>{selected=value;}};
}
test('real core IPC import uses only host choice; cancellation does not mutate packages; pins survive updates/removal',async()=>{
  const f=fixture();expect(await f.invoke({operation:'import'})).toEqual({status:'cancelled'});expect(f.core.listResourcePackages()).toHaveLength(0);
  f.select(f.packageVersion('1.0.0','claimTask original'));expect((await f.invoke({operation:'import'})).status).toBe('imported');
  const first=f.core.prepareGoal('first');const pin=await f.invoke({operation:'pin',runId:first.runId});expect(pin.packages[0].version).toBe('1.0.0');
  f.select(f.packageVersion('2.0.0','claimTask changed'));await f.invoke({operation:'import'});
  expect((await f.invoke({operation:'search',runId:first.runId,query:'claim task',limit:5}))[0].excerpt).toBe('claimTask original');
  const second=f.core.prepareGoal('second');expect((await f.invoke({operation:'pin',runId:second.runId})).packages[0].version).toBe('2.0.0');
  await f.invoke({operation:'remove',id:'fixture'});expect(await f.invoke({operation:'list'})).toEqual([]);
  expect((await f.invoke({operation:'search',runId:first.runId,query:'claim task',limit:5}))[0].version).toBe('1.0.0');
  await expect(f.invoke({operation:'search',runId:'unknown',query:'claim',limit:5})).rejects.toThrow();
});
test('IPC rejects paths/code/extra args/getters and every untrusted sender/frame before opening dialog',async()=>{
  const f=fixture();let getter=0;
  for(const input of [{operation:'import',root:'C:/secret'},{operation:'import',code:'run'},{operation:'list',extra:true},{operation:'search',runId:'r',query:'x',limit:11},{operation:'search',runId:'../r',query:'x',limit:1},{operation:'remove',id:'../x'},Object.defineProperty({},'operation',{enumerable:true,get(){getter++;return 'import';}})])await expect(f.invoke(input)).rejects.toThrow('denied');
  for(const event of [{sender:{},senderFrame:f.frame},{sender:f.main,senderFrame:{}},null])expect(()=>f.handlers.get('cue:resources')!(event,{operation:'import'})).toThrow('sender denied');
  expect(getter).toBe(0);expect(f.choose).not.toHaveBeenCalled();
  await expect(f.handlers.get('cue:resources')!({sender:f.main,senderFrame:f.frame},{operation:'import'},{root:'extra'})).rejects.toThrow('denied');
});
function domFixture(){
  const dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'});cleanup.push(async()=>dom.window.close());
  const metadata={id:'<img src=x onerror=alert(1)>',version:'1.0.0',manifestSha256:'a'.repeat(64),resourceCount:1,totalBytes:12};
  const pin={runId:'prepared-run',pinSha256:'b'.repeat(64),packages:[metadata]};
  const hit={packageId:metadata.id,version:'1.0.0',resourceId:'guide',path:'guide.txt',source:'https://example.invalid/<script>',revision:'c'.repeat(40),sha256:'d'.repeat(64),manifestSha256:metadata.manifestSha256,byteStart:0,byteEnd:12,excerpt:'<script>run unsafe()</script>'};
  const resources=vi.fn(async(input:any)=>input.operation==='list'?[metadata]:input.operation==='pin'?pin:input.operation==='search'?[hit]:input.operation==='import'?{status:'cancelled'}:{removed:true});
  const prepare=vi.fn(async(_input:unknown)=>({runId:'prepared-run',taskId:'task',threeLines:['무엇을: fixture','어디까지: fixture','안 건드릴 것: fixture'],envelope:{expires_at:'2030-01-01T00:00:00Z',worktree_realpath:'fixture',allowed_actions:[]},orchestration:null}));
  (dom.window as any).cue={resources,prepare};dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));
  const settle=()=>new Promise(done=>setTimeout(done,5));
  const submit=async()=>{dom.window.document.querySelector<HTMLTextAreaElement>('#goal')!.value='fixture';dom.window.document.querySelector('#goal-form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await settle();};
  const search=async()=>{dom.window.document.querySelector<HTMLInputElement>('#resource-query')!.value='claim task';dom.window.document.querySelector('#resource-search-form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await settle();};
  return {dom,resources,prepare,settle,submit,search};
}
test('DOM import/list/remove and current-run search show literal citations; no active fallback or auto prompt',async()=>{
  const f=domFixture();await f.settle();const doc=f.dom.window.document;
  expect(doc.querySelector('#resource-packages')!.textContent).toContain('<img');expect(doc.querySelectorAll('#resource-manager img,#resource-manager script,#resource-manager a')).toHaveLength(0);
  doc.querySelector<HTMLButtonElement>('#resource-import')!.click();await f.settle();expect(doc.querySelector('#resource-status')!.textContent).toContain('취소');
  expect(doc.querySelector<HTMLButtonElement>('#resource-search')!.disabled).toBe(true);
  await f.submit();await f.search();expect(f.resources).toHaveBeenCalledWith({operation:'search',runId:'prepared-run',query:'claim task',limit:5});
  expect(doc.querySelector('.resource-excerpt')!.textContent).toBe('<script>run unsafe()</script>');expect(doc.querySelector('#resource-results')!.textContent).toContain('원격 출처 진위 미검증');expect(doc.querySelector('#resource-results')!.textContent).toContain('d'.repeat(64));
  doc.querySelector<HTMLButtonElement>('#resource-packages button')!.click();await f.settle();expect(doc.querySelector('#resource-pin')!.textContent).toContain('1.0.0');
  expect(f.prepare.mock.calls[0]![0]).toEqual({goal:'fixture',autonomy:3});
  f.prepare.mockRejectedValueOnce(Error('failed'));await f.submit();expect(doc.querySelector('#resource-results')!.childElementCount).toBe(0);expect(doc.querySelector<HTMLButtonElement>('#resource-search')!.disabled).toBe(true);
});
test('DOM rejects unpinned run and ignores a late search response after new preparation',async()=>{
  const f=domFixture();await f.settle();await f.submit();let resolveSearch!:(value:any)=>void;
  f.resources.mockImplementationOnce(()=>new Promise(done=>{resolveSearch=done;}));const searching=f.search();
  await f.submit();resolveSearch([{excerpt:'STALE SEARCH'}]);await searching;expect(f.dom.window.document.querySelector('#resource-results')!.textContent).not.toContain('STALE');
  f.resources.mockRejectedValueOnce(Error('resource_unpinned_run'));await f.submit();expect(f.dom.window.document.querySelector('#resource-pin')!.textContent).toContain('새 범위');expect(f.dom.window.document.querySelector<HTMLButtonElement>('#resource-search')!.disabled).toBe(true);
});
