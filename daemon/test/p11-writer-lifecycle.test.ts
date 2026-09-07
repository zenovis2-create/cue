import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import { reconcileInterruptedWrites } from '../src/recovery.js';
import { openLedger } from '../src/ledger.js';

const roots: string[] = [];
const daemons: AppDaemon[] = [];
const children: number[] = [];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function temp() { const root = mkdtempSync(join(tmpdir(), 'cue-p11-writer-')); roots.push(root); return root; }
function alive(pid: number) { try { process.kill(pid, 0); return true; } catch { return false; } }
async function until(check: () => boolean, ms = 15000) { const end = Date.now() + ms; while (!check()) { if (Date.now() >= end) throw new Error('FAIL: lifecycle timeout'); await delay(50); } }
afterEach(() => {
  for (const pid of children.splice(0)) if (alive(pid)) spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  for (const daemon of daemons.splice(0)) if (daemon.db.open) daemon.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});
function seeded() {
  const root = temp(); const worktree = join(root, 'worktree'); mkdirSync(worktree);
  const config = initializeConfig(join(root, 'state'), { worktreeRoot: worktree });
  const daemon = new AppDaemon(config); daemons.push(daemon); const now = new Date().toISOString();
  daemon.db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t', 'running', null, now);
  daemon.db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('e', worktree, '[]', now);
  daemon.db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r', 't', 'e', 1, now);
  daemon.db.prepare('INSERT INTO workspace_write_lease VALUES(?,?,?)').run(worktree, 'r', now);
  return { root, worktree, config, daemon };
}
function assertReleased(daemon: AppDaemon) {
  expect(daemon.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
  expect(daemon.db.prepare("SELECT write_in_progress FROM run WHERE id='r'").get()).toEqual({ write_in_progress: 0 });
}

describe.skipIf(process.platform !== 'win32')('P11 writer lifecycle', () => {
  it('refuses writable worktrees containing or inside the trusted Cue runtime', () => {
    const root = temp();
    for (const [index, worktree] of [resolve('..'), resolve('../app'), resolve('src')].entries()) {
      const config = initializeConfig(join(root, `state-${index}`), { worktreeRoot: worktree });
      expect(() => createCueCore(config)).toThrow(/worktree overlaps trusted Cue runtime/);
    }
  });
  for (const mode of ['normal completion', 'controller crash', 'worker hard-kill']) {
    it(`${mode} releases the real runtime lease before another writer runs`, async () => {
      const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source'); mkdirSync(worktree); mkdirSync(sourceHome);
      const vendor = join(root, 'vendor'); mkdirSync(vendor); const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
      writeFileSync(join(sourceHome, 'auth.json'), '{}');
      const server = join(root, 'controller.cjs');
      const command = mode === 'worker hard-kill'
        ? "[IO.File]::WriteAllText([IO.Path]::Combine([Environment]::CurrentDirectory,'ready.txt'),'ready');Start-Sleep -Seconds 120"
        : "[IO.File]::WriteAllText([IO.Path]::Combine([Environment]::CurrentDirectory,'result.txt'),'done')";
      writeFileSync(server, `const rl=require('node:readline').createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
rl.on('line',l=>{const m=JSON.parse(l);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'t'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'v'}}});${mode === 'controller crash' ? 'process.exit(23);' : `send({id:7,method:'item/tool/call',params:{threadId:'t',turnId:'v',callId:'c',namespace:null,tool:'cue_workspace',arguments:{program:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command',${JSON.stringify(command)}],timeoutMs:120000}}});`}}else if(m.id===7)send({method:'turn/completed',params:{threadId:'t',turn:{id:'v',status:${JSON.stringify(mode === 'worker hard-kill' ? 'failed' : 'completed')}}}});});`);
      const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
        binary, codexHome: sourceHome, controllerArgs: [server], requestTimeoutMs: 5000, runTimeoutMs: 20000,
      }); daemons.push(core.daemon);
      const run = core.prepareGoal('Create result.txt', 1); core.approve(run.runId); core.execute(run.runId);
      if (mode === 'worker hard-kill') {
        await until(() => existsSync(join(worktree, 'ready.txt')));
        const row = core.daemon.db.prepare("SELECT s.pid FROM session_handle s JOIN session_runtime r ON r.handle=s.handle WHERE r.role='tool_worker' ORDER BY s.rowid DESC LIMIT 1").get() as { pid: number };
        expect(alive(row.pid)).toBe(true); children.push(row.pid);
        spawnSync('taskkill.exe', ['/PID', String(row.pid), '/T', '/F'], { windowsHide: true });
        await until(() => !alive(row.pid));
      }
      await until(() => core.completion(run.taskId).state !== 'running', 25000);
      expect(core.daemon.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
      expect(core.daemon.db.prepare('SELECT write_in_progress FROM run WHERE id=?').get(run.runId)).toEqual({ write_in_progress: 0 });
      expect(core.completion(run.taskId).state).toBe(mode === 'normal completion' ? 'completed' : 'blocked');
      if (mode === 'controller crash') expect(core.completion(run.taskId).blockedReason).toBe('crash');
      core.close();
    }, 45000);
  }
  it('user stop releases the write lease immediately after stopping the owned runtime', () => {
    const { daemon } = seeded(); let stopped = false;
    (daemon as any).own('r', { session: { pid: 999999 }, stop() { stopped = true; } });
    expect(daemon.stop('r')).toBe(true); expect(stopped).toBe(true);
    assertReleased(daemon);
    expect(daemon.db.prepare("SELECT state,blocked_reason FROM task WHERE id='t'").get()).toEqual({ state: 'blocked', blocked_reason: 'cancelled' });
  });
  it('daemon crash releases every lease and refuses automatic resume', () => {
    const { daemon } = seeded(); (daemon as any).own('r', { session: { pid: 999999 }, stop() {} });
    daemon.crash(); assertReleased(daemon);
    expect(daemon.status).toBe('blocked/crash');
    expect(daemon.db.prepare("SELECT state,blocked_reason FROM task WHERE id='t'").get()).toEqual({ state: 'blocked', blocked_reason: 'crash' });
  });
  it('reconciliation releases the interrupted writer lease and records blocked crash', () => {
    const { daemon, worktree } = seeded();
    expect(reconcileInterruptedWrites(daemon.db, worktree, () => '')).toBe(1);
    assertReleased(daemon);
    expect(daemon.db.prepare("SELECT state,blocked_reason FROM task WHERE id='t'").get()).toEqual({ state: 'blocked', blocked_reason: 'crash' });
    expect(daemon.db.prepare("SELECT outcome FROM recovery_attempt WHERE run_id='r'").get()).toEqual({ outcome: 'blocked_no_auto_resume' });
  });
  it('refuses a second live daemon using another ledger for the same canonical worktree', () => {
    const { root, worktree, daemon } = seeded();
    const config = initializeConfig(join(root, 'other-state'), { worktreeRoot: worktree.toUpperCase() });
    let second: AppDaemon | undefined;
    try { expect(() => { second = new AppDaemon(config); }).toThrow(/worktree.*owned/i); }
    finally { second?.close(); }
    expect(daemon.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 1 });
  });
  it('a failed startup reconciliation cannot strand a new live ownership record', () => {
    const { daemon, config } = seeded();
    daemon.db.exec("CREATE TRIGGER reject_recovery BEFORE UPDATE ON task BEGIN SELECT RAISE(ABORT, 'forced startup recovery failure'); END");
    daemon.db.close();
    expect(() => new AppDaemon(config)).toThrow(/forced startup recovery failure/);
    const repair = openLedger(config.ledgerPath); repair.exec('DROP TRIGGER reject_recovery'); repair.close();
    const restarted = new AppDaemon(config); daemons.push(restarted); assertReleased(restarted);
    expect(restarted.db.prepare("SELECT state,blocked_reason FROM task WHERE id='t'").get()).toEqual({ state: 'blocked', blocked_reason: 'crash' });
  });
  it('parent death kills the real AppContainer worker and restart releases the lease without resuming', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); mkdirSync(worktree);
    const config = initializeConfig(join(root, 'state'), { worktreeRoot: worktree });
    const ready = join(root, 'ready.json'); const harness = join(root, 'parent.mjs');
    const coreUrl = pathToFileURL(resolve('../app/core.mjs')).href;
    const workerUrl = pathToFileURL(resolve('dist/src/worker-enforcement.js')).href;
    writeFileSync(harness, `import {AppDaemon} from ${JSON.stringify(coreUrl)};
import {launchAppContainerWorker} from ${JSON.stringify(workerUrl)};
import {writeFileSync} from 'node:fs';
const config=${JSON.stringify(config)}; const daemon=new AppDaemon(config); const db=daemon.db; const now=new Date().toISOString();
db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t','running',null,now);
db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('e',config.worktreeRoot,'[]',now);
db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r','t','e',1,now);
db.prepare('INSERT INTO workspace_write_lease VALUES(?,?,?)').run(config.worktreeRoot,'r',now);
const env={run_id:'r',worktree_realpath:config.worktreeRoot,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded',allowed_actions:['command','file_change']};
const worker=launchAppContainerWorker(db,env,{cwd:config.worktreeRoot,task_id:'t',run_id:'r'},{executable:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command','Start-Sleep -Seconds 120'],cwd:config.worktreeRoot,timeoutMs:125000});
setInterval(()=>{if(worker.session.pid!==worker.child.pid)writeFileSync(${JSON.stringify(ready)},JSON.stringify({worker:worker.session.pid,wrapper:worker.child.pid}));},100);`);
    const parent = spawn(process.execPath, [harness], { stdio: 'ignore', windowsHide: true }); children.push(parent.pid!);
    await until(() => existsSync(ready));
    const pids = JSON.parse(readFileSync(ready, 'utf8')); children.push(pids.worker, pids.wrapper);
    expect(alive(parent.pid!)).toBe(true); expect(alive(pids.worker)).toBe(true);
    spawnSync('taskkill.exe', ['/PID', String(parent.pid), '/F'], { windowsHide: true });
    await until(() => !alive(parent.pid!) && !alive(pids.worker) && !alive(pids.wrapper));
    const restarted = new AppDaemon(config); daemons.push(restarted); assertReleased(restarted);
    expect(restarted.db.prepare("SELECT state,blocked_reason FROM task WHERE id='t'").get()).toEqual({ state: 'blocked', blocked_reason: 'crash' });
    expect(restarted.db.prepare("SELECT outcome FROM recovery_attempt WHERE run_id='r'").get()).toEqual({ outcome: 'blocked_no_auto_resume' });
  }, 40000);
});

