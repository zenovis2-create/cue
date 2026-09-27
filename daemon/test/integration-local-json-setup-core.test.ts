import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createCueCore, initializeConfig, type CueCore } from '../../app/core.mjs';

const roots: string[] = [], cores: CueCore[] = [];
afterEach(async () => {
  for (const core of cores.splice(0)) if (core.daemon.db.open) await core.close();
  for (const root of roots.splice(0)) {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.startsWith(join(tmpdir(), 'cue-json-setup-core-'))) throw Error('unsafe fixture cleanup');
    rmSync(root, { recursive: true, force: true });
  }
});
const limits = { maxInvocations: 2, timeoutMs: 60000, maxOutputBytes: 65536, maxOutputTokens: 2048 };
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-json-setup-core-')); roots.push(root);
  const worktreeRoot = join(root, 'work'); mkdirSync(worktreeRoot);
  const config = initializeConfig(join(root, 'data'), { worktreeRoot });
  const open = () => { const core = createCueCore(config); cores.push(core); return core; };
  return { open };
}

test('setup is explicit, read-only until saved, and blocks new preparations pending restart', async () => {
  const f = fixture(), core = f.open(), db = core.daemon.db;
  const previous = core.prepareGoal('Existing explicitly constructed legacy run');
  const copy = JSON.stringify(previous), before = db.prepare('SELECT total_changes() n').get();
  expect(core.localJsonSetup()).toMatchObject({ configured: false, revision: null, available: false, restartRequired: false, limits: null });
  expect(db.prepare('SELECT total_changes() n').get()).toEqual(before);
  const saved = core.configureLocalJson({ expectedRevision: null, enabled: true, limits });
  expect(saved).toMatchObject({ configured: true, revision: 1, limits, restartRequired: true, available: false, ranking: 'not-performed' });
  expect(Object.isFrozen(saved.limits)).toBe(true);
  expect(core.selectionPreferences()).toMatchObject({ available: false, unavailableReasons: ['local-json-restart-required'] });
  expect(() => core.prepareGoal('new')).toThrow('local_json_restart_required');
  expect(() => core.prepareJsonTemplate({ templateId: 'generated-json-v1', inputText: '{}', autonomy: 3, selectionMode: 'efficiency' })).toThrow();
  expect(JSON.stringify(previous)).toBe(copy);
  expect(core.approve(previous.runId)).toMatchObject({ approved: true });
  expect(db.prepare('SELECT count(*) n FROM session_handle').get()).toEqual({ n: 0 });
  expect(db.prepare('SELECT count(*) n FROM capability_evidence').get()).toEqual({ n: 0 });
  await core.close();
  const reopened = f.open();
  expect(reopened.localJsonSetup()).toMatchObject({ revision: 1, limits, configured: true, restartRequired: false, available: false });
});

test('settings conflict and malformed descriptors leave restart state and stored limits unchanged', async () => {
  const f = fixture(); let core = f.open();
  core.configureLocalJson({ expectedRevision: null, enabled: true, limits }); await core.close(); core = f.open();
  expect(() => core.configureLocalJson({ expectedRevision: null, enabled: false, limits })).toThrow();
  let invoked = false;
  const accessor = Object.defineProperty({ expectedRevision: 1, enabled: true, limits }, 'limits', { get() { invoked = true; return limits; } });
  expect(() => core.configureLocalJson(accessor)).toThrow(); expect(invoked).toBe(false);
  expect(core.localJsonSetup()).toMatchObject({ revision: 1, enabled: true, restartRequired: false, limits });
  const changed = core.configureLocalJson({ expectedRevision: 1, enabled: false, limits: { ...limits, maxInvocations: 3 } });
  expect(changed).toMatchObject({ revision: 2, enabled: false, restartRequired: true, limits: { maxInvocations: 3 } });
});
