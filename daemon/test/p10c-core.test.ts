import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';

const roots: string[] = [];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function temp(): string { const root = mkdtempSync(join(tmpdir(), 'cue-p10c-core-')); roots.push(root); return root; }
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });
async function terminalCard(core: ReturnType<typeof createCueCore>, taskId: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const card = core.completion(taskId);
    if (card.state !== 'running') return card;
    await delay(50);
  }
  throw new Error('core terminal state timeout');
}
async function waitUntil(check: () => boolean, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(50);
  }
  throw new Error('condition timeout');
}
function processAlive(pid: number): boolean {
  const result = spawnSync('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
  return result.status === 0 && String(result.stdout).includes(`\"${pid}\"`);
}

function fakeController(): string {
  return String.raw`
const readline=require('node:readline');
const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);
 if(m.method==='initialize')send({id:m.id,result:{}});
 else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'tc'}}});
 else if(m.method==='turn/start'){
  const goal=m.params.input[0].text.split('Goal: ').at(-1);
  const content=Buffer.from(goal,'utf8').toString('base64');const script="$p=[IO.Path]::Combine([Environment]::CurrentDirectory,'core-result.txt');[IO.File]::WriteAllBytes($p,[Convert]::FromBase64String('"+content+"'))";
  send({id:m.id,result:{turn:{id:'vc'}}});send({method:'item/tool/call',id:44,params:{threadId:'tc',turnId:'vc',callId:'cc',namespace:null,tool:'cue_workspace',arguments:{program:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command',script]}}});
 } else if(m.id===44){send({method:'item/completed',params:{threadId:'tc',turnId:'vc',item:{type:'agentMessage',text:'done'}}});send({method:'turn/completed',params:{threadId:'tc',turn:{id:'vc',status:'completed'}}});}
});
`;
}

function wrongContentController(): string {
  return String.raw`
const readline=require('node:readline');
const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);
 if(m.method==='initialize')send({id:m.id,result:{}});
 else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'tw'}}});
 else if(m.method==='turn/start'){
  const script="$p=[IO.Path]::Combine([Environment]::CurrentDirectory,'result.txt');[IO.File]::WriteAllText($p,'WRONG')";
  send({id:m.id,result:{turn:{id:'vw'}}});send({method:'item/tool/call',id:45,params:{threadId:'tw',turnId:'vw',callId:'cw',namespace:null,tool:'cue_workspace',arguments:{program:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command',script]}}});
 } else if(m.id===45){send({method:'item/completed',params:{threadId:'tw',turnId:'vw',item:{type:'agentMessage',text:'result.txt complete'}}});send({method:'turn/completed',params:{threadId:'tw',turn:{id:'vw',status:'completed'}}});}
});
`;
}

function failingController(): string {
  return String.raw`
const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'tf'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'vf'}}});send({method:'item/tool/call',id:9,params:{threadId:'tf',turnId:'vf',callId:'cf',namespace:null,tool:'cue_workspace',arguments:{program:'cmd.exe',args:['/d','/c','exit 9']}}});}else if(m.id===9)send({method:'turn/completed',params:{threadId:'tf',turn:{id:'vf',status:'failed'}}});});
`;
}

function longRunningController(): string {
  return String.raw`
const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'ts'}}});else if(m.method==='turn/start'){const script="$p=[IO.Path]::Combine([Environment]::CurrentDirectory,'started.txt');[IO.File]::WriteAllText($p,'started');Start-Sleep -Seconds 120";send({id:m.id,result:{turn:{id:'vs'}}});send({method:'item/tool/call',id:7,params:{threadId:'ts',turnId:'vs',callId:'cs',namespace:null,tool:'cue_workspace',arguments:{program:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command',script],timeoutMs:120000}}});}});
`;
}

function crashingController(): string {
  return String.raw`
const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'crash-thread'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'crash-turn'}}});setTimeout(()=>process.exit(23),10);}});`;
}

describe.skipIf(process.platform !== 'win32')('Phase 10-C standalone core integration', () => {
  it('routes an approved arbitrary goal through host controller and AppContainer worker', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor);
    writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'fake-controller.cjs'); writeFileSync(server, fakeController());
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, codexHome: sourceHome, controllerArgs: [server], requestTimeoutMs: 5_000,
    });
    const goal = '임의 목표를 실제 격리 작업자로 수행한다';
    const prepared = core.prepareGoal(goal, 1);
    const allowedActions = prepared.envelope.allowed_actions as string[];
    expect(allowedActions).toEqual(expect.arrayContaining(['command', 'file_change']));
    expect(allowedActions.some((action: string) => action.startsWith('goal:'))).toBe(true);
    core.approve(prepared.runId);
    const initial = core.execute(prepared.runId);
    expect(initial.state).toBe('running');
    const card = await terminalCard(core, prepared.taskId);
    const roles = core.daemon.db.prepare('SELECT role FROM session_runtime ORDER BY rowid').all();
    core.close();

    expect(card).toMatchObject({ state: 'completed', isolatedToolCalls: 1, resultSummary: 'done' });
    expect(card.workerPids).toHaveLength(3);
    expect(readFileSync(join(worktree, 'core-result.txt'), 'utf8')).toContain(goal);
    expect(roles).toEqual([
      { role: 'controller' },
      { role: 'tool_worker' },
      { role: 'tool_worker' },
      { role: 'tool_worker' },
    ]);
  }, 90_000);

  it('relaunches real controller and AppContainer worker PIDs before autonomy 3 escalates', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor);
    writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'failing-controller.cjs'); writeFileSync(server, failingController());
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, codexHome: sourceHome, controllerArgs: [server], requestTimeoutMs: 5_000,
    });
    const prepared = core.prepareGoal('always fails after a real isolated tool call', 3);
    core.approve(prepared.runId); core.execute(prepared.runId);
    const card = await terminalCard(core, prepared.taskId);
    // Process identity on Windows is (pid, start_time), never pid alone: the OS
    // recycles pids, so two genuinely distinct processes can share one. Counting
    // distinct pids alone would report a phantom relaunch failure.
    const sessions = core.daemon.db.prepare('SELECT s.pid,s.start_time,r.role FROM session_handle s JOIN session_runtime r ON r.handle=s.handle ORDER BY s.rowid').all() as Array<{ pid: number; start_time: string; role: string }>;
    const recovery = Number((core.daemon.db.prepare('SELECT count(*) AS n FROM recovery_attempt_v2 WHERE run_id=?').get(prepared.runId) as { n: number }).n);
    core.close();

    const identity = (row: { pid: number; start_time: string }) => `${row.pid}@${row.start_time}`;
    const controllers = sessions.filter(row => row.role === 'controller').map(identity);
    const workers = sessions.filter(row => row.role === 'tool_worker').map(identity);
    expect(card).toMatchObject({ state: 'blocked', blockedReason: 'human_required' });
    expect(controllers).toHaveLength(4);
    expect(workers).toHaveLength(8);
    expect(new Set(controllers).size).toBe(4);
    expect(new Set(workers).size).toBe(8);
    expect(recovery).toBe(4);
  }, 90_000);

  it('stops both the host controller and the live AppContainer worker', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor);
    writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'long-controller.cjs'); writeFileSync(server, longRunningController());
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, codexHome: sourceHome, controllerArgs: [server], requestTimeoutMs: 5_000,
    });
    const prepared = core.prepareGoal('stop tracer', 1);
    core.approve(prepared.runId); core.execute(prepared.runId);
    await waitUntil(() => {
      const n = core.daemon.db.prepare("SELECT count(*) AS n FROM session_runtime WHERE role='tool_worker'").get() as { n: number };
      return n.n === 1;
    });
    await waitUntil(() => {
      try { return readFileSync(join(worktree, 'started.txt'), 'utf8') === 'started'; } catch { return false; }
    });
    const sessions = core.daemon.db.prepare('SELECT s.pid,r.role FROM session_handle s JOIN session_runtime r ON r.handle=s.handle ORDER BY s.rowid').all() as Array<{ pid: number; role: string }>;
    expect(core.stop(prepared.runId)).toBe(true);
    await waitUntil(() => sessions.every(row => !processAlive(row.pid)));
    const card = core.completion(prepared.taskId);
    await delay(200);
    core.close();

    expect(card).toMatchObject({ state: 'blocked', blockedReason: 'cancelled' });
    expect(sessions.map(row => row.role)).toEqual(['controller', 'tool_worker', 'tool_worker']);
  }, 90_000);

  it('blocks a controller crash without automatically resuming it', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'crashing-controller.cjs'); writeFileSync(server, crashingController());
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, codexHome: sourceHome, controllerArgs: [server], requestTimeoutMs: 5_000, runTimeoutMs: 10_000,
    });
    const prepared = core.prepareGoal('controller crash must require a human', 3); core.approve(prepared.runId); core.execute(prepared.runId);
    const card = await terminalCard(core, prepared.taskId);
    const controllers = Number((core.daemon.db.prepare("SELECT count(*) AS n FROM session_handle s JOIN session_runtime r ON r.handle=s.handle WHERE s.run_id=? AND r.role='controller'").get(prepared.runId) as { n: number }).n);
    const recoveries = Number((core.daemon.db.prepare('SELECT count(*) AS n FROM recovery_attempt_v2 WHERE run_id=?').get(prepared.runId) as { n: number }).n);
    core.close();
    expect(card).toMatchObject({ state: 'blocked', blockedReason: 'crash' });
    expect(controllers).toBe(1);
    expect(recoveries).toBe(0);
  }, 30_000);

  it('reconciles a previously running write as blocked/crash without auto-resume on restart', () => {
    const root = temp(); const worktree = join(root, 'worktree'); mkdirSync(worktree);
    const config = initializeConfig(join(root, 'state'), { worktreeRoot: worktree });
    const first = new AppDaemon(config); const now = new Date().toISOString();
    first.db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('crashed-task', 'running', null, now);
    first.db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('crashed-envelope', worktree, '[]', now);
    first.db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('crashed-run', 'crashed-task', 'crashed-envelope', 1, now);
    first.db.close();

    const restarted = new AppDaemon(config);
    const task = restarted.db.prepare('SELECT state,blocked_reason FROM task WHERE id=?').get('crashed-task');
    const recovery = restarted.db.prepare('SELECT outcome FROM recovery_attempt WHERE run_id=? ORDER BY rowid DESC LIMIT 1').get('crashed-run');
    const sessions = Number((restarted.db.prepare('SELECT count(*) AS n FROM session_handle WHERE run_id=?').get('crashed-run') as { n: number }).n);
    restarted.close();
    expect(task).toEqual({ state: 'blocked', blocked_reason: 'crash' });
    expect(recovery).toEqual({ outcome: 'blocked_no_auto_resume' });
    expect(sessions).toBe(0);
  });

  it('fences a verified live session before reconciling an interrupted run on startup', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); mkdirSync(worktree);
    const config = initializeConfig(join(root, 'state'), { worktreeRoot: worktree });
    const started = new Date().toISOString();
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Start-Sleep -Seconds 120'], { stdio: 'ignore', windowsHide: true });
    const first = new AppDaemon(config); const now = new Date().toISOString();
    first.db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('fence-task', 'running', null, now);
    first.db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('fence-envelope', worktree, '[]', now);
    first.db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('fence-run', 'fence-task', 'fence-envelope', 1, now);
    first.db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run('fence-handle', child.pid, started, worktree, 'fence-task', 'fence-run');
    first.db.prepare('INSERT INTO session_runtime VALUES(?,?,?,?,?)').run('fence-handle', 'controller', 'host-model-only', null, now);
    first.close();
    const restarted = new AppDaemon(config);
    const deadline = Date.now() + 5_000;
    while (processAlive(child.pid!) && Date.now() < deadline) await delay(50);
    const alive = processAlive(child.pid!);
    if (alive) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F']);
    const fence = restarted.db.prepare("SELECT content FROM artifact WHERE run_id='fence-run' AND kind='startup_fence'").get();
    restarted.close();
    expect(alive).toBe(false);
    expect(fence).toEqual({ content: 'terminated_verified_session' });
  }, 15_000);

  it('refuses to kill a reused PID whose process start time does not match the ledger identity', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); mkdirSync(worktree);
    const config = initializeConfig(join(root, 'state'), { worktreeRoot: worktree });
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Start-Sleep -Seconds 120'], { stdio: 'ignore', windowsHide: true });
    const first = new AppDaemon(config); const now = new Date().toISOString();
    first.db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('reuse-task', 'running', null, now);
    first.db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('reuse-envelope', worktree, '[]', now);
    first.db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('reuse-run', 'reuse-task', 'reuse-envelope', 1, now);
    first.db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run('reuse-handle', child.pid, '2000-01-01T00:00:00.000Z', worktree, 'reuse-task', 'reuse-run');
    first.db.prepare('INSERT INTO session_runtime VALUES(?,?,?,?,?)').run('reuse-handle', 'controller', 'host-model-only', null, now);
    first.close();
    const restarted = new AppDaemon(config);
    await delay(100);
    const alive = processAlive(child.pid!);
    const fence = restarted.db.prepare("SELECT content FROM artifact WHERE run_id='reuse-run' AND kind='startup_fence'").get();
    if (alive) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F']);
    restarted.close();
    expect(alive).toBe(true);
    expect(fence).toEqual({ content: 'pid_identity_mismatch_refused' });
  }, 15_000);

  it('blocks completion immediately when the controller credential-home cleanup fails', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const binarySha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
    const fakeLaunch = () => ({
      child: { pid: 77101 },
      session: { handle: 'cleanup-controller', pid: 77101, startTime: new Date().toISOString(), cwd: worktree, task_id: 'ignored', run_id: 'ignored' },
      stop() {},
      done: Promise.resolve({
        threadId: 'cleanup-thread', turnId: 'cleanup-turn', status: 'failed', finalMessage: 'credential cleanup failed',
        controllerPid: 77101, workerPids: [], successfulToolCalls: 1, controllerStderr: '',
        error: 'credential cleanup failed: forced test failure', failureKind: 'cleanup',
      }),
    });
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, binarySha256, codexHome: sourceHome, launchHost: fakeLaunch,
    } as any);
    const prepared = core.prepareGoal('must not complete with credential residue', 3);
    core.approve(prepared.runId); core.execute(prepared.runId);
    const card = await terminalCard(core, prepared.taskId);
    const artifact = core.daemon.db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='credential_cleanup_failed'").get(prepared.runId);
    core.close();
    expect(card).toMatchObject({ state: 'blocked', blockedReason: 'credential_cleanup' });
    expect(artifact).toEqual({ content: 'credential cleanup failed: forced test failure' });
  });

  it('blocks when cleanup fails after controller launch setup throws', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const binarySha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, binarySha256, codexHome: sourceHome,
      launchHost() { throw new Error('controller setup failed'); },
      cleanupHome() { throw new Error('forced rollback cleanup failure'); },
    } as any);
    const prepared = core.prepareGoal('launch setup cleanup must be enforced', 3);
    core.approve(prepared.runId); core.execute(prepared.runId);
    const card = await terminalCard(core, prepared.taskId);
    const artifact = core.daemon.db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='credential_cleanup_failed'").get(prepared.runId);
    core.close();
    expect(card).toMatchObject({ state: 'blocked', blockedReason: 'credential_cleanup' });
    expect(artifact).toEqual({ content: 'credential cleanup failed: forced rollback cleanup failure' });
  });

  it('blocks a model-completed run when independent goal verification finds no relevant workspace change', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const binarySha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
    const fakeLaunch = () => ({
      child: { pid: 77102 }, session: { handle: 'verification-controller', pid: 77102 }, stop() {},
      done: Promise.resolve({
        threadId: 'verify-thread', turnId: 'verify-turn', status: 'completed', finalMessage: 'done', controllerPid: 77102,
        workerPids: [77103], successfulToolCalls: 1, controllerStderr: '',
        goalVerification: { passed: false, reason: 'workspace_unchanged', changedPaths: [] },
      }),
    });
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, binarySha256, codexHome: sourceHome, launchHost: fakeLaunch,
    } as any);
    const prepared = core.prepareGoal('create an output that was never created', 3);
    core.approve(prepared.runId); core.execute(prepared.runId);
    const card = await terminalCard(core, prepared.taskId);
    const verification = core.daemon.db.prepare("SELECT verdict,evidence FROM verification WHERE run_id=? AND check_name='goal_relevant_verification'").get(prepared.runId) as { verdict: string; evidence: string };
    core.close();
    expect(card).toMatchObject({ state: 'blocked', blockedReason: 'verification_failed' });
    expect(verification.verdict).toBe('FAIL');
    expect(JSON.parse(verification.evidence)).toMatchObject({ reason: 'workspace_unchanged', changedPaths: [] });
  });

  it('blocks a model-completed run when an explicitly requested exact file content is wrong', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'wrong-content-controller.cjs'); writeFileSync(server, wrongContentController());
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, codexHome: sourceHome, controllerArgs: [server], requestTimeoutMs: 5_000,
    });
    const prepared = core.prepareGoal('Create result.txt with exactly this UTF-8 text and no extra characters: RIGHT', 3);
    core.approve(prepared.runId); core.execute(prepared.runId);
    const card = await terminalCard(core, prepared.taskId);
    const verification = core.daemon.db.prepare("SELECT verdict,evidence FROM verification WHERE run_id=? AND check_name='goal_relevant_verification'").get(prepared.runId) as { verdict: string; evidence: string };
    core.close();
    expect(card).toMatchObject({ state: 'blocked', blockedReason: 'verification_failed' });
    expect(verification.verdict).toBe('FAIL');
    expect(JSON.parse(verification.evidence)).toMatchObject({ reason: 'expected_content_mismatch', changedPaths: ['result.txt'] });
  }, 30_000);

  it('fails closed before launch when the host Codex binary hash does not match the pin', () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary,
      binarySha256: '0'.repeat(64),
      codexHome: sourceHome,
      controllerArgs: [join(worktree, 'must-not-launch.cjs')],
    });
    const prepared = core.prepareGoal('This run must not launch', 3);
    core.approve(prepared.runId);
    const card = core.execute(prepared.runId);
    const controllers = Number((core.daemon.db.prepare("SELECT count(*) AS n FROM session_runtime WHERE role='controller'").get() as { n: number }).n);
    core.close();
    expect(card).toMatchObject({ state: 'blocked', blockedReason: 'launch_configuration' });
    expect(controllers).toBe(0);
  });

  it('queues a second write run for the same worktree and starts it after the first releases', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const binarySha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
    const pending: Array<(value: any) => void> = [];
    const launchHost = vi.fn((_db, owner) => ({
      child: { pid: 78000 + pending.length },
      session: { handle: `lease-${pending.length}`, pid: 78000 + pending.length, cwd: owner.cwd, task_id: owner.task_id, run_id: owner.run_id },
      // A faithful double: a real runtime settles its teardown after stop(),
      // which is what the close() barrier waits on.
      stop() { const settle = pending.pop(); settle?.({ status: 'stopped' }); },
      done: new Promise(resolve => pending.push(resolve)),
    }));
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, binarySha256, codexHome: sourceHome, launchHost,
    } as any);
    const first = core.prepareGoal('Create first.txt', 1); const second = core.prepareGoal('Create second.txt', 1);
    core.approve(first.runId); core.approve(second.runId);

    expect(core.execute(first.runId).state).toBe('running');
    expect(core.execute(second.runId).state).toBe('queued');
    expect(launchHost).toHaveBeenCalledTimes(1);
    expect(core.daemon.db.prepare('SELECT worktree_realpath,run_id FROM workspace_write_lease').all()).toEqual([
      { worktree_realpath: worktree, run_id: first.runId },
    ]);

    pending[0]!({
      threadId: 'thread-first', turnId: 'turn-first', status: 'completed', finalMessage: 'first.txt complete',
      controllerPid: 78000, workerPids: [78010], successfulToolCalls: 1, controllerStderr: '',
      goalVerification: { passed: true, reason: 'workspace_changed', changedPaths: ['first.txt'] },
    });
    await waitUntil(() => core.completion(first.taskId).state === 'completed');
    await waitUntil(() => core.completion(second.taskId).state === 'running' && launchHost.mock.calls.length === 2);
    expect(core.daemon.db.prepare('SELECT worktree_realpath,run_id FROM workspace_write_lease').all()).toEqual([
      { worktree_realpath: worktree, run_id: second.runId },
    ]);

    pending[1]!({
      threadId: 'thread-second', turnId: 'turn-second', status: 'completed', finalMessage: 'second.txt complete',
      controllerPid: 78001, workerPids: [78011], successfulToolCalls: 1, controllerStderr: '',
      goalVerification: { passed: true, reason: 'workspace_changed', changedPaths: ['second.txt'] },
    });
    await waitUntil(() => core.completion(second.taskId).state === 'completed');
    expect(core.daemon.db.prepare('SELECT count(*) AS n FROM workspace_write_lease').get()).toEqual({ n: 0 });
    core.close();
    expect(launchHost).toHaveBeenCalledTimes(2);
  });

  it('cancels a queued write without launching it', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const binarySha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
    const pending: Array<(value: any) => void> = [];
    const launchHost = vi.fn((_db, owner) => ({
      child: { pid: 78100 + pending.length },
      session: { handle: `cancel-queue-${pending.length}`, pid: 78100 + pending.length, cwd: owner.cwd, task_id: owner.task_id, run_id: owner.run_id },
      // A faithful double: a real runtime settles its teardown after stop(),
      // which is what the close() barrier waits on.
      stop() { const settle = pending.pop(); settle?.({ status: 'stopped' }); },
      done: new Promise(resolve => pending.push(resolve)),
    }));
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, binarySha256, codexHome: sourceHome, launchHost,
    } as any);
    const first = core.prepareGoal('Create first.txt', 1); const queued = core.prepareGoal('Create queued.txt', 1);
    core.approve(first.runId); core.approve(queued.runId);
    core.execute(first.runId); core.execute(queued.runId);
    const stopped = core.stop(queued.runId);
    const queuedCard = core.completion(queued.taskId);
    pending[0]!({
      threadId: 'thread-first', turnId: 'turn-first', status: 'completed', finalMessage: 'first.txt complete',
      controllerPid: 78100, workerPids: [78110], successfulToolCalls: 1, controllerStderr: '',
      goalVerification: { passed: true, reason: 'workspace_changed', changedPaths: ['first.txt'] },
    });
    await waitUntil(() => core.completion(first.taskId).state === 'completed');
    await delay(100);
    const launchCount = launchHost.mock.calls.length;
    core.close();
    expect(stopped).toBe(true);
    expect(queuedCard).toMatchObject({ state: 'blocked', blockedReason: 'cancelled' });
    expect(launchCount).toBe(1);
  });

  it('blocks queued writes when the app closes so restart cannot strand them', async () => {
    let settleClose: ((value: unknown) => void) | undefined;
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const binarySha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
    const launchHost = vi.fn((_db, owner) => ({
      child: { pid: 78200 },
      session: { handle: 'close-queue', pid: 78200, cwd: owner.cwd, task_id: owner.task_id, run_id: owner.run_id },
      stop() { settleClose?.({ status: 'stopped' }); },
      done: new Promise(resolve => { settleClose = resolve; }),
    }));
    const config = initializeConfig(join(root, 'state'), { worktreeRoot: worktree });
    const core = createCueCore(config, undefined, { binary, binarySha256, codexHome: sourceHome, launchHost } as any);
    const first = core.prepareGoal('Create first.txt', 1); const queued = core.prepareGoal('Create queued.txt', 1);
    core.approve(first.runId); core.approve(queued.runId); core.execute(first.runId); core.execute(queued.runId);
    await core.close();

    const restarted = createCueCore(config, undefined, { binary, binarySha256, codexHome: sourceHome, launchHost } as any);
    const queuedCard = restarted.completion(queued.taskId);
    restarted.close();
    expect(queuedCard).toMatchObject({ state: 'blocked', blockedReason: 'app_closed' });
    expect(launchHost).toHaveBeenCalledTimes(1);
  });

  it('consumes an approved run exactly once before any controller can be launched twice', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'long-controller.cjs'); writeFileSync(server, longRunningController());
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, codexHome: sourceHome, controllerArgs: [server], requestTimeoutMs: 5_000,
    });
    const prepared = core.prepareGoal('one execution only', 1); core.approve(prepared.runId);
    core.execute(prepared.runId);
    expect(() => core.execute(prepared.runId)).toThrow(/already consumed/u);
    const executions = Number((core.daemon.db.prepare('SELECT count(*) AS n FROM execution_event WHERE run_id=?').get(prepared.runId) as { n: number }).n);
    expect(executions).toBe(1);
    core.stop(prepared.runId);
    const flag = core.daemon.db.prepare('SELECT write_in_progress FROM run WHERE id=?').get(prepared.runId) as { write_in_progress: number };
    // A real controller was launched here, so close() has an ordered teardown
    // to await before afterEach may delete the ledger root.
    await core.close();
    expect(flag.write_in_progress).toBe(0);
  }, 30_000);

  it('blocks an expired approval without spawning a controller or recording execution', () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const core = createCueCore(initializeConfig(join(root, 'state'), { worktreeRoot: worktree }), undefined, {
      binary, codexHome: sourceHome, controllerArgs: ['unused'], envelopeTtlMs: -1,
    } as any);
    const prepared = core.prepareGoal('expired approval', 1); core.approve(prepared.runId);
    const card = core.execute(prepared.runId);
    const executions = Number((core.daemon.db.prepare('SELECT count(*) AS n FROM execution_event WHERE run_id=?').get(prepared.runId) as { n: number }).n);
    const sessions = Number((core.daemon.db.prepare('SELECT count(*) AS n FROM session_handle WHERE run_id=?').get(prepared.runId) as { n: number }).n);
    core.close();
    expect(card).toMatchObject({ state: 'blocked', blockedReason: 'approval_expired' });
    expect(executions).toBe(0);
    expect(sessions).toBe(0);
  });
});
