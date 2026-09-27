import { spawn } from 'node:child_process';
import { createServer as createTcpServer } from 'node:net';
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
const workspaceSmoke = process.argv.includes('--workspace-smoke');
const projectSwitchSmoke = process.argv.includes('--project-switch-smoke');
const projectSwitchDeniedSmoke = process.argv.includes('--project-switch-denied-smoke');
// The inspector port must not be a bare constant: a back-to-back proof run finds the
// previous run's port still in TIME_WAIT and Electron then fails with
// "Starting inspector on 127.0.0.1:<port> failed: address already in use", which
// surfaces as an unrelated CDP error instead of the real verdict. Windows refuses a
// fresh bind on a TIME_WAIT port, so probing skips exactly those.
const basePort = phase === 'P12' ? (cancel ? 9538 : 9537) : (cancel ? 9438 : 9437);
async function reservableFrom(base) {
  for (let candidate = base; candidate < base + 40; candidate += 2) {
    const free = await new Promise(done => {
      const probe = createTcpServer();
      probe.once('error', () => done(false));
      probe.listen(candidate, '127.0.0.1', () => probe.close(() => done(true)));
    });
    if (free) return candidate;
  }
  throw new Error(`no free inspector port near ${base}`);
}
const port = await reservableFrom(basePort);
const state = join(tmpdir(), `cue-${prefix}-electron-${cancel ? 'cancel' : 'window'}-${Date.now()}`);
const workspace = join(state, 'workspace');
const alternateWorkspace = join(state, 'other-workspace');
const userData = join(state, 'state');
mkdirSync(evidence, { recursive: true });
mkdirSync(workspace, { recursive: true });
if(projectSwitchSmoke||projectSwitchDeniedSmoke)mkdirSync(alternateWorkspace,{recursive:true});
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
// `npm start` runs prestart -> `npm --prefix daemon run build`, which rewrites every
// daemon/dist file's mtime even when the emitted bytes are identical. Inside the test suite
// that is a side effect on shared state: app/installation-identity.mjs tracks mtime for
// daemon/dist/src and daemon/dist/migrations, so any test file already holding a capture
// then fails its assertCurrent() with installation_identity_unavailable_or_drifted, and a
// prestart build that loses a race for those same files kills the app before the inspector
// answers. `pretest` has already built the daemon, so the in-suite run skips only the pre
// script; it still launches through the real `npm start` entry point.
const skipPrestartBuild = process.env.NODE_ENV === 'test' ? ' --ignore-scripts' : '';
const child = spawn(process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', `npm.cmd start${skipPrestartBuild} -- --inspect=127.0.0.1:${port}`], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
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
    if (exited) throw new Error(`Electron exited before debugger (exit code ${await exit})`);
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
    // Per-evaluate budget only; the overall 180s proof deadline above bounds the run.
    const data = await Promise.race([reply, delay(30000).then(() => { throw new Error('FAIL: inspector timeout'); })]);
    if (data.error || data.result?.exceptionDetails) throw new Error(JSON.stringify(data.error ?? data.result.exceptionDetails));
    return data.result.result.value;
  }
  // The inspector can answer before the main module finished loading, and require('electron')
  // then resolves to undefined while the statement itself still succeeds. Binding without
  // checking made that surface much later as "Cannot read properties of undefined (reading
  // 'getAllWindows')", hiding the real verdict. Bind under the same 180s deadline and refuse
  // to continue until the real API is present.
  await until(async () => {
    if (exited) throw new Error(`Electron exited before the electron module could be bound (exit code ${await exit})`);
    return evaluate(`(() => { try { globalThis.p11Electron ??= process.getBuiltinModule('module').createRequire(process.cwd() + '/package.json')('electron'); return Boolean(globalThis.p11Electron && globalThis.p11Electron.BrowserWindow && globalThis.p11Electron.app); } catch { return false; } })()`);
  });
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
    assert.deepEqual(record.renderer.api, ['approve', 'candidateInventory', 'evaluation', 'execute', 'localJsonSetup', 'localPlanningSetup', 'nativeRecovery', 'planningAvailability', 'prepare', 'prepareFromPlanning', 'prepareJson', 'preparePlanning', 'projects', 'report', 'resources', 'retrospective', 'selectionPreferences', 'setSelectionPreference', 'stop', 'userSessions', 'workspaceSessions']);
    assert(record.renderer.types.every(type => type === 'function'));
    assert(record.renderer.csp.includes("default-src 'none'"));
    assert.equal(record.navigation.event.prevented, true);
    assert.equal(record.navigation.originalUrl, record.navigation.finalUrl);
    assert.equal(record.popupNull, true); assert.equal(record.windowCount, 1); assert.equal(record.visible, true);
    if(workspaceSmoke){
      // Native window, local SQLite only. No preparation, approval, launch or provider call.
      const expression=`(async()=>{
        const projects=await window.cue.projects({operation:'list'});
        document.querySelector('#workspace-new-session').click();
        const until=Date.now()+5000;
        let sessions;
        do{sessions=await window.cue.userSessions({operation:'list',limit:20,cursor:null,archived:false});
          if(sessions.records.length)break;await new Promise(r=>setTimeout(r,50));}while(Date.now()<until);
        const approveDisabled=document.querySelector('#approve').disabled;
        document.querySelector('[data-view="history"]').click();
        return {projects:projects.records.length,current:projects.records.filter(p=>p.current).length,
          sessions:sessions.records.length,firstRunCount:sessions.records[0]?.runCount??null,approveDisabled,
          historyVisible:!document.querySelector('#workspace-history').hidden,workHidden:document.querySelector('#workspace-work').hidden,
          focusedMain:document.activeElement?.id,skipTarget:document.querySelector('#workspace-skip').getAttribute('href')};
      })()`;
      const smoke=await evaluate(`(async()=>p11Electron.BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(${JSON.stringify(expression)}))()`);
      assert.deepEqual({current:smoke.current,sessions:smoke.sessions,firstRunCount:smoke.firstRunCount,approveDisabled:smoke.approveDisabled,
        historyVisible:smoke.historyVisible,workHidden:smoke.workHidden,focusedMain:smoke.focusedMain,skipTarget:smoke.skipTarget},
        {current:1,sessions:1,firstRunCount:0,approveDisabled:true,historyVisible:true,workHidden:true,focusedMain:'workspace-history',skipTarget:'#workspace-history'});
      writeFileSync(join(evidence,`${prefix}_workspace_smoke.json`),JSON.stringify(smoke,null,2));
      await delay(200); // allow Chromium to present the just-selected view before capture
      await evaluate(`(async()=>{const wc=p11Electron.BrowserWindow.getAllWindows()[0].webContents;
        wc.debugger.attach('1.3');try{const capture=await wc.debugger.sendCommand('Page.captureScreenshot',{format:'png'});
          process.getBuiltinModule('fs').writeFileSync(${JSON.stringify(join(evidence,`${prefix}_workspace_smoke.png`))},Buffer.from(capture.data,'base64'));
        }finally{if(wc.debugger.isAttached())wc.debugger.detach();}return true;})()`);
    }
    if(projectSwitchSmoke||projectSwitchDeniedSmoke){
      // Synthetic dialog responses test the native lifecycle plumbing, not human consent.
      const patched=await evaluate(`(() => {
        p11Electron.dialog.showOpenDialog=async()=>({canceled:false,filePaths:[${JSON.stringify(alternateWorkspace)}]});
        p11Electron.dialog.showMessageBox=async()=>({response:1});
        p11Electron.app.relaunch=()=>{globalThis.cueRelaunchRequested=true;};
        return true;
      })()`);
      assert.equal(patched,true);
      await evaluate(`p11Electron.BrowserWindow.getAllWindows()[0].webContents.executeJavaScript("document.querySelector('#workspace-project-add').click(); true")`);
      await until(async()=>evaluate(`p11Electron.BrowserWindow.getAllWindows()[0].webContents.executeJavaScript("document.querySelectorAll('#workspace-project-list button').length === 2")`));
      if(projectSwitchDeniedSmoke){
        // Synthetic held lease in the disposable ledger; no process or provider launch.
        const inserted=await evaluate(`(() => {
          const requireDaemon=process.getBuiltinModule('module').createRequire(${JSON.stringify(join(resolve('daemon'),'package.json'))});
          const Database=requireDaemon('better-sqlite3'),db=new Database(${JSON.stringify(join(userData,'cue-ledger.sqlite'))});
          try { db.transaction(()=>{
            db.prepare("INSERT INTO task(id,state,created_at) VALUES('native-denied-task','running','2026-09-23T00:00:00Z')").run();
            db.prepare("INSERT INTO envelope VALUES('native-denied-env',?,'[]','2026-09-23T00:00:00Z')").run(${JSON.stringify(workspace)});
            db.prepare("INSERT INTO run VALUES('native-denied-run','native-denied-task','native-denied-env',1,'2026-09-23T00:00:00Z')").run();
            db.prepare("INSERT INTO workspace_write_lease VALUES(?,?,'2026-09-23T00:00:00Z')").run(${JSON.stringify(workspace)},'native-denied-run');
          })();return true; } finally {db.close();}
        })()`);
        assert.equal(inserted,true);
      }
      await evaluate(`p11Electron.BrowserWindow.getAllWindows()[0].webContents.executeJavaScript("[...document.querySelectorAll('#workspace-project-list button')].find(b=>!b.disabled).click(); true")`);
      if(projectSwitchDeniedSmoke){
        const status=await until(async()=>evaluate(`p11Electron.BrowserWindow.getAllWindows()[0].webContents.executeJavaScript("document.querySelector('#workspace-project-status').textContent")`)
          .then(value=>value.includes('전환되지 않았습니다.')?value:null));
        const selected=JSON.parse(readFileSync(join(userData,'cue-config.json'),'utf8'));
        assert.equal(selected.worktreeRoot,workspace);
        record.projectSwitch={denied:true,configUnchanged:true,reason:'synthetic-held-lease',status};
        writeFileSync(join(evidence,`${prefix}_project_switch_denied.json`),JSON.stringify(record.projectSwitch,null,2));
        await evaluate('setTimeout(() => p11Electron.app.quit(), 100); true');ws.close();await until(()=>exited);
        record.exitCode=await exit;record.passed=record.exitCode===0;assert.equal(record.passed,true);prospectiveRecord=record;
      }else{
        ws.close();await until(()=>exited);
        const selected=JSON.parse(readFileSync(join(userData,'cue-config.json'),'utf8'));
        assert.equal(selected.worktreeRoot,alternateWorkspace);
        assert.equal(record.exitCode=await exit,0);
        const {createCueCore,initializeConfig}=await import('../app/core.mjs');
        const {createWorkspaceManagement}=await import('../app/workspace-management.mjs');
        const config=initializeConfig(userData),reopened=createCueCore(config);
        try{
          const projects=createWorkspaceManagement(reopened.daemon.db,config.worktreeRoot).projects();
          assert.equal(projects.records.length,2);
          assert.equal(projects.records.filter(project=>project.current).length,1);
          record.projectSwitch={dialog:'synthetic-confirmation',selectedRootMatches:true,reopenedCore:true,registeredProjects:projects.records.length};
        }finally{await reopened.close();}
        writeFileSync(join(evidence,`${prefix}_project_switch_smoke.json`),JSON.stringify(record.projectSwitch,null,2));
        record.passed=true;prospectiveRecord=record;
      }
    }else{
      await evaluate('setTimeout(() => p11Electron.app.quit(), 100); true');
      ws.close();
      await until(() => exited);
      record.exitCode = await exit; record.passed = record.exitCode === 0;
      assert.equal(record.passed, true);
      prospectiveRecord = record;
    }
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
