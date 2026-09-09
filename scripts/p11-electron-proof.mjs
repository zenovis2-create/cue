import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { stopProcessTree } from '../daemon/scripts/process-lifecycle.mjs';

const phases = ['P11', 'P12'];
const phase = phases.includes(process.env.CUE_EVIDENCE_PHASE) ? process.env.CUE_EVIDENCE_PHASE : 'P11';
const prefix = phase.toLowerCase();
const outputOverride = process.env.CUE_ELECTRON_PROOF_OUTPUT_DIR;
const evidence = outputOverride ? resolve(outputOverride) : resolve('evidence', phase);
const cancel = process.argv.includes('--cancel');
const port = phase === 'P12' ? (cancel ? 9538 : 9537) : (cancel ? 9438 : 9437);
const state = join(tmpdir(), `cue-${prefix}-electron-${cancel ? 'cancel' : 'window'}-${Date.now()}`);
const workspace = join(state, 'workspace');
const userData = join(state, 'state');
mkdirSync(evidence, { recursive: true });
mkdirSync(workspace, { recursive: true });
const resultPath = join(evidence, cancel ? `${prefix}_electron_cancel_result.json` : `${prefix}_electron_window_result.json`);
const failurePath = join(evidence, cancel ? `${prefix}_electron_cancel_failure.json` : `${prefix}_electron_window_failure.json`);
const pendingPath = join(evidence, cancel ? `${prefix}_electron_cancel_pending.json` : `${prefix}_electron_window_pending.json`);
for (const stale of [resultPath, failurePath, pendingPath]) rmSync(stale, { force: true });
const log = createWriteStream(join(evidence, cancel ? `${prefix}_electron_cancel.log` : `${prefix}_electron_live.log`));
const env = { ...process.env, CUE_USER_DATA: userData };
delete env.CUE_LIVE_RUN;
delete env.CUE_WORKTREE_ROOT;
delete env.ELECTRON_RUN_AS_NODE;
if (!cancel) env.CUE_WORKTREE_ROOT = workspace;
const child = spawn(process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', `npm.cmd start -- --inspect=127.0.0.1:${port}`], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
const childClose = new Promise(resolveClose => child.once('close', resolveClose));
const logClose = new Promise((resolveClose, rejectClose) => {
  log.once('finish', resolveClose);
  log.once('error', rejectClose);
});
let exited = false;
const exit = new Promise(resolveExit => child.once('exit', code => { exited = true; resolveExit(code); }));
const delay = ms => new Promise(done => setTimeout(done, ms));
const deadline = Date.now() + 180000;
async function until(fn) {
  while (Date.now() < deadline) { const value = await fn(); if (value) return value; await delay(100); }
  throw new Error('FAIL: Electron proof timeout');
}
let ws;
let prospectiveRecord = null;
let proofError = null;
try {
  const target = await until(async () => {
    if (exited) throw new Error('Electron exited before debugger');
    try { const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); return targets[0]; } catch { return null; }
  });
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => { ws.onopen = done; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = event => { const data = JSON.parse(event.data); const item = pending.get(data.id); if (item) { pending.delete(data.id); item(data); } };
  async function evaluate(expression) {
    const requestId = ++id;
    const reply = new Promise(done => pending.set(requestId, done));
    ws.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    const data = await Promise.race([reply, delay(10000).then(() => { throw new Error('FAIL: inspector timeout'); })]);
    if (data.error || data.result?.exceptionDetails) throw new Error(JSON.stringify(data.error ?? data.result.exceptionDetails));
    return data.result.result.value;
  }
  await evaluate(`globalThis.p11Electron = process.getBuiltinModule('module').createRequire(process.cwd() + '/package.json')('electron'); true`);
  const pid = await evaluate('process.pid');
  writeFileSync(pendingPath, JSON.stringify({ pid, userData, workspace }, null, 2));
  if (cancel) {
    ws.close();
    console.log(JSON.stringify({ cancelAppPid: pid, userData, deadlineSeconds: 180 }));
    await until(() => exited);
    const code = await exit;
    const record = { command: 'npm.cmd start', pid, exitCode: code, configWritten: existsSync(join(userData, 'cue-config.json')), fallbackFolderCreated: existsSync(userData), userData, workspace, passed: code === 1 && !existsSync(userData) };
    assert.equal(record.passed, true);
    prospectiveRecord = record;
  } else {
    await until(async () => evaluate(`p11Electron.BrowserWindow.getAllWindows().some(w => !w.webContents.isLoading())`));
    const record = await evaluate(`(async () => {
      const win = p11Electron.BrowserWindow.getAllWindows()[0]; const wc = win.webContents;
      const prefs = wc.getLastWebPreferences();
      const renderer = await wc.executeJavaScript("({ title: document.title, readyState: document.readyState, api: Object.keys(window.cue).sort(), types: Object.values(window.cue).map(x=>typeof x), csp: document.querySelector('meta[http-equiv=\\\"Content-Security-Policy\\\"]').content, requireType: typeof require, processType: typeof process })");
      const originalUrl = wc.getURL(); let nav;
      wc.on('will-navigate', (event, url) => { nav = { url, prevented: event.defaultPrevented }; });
      const popupNull = await wc.executeJavaScript("window.open('https://example.invalid/p11-popup') === null");
      await wc.executeJavaScript("location.href = 'https://example.invalid/p11-navigation'; true");
      await new Promise(done => setTimeout(done, 250));
      wc.debugger.attach('1.3');
      try {
        const capture = await wc.debugger.sendCommand('Page.captureScreenshot', { format: 'png' });
        process.getBuiltinModule('fs').writeFileSync(${JSON.stringify(join(evidence, `${prefix}_electron_window.png`))}, Buffer.from(capture.data, 'base64'));
      } finally { if (wc.debugger.isAttached()) wc.debugger.detach(); }
      return { electronVersion: process.versions.electron, pid: process.pid, visible: win.isVisible(), windowCount: p11Electron.BrowserWindow.getAllWindows().length, prefs: {contextIsolation:prefs.contextIsolation,nodeIntegration:prefs.nodeIntegration,sandbox:prefs.sandbox}, renderer, navigation: {event:nav, originalUrl, finalUrl:wc.getURL()}, popupNull };
    })()`);
    assert.deepEqual(record.prefs, { contextIsolation: true, nodeIntegration: false, sandbox: true });
    assert.deepEqual(record.renderer.api, ['approve', 'execute', 'prepare', 'stop']);
    assert(record.renderer.types.every(type => type === 'function'));
    assert(record.renderer.csp.includes("default-src 'none'"));
    assert.equal(record.navigation.event.prevented, true);
    assert.equal(record.navigation.originalUrl, record.navigation.finalUrl);
    assert.equal(record.popupNull, true); assert.equal(record.windowCount, 1); assert.equal(record.visible, true);
    await evaluate('setTimeout(() => p11Electron.app.quit(), 100); true');
    ws.close();
    await until(() => exited);
    record.exitCode = await exit; record.passed = record.exitCode === 0;
    assert.equal(record.passed, true);
    prospectiveRecord = record;
  }
} catch (error) {
  proofError = error;
} finally {
  ws?.close();
  const cleanupErrors = [];
  try { await stopProcessTree(child); } catch (error) { cleanupErrors.push(error); }
  try {
    await Promise.race([childClose, delay(10_000).then(() => { throw new Error('Electron child close timeout'); })]);
  } catch (error) { cleanupErrors.push(error); }
  log.end();
  try { await logClose; } catch (error) { cleanupErrors.push(error); }
  try { rmSync(state, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch (error) { cleanupErrors.push(error); }
  if (process.env.CUE_ELECTRON_PROOF_FORCE_CLEANUP_FAILURE === '1') {
    cleanupErrors.push(new Error(process.env.NODE_ENV === 'test' ? 'forced cleanup failure' : 'cleanup-failure injection requires NODE_ENV=test'));
  }
  if (cleanupErrors.length > 0 && !proofError) proofError = cleanupErrors[0];
}

rmSync(pendingPath, { force: true });
if (proofError || !prospectiveRecord?.passed) {
  rmSync(resultPath, { force: true });
  const failure = { passed: false, error: String(proofError ?? 'Electron proof did not produce a passing result') };
  writeFileSync(failurePath, JSON.stringify(failure, null, 2));
  console.error(failure.error);
  process.exitCode = 1;
} else {
  rmSync(failurePath, { force: true });
  writeFileSync(resultPath, JSON.stringify(prospectiveRecord, null, 2));
  console.log(JSON.stringify(prospectiveRecord));
}
