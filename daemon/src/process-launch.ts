import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess, type SpawnOptions, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from 'node:child_process';
import type { Ledger } from './ledger.js';
import type { SessionOwner, SessionRecord } from './session-spawn.js';
import { accessSync, constants, existsSync, realpathSync, statSync } from 'node:fs';
import { delimiter, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';

const writableRoots = new Set<string>();
export function registerWritableWorktrees(roots: readonly string[]): void {
  for (const root of roots) writableRoots.add(existsSync(root) ? realpathSync.native(root) : resolve(root));
}
export function registerLedgerWorktrees(db: Ledger, additional: readonly string[] = []): void {
  registerWritableWorktrees([...additional, ...(db.prepare('SELECT worktree_realpath FROM envelope').all() as Array<{ worktree_realpath: string }>).map(row => row.worktree_realpath)]);
}
export function resolveSealedExecutable(command: string, roots: readonly string[] = [], env: NodeJS.ProcessEnv = process.env): string {
  registerWritableWorktrees(roots);
  const system = process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows';
  const systemTools: Record<string, string> = {
    'powershell.exe': join(system, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    'taskkill.exe': join(system, 'System32', 'taskkill.exe'),
    'icacls.exe': join(system, 'System32', 'icacls.exe'),
    'icacls': join(system, 'System32', 'icacls.exe'),
    'where.exe': join(system, 'System32', 'where.exe'),
  };
  let candidate: string | undefined;
  if (isAbsolute(command)) candidate = command;
  else if (dirname(command) !== '.') throw new Error('executable must be absolute or a bare program name');
  else if (process.platform === 'win32' && systemTools[command.toLowerCase()]) candidate = systemTools[command.toLowerCase()];
  else {
    const path = Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1] ?? '';
    const suffixes = process.platform === 'win32' && !extname(command) ? ['.exe', '.com'] : [''];
    for (const directory of path.split(delimiter)) {
      if (!isAbsolute(directory)) continue;
      candidate = suffixes.map(suffix => join(directory, command + suffix)).find(existsSync);
      if (candidate) break;
    }
  }
  if (!candidate || !existsSync(candidate)) throw new Error('executable not found');
  const executable = realpathSync.native(candidate);
  if (!statSync(executable).isFile()) throw new Error('executable is not a file');
  for (const root of writableRoots) {
    const rel = relative(root, executable);
    if (rel === '' || (!isAbsolute(rel) && rel.split(/[\\/]/u)[0] !== '..')) throw new Error('executable is inside a writable worktree');
  }
  accessSync(executable, constants.X_OK);
  return executable;
}

export function resolveOwnedExecutable(db: Ledger, owner: SessionOwner, command: string, roots: readonly string[] = [], env?: NodeJS.ProcessEnv): string {
  registerLedgerWorktrees(db, [owner.cwd, ...roots]);
  try { return resolveSealedExecutable(command, [], env); }
  catch (error) {
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
      .run(owner.task_id, owner.run_id, 'enforcement_violation', 'executable_sealing', new Date().toISOString());
    throw error;
  }
}

export type OwnedChildProcess = ChildProcess;
export type OwnedSpawnSyncResult = SpawnSyncReturns<string>;

interface UnownedTerminationOps {
  taskkill(pid: number): { status: number | null; stderr?: string | Buffer };
  processAlive(pid: number): boolean;
}

function terminationError(message: string): Error {
  const error = new Error(message) as Error & { code: string };
  error.code = 'CUE_TERMINATION_UNVERIFIED';
  return error;
}

export function terminateUnownedProcessTree(pid: number, overrides: Partial<UnownedTerminationOps> = {}): void {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw terminationError('invalid unowned process pid');
  const taskkill = overrides.taskkill ?? (target => spawnSync(resolveSealedExecutable('taskkill.exe'), ['/PID', String(target), '/T', '/F'], { encoding: 'utf8', windowsHide: true }));
  const processAlive = overrides.processAlive ?? (target => spawnSync(resolveSealedExecutable('powershell.exe'), [
    '-NoProfile', '-NonInteractive', '-Command', `if (Get-CimInstance Win32_Process -Filter "ProcessId=${target}" -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }`,
  ], { encoding: 'utf8', windowsHide: true }).status === 0);
  const killed = taskkill(pid);
  if (killed.status !== 0 || processAlive(pid)) {
    throw terminationError(`unowned process-tree termination could not be verified for pid ${pid}`);
  }
}

function launchProcess(command: string, args: readonly string[], options: SpawnOptions = {}): ChildProcess {
  return spawn(resolveSealedExecutable(command, [], options.env), [...args], { ...options, shell: false });
}

export function runProcessSync(command: string, args: readonly string[], options: SpawnSyncOptionsWithStringEncoding): SpawnSyncReturns<string> {
  return spawnSync(resolveSealedExecutable(command, typeof options.cwd === 'string' ? [options.cwd] : [], options.env), [...args], { ...options, shell: false });
}

export function spawnOwned(db: Ledger, owner: SessionOwner, command: string, args: readonly string[], options: SpawnOptions = {}): { child: ChildProcess; session: SessionRecord } {
  if (!owner.task_id || !owner.run_id || !owner.cwd) throw new Error('session owner required');
  const executable = resolveOwnedExecutable(db, owner, command, [], options.env);
  const child = launchProcess(executable, args, { ...options, cwd: owner.cwd });
  if (!child.pid) throw new Error('spawn returned no pid');
  const session = { ...owner, pid: child.pid, start_time: new Date().toISOString(), handle: randomUUID() };
  try {
    db.prepare('INSERT INTO session_handle(handle,pid,start_time,cwd,task_id,run_id) VALUES(?,?,?,?,?,?)')
      .run(session.handle, session.pid, session.start_time, session.cwd, session.task_id, session.run_id);
  } catch (error) {
    terminateUnownedProcessTree(child.pid);
    throw error;
  }
  return { child, session };
}
