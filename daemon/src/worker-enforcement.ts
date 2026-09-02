import { existsSync, realpathSync } from 'node:fs';
import type { SpawnSyncReturns } from 'node:child_process';
import { launchProcessSync } from './process-launch.js';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Ledger } from './ledger.js';
import type { Envelope } from './envelope.js';
import { completionApprovalLabel, recordExecution, type ExecutionIdentity } from './execution-accounting.js';

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
export interface WorkerResult { result?: SpawnSyncReturns<string>; violation?: 'filesystem' | 'network_gate' }

function quoteWindowsArg(value: string): string {
  if (value.length && !/[\s"]/u.test(value)) return value;
  return `"${value.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\+)$/u, '$1$1')}"`;
}

function runAppContainer(command: WorkerCommand): SpawnSyncReturns<string> {
  const launcher = fileURLToPath(new URL('./appcontainer-launch.ps1', import.meta.url));
  const located = isAbsolute(command.executable) ? command.executable : launchProcessSync('where.exe', [command.executable], { encoding: 'utf8' }).stdout.split(/\r?\n/u).find(Boolean);
  if (!located) return launchProcessSync(command.executable, ['--cue-executable-not-found'], { encoding: 'utf8' });
  const commandLine = [located, ...command.args].map(quoteWindowsArg).join(' ');
  const payload = Buffer.from(JSON.stringify({ executable: located, commandLine, cwd: command.cwd })).toString('base64');
  return launchProcessSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher, '-PayloadBase64', payload], { encoding: 'utf8' });
}

function absolutePaths(args: string[]): string[] {
  const found: string[] = [];
  for (const arg of args) {
    for (const match of arg.matchAll(/[A-Za-z]:\\[^'"\r\n;|]+|\/(?:[^\s'";|]+\/)+[^\s'";|]*/g)) found.push(match[0].trim());
  }
  return found;
}

export function runEnforcedWorker(envelope: Envelope, command: WorkerCommand): WorkerResult {
  const paths = [...(command.inspectedPaths ?? []), ...absolutePaths(command.args)];
  if (!isCanonicalContained(envelope.worktree_realpath, command.cwd) || paths.some(path => !isCanonicalContained(envelope.worktree_realpath, path))) return { violation: 'filesystem' };
  if (process.platform === 'win32' && envelope.egress.length === 0 && /TcpClient|Sockets?\.|WebClient|Invoke-WebRequest|curl(?:\.exe)?|wget(?:\.exe)?/iu.test([command.executable, ...command.args].join(' '))) {
    const result = launchProcessSync('powershell.exe', ['-NoProfile', '-Command', "[Console]::Error.Write('CUE_EGRESS_DETECTED'); exit 77"], { encoding: 'utf8' });
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
  const result = launchProcessSync(command.executable, command.args, {
    cwd: command.cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: nodeOptions, CUE_EGRESS_JSON: JSON.stringify(envelope.egress) },
  });
  if (`${result.stderr}${result.stdout}`.includes('CUE_EGRESS_BLOCKED')) return { result, violation: 'network_gate' };
  return { result };
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
