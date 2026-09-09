import { basename, isAbsolute, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Ledger } from './ledger.js';
import type { Envelope } from './envelope.js';
import { spawnOwned, runProcessSync, resolveOwnedExecutable, type OwnedChildProcess } from './process-launch.js';
import type { SessionOwner, SessionRecord } from './session-spawn.js';
import { safeCleanupCodexHome, vendorCodexLaunchSpec } from './tool-home.js';
import { terminateVerifiedTree } from './process-termination.js';
import {
  HostCodexRpcSession,
  type HostCodexRunResult,
  type WorkspaceWorkerResult,
} from './host-codex-controller.js';
import {
  launchAppContainerWorker,
  recordEnforcementViolation,
  WorkerEnforcementViolationError,
  type RunningAppContainerWorker,
} from './worker-enforcement.js';

export interface HostCodexRuntimeOptions {
  binary: string;
  codexHome: string;
  goal: string;
  model?: string;
  requestTimeoutMs?: number;
  runTimeoutMs?: number;
  controllerArgs?: readonly string[];
}

export interface HostCodexRuntimeResult extends HostCodexRunResult {
  controllerPid: number;
  workerPids: number[];
  successfulToolCalls: number;
  controllerStderr: string;
  error?: string;
  failureKind?: 'crash' | 'cleanup' | 'termination' | 'enforcement';
  goalVerification: GoalVerificationResult;
}

export interface GoalVerificationResult {
  passed: boolean;
  reason: 'workspace_changed' | 'workspace_unchanged' | 'expected_path_not_changed' | 'expected_content_mismatch' | 'agent_reported_incomplete' | 'snapshot_failed' | 'model_not_completed';
  changedPaths: string[];
}

export interface RunningHostCodexRun {
  child: OwnedChildProcess;
  session: SessionRecord;
  done: Promise<HostCodexRuntimeResult>;
  stop(): void;
}

export function terminateTree(child: OwnedChildProcess): void {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  terminateVerifiedTree(child.pid);
}

function waitForClose(child: OwnedChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise();
    };
    child.once('close', finish);
    const timer = setTimeout(() => {
      try { terminateTree(child); finish(); }
      catch (error) { child.off('close', finish); rejectPromise(error); }
    }, timeoutMs);
    timer.unref?.();
  });
}

export interface HostRuntimeTeardownError {
  stage: 'rpc' | 'worker_stop' | 'worker_completion' | 'controller' | 'cleanup';
  error: unknown;
}

export async function settleHostRuntimeTeardown(input: {
  closeRpc(): void;
  workers: Array<{ stop(reason?: 'interrupted' | 'timeout'): void; completion: Promise<unknown> }>;
  closeController(): void | Promise<void>;
  cleanup(): void;
}): Promise<HostRuntimeTeardownError[]> {
  const errors: HostRuntimeTeardownError[] = [];
  try { input.closeRpc(); } catch (error) { errors.push({ stage: 'rpc', error }); }
  for (const worker of input.workers) {
    try { worker.stop('interrupted'); } catch (error) { errors.push({ stage: 'worker_stop', error }); }
  }
  const settled = await Promise.allSettled(input.workers.map(worker => worker.completion));
  for (const result of settled) {
    if (result.status === 'rejected') errors.push({ stage: 'worker_completion', error: result.reason });
    else if (result.value && typeof result.value === 'object' && (result.value as { failureKind?: unknown }).failureKind === 'termination') {
      errors.push({ stage: 'worker_completion', error: new Error('worker tree termination could not be verified') });
    }
  }
  try { await input.closeController(); } catch (error) { errors.push({ stage: 'controller', error }); }
  try { input.cleanup(); } catch (error) { errors.push({ stage: 'cleanup', error }); }
  return errors;
}

function diagnostic(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return raw.replace(/((?:token|secret|password|api[_-]?key)\s*[:=]\s*)[^\s;]+/giu, '$1[REDACTED]').slice(-2_000);
}

function quoteWindowsArg(value: string): string {
  if (value.length && !/[\s"]/u.test(value)) return value;
  return `"${value.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\+)$/u, '$1$1')}"`;
}

const MAX_CONTROLLER_STDERR_BYTES = 1_000_000;
function appendBoundedControllerStderr(current: string, chunk: unknown): string {
  const combined = Buffer.concat([Buffer.from(current, 'utf8'), Buffer.from(String(chunk), 'utf8')]);
  if (combined.length <= MAX_CONTROLLER_STDERR_BYTES) return combined.toString('utf8');
  const marker = Buffer.from('\n[CUE_CAPTURE_TRUNCATED]\n', 'utf8');
  const half = Math.floor((MAX_CONTROLLER_STDERR_BYTES - marker.length) / 2);
  return Buffer.concat([combined.subarray(0, half), marker, combined.subarray(combined.length - half)]).toString('utf8');
}

interface WorkspaceSnapshot {
  truncated: boolean;
  files: Array<{ path: string; sha256: string }>;
}

const SNAPSHOT_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '$root=[IO.Path]::GetFullPath([Environment]::CurrentDirectory)',
  "$all=@(Get-ChildItem -LiteralPath $root -File -Recurse -Force | Where-Object { $_.FullName -notmatch '\\\\(?:\\.git|node_modules)(?:\\\\|$)' } | Sort-Object FullName | Select-Object -First 2001)",
  '$entries=@($all | Select-Object -First 2000 | ForEach-Object { $rel=$_.FullName.Substring($root.Length).TrimStart([char]92,[char]47); [pscustomobject]@{path=$rel;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })',
  '[pscustomobject]@{truncated=($all.Count -gt 2000);files=$entries}|ConvertTo-Json -Compress -Depth 4',
].join(';');

function parseWorkspaceSnapshot(stdout: string): WorkspaceSnapshot {
  const payload = stdout.split(/\r?\n/u).map(line => line.trim()).reverse().find(line => line.startsWith('{') && line.endsWith('}'));
  if (!payload) throw new Error('workspace snapshot payload missing');
  const parsed = JSON.parse(payload) as Partial<WorkspaceSnapshot>;
  if (typeof parsed.truncated !== 'boolean' || !Array.isArray(parsed.files)) throw new Error('invalid workspace snapshot');
  const files = parsed.files.map(item => {
    if (!item || typeof item.path !== 'string' || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(item.sha256)) {
      throw new Error('invalid workspace snapshot entry');
    }
    return { path: item.path, sha256: item.sha256 };
  });
  return { truncated: parsed.truncated, files };
}

function compareWorkspaceSnapshots(before: WorkspaceSnapshot, after: WorkspaceSnapshot, goal: string, finalMessage: string): GoalVerificationResult {
  if (before.truncated || after.truncated) return { passed: false, reason: 'snapshot_failed', changedPaths: [] };
  const left = new Map(before.files.map(item => [item.path.toLowerCase(), item.sha256]));
  const right = new Map(after.files.map(item => [item.path.toLowerCase(), item.sha256]));
  const changedPaths = [...new Set([...left.keys(), ...right.keys()])]
    .filter(path => left.get(path) !== right.get(path))
    .sort();
  if (changedPaths.length) {
    const expectedPaths = [...goal.matchAll(/([\w./\\-]+\.[a-z0-9]{1,12})/giu)]
      .map(match => match[1].replace(/\\/gu, '/').toLowerCase());
    const expectedPathChanged = expectedPaths.every(expected => {
      const expectedName = expected.split('/').at(-1);
      return changedPaths.some(changed => changed === expected || changed.endsWith(`/${expected}`) || changed.split('/').at(-1) === expectedName);
    });
    if (!expectedPathChanged) return { passed: false, reason: 'expected_path_not_changed', changedPaths };
    const exactContent = goal.match(/(?:with|containing)\s+(?:exactly(?:\s+this)?|exact)\s+(?:UTF-8\s+)?text(?:\s+and\s+no\s+extra\s+characters)?\s*:\s*([\s\S]+)$/iu);
    if (exactContent && expectedPaths.length === 1) {
      let content = exactContent[1] ?? '';
      const first = content[0]; const last = content.at(-1);
      if (content.length >= 2 && ((first === '"' && last === '"') || (first === "'" && last === "'") || (first === '`' && last === '`'))) {
        content = content.slice(1, -1);
      }
      const expected = expectedPaths[0]!;
      const expectedName = expected.split('/').at(-1);
      const actualPath = [...right.keys()].find(path => path === expected || path.endsWith(`/${expected}`) || path.split('/').at(-1) === expectedName);
      const expectedSha256 = createHash('sha256').update(content, 'utf8').digest('hex');
      if (!actualPath || right.get(actualPath) !== expectedSha256) {
        return { passed: false, reason: 'expected_content_mismatch', changedPaths };
      }
    }
    if (/\b(?:could not|cannot|unable to|failed to|did not complete|incomplete|blocked)\b/iu.test(finalMessage)) {
      return { passed: false, reason: 'agent_reported_incomplete', changedPaths };
    }
  }
  return changedPaths.length
    ? { passed: true, reason: 'workspace_changed', changedPaths }
    : { passed: false, reason: 'workspace_unchanged', changedPaths: [] };
}

export function launchHostCodexRun(
  db: Ledger,
  owner: SessionOwner,
  envelope: Envelope,
  options: HostCodexRuntimeOptions,
): RunningHostCodexRun {
  if (owner.run_id !== envelope.run_id) throw new Error('owner/envelope run mismatch');
  if (options.controllerArgs && process.env.NODE_ENV !== 'test') throw new Error('controllerArgs are test-only');
  const args = options.controllerArgs ? [...options.controllerArgs] : ['-a', 'on-request', 'app-server'];
  const controllerCwd = join(options.codexHome, 'controller-workspace');
  mkdirSync(controllerCwd, { recursive: true });
  const spec = vendorCodexLaunchSpec(options.binary, args, options.codexHome);
  spec.command = resolveOwnedExecutable(db, owner, spec.command, [envelope.worktree_realpath], spec.env);
  const controllerOwner = { ...owner, cwd: controllerCwd };
  if (process.platform !== 'win32' || !isAbsolute(spec.command)) throw new Error('host controller job containment requires an absolute Windows executable');
  const jobLauncher = resolveOwnedExecutable(db, owner, fileURLToPath(new URL('./job-object-launch.ps1', import.meta.url)));
  const payload = Buffer.from(JSON.stringify({
    executable: spec.command,
    commandLine: [spec.command, ...spec.args].map(quoteWindowsArg).join(' '),
    cwd: controllerCwd,
    parentPid: process.pid,
  })).toString('base64');
  const launched = spawnOwned(db, controllerOwner, 'powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', jobLauncher, '-PayloadBase64', payload], { env: spec.env, stdio: 'pipe' });
  try {
    db.prepare('INSERT INTO session_runtime(handle,role,boundary,parent_handle,created_at) VALUES(?,?,?,?,?)')
      .run(launched.session.handle, 'controller', 'host-model-only', null, new Date().toISOString());
  } catch (error) {
    terminateTree(launched.child);
    throw error;
  }

  const activeWorkers = new Set<RunningAppContainerWorker>();
  const workerPids: number[] = [];
  let successfulToolCalls = 0;
  let modelToolOrdinal = 0;
  let controllerStderr = '';
  let controllerPidCaptured = false;
  let stopped = false;
  const stopAttemptErrors: HostRuntimeTeardownError[] = [];
  launched.child.stderr?.on('data', chunk => {
    controllerStderr = appendBoundedControllerStderr(controllerStderr, chunk);
    if (controllerPidCaptured) return;
    const match = controllerStderr.match(/(?:^|\r?\n)CUE_HOST_CONTROLLER_PID=(\d+);START_TIME=([^\r\n]+)/u);
    if (!match) return;
    controllerPidCaptured = true;
    launched.session.pid = Number(match[1]);
    launched.session.start_time = match[2];
    if (db.open) db.prepare('UPDATE session_handle SET pid=?,start_time=? WHERE handle=?')
      .run(launched.session.pid, launched.session.start_time, launched.session.handle);
  });

  const executeWorker = async (
    command: Parameters<typeof launchAppContainerWorker>[3],
    metadata: { purpose: string; modelContext?: { threadId: string; turnId: string; callId: string; signal: AbortSignal } },
  ): Promise<WorkspaceWorkerResult> => {
    const startedAt = new Date().toISOString();
    const ordinal = metadata.modelContext ? ++modelToolOrdinal : null;
    let worker: RunningAppContainerWorker;
    try {
      worker = launchAppContainerWorker(db, envelope, owner, command, { signal: metadata.modelContext?.signal });
    } catch (error) {
      if (error instanceof WorkerEnforcementViolationError && db.open) {
        const finishedAt = new Date().toISOString();
        db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(
          owner.task_id,
          owner.run_id,
          metadata.modelContext ? 'tool_execution' : 'goal_verification_worker',
          JSON.stringify({
            purpose: metadata.purpose,
            ordinal,
            callId: metadata.modelContext?.callId ?? null,
            threadId: metadata.modelContext?.threadId ?? null,
            turnId: metadata.modelContext?.turnId ?? null,
            pid: null,
            exitCode: null,
            boundary: 'preflight',
            violation: error.violation,
            operation: command.operation ?? 'command',
            program: basename(command.executable).slice(0, 128),
            argumentCount: command.args.length,
            startedAt,
            finishedAt,
          }),
          finishedAt,
        );
      }
      throw error;
    }
    activeWorkers.add(worker);
    try {
      db.prepare('UPDATE session_runtime SET parent_handle=? WHERE handle=?')
        .run(launched.session.handle, worker.session.handle);
    } catch (error) {
      worker.stop('interrupted');
      await worker.completion;
      activeWorkers.delete(worker);
      throw error;
    }
    const result = await worker.completion;
    activeWorkers.delete(worker);
    if (result.appContainerPid) workerPids.push(result.appContainerPid);
    if (metadata.modelContext && result.exitCode === 0 && result.violation === undefined) successfulToolCalls += 1;
    if (!db.open) return result;
    if (result.violation === 'filesystem' || result.violation === 'network_gate' || result.violation === 'executable_sealing') {
      recordEnforcementViolation(db, owner.run_id, result.violation);
    }
    const now = new Date().toISOString();
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(
      owner.task_id,
      owner.run_id,
      metadata.modelContext ? 'tool_execution' : 'goal_verification_worker',
      JSON.stringify({
        purpose: metadata.purpose,
        ordinal,
        callId: metadata.modelContext?.callId ?? null,
        threadId: metadata.modelContext?.threadId ?? null,
        turnId: metadata.modelContext?.turnId ?? null,
        pid: result.appContainerPid ?? null,
        exitCode: result.exitCode,
        boundary: result.enforcement,
        violation: result.violation ?? null,
        operation: command.operation ?? 'command',
        program: basename(command.executable).slice(0, 128),
        argumentCount: command.args.length,
        startedAt,
        finishedAt: now,
      }),
      now,
    );
    return result;
  };

  const runner = async (
    command: Parameters<typeof launchAppContainerWorker>[3],
    context: { threadId: string; turnId: string; callId: string; signal: AbortSignal },
  ): Promise<WorkspaceWorkerResult> => executeWorker(command, { purpose: 'model_tool_call', modelContext: context });

  const captureSnapshot = async (purpose: 'before' | 'after'): Promise<WorkspaceSnapshot> => {
    const result = await executeWorker({
      executable: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-Command', SNAPSHOT_SCRIPT],
      cwd: owner.cwd,
      timeoutMs: 30_000,
    }, { purpose: `goal_snapshot_${purpose}` });
    if (result.exitCode !== 0 || result.violation || result.stdout.includes('[CUE_CAPTURE_TRUNCATED]')) throw new Error(`workspace ${purpose} snapshot failed`);
    return parseWorkspaceSnapshot(result.stdout);
  };

  if (!launched.child.stdout || !launched.child.stdin) {
    terminateTree(launched.child);
    throw new Error('host Codex app-server requires piped stdio');
  }
  const rpc = new HostCodexRpcSession(
    { readable: launched.child.stdout, writable: launched.child.stdin },
    runner,
    { requestTimeoutMs: options.requestTimeoutMs, runTimeoutMs: options.runTimeoutMs },
  );

  const done = (async (): Promise<HostCodexRuntimeResult> => {
    let result: HostCodexRunResult;
    let error: string | undefined;
    let failureKind: HostCodexRuntimeResult['failureKind'];
    let goalVerification: GoalVerificationResult = { passed: false, reason: 'model_not_completed', changedPaths: [] };
    try {
      const before = await captureSnapshot('before');
      result = await rpc.run({ cwd: controllerCwd, workspaceCwd: owner.cwd, goal: options.goal, model: options.model });
      if (result.status === 'completed') {
        const after = await captureSnapshot('after');
        goalVerification = compareWorkspaceSnapshots(before, after, options.goal, result.finalMessage);
      }
    } catch (caught) {
      error = diagnostic(caught);
      failureKind = (caught as { code?: unknown })?.code === 'CUE_ENFORCEMENT_VIOLATION' ? 'enforcement' : 'crash';
      result = {
        threadId: '',
        turnId: '',
        status: stopped ? 'interrupted' : 'failed',
        finalMessage: '',
      };
    } finally {
      const teardownErrors = [...stopAttemptErrors, ...await settleHostRuntimeTeardown({
        closeRpc: () => rpc.close(),
        workers: [...activeWorkers],
        closeController: async () => {
          await waitForClose(launched.child, 2_000);
          if (launched.child.exitCode === null && launched.child.signalCode === null) {
            terminateTree(launched.child);
            await waitForClose(launched.child, 2_000);
          }
        },
        cleanup: () => safeCleanupCodexHome(options.codexHome),
      })];
      if (teardownErrors.length > 0) {
        const teardown = teardownErrors.map(entry => `${entry.stage}: ${diagnostic(entry.error)}`).join('; ');
        controllerStderr += `${controllerStderr ? '\n' : ''}${teardown}`;
        const terminationFailure = teardownErrors.some(entry => entry.stage !== 'cleanup');
        error = terminationFailure ? `runtime teardown failed: ${teardown}` : `credential cleanup failed: ${teardown}`;
        failureKind = terminationFailure ? 'termination' : 'cleanup';
        result = { threadId: '', turnId: '', status: 'failed', finalMessage: terminationFailure ? 'runtime teardown failed' : 'credential cleanup failed' };
      }
    }
    return {
      ...result,
      controllerPid: launched.session.pid,
      workerPids: [...workerPids],
      successfulToolCalls,
      controllerStderr,
      goalVerification,
      ...(error ? { error, failureKind } : {}),
    };
  })();

  return {
    ...launched,
    done,
    stop(): void {
      stopped = true;
      try { rpc.interrupt(); } catch (error) { stopAttemptErrors.push({ stage: 'rpc', error }); }
      for (const worker of activeWorkers) {
        try { worker.stop('interrupted'); } catch (error) { stopAttemptErrors.push({ stage: 'worker_stop', error }); }
      }
      try { rpc.close(); } catch (error) { stopAttemptErrors.push({ stage: 'rpc', error }); }
      try { terminateTree(launched.child); } catch (error) { stopAttemptErrors.push({ stage: 'controller', error }); }
      // Credential-home cleanup stays in the single ordered teardown inside
      // done.finally. Deleting it here would race that teardown, which still
      // holds live SQLite handles under the same root.
    },
  };
}
