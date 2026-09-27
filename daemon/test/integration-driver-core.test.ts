import { test, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import type { OrchestrationHost } from '../../app/orchestration-driver.mjs';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { configureLocalJsonSettings } from '../src/selection/local-host-settings.js';
import { createIntegrationCatalog } from '../src/integration-catalog.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';

test('explicit unavailable host keeps app usable and refuses preparation without legacy fallback', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-host-readiness-')); const workspace = join(root, 'workspace'); mkdirSync(workspace);
  const config = initializeConfig(join(root, 'data'), { worktreeRoot: workspace });
  const reasons = ['qualification-missing']; let legacy = 0;
  const core = createCueCore(config, undefined, { orchestrationFactory: () => ({ available: false, reasons }), launchHost: () => { legacy++; throw Error('legacy'); } });
  try {
    reasons[0] = 'changed';
    let invoked = 0;
    const getter = Object.defineProperty(['missing'], '0', { enumerable: true, get() { invoked++; return 'changed'; } });
    const iterable = ['missing']; Object.defineProperty(iterable, Symbol.iterator, { value() { invoked++; return ['changed'][Symbol.iterator](); } });
    const inherited = Object.create({ available: false, reasons: ['missing'] });
    const outcomeGetter = Object.defineProperty({ reasons: ['missing'] }, 'available', { enumerable: true, get() { invoked++; return false; } });
    for (const result of [{ available: false, reasons: Array(1) }, { available: false, reasons: getter }, { available: false, reasons: iterable }, inherited, outcomeGetter,
      new Proxy({ available: false, reasons: ['missing'] }, { getOwnPropertyDescriptor() { invoked++; throw Error('proxy'); } })]) {
      expect(() => createCueCore(config, core.daemon, { orchestrationFactory: () => result as any })).toThrow('invalid_orchestration_readiness');
    }
    expect(invoked).toBe(0);
    expect(core.selectionPreferences()).toMatchObject({ available: false, unavailableReasons: ['qualification-missing'] });
    expect(Object.isFrozen(core.selectionPreferences().unavailableReasons)).toBe(true);
    expect(() => core.prepareGoal('{}')).toThrow('실행 준비');
    expect(() => core.prepareGoal('{}', 3, 'value')).toThrow('실행 준비');
    expect(core.daemon.db.prepare('SELECT count(*) n FROM task').get()).toEqual({ n: 0 });
    expect(legacy).toBe(0); expect(core.daemon.db.open).toBe(true);
  } finally { await core.close(); rmSync(root, { recursive: true, force: true }); }
});

test('failed host construction releases its new daemon but preserves caller-owned daemon', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-host-init-')); const workspace = join(root, 'workspace'); mkdirSync(workspace);
  const config = initializeConfig(join(root, 'data'), { worktreeRoot: workspace });
  let opened: any;
  try {
    expect(() => createCueCore(config, undefined, { orchestrationFactory: ({ db }) => { opened = db; throw Error('fixture-init-failed'); } })).toThrow('fixture-init-failed');
    expect(opened.open).toBe(false);
    const daemon = new AppDaemon(config);
    try {
      expect(() => createCueCore(config, daemon, { orchestrationFactory: () => { throw Error('fixture-init-failed'); } })).toThrow('fixture-init-failed');
      expect(daemon.db.open).toBe(true);
    } finally { await daemon.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test.each([false, true])('core host composition (generated=%s) shares its ledger and never falls back to Codex', async generated => {
  const root = mkdtempSync(join(tmpdir(), 'cue-driver-core-'));
  const workspace = join(root, 'workspace'); mkdirSync(workspace);
  const config = initializeConfig(join(root, 'data'), { worktreeRoot: workspace });
  const daemon = new AppDaemon(config); const db = daemon.db;
  const now = Date.now(); let launches = 0; let legacyLaunches = 0;
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key])) as MeasurementSubject;
  const policy = saveSelectionPolicy(db, { policyId: 'fixture-policy', expectedRevision: null, createdAt: new Date(now).toISOString(), sourceVersion: 'fixture',
    policy: { version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 1, currency: 'TEST', costLimit: null,
      remainingTimeMs: null, maxEstimateAgeMs: 10000, allowedCandidateIds: ['fixture-agent'], pinnedCandidateId: null } });
  const policyRef = 'fixture-policy:1';
  const catalog = createIntegrationCatalog({ now: () => now, maxAgeMs: 10000, currentSubjectDigest: () => subjectDigest(subject) }, [{
    canonicalId: 'fixture-agent', toolId: 'fixture', kind: 'agent', aliases: [], installation: 'installed', protocol: 'verified', authReference: 'synthetic-core-account',
    authAvailable: true, sourceVersion: 'fixture', observedAt: new Date(now).toISOString(), subjectDigest: subjectDigest(subject), binding: null,
  }]);
  // No capability PASS fixtures: test the real runtime's fail-closed admission.
  const host: OrchestrationHost = {
    ...(generated ? { parentTemplate: 'generated-json-v1' as const } : {}),
    now: () => now, catalog, verifyFinalBilling: () => false,
    resolveRequirementChecker: () => ({ id: 'tests', revision: 'v1', kinds: ['code'], evidencePolicies:[{requirementId:'req',kind:'code',producerTaskIds:['make'],sourceRevision:'fixture-workspace-v1',targetIds:['workspace'],checkerId:'tests',checkerRevision:'v1',parametersDigest:'a'.repeat(64),hostileCheckIds:[],requiredSectionIds:[],claimIds:[],requiresRender:false}] }),
    prepare: (run: any) => ({ policy: { policyId: policy.policyId, revision: policy.revision, digest: policy.digest }, requirementIds: ['req'],
      requirements: [{ id: 'req', text: 'Inspect the fixture workspace using the approved checks', kind: 'code', required: true,
        checks: [{ checkerId: 'tests', revision: 'v1', parametersDigest: 'a'.repeat(64), targetIds: ['workspace'] }] }],
      proposedPlan: { revision: 'plan1', policyRevision: policyRef, policyDigest: policy.digest, tasks: [
        { id: 'make', role: generated ? 'model-producer' : 'implementation', ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: ['fixture-agent'], scopeIds: ['workspace'] },
        { id: 'check', role: 'verifier', ownerId: 'checker', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: ['fixture-agent'], scopeIds: [] },
      ] }, scopes: [{ id: 'workspace', worktreeRealpath: workspace, allowedActions: generated ? [] : ['file_change'], egress: [] }],
      ...(!generated?{changeTargets:[{taskId:'make',targetId:'workspace-change',relativePath:'journal-target.txt',maxBackupBytes:1024}]}:{}),
      budget: { runId: run.runId, currency: 'TEST', unit: 'micro', limitUnits: 100, policyRevision: policyRef, source: 'fixture-explicit', observedAtMs: now },
      ...(!generated ? { exploration: { candidateId: 'fixture-agent', limitUnits: 20, taskIds: ['make'], authorizedAt: new Date(now).toISOString(), sourceVersion: 'fixture-exploration-v1' } } : {}),
      limits: { launchTimeoutMs: 50, taskTimeoutMs: 100, pollMs: 2 } }),
    authority: { authorizePlan: () => true, authorizeClaim: () => true, authorizeStage: () => true,
      verifyReceipt: () => ({ outcomeVerified: false, cleanupVerified: false }) },
    runtime: { evidence: { now: () => now, maxAgeMs: 10000, resolveEvidence: () => undefined }, authorizeRun: () => true,
      verifyCleanup: () => { throw Error('no execution cleanup proof'); },
      resolveCandidate: () => ({ kind: 'agent', supportedRoles: ['implementation', 'model'], cancellation: 'supported', usage: 'unsupported', availability: 'ready',
        buildCurrentSubject: () => subject, evidenceReferences: () => ({}), launch: async () => { launches++; throw Error('must not launch'); } }) },
    engine: { observeCandidates: () => [{ id: 'fixture-agent', checks: { eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true },
      estimate: { scope: 'verified-completion-total', quality: 1, expectedCost: 1, conservativeMaxCost: 1, expectedTimeMs: 1, conservativeMaxTimeMs: 1,
        currency: 'TEST', source: 'fixture', observedAtMs: now } }],
      reservation: (context: any) => ({ runId: context.request.runId, attemptId: context.request.attemptId, requestId: context.request.requestId,
        currency: 'TEST', unit: 'micro', upperUnits: 10, source: 'fixture-explicit', observedAtMs: now, scope: 'verified-completion-attempt-total' }),
      verifyBudgetMapping: () => true, authorizeExecution: () => true, receipts: () => ({ execution: null, billing: null }) },
    stage: (context: any, run: any) => ({ worktreeRealpath: workspace, allowedActions: context.task.role === 'implementation' ? ['file_change'] : [],
      egress: [], expiresAt: run.envelope.expires_at, autonomyLevel: 'bounded' }),
  };
  let factories = 0;
  const core = createCueCore(config, daemon, { ...(generated ? { orchestrationFactory: context => {
    factories++; expect(context.db).toBe(db); expect(context.worktree).toBe(workspace); return host;
  } } : { orchestration: host }), launchHost: () => { legacyLaunches++; throw Error('must not fall back'); } });
  try {
    expect(core.localJsonSetup()).toMatchObject({ accountingKind: 'local-invocation', available: false, configured: false });
    if (generated) {
      configureLocalJsonSettings(db, { expectedRevision: null, enabled: true,
        limits: { maxInvocations: 2, timeoutMs: 60000, maxOutputBytes: 65536, maxOutputTokens: 2048 }, createdAt: new Date(now).toISOString() });
      expect(core.localJsonSetup()).toMatchObject({ configured: true, enabled: true, restartRequired: false, available: false });
    }
    expect(() => createCueCore(config, daemon, { orchestration: host, orchestrationFactory: () => host })).toThrow('ambiguous_orchestration_host');
    expect(() => createCueCore(config, daemon, { orchestrationFactory: () => undefined as any })).toThrow('orchestration_host_unavailable');
    expect(() => createCueCore(config, daemon, { orchestration: { ...host, parentTemplate: 'unregistered' as any } })).toThrow('unsupported_parent_template');
    const prepared = core.prepareGoal('inspect the fixture workspace');
    expect(factories).toBe(generated ? 1 : 0);
    expect(prepared.envelope.egress).toEqual(generated ? ['http://127.0.0.1:8085/v1'] : []);
    expect((prepared.envelope.allowed_actions as string[]).includes('file_change')).toBe(!generated);
    expect(db.prepare('SELECT egress_json FROM envelope WHERE envelope_hash=(SELECT envelope_hash FROM run WHERE id=?)').get(prepared.runId)).toEqual({ egress_json: JSON.stringify(prepared.envelope.egress) });
    if (generated) expect(prepared.threeLines.join(' ')).toContain('http://127.0.0.1:8085/v1');
    expect(prepared.orchestration).toMatchObject({ mode: 'efficiency', stageCount: 2, limitUnits: 100 });
    if (generated) expect(prepared.orchestration!.exploration).toBeUndefined();
    else {
      expect(prepared.orchestration!.exploration).toMatchObject({ candidateId: 'fixture-agent', limitUnits: 20, currency: 'TEST', unit: 'micro', taskIds: ['make'] });
      expect(Object.isFrozen(prepared.orchestration!.exploration)).toBe(true);
      expect(prepared.threeLines.join(' ')).toContain('전체 예산 상한에 포함');
      expect(prepared.threeLines.join(' ')).not.toContain(prepared.orchestration!.exploration!.authorizationDigest);
    }
    expect(prepared.threeLines.join(' ')).toContain('fixture-policy:1');
    expect(prepared.orchestration!.stages).toHaveLength(2);
    expect(prepared.orchestration!.requirementsDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(db.prepare('SELECT count(*) n FROM requirement_contract_binding WHERE run_id=?').get(prepared.runId)).toEqual({ n: 1 });
    expect(() => core.execute(prepared.runId)).toThrow('approval_session_unavailable');
    if (!generated) {
      let reads = 0;
      const getter = Object.defineProperty({}, 'allowExploration', { enumerable: true, get() { reads++; return true; } });
      for (const options of [{}, getter, { allowExploration: false }, { allowExploration: true, runId: prepared.runId }, Object.create({ allowExploration: true }),
        new Proxy({ allowExploration: true }, { get() { reads++; throw Error('proxy'); } })]) expect(() => core.approve(prepared.runId, options as any)).toThrow();
      expect(reads).toBe(0);
      expect(() => core.approve(prepared.runId)).toThrow('exploration consent required');
      expect(db.prepare('SELECT count(*) n FROM approval_event WHERE run_id=?').get(prepared.runId)).toEqual({ n: 0 });
      db.exec("CREATE TEMP TRIGGER fixture_reject_approval BEFORE INSERT ON approval_event BEGIN SELECT RAISE(ABORT,'fixture approval failure'); END");
      expect(() => core.approve(prepared.runId, { allowExploration: true })).toThrow('fixture approval failure');
      expect(db.prepare('SELECT count(*) n FROM exploration_consent WHERE run_id=?').get(prepared.runId)).toEqual({ n: 0 });
      expect(db.prepare('SELECT count(*) n FROM approval_event WHERE run_id=?').get(prepared.runId)).toEqual({ n: 0 });
      db.exec('DROP TRIGGER fixture_reject_approval');
      core.approve(prepared.runId, { allowExploration: true });
      expect(db.prepare('SELECT count(*) n FROM exploration_consent WHERE run_id=?').get(prepared.runId)).toEqual({ n: 1 });
      expect(db.prepare('SELECT count(*) n FROM approval_event WHERE run_id=?').get(prepared.runId)).toEqual({ n: 1 });
    } else {
      expect(() => core.approve(prepared.runId, { allowExploration: true })).toThrow('exploration unavailable');
      expect(db.prepare('SELECT count(*) n FROM approval_event WHERE run_id=?').get(prepared.runId)).toEqual({ n: 0 });
      core.approve(prepared.runId);
    }
    core.execute(prepared.runId);
    await expect.poll(() => core.completion(prepared.taskId).state).toBe('blocked');
    expect(launches).toBe(0); expect(legacyLaunches).toBe(0);
    expect(db.prepare('SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id=?').get(prepared.runId)).toEqual({ n: 1 });
    expect(core.completion(prepared.taskId).orchestration.budget).toMatchObject({ remainingUnits: '90', costStatus: 'unknown' });
    expect(core.stop(prepared.runId)).toBe(true);
    await expect(core.close()).rejects.toThrow('orchestration_cleanup_unverified');
    expect(db.open).toBe(true);
  } finally {
    // No executor was launched; close the test-owned ledger after inspecting quarantine.
    await daemon.close(); rmSync(root, { recursive: true, force: true });
  }
});
