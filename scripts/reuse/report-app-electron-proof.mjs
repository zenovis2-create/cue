import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url),root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=join(root,'evidence/integrations/S7/20260911-report-app');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(process.argv.includes('--electron-probe')){
 void(async()=>{
  const {app,BrowserWindow,session,ipcMain}=require('electron');const owned=process.argv.at(-1);app.setPath('userData',join(owned,'electron'));app.disableHardwareAcceleration();
  let main,report,untrusted,core,phase='initialize';const messages=[];const timer=setTimeout(()=>app.exit(124),55000);
  try{
   await app.whenReady();const {createCueCore,initializeConfig}=await import('../../app/core.mjs');const {registerIpcHandlers}=await import('../../app/ipc.mjs');const {openReportWindow}=await import('../../app/report-window.mjs');
   const workspace=join(owned,'workspace');mkdirSync(workspace);core=createCueCore(initializeConfig(join(owned,'data'),{worktreeRoot:workspace}));
   const prepared=core.prepareGoal('실제 앱 보고서 경로 fixture');core.approve(prepared.runId);const db=core.daemon.db;
   const envelope=db.prepare('SELECT envelope_hash FROM run WHERE id=?').get(prepared.runId);
   const plan={revision:'v1',tasks:[{id:'maker',role:'model-producer',dependencyIds:[]},{id:'review',role:'verifier',dependencyIds:['maker']}]};
   db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run(prepared.runId,envelope.envelope_hash,'a'.repeat(64),JSON.stringify(plan));
   db.prepare("INSERT INTO orchestration_step VALUES(?,'maker','failed'),(?,'review','pending')").run(prepared.runId,prepared.runId);
   db.prepare("INSERT INTO orchestration_attempt(attempt_id,run_id,task_id,candidate_id,state,claim_payload,worktree_realpath,lease_acquired_at,cleanup_verified) VALUES('fixture-failed-attempt',?,'maker','fixture-candidate','failed','{}',?,NULL,0)").run(prepared.runId,workspace);
   const card=core.completion(prepared.taskId),ipcEvents=[],requests=[];let openedArtifact;
   main=new BrowserWindow({width:1180,height:850,show:false,webPreferences:{preload:join(root,'app/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
   main.webContents.on('console-message',(_event,...args)=>messages.push(args.map(String)));
   // Real BrowserWindow subclass suppresses only production show() for unattended QA.
   class HiddenReportWindow extends BrowserWindow { show() {} }
   const observedSession={fromPartition(...args){const isolated=session.fromPartition(...args),web=isolated.webRequest,original=web.onBeforeRequest.bind(web);web.onBeforeRequest=callback=>original((details,done)=>callback(details,decision=>{requests.push({url:details.url,type:details.resourceType,cancel:decision.cancel});done(decision);}));return isolated;}};
   registerIpcHandlers(ipcMain,core,{isTrustedSender:event=>{const allowed=event.sender===main.webContents&&event.senderFrame===main.webContents.mainFrame;ipcEvents.push({sender:event.sender.id,mainFrame:event.senderFrame===event.sender.mainFrame,allowed});return allowed;},openReport:async artifact=>{openedArtifact=artifact;report=await openReportWindow({BrowserWindow:HiddenReportWindow,session:observedSession},artifact);}});
   phase='main-load';await main.loadFile(join(root,'app/renderer/index.html'));
   phase='render-card';
   await main.webContents.executeJavaScript(`renderCard(${JSON.stringify(card)}); true`);
   const before=await main.webContents.executeJavaScript("({visible:!document.querySelector('#report').hidden,runId:document.querySelector('#report').dataset.runId,api:typeof window.cue.report})");assert.equal(before.visible,true);assert.equal(before.runId,prepared.runId);assert.equal(before.api,'function');
   phase='button-click';await main.webContents.executeJavaScript("document.querySelector('#report').click();true");
   const deadline=Date.now()+10000;while(!report&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));assert(report,'report window not opened');
   phase='untrusted-window';untrusted=new BrowserWindow({show:false,webPreferences:{preload:join(root,'app/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});await untrusted.loadFile(join(root,'app/renderer/index.html'));
   const denied=await untrusted.webContents.executeJavaScript(`window.cue.report({runId:${JSON.stringify(prepared.runId)}}).then(()=>false,error=>String(error).includes('sender denied'))`);assert.equal(denied,true);
   const prefs=report.webContents.getLastWebPreferences();assert.equal(prefs.javascript,false);assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.sandbox,true);assert.equal(prefs.contextIsolation,true);assert(!prefs.preload);
   phase='report-inspection';report.webContents.debugger.attach('1.3');
   const evaluated=await report.webContents.debugger.sendCommand('Runtime.evaluate',{expression:"({body:document.body.textContent,rows:[...document.querySelectorAll('tbody tr')].map(x=>x.textContent),edges:[...document.querySelectorAll('li')].map(x=>x.textContent),node:typeof process,cue:typeof window.cue,overflow:document.documentElement.scrollWidth>innerWidth})",returnByValue:true});
   if(evaluated.exceptionDetails)throw Error('report DOM inspection failed');const dom=evaluated.result.value;report.webContents.debugger.detach();
   assert(dom.rows.some(row=>row.includes('maker')&&row.includes('failed')&&row.includes('observed')));assert(dom.edges.some(edge=>edge.includes('maker')&&edge.includes('review')&&edge.includes('planned')));assert.equal(dom.node,'undefined');assert.equal(dom.cue,'undefined');assert.equal(dom.overflow,false);
   const exactURL='data:text/html;base64,'+readFileSync(openedArtifact.path).toString('base64');assert.equal(report.webContents.getURL(),exactURL);assert(requests.every(r=>r.url===exactURL&&r.type==='mainFrame'&&!r.cancel));assert(ipcEvents.some(e=>e.allowed&&e.mainFrame));assert(ipcEvents.some(e=>!e.allowed));
   await report.webContents.capturePage();await new Promise(r=>setTimeout(r,150));const png=join(output,'electron-app-report.png');writeFileSync(png,(await report.webContents.capturePage()).toPNG());
   writeFileSync(join(output,'electron-report.html'),readFileSync(openedArtifact.path));delete dom.body;
   const result={passed:true,kind:'actual-app-flow-with-synthetic-ledger',before,dom,deniedOtherWindow:denied,ipcEvents,requests,reportSettings:{javascript:prefs.javascript,nodeIntegration:prefs.nodeIntegration,contextIsolation:prefs.contextIsolation,sandbox:prefs.sandbox,preload:!!prefs.preload},artifactReceipt:openedArtifact.receipt,artifactSha256:hash(openedArtifact.path),pngSha256:hash(png),sourceHashes:Object.fromEntries(['app/core.mjs','app/ipc.mjs','app/preload.cjs','app/report-window.mjs','app/renderer/renderer.js','scripts/reuse/report-app-electron-proof.mjs'].map(p=>[p,hash(join(root,p))])),limitations:'Actual core/AppDaemon temp SQLite and shipped IPC/preload/report-window; synthetic approved plan and failed attempt, no model call. Only show() suppressed by real BrowserWindow subclass. Not upstream deliver or actual task qualification.'};
   report.destroy();report=null;untrusted.destroy();untrusted=null;main.destroy();main=null;await core.close();core=null;writeFileSync(join(output,'electron-result.json'),JSON.stringify(result,null,2));clearTimeout(timer);app.exit(0);
  }catch(error){writeFileSync(join(output,'electron-failure.json'),JSON.stringify({phase,messages,error:String(error),stack:error.stack},null,2));for(const win of [report,untrusted,main])if(win&&!win.isDestroyed())win.destroy();await core?.close();clearTimeout(timer);app.exit(1);}
 })();
}else{
 mkdirSync(output,{recursive:true});const owned=mkdtempSync(join(tmpdir(),'cue-report-app-proof-')),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(require('electron'),[fileURLToPath(import.meta.url),'--electron-probe',owned],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>{log+=b});child.stderr.on('data',b=>{log+=b});const {stopProcessTree}=await import('../../daemon/scripts/process-lifecycle.mjs');let timeout=false;const timer=setTimeout(()=>{timeout=true;void stopProcessTree(child).catch(e=>{log+=String(e)});},60000);
 try{const code=await new Promise((done,reject)=>{child.once('close',done);child.once('error',reject)});writeFileSync(join(output,'electron-process.json'),JSON.stringify({pid:child.pid,exitCode:code,timeout},null,2));assert.equal(timeout,false);assert.equal(code,0);console.log('PASS actual app report IPC and isolated report window');}
 finally{clearTimeout(timer);await stopProcessTree(child);writeFileSync(join(output,'electron-process.log'),log);const absolute=resolve(owned);assert.equal(dirname(absolute),resolve(tmpdir()));assert(basename(absolute).startsWith('cue-report-app-proof-'));rmSync(absolute,{recursive:true,force:true});}
}
