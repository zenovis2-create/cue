import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url),root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=join(root,'evidence/integrations/S4/20260911-retry-observation');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
if(process.argv.includes('--electron-probe')){
 void(async()=>{
  const {app,BrowserWindow}=require('electron');app.setPath('userData',process.argv.at(-1));app.disableHardwareAcceleration();
  let window;const timer=setTimeout(()=>app.exit(124),55000);
  try{
   await app.whenReady();window=new BrowserWindow({width:1550,height:1450,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
   await window.loadFile(join(root,'app/renderer/index.html'));const call=code=>window.webContents.executeJavaScript(code);
   const previous=JSON.parse(readFileSync(join(root,'evidence/integrations/S3/20260911-observation/electron-fixture.json'),'utf8')).card;
   const retry={maxAttemptsPerTask:2,maxAttemptsTotal:4,deadlineMs:1789200000000,contractDigest:'e'.repeat(64)};
   const plan={mode:'value',policyRevision:'fixture-r1',currency:'TEST',unit:'micro',limitUnits:'500',stageCount:1,planDigest:'a'.repeat(64),
    stages:[{id:'implementation',role:'implementation',dependencyIds:[],requirementIds:['req1'],scopeIds:['workspace'],candidateIds:['first-candidate','replacement']}],retry};
   const prepared={taskId:'fixture-task',runId:'fixture-run',threeLines:['무엇을: 합성 재시도 표시 검사','어디까지: fixture workspace','안 건드릴 것: 실제 코드·계정'],
    envelope:{expires_at:'2026-09-12T00:00:00.000Z',worktree_realpath:'fixture workspace',allowed_actions:['read']},orchestration:plan};
   const snapshot={...previous.orchestration,acceptance:'unverified',acceptanceRecord:null,requirementEvaluation:null,
    stages:[{taskId:'implementation',role:'implementation',state:'completed',candidateId:'replacement',attemptId:'retry-attempt',attemptCount:2,failedAttemptCount:1,cleanup:'verified-clean',modelId:null,toolId:null}],
    attemptCount:2,attemptHistoryTruncated:false,attemptHistory:[{taskId:'implementation',attemptId:'retry-attempt',candidateId:'replacement',state:'completed',cleanup:'verified-clean'},{taskId:'implementation',attemptId:'first-attempt',candidateId:'first-candidate',state:'failed',cleanup:'verified-clean'}],
    budget:{status:'recorded',remainingUnits:'400',debtUnits:'0',currency:'TEST',unit:'micro',actualUnits:null,costStatus:'unknown'}};
   const card={...previous,state:'completed',status:'fixture 실행 종료',stage:'실패 후 재시도 기록',resultSummary:'합성 DTO · 첫 시도 비용 미확정 · 실제 실행 아님',orchestration:snapshot};
   writeFileSync(join(output,'electron-fixtures.json'),JSON.stringify({kind:'fixture',prepared,card},null,2));
   await call(`globalThis.preparedFixture=${JSON.stringify(prepared)};window.cue={prepare:async()=>preparedFixture};document.querySelector('#goal').value='합성 fixture 재시도 계약 확인';document.querySelector('#goal-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));true`);
   await new Promise(r=>setTimeout(r,40));
   const approval=await call("({hidden:document.querySelector('#approval-retry').hidden,text:document.querySelector('#approval-retry').textContent,approveEnabled:!document.querySelector('#approve').disabled})");
   assert.equal(approval.hidden,false);assert.equal(approval.approveEnabled,true);
   for(const expected of ['최초 실행 포함 단계당 최대 2회','전체 최대 4회','기한:','e'.repeat(64),'기록·비용에 포함'])assert(approval.text.includes(expected));
   const shots={};const capture=async(name)=>{await window.webContents.capturePage();await new Promise(r=>setTimeout(r,150));const file=join(output,`electron-${name}.png`);writeFileSync(file,(await window.webContents.capturePage()).toPNG());shots[name]=hash(file);};
   await call("document.querySelector('#approval-retry').scrollIntoView({block:'center'});true");await capture('retry-approval');
   await call(`renderCard(${JSON.stringify(card)});true`);
   const observed=await call("({stages:[...document.querySelectorAll('#orchestration-stages li')].map(e=>e.textContent),count:document.querySelector('#orchestration-attempt-count').textContent,history:[...document.querySelectorAll('#orchestration-attempts li')].map(e=>e.textContent),budget:document.querySelector('#orchestration-budget').textContent,title:document.querySelector('#state-title').textContent,horizontalOverflow:document.documentElement.scrollWidth>innerWidth})");
   assert.equal(observed.stages.length,1);assert.match(observed.stages[0],/최신 시도 retry-attempt/);assert.match(observed.stages[0],/총 2회 \(실패 1회\)/);
   assert.equal(observed.history.length,2);assert(observed.history[1].includes('first-attempt'));assert(observed.history[1].includes('실패'));assert.match(observed.count,/전체 시도 2회/);
   assert.match(observed.budget,/최종 비용 미확인/);assert.equal(observed.title,'실행 완료 · 인수 미확인');assert.equal(observed.horizontalOverflow,false);
   await call("document.querySelector('#orchestration-attempt-count').scrollIntoView({block:'center'});true");await capture('retry-history');
   await call(`renderApprovalPlan(${JSON.stringify({...plan,retry:null})});true`);
   const legacy=await call("({hidden:document.querySelector('#approval-retry').hidden,text:document.querySelector('#approval-retry').textContent})");assert.deepEqual(legacy,{hidden:true,text:''});
   assert.equal(window.isVisible(),false);
   writeFileSync(join(output,'electron-result.json'),JSON.stringify({kind:'fixture',passed:true,electron:process.versions.electron,approval,observed,legacy,screenshots:shots,
    fixtureSha256:hash(join(output,'electron-fixtures.json')),sourceHashes:Object.fromEntries(['app/renderer/index.html','app/renderer/renderer.js','app/renderer/styles.css','scripts/reuse/retry-electron-proof.mjs'].map(p=>[p,hash(join(root,p))])),
    limits:'Actual renderer form submit and renderCard with synthetic DTO. No real retry, billing, execution, deadline enforcement or production IPC.'},null,2));
   clearTimeout(timer);window.destroy();app.exit(0);
  }catch(error){writeFileSync(join(output,'electron-failure.json'),JSON.stringify({message:String(error),stack:error.stack},null,2));clearTimeout(timer);window?.destroy();app.exit(1);}
 })();
}else{
 mkdirSync(output,{recursive:true});const temp=mkdtempSync(join(tmpdir(),'cue-retry-ui-')),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(require('electron'),[fileURLToPath(import.meta.url),'--electron-probe',temp],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>{log+=b});child.stderr.on('data',b=>{log+=b});
 const {stopProcessTree}=await import('../../daemon/scripts/process-lifecycle.mjs');let timeout=false;const timer=setTimeout(()=>{timeout=true;void stopProcessTree(child).catch(e=>{log+=e});},60000);
 try{const code=await new Promise((done,reject)=>{child.once('close',done);child.once('error',reject)});writeFileSync(join(output,'electron-process.json'),JSON.stringify({pid:child.pid,exitCode:code,timeout,command:'node scripts/reuse/retry-electron-proof.mjs'},null,2));assert.equal(timeout,false);assert.equal(code,0);console.log('PASS actual hidden Electron retry contract, latest stage, history and unknown costs');}
 finally{clearTimeout(timer);await stopProcessTree(child);writeFileSync(join(output,'electron-process.log'),log);}
}
