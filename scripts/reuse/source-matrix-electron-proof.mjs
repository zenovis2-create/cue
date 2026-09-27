// Independent source-matrix QA. Does not replace historical source-structure evidence.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(root, 'evidence/integrations/S7/20260911-source-matrix'), artifact = join(out, 'cue-source-structure.html');
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const save = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2));
if (process.argv.includes('--electron-probe')) {
  void (async () => {
  const { app, BrowserWindow, session } = require('electron');
  app.setPath('userData', process.argv.at(-1)); app.disableHardwareAcceleration();
  let win; const timer = setTimeout(() => app.exit(124), 55000);
  try {
    await app.whenReady();
    const { openReportWindow } = await import('../../app/report-window.mjs');
    const source = JSON.parse(readFileSync(join(out, 'source.json'), 'utf8'));
    const bytes = readFileSync(artifact), artifactSha256 = hash(artifact), exactURL = 'data:text/html;base64,' + bytes.toString('base64'), requests = [];
    class HiddenWindow extends BrowserWindow { show() {} }
    const observedSession = { fromPartition(...args) {
      const isolated = session.fromPartition(...args), original = isolated.webRequest.onBeforeRequest.bind(isolated.webRequest);
      isolated.webRequest.onBeforeRequest = callback => original((details, done) => callback(details, decision => {
        requests.push({ exactBootstrap: details.url === exactURL, type: details.resourceType, cancel: decision.cancel, scheme: details.url.split(':', 1)[0] }); done(decision);
      })); return isolated;
    } };
    win = await openReportWindow({ BrowserWindow: HiddenWindow, session: observedSession }, { path: artifact, receipt: { artifactBytes: bytes.length, artifactSha256 } });
    assert.equal(win.isVisible(), false); assert.equal(win.webContents.getURL(), exactURL);
    const prefs = win.webContents.getLastWebPreferences();
    assert.equal(prefs.javascript, false); assert.equal(prefs.nodeIntegration, false); assert.equal(prefs.contextIsolation, true); assert.equal(prefs.sandbox, true); assert(!prefs.preload);
    win.webContents.debugger.attach('1.3');
    const evaluate = async expression => {
      const response = await win.webContents.debugger.sendCommand('Runtime.evaluate', { expression, returnByValue: true });
      if (response.exceptionDetails) throw Error('CDP inspection error'); return response.result.value;
    };
    const dom = await evaluate(`({
      rows:document.querySelectorAll('tbody tr').length,
      edges:document.querySelectorAll('.source-inventory:nth-of-type(2) li').length,
      groups:[...document.querySelectorAll('.architecture-groups li')].map(x=>({label:x.querySelector('span').textContent,count:Number(x.dataset.count)})),
      cells:[...document.querySelectorAll('.architecture-matrix g')].map(x=>({title:x.querySelector('title').textContent,count:Number(x.querySelector('text').textContent)||0})),
      allUnverified:[...document.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('unverified')),
      allEdgesDeclared:[...document.querySelectorAll('.source-inventory:nth-of-type(2) li')].every(r=>r.textContent.includes('source-declared-unverified')),
      warning:document.body.textContent.includes('소스 선언은 미검증'),
      node:typeof process,cue:typeof window.cue,overflow:document.documentElement.scrollWidth>innerWidth,
      viewport:innerWidth,documentHeight:document.documentElement.scrollHeight,
      closedInventory:[...document.querySelectorAll('.source-inventory')].every(x=>!x.open),
      scripts:document.scripts.length,external:document.querySelectorAll('[src],[href]').length,
      textAlternative:document.querySelector('.architecture-alternative').textContent
    })`);
    assert.equal(dom.rows, source.nodes.length); assert.equal(dom.edges, source.edges.length);
    assert(dom.groups.length <= 8); assert.equal(dom.groups.reduce((s, g) => s + g.count, 0), source.nodes.length);
    const uniquePairs = new Set(source.edges.map(e => JSON.stringify([e.from, e.to])));
    assert.equal(dom.cells.length, dom.groups.length ** 2); assert.equal(dom.cells.reduce((s, c) => s + c.count, 0), uniquePairs.size);
    const groupFor = id => { const directory = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '(루트)'; const direct = dom.groups.findIndex(g => g.label === directory); return direct >= 0 ? direct : dom.groups.findIndex(g => g.label.startsWith('기타 ')); };
    const expected = Array(dom.cells.length).fill(0);
    for (const pair of uniquePairs) { const [from, to] = JSON.parse(pair), a = groupFor(from), b = groupFor(to); assert(a >= 0 && b >= 0); expected[a * dom.groups.length + b]++; }
    assert.deepEqual(dom.cells.map(c => c.count), expected);
    for (const id of source.nodes.map(n => n.id)) { const dir = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '(루트)'; assert(dom.textAlternative.includes(dir)); }
    for (const key of ['allUnverified', 'allEdgesDeclared', 'warning', 'closedInventory']) assert.equal(dom[key], true);
    assert.equal(dom.node, 'undefined'); assert.equal(dom.cue, 'undefined'); assert.equal(dom.overflow, false); assert.equal(dom.scripts, 0); assert.equal(dom.external, 0);
    assert(dom.documentHeight < 2400, 'collapsed overview must remain compact');
    const capture = async name => { await new Promise(r => setTimeout(r, 150)); const path = join(out, name); writeFileSync(path, (await win.webContents.capturePage()).toPNG()); return hash(path); };
    const overview = await capture('electron-source-overview.png');
    win.setSize(480, 900); await new Promise(r => setTimeout(r, 150));
    const narrow = await evaluate('({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,height:document.documentElement.scrollHeight})');
    assert.equal(narrow.overflow, false);
    await evaluate("document.querySelector('.architecture').scrollIntoView();true");
    const narrowMatrix = await capture('electron-source-narrow.png');
    const expanded = await evaluate(`(()=>{document.querySelectorAll('.source-inventory').forEach(x=>x.open=true);return {overflow:document.documentElement.scrollWidth>innerWidth,rowsVisible:[...document.querySelectorAll('tbody tr')].every(x=>x.getClientRects().length>0),edgesVisible:[...document.querySelectorAll('.source-inventory:nth-of-type(2) li')].every(x=>x.getClientRects().length>0)}})()`);
    assert.equal(expanded.overflow, false); assert.equal(expanded.rowsVisible, true); assert.equal(expanded.edgesVisible, true);
    assert(requests.length >= 1); assert(requests.every(r => r.exactBootstrap && r.type === 'mainFrame' && !r.cancel)); assert.equal(hash(artifact), artifactSha256);
    win.webContents.debugger.detach();
    save('electron-result.json', { passed: true, artifactSha256, artifactBytes: bytes.length, dom, narrow, expanded, requests,
      settings: { javascript: prefs.javascript, nodeIntegration: prefs.nodeIntegration, contextIsolation: prefs.contextIsolation, sandbox: prefs.sandbox, preload: !!prefs.preload }, screenshots: { overview, narrowMatrix },
      sourceHashes: Object.fromEntries(['app/report-window.mjs', 'daemon/src/reports/architecture.ts', 'daemon/src/reports/html.ts', 'daemon/test/integration-reports.test.ts', 'scripts/reuse/source-matrix-electron-proof.mjs'].map(p => [p, hash(join(root, p))])),
      scope: 'Actual hidden production report-window; CDP is QA-only. Snapshot source relationships are unverified, not runtime/security evidence. No application bridge or model call.' });
    win.destroy(); clearTimeout(timer); app.exit(0);
  } catch (error) { save('electron-failure.json', { error: String(error), stack: error.stack }); if (win && !win.isDestroyed()) win.destroy(); clearTimeout(timer); app.exit(1); }
  })();
} else {
  mkdirSync(out, { recursive: true });
  const { captureSource, extractGraph, verifySource } = await import('./cue-source-structure-report.mjs');
  const { sourceReport } = await import('../../daemon/dist/src/reports/ir.js');
  const { renderReportHtml } = await import('../../daemon/dist/src/reports/html.js');
  const { createReportDelivery } = await import('../../daemon/dist/src/reports/delivery.js');
  const snapshot = captureSource(root), graph = extractGraph(snapshot);
  const input = { identity: 'cue-static-source-imports', revision: snapshot.digest, files: snapshot.files.map(({ path, sha256 }) => ({ path, sha256 })), nodes: snapshot.files.map(f => ({ id: f.path, label: `${f.path} · 정적 문법 추출, 실행/영향 미검증` })), edges: graph.edges };
  const report = sourceReport(JSON.stringify(input)), rendered = renderReportHtml(report);
  verifySource(snapshot);
  const receipt = createReportDelivery(out).deliver('cue-source-structure', report, rendered);
  save('source.json', input); save('result.json', { snapshotDigest: snapshot.digest, fileCount: snapshot.files.length, edgeCount: graph.edges.length, inventory: snapshot.inventory, receipt, scope: 'Before/after source digest matched; static syntax snapshot only.', ...graph });
  const owned = mkdtempSync(join(tmpdir(), 'cue-source-matrix-proof-')), env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [fileURLToPath(import.meta.url), '--electron-probe', owned], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; const append = b => { log = (log + b).slice(-1048576); }; child.stdout.on('data', append); child.stderr.on('data', append);
  const { stopProcessTree } = await import('../../daemon/scripts/process-lifecycle.mjs'); let timeout = false;
  const timer = setTimeout(() => { timeout = true; void stopProcessTree(child).catch(append); }, 60000);
  try { const code = await new Promise((done, reject) => { child.once('close', done); child.once('error', reject); }); save('electron-process.json', { pid: child.pid, exitCode: code, timeout }); assert.equal(timeout, false); assert.equal(code, 0); console.log('PASS actual source matrix: default/narrow, counts, full inventory, isolated report window'); }
  finally { clearTimeout(timer); await stopProcessTree(child); writeFileSync(join(out, 'electron-process.log'), log); const absolute = resolve(owned); assert.equal(dirname(absolute), resolve(tmpdir())); assert(basename(absolute).startsWith('cue-source-matrix-proof-')); rmSync(absolute, { recursive: true, force: true }); }
}
