import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url), root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=join(root,'evidence/integrations/S7/20260911-report-delivery');
const artifact=join(output,'cue-report-foundation.html'),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(process.argv.includes('--electron-probe')){
 void(async()=>{
  const {app,BrowserWindow}=require('electron');app.setPath('userData',process.argv.at(-1));app.disableHardwareAcceleration();
  let window;const timer=setTimeout(()=>app.exit(124),55000);
  try{
   await app.whenReady();const artifactHash=hash(artifact),requests=[],unexpected=[];
   window=new BrowserWindow({width:1400,height:1200,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
   const main=pathToFileURL(artifact).href;
   window.webContents.session.webRequest.onBeforeRequest({urls:['<all_urls>']},(details,done)=>{requests.push({url:details.url,type:details.resourceType});const allowed=details.url===main&&details.resourceType==='mainFrame';if(!allowed)unexpected.push(details.url);done({cancel:!allowed});});
   window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   window.webContents.on('will-navigate',(event,url)=>{if(url!==main)event.preventDefault();});
   await window.loadFile(artifact);const call=code=>window.webContents.executeJavaScript(code);
   const dom=await call(`(()=>{document.querySelector('details').open=true;const body=document.body.textContent;return {title:document.querySelector('h1').textContent,body,rows:[...document.querySelectorAll('tbody tr')].map(r=>r.textContent),csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,overflow:document.documentElement.scrollWidth>innerWidth,font:getComputedStyle(document.body).fontFamily,nodeUnavailable:typeof require==='undefined'&&typeof process==='undefined',cueUnavailable:typeof window.cue==='undefined',preVisible:document.querySelector('pre').getBoundingClientRect().height>0};})()`);
   assert.match(dom.body,/관측 상태와 계획된 관계를 구분/);assert.match(dom.body,/소스 선언은 미검증/);assert.match(dom.body,/현재 파일 검증이 아닙니다/);assert.match(dom.body,/IR digest: [a-f0-9]{64}/);
   assert.equal(dom.rows.length,3);assert(dom.rows.every(r=>r.includes('unverified')&&r.includes('source-declared-unverified')));
   assert.equal(dom.overflow,false);assert.equal(dom.nodeUnavailable,true);assert.equal(dom.cueUnavailable,true);assert.equal(dom.preVisible,true);assert.match(dom.font,/system-ui/);assert.equal(window.isVisible(),false);
   // executeJavaScript is harness access. The inserted DOM script must still be
   // rejected by the production artifact's actual CSP; original bytes stay intact.
   const csp=await call(`(async()=>{globalThis.proofViolations=[];document.addEventListener('securitypolicyviolation',e=>proofViolations.push({directive:e.effectiveDirective,blockedURI:e.blockedURI}));const script=document.createElement('script');script.textContent='globalThis.reportInjectedScriptRan=true';document.body.append(script);await new Promise(r=>setTimeout(r,100));script.remove();return{ran:globalThis.reportInjectedScriptRan===true,violations:proofViolations};})()`);
   assert.equal(csp.ran,false);assert(csp.violations.some(v=>v.directive.startsWith('script-src')&&v.blockedURI==='inline'));
   window.setSize(800,1200);await new Promise(r=>setTimeout(r,80));
   const narrow=await call('({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth})');assert.equal(narrow.overflow,false);
   window.setSize(1400,1200);await window.webContents.capturePage();await new Promise(r=>setTimeout(r,180));
   const png=join(output,'electron-report.png');writeFileSync(png,(await window.webContents.capturePage()).toPNG());
   assert.deepEqual(unexpected,[]);assert.equal(hash(artifact),artifactHash);
   delete dom.body;
   writeFileSync(join(output,'electron-result.json'),JSON.stringify({passed:true,kind:'browser-qa',artifact:'cue-report-foundation.html',artifactSha256:artifactHash,proofSha256:hash(fileURLToPath(import.meta.url)),electron:process.versions.electron,hidden:true,dom,narrow,csp,requests,unexpectedRequests:unexpected,pngSha256:hash(png),limits:'Actual isolated Electron display of existing source-declared-unverified report. No preload/privileged IPC, no upstream deliver claim or general report semantic proof; injected DOM script tests CSP without rewriting original HTML.'},null,2));
   clearTimeout(timer);window.destroy();app.exit(0);
  }catch(error){writeFileSync(join(output,'electron-failure.json'),JSON.stringify({error:String(error),stack:error.stack},null,2));clearTimeout(timer);window?.destroy();app.exit(1);}
 })();
}else{
 mkdirSync(output,{recursive:true});const temp=mkdtempSync(join(tmpdir(),'cue-report-electron-')),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(require('electron'),[fileURLToPath(import.meta.url),'--electron-probe',temp],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',b=>{log+=b});child.stderr.on('data',b=>{log+=b});const {stopProcessTree}=await import('../../daemon/scripts/process-lifecycle.mjs');let timeout=false;
 const timer=setTimeout(()=>{timeout=true;void stopProcessTree(child).catch(e=>{log+=String(e)});},60000);
 try{const code=await new Promise((done,reject)=>{child.once('close',done);child.once('error',reject)});writeFileSync(join(output,'electron-process.json'),JSON.stringify({pid:child.pid,exitCode:code,timeout,command:'node scripts/reuse/report-electron-proof.mjs'},null,2));assert.equal(timeout,false);assert.equal(code,0);console.log('PASS actual hidden Electron report browser QA and CSP');}
 finally{clearTimeout(timer);await stopProcessTree(child);writeFileSync(join(output,'electron-process.log'),log);}
}
