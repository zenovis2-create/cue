// Independent current-source artifact and hidden production report-window QA.
// Default mode is intentionally the held final run; use `node --check` for preparation.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceOut = join(root, 'evidence/integrations/S7/20260912-current-source');
const qaOut = join(root, 'evidence/integrations/S7/20260912-current-source-followup/qa');
const archiveOut = join(root, 'evidence/integrations/S7/20260911-source-matrix');
const shaBytes = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = path => shaBytes(readFileSync(path));
const save = (name, value) => writeFileSync(join(qaOut, name), JSON.stringify(value, null, 2));
const canonical = value => JSON.stringify(value);

function receiptFor(kind, result) {
  if (kind === 'structure') return result.receipt;
  return result.comparison;
}

function checkReceipt(path, receipt) {
  const bytes = readFileSync(path);
  assert.equal(bytes.length, receipt.artifactBytes);
  assert.equal(shaBytes(bytes), receipt.artifactSha256);
  return { bytes, artifactBytes: bytes.length, artifactSha256: shaBytes(bytes) };
}

function changes(before, after, key = 'id') {
  const left = new Map(before.map(value => [value[key], value]));
  const right = new Map(after.map(value => [value[key], value]));
  return [...new Set([...left.keys(), ...right.keys()])].sort().flatMap(id => {
    const status = !left.has(id) ? 'added' : !right.has(id) ? 'removed' : canonical(left.get(id)) !== canonical(right.get(id)) ? 'changed' : null;
    return status ? [{ id, status }] : [];
  });
}

function independentComparison(before, after, result) {
  const beforeFiles = new Map(before.files.map(file => [file.path, file.sha256]));
  const afterFiles = new Map(after.files.map(file => [file.path, file.sha256]));
  const files = [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])].sort().flatMap(path => {
    const status = !beforeFiles.has(path) ? 'added' : !afterFiles.has(path) ? 'removed' : beforeFiles.get(path) !== afterFiles.get(path) ? 'changed' : null;
    return status ? [{ path, status, beforeSha256: beforeFiles.get(path) ?? null, afterSha256: afterFiles.get(path) ?? null }] : [];
  });
  const expected = result.comparison.comparison;
  assert.deepEqual(files, expected.files);
  assert.deepEqual(changes(before.nodes, after.nodes), expected.nodes);
  assert.deepEqual(changes(before.edges, after.edges), expected.edges);
  assert.deepEqual(expected.beforeCounts, { files: before.files.length, nodes: before.nodes.length, edges: before.edges.length });
  assert.deepEqual(expected.afterCounts, { files: after.files.length, nodes: after.nodes.length, edges: after.edges.length });
  assert.equal(expected.beforeRevision, before.revision);
  assert.equal(expected.afterRevision, after.revision);
  assert.equal(expected.provenance, 'current-static-source-declared-unverified');
}

if (process.argv.includes('--electron-probe')) {
  void (async () => {
    const { app, BrowserWindow, session } = require('electron');
    app.setPath('userData', process.argv.at(-1));
    app.disableHardwareAcceleration();
    app.on('window-all-closed', () => {});
    let win;
    const timer = setTimeout(() => app.exit(124), 55000);
    try {
      await app.whenReady();
      const { openReportWindow } = await import('../../app/report-window.mjs');
      const generation = resolve(process.argv[process.argv.indexOf('--electron-probe') + 1]);
      const sourceArtifact = join(generation, 'cue-current-source.html');
      const comparisonArtifact = join(generation, 'cue-current-comparison.html');
      const result = JSON.parse(readFileSync(join(generation, 'result.json'), 'utf8'));
      const observations = [];
      for (const [kind, artifact] of [['structure', sourceArtifact], ['comparison', comparisonArtifact]]) {
        const receipt = receiptFor(kind, result);
        const exact = checkReceipt(artifact, receipt);
        const exactURL = `data:text/html;base64,${exact.bytes.toString('base64')}`;
        const requests = [], guards = { permissionRequest: false, permissionCheck: false, download: false };
        const observedSession = { fromPartition(...args) {
          const isolated = session.fromPartition(...args);
          const permissionRequest = isolated.setPermissionRequestHandler.bind(isolated);
          isolated.setPermissionRequestHandler = handler => { guards.permissionRequest = true; return permissionRequest(handler); };
          const permissionCheck = isolated.setPermissionCheckHandler.bind(isolated);
          isolated.setPermissionCheckHandler = handler => { guards.permissionCheck = true; return permissionCheck(handler); };
          const on = isolated.on.bind(isolated);
          isolated.on = (event, handler) => { if (event === 'will-download') guards.download = true; return on(event, handler); };
          const original = isolated.webRequest.onBeforeRequest.bind(isolated.webRequest);
          isolated.webRequest.onBeforeRequest = callback => original((details, done) => callback(details, decision => {
            requests.push({ exactBootstrap: details.url === exactURL, type: details.resourceType, cancel: decision.cancel, scheme: details.url.split(':', 1)[0] });
            done(decision);
          }));
          return isolated;
        } };
        let constructorPreferences;
        class HiddenWindow extends BrowserWindow {
          constructor(options) { constructorPreferences = options.webPreferences; super(options); }
          show() {}
        }
        win = await openReportWindow({ BrowserWindow: HiddenWindow, session: observedSession }, { path: artifact, receipt });
        assert.equal(win.isVisible(), false);
        assert.equal(win.webContents.getURL(), exactURL);
        const prefs = win.webContents.getLastWebPreferences();
        assert.deepEqual({ javascript: prefs.javascript, nodeIntegration: prefs.nodeIntegration, contextIsolation: prefs.contextIsolation, sandbox: prefs.sandbox, preload: !!prefs.preload, webSecurity: prefs.webSecurity },
          { javascript: false, nodeIntegration: false, contextIsolation: true, sandbox: true, preload: false, webSecurity: true });
        const devToolsOpened = win.webContents.isDevToolsOpened();
        assert.equal(constructorPreferences.devTools, false); assert.equal(devToolsOpened, false);
        assert.deepEqual(guards, { permissionRequest: true, permissionCheck: true, download: true });
        win.webContents.debugger.attach('1.3');
        const evaluate = async expression => {
          const response = await win.webContents.debugger.sendCommand('Runtime.evaluate', { expression, returnByValue: true });
          if (response.exceptionDetails) throw Error(`CDP inspection error: ${kind}`);
          return response.result.value;
        };
        const dom = await evaluate(`({
          title:document.title,h1:document.querySelector('h1')?.textContent,
          csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
          scripts:document.scripts.length,external:document.querySelectorAll('[src],[href]').length,
          privileged:{node:typeof process,require:typeof require,buffer:typeof Buffer,cue:typeof window.cue},
          details:document.querySelectorAll('details').length,closed:[...document.querySelectorAll('details')].every(x=>!x.open),
          rows:document.querySelectorAll('tbody tr').length,lists:document.querySelectorAll('li').length,
          sourceEdges:document.querySelectorAll('.source-inventory:nth-of-type(2) li').length,
          groups:document.querySelectorAll('.architecture-groups li').length,
          svg:document.querySelectorAll('svg').length,textAlternative:document.querySelector('.architecture-alternative')?.textContent||'',
          body:document.body.textContent,width:innerWidth,height:document.documentElement.scrollHeight,
          overflow:document.documentElement.scrollWidth>innerWidth
        })`);
        assert(dom.csp.includes("default-src 'none'"));
        for (const directive of ["script-src 'none'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "style-src 'sha256-"]) assert(dom.csp.includes(directive));
        assert.equal(dom.scripts, 0); assert.equal(dom.external, 0); assert.deepEqual(dom.privileged, { node: 'undefined', require: 'undefined', buffer: 'undefined', cue: 'undefined' });
        assert.equal(dom.closed, true); assert.equal(dom.overflow, false);
        if (kind === 'structure') {
          assert.equal(dom.svg, 1); assert(dom.textAlternative.length > 0);
          assert(dom.body.includes(result.snapshotDigest));
          assert.equal(dom.rows, result.fileCount); assert.equal(dom.sourceEdges, result.edgeCount);
          assert(dom.groups > 0 && dom.groups <= 8);
        } else {
          assert.equal(dom.svg, 0); assert(dom.body.includes(result.snapshotDigest));
          assert(dom.body.includes('current-static-source-declared-unverified'));
        }
        const capture = async suffix => {
          await new Promise(done => setTimeout(done, 160));
          const path = join(qaOut, `${kind}-${suffix}.png`);
          writeFileSync(path, (await win.webContents.capturePage()).toPNG());
          return { path: `${kind}-${suffix}.png`, sha256: hash(path) };
        };
        const defaultPng = await capture('default');
        win.setSize(480, 900); await new Promise(done => setTimeout(done, 160));
        const narrow = await evaluate('({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth})');
        assert.equal(narrow.overflow, false);
        const narrowPng = await capture('narrow');
        const expanded = await evaluate(`(()=>{document.querySelectorAll('details').forEach(x=>x.open=true);return{overflow:document.documentElement.scrollWidth>innerWidth,allVisible:[...document.querySelectorAll('details tbody tr,details li')].every(x=>x.getClientRects().length>0),height:document.documentElement.scrollHeight}})()`);
        assert.equal(expanded.overflow, false); assert.equal(expanded.allVisible, true);
        await evaluate(`${kind === 'structure' ? "document.querySelector('.source-inventory')" : "document.querySelector('details')"}?.scrollIntoView();true`);
        const expandedPng = await capture('expanded');
        assert(requests.length >= 1);
        assert(requests.every(request => request.exactBootstrap && request.type === 'mainFrame' && !request.cancel));
        assert.equal(hash(artifact), exact.artifactSha256);
        win.webContents.debugger.detach(); win.destroy(); win = undefined;
        observations.push({ kind, artifact: { artifactBytes: exact.artifactBytes, artifactSha256: exact.artifactSha256 }, dom: { ...dom, body: undefined }, narrow, expanded, requests, guards,
          settings: { javascript: prefs.javascript, nodeIntegration: prefs.nodeIntegration, contextIsolation: prefs.contextIsolation, sandbox: prefs.sandbox, preload: !!prefs.preload, devTools: constructorPreferences.devTools, devToolsOpened, webSecurity: prefs.webSecurity },
          screenshots: [defaultPng, narrowPng, expandedPng] });
      }
      save('electron-result.json', { passed: true, observations, scope: 'Exact saved current bounded static source snapshot and declared-import diagram/comparison in hidden production report-window; CDP QA-only.' });
      clearTimeout(timer); app.exit(0);
    } catch (error) {
      save('electron-failure.json', { error: String(error), stack: error.stack });
      if (win && !win.isDestroyed()) win.destroy(); clearTimeout(timer); app.exit(1);
    }
  })();
} else {
  mkdirSync(qaOut, { recursive: true });
  const pointerPath = join(sourceOut, 'current-generation.json');
  const pointerBytes = readFileSync(pointerPath), pointerSha256 = shaBytes(pointerBytes);
  const pointer = JSON.parse(pointerBytes);
  assert.equal(pointer.schemaVersion, 1); assert(/^[a-f0-9]{64}$/.test(pointer.snapshotDigest));
  assert.equal(pointer.generation, `generations/${pointer.snapshotDigest}`);
  const generation = resolve(sourceOut, pointer.generation);
  assert.equal(dirname(generation).toLowerCase(), resolve(sourceOut, 'generations').toLowerCase());
  assert.equal(basename(generation), pointer.snapshotDigest);
  const manifestBytes = readFileSync(join(generation, 'generation.json'));
  assert.equal(shaBytes(manifestBytes), pointer.manifestSha256);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.generation, pointer.snapshotDigest); assert.equal(manifest.snapshotDigest, pointer.snapshotDigest);
  assert.deepEqual(manifest.files.map(entry => entry.name), ['cue-current-source.html', 'cue-current-comparison.html', 'source.json', 'source-basis.json', 'result.json']);
  for (const entry of manifest.files) {
    const bytes = readFileSync(join(generation, entry.name)); assert.equal(bytes.length, entry.bytes); assert.equal(shaBytes(bytes), entry.sha256);
  }
  const sourceArtifact = join(generation, 'cue-current-source.html');
  const comparisonArtifact = join(generation, 'cue-current-comparison.html');
  const source = JSON.parse(readFileSync(join(generation, 'source.json'), 'utf8'));
  const result = JSON.parse(readFileSync(join(generation, 'result.json'), 'utf8'));
  const basis = JSON.parse(readFileSync(join(generation, 'source-basis.json'), 'utf8'));
  assert.deepEqual(basis.before, basis.after);
  assert.equal(basis.before.snapshotDigest, result.snapshotDigest);
  assert.equal(result.fileCount, source.files.length); assert.equal(result.edgeCount, source.edges.length);
  assert.deepEqual(result.edges, source.edges);
  assert(result.limits && result.parser?.identities?.length, 'saved limits and parser binary identities required');
  const { captureSource, extractionMetadata, extractGraph } = await import('./cue-source-structure-report.mjs');
  const snapshot = captureSource(root), graph = extractGraph(snapshot);
  assert.equal(snapshot.digest, result.snapshotDigest); assert.equal(snapshot.digest, source.revision);
  assert.deepEqual(snapshot.inventory, result.inventory);
  assert.deepEqual(snapshot.files.map(({ path, sha256 }) => ({ path, sha256 })), source.files);
  assert.deepEqual(graph.imports, result.imports); assert.deepEqual(graph.edges, result.edges);
  assert.deepEqual({ limits: result.limits, parser: result.parser }, extractionMetadata());
  const structure = checkReceipt(sourceArtifact, result.receipt);
  const comparison = checkReceipt(comparisonArtifact, result.comparison);
  const priorSourceBytes = readFileSync(join(archiveOut, 'source.json'));
  const priorResultBytes = readFileSync(join(archiveOut, 'result.json'));
  assert.equal(shaBytes(priorSourceBytes), result.archivePins.source);
  assert.equal(shaBytes(priorResultBytes), result.archivePins.result);
  const prior = JSON.parse(priorSourceBytes);
  independentComparison(prior, source, result);
  assert.equal(result.comparison.specificationSha256, shaBytes(Buffer.from(canonical(result.comparison.comparison))));
  assert.equal(result.comparison.specificationBytes, Buffer.byteLength(canonical(result.comparison.comparison)));
  const sourceHashes = Object.fromEntries(['app/report-window.mjs', 'daemon/src/reports/architecture.ts', 'daemon/src/reports/comparison.ts', 'daemon/src/reports/delivery.ts', 'daemon/src/reports/html.ts', 'daemon/src/reports/ir.ts', 'scripts/reuse/cue-current-source-report.mjs', 'scripts/reuse/cue-source-structure-report.mjs', 'scripts/reuse/current-source-electron-proof.mjs'].map(path => [path, hash(join(root, path))]));
  save('independent-source-check.json', { passed: true, pointerSha256, manifestSha256: pointer.manifestSha256, snapshotDigest: snapshot.digest, inventory: snapshot.inventory, fileCount: snapshot.files.length, importCount: graph.imports.length, edgeCount: graph.edges.length, artifacts: { structure, comparison }, sourceHashes });
  const owned = mkdtempSync(join(tmpdir(), 'cue-current-source-proof-'));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  rmSync(join(qaOut, 'electron-result.json'), { force: true });
  const child = spawn(require('electron'), [fileURLToPath(import.meta.url), '--electron-probe', generation, owned], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; const append = bytes => { log = (log + bytes).slice(-1048576); };
  child.stdout.on('data', append); child.stderr.on('data', append);
  const { stopProcessTree } = await import('../../daemon/scripts/process-lifecycle.mjs');
  let timeout = false; const timer = setTimeout(() => { timeout = true; void stopProcessTree(child).catch(append); }, 60000);
  try {
    const exitCode = await new Promise((done, reject) => { child.once('close', done); child.once('error', reject); });
    save('electron-process.json', { pid: child.pid, exitCode, timeout });
    assert.equal(timeout, false); assert.equal(exitCode, 0);
    const electronResult = JSON.parse(readFileSync(join(qaOut, 'electron-result.json'), 'utf8'));
    assert.equal(electronResult.passed, true); assert.equal(electronResult.observations.length, 2);
    assert.deepEqual(electronResult.observations.map(observation => observation.kind), ['structure', 'comparison']);
    assert.equal(electronResult.observations.flatMap(observation => observation.screenshots).length, 6);
    for (const screenshot of electronResult.observations.flatMap(observation => observation.screenshots)) assert.equal(hash(join(qaOut, screenshot.path)), screenshot.sha256);
    assert.equal(shaBytes(readFileSync(pointerPath)), pointerSha256);
    save('final-verdict.json', { passed: true, wording: 'current bounded static source snapshot and declared-import diagram/comparison', pointerSha256, manifestSha256: pointer.manifestSha256, snapshotDigest: snapshot.digest, structureSha256: structure.artifactSha256, comparisonSha256: comparison.artifactSha256, sourceHashes });
    console.log('PASS current bounded static source snapshot and declared-import diagram/comparison');
  } catch (error) {
    save('failure.json', { error: String(error), stack: error.stack, timeout }); throw error;
  } finally {
    clearTimeout(timer); await stopProcessTree(child); writeFileSync(join(qaOut, 'electron-process.log'), log);
    const absolute = resolve(owned);
    assert.equal(dirname(absolute).toLowerCase(), resolve(tmpdir()).toLowerCase());
    assert(basename(absolute).startsWith('cue-current-source-proof-'));
    rmSync(absolute, { recursive: true, force: true });
  }
}
