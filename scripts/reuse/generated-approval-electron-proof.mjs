import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = join(root, 'evidence/integrations/S4/20260911-generated-output-approval-ui');
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
if (process.argv.includes('--electron-probe')) {
  void (async () => {
    const { app, BrowserWindow } = require('electron');
    app.setPath('userData', process.argv.at(-1)); app.disableHardwareAcceleration();
    let window; const timer = setTimeout(() => app.exit(124), 55000);
    try {
      await app.whenReady();
      window = new BrowserWindow({ width: 1400, height: 1300, show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      await window.loadFile(join(root, 'app/renderer/index.html'));
      const call = code => window.webContents.executeJavaScript(code);
      const target = { targetId: ('output-' + 'long-identifier-'.repeat(9)).slice(0,128), requirementId: 'req-json-transform', producerTaskId: 'model-producer', checkerId: 'fixed-json-checker', checkerRevision: 'v1', inputSha256: '1'.repeat(64), inputByteLength: 120, maxBytes: 1048576, parametersDigest: '2'.repeat(64), targetDigest: '3'.repeat(64), inputBytes: 'RAW-INPUT-MUST-NOT-RENDER-749231', secret: 'PRIVATE-SENTINEL-749231' };
      const prepared = { taskId: 'fixture-task', runId: 'fixture-run', threeLines: ['무엇을: 생성 결과물 승인 계약 확인', '어디까지: 합성 UI fixture', '안 건드릴 것: 실제 모델·작업 파일'], envelope: { expires_at: '2030-01-01T00:00:00.000Z', worktree_realpath: 'fixture workspace', allowed_actions: [] }, orchestration: { mode: 'performance', policyRevision: 'fixture-r1', currency: 'TEST', unit: 'micro', limitUnits: '500', stageCount: 0, planDigest: 'a'.repeat(64), stages: [], generatedOutputs: [target] } };
      writeFileSync(join(output, 'electron-fixture.json'), JSON.stringify({ kind: 'fixture', prepared }, null, 2));
      await call(`(async()=>{globalThis.fixture={kind:'generated',prepares:[],prepared:${JSON.stringify(prepared)}};
        window.cue={selectionPreferences:async()=>({available:true,mode:'value',revision:1}),prepare:async(input)=>{fixture.prepares.push(input);if(fixture.kind==='failure')throw Error('fixture prepare failure');return {...fixture.prepared,orchestration:fixture.kind==='legacy'?undefined:fixture.kind==='absent'?{...fixture.prepared.orchestration,generatedOutputs:undefined}:fixture.prepared.orchestration};}};
        globalThis.submit=async()=>{document.querySelector('#goal').value='합성 생성 출력 계약 UI 검사';document.querySelector('#goal-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,40));};
        await loadSelectionPreferences();document.querySelector('#selection-mode').value='performance';document.querySelector('#selection-mode').dispatchEvent(new Event('change'));await submit();return true;})()`);
      const dom = await call(`({visible:!document.querySelector('#approval-generated').hidden,text:document.querySelector('#approval-generated').textContent,rows:document.querySelectorAll('#approval-generated-targets > li').length,body:document.body.textContent,overflow:document.documentElement.scrollWidth>innerWidth,rowOverflow:[...document.querySelectorAll('#approval-generated-targets > li')].some(x=>x.scrollWidth>x.clientWidth),mode:fixture.prepares.at(-1).selectionMode,selected:document.querySelector('#selection-mode').value,nodeUnavailable:typeof process==='undefined'&&typeof require==='undefined',approve:!document.querySelector('#approve').disabled})`);
      assert.equal(dom.visible, true); assert.equal(dom.rows, 1); assert.equal(dom.mode, 'performance'); assert.equal(dom.selected, 'performance'); assert.equal(dom.approve, true);
      for (const field of ['targetId','requirementId','producerTaskId','checkerId','checkerRevision','inputSha256','parametersDigest','targetDigest']) assert(dom.text.includes(target[field]), field);
      assert(dom.text.includes('120바이트')); assert(dom.text.includes('1048576바이트'));
      assert(!dom.body.includes(target.inputBytes)); assert(!dom.body.includes(target.secret));
      assert.equal(dom.overflow, false); assert.equal(dom.rowOverflow, false); assert.equal(dom.nodeUnavailable, true); assert.equal(window.isVisible(), false);
      delete dom.body;
      await call("document.querySelector('#approval-generated').scrollIntoView({block:'center'}); true");
      await window.webContents.capturePage(); await new Promise(r => setTimeout(r, 180));
      const png = join(output, 'electron-generated-approval.png'); writeFileSync(png, (await window.webContents.capturePage()).toPNG());
      const clears = {};
      for (const kind of ['absent', 'legacy', 'failure']) {
        await call("fixture.kind='generated';submit()");
        await call(`fixture.kind=${JSON.stringify(kind)};submit()`);
        const state = await call("({hidden:document.querySelector('#approval-generated').hidden,children:document.querySelector('#approval-generated-targets').childElementCount,limit:document.querySelector('#approval-generated-limit').textContent,mode:fixture.prepares.at(-1).selectionMode,disabled:document.querySelector('#approve').disabled})");
        assert.equal(state.hidden, true); assert.equal(state.children, 0); assert.equal(state.limit, ''); assert.equal(state.mode, 'performance');
        if (kind === 'failure') assert.equal(state.disabled, true);
        clears[kind] = state;
      }
      writeFileSync(join(output, 'electron-result.json'), JSON.stringify({ kind: 'fixture', passed: true, dom, clears, hidden: true, electron: process.versions.electron, pngSha256: hash(png), fixtureSha256: hash(join(output,'electron-fixture.json')), sourceHashes: Object.fromEntries(['app/renderer/index.html','app/renderer/renderer.js','app/renderer/styles.css','scripts/reuse/generated-approval-electron-proof.mjs'].map(p=>[p,hash(join(root,p))])), limits: 'Actual fresh Electron renderer and form submit with window.cue fixture API. No real preload, IPC dispatch, model calls or approval execution.' }, null, 2));
      clearTimeout(timer); window.destroy(); app.exit(0);
    } catch (error) { writeFileSync(join(output,'electron-failure.json'), JSON.stringify({error:String(error),stack:error.stack},null,2)); clearTimeout(timer); window?.destroy(); app.exit(1); }
  })();
} else {
  mkdirSync(output,{recursive:true}); const temp=mkdtempSync(join(tmpdir(),'cue-generated-approval-')); const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(require('electron'),[fileURLToPath(import.meta.url),'--electron-probe',temp],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log=''; child.stdout.on('data',b=>{log+=b}); child.stderr.on('data',b=>{log+=b});
  const {stopProcessTree}=await import('../../daemon/scripts/process-lifecycle.mjs'); let timeout=false;
  const timer=setTimeout(()=>{timeout=true;void stopProcessTree(child).catch(e=>{log+=String(e)});},60000);
  try { const code=await new Promise((done,reject)=>{child.once('close',done);child.once('error',reject)}); writeFileSync(join(output,'electron-process.json'),JSON.stringify({pid:child.pid,exitCode:code,timeout,command:'node scripts/reuse/generated-approval-electron-proof.mjs'},null,2)); assert.equal(timeout,false);assert.equal(code,0);console.log('PASS actual hidden Electron generated output approval fixture'); }
  finally {clearTimeout(timer);await stopProcessTree(child);writeFileSync(join(output,'electron-process.log'),log);}
}
