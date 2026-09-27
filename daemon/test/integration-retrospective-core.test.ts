import { afterEach, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createCueCore, initializeConfig, type CueCore } from '../../app/core.mjs';

const roots: string[] = [], cores: CueCore[] = [];
afterEach(async () => {
  for (const core of cores.splice(0)) if (core.daemon.db.open) await core.close();
  for (const root of roots.splice(0)) {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.startsWith(join(tmpdir(), 'cue-retro-core-'))) throw Error('unsafe-test-cleanup');
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-retro-core-')); roots.push(root);
  const work = join(root, 'work'); mkdirSync(work);
  const config = initializeConfig(join(root, 'data'), { worktreeRoot: work });
  return () => { const core = createCueCore(config); cores.push(core); return core; };
}
test('core stores a local historical draft without approval, execution or raw goal and reopens it', async () => {
  const open = fixture(); let core = open();
  const prepared = core.prepareGoal('PRIVATE_GOAL_DO_NOT_COPY');
  const first = core.createRetrospective({ runId: prepared.runId, draftId: 'draft-one' });
  expect(first).toMatchObject({ runId: prepared.runId, status: 'draft', scope: 'local-only', authority: 'reference-only',
    sourceHashScope: 'safe-column-projection', summary: { acceptance: 'not-assessed', totalAttempts: 0 } });
  expect(JSON.stringify(first)).not.toContain('PRIVATE_GOAL_DO_NOT_COPY');
  for (const table of ['approval_event', 'orchestration_attempt', 'session_handle'])
    expect(core.daemon.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
  expect(core.createRetrospective({ runId: prepared.runId, draftId: 'draft-one' })).toEqual(first);
  await core.close(); core = open();
  expect(core.readRetrospective('draft-one')).toEqual(first);
  expect(Object.isFrozen(core.readRetrospective('draft-one')?.summary)).toBe(true);
  expect(core.readRetrospective('absent')).toBeNull();
});
test('core rejects conflicting replay, missing run and executable input without changing drafts', () => {
  const core = fixture()(), one = core.prepareGoal('one'), two = core.prepareGoal('two');
  const draft = core.createRetrospective({ runId: one.runId, draftId: 'draft-two' });
  expect(() => core.createRetrospective({ runId: two.runId, draftId: 'draft-two' })).toThrow('retrospective_conflict');
  expect(() => core.createRetrospective({ runId: 'missing', draftId: 'draft-missing' })).toThrow();
  let calls = 0;
  expect(() => core.createRetrospective({ get runId() { calls++; return one.runId; }, draftId: 'getter' })).toThrow();
  expect(calls).toBe(0);
  expect(core.readRetrospective('draft-two')).toEqual(draft);
  expect(core.daemon.db.prepare('SELECT count(*) n FROM retrospective_draft').get()).toEqual({ n: 1 });
});
