import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const criteriaMode = process.argv.includes('--criteria');
const out = join(root, criteriaMode ? 'evidence/integrations/S4/20260911-approval-criteria' : 'evidence/integrations/S3/20260911-approval-plan');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');

if (process.argv.includes('--electron-probe')) {
  void (async () => {
    const { app, BrowserWindow } = require('electron');
    app.setPath('userData', process.argv.at(-1)); app.disableHardwareAcceleration();
    const timer = setTimeout(() => app.exit(124), 55_000); let window;
    try {
      await app.whenReady();
      window = new BrowserWindow({ width: 1600, height: 1400, show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      await window.loadFile(join(root, 'app/renderer/index.html'));
      const summary = { mode: 'value', policyRevision: 'fixture-r1', currency: 'USD', unit: 'micro', limitUnits: '500', stageCount: 2, planDigest: 'a'.repeat(64), stages: [
        { id: 'impl', role: 'implementation', dependencyIds: [], requirementIds: ['req1'], scopeIds: ['workspace'], candidateIds: ['fixture-coder'] },
        { id: 'check', role: 'verifier', dependencyIds: ['impl'], requirementIds: ['req1'], scopeIds: ['workspace'], candidateIds: ['fixture-checker'] },
      ] };
      if (criteriaMode) {
        summary.requirementsDigest = 'b'.repeat(64);
        summary.requirements = [{ id: 'req1', text: '합성 fixture: 로그인 결과를 검증한다. <img src=x onerror=alert(1)> 원문은 코드 실행 없이 그대로 표시한다.', kind: 'code', required: true,
          checks: [{ checkerId: 'tests', revision: 'v1', parametersDigest: 'c'.repeat(64), targetIds: ['login', 'logout'] }] }];
      }
      const prepared = { runId: 'fixture-run', taskId: 'fixture-task', threeLines: ['무엇을: 합성 계획 UI 검증', '어디까지: fixture workspace', '안 건드릴 것: 실제 코드·계정'],
        envelope: { expires_at: '2026-09-12T00:00:00.000Z', worktree_realpath: 'fixture workspace', allowed_actions: ['read'] }, orchestration: summary };
      writeFileSync(join(out, 'electron-fixture.json'), JSON.stringify({ kind: 'fixture', prepared }, null, 2));
      const call = code => window.webContents.executeJavaScript(code);
      await call(`globalThis.proofPrepared=${JSON.stringify(prepared)}; globalThis.proofKind='plan'; globalThis.proofCalls=0;
        window.cue={prepare: async ()=>{proofCalls++; if(proofKind==='failure') throw Error('fixture prepare failed'); return {...proofPrepared, orchestration:proofKind==='legacy'?undefined:proofKind==='missing'?{...proofPrepared.orchestration,requirements:[],requirementsDigest:null}:proofPrepared.orchestration};}};
        globalThis.proofSubmit=async()=>{document.querySelector('#goal').value='합성 fixture 계획 표시 검사'; document.querySelector('#goal-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); await new Promise(r=>setTimeout(r,30));}; true`);
      await call('proofSubmit()');
      const dom = await call(`({open:document.querySelector('#approval-plan').open, visible:!document.querySelector('#approval-plan').hidden,
        summary:document.querySelector('#approval-plan-summary').textContent, stages:[...document.querySelectorAll('#approval-plan-stages li')].map(x=>x.textContent),
        approveEnabled:!document.querySelector('#approve').disabled, calls:proofCalls, nodeUnavailable:typeof process==='undefined'&&typeof require==='undefined'})`);
      assert.equal(dom.visible, true); assert.equal(dom.open, true); assert.equal(dom.approveEnabled, true); assert.equal(dom.calls, 1);
      assert.match(dom.summary, /가성비 모드/); assert.equal(dom.stages.length, 2);
      for (const expected of ['검증', '선행 단계: impl', '요구사항: req1', '허용 범위: workspace', '후보: fixture-checker']) assert(dom.stages[1].includes(expected));
      assert.equal(dom.nodeUnavailable, true); assert.equal(window.isVisible(), false);
      let criteria = null;
      if (criteriaMode) {
        criteria = await call(`({summary:document.querySelector('#approval-requirements-summary').textContent,text:document.querySelector('.requirement-text').textContent,
          checks:document.querySelector('.requirement-checks').textContent,full:document.querySelector('#approval-requirements').textContent,
          imageCount:document.querySelectorAll('#approval-requirements img').length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth})`);
        assert.equal(criteria.text, summary.requirements[0].text); assert.equal(criteria.imageCount, 0); assert.equal(criteria.horizontalOverflow, false);
        assert(criteria.summary.includes(summary.requirementsDigest));
        for (const expected of ['req1 · 코드 · 필수','검사기: tests','버전: v1','login, logout','c'.repeat(64)]) assert(criteria.full.includes(expected));
        await call("document.querySelector('#approval-requirements-summary').scrollIntoView({block:'center'}); true");
      }
      await new Promise(r => setTimeout(r, 100));
      const png = join(out, 'electron-approval-plan.png'); writeFileSync(png, (await window.webContents.capturePage()).toPNG());
      await call("proofKind='legacy'; proofSubmit()");
      const legacy = await call("({hidden:document.querySelector('#approval-plan').hidden,children:document.querySelector('#approval-plan-stages').childElementCount})");
      assert.deepEqual(legacy, { hidden: true, children: 0 });
      if (criteriaMode) assert.equal(await call("document.querySelector('#approval-requirements').childElementCount"), 0);
      await call("proofKind='plan'; proofSubmit()"); await call("proofKind='failure'; proofSubmit()");
      const failure = await call("({hidden:document.querySelector('#approval-plan').hidden,summary:document.querySelector('#approval-plan-summary').textContent,disabled:document.querySelector('#approve').disabled,error:document.querySelector('#quiet').textContent})");
      assert.equal(failure.hidden, true); assert.equal(failure.summary, ''); assert.equal(failure.disabled, true); assert.match(failure.error, /fixture prepare failed/);
      let missingCriteria = null;
      if (criteriaMode) {
        assert.equal(await call("document.querySelector('#approval-requirements-summary').textContent"), '');
        await call("proofKind='missing'; proofSubmit()");
        missingCriteria = await call("document.querySelector('#approval-requirements-summary').textContent");
        assert.equal(missingCriteria, '기준 미등록 · 최종 인수 미확인');
        assert.equal(await call("document.querySelector('#approval-requirements').childElementCount"), 0);
      }
      const observationPath = join(root, 'evidence/integrations/S3/20260911-observation/electron-fixture.json');
      const observed = JSON.parse(readFileSync(observationPath, 'utf8')).card;
      await call(`renderCard(${JSON.stringify(observed)}); true`);
      const regression = await call("({visible:!document.querySelector('#orchestration').hidden,acceptance:document.querySelector('#orchestration-acceptance').textContent,stop:!document.querySelector('#stop').hidden&&!document.querySelector('#stop').disabled})");
      assert.equal(regression.visible, true); assert.match(regression.acceptance, /미확인/); assert.equal(regression.stop, true);
      writeFileSync(join(out, 'electron-result.json'), JSON.stringify({ kind: 'fixture', passed: true, dom, criteria, missingCriteria, legacy, failure, observationRegression: regression,
        electron: process.versions.electron, hidden: true, pngSha256: hash(png), observationFixtureSha256: hash(observationPath), fixtureSha256: hash(join(out,'electron-fixture.json')),
        sources: Object.fromEntries(['app/renderer/index.html','app/renderer/renderer.js','app/renderer/styles.css','scripts/reuse/approval-electron-proof.mjs'].map(f=>[f,hash(join(root,f))])),
        limits: 'Real renderer form submit with window.cue.prepare fixture stub. No production preload/IPC, provider calls, actual approval or execution.' }, null, 2));
      clearTimeout(timer); window.destroy(); app.exit(0);
    } catch (error) { writeFileSync(join(out,'electron-failure.json'),JSON.stringify({error:String(error),stack:error.stack},null,2)); clearTimeout(timer); window?.destroy(); app.exit(1); }
  })();
} else {
  mkdirSync(out,{recursive:true}); const temp=mkdtempSync(join(tmpdir(),'cue-approval-ui-'));
  const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(require('electron'),[fileURLToPath(import.meta.url),'--electron-probe',...(criteriaMode?['--criteria']:[]),temp],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log='';child.stdout.on('data',b=>{log+=b});child.stderr.on('data',b=>{log+=b});
  const {stopProcessTree}=await import('../../daemon/scripts/process-lifecycle.mjs');let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;void stopProcessTree(child).catch(e=>{log+=String(e)});},60000);
  try {const code=await new Promise((done,reject)=>{child.once('close',done);child.once('error',reject)});
    writeFileSync(join(out,'electron-process.json'),JSON.stringify({pid:child.pid,exitCode:code,timedOut,command:'node scripts/reuse/approval-electron-proof.mjs'+(criteriaMode?' --criteria':'')},null,2));
    assert.equal(timedOut,false);assert.equal(code,0);console.log('PASS actual hidden Electron approval plan/form and observation regression');
  } finally {clearTimeout(timer);await stopProcessTree(child);writeFileSync(join(out,'electron-process.log'),log);}
}
