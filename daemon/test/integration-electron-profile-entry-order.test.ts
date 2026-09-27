import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
test.each(['start','qualification-start'])('profile binding is inside protected loader before dynamic definitions: %s',async name=>{
 const events:string[]=[], app={exit:vi.fn(),getPath:(key:string)=>key==='userData'?'owned':'owned/session'}, guard={};
 let source=readFileSync(new URL('../../app/'+name+'.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 source=source.replace(/return import\('\.\/(?:main|qualification-application)\.mjs'\);/,"events.push('import-definitions');return Promise.resolve(loaded);");
 const initialize=async()=>{events.push('initialize');return {exitCode:0};}, loaded={startCueApplication:initialize,runQualificationApplication:initialize};
 runInNewContext(source,{events,loaded,app,dialog:{showErrorBox:vi.fn()},process:{env:{CUE_USER_DATA:'owned'},argv:['electron','entry','--generated-json-qualify'],versions:{electron:'44.2.0',node:'24.20.0',modules:'149'}},
  runGuardedEntry:async(callback:()=>Promise<unknown>)=>{events.push('capture');const loaded=await callback();events.push('postassert');return {guard,loaded};},
  bindElectronProfile:()=>{events.push('bind-profile');return {userData:'owned',sessionData:'owned/session'};},console:{log:vi.fn(),error:vi.fn()}});
 await new Promise(resolve=>setImmediate(resolve));expect(events).toEqual(['capture','bind-profile','import-definitions','postassert','initialize']);
});
