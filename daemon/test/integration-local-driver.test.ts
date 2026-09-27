import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { openLedger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveLocalSelectionPolicy } from '../src/selection/local-policy-store.js';
import { createIntegrationCatalog } from '../src/integration-catalog.js';
import { MODEL_PROBES } from '../src/capability-admission.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { createOrchestrationDriver, type LocalOrchestrationHost } from '../../app/orchestration-driver.mjs';
const compiledProjectionPath = '../dist/src/ui/orchestration.js';
const { readOrchestrationSnapshot: readCompiledOrchestrationSnapshot } = await import(compiledProjectionPath) as typeof import('../src/ui/orchestration.js');
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
function fixture(limit = 2) {
  const work = mkdtempSync(join(tmpdir(), 'cue-local-driver-')), db = openLedger();
  const now = Date.now(), envelope = normalizeEnvelope({ run_id: 'workflow', worktree_realpath: work, allowed_actions: [], egress: [], expires_at: new Date(now + 60000).toISOString(), autonomy_level: 'bounded' });
  const run = { runId: 'workflow', taskId: 'parent', envelopeHash: envelopeHash(envelope), envelope, goal: 'format JSON', scope: 'document' };
  db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run('parent', 'awaiting_approval', 'now');
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(run.envelopeHash, work, '[]', 'now');
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run(run.runId, run.taskId, run.envelopeHash, 0, 'now');
  const policy = saveLocalSelectionPolicy(db, { policyId: 'local', expectedRevision: null, createdAt: new Date(now).toISOString(), sourceVersion: 'fixture',
    policy: { version: 'cue-local-selection-v1', mode: 'efficiency', producerCandidateId: 'producer', checkerCandidateId: 'checker', limitAttempts: limit, timeoutMs: 1000 } });
  const ref = 'local:1', truth = { clean: true, hold: false, launches: [] as string[], cancels: 0, invalidBudget: false, budgetExtra: false };
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(k => [k, k.endsWith('Sha256') ? 'a'.repeat(64) : k])) as MeasurementSubject;
  // Fixture-only synthetic admission data; no real qualification or model invocation.
  const bytes = new Map<string, Buffer>(), refs: Record<string, { id: string; sha256: string }> = {};
  for (const probe of MODEL_PROBES) { const value = Buffer.from(JSON.stringify({ probe, subjectDigest: subjectDigest(subject), measuredAt: new Date(now).toISOString(), kind: 'live', status: 'pass' })); bytes.set(probe, value); refs[probe] = { id: probe, sha256: createHash('sha256').update(value).digest('hex') }; }
  const catalog = createIntegrationCatalog({ now: () => now, maxAgeMs: 10000, currentSubjectDigest: () => subjectDigest(subject) }, ['producer', 'checker'].map(id => ({ canonicalId: id, toolId: id, kind: id === 'producer' ? 'model' as const : 'checker' as const, aliases: [], installation: 'installed' as const, protocol: 'verified' as const, authReference: null, authAvailable: true, sourceVersion: 'fixture', observedAt: new Date(now).toISOString(), subjectDigest: subjectDigest(subject), binding: id === 'producer' ? { endpointId: 'local', modelId: 'fixture' } : null })));
  const host: LocalOrchestrationHost = {
    accountingKind: 'local-invocation', now: () => now, catalog,
    resolveRequirementChecker: () => ({ id: 'json', revision: 'v1', kinds: ['document'], evidencePolicies: [{ requirementId: 'req', kind: 'document', producerTaskIds: ['make'],
      sourceRevision: 'approved-json-input', targetIds: ['output'], checkerId: 'json', checkerRevision: 'v1', parametersDigest: 'b'.repeat(64), hostileCheckIds: [],
      requiredSectionIds: ['json-document'], claimIds: [], requiresRender: false }] }),
    authority: { authorizePlan: () => true, authorizeClaim: () => true, authorizeStage: () => true,
      verifyReceipt: context => ({ outcomeVerified: true, cleanupVerified: truth.clean, ...(truth.clean ? { handoff: { handoffId: `handoff-${context.attemptId}`,
        identityId: (db.prepare('SELECT identity_id FROM orchestration_attempt_identity WHERE attempt_id=?').get(context.attemptId) as { identity_id: string }).identity_id,
        artifacts: [{ kind: 'output' as const, sourceRef: `artifact-${context.attemptId}` }] } } : {}) }),
      resolveHandoffArtifact: (sourceRef, attemptId) => sourceRef === `artifact-${attemptId}` ? Buffer.from('fixture handoff bytes') : null,
      authorizeHandoffArtifact: (sourceRef, attemptId) => sourceRef === `artifact-${attemptId}` },
    prepare: () => ({ policy: { policyId: policy.policyId, revision: policy.revision, digest: policy.digest }, requirementIds: ['req'], scopes: [],
      proposedPlan: { revision: 'plan', policyRevision: ref, policyDigest: policy.digest, tasks: [
        { id: 'make', role: 'model-producer', ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: ['producer'], scopeIds: [] },
        { id: 'verify', role: 'verifier', ownerId: 'reviewer', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: ['checker'], scopeIds: [] },
      ] }, requirements: [{ id: 'req', text: 'format JSON', kind: 'document', required: true, checks: [{ checkerId: 'json', revision: 'v1', parametersDigest: 'b'.repeat(64), targetIds: ['output'] }] }],
      budget: { runId: run.runId, limit: truth.invalidBudget ? limit + 1 : limit, policyRevision: ref, source: 'fixture-attempt-cap', observedAtMs: now,
        ...(truth.budgetExtra ? { currency: 'fake' } : {}) }, limits: { launchTimeoutMs: 100, taskTimeoutMs: 100, pollMs: 1 } }),
    stage: () => ({ worktreeRealpath: work, allowedActions: [], egress: [], expiresAt: envelope.expires_at, autonomyLevel: 'bounded' }),
    runtime: { evidence: { now: () => now, maxAgeMs: 10000, resolveEvidence: r => bytes.get(r.id) }, authorizeRun: () => true,
      resolveCandidate: (id, _attemptId, _role, binding) => ({ kind: id === 'producer' ? 'model' : 'checker', supportedRoles: ['model'], cancellation: 'supported', usage: 'unsupported', availability: 'ready',
        typedActivitySource: 'isolated-generated-v1', durableExecutionRef: 'session-handle-v1', buildCurrentSubject: () => subject, evidenceReferences: () => refs,
        async launch(context) { expect(db.inTransaction).toBe(false); expect(db.prepare('SELECT 1 FROM local_invocation_reservation WHERE attempt_id=?').get(context.runId)).toBeDefined();
          truth.launches.push(id); const handle = `session-${context.runId}`;
          db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(handle, 100 + truth.launches.length, 'fixture-start', binding.owner.cwd, binding.owner.task_id, binding.owner.run_id);
          return { durableRef: `session:${handle}`, completion: truth.hold ? new Promise<'succeeded'>(() => {}) : Promise.resolve('succeeded' as const), cancel: async () => { truth.cancels++; } }; } }),
      verifyCleanup: async context => ({ runId: context.runId, subjectDigest: context.subjectDigest, result: truth.clean ? 'verified-clean' : 'unknown', evidenceRef: 'fixture-cleanup' }) },
    engine: { maxRequestAgeMs: 1000,
      observeCandidate: (_request, task) => ({ candidateId: task.candidateIds[0]!, eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true }), authorizeExecution: () => true,
      receipts: context => ({ execution: { runId: run.runId, taskId: context.task.id, attemptId: context.request.attemptId, receiptId: 'receipt-' + context.request.attemptId, revision: 1, outcome: 'succeeded', cleanup: truth.clean ? 'clean' : 'unknown', evidenceRef: 'fixture', observedAtMs: now } }) },
  };
  const driver = createOrchestrationDriver({ db, host });
  cleanups.push(async () => { try { await driver.close(); } catch { /* fixture uncertainty is expected */ } db.close(); if (dirname(resolve(work)) !== resolve(tmpdir())) throw Error('cleanup-path'); rmSync(work, { recursive: true, force: true }); });
  const approve = () => { db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES(?,?,'desktop','goal',0,'accept','now')").run(run.runId, run.envelopeHash); driver.activate(run); };
  return { db, run, truth, driver, host, approve };
}
test('local prepare/approve executes producer and checker once without money or acceptance fabrication', async () => {
  const f = fixture(), summary = f.driver.prepare(f.run);
  expect(summary).toMatchObject({ accountingKind: 'local-invocation', limitInvocations: 2, timeoutMs: 1000 });
  for (const key of ['currency', 'unit', 'limitUnits']) expect(summary).not.toHaveProperty(key);
  expect(f.driver.prepare(f.run)).toBe(summary); f.approve();
  const first = f.driver.start(f.run); expect(f.driver.start(f.run)).toBe(first); await first;
  expect(f.truth.launches).toEqual(['producer', 'checker']);
  expect(f.db.prepare('SELECT count(*) n FROM local_invocation_reservation').get()).toEqual({ n: 2 });
  expect(f.db.prepare('SELECT count(*) n FROM integration_budget').get()).toEqual({ n: 0 });
  expect(f.driver.snapshot(f.run.runId).acceptance).toBe('unverified');
  // Driver execution imports the compiled engine; core's separate observation
  // seam imports this compiled projection. No selection field is inferred on driver.snapshot().
  const beforeRead = f.db.prepare('SELECT total_changes() n').get();
  const observation = readCompiledOrchestrationSnapshot(f.db, f.run.runId)!;
  expect(observation.stages).toHaveLength(2);
  for (const stage of observation.stages) expect(stage.selection).toMatchObject({
    status: 'recorded', kind: 'local-invocation', ranking: 'not-performed',
    selectedId: stage.taskId === 'make' ? 'producer' : 'checker', authority: 'historical-explanation-only',
  });
  expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(beforeRead);
});
test('count exhaustion and unknown cleanup cannot dispatch the checker', async () => {
  for (const scenario of ['limit', 'cleanup'] as const) {
    const f = fixture(scenario === 'limit' ? 1 : 2); if (scenario === 'cleanup') f.truth.clean = false;
    f.driver.prepare(f.run); f.approve(); await f.driver.start(f.run);
    expect(f.truth.launches).toEqual(['producer']);
    expect(f.db.prepare('SELECT count(*) n FROM local_invocation_reservation').get()).toEqual({ n: 1 });
    expect(f.driver.snapshot(f.run.runId).acceptance).toBe('unverified');
    f.driver.stop(f.run.runId);
  }
});
test('wrong mode, wrong count and monetary contamination reject atomically', () => {
  const f = fixture(); expect(() => f.driver.prepare({ ...f.run, selectionMode: 'value' })).toThrow('driver_selection_mode_mismatch');
  f.truth.invalidBudget = true; expect(() => f.driver.prepare(f.run)).toThrow('driver_budget_mismatch');
  f.truth.invalidBudget = false; f.truth.budgetExtra = true; expect(() => f.driver.prepare(f.run)).toThrow();
  for (const table of ['local_selection_run_policy', 'local_invocation_budget', 'orchestration_plan']) expect(f.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
});

test('local host rejects an initial default before policy, count, or plan writes', () => {
  const f = fixture(); const prepare = f.host.prepare.bind(f.host);
  (f.host as any).prepare = (run: any) => ({ ...prepare(run), initialDefault: { defaultCandidateId: 'producer',
    conservativeEstimate: { scope: 'verified-completion-total', quality: 1, expectedCost: 0, conservativeMaxCost: 0,
      expectedTimeMs: 1, conservativeMaxTimeMs: 1, currency: 'TEST', source: 'forbidden-local', observedAtMs: Date.now() },
    source: 'forbidden-local', boundAtMs: Date.now() } });
  const contaminated = createOrchestrationDriver({ db: f.db, host: f.host });
  expect(() => contaminated.prepare(f.run)).toThrow('driver_local_initial_default_unsupported');
  for (const table of ['local_selection_run_policy', 'local_invocation_budget', 'orchestration_plan', 'initial_default']) {
    expect(f.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
  }
});

test('local activation deadline uses elapsed time and repeated activation never renews it', async () => {
  const f = fixture(); f.driver.prepare(f.run); f.approve();
  // Fixture host.now is frozen. Only the monotonic activation deadline advances.
  await new Promise(resolve => setTimeout(resolve, 600));
  expect(f.driver.activate(f.run)).toEqual({ state: 'running', started: false });
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(f.driver.snapshot(f.run.runId)).toMatchObject({ state: 'blocked', reason: 'orchestration_deadline' });
  expect(() => f.driver.start(f.run)).toThrow('driver_not_active');
  expect(f.truth.launches).toEqual([]);
  expect(f.db.prepare('SELECT count(*) n FROM local_invocation_reservation').get()).toEqual({ n: 0 });
});

