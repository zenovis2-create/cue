import { afterEach, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createCueCore, initializeConfig, type CueCore } from '../../app/core.mjs';
const roots: string[] = [], cores: CueCore[] = [];
afterEach(async () => {
  for (const core of cores.splice(0)) if (core.daemon.db.open) await core.close();
  for (const root of roots.splice(0)) {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.startsWith(join(tmpdir(), 'cue-ownership-core-'))) throw Error('unsafe cleanup');
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-ownership-core-')); roots.push(root);
  const worktreeRoot = join(root, 'work'); mkdirSync(worktreeRoot);
  const core = createCueCore(initializeConfig(join(root, 'data'), { worktreeRoot })); cores.push(core);
  const run = core.prepareGoal('Owned fixture, no launch');
  core.daemon.db.prepare("UPDATE task SET state='blocked' WHERE id=?").run(run.taskId);
  return { core, run, db: core.daemon.db };
}

test('blocked state and stop acknowledgement do not erase a retained asynchronous runtime', async () => {
  const { core, run, db } = fixture();
  let resolveDone!: () => void;
  const done = new Promise<void>(resolve => { resolveDone = resolve; });
  // A protected test-owned handle; stop makes no process call and settlement is
  // controlled independently to test the real AppDaemon retention registry.
  core.daemon.own(run.runId, { session: { pid: 1800000000 }, stop() {}, done });
  try {
    expect(core.completion(run.taskId).executionOwnership).toMatchObject({ status: 'unresolved', hostRetained: true, unresolvedAttempts: 0 });
    expect(core.daemon.stop(run.runId)).toBe(true);
    expect(core.completion(run.taskId).executionOwnership.status).toBe('unresolved');
  } finally { resolveDone(); await core.daemon.settled(); }
  expect(core.completion(run.taskId).executionOwnership.status).toBe('released');
  db.prepare('UPDATE run SET write_in_progress=1 WHERE id=?').run(run.runId);
  expect(core.completion(run.taskId).executionOwnership).toMatchObject({ status: 'unresolved', hostRetained: false });
  db.prepare('UPDATE run SET write_in_progress=0 WHERE id=?').run(run.runId);
});

test('full unresolved count includes older attempts omitted from the bounded UI history', () => {
  const { core, run, db } = fixture();
  db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run(run.runId, run.envelope.run_id ? db.prepare('SELECT envelope_hash FROM run WHERE id=?').get(run.runId).envelope_hash : '', 'a'.repeat(64), '{}');
  db.prepare("INSERT INTO orchestration_step VALUES(?,'step','blocked')").run(run.runId);
  const insert = db.prepare("INSERT INTO orchestration_attempt VALUES(?,?,'step','fixture','blocked','{}','fixture',NULL,?)");
  for (let n = 0; n < 61; n++) insert.run(`attempt-${n.toString().padStart(3, '0')}`, run.runId, n === 0 ? 0 : 1);
  const before = db.prepare('SELECT total_changes() n').get();
  const card = core.completion(run.taskId);
  expect(card.orchestration.attemptHistory).toHaveLength(50);
  expect(card.orchestration.attemptHistory.some((a: any) => a.attemptId === 'attempt-000')).toBe(false);
  expect(card.orchestration.attemptHistory.every((a: any) => a.cleanup === 'unknown')).toBe(true);
  expect(card.executionOwnership).toEqual({ status: 'unresolved', hostRetained: false, unresolvedAttempts: 1 });
  expect(db.prepare('SELECT total_changes() n').get()).toEqual(before);
  // Synthetic recorded cleanup only, not a claim about any actual process.
  db.prepare("UPDATE orchestration_attempt SET cleanup_verified=1 WHERE attempt_id='attempt-000'").run();
  expect(core.completion(run.taskId).executionOwnership).toEqual({ status: 'released', hostRetained: false, unresolvedAttempts: 0 });
});
