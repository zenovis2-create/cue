import { test, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCueCore, initializeConfig } from '../../app/core.mjs';

test('desktop completion projects persisted orchestration and preserves legacy cards', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-observation-core-'));
  const workspace = join(root, 'workspace');
  mkdirSync(workspace);
  const core = createCueCore(initializeConfig(join(root, 'data'), { worktreeRoot: workspace }));
  try {
    const prepared = core.prepareGoal('inspect this workspace');
    expect(core.completion(prepared.taskId).orchestration).toBeNull();
    const db = core.daemon.db;
    const run = db.prepare('SELECT envelope_hash FROM run WHERE id=?').get(prepared.runId);
    // Deliberate ledger fixture: proves projection, never actual execution/admission.
    db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run(prepared.runId, run.envelope_hash, 'a'.repeat(64),
      JSON.stringify({ revision: 'fixture-plan', tasks: [{ id: 'check', role: 'verifier' }] }));
    db.prepare('INSERT INTO orchestration_step VALUES(?,?,?)').run(prepared.runId, 'check', 'pending');
    const card = core.completion(prepared.taskId);
    expect(card.orchestration).toMatchObject({ runId: prepared.runId, acceptance: 'unverified', policy: null,
      stages: [{ taskId: 'check', state: 'pending', attemptId: null }], budget: { costStatus: 'unknown' } });
    expect(card.state).toBe('awaiting_approval');
    expect(() => JSON.stringify(card)).not.toThrow();
  } finally {
    await core.close();
    rmSync(root, { recursive: true, force: true });
  }
});
