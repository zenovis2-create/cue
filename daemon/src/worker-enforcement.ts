import { existsSync, realpathSync } from 'node:fs';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Ledger } from './ledger.js';
import type { Envelope } from './envelope.js';

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
  const guard = fileURLToPath(new URL('./network-guard.cjs', import.meta.url));
  if (!existsSync(guard)) return { violation: 'network_gate' };
  const nodeOptions = [process.env.NODE_OPTIONS, `--require=${JSON.stringify(guard)}`].filter(Boolean).join(' ');
  const result = spawnSync(command.executable, command.args, {
    cwd: command.cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: nodeOptions, CUE_EGRESS_JSON: JSON.stringify(envelope.egress) },
  });
  if (`${result.stderr}${result.stdout}`.includes('CUE_EGRESS_BLOCKED')) return { result, violation: 'network_gate' };
  return { result };
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
