import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url),root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=join(root,'evidence/integrations/S7/20260911-source-structure'),artifact=join(out,'cue-source-structure.html');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(process.argv.includes('--electron-probe')){
 void(async()=>{
  const {app,BrowserWindow,session}=require('electron');app.setPath('userData',process.argv.at(-1));app.disableHardwareAcceleration();
  let win;const timer=setTimeout(()=>app.exit(124),55000);
  try{
   await app.whenReady();const {openReportWindow}=await import('../../app/report-window.mjs');
   const bytes=readFileSync(artifact),artifactSha256=hash(artifact),exactURL='data:text/html;base64,'+bytes.toString('base64'),requests=[];
   class HiddenWindow extends BrowserWindow{show(){}}
   const observedSession={fromPartition(...args){const isolated=session.fromPartition(...args),original=isolated.webRequest.onBeforeRequest.bind(isolated.webRequest);isolated.webRequest.onBeforeRequest=callback=>original((details,done)=>callback(details,decision=>{requests.push({exactBootstrap:details.url===exactURL,type:details.resourceType,cancel:decision.cancel,scheme:details.url.split(':',1)[0]});done(decision);}));return isolated;}};
   win=await openReportWindow({BrowserWindow:HiddenWindow,session:observedSession},{path:artifact,receipt:{artifactBytes:bytes.length,artifactSha256}});
   assert.equal(win.isVisible(),false);assert.equal(win.webContents.getURL(),exactURL);
   const prefs=win.webContents.getLastWebPreferences();assert.equal(prefs.javascript,false);assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.sandbox,true);assert(!prefs.preload);
   win.webContents.debugger.attach('1.3');const evaluate=async expression=>{const response=await win.webContents.debugger.sendCommand('Runtime.evaluate',{expression,returnByValue:true});if(response.exceptionDetails)throw Error('CDP inspection error');return response.result.value;};
   const dom=await evaluate(`({title:document.querySelector('h1').textContent,rows:document.querySelectorAll('tbody tr').length,edges:document.querySelectorAll('li').length,allUnverified:[...document.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('unverified')),allEdgesDeclared:[...document.querySelectorAll('li')].every(r=>r.textContent.includes('source-declared-unverified')),warning:document.body.textContent.includes('소스 선언은 미검증'),hasDigest:/IR digest: [a-f0-9]{64}/.test(document.body.textContent),node:typeof process,cue:typeof window.cue,overflow:document.documentElement.scrollWidth>innerWidth,viewport:innerWidth,documentHeight:document.documentElement.scrollHeight,svg:document.querySelectorAll('svg').length,canvas:document.querySelectorAll('canvas').length})`);
   assert.equal(dom.rows,104);assert.equal(dom.edges,212);assert.equal(dom.allUnverified,true);assert.equal(dom.allEdgesDeclared,true);assert.equal(dom.warning,true);assert.equal(dom.hasDigest,true);assert.equal(dom.node,'undefined');assert.equal(dom.cue,'undefined');assert.equal(dom.overflow,false);
   const capture=async name=>{await win.webContents.capturePage();await new Promise(r=>setTimeout(r,150));const path=join(out,name);writeFileSync(path,(await win.webContents.capturePage()).toPNG());return hash(path);};
   const overview=await capture('electron-source-overview.png');
   await evaluate("[...document.querySelectorAll('h2')].find(x=>x.textContent==='관계').scrollIntoView();true");const relationships=await capture('electron-source-relations.png');
   win.setSize(800,800);await new Promise(r=>setTimeout(r,100));const narrow=await evaluate('({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth})');assert.equal(narrow.overflow,false);
   assert(requests.length>=1);assert(requests.every(r=>r.exactBootstrap&&r.type==='mainFrame'&&!r.cancel));assert.equal(hash(artifact),artifactSha256);
   win.webContents.debugger.detach();writeFileSync(join(out,'electron-result.json'),JSON.stringify({passed:true,kind:'actual-browser-source-inventory',artifactSha256,artifactBytes:bytes.length,dom,narrow,requests,settings:{javascript:prefs.javascript,nodeIntegration:prefs.nodeIntegration,contextIsolation:prefs.contextIsolation,sandbox:prefs.sandbox,preload:!!prefs.preload},screenshots:{overview,relationships},sourceHashes:{'app/report-window.mjs':hash(join(root,'app/report-window.mjs')),'scripts/reuse/source-structure-electron-proof.mjs':hash(fileURLToPath(import.meta.url))},limitations:'Production immutable report-window, real BrowserWindow show() suppressed. CDP is QA-only. 104-row table and 212-item list are source inventory, not an architecture layout. No upstream deliver/semantic/runtime safety proof.'},null,2));
   win.destroy();clearTimeout(timer);app.exit(0);
  }catch(error){writeFileSync(join(out,'electron-failure.json'),JSON.stringify({error:String(error),stack:error.stack},null,2));if(win&&!win.isDestroyed())win.destroy();clearTimeout(timer);app.exit(1);}
 })();
}else{
 mkdirSync(out,{recursive:true});const owned=mkdtempSync(join(tmpdir(),'cue-source-report-proof-')),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const child=spawn(require('electron'),[fileURLToPath(import.meta.url),'--electron-probe',owned],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',b=>{log+=b});child.stderr.on('data',b=>{log+=b});const {stopProcessTree}=await import('../../daemon/scripts/process-lifecycle.mjs');let timeout=false;const timer=setTimeout(()=>{timeout=true;void stopProcessTree(child).catch(e=>{log+=String(e)});},60000);
 try{const code=await new Promise((done,reject)=>{child.once('close',done);child.once('error',reject)});writeFileSync(join(out,'electron-process.json'),JSON.stringify({pid:child.pid,exitCode:code,timeout},null,2));assert.equal(timeout,false);assert.equal(code,0);console.log('PASS isolated source structure browser inventory QA');}
 finally{clearTimeout(timer);await stopProcessTree(child);writeFileSync(join(out,'electron-process.log'),log);const absolute=resolve(owned);assert.equal(dirname(absolute),resolve(tmpdir()));assert(basename(absolute).startsWith('cue-source-report-proof-'));rmSync(absolute,{recursive:true,force:true});}
}
