import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, lstatSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { stopProcessTree } from '../../daemon/scripts/process-lifecycle.mjs';

// Run only after the parent explicitly freezes the guarded application sources.
if (!process.argv.includes('--run')) throw Error('Pass --run only after the source-freeze readiness signal');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(root, 'evidence/integrations/S4/default-startup/compositor1');
assert.equal(existsSync(out), false, 'This bounded attempt already has evidence; never overwrite it');
mkdirSync(out, { recursive: true });
const owned = mkdtempSync(join(tmpdir(), 'cue-default-startup-'));
const userData = join(owned, 'data'), workspace = join(owned, 'workspace');
mkdirSync(userData); mkdirSync(workspace);
const require = createRequire(import.meta.url);
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const sources = ['package.json', 'app/start.mjs', 'app/guarded-entry.mjs', 'app/installation-identity.mjs', 'app/main.mjs',
  'app/core.mjs', 'app/first-run.mjs', 'app/protected-installation.mjs', 'app/ipc.mjs', 'app/preload.cjs',
  'app/renderer/index.html', 'app/renderer/renderer.js', 'app/renderer/styles.css', 'scripts/reuse/default-startup-electron-proof.mjs'];
const hashes = () => Object.fromEntries(sources.map(path => [path, sha(join(root, path))]));
const before = hashes();
assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).main, 'app/start.mjs');
const hook = join(owned, 'observe.cjs');
writeFileSync(hook, `
const {writeFileSync}=require('node:fs');
const {join}=require('node:path');
const owned=${JSON.stringify(owned)}, out=${JSON.stringify(out)};
setImmediate(()=>{try {
const {app}=require('electron');
app.setPath('userData',join(owned,'electron-profile'));
app.disableHardwareAcceleration();
let record={scope:'Actual electron . package entry, observer hook injected before entry. Not qualification or fresh closure proof.',inferenceCalls:0},timer;
const save=()=>writeFileSync(join(out,'window.json'),JSON.stringify(record,null,2));
app.on('before-quit',()=>{record.beforeQuit=true;save();});
app.on('will-quit',()=>{record.willQuit=true;clearTimeout(timer);save();});
timer=setTimeout(()=>{record.failure='startup timeout';save();app.exit(124);},55000);
app.on('browser-window-created',(_event,win)=>{
 win.webContents.once('did-finish-load',()=>{void(async()=>{
  try {
   const invoke=code=>win.webContents.executeJavaScript(code);
   const end=Date.now()+10000;
   while(await invoke("document.querySelector('#local-json-save').disabled")){if(Date.now()>end)throw Error('setup read timeout');await new Promise(r=>setTimeout(r,25));}
   const setup=await invoke("window.cue.localJsonSetup({operation:'read'})");
   const selection=await invoke("window.cue.selectionPreferences()");
   if(setup.configured||setup.revision!==null||setup.enabled||setup.available||setup.restartRequired)throw Error('initial settings unexpectedly active');
   record.setup=setup;record.selection=selection;
   record.renderer=await invoke("({url:location.href,node:typeof process,api:Object.keys(window.cue).sort(),template:document.querySelector('#task-template').value,stopHidden:document.querySelector('#stop').hidden,approveDisabled:document.querySelector('#approve').disabled,status:document.querySelector('#local-json-status').textContent})");
   if(record.renderer.node!=='undefined'||record.renderer.template!=='general'||!record.renderer.stopHidden||!record.renderer.approveDisabled)throw Error('initial renderer mismatch');
   const prefs=win.webContents.getLastWebPreferences();
   record.window={nodeIntegration:prefs.nodeIntegration,contextIsolation:prefs.contextIsolation,sandbox:prefs.sandbox,preload:prefs.preload};
   if(prefs.nodeIntegration||!prefs.contextIsolation||!prefs.sandbox)throw Error('window boundary mismatch');
   await invoke("document.querySelector('#local-json-setup').open=true;true");
   record.startupPassed=true;
   try {
    await invoke("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))");
    record.window.visible=win.isVisible();
    if(!record.window.visible)throw Error('original application window is not visible');
    win.webContents.debugger.attach('1.3');
    try {const capture=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,'startup.png'),Buffer.from(capture.data,'base64'));record.screenshotPassed=true;}
    finally {win.webContents.debugger.detach();}
   }catch(error){record.screenshotFailure=String(error);}
   record.passed=record.screenshotPassed===true;
  }catch(error){record.failure=String(error);}
  finally {save();app.quit();}
 })();});
});
}catch(error){writeFileSync(join(out,'observer-failure.json'),JSON.stringify({failure:String(error)}));process.exit(1);}});
`);
const env = { ...process.env, CUE_USER_DATA: userData, CUE_WORKTREE_ROOT: workspace,
  NODE_OPTIONS: `--require=${JSON.stringify(hook)}` };
for (const key of Object.keys(env)) if ((key.startsWith('CUE_') && !['CUE_USER_DATA', 'CUE_WORKTREE_ROOT'].includes(key)) || key === 'ELECTRON_RUN_AS_NODE') delete env[key];
const child = spawn(require('electron'), ['.'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '', exitCode = null, failure;
const append = bytes => { log = (log + bytes).slice(-1048576); };
child.stdout.on('data', append); child.stderr.on('data', append);
const timer = setTimeout(() => { void stopProcessTree(child).catch(error => { log += String(error); }); }, 65000);
try {
  exitCode = await new Promise((done, reject) => { child.once('close', done); child.once('error', reject); });
  assert.equal(exitCode, 0);
  const window = JSON.parse(readFileSync(join(out, 'window.json'), 'utf8'));
  assert.equal(window.willQuit, true);
  const config = JSON.parse(readFileSync(join(userData, 'cue-config.json'), 'utf8'));
  assert.equal(resolve(config.ledgerPath), join(userData, 'cue-ledger.sqlite'));
  assert.equal(resolve(config.worktreeRoot), workspace);
  const db = new DatabaseSync(config.ledgerPath, { readOnly: true });
  let counts;
  try {
    counts = Object.fromEntries(['task', 'session_handle', 'orchestration_attempt', 'local_host_settings_snapshot', 'local_invocation_budget']
      .map(table => [table, db.prepare('SELECT count(*) AS n FROM ' + table).get().n]));
    for (const value of Object.values(counts)) assert.equal(value, 0);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally { db.close(); }
  assert.deepEqual(hashes(), before);
  writeFileSync(join(out, 'result.json'), JSON.stringify({ passed: window.passed === true && window.startupPassed === true, exitCode, nativeSQLite: 'application startup and post-exit integrity check passed',
    counts, sourceHashes: before, screenshotSha256: existsSync(join(out, 'startup.png')) ? sha(join(out, 'startup.png')) : null, observerSha256: sha(hook),
    scope: 'Settings-absent startup, read-only real preload IPC and graceful quit. No task preparation, execution, active Stop test, provider call or qualification. QA hook changes process initialization; not fresh closure proof.' }, null, 2));
  assert.equal(window.startupPassed, true); assert.equal(window.screenshotPassed, true);
} catch (error) { failure = error; }
finally {
  clearTimeout(timer);
  await stopProcessTree(child);
  writeFileSync(join(out, 'process.log'), log);
  writeFileSync(join(out, 'process.json'), JSON.stringify({ pid: child.pid, exitCode, closed: child.exitCode !== null || child.signalCode !== null, failure: failure ? String(failure) : null }, null, 2));
  assert.equal(dirname(resolve(owned)), resolve(tmpdir())); assert(basename(owned).startsWith('cue-default-startup-'));
  assert.equal(lstatSync(owned).isSymbolicLink(), false); assert.equal(realpathSync(owned).toLowerCase(), resolve(owned).toLowerCase());
  rmSync(owned, { recursive: true, force: true });
}
if (failure) throw failure;
console.log('PASS actual settings-absent package startup; no execution or model calls');
