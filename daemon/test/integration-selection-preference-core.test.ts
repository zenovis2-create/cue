import { test, expect, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppDaemon, createCueCore, initializeConfig, type SelectionMode } from '../../app/core.mjs';
import type { OrchestrationHost } from '../../app/orchestration-driver.mjs';
import { registerIpcHandlers } from '../../app/ipc.mjs';
import { createIntegrationCatalog } from '../src/integration-catalog.js';
import { saveSelectionPolicy, readRunSelectionPolicy } from '../src/selection/policy-store.js';

function fixture(connected = true, withInitialDefault = false) {
  const root = mkdtempSync(join(tmpdir(), 'cue-selection-core-')); const workspace = join(root, 'workspace'); mkdirSync(workspace);
  const config = initializeConfig(join(root, 'data'), { worktreeRoot: workspace });
  const daemon = new AppDaemon(config); const db = daemon.db; const now = Date.now();
  const modes = ['efficiency', 'performance', 'value', 'speed'] as const;
  const policies = new Map(modes.map(mode => [mode, saveSelectionPolicy(db, { policyId: mode, expectedRevision: null,
    createdAt: new Date(now).toISOString(), sourceVersion: 'fixture', policy: { version: 'cue-selection-v1', mode,
      qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 100, currency: 'TEST', costLimit: null, remainingTimeMs: null,
      maxEstimateAgeMs: 1000, allowedCandidateIds: ['agent'], pinnedCandidateId: null } })]));
  let wrongPolicy = false;
  const observedModes: unknown[] = [];
  const subjectDigest = 'a'.repeat(64);
  const catalog = createIntegrationCatalog({ now: () => now, maxAgeMs: 1000, currentSubjectDigest: () => subjectDigest }, [{
    canonicalId: 'agent', toolId: 'fixture-agent', kind: 'agent', aliases: [], installation: 'installed', protocol: 'verified',
    authReference: 'fixture-account', authAvailable: true, sourceVersion: 'fixture', observedAt: new Date(now).toISOString(),
    subjectDigest, binding: null,
  }]);
  const host = {
    now: () => now, verifyFinalBilling: () => false,
    authority: { authorizePlan: () => true, authorizeClaim: () => false, authorizeStage: () => false, verifyReceipt: () => ({ outcomeVerified: false, cleanupVerified: false }) },
    runtime: { evidence: { now: () => now, maxAgeMs: 1000, resolveEvidence: () => undefined }, authorizeRun: () => false, resolveCandidate: () => undefined, verifyCleanup: async () => { throw Error('no executor'); } },
    catalog, engine: {}, stage: () => { throw Error('no executor'); },
    prepare(run: { runId: string; selectionMode?: SelectionMode }) {
      observedModes.push(run.selectionMode);
      const policy = policies.get(wrongPolicy ? 'efficiency' : run.selectionMode!)!;
      const ref = `${policy.policyId}:${policy.revision}`;
      return { policy: { policyId: policy.policyId, revision: policy.revision, digest: policy.digest }, requirementIds: ['req'],
        proposedPlan: { revision: 'plan1', policyRevision: ref, policyDigest: policy.digest, tasks: [
          { id: 'make', role: 'implementation', ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: ['agent'], scopeIds: ['workspace'] },
          { id: 'check', role: 'verifier', ownerId: 'reviewer', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: ['agent'], scopeIds: [] },
        ] }, scopes: [{ id: 'workspace', worktreeRealpath: workspace, allowedActions: ['file_change'], egress: [] }],
        budget: { runId: run.runId, currency: 'TEST', unit: 'micro', limitUnits: 100, policyRevision: ref, source: 'fixture', observedAtMs: now },
        ...(withInitialDefault ? { initialDefault: { defaultCandidateId: 'agent', conservativeEstimate: { scope: 'verified-completion-total',
          quality: 1, expectedCost: 2, conservativeMaxCost: 5, expectedTimeMs: 20, conservativeMaxTimeMs: 40,
          currency: 'TEST', source: 'fixture-default-estimate', observedAtMs: now }, source: 'fixture-default', boundAtMs: now } } : {}),
        limits: { launchTimeoutMs: 10, taskTimeoutMs: 100, pollMs: 1 } };
    },
  } as unknown as OrchestrationHost;
  const core = createCueCore(config, daemon, connected ? { orchestration: host } : {});
  return { core, db, observedModes, mismatch: () => { wrongPolicy = true; }, async dispose() { await core.close(); rmSync(root, { recursive: true, force: true }); } };
}
test('persisted default and explicit modes enter real driver policy binding; pending approval stays frozen', async () => {
  const f = fixture();
  try {
    expect(f.core.selectionPreferences()).toEqual({ available: true, mode: 'efficiency', revision: 0 });
    f.core.setSelectionPreference({ mode: 'value', expectedRevision: 0 });
    const first = f.core.prepareGoal('make a small change');
    expect(first).toMatchObject({ selectionMode: 'value', orchestration: { mode: 'value' } });
    f.core.setSelectionPreference({ mode: 'speed', expectedRevision: 1 });
    expect(first.orchestration!.mode).toBe('value');
    expect(readRunSelectionPolicy(f.db, first.runId)!.snapshot.policy.mode).toBe('value');
    f.core.approve(first.runId);
    expect(f.core.prepareGoal('another change').orchestration!.mode).toBe('speed');
    expect(f.core.prepareGoal('careful change', 3, 'performance').orchestration!.mode).toBe('performance');
    expect(f.core.selectionPreferences().mode).toBe('speed');
    expect(f.observedModes).toEqual(['value', 'speed', 'performance']);
    expect(() => f.core.setSelectionPreference({ mode: 'value', expectedRevision: 0 })).toThrow('conflict');
  } finally { await f.dispose(); }
});
test('Core approval discloses the frozen initial default in plain Korean', async () => {
  const f = fixture(true, true);
  try {
    const prepared = f.core.prepareGoal('통계 없는 작업'); const approval = prepared.threeLines.join(' ');
    const summary = prepared.orchestration!.initialDefault!;
    expect(approval).toContain(`통계가 없을 때 기본 후보 agent`);
    expect(summary.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(approval).not.toContain(summary.digest);
    expect(approval).toContain('보수적 상한 5 TEST, 40ms');
    expect(Object.isFrozen(summary)).toBe(true);
    expect(f.core.prepareGoal('후속 작업').threeLines.join(' ')).toContain('통계가 없을 때 기본 후보 agent');
    expect(prepared.threeLines.join(' ')).toBe(approval);
  } finally { await f.dispose(); }
});
test('legacy mode settings are unavailable, explicit mode refuses and undefined legacy remains compatible', async () => {
  const f = fixture(false);
  try {
    expect(f.core.selectionPreferences()).toEqual({ available: false, mode: 'efficiency', revision: 0 });
    expect(() => f.core.setSelectionPreference({ mode: 'value', expectedRevision: 0 })).toThrow('unavailable');
    expect(() => f.core.prepareGoal('change', 3, 'speed')).toThrow('unavailable');
    expect(f.core.prepareGoal('legacy').orchestration).toBeNull();
    expect(f.db.prepare('SELECT COUNT(*) n FROM selection_preference').get()).toEqual({ n: 0 });
  } finally { await f.dispose(); }
});
test('invalid requested modes, host mode mismatch and settings injection refuse without approval', async () => {
  const f = fixture();
  try {
    expect(() => f.core.prepareGoal('change', 3, 'cheap' as SelectionMode)).toThrow('invalid_selection_mode');
    const hostile = Object.defineProperty({}, 'mode', { enumerable: true, get() { throw Error('getter executed'); } });
    expect(() => f.core.setSelectionPreference(hostile as never)).toThrow('invalid_selection_preference_input');
    expect(() => f.core.setSelectionPreference({ mode: 'value', expectedRevision: 0, credential: 'unwanted' } as never)).toThrow('invalid_selection_preference_input');
    f.mismatch();
    expect(() => f.core.prepareGoal('change', 3, 'value')).toThrow('driver_selection_mode_mismatch');
    expect(f.db.prepare('SELECT COUNT(*) n FROM run').get()).toEqual({ n: 0 });
  } finally { await f.dispose(); }
});
test('new IPC allows only narrow read/write settings and forwards explicit prepare mode', () => {
  const core = { selectionPreferences: vi.fn(() => ({ available: true, mode: 'efficiency', revision: 0 })),
    setSelectionPreference: vi.fn(), prepareGoal: vi.fn() };
  const ipc = registerIpcHandlers({ handle: vi.fn() }, core as never);
  expect(ipc.invoke('cue:selection-preferences', { operation: 'read' }).revision).toBe(0);
  ipc.invoke('cue:selection-preferences', { operation: 'write', mode: 'value', expectedRevision: 0 });
  expect(core.setSelectionPreference).toHaveBeenCalledWith({ mode: 'value', expectedRevision: 0 });
  for (const input of [null, { operation: 'delete' }, { operation: 'read', secret: 'extra' }, { operation: 'write', mode: 'other', expectedRevision: 0 }, { operation: 'write', mode: 'speed', expectedRevision: -1 }]) {
    expect(() => ipc.invoke('cue:selection-preferences', input)).toThrow('denied');
  }
  expect(() => ipc.invoke('cue:settings', {})).toThrow('IPC channel denied');
  ipc.invoke('cue:prepare', { goal: 'goal', autonomy: 3, selectionMode: 'performance' });
  expect(core.prepareGoal).toHaveBeenLastCalledWith('goal', 3, 'performance');
});
