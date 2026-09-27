// Real hidden Electron UI proof; synthetic ledger observations, no provider execution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = join(root, 'evidence/integrations/S3/20260911-observation');
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');

if (process.argv.includes('--electron-probe')) {
  // Electron readiness waits for ESM entry evaluation; do not top-level-await it.
  void (async () => {
  const { app, BrowserWindow } = require('electron');
  const fixtureFile = process.argv.at(-1);
  const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
  app.setPath('userData', join(dirname(fixtureFile), 'electron-state'));
  app.disableHardwareAcceleration();
  const timer = setTimeout(() => app.exit(124), 55_000);
  let window;
  try {
    await app.whenReady();
    window = new BrowserWindow({ width: 1500, height: 1250, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    await window.loadFile(join(root, 'app/renderer/index.html'));
    await window.webContents.executeJavaScript(`renderCard(${JSON.stringify({ ...fixture.card, orchestration: null })}); true`);
    const legacyHidden = await window.webContents.executeJavaScript("document.querySelector('#orchestration').hidden");
    assert.equal(legacyHidden, true);
    await window.webContents.executeJavaScript(`renderCard(${JSON.stringify(fixture.card)}); true`);
    const dom = await window.webContents.executeJavaScript(`({
      panelVisible: !document.querySelector('#orchestration').hidden,
      policy: document.querySelector('#orchestration-policy').textContent,
      acceptance: document.querySelector('#orchestration-acceptance').textContent,
      budget: document.querySelector('#orchestration-budget').textContent,
      stages: [...document.querySelectorAll('#orchestration-stages li')].map(e=>e.textContent),
      activity: document.querySelector('#orchestration-activity').textContent,
      stopEnabled: !document.querySelector('#stop').hidden && !document.querySelector('#stop').disabled,
      text: document.body.innerText,
      nodeUnavailable: typeof process === 'undefined' && typeof require === 'undefined'
    })`);
    assert.equal(dom.panelVisible, true); assert.match(dom.policy, /가성비 모드 · 정책 r1/);
    assert.match(dom.acceptance, /미확인/); assert.match(dom.budget, /미확인/);
    assert.equal(dom.stages.length, 2); assert(dom.stages.some(s => s.includes('실행 중')));
    assert(dom.stages.some(s => s.includes('대기'))); assert.equal(dom.stopEnabled, true);
    assert.equal(dom.nodeUnavailable, true); assert(!dom.text.includes('private-secret'));
    assert.equal(window.isVisible(), false);
    await new Promise(resolveWait => setTimeout(resolveWait, 150));
    const png = join(output, 'electron-observation.png');
    writeFileSync(png, (await window.webContents.capturePage()).toPNG());
    writeFileSync(join(output, 'electron-result.json'), JSON.stringify({
      kind: 'fixture', passed: true, legacyHidden, dom, show: false,
      versions: { electron: process.versions.electron, chrome: process.versions.chrome },
      fixtureSha256: sha(fixtureFile), pngSha256: sha(png),
      sources: Object.fromEntries(['app/renderer/index.html', 'app/renderer/renderer.js', 'app/renderer/styles.css',
        'daemon/src/ui/orchestration.ts', 'scripts/reuse/observation-electron-proof.mjs'].map(file => [file, sha(join(root, file))])),
      limits: 'Synthetic SQLite DTO injected through renderCard; no production IPC, model task or real cancellation executed.',
    }, null, 2));
    clearTimeout(timer); window.destroy(); app.exit(0);
  } catch (error) {
    writeFileSync(join(output, 'electron-failure.json'), JSON.stringify({ message: String(error), stack: error.stack }, null, 2));
    clearTimeout(timer); window?.destroy(); app.exit(1);
  }
  })();
} else {
  mkdirSync(output, { recursive: true });
  const temp = mkdtempSync(join(tmpdir(), 'cue-observation-ui-'));
  const { openLedger } = await import('../../daemon/dist/src/ledger.js');
  const { readOrchestrationSnapshot } = await import('../../daemon/dist/src/ui/orchestration.js');
  const { saveSelectionPolicy, bindRunSelectionPolicy } = await import('../../daemon/dist/src/selection/policy-store.js');
  const db = openLedger();
  let card;
  try {
    db.prepare("INSERT INTO task VALUES('fixture-task','running',NULL,'now')").run();
    db.prepare("INSERT INTO envelope VALUES('fixture-envelope','C:/private-secret','[]','now')").run();
    db.prepare("INSERT INTO run VALUES('fixture-run','fixture-task','fixture-envelope',0,'now')").run();
    db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run('fixture-run', 'fixture-envelope', 'a'.repeat(64), JSON.stringify({ revision: 'fixture-plan1', tasks: [{ id: 'implementation', role: 'implementation' }, { id: 'verification', role: 'verifier' }] }));
    db.prepare("INSERT INTO orchestration_step VALUES('fixture-run','implementation','running')").run();
    db.prepare("INSERT INTO orchestration_step VALUES('fixture-run','verification','pending')").run();
    db.prepare("INSERT INTO orchestration_attempt VALUES('fixture-attempt','fixture-run','implementation','fixture-candidate','running','{}','C:/private-secret',NULL,0)").run();
    db.prepare('INSERT INTO orchestration_activity VALUES(?,?,?,?)').run('fixture-event', 'fixture-attempt', 1, JSON.stringify({ kind: 'progress', observedAtMs: 1789080000000, detail: 'private-secret' }));
    const saved = saveSelectionPolicy(db, { policyId: 'fixture-policy', expectedRevision: null, createdAt: '2026-09-11T00:00:00.000Z', sourceVersion: 'fixture',
      policy: { version: 'cue-selection-v1', mode: 'value', qualityMinimum: 0.8, costBasis: 1, timeBasisMs: 100,
        currency: 'USD', costLimit: null, remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['fixture-candidate'], pinnedCandidateId: null } });
    bindRunSelectionPolicy(db, { runId: 'fixture-run', policyId: saved.policyId, revision: saved.revision, digest: saved.digest, boundAt: '2026-09-11T00:00:00.000Z' });
    card = { state: 'running', status: '진행 중', stage: '관측 화면 fixture 검증', approvalSummary: '합성 원장 데이터 · 실제 작업 아님', autonomySummary: '표시 기능만 검증', resultSummary: '구현 단계 실행 중 · 검증 단계 대기', orchestration: readOrchestrationSnapshot(db, 'fixture-run') };
  } finally { db.close(); }
  const fixtureFile = join(temp, 'fixture.json');
  writeFileSync(fixtureFile, JSON.stringify({ kind: 'fixture', card }, null, 2));
  writeFileSync(join(output, 'electron-fixture.json'), readFileSync(fixtureFile));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [fileURLToPath(import.meta.url), '--electron-probe', fixtureFile], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', b => { log += String(b); }); child.stderr.on('data', b => { log += String(b); });
  const { stopProcessTree } = await import('../../daemon/scripts/process-lifecycle.mjs');
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void stopProcessTree(child).catch(error => { log += String(error); }); }, 60_000);
  try {
    const code = await new Promise((resolveExit, reject) => { child.once('error', reject); child.once('close', resolveExit); });
    writeFileSync(join(output, 'electron-process.json'), JSON.stringify({ pid: child.pid, exitCode: code, timedOut, kind: 'fixture', command: 'node scripts/reuse/observation-electron-proof.mjs' }, null, 2));
    assert.equal(timedOut, false); assert.equal(code, 0);
    console.log('PASS hidden Electron observation fixture; PNG and assertions saved');
  } finally {
    clearTimeout(timer); await stopProcessTree(child);
    writeFileSync(join(output, 'electron-process.log'), log);
  }
}
