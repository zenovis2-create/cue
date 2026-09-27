import { afterEach, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { reconcileInterruptedWrites } from '../src/recovery.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { AppDaemon, initializeConfig } from '../../app/core.mjs';

const directories: string[] = [];
const databases: Ledger[] = [];
afterEach(() => { for (const db of databases.splice(0)) if (db.open) db.close(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture(model = false) {
  const root = mkdtempSync(join(tmpdir(), 'cue-integration-recovery-')); directories.push(root);
  const worktree = join(root, 'work'); mkdirSync(worktree);
  const config = initializeConfig(join(root, 'state'), { worktreeRoot: worktree });
  const db = openLedger(config.ledgerPath); databases.push(db);
  db.prepare("INSERT INTO task(id,state,created_at) VALUES('task','running','2026-09-11T00:00:00.000Z')").run();
  db.prepare("INSERT INTO envelope(envelope_hash,worktree_realpath,egress_json,created_at) VALUES('env',?,'[]','2026-09-11T00:00:00.000Z')").run(worktree);
  db.prepare("INSERT INTO run(id,task_id,envelope_hash,started_at) VALUES('run','task','env','2026-09-11T00:00:00.000Z')").run();
  const approval = { policyRevision: 'one', policyDigest: 'a'.repeat(64), requirementIds: ['R'], allowedCandidateIds: ['tool'], allowedScopeIds: ['work'] };
  const tasks = [
    ...(model ? [{ id: 'plan', role: 'planner' as const, ownerId: 'planner', requirementIds: ['R'], dependencyIds: [], candidateIds: ['tool'], scopeIds: ['work'] }] : []),
    { id: 'impl', role: 'implementation' as const, ownerId: 'maker', requirementIds: ['R'], dependencyIds: model ? ['plan'] : [], candidateIds: ['tool'], scopeIds: ['work'] },
    { id: 'verify', role: 'verifier' as const, ownerId: 'checker', requirementIds: ['R'], dependencyIds: ['impl'], candidateIds: ['tool'], scopeIds: ['work'] },
  ];
  const plan = validateTaskPlan(approval, { revision: 'one', policyRevision: 'one', policyDigest: approval.policyDigest, tasks });
  const store = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true,
    verifyReceipt: () => ({ outcomeVerified: true, cleanupVerified: true }) });
  store.install('run', plan);
  store.claim({ runId: 'run', taskId: model ? 'plan' : 'impl', attemptId: 'attempt', candidateId: 'tool', observedAtMs: 1 });
  return { config, db, store, worktree };
}
test('generic recovery blocks crashed writer without deleting unverified orchestration lease', () => {
  const { db, store, worktree } = fixture();
  expect(reconcileInterruptedWrites(db, worktree, () => ' M work.txt')).toBe(1);
  expect(db.prepare("SELECT write_in_progress FROM run WHERE id='run'").get()).toEqual({ write_in_progress: 1 });
  expect(db.prepare('SELECT COUNT(*) AS n FROM workspace_write_lease').get()).toEqual({ n: 1 });
  expect(store.readiness('run')).toMatchObject({ phase: 'blocked', acceptance: 'unverified' });
  expect(db.prepare("SELECT state FROM orchestration_attempt WHERE attempt_id='attempt'").get()).toEqual({ state: 'blocked' });
});
test('model-only interruption is recovered even without a writer flag', () => {
  const { db, store, worktree } = fixture(true);
  expect(db.prepare("SELECT write_in_progress FROM run WHERE id='run'").get()).toEqual({ write_in_progress: 0 });
  expect(reconcileInterruptedWrites(db, worktree, () => '')).toBe(1);
  expect(store.readiness('run').phase).toBe('blocked');
  expect(db.prepare('SELECT COUNT(*) AS n FROM workspace_write_lease').get()).toEqual({ n: 0 });
});
test('desktop startup retains quarantined writer ownership and opens successfully', () => {
  const { config, db, worktree } = fixture();
  reconcileInterruptedWrites(db, worktree, () => ''); db.close();
  const daemon = new AppDaemon(config);
  try {
    expect(daemon.db.prepare('SELECT COUNT(*) AS n FROM workspace_write_lease').get()).toEqual({ n: 1 });
  } finally { daemon.close(); }
});
