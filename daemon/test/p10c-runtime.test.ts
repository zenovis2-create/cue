import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope, type Envelope } from '../src/envelope.js';
import { createCleanCodexHome } from '../src/tool-home.js';
import { launchHostCodexRun } from '../src/host-codex-runtime.js';

const roots: string[] = [];
function temp(): string {
  const root = mkdtempSync(join(tmpdir(), 'cue-p10c-runtime-'));
  roots.push(root);
  return root;
}
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

function fakeAppServerSource(): string {
  return String.raw`
const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin });
function send(value) { process.stdout.write(JSON.stringify(value) + '\n'); }
rl.on('line', line => {
  const message = JSON.parse(line);
  if (message.method === 'initialize') send({ id: message.id, result: { codexHome: process.env.CODEX_HOME } });
  else if (message.method === 'thread/start') {
    if (!Array.isArray(message.params.environments) || message.params.environments.length !== 0) process.exit(21);
    send({ id: message.id, result: { thread: { id: 'thread-live' } } });
  } else if (message.method === 'turn/start') {
    send({ id: message.id, result: { turn: { id: 'turn-live' } } });
    send({ method: 'item/tool/call', id: 700, params: {
      threadId: 'thread-live', turnId: 'turn-live', callId: 'tool-live', namespace: null,
      tool: 'cue_workspace', arguments: { program: 'cmd.exe', args: ['/d', '/c', 'echo split-ok>split-result.txt'] }
    } });
  } else if (message.id === 700 && message.result) {
    if (!message.result.success || !message.result.contentItems[0].text.includes('appContainerPid')) process.exit(22);
    send({ method: 'item/completed', params: { threadId: 'thread-live', turnId: 'turn-live', item: { type: 'agentMessage', text: 'split complete' } } });
    send({ method: 'turn/completed', params: { threadId: 'thread-live', turn: { id: 'turn-live', status: 'completed' } } });
  }
});
`;
}

function parentLinkFailureServerSource(): string {
  return String.raw`
const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'thread-link'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn-link'}}});send({method:'item/tool/call',id:701,params:{threadId:'thread-link',turnId:'turn-link',callId:'call-link',namespace:null,tool:'cue_workspace',arguments:{program:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command',"$cueMarker='cue-parent-link-failure-child'; Start-Sleep -Seconds 120"]}}});}else if(m.id===701)send({method:'turn/completed',params:{threadId:'thread-link',turn:{id:'turn-link',status:'failed'}}});});`;
}

function largeStderrServerSource(): string {
  return String.raw`
const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'thread-stderr'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn-stderr'}}});process.stderr.write('z'.repeat(2000000));send({method:'turn/completed',params:{threadId:'thread-stderr',turn:{id:'turn-stderr',status:'completed'}}});}});`;
}

function completedServerSource(): string {
  return String.raw`
const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'thread-cleanup'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn-cleanup'}}});send({method:'turn/completed',params:{threadId:'thread-cleanup',turn:{id:'turn-cleanup',status:'completed'}}});}});`;
}

function noOpReadServerSource(): string {
  return String.raw`
const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'thread-noop'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn-noop'}}});send({method:'item/tool/call',id:71,params:{threadId:'thread-noop',turnId:'turn-noop',callId:'call-noop',namespace:null,tool:'cue_workspace',arguments:{program:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command','exit 0']}}});}else if(m.id===71){send({method:'item/completed',params:{item:{type:'agentMessage',text:'I could not complete the requested goal.'}}});send({method:'turn/completed',params:{threadId:'thread-noop',turn:{id:'turn-noop',status:'completed'}}});}});`;
}

function irrelevantWriteServerSource(): string {
  return String.raw`
const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'thread-irrelevant'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn-irrelevant'}}});send({method:'item/tool/call',id:72,params:{threadId:'thread-irrelevant',turnId:'turn-irrelevant',callId:'call-irrelevant',namespace:null,tool:'cue_workspace',arguments:{program:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command',"[IO.File]::WriteAllText([IO.Path]::Combine([Environment]::CurrentDirectory,'unrelated.txt'),'irrelevant')"]}}});}else if(m.id===72){send({method:'item/completed',params:{item:{type:'agentMessage',text:'done'}}});send({method:'turn/completed',params:{threadId:'thread-irrelevant',turn:{id:'turn-irrelevant',status:'completed'}}});}});`;
}

function incompleteWriteServerSource(): string {
  return String.raw`
const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'thread-incomplete'}}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn-incomplete'}}});send({method:'item/tool/call',id:73,params:{threadId:'thread-incomplete',turnId:'turn-incomplete',callId:'call-incomplete',namespace:null,tool:'cue_workspace',arguments:{program:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command',"[IO.File]::WriteAllText([IO.Path]::Combine([Environment]::CurrentDirectory,'result.txt'),'partial')"]}}});}else if(m.id===73){send({method:'item/completed',params:{threadId:'thread-incomplete',turnId:'turn-incomplete',item:{type:'agentMessage',text:'I could not complete the requested goal.'}}});send({method:'turn/completed',params:{threadId:'thread-incomplete',turn:{id:'turn-incomplete',status:'completed'}}});}});`;
}

function processAlive(pid: number): boolean {
  const result = spawnSync('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
  return result.status === 0 && String(result.stdout).includes(`\"${pid}\"`);
}

function markerPids(): number[] {
  const script = "$self=$PID; @(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $self -and $_.CommandLine -like '*cue-parent-link-failure-child*' } | ForEach-Object { $_.ProcessId }) | ConvertTo-Json -Compress";
  const raw = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }).stdout.trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

describe.skipIf(process.platform !== 'win32')('Phase 10-C split runtime tracer', () => {
  it('keeps the controller on the host and executes the real tool in AppContainer', async () => {
    const root = temp();
    const worktree = join(root, 'worktree');
    const sourceHome = join(root, 'source-home');
    const vendorDir = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendorDir);
    writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const codexHome = createCleanCodexHome(join(root, 'homes'), join(sourceHome, 'auth.json'));
    const binary = join(vendorDir, 'codex.exe'); copyFileSync(process.execPath, binary);
    const fakeServer = join(worktree, 'fake-app-server.cjs'); writeFileSync(fakeServer, fakeAppServerSource());

    const db = openLedger();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-split', 'running', null, now);
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-split', worktree, '[]', now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-split', 'task-split', 'envelope-split', 1, now);
    const envelope = normalizeEnvelope({
      run_id: 'run-split', worktree_realpath: worktree, egress: [], expires_at: '2099-01-01T00:00:00Z',
      autonomy_level: 'bounded', allowed_actions: ['command', 'file_change'],
    } satisfies Envelope);

    const running = launchHostCodexRun(db, {
      cwd: worktree, task_id: 'task-split', run_id: 'run-split',
    }, envelope, {
      binary, codexHome, goal: 'split runtime tracer', controllerArgs: [fakeServer], requestTimeoutMs: 5_000,
    });
    const result = await running.done;
    const sessions = db.prepare('SELECT s.pid,s.cwd,r.role,r.boundary,r.parent_handle,s.handle FROM session_handle s JOIN session_runtime r ON r.handle=s.handle ORDER BY s.rowid').all() as Array<Record<string, unknown>>;
    const toolExecutions = (db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='tool_execution' ORDER BY rowid").all('run-split') as Array<{ content: string }>)
      .map(row => JSON.parse(row.content) as Record<string, unknown>);
    db.close();

    expect(result).toMatchObject({ status: 'completed', finalMessage: 'split complete', successfulToolCalls: 1 });
    expect(result.goalVerification).toEqual(expect.objectContaining({ passed: true, reason: 'workspace_changed', changedPaths: ['split-result.txt'] }));
    expect(toolExecutions).toEqual([expect.objectContaining({
      callId: 'tool-live',
      ordinal: 1,
      operation: 'command',
      program: 'cmd.exe',
      argumentCount: 3,
      startedAt: expect.any(String),
      finishedAt: expect.any(String),
    })]);
    expect(readFileSync(join(worktree, 'split-result.txt'), 'utf8').trim()).toBe('split-ok');
    expect(sessions.map(row => row.role)).toEqual(['controller', 'tool_worker', 'tool_worker', 'tool_worker']);
    expect(sessions[0]?.boundary).toBe('host-model-only');
    expect(sessions[0]?.cwd).toBe(join(codexHome, 'controller-workspace'));
    for (const worker of sessions.slice(1)) {
      expect(worker.boundary).toBe('appcontainer-capability-zero');
      expect(worker.cwd).toBe(worktree);
      expect(worker.parent_handle).toBe(sessions[0]?.handle);
      expect(worker.pid).not.toBe(sessions[0]?.pid);
    }
    expect(existsSync(codexHome)).toBe(false);
  }, 90_000);

  it('terminates and reaps a worker when parent linkage fails after spawn', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendorDir = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendorDir); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const codexHome = createCleanCodexHome(join(root, 'homes'), join(sourceHome, 'auth.json'));
    const binary = join(vendorDir, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'parent-link-failure.cjs'); writeFileSync(server, parentLinkFailureServerSource());
    const db = openLedger(); const now = new Date().toISOString();
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-link', 'running', null, now);
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-link', worktree, '[]', now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-link', 'task-link', 'envelope-link', 1, now);
    db.exec("CREATE TRIGGER force_parent_link_failure BEFORE UPDATE OF parent_handle ON session_runtime BEGIN SELECT RAISE(ABORT, 'forced parent link failure'); END");
    const envelope = normalizeEnvelope({ run_id: 'run-link', worktree_realpath: worktree, egress: [], expires_at: '2099-01-01T00:00:00Z', autonomy_level: 'bounded', allowed_actions: ['command', 'file_change'] } satisfies Envelope);
    const running = launchHostCodexRun(db, { cwd: worktree, task_id: 'task-link', run_id: 'run-link' }, envelope, {
      binary, codexHome, goal: 'parent link failure', controllerArgs: [server], requestTimeoutMs: 5_000,
    });
    await running.done;
    const worker = db.prepare("SELECT s.pid FROM session_handle s JOIN session_runtime r ON r.handle=s.handle WHERE r.role='tool_worker'").get() as { pid: number };
    const deadline = Date.now() + 5_000;
    while (processAlive(worker.pid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    const alive = processAlive(worker.pid);
    if (alive) spawnSync('taskkill.exe', ['/PID', String(worker.pid), '/T', '/F']);
    const orphans = markerPids();
    for (const pid of orphans) spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F']);
    db.close();
    expect(alive).toBe(false);
    expect(orphans).toEqual([]);
  }, 30_000);

  it('bounds host controller stderr retained in memory', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendorDir = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendorDir); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const codexHome = createCleanCodexHome(join(root, 'homes'), join(sourceHome, 'auth.json'));
    const binary = join(vendorDir, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'large-stderr.cjs'); writeFileSync(server, largeStderrServerSource());
    const db = openLedger(); const now = new Date().toISOString();
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-stderr', 'running', null, now);
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-stderr', worktree, '[]', now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-stderr', 'task-stderr', 'envelope-stderr', 1, now);
    const envelope = normalizeEnvelope({ run_id: 'run-stderr', worktree_realpath: worktree, egress: [], expires_at: '2099-01-01T00:00:00Z', autonomy_level: 'bounded', allowed_actions: ['command', 'file_change'] } satisfies Envelope);
    const result = await launchHostCodexRun(db, { cwd: worktree, task_id: 'task-stderr', run_id: 'run-stderr' }, envelope, {
      binary, codexHome, goal: 'large stderr', controllerArgs: [server], requestTimeoutMs: 5_000,
    }).done;
    db.close();
    expect(Buffer.byteLength(result.controllerStderr, 'utf8')).toBeLessThanOrEqual(1_000_000);
    expect(result.controllerStderr).toContain('[CUE_CAPTURE_TRUNCATED]');
  }, 30_000);

  it('fails independent goal verification after a successful but read-only no-op tool call', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const codexHome = join(root, 'codex-home-noop'); const vendorDir = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(codexHome); mkdirSync(vendorDir); writeFileSync(join(worktree, 'initial.txt'), 'baseline');
    const binary = join(vendorDir, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'noop-server.cjs'); writeFileSync(server, noOpReadServerSource());
    const db = openLedger(); const now = new Date().toISOString();
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-noop', 'running', null, now);
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-noop', worktree, '[]', now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-noop', 'task-noop', 'envelope-noop', 1, now);
    const envelope = normalizeEnvelope({ run_id: 'run-noop', worktree_realpath: worktree, egress: [], expires_at: '2099-01-01T00:00:00Z', autonomy_level: 'bounded', allowed_actions: ['command', 'file_change'] } satisfies Envelope);
    const result = await launchHostCodexRun(db, { cwd: worktree, task_id: 'task-noop', run_id: 'run-noop' }, envelope, {
      binary, codexHome, goal: 'Create result.txt with exact text relevant-proof', controllerArgs: [server], requestTimeoutMs: 5_000,
    }).done;
    db.close();
    expect(result.status).toBe('completed');
    expect(result.successfulToolCalls).toBe(1);
    expect((result as any).goalVerification).toEqual(expect.objectContaining({ passed: false, reason: 'workspace_unchanged' }));
  }, 30_000);

  it('rejects a workspace mutation that does not touch the output path named by the goal', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const codexHome = join(root, 'codex-home-irrelevant'); const vendorDir = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(codexHome); mkdirSync(vendorDir);
    const binary = join(vendorDir, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'irrelevant-server.cjs'); writeFileSync(server, irrelevantWriteServerSource());
    const db = openLedger(); const now = new Date().toISOString();
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-irrelevant', 'running', null, now);
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-irrelevant', worktree, '[]', now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-irrelevant', 'task-irrelevant', 'envelope-irrelevant', 1, now);
    const envelope = normalizeEnvelope({ run_id: 'run-irrelevant', worktree_realpath: worktree, egress: [], expires_at: '2099-01-01T00:00:00Z', autonomy_level: 'bounded', allowed_actions: ['command', 'file_change'] } satisfies Envelope);
    const result = await launchHostCodexRun(db, { cwd: worktree, task_id: 'task-irrelevant', run_id: 'run-irrelevant' }, envelope, {
      binary, codexHome, goal: 'Create result.txt with exact text relevant-proof', controllerArgs: [server], requestTimeoutMs: 5_000,
    }).done;
    db.close();
    expect(result.successfulToolCalls).toBe(1);
    expect(result.goalVerification).toEqual(expect.objectContaining({ passed: false, reason: 'expected_path_not_changed' }));
  }, 30_000);

  it('rejects an expected-path change when the agent reports that it could not complete the goal', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const codexHome = join(root, 'codex-home-incomplete'); const vendorDir = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(codexHome); mkdirSync(vendorDir);
    const binary = join(vendorDir, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'incomplete-server.cjs'); writeFileSync(server, incompleteWriteServerSource());
    const db = openLedger(); const now = new Date().toISOString();
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-incomplete', 'running', null, now);
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-incomplete', worktree, '[]', now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-incomplete', 'task-incomplete', 'envelope-incomplete', 1, now);
    const envelope = normalizeEnvelope({ run_id: 'run-incomplete', worktree_realpath: worktree, egress: [], expires_at: '2099-01-01T00:00:00Z', autonomy_level: 'bounded', allowed_actions: ['command', 'file_change'] } satisfies Envelope);
    const result = await launchHostCodexRun(db, { cwd: worktree, task_id: 'task-incomplete', run_id: 'run-incomplete' }, envelope, {
      binary, codexHome, goal: 'Create result.txt with exact text relevant-proof', controllerArgs: [server], requestTimeoutMs: 5_000,
    }).done;
    db.close();
    expect(result.finalMessage).toMatch(/could not complete/u);
    expect(result.goalVerification).toEqual(expect.objectContaining({ passed: false, reason: 'agent_reported_incomplete' }));
  }, 30_000);

  it('changes a model-completed result to cleanup failure when the credential home cannot be safely removed', async () => {
    const root = temp(); const worktree = join(root, 'worktree'); const unsafeHome = join(root, 'source-home'); const vendorDir = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(unsafeHome); mkdirSync(vendorDir); writeFileSync(join(unsafeHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendorDir, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'completed-server.cjs'); writeFileSync(server, completedServerSource());
    const db = openLedger(); const now = new Date().toISOString();
    db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-cleanup', 'running', null, now);
    db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-cleanup', worktree, '[]', now);
    db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-cleanup', 'task-cleanup', 'envelope-cleanup', 1, now);
    const envelope = normalizeEnvelope({ run_id: 'run-cleanup', worktree_realpath: worktree, egress: [], expires_at: '2099-01-01T00:00:00Z', autonomy_level: 'bounded', allowed_actions: ['command', 'file_change'] } satisfies Envelope);
    const result = await launchHostCodexRun(db, { cwd: worktree, task_id: 'task-cleanup', run_id: 'run-cleanup' }, envelope, {
      binary, codexHome: unsafeHome, goal: 'cleanup failure', controllerArgs: [server], requestTimeoutMs: 5_000,
    }).done;
    db.close();
    expect(result).toMatchObject({ status: 'failed', failureKind: 'cleanup' });
    expect(result.error).toMatch(/cleanup/u);
    expect(readFileSync(join(unsafeHome, 'auth.json'), 'utf8')).toBe('credential-placeholder');
  }, 30_000);
});
