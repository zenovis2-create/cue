import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url), root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=join(root,'evidence/integrations/S2/20260911-selection-preference');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(process.argv.includes('--electron-probe')){
 void(async()=>{
  const {app,BrowserWindow}=require('electron');app.setPath('userData',process.argv.at(-1));app.disableHardwareAcceleration();
  let window;const timer=setTimeout(()=>app.exit(124),55000);
  try{
   await app.whenReady();window=new BrowserWindow({width:1550,height:1450,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
   await window.loadFile(join(root,'app/renderer/index.html'));const call=code=>window.webContents.executeJavaScript(code);
   await call(`globalThis.fixture={available:true,mode:'value',revision:2,conflict:false,prepares:[],saves:[]};
    window.cue={selectionPreferences:async()=>({available:fixture.available,mode:fixture.mode,revision:fixture.revision}),
    setSelectionPreference:async(input)=>{fixture.saves.push({...input});if(fixture.conflict){fixture.conflict=false;fixture.revision++;throw Error('selection_preference_conflict');}fixture.mode=input.mode;fixture.revision++;return{available:true,mode:fixture.mode,revision:fixture.revision};},
    prepare:async(input)=>{fixture.prepares.push({...input});return{taskId:'fixture-task',runId:'frozen-fixture-run',threeLines:['무엇을: 합성 모드 UI 검사','어디까지: fixture workspace','안 건드릴 것: 실제 코드·계정'],envelope:{expires_at:'2026-09-12T00:00:00.000Z',worktree_realpath:'fixture workspace',allowed_actions:['read']},orchestration:fixture.available?{mode:input.selectionMode,policyRevision:'fixture-r1',currency:'TEST',unit:'micro',limitUnits:'500',stageCount:0,planDigest:'a'.repeat(64),stages:[]}:null};}};
    globalThis.choose=(value)=>{const el=document.querySelector('#selection-mode');el.value=value;el.dispatchEvent(new Event('change'));};
    globalThis.pause=()=>new Promise(r=>setTimeout(r,30));
    globalThis.submit=async()=>{document.querySelector('#goal').value='합성 fixture: 모드와 승인 대기 계획 확인';document.querySelector('#goal-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await pause();};
    loadSelectionPreferences()`);
   const options=await call("[...document.querySelector('#selection-mode').options].map(x=>x.value)");assert.deepEqual(options,['efficiency','performance','value','speed']);
   assert.equal(await call("document.querySelector('#selection-mode').value"),'value');
   for(const mode of options){await call(`choose(${JSON.stringify(mode)});submit()`);assert.equal(await call('fixture.prepares.at(-1).selectionMode'),mode);}
   await call("choose('performance');submit()");const prepared=await call("document.querySelector('#approval-plan-summary').textContent");assert.match(prepared,/고성능 모드/);
   await call("choose('speed');document.querySelector('#selection-save').click();pause()");
   const saved=await call("({call:fixture.saves.at(-1),revision:fixture.revision,status:document.querySelector('#selection-status').textContent,plan:document.querySelector('#approval-plan-summary').textContent})");
   assert.deepEqual(saved.call,{mode:'speed',expectedRevision:2});assert.equal(saved.revision,3);assert.match(saved.status,/기본 속도 모드를 저장했습니다/);assert.equal(saved.plan,prepared);
   assert.equal(await call("document.documentElement.scrollWidth>innerWidth"),false);assert.equal(window.isVisible(),false);
   // Flush the hidden compositor before recording the final saved-default frame.
   await window.webContents.capturePage();await new Promise(r=>setTimeout(r,200));
   const png=join(output,'electron-mode.png');writeFileSync(png,(await window.webContents.capturePage()).toPNG());
   await call("fixture.conflict=true;choose('efficiency');document.querySelector('#selection-save').click();pause()");
   const conflict=await call("({status:document.querySelector('#selection-status').textContent,choice:document.querySelector('#selection-mode').value,plan:document.querySelector('#approval-plan-summary').textContent})");
   assert.match(conflict.status,/저장하지 못했습니다/);assert(!conflict.status.includes('저장했습니다'));assert.equal(conflict.choice,'efficiency');assert.equal(conflict.plan,prepared);
   await call("document.querySelector('#selection-save').click();pause()");assert.deepEqual(await call('fixture.saves.at(-1)'),{mode:'efficiency',expectedRevision:4});
   await call('fixture.available=false;loadSelectionPreferences()');await call('submit()');
   const unavailable=await call("({hidden:document.querySelector('#selection-controls').hidden,disabled:document.querySelector('#selection-mode').disabled,status:document.querySelector('#selection-status').textContent,prepare:fixture.prepares.at(-1),planHidden:document.querySelector('#approval-plan').hidden})");
   assert.equal(unavailable.hidden,true);assert.equal(unavailable.disabled,true);assert.match(unavailable.status,/지원하지 않습니다/);assert.equal(Object.hasOwn(unavailable.prepare,'selectionMode'),false);assert.equal(unavailable.planHidden,true);
   const record={kind:'fixture',passed:true,electron:process.versions.electron,options,saved,conflict,unavailable,pngSha256:hash(png),
    sourceHashes:Object.fromEntries(['app/renderer/index.html','app/renderer/renderer.js','app/renderer/styles.css','scripts/reuse/selection-mode-electron-proof.mjs'].map(p=>[p,hash(join(root,p))])),
    limits:'Actual renderer with fixture cue API and synthetic CAS. No production IPC/database persistence or agent execution.'};
   writeFileSync(join(output,'electron-result.json'),JSON.stringify(record,null,2));clearTimeout(timer);window.destroy();app.exit(0);
  }catch(error){writeFileSync(join(output,'electron-failure.json'),JSON.stringify({message:String(error),stack:error.stack},null,2));clearTimeout(timer);window?.destroy();app.exit(1);}
 })();
}else{
 mkdirSync(output,{recursive:true});const temp=mkdtempSync(join(tmpdir(),'cue-mode-ui-')),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(require('electron'),[fileURLToPath(import.meta.url),'--electron-probe',temp],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',b=>{log+=b});child.stderr.on('data',b=>{log+=b});const {stopProcessTree}=await import('../../daemon/scripts/process-lifecycle.mjs');let timeout=false;
 const timer=setTimeout(()=>{timeout=true;void stopProcessTree(child).catch(e=>{log+=e});},60000);
 try{const code=await new Promise((done,reject)=>{child.once('close',done);child.once('error',reject)});writeFileSync(join(output,'electron-process.json'),JSON.stringify({pid:child.pid,exitCode:code,timeout,command:'node scripts/reuse/selection-mode-electron-proof.mjs'},null,2));assert.equal(timeout,false);assert.equal(code,0);console.log('PASS actual hidden Electron selection modes, frozen plan, conflicts and legacy');}
 finally{clearTimeout(timer);await stopProcessTree(child);writeFileSync(join(output,'electron-process.log'),log);}
}
