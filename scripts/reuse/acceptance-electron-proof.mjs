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
const output = join(root, 'evidence/integrations/S4/20260911-acceptance-ui');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
if (process.argv.includes('--electron-probe')) {
  void (async () => {
    const { app, BrowserWindow } = require('electron');
    app.setPath('userData', process.argv.at(-1)); app.disableHardwareAcceleration();
    let window; const timer = setTimeout(() => app.exit(124), 55_000);
    try {
      await app.whenReady();
      window = new BrowserWindow({ width: 1550, height: 1450, show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
      await window.loadFile(join(root, 'app/renderer/index.html'));
      const original = JSON.parse(readFileSync(join(root,'evidence/integrations/S3/20260911-observation/electron-fixture.json'),'utf8')).card;
      const card = { ...original, state: 'completed', status: 'fixture 종료', stage: '저장된 인수 기록 표시 검사', resultSummary: '합성 fixture · 실제 실행이나 인수 기록 생성 아님' };
      const snapshot = { ...original.orchestration, stages: original.orchestration.stages.map(s => ({ ...s, state:'completed', cleanup:'verified-clean' })),
        acceptance:'verified', acceptanceRecord:{acceptedAt:1789080000000,evaluationId:'fixture-evaluation'},
        requirementEvaluation:{id:'fixture-evaluation',verdict:'pass',outcomes:[{requirementId:'req-login <img src=x>',required:true,verdict:'pass'},{requirementId:'req-optional',required:false,verdict:'unknown'}]} };
      const cases = {
        accepted: { ...card, orchestration:snapshot },
        failed: { ...card, orchestration:{...snapshot,acceptance:'unverified',acceptanceRecord:null,requirementEvaluation:{...snapshot.requirementEvaluation,verdict:'fail',outcomes:[{requirementId:'req-login',required:true,verdict:'fail'}]}} },
        unknown: { ...card, orchestration:{...snapshot,acceptance:'unverified',acceptanceRecord:null,requirementEvaluation:{...snapshot.requirementEvaluation,verdict:'unknown',outcomes:[{requirementId:'req-login',required:true,verdict:'unknown'}]}} },
        unacceptedPass: { ...card, orchestration:{...snapshot,acceptance:'unverified',acceptanceRecord:null} },
        legacy: { ...card, orchestration:null },
      };
      writeFileSync(join(output,'electron-fixtures.json'),JSON.stringify({kind:'fixture',cases},null,2));
      const results = {}; const screenshots = {};
      for (const [name, fixture] of Object.entries(cases)) {
        await window.webContents.executeJavaScript(`renderCard(${JSON.stringify(fixture)});true`);
        const dom = await window.webContents.executeJavaScript(`({title:document.querySelector('#state-title').textContent,
          panelHidden:document.querySelector('#orchestration').hidden,acceptance:document.querySelector('#orchestration-acceptance').textContent,
          outcomes:[...document.querySelectorAll('#orchestration-requirements li')].map(e=>e.textContent),
          images:document.querySelectorAll('#orchestration-requirements img').length,stopHidden:document.querySelector('#stop').hidden,
          horizontalOverflow:document.documentElement.scrollWidth>innerWidth,nodeUnavailable:typeof process==='undefined'&&typeof require==='undefined'})`);
        assert.equal(dom.horizontalOverflow,false);assert.equal(dom.nodeUnavailable,true);assert.equal(dom.stopHidden,true);
        if(name==='legacy'){assert.equal(dom.panelHidden,true);assert.equal(dom.title,'완료');}
        else {
          assert.equal(dom.panelHidden,false);
          if(name==='accepted') {
            assert.equal(dom.title,'완료 · 인수 기록 확인');assert.match(dom.acceptance,/현재 파일을 다시 검사한 결과는 아닙니다/);
            assert.match(dom.acceptance,/fixture-evaluation/);assert(dom.outcomes[0].includes('req-login <img src=x> · 필수 · 통과'));assert.equal(dom.images,0);
          } else {
            assert.equal(dom.title,'실행 완료 · 인수 미확인');assert.match(dom.acceptance,/인수 확정 아님/);
            if(name==='failed') assert(dom.outcomes[0].includes('필수 · 실패'));
            if(name==='unknown') assert(dom.outcomes[0].includes('필수 · 미확인'));
            if(name==='unacceptedPass') assert.match(dom.acceptance,/최근 검사 통과/);
          }
        }
        results[name]=dom;
        if(name==='accepted'||name==='failed') {
          await window.webContents.executeJavaScript("document.querySelector('#orchestration-acceptance').scrollIntoView({block:'center'});true");
          await new Promise(r=>setTimeout(r,100));const png=join(output,`electron-${name}.png`);
          writeFileSync(png,(await window.webContents.capturePage()).toPNG());screenshots[name]=hash(png);
        }
      }
      assert.equal(window.isVisible(),false);
      writeFileSync(join(output,'electron-result.json'),JSON.stringify({kind:'fixture',passed:true,electron:process.versions.electron,results,screenshots,
        fixtureSha256:hash(join(output,'electron-fixtures.json')),
        sourceHashes:Object.fromEntries(['app/renderer/index.html','app/renderer/renderer.js','app/renderer/styles.css','scripts/reuse/acceptance-electron-proof.mjs'].map(p=>[p,hash(join(root,p))])),
        limits:'Synthetic DTO injection into fresh actual renderer. No acceptance record generation, verifier execution or production IPC tested.'},null,2));
      clearTimeout(timer);window.destroy();app.exit(0);
    } catch(error){writeFileSync(join(output,'electron-failure.json'),JSON.stringify({message:String(error),stack:error.stack},null,2));clearTimeout(timer);window?.destroy();app.exit(1);}
  })();
} else {
  mkdirSync(output,{recursive:true});const temp=mkdtempSync(join(tmpdir(),'cue-acceptance-ui-'));
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(require('electron'),[fileURLToPath(import.meta.url),'--electron-probe',temp],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log='';child.stdout.on('data',b=>{log+=b});child.stderr.on('data',b=>{log+=b});
  const {stopProcessTree}=await import('../../daemon/scripts/process-lifecycle.mjs');let timeout=false;
  const timer=setTimeout(()=>{timeout=true;void stopProcessTree(child).catch(e=>{log+=e});},60000);
  try{const code=await new Promise((done,reject)=>{child.once('close',done);child.once('error',reject)});
    writeFileSync(join(output,'electron-process.json'),JSON.stringify({pid:child.pid,exitCode:code,timeout,command:'node scripts/reuse/acceptance-electron-proof.mjs'},null,2));
    assert.equal(timeout,false);assert.equal(code,0);console.log('PASS actual hidden Electron acceptance fixture: five states');
  }finally{clearTimeout(timer);await stopProcessTree(child);writeFileSync(join(output,'electron-process.log'),log);}
}
