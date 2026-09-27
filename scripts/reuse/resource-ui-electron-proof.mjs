import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url),root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=join(root,'evidence/integrations/S6/20260911-resource-ui');
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=p=>sha(readFileSync(p));
const save=(name,value)=>writeFileSync(join(output,name),JSON.stringify(value,null,2));
if(process.argv.includes('--electron-probe')){
 void(async()=>{
  const {app,BrowserWindow,ipcMain}=require('electron'),owned=process.argv.at(-1);
  app.setPath('userData',join(owned,'electron'));app.disableHardwareAcceleration();
  let main,untrusted,core,phase='initialize',releaseSearch,delayed=false,selected=null;const calls=[],requests=[];
  const timer=setTimeout(()=>app.exit(124),55000);
  try{
   await app.whenReady();const {createCueCore,initializeConfig}=await import('../../app/core.mjs');const {registerIpcHandlers}=await import('../../app/ipc.mjs');const {applyNavigationGuards}=await import('../../app/electron-security.mjs');
   const workspace=join(owned,'workspace'),pack=join(owned,'pack');mkdirSync(workspace);mkdirSync(pack);
   core=createCueCore(initializeConfig(join(owned,'data'),{worktreeRoot:workspace}));
   const text='claimTask 한글 😀 <script>globalThis.resourceInjected=true</script> 읽기 전용 참고자료';
   function version(v,content){writeFileSync(join(pack,'guide.txt'),content);const manifest=JSON.stringify({schemaVersion:1,id:'fixture',version:v,source:'https://example.invalid/reference',revision:'a'.repeat(40),resources:[{id:'guide',kind:'knowledge',path:'guide.txt',sha256:sha(content),byteLength:Buffer.byteLength(content)}]});writeFileSync(join(pack,'manifest.json'),manifest);return{root:pack,manifestSha256:sha(manifest)};}
   const original=version('1.0.0',text);
   main=new BrowserWindow({width:1180,height:960,show:false,webPreferences:{preload:join(root,'app/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
   applyNavigationGuards(main.webContents,pathToFileURL(join(root,'app/renderer/index.html')).href);
   main.webContents.session.webRequest.onBeforeRequest((details,done)=>{requests.push({scheme:details.url.split(':',1)[0],type:details.resourceType});done({cancel:!details.url.startsWith('file:')});});
   // Hold only the real core search result at the IPC delivery seam for a stale-reply scenario.
   const wrapped=new Proxy({...core},{get(target,key){if(key==='searchResources')return input=>{const result=target.searchResources(input);calls.push({operation:'search',runId:input.runId});if(delayed){delayed=false;return new Promise(done=>{releaseSearch=()=>done(result);});}return result;};if(key==='prepareGoal')return(...args)=>{const result=target.prepareGoal(...args);calls.push({operation:'prepare',runId:result.runId});return result;};return Reflect.get(target,key);}});
   registerIpcHandlers(ipcMain,wrapped,{isTrustedSender:e=>e.sender===main.webContents&&e.senderFrame===main.webContents.mainFrame,chooseResourcePackage:async()=>{calls.push({operation:'host-choice',cancelled:selected===null});return selected;}});
   await main.loadFile(join(root,'app/renderer/index.html'));const call=code=>main.webContents.executeJavaScript(code);
   const wait=async code=>{const deadline=Date.now()+7000;while(!(await call(code))){if(Date.now()>deadline)throw Error('wait timeout: '+code);await new Promise(r=>setTimeout(r,25));}};
   const click=selector=>call(`document.querySelector(${JSON.stringify(selector)}).click();true`);
   const prepare=async goal=>{const count=calls.filter(x=>x.operation==='prepare').length;await call(`document.querySelector('#goal').value=${JSON.stringify(goal)};document.querySelector('#goal-form').requestSubmit();true`);const deadline=Date.now()+7000;while(calls.filter(x=>x.operation==='prepare').length===count){if(Date.now()>deadline)throw Error('prepare timeout');await new Promise(r=>setTimeout(r,25));}await wait("!document.querySelector('#approve').disabled");return calls.filter(x=>x.operation==='prepare').at(-1).runId;};
   const search=async()=>{await call("document.querySelector('#resource-query').value='claim task';document.querySelector('#resource-search-form').requestSubmit();true");};
   await wait("!document.querySelector('#resource-import').disabled");await call("document.querySelector('#resource-manager').open=true;true");
   phase='cancel';await click('#resource-import');await wait("document.querySelector('#resource-status').textContent.includes('취소')");assert.equal(core.listResourcePackages().length,0);
   phase='import';selected=original;await click('#resource-import');await wait("document.querySelector('#resource-packages').children.length===1");assert.equal(core.listResourcePackages()[0].version,'1.0.0');
   phase='prepare-search';const first=await prepare('실제 리소스 UI 참고자료 확인 — 실행하지 않음');await wait("!document.querySelector('#resource-search').disabled");await search();await wait("document.querySelector('#resource-results').children.length>0");
   const firstView=await call("({excerpt:document.querySelector('.resource-excerpt').textContent,reference:document.querySelector('#resource-results').textContent,unsafe:document.querySelectorAll('#resource-results script,#resource-results img,#resource-results a').length,injected:typeof resourceInjected,node:typeof process,pin:document.querySelector('#resource-pin').textContent,goal:document.querySelector('#goal').value,approval:!document.querySelector('#approve').disabled,reportExists:!!document.querySelector('#report')})");
   assert.equal(firstView.excerpt,text);assert.equal(firstView.unsafe,0);assert.equal(firstView.injected,'undefined');assert.equal(firstView.node,'undefined');assert.match(firstView.reference,/원격 출처 진위 미검증/);assert.match(firstView.reference,/권한 없음/);assert.equal(firstView.approval,true);assert.equal(firstView.reportExists,true);assert(!firstView.goal.includes('<script>'));
   phase='screenshots';await call("document.querySelector('#resource-manager').scrollIntoView();true");const capture=async name=>{await main.webContents.capturePage();await new Promise(r=>setTimeout(r,200));const p=join(output,name);writeFileSync(p,(await main.webContents.capturePage()).toPNG());return hash(p);};
   const layout=()=>call("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth,resourceWidth:document.querySelector('#resource-manager').getBoundingClientRect().width})");
   const defaultLayout=await layout(),defaultPng=await capture(process.argv.includes('--capture-only')?'resource-default-painted.png':'resource-default.png');main.setSize(980,960);await new Promise(r=>setTimeout(r,150));const narrowLayout=await layout(),narrowPng=await capture(process.argv.includes('--capture-only')?'resource-narrow-painted.png':'resource-narrow.png');
   if(process.argv.includes('--capture-only')){
    await call("document.querySelector('#resource-results').scrollIntoView();true");const citationPng=await capture('resource-citation-painted.png');
    const citation=await call("({text:document.querySelector('#resource-results').textContent,overflow:document.documentElement.scrollWidth>innerWidth})");assert.equal(citation.overflow,false);assert.equal(defaultLayout.overflow,false);assert.equal(narrowLayout.overflow,false);
    save('electron-capture-result.json',{passed:true,defaultLayout,narrowLayout,firstView,citation,screenshots:{defaultPng,narrowPng,citationPng},modelCalls:0,sessions:core.daemon.db.prepare('SELECT COUNT(*) AS n FROM session_handle').get().n,sourceHashes:Object.fromEntries(['app/main.mjs','app/ipc.mjs','app/preload.cjs','app/core.mjs','app/renderer/index.html','app/renderer/renderer.js','app/renderer/styles.css','scripts/reuse/resource-ui-electron-proof.mjs'].map(p=>[p,hash(join(root,p))])),scope:'Capture-only correction: fresh import/prepare/search fixture, compositor warm capture then final. Later mutation/stale/sender scenarios not repeated.'});
    main.destroy();main=null;await core.close();core=null;clearTimeout(timer);app.exit(0);return;
   }
   main.setSize(480,960);await new Promise(r=>setTimeout(r,150));const belowMinimum=await layout();main.setSize(1180,960);
   phase='version-removal';selected=version('2.0.0','claimTask NEW VERSION');await click('#resource-import');await wait("document.querySelector('#resource-packages').textContent.includes('2.0.0')");await search();await wait("!document.querySelector('#resource-search').disabled");assert.equal(await call("document.querySelector('.resource-excerpt').textContent"),text);
   await click('#resource-packages button');await wait("document.querySelector('#resource-packages').children.length===0");await search();await wait("!document.querySelector('#resource-search').disabled");assert.equal(await call("document.querySelector('.resource-excerpt').textContent"),text);assert(existsSync(join(pack,'guide.txt')));assert.equal(readFileSync(join(pack,'guide.txt'),'utf8'),'claimTask NEW VERSION');
   phase='stale';delayed=true;await search();const deadline=Date.now()+7000;while(!releaseSearch){if(Date.now()>deadline)throw Error('missing held search');await new Promise(r=>setTimeout(r,25));}const second=await prepare('제거 후 새 범위 — 고정 자료 없음');await wait("document.querySelector('#resource-pin').textContent.includes('고정된 패키지가 없습니다')");releaseSearch();await new Promise(r=>setTimeout(r,100));const stale=await call("({resultCount:document.querySelector('#resource-results').children.length,disabled:document.querySelector('#resource-search').disabled,pin:document.querySelector('#resource-pin').textContent})");assert.equal(stale.resultCount,0);assert.equal(stale.disabled,true);assert(stale.pin.includes(second));
   phase='untrusted';untrusted=new BrowserWindow({show:false,webPreferences:{preload:join(root,'app/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});await untrusted.loadFile(join(root,'app/renderer/index.html'));const untrustedDenied=await untrusted.webContents.executeJavaScript("window.cue.resources({operation:'list'}).then(()=>false,e=>String(e).includes('sender denied'))");assert.equal(untrustedDenied,true);
   const overrideDenied=await call("window.cue.resources({operation:'import',root:'C:/arbitrary'}).then(()=>false,e=>String(e).includes('denied'))");assert.equal(overrideDenied,true);
   assert(requests.every(r=>r.scheme==='file'));assert.equal(core.daemon.db.prepare('SELECT COUNT(*) AS n FROM session_handle').get().n,0);
   const prefs=main.webContents.getLastWebPreferences();assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.sandbox,true);assert.equal(main.isVisible(),false);
   save('electron-result.json',{passed:true,kind:'actual-preload-ipc-core-sqlite-with-host-folder-choice-fixture',first,second,firstView,stale,defaultLayout,narrowLayout,belowMinimum,untrustedDenied,overrideDenied,calls,requests,screenshots:{defaultPng,narrowPng},modelCalls:0,sessions:0,sourceHashes:Object.fromEntries(['app/main.mjs','app/ipc.mjs','app/preload.cjs','app/core.mjs','app/renderer/index.html','app/renderer/renderer.js','app/renderer/styles.css','scripts/reuse/resource-ui-electron-proof.mjs'].map(p=>[p,hash(join(root,p))])),limitations:'Actual shipped renderer/preload/IPC/core/store/search; controlled folder choice and held real search response. Native OS folder dialog and normal main boot not exercised. No approval execution/model request; report presence only, detailed report regression separate. Existing 900px desktop minimum observed at480.'});
   untrusted.destroy();untrusted=null;main.destroy();main=null;await core.close();core=null;clearTimeout(timer);app.exit(0);
  }catch(error){save('electron-failure.json',{phase,error:String(error),stack:error.stack});releaseSearch?.();for(const w of [untrusted,main])if(w&&!w.isDestroyed())w.destroy();await core?.close();clearTimeout(timer);app.exit(1);}
 })();
}else{
 mkdirSync(output,{recursive:true});const owned=mkdtempSync(join(tmpdir(),'cue-resource-proof-')),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(require('electron'),[fileURLToPath(import.meta.url),'--electron-probe',...(process.argv.includes('--capture-only')?['--capture-only']:[]),owned],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';const append=b=>{log=(log+b).slice(-1048576);};child.stdout.on('data',append);child.stderr.on('data',append);const {stopProcessTree}=await import('../../daemon/scripts/process-lifecycle.mjs');let timeout=false;const timer=setTimeout(()=>{timeout=true;void stopProcessTree(child).catch(append);},60000);
 try{const code=await new Promise((done,reject)=>{child.once('close',done);child.once('error',reject);});save('electron-process.json',{pid:child.pid,exitCode:code,timeout});assert.equal(timeout,false);assert.equal(code,0);console.log('PASS actual resource UI preload/IPC/core, snapshots, stale replies and isolated sender');}
 finally{clearTimeout(timer);await stopProcessTree(child);writeFileSync(join(output,'electron-process.log'),log);const absolute=resolve(owned);assert.equal(dirname(absolute),resolve(tmpdir()));assert(basename(absolute).startsWith('cue-resource-proof-'));rmSync(absolute,{recursive:true,force:true});}
}
