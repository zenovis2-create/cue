import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope, type Envelope } from '../src/envelope.js';
import { launchAppContainerWorker } from '../src/worker-enforcement.js';

const roots: string[] = [];
function temp(): string {
  const root = mkdtempSync(join(tmpdir(), 'cue-p10c-worker-'));
  roots.push(root);
  return root;
}
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

function setup() {
  const worktree = temp();
  const db = openLedger();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task-worker', 'running', null, now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('envelope-worker', worktree, '[]', now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('run-worker', 'task-worker', 'envelope-worker', 1, now);
  const envelope = normalizeEnvelope({
    run_id: 'run-worker',
    worktree_realpath: worktree,
    egress: [],
    expires_at: '2099-01-01T00:00:00Z',
    autonomy_level: 'bounded',
    allowed_actions: ['command', 'file_change'],
  } satisfies Envelope);
  return { db, worktree, envelope };
}
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function processAlive(pid: number): boolean {
  const result = spawnSync('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
  return result.status === 0 && String(result.stdout).includes(`\"${pid}\"`);
}

describe.skipIf(process.platform !== 'win32')('Phase 10-C asynchronous AppContainer tool worker', () => {
  it('rejects an expired envelope before spawning any worker', () => {
    const { db, envelope, worktree } = setup();
    const expired = { ...envelope, expires_at: new Date(Date.now() - 1).toISOString() };
    expect(() => launchAppContainerWorker(db, expired, { cwd: worktree, task_id: 'task-worker', run_id: 'run-worker' }, {
      executable: 'cmd.exe', args: ['/d', '/c', 'exit', '0'], cwd: worktree,
    })).toThrow(/expired/u);
    const sessions = Number((db.prepare('SELECT count(*) AS n FROM session_handle').get() as { n: number }).n);
    db.close();
    expect(sessions).toBe(0);
  });
  it('runs the actual command in capability-zero AppContainer and records its real PID', async () => {
    const { db, worktree, envelope } = setup();
    const running = launchAppContainerWorker(db, envelope, {
      cwd: worktree,
      task_id: 'task-worker',
      run_id: 'run-worker',
    }, {
      executable: 'cmd.exe',
      args: ['/d', '/c', 'echo worker-ok>dynamic.txt'],
      cwd: worktree,
      timeoutMs: 30_000,
    });

    const result = await running.completion;
    const sessions = db.prepare('SELECT s.pid,s.cwd,s.task_id,s.run_id,r.role,r.boundary FROM session_handle s JOIN session_runtime r ON r.handle=s.handle ORDER BY s.rowid').all();
    db.close();

    expect(result.exitCode).toBe(0);
    expect(result.appContainerPid).toBeGreaterThan(0);
    expect(result.enforcement).toBe('appcontainer-capability-zero');
    expect(result.stdout).toContain('CUE_APPCONTAINER_PID=');
    expect(readFileSync(join(worktree, 'dynamic.txt'), 'utf8').trim()).toBe('worker-ok');
    expect(sessions).toEqual([{
      pid: result.appContainerPid,
      cwd: worktree,
      task_id: 'task-worker',
      run_id: 'run-worker',
      role: 'tool_worker',
      boundary: 'appcontainer-capability-zero',
    }]);
    expect(existsSync(running.runtimeHome)).toBe(false);
  }, 90_000);

  it('removes host credential variables from the AppContainer worker environment', async () => {
    const { db, worktree, envelope } = setup();
    const prior = process.env.CODEX_HOME;
    process.env.CODEX_HOME = 'C:/must-not-reach-worker';
    try {
      const envPath = join(worktree, 'env.txt');
      const psEnvPath = envPath.replace(/'/gu, "''");
      const script = `$v=[Environment]::GetEnvironmentVariable('CODEX_HOME');$u=[Environment]::GetEnvironmentVariable('USERPROFILE');$vv=if($null -eq $v){'<null>'}else{$v};Set-Content -LiteralPath '${psEnvPath}' -Value ($vv+'|'+$u)`;
      const running = launchAppContainerWorker(db, envelope, {
        cwd: worktree, task_id: 'task-worker', run_id: 'run-worker',
      }, {
        executable: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', script], cwd: worktree, timeoutMs: 30_000,
      });
      const result = await running.completion;
      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
      const observed = readFileSync(join(worktree, 'env.txt'), 'utf8').trim();
      expect(observed).not.toContain('must-not-reach-worker');
      expect(observed.startsWith('<null>|')).toBe(true);
      expect(observed.slice('<null>|'.length)).toContain('.cue-runtime-');
    } finally {
      if (prior === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prior;
      db.close();
    }
  }, 90_000);

  it('lets the OS boundary deny an obfuscated write outside the approved worktree', async () => {
    const { db, worktree, envelope } = setup();
    const outside = `${worktree}-outside`; roots.push(outside); mkdirSync(outside);
    const target = join(outside, 'escaped.txt');
    const encoded = Buffer.from(target, 'utf8').toString('base64');
    const script = `$ErrorActionPreference='Stop';$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'));Set-Content -LiteralPath $p -Value 'escaped'`;
    const running = launchAppContainerWorker(db, envelope, {
      cwd: worktree, task_id: 'task-worker', run_id: 'run-worker',
    }, {
      executable: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', script], cwd: worktree, timeoutMs: 30_000,
    });
    const result = await running.completion;
    db.close();

    expect(result.exitCode).not.toBe(0);
    expect(result.violation).toBe('filesystem');
    expect(existsSync(target)).toBe(false);
  }, 90_000);

  it('denies a junction escape even when its destination is hidden from preflight parsing', async () => {
    const { db, worktree, envelope } = setup();
    const outside = `${worktree}-junction-outside`; roots.push(outside); mkdirSync(outside);
    const junction = join(worktree, 'escape-link');
    const psJunction = junction.replace(/'/gu, "''");
    const psOutside = outside.replace(/'/gu, "''");
    const linked = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `New-Item -ItemType Junction -Path '${psJunction}' -Target '${psOutside}' | Out-Null`], { encoding: 'utf8' });
    expect(linked.status, `${linked.stdout}\n${linked.stderr}`).toBe(0);
    const target = join(junction, 'escaped.txt');
    const encoded = Buffer.from(target, 'utf8').toString('base64');
    const script = `$ErrorActionPreference='Stop';$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'));Set-Content -LiteralPath $p -Value 'escaped'`;
    const running = launchAppContainerWorker(db, envelope, {
      cwd: worktree, task_id: 'task-worker', run_id: 'run-worker',
    }, {
      executable: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', script], cwd: worktree, timeoutMs: 30_000,
    });
    const result = await running.completion;
    db.close();

    expect(result.exitCode).not.toBe(0);
    expect(result.violation).toBe('filesystem');
    expect(existsSync(join(outside, 'escaped.txt'))).toBe(false);
  }, 90_000);

  it('proves capability-zero AppContainer network denial with a real socket attempt', async () => {
    const { db, worktree, envelope } = setup();
    const typeName = Buffer.from('System.Net.Sockets.TcpClient', 'utf8').toString('base64');
    const methodName = Buffer.from('Connect', 'utf8').toString('base64');
    const host = Buffer.from('1.1.1.1', 'utf8').toString('base64');
    const script = `$t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${typeName}'));$m=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${methodName}'));$h=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${host}'));try{$c=New-Object $t;$c.$m($h,443);Write-Output 'CONNECTED';exit 0}catch{Write-Error $_.Exception.ToString();exit 13}`;
    const running = launchAppContainerWorker(db, envelope, {
      cwd: worktree, task_id: 'task-worker', run_id: 'run-worker',
    }, {
      executable: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', script], cwd: worktree, timeoutMs: 15_000,
    });
    const result = await running.completion;
    db.close();

    expect(result.exitCode).not.toBe(0);
    expect(result.violation, `${result.stdout}\n${result.stderr}`).toBe('network_gate');
    expect(`${result.stdout}\n${result.stderr}`).not.toMatch(/(?:^|\r?\n)CONNECTED(?:\r?\n|$)/u);
    expect(result.appContainerPid).toBeGreaterThan(0);
  }, 90_000);

  it('bounds captured stdout and stderr before returning them to the host', async () => {
    const { db, worktree, envelope } = setup();
    const running = launchAppContainerWorker(db, envelope, { cwd: worktree, task_id: 'task-worker', run_id: 'run-worker' }, {
      executable: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-Command', "[Console]::Out.Write(('x' * 1500000)); [Console]::Error.Write(('y' * 1500000))"],
      cwd: worktree,
      timeoutMs: 30_000,
    });
    const result = await running.completion; db.close();
    expect(result.stdout.length).toBeLessThanOrEqual(1_050_000);
    expect(result.stderr.length).toBeLessThanOrEqual(1_050_000);
  }, 90_000);

  it('terminates a spawned worker when post-spawn runtime ledger insertion fails', async () => {
    const { db, worktree, envelope } = setup();
    db.exec("CREATE TRIGGER force_runtime_failure BEFORE INSERT ON session_runtime BEGIN SELECT RAISE(ABORT, 'forced runtime failure'); END");
    expect(() => launchAppContainerWorker(db, envelope, { cwd: worktree, task_id: 'task-worker', run_id: 'run-worker' }, {
      executable: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', 'Start-Sleep -Seconds 120'], cwd: worktree,
    })).toThrow('forced runtime failure');
    const session = db.prepare('SELECT pid FROM session_handle ORDER BY rowid DESC LIMIT 1').get() as { pid: number };
    const deadline = Date.now() + 5_000;
    while (processAlive(session.pid) && Date.now() < deadline) await delay(50);
    const alive = processAlive(session.pid);
    if (alive) spawnSync('taskkill.exe', ['/PID', String(session.pid), '/T', '/F']);
    db.close();
    expect(alive).toBe(false);
  }, 30_000);
});
