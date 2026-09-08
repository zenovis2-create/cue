import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { runProcessSync, spawnOwned, resolveSealedExecutable, resolveOwnedExecutable, type OwnedChildProcess, type OwnedSpawnSyncResult } from './process-launch.js';
import type { SessionOwner, SessionRecord } from './session-spawn.js';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { Ledger } from './ledger.js';
import type { Envelope } from './envelope.js';
import { completionApprovalLabel, recordExecution, type ExecutionIdentity } from './execution-accounting.js';
import { terminateVerifiedTree, verifyProcessesDead } from './process-termination.js';

function canonicalCandidate(candidate: string): string {
  let existing = resolve(candidate);
  const suffix: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break;
    suffix.unshift(existing.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
    existing = parent;
  }
  return resolve(realpathSync.native(existing), ...suffix);
}

export function isCanonicalContained(worktree: string, candidate: string): boolean {
  if (!isAbsolute(candidate)) return false;
  const root = realpathSync.native(worktree);
  const rel = relative(root, canonicalCandidate(candidate));
  return rel === '' || (!isAbsolute(rel) && rel.split(/[\\/]/)[0] !== '..');
}

export interface WorkerCommand { executable: string; args: string[]; cwd: string; inspectedPaths?: string[] }
export interface WorkerResult { result?: OwnedSpawnSyncResult; violation?: 'filesystem' | 'network_gate' | 'executable_sealing' }

function quoteWindowsArg(value: string): string {
  if (value.length && !/[\s"]/u.test(value)) return value;
  return `"${value.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\+)$/u, '$1$1')}"`;
}

const PROFILE_ARTIFACT_KIND = 'appcontainer_profile_pending';
const profilePattern = /^Cue\.Worker\.[0-9a-f]{32}$/u;
function newProfileName(): string { return `Cue.Worker.${randomUUID().replaceAll('-', '')}`; }
function processPossiblyLive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return true;
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
}
export function cleanupAppContainerProfile(profileName: string, worktree: string): void {
  if (process.platform !== 'win32') return;
  if (!profilePattern.test(profileName)) throw new Error('invalid persisted AppContainer profile name');
  const canonicalWorktree = canonicalCandidate(worktree);
  const cleanupScript = resolveSealedExecutable(fileURLToPath(new URL('./appcontainer-profile-cleanup.ps1', import.meta.url)), [canonicalWorktree]);
  const result = runProcessSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', cleanupScript,
    '-ProfileName', profileName, '-Worktree', canonicalWorktree,
  ], { encoding: 'utf8' });
  if (result.status !== 0 || result.error || !result.stdout.includes('CUE_APPCONTAINER_PROFILE_CLEANUP=PASS')) {
    throw new Error(`AppContainer profile cleanup failed: status=${result.status ?? 'null'}`);
  }
}

export function cleanupInterruptedAppContainerProfiles(db: Ledger, worktree: string): number {
  if (process.platform !== 'win32') return 0;
  const canonicalWorktree = canonicalCandidate(worktree);
  const rows = db.prepare(`SELECT artifact.id,artifact.content,artifact.run_id,envelope.worktree_realpath
    FROM artifact JOIN run ON run.id=artifact.run_id JOIN envelope ON envelope.envelope_hash=run.envelope_hash
    WHERE artifact.kind=? ORDER BY artifact.id`).all(PROFILE_ARTIFACT_KIND) as Array<{ id: number; content: string; run_id: string; worktree_realpath: string }>;
  let cleaned = 0;
  for (const row of rows) {
    const rowWorktree = canonicalCandidate(row.worktree_realpath);
    if ((process.platform === 'win32' ? rowWorktree.toLowerCase() : rowWorktree) !== (process.platform === 'win32' ? canonicalWorktree.toLowerCase() : canonicalWorktree)) continue;
    const parsed = JSON.parse(row.content) as { version?: unknown; profileName?: unknown; ownerPid?: unknown };
    if (parsed.version !== 1 || typeof parsed.profileName !== 'string' || !profilePattern.test(parsed.profileName)
      || typeof parsed.ownerPid !== 'number' || !Number.isSafeInteger(parsed.ownerPid) || parsed.ownerPid <= 0) {
      throw new Error('invalid AppContainer cleanup journal');
    }
    // Conservative by design: a live/reused owner PID or any live recorded worker
    // retains its profile. Ownership reconciliation can retry after identity is stale.
    if (processPossiblyLive(parsed.ownerPid)) continue;
    const sessions = db.prepare('SELECT pid FROM session_handle WHERE run_id=?').all(row.run_id) as Array<{ pid: number }>;
    if (sessions.some(session => processPossiblyLive(session.pid))) continue;
    cleanupAppContainerProfile(parsed.profileName, rowWorktree);
    const removed = db.prepare('DELETE FROM artifact WHERE id=? AND kind=?').run(row.id, PROFILE_ARTIFACT_KIND);
    if (removed.changes !== 1) throw new Error('AppContainer cleanup journal deletion failed');
    cleaned += 1;
  }
  return cleaned;
}

function runAppContainer(command: WorkerCommand): OwnedSpawnSyncResult {
  const launcher = resolveSealedExecutable(fileURLToPath(new URL('./appcontainer-launch.ps1', import.meta.url)), [command.cwd]);
  const located = resolveSealedExecutable(command.executable, [command.cwd]);
  const commandLine = [located, ...command.args].map(quoteWindowsArg).join(' ');
  const profileName = newProfileName();
  const payload = Buffer.from(JSON.stringify({ executable: located, commandLine, cwd: command.cwd, parentPid: process.pid, profileName })).toString('base64');
  try {
    return runProcessSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher, '-PayloadBase64', payload], { encoding: 'utf8' });
  } finally {
    cleanupAppContainerProfile(profileName, command.cwd);
  }
}

function absolutePaths(args: string[]): string[] {
  const found: string[] = [];
  for (const arg of args) {
    for (const match of arg.matchAll(/[A-Za-z]:\\[^'"\r\n;|]+|\/(?:[^\s'";|]+\/)+[^\s'";|]*/g)) found.push(match[0].trim());
  }
  return found;
}

export function runEnforcedWorker(envelope: Envelope, command: WorkerCommand): WorkerResult {
  try { command = { ...command, executable: resolveSealedExecutable(command.executable, [envelope.worktree_realpath]) }; }
  catch { return { violation: 'executable_sealing' }; }
  const paths = [...(command.inspectedPaths ?? []), ...absolutePaths(command.args)];
  if (!isCanonicalContained(envelope.worktree_realpath, command.cwd) || paths.some(path => !isCanonicalContained(envelope.worktree_realpath, path))) return { violation: 'filesystem' };
  if (process.platform === 'win32' && envelope.egress.length === 0 && /TcpClient|Sockets?\.|WebClient|Invoke-WebRequest|curl(?:\.exe)?|wget(?:\.exe)?/iu.test([command.executable, ...command.args].join(' '))) {
    const result = runProcessSync('powershell.exe', ['-NoProfile', '-Command', "[Console]::Error.Write('CUE_EGRESS_DETECTED'); exit 77"], { encoding: 'utf8' });
    return { result, violation: 'network_gate' };
  }
  if (process.platform === 'win32' && envelope.egress.length === 0) {
    const result = runAppContainer(command);
    const output = `${result.stderr}${result.stdout}`;
    if (result.status !== 0) {
      const invocation = command.args.join(' ');
      if (/Set-Content|Out-File|New-Item|UnauthorizedAccess|Access.+denied|PermissionDenied/iu.test(`${invocation}\n${output}`)) return { result, violation: 'filesystem' };
      if (/network|socket|connect|TcpClient/iu.test(output) || envelope.egress.length === 0) return { result, violation: 'network_gate' };
      return { result, violation: 'filesystem' };
    }
    return { result };
  }
  const guard = fileURLToPath(new URL('./network-guard.cjs', import.meta.url));
  if (!existsSync(guard)) return { violation: 'network_gate' };
  const nodeOptions = [process.env.NODE_OPTIONS, `--require=${JSON.stringify(guard)}`].filter(Boolean).join(' ');
  const result = runProcessSync(command.executable, command.args, {
    cwd: command.cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: nodeOptions, CUE_EGRESS_JSON: JSON.stringify(envelope.egress) },
  });
  if (`${result.stderr}${result.stdout}`.includes('CUE_EGRESS_BLOCKED')) return { result, violation: 'network_gate' };
  return { result };
}

export interface AppContainerWorkerCommand extends WorkerCommand {
  timeoutMs?: number;
  operation?: 'write_text';
}
export interface AppContainerWorkerResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  appContainerPid?: number;
  enforcement: 'appcontainer-capability-zero';
  violation?: 'filesystem' | 'network_gate' | 'timeout' | 'interrupted' | 'launch' | 'executable_sealing';
}
export interface RunningAppContainerWorker {
  child: OwnedChildProcess;
  session: SessionRecord;
  runtimeHome: string;
  completion: Promise<AppContainerWorkerResult>;
  stop(reason?: 'interrupted' | 'timeout'): void;
}

export class WorkerEnforcementViolationError extends Error {
  readonly code = 'CUE_WORKER_ENFORCEMENT_VIOLATION';
  constructor(readonly violation: 'filesystem' | 'network_gate' | 'executable_sealing', message: string) {
    super(message);
    this.name = 'WorkerEnforcementViolationError';
  }
}

function isolatedWorkerEnvironment(runtimeHome: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  const allowed = ['PATH', 'Path', 'PATHEXT', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'PROGRAMDATA', 'ProgramFiles', 'ProgramFiles(x86)', 'COMSPEC', 'PSModulePath'];
  for (const key of allowed) if (process.env[key] !== undefined) env[key] = process.env[key];
  const appData = joinRuntime(runtimeHome, 'appdata');
  const localAppData = joinRuntime(runtimeHome, 'localappdata');
  const temporary = joinRuntime(runtimeHome, 'tmp');
  for (const directory of [appData, localAppData, temporary]) mkdirSync(directory, { recursive: true });
  Object.assign(env, {
    HOME: runtimeHome,
    USERPROFILE: runtimeHome,
    APPDATA: appData,
    LOCALAPPDATA: localAppData,
    TEMP: temporary,
    TMP: temporary,
  });
  return env;
}

function joinRuntime(root: string, leaf: string): string {
  return resolve(root, leaf);
}

function terminateTree(child: OwnedChildProcess): void {
  if (child.pid && child.exitCode === null && child.signalCode === null) terminateVerifiedTree(child.pid);
  child.stdin?.destroy();
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
}

const MAX_CAPTURE_BYTES = 1_000_000;
function appendBoundedOutput(current: string, chunk: unknown): string {
  const combined = Buffer.concat([Buffer.from(current, 'utf8'), Buffer.from(String(chunk), 'utf8')]);
  if (combined.length <= MAX_CAPTURE_BYTES) return combined.toString('utf8');
  const marker = Buffer.from('\n[CUE_CAPTURE_TRUNCATED]\n', 'utf8');
  const half = Math.floor((MAX_CAPTURE_BYTES - marker.length) / 2);
  return Buffer.concat([combined.subarray(0, half), marker, combined.subarray(combined.length - half)]).toString('utf8');
}

export function launchAppContainerWorker(
  db: Ledger,
  envelope: Envelope,
  owner: SessionOwner,
  command: AppContainerWorkerCommand,
  options: { signal?: AbortSignal } = {},
): RunningAppContainerWorker {
  if (process.platform !== 'win32') throw new Error('AppContainer worker requires Windows');
  const expiresAt = Date.parse(envelope.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('approved envelope expired');
  if (envelope.egress.length !== 0) throw new Error('AppContainer worker currently supports capability-zero egress only');
  if (!envelope.allowed_actions.includes('command')) throw new Error('command action is outside the approved envelope');
  const paths = [...(command.inspectedPaths ?? []), ...absolutePaths(command.args)];
  if (!isCanonicalContained(envelope.worktree_realpath, command.cwd) || paths.some(path => !isCanonicalContained(envelope.worktree_realpath, path))) {
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
      .run(owner.task_id, owner.run_id, 'enforcement_violation', 'filesystem', new Date().toISOString());
    throw new WorkerEnforcementViolationError('filesystem', 'filesystem action is outside the approved worktree');
  }
  if (/TcpClient|Sockets?\.|WebClient|Invoke-WebRequest|curl(?:\.exe)?|wget(?:\.exe)?/iu.test([command.executable, ...command.args].join(' '))) {
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
      .run(owner.task_id, owner.run_id, 'enforcement_violation', 'network_gate', new Date().toISOString());
    throw new WorkerEnforcementViolationError('network_gate', 'network action is outside the capability-zero envelope');
  }
  let executable: string;
  try {
    executable = resolveOwnedExecutable(db, owner, command.executable, [envelope.worktree_realpath]);
  } catch (error) {
    throw new WorkerEnforcementViolationError(
      'executable_sealing',
      error instanceof Error ? error.message : 'worker executable sealing failed',
    );
  }
  const runtimeHome = mkdtempSync(resolve(command.cwd, '.cue-runtime-'));
  const launcher = resolveOwnedExecutable(db, owner, fileURLToPath(new URL('./appcontainer-launch.ps1', import.meta.url)));
  const commandLine = [executable, ...command.args].map(quoteWindowsArg).join(' ');
  const profileName = newProfileName();
  const profileArtifactId = Number(db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
    .run(owner.task_id, owner.run_id, PROFILE_ARTIFACT_KIND, JSON.stringify({ version: 1, profileName, ownerPid: process.pid }), new Date().toISOString()).lastInsertRowid);
  const payload = Buffer.from(JSON.stringify({ executable, commandLine, cwd: command.cwd, parentPid: process.pid, profileName })).toString('base64');
  let launched: ReturnType<typeof spawnOwned> | undefined;
  try {
    launched = spawnOwned(db, owner, 'powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher, '-PayloadBase64', payload], {
      env: isolatedWorkerEnvironment(runtimeHome),
      stdio: 'pipe',
    });
    db.prepare('INSERT INTO session_runtime(handle,role,boundary,parent_handle,created_at) VALUES(?,?,?,?,?)')
      .run(launched.session.handle, 'tool_worker', 'appcontainer-capability-zero', null, new Date().toISOString());
  } catch (error) {
    const failures: unknown[] = [error];
    if (launched) { try { terminateTree(launched.child); } catch (cleanupError) { failures.push(cleanupError); } }
    let profileRemoved = false;
    try { cleanupAppContainerProfile(profileName, command.cwd); profileRemoved = true; } catch (cleanupError) { failures.push(cleanupError); }
    if (profileRemoved) {
      try { db.prepare('DELETE FROM artifact WHERE id=? AND kind=?').run(profileArtifactId, PROFILE_ARTIFACT_KIND); }
      catch (cleanupError) { failures.push(cleanupError); }
    }
    try { rmSync(runtimeHome, { recursive: true, force: true }); } catch (cleanupError) { failures.push(cleanupError); }
    if (failures.length > 1) throw new AggregateError(failures, 'AppContainer worker launch rollback failed');
    throw error;
  }
  const active = launched;
  let profileCleaned = false;
  const cleanupProfileJournal = (): void => {
    if (profileCleaned) return;
    cleanupAppContainerProfile(profileName, command.cwd);
    if (!db.open) throw new Error('ledger closed before AppContainer cleanup journal deletion');
    const removed = db.prepare('DELETE FROM artifact WHERE id=? AND kind=?').run(profileArtifactId, PROFILE_ARTIFACT_KIND);
    if (removed.changes !== 1) throw new Error('AppContainer cleanup journal deletion failed');
    profileCleaned = true;
  };
  active.child.stdin?.end();

  let stdout = '';
  let stderr = '';
  let appContainerPid: number | undefined;
  let stopReason: AppContainerWorkerResult['violation'];
  let settled = false;
  let rejectCompletion: ((error: unknown) => void) | undefined;
  let terminationError: unknown;
  const capturePid = (): void => {
    if (appContainerPid !== undefined) return;
    const match = stdout.match(/(?:^|\r?\n)CUE_APPCONTAINER_PID=(\d+);START_TIME=([^\r\n]+)/u);
    if (!match) return;
    appContainerPid = Number(match[1]);
    active.session.pid = appContainerPid;
    active.session.start_time = match[2];
    if (db.open) db.prepare('UPDATE session_handle SET pid=?,start_time=? WHERE handle=?').run(appContainerPid, match[2], active.session.handle);
  };
  active.child.stdout?.on('data', chunk => { stdout = appendBoundedOutput(stdout, chunk); capturePid(); });
  active.child.stderr?.on('data', chunk => { stderr = appendBoundedOutput(stderr, chunk); });

  const stop = (reason: 'interrupted' | 'timeout' = 'interrupted'): void => {
    if (terminationError) throw terminationError;
    if (settled) return;
    stopReason = reason;
    try {
      if (appContainerPid) {
        terminateVerifiedTree(appContainerPid);
        if (active.child.pid) verifyProcessesDead([active.child.pid]);
      } else terminateTree(active.child);
      cleanupProfileJournal();
    } catch (error) { terminationError = error; rejectCompletion?.(error); throw error; }
  };
  const abort = (): void => { try { stop('interrupted'); } catch { /* completion rejects; the caller retains its lease */ } };
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const timeoutMs = command.timeoutMs ?? 120_000;
  const timeout = setTimeout(() => { try { stop('timeout'); } catch { /* completion rejects fail-closed */ } }, timeoutMs);
  timeout.unref?.();

  const completion = new Promise<AppContainerWorkerResult>((resolveCompletion, reject) => {
    rejectCompletion = reject;
    if (terminationError) reject(terminationError);
    active.child.once('error', error => {
      stderr = appendBoundedOutput(stderr, `${stderr ? '\n' : ''}${error.name}: ${error.message}`);
    });
    active.child.once('close', code => {
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
      capturePid();
      try {
        if (appContainerPid) verifyProcessesDead([appContainerPid]);
        cleanupProfileJournal();
      }
      catch (error) { terminationError = error; reject(error); return; }
      try { rmSync(runtimeHome, { recursive: true, force: true }); } catch (error) {
        stderr = appendBoundedOutput(stderr, `${stderr ? '\n' : ''}runtime cleanup failed: ${String(error)}`);
      }
      const boundaryOutput = `${stdout}\n${stderr}`;
      const childLaunchIntent = /Diagnostics\.Process\]\s*::Start|Start-Process|ProcessStartInfo|CreateProcess/iu.test(command.args.join(' '));
      const childLaunchViolation = code !== 0 && (
        /CUE_CHILD_PROCESS_DENIED_NATIVE_ERROR=(?:1450|1816)/u.test(boundaryOutput)
        || /not enough quota|quota.{0,60}process this command|할당량.{0,60}부족/iu.test(boundaryOutput)
        || (childLaunchIntent && /Win32Exception/iu.test(boundaryOutput))
      ) ? 'executable_sealing' as const : undefined;
      const networkBoundaryViolation = code !== 0 && /System\.Net\.Sockets|SocketException|TcpClient\.Connect|WSAEACCES|(?:^|\D)10013(?:\D|$)/iu.test(boundaryOutput)
        ? 'network_gate' as const
        : undefined;
      const osBoundaryViolation = code !== 0 && !networkBoundaryViolation && /access(?:\s+to\s+the\s+path)?.{0,120}denied|unauthorizedaccess|permission\s+denied|access_denied|액세스.{0,40}거부/iu.test(boundaryOutput)
        ? 'filesystem' as const
        : undefined;
      resolveCompletion({
        exitCode: code,
        stdout,
        stderr,
        appContainerPid,
        enforcement: 'appcontainer-capability-zero',
        ...(stopReason ? { violation: stopReason } : {}),
        ...(!stopReason && childLaunchViolation ? { violation: childLaunchViolation } : {}),
        ...(!stopReason && networkBoundaryViolation ? { violation: networkBoundaryViolation } : {}),
        ...(!stopReason && !networkBoundaryViolation && osBoundaryViolation ? { violation: osBoundaryViolation } : {}),
        ...(!appContainerPid && !stopReason && !networkBoundaryViolation && !osBoundaryViolation ? { violation: 'launch' as const } : {}),
      });
    });
  });
  return { ...active, runtimeHome, completion, stop };
}

export interface WorkerLifecycle { db: Ledger; execution: ExecutionIdentity; now?: Date }

export function runWorkerLifecycle(envelope: Envelope, command: WorkerCommand, lifecycle: WorkerLifecycle): WorkerResult {
  recordExecution(lifecycle.db, lifecycle.execution, lifecycle.now);
  const result = runEnforcedWorker(envelope, command);
  if (result.violation) recordEnforcementViolation(lifecycle.db, envelope.run_id, result.violation, lifecycle.now);
  return result;
}

export function completeTaskCard(db: Ledger, taskId: string): { completed: boolean; approvalLabel: string } {
  const approvalLabel = completionApprovalLabel(db, taskId);
  return { completed: completeTaskIfEnforced(db, taskId), approvalLabel };
}

export function recordEnforcementViolation(db: Ledger, runId: string, kind: string, now = new Date()): void {
  const row = db.prepare('SELECT task_id FROM run WHERE id=?').get(runId) as { task_id: string };
  db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(row.task_id, runId, 'enforcement_violation', kind, now.toISOString());
}

export function completeTaskIfEnforced(db: Ledger, taskId: string): boolean {
  const bad = db.prepare("SELECT count(*) n FROM artifact WHERE task_id=? AND kind IN ('enforcement_violation','execution_over_approval')").get(taskId) as { n: number };
  if (bad.n) return false;
  db.prepare("UPDATE task SET state='completed' WHERE id=?").run(taskId);
  return true;
}
