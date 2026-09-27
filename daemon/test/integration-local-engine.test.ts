import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createLocalInvocationBudget } from '../src/local-invocation-budget.js';
import { bindRunLocalSelectionPolicy, saveLocalSelectionPolicy } from '../src/selection/local-policy-store.js';
import { createLocalOrchestrationEngine, localSelectionRevisionRef, type EngineRequest, type LocalEngineHost } from '../src/orchestration/engine.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createRequirementContractStore } from '../src/verification/requirements.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { readRunPolicyIdentity } from '../src/selection/run-policy-identity.js';
import { createAttemptDecisionStore } from '../src/selection/attempt-decision-store.js';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { createIntegrationRuntime, type ExecutionOutcome } from '../src/integration-runtime.js';
import { readOrchestrationSnapshot } from '../src/ui/orchestration.js';
import { MODEL_PROBES } from '../src/capability-admission.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
const dbs: Ledger[] = [], roots: string[] = [];
afterEach(() => { for (const db of dbs.splice(0)) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const request: EngineRequest = { runId: 'run', taskId: 'make', attemptId: 'first', requestId: 'request-first', observedAtMs: 1000, timeoutMs: 1000 };
function fixture(limit = 3, worktree?: string, swapped = false) {
  if (!worktree) { worktree = mkdtempSync(join(tmpdir(), 'cue-local-engine-')); roots.push(worktree); }
  const db = openLedger(); dbs.push(db);
  for (const file of ['021_local_invocation_budget.sql', '022_local_selection_policy.sql']) db.exec(readFileSync(resolve('migrations', file), 'utf8'));
  const envelope = normalizeEnvelope({ run_id: 'run', worktree_realpath: worktree, allowed_actions: [], egress: [], expires_at: new Date(100000).toISOString(), autonomy_level: 'bounded' });
  const hash = envelopeHash(envelope);
  db.exec("INSERT INTO task VALUES('parent','awaiting_approval',NULL,'now')");
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(hash, worktree);
  db.prepare("INSERT INTO run VALUES('run','parent',?,0,'now')").run(hash);
  const saved = saveLocalSelectionPolicy(db, { policyId: 'local', expectedRevision: null, createdAt: new Date(1000).toISOString(), sourceVersion: 'fixture',
    policy: { version: 'cue-local-selection-v1', mode: 'efficiency', producerCandidateId: 'producer', checkerCandidateId: 'checker', limitAttempts: limit, timeoutMs: 1000 } });
  bindRunLocalSelectionPolicy(db, { runId: 'run', policyId: saved.policyId, revision: saved.revision, digest: saved.digest, boundAt: new Date(1000).toISOString() });
  const approval = { policyRevision: localSelectionRevisionRef(saved), policyDigest: saved.digest, requirementIds: ['req'], allowedCandidateIds: ['producer', 'checker'], allowedScopeIds: [] };
  const plan = validateTaskPlan(approval, { revision: 'plan', policyRevision: approval.policyRevision, policyDigest: approval.policyDigest, tasks: [
    { id: 'make', role: 'model-producer', ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: [swapped ? 'checker' : 'producer'], scopeIds: [] },
    { id: 'verify', role: 'verifier', ownerId: 'reviewer', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: [swapped ? 'producer' : 'checker'], scopeIds: [] },
  ] });
  const truth = { now: 1000, checks: true, cleanup: false, issue: false, failed: false, billing: false, prepareFail: false, asyncPrepare: false, failLaunch: false,
    preparations: 0, observations: 0, launches: [] as string[], roles: [] as string[], cancels: 0, classify: true, costObservation: null as null|Record<string,unknown> };
  const artifactBytes = Buffer.from('fixture handoff bytes');
  const store = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true,
    verifyReceipt: context => ({ outcomeVerified: truth.issue, cleanupVerified: truth.cleanup, ...(truth.issue && truth.cleanup ? { handoff: { handoffId: `handoff-${context.attemptId}`,
      identityId: (db.prepare('SELECT identity_id FROM orchestration_attempt_identity WHERE attempt_id=?').get(context.attemptId) as { identity_id: string }).identity_id,
      artifacts: [{ kind: 'output' as const, sourceRef: `artifact-${context.attemptId}` }] } } : {}) }),
    resolveHandoffArtifact: (sourceRef, attemptId) => sourceRef === `artifact-${attemptId}` ? artifactBytes : null,
    authorizeHandoffArtifact: (sourceRef, attemptId) => sourceRef === `artifact-${attemptId}`,
    retry: { now: () => truth.now, authorizeContract: () => true,
      classifyFailure: () => truth.classify ? { cause: 'transient', sourceRef: 'host-proof', sourceDigest: 'a'.repeat(64), observedAtMs: truth.now } : null } });
  store.install('run', plan);
  const requirements = createRequirementContractStore(db, { now: () => 1000, resolveChecker: () => ({ id: 'json', revision: 'v1', kinds: ['document'], evidencePolicies: [{
    requirementId: 'req', kind: 'document', producerTaskIds: ['make'], sourceRevision: 'approved-json-input', targetIds: ['output'], checkerId: 'json', checkerRevision: 'v1',
    parametersDigest: 'b'.repeat(64), hostileCheckIds: [], requiredSectionIds: ['json-document'], claimIds: [], requiresRender: false,
  }] }) }).bind('run', [
    { id: 'req', text: 'approved JSON', kind: 'document', required: true, checks: [{ checkerId: 'json', revision: 'v1', parametersDigest: 'b'.repeat(64), targetIds: ['output'] }] },
  ]);
  expect(requirements.requirements.evidencePolicies[0]).toMatchObject({ sourceRevision: 'approved-json-input', targetIds: ['output'], parametersDigest: 'b'.repeat(64) });
  const retry = () => store.bindRetryContract({ runId: 'run', requirementsDigest: requirements.requirements.digest, maxAttemptsPerTask: 2, maxAttemptsTotal: 3, deadlineMs: 5000, boundAtMs: 1000 });
  const approve = () => { db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal',0,'accept','now')").run(hash); db.exec("UPDATE task SET state='running' WHERE id='parent'"); };
  const budget = createLocalInvocationBudget(db); budget.initialize({ runId: 'run', limit, policyRevision: approval.policyRevision, source: 'host-dispatch-cap', observedAtMs: 1000 });
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key])) as MeasurementSubject;
  const refs: Record<string, { id: string; sha256: string }> = {}, evidence = new Map<string, Buffer>();
  // Synthetic host evidence tests admission composition only; no live qualification.
  for (const probe of MODEL_PROBES) {
    const bytes = Buffer.from(JSON.stringify({ probe, subjectDigest: subjectDigest(subject), measuredAt: new Date(999).toISOString(), kind: 'live', status: 'pass' }));
    evidence.set(probe, bytes); refs[probe] = { id: probe, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  const completions = new Map<string, (outcome: ExecutionOutcome) => void>();
  const runtime = createIntegrationRuntime({ evidence: { now: () => 1000, maxAgeMs: 100, resolveEvidence: ref => evidence.get(ref.id) }, authorizeRun: () => true,
    resolveCandidate: (candidateId, _id, role) => { truth.roles.push(role); return { kind: candidateId === 'producer' ? 'model' : 'checker', supportedRoles: ['model'], cancellation: 'supported', usage: 'unsupported', availability: 'ready',
      buildCurrentSubject: () => subject, evidenceReferences: () => refs, async launch(context) {
        expect(db.inTransaction).toBe(false); expect(budget.summary('run').committed).toBeGreaterThan(0);
        truth.launches.push(context.runId); if (truth.failLaunch) throw Error('owned partial launch');
        const stage = db.prepare('SELECT stage_task_id,stage_run_id FROM orchestration_stage_envelope WHERE attempt_id=?').get(context.runId) as { stage_task_id: string; stage_run_id: string };
        const handle = `session-${context.runId}`;
        db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(handle, 123, 'fixture-start', worktree, stage.stage_task_id, stage.stage_run_id);
        return { durableRef: `session:${handle}`, completion: new Promise<ExecutionOutcome>(done => completions.set(context.runId, done)), cancel: async () => { truth.cancels++; } };
      } }; },
    readLaunchIntent: attemptId => store.handoffActivity.readLaunchIntent(attemptId),
    recordAttemptIdentity: input => { store.handoffActivity.recordAttemptIdentity({ identityId: `identity-${input.attemptId}`, attemptId: input.attemptId,
      subjectDigest: input.subjectDigest, durableRef: input.durableRef, observedAtMs: input.observedAtMs }); },
    verifyCleanup: async context => ({ runId: context.runId, subjectDigest: context.subjectDigest, evidenceRef: 'os-fixture', result: truth.cleanup ? 'verified-clean' : 'unknown' }) });
  const host: LocalEngineHost = { now: () => truth.now, maxRequestAgeMs: 100,
    observeCandidate: (_request, task) => { truth.observations++; return { candidateId: task.role === 'model-producer' ? 'producer' : 'checker', eligible: truth.checks, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true }; },
    authorizeExecution: () => true, prepareExecution: context => { truth.preparations++; expect(db.inTransaction).toBe(true);
      expect(budget.summary('run').committed).toBeGreaterThan(0); if (truth.prepareFail) throw Error('stage-rejected'); if (truth.asyncPrepare) return Promise.resolve() as never;
      expect(db.prepare('SELECT 1 FROM orchestration_attempt WHERE attempt_id=?').get(context.request.attemptId)).toBeDefined();
      createStageEnvelopeBinder(db, { now: () => truth.now, authorizeStage: () => true, resolveScope: () => { throw Error('unexpected fixture scope'); } }).bind({
        workflowRunId: 'run', taskId: context.task.id, attemptId: context.request.attemptId, parentEnvelope: envelope,
        stage: { worktreeRealpath: worktree, allowedActions: [], egress: [], expiresAt: envelope.expires_at, autonomyLevel: 'bounded' },
      }); },
    recordLaunchIntent: context => { const stage = createStageEnvelopeBinder(db, { now: () => truth.now, authorizeStage: () => true, resolveScope: () => { throw Error('unexpected fixture scope'); } }).read(context.request.attemptId)!;
      const selection = db.prepare('SELECT digest FROM attempt_selection WHERE attempt_id=?').get(context.request.attemptId) as { digest: string };
      store.handoffActivity.recordLaunchIntent({ runId: 'run', taskId: context.task.id, attemptId: context.request.attemptId, candidateId: context.candidateId,
        selectionDigest: selection.digest, expectedSubjectDigest: subjectDigest(subject), tool: { id: context.candidateId, revision: 'fixture' }, model: null,
        parentEnvelopeHash: stage.parentEnvelopeHash, stageEnvelopeHash: stage.envelopeHash, planDigest: plan.digest, policyDigest: saved.digest }); },
    receipts: context => ({ ...(truth.billing ? { billing: { currency: 'fake' } } : {}), ...(truth.costObservation?{costObservation:truth.costObservation}:{}), execution: truth.issue ? { runId: 'run', taskId: context.task.id, attemptId: context.request.attemptId,
      receiptId: 'receipt-' + context.request.attemptId, revision: 1, outcome: truth.failed ? 'failed' : 'succeeded', cleanup: truth.cleanup ? 'clean' : 'unknown', evidenceRef: 'host-proof', observedAtMs: truth.now } : null }),
    resolveCostObservationSource: ref=>ref==='local-meter'?Buffer.from('local measured dispatch'):null };
  const managers = { store, budget, runtime }, engine = createLocalOrchestrationEngine(db, managers, host);
  return { db, plan, saved, truth, store, budget, engine, managers, host, completions, approve, retry, envelope, requirements };
}
describe('local engine connected transaction and owned runtime lifecycle', () => {
  it('persists local-resource actual usage without labelling dispatch counts as money or free service',async()=>{
    const f=fixture();f.approve();const first=await f.engine.start(f.plan,request),evidence=Buffer.from('local measured dispatch');
    f.completions.get('first')!('succeeded');await Promise.resolve();f.truth.cleanup=true;f.truth.issue=true;
    f.truth.costObservation={version:'cue-cost-capacity-observation-v1',candidateId:'producer',providerId:'producer',accountRef:'identity-first',costDimension:'local-resource',costState:'actual',units:1,currency:null,unit:'local-resource-unit',sourceRef:'local-meter',sourceDigest:createHash('sha256').update(evidence).digest('hex'),observedAtMs:1000,validUntilMs:1050,price:'unknown',quota:'unknown',gpu:'sufficient',billing:'unknown'};
    expect(await first.reconcile()).toMatchObject({state:'completed'});
    expect(readOrchestrationSnapshot(f.db,'run',undefined,1100)?.attemptHistory[0]?.costObservation).toMatchObject({status:'observed',costDimension:'local-resource',costState:'actual',freshness:'stale',currency:null,unit:'local-resource-unit',billing:'unknown'});
    expect(f.budget.summary('run')).toMatchObject({committed:1,remaining:2});
  });
  it('binds real readonly local stage envelopes and rejects a swapped fixed-role candidate', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-local-stage-')); roots.push(root);
    const f = fixture(3, root); f.approve();
    const binder = createStageEnvelopeBinder(f.db, { now: () => 1000, authorizeStage: () => true, resolveScope: () => { throw Error('unexpected fixture scope'); } });
    const stage = { worktreeRealpath: root, allowedActions: [], egress: [], expiresAt: f.envelope.expires_at, autonomyLevel: 'bounded' as const };
    f.host.prepareExecution = context => { binder.bind({ workflowRunId: 'run', taskId: context.task.id, attemptId: context.request.attemptId, parentEnvelope: f.envelope, stage }); };
    const first = await f.engine.start(f.plan, request);
    expect(binder.read('first')).toMatchObject({ policyDigest: f.saved.digest, envelope: { allowed_actions: [] } });
    f.completions.get('first')!('succeeded'); await Promise.resolve(); f.truth.cleanup = true; f.truth.issue = true; await first.reconcile();
    const second = await f.engine.start(f.plan, { ...request, taskId: 'verify', attemptId: 'second', requestId: 'request-second' });
    expect(binder.read('second')?.policyDigest).toBe(f.saved.digest);
    f.completions.get('second')!('succeeded'); await Promise.resolve(); await second.reconcile();
    const bad = fixture(3, root, true); bad.approve();
    bad.store.claim({ runId: 'run', taskId: 'make', attemptId: 'wrong', candidateId: 'checker', observedAtMs: 1000 });
    const other = createStageEnvelopeBinder(bad.db, { now: () => 1000, authorizeStage: () => true, resolveScope: () => { throw Error('unexpected fixture scope'); } });
    expect(() => other.bind({ workflowRunId: 'run', taskId: 'make', attemptId: 'wrong', parentEnvelope: bad.envelope, stage })).toThrow('stage_attempt_lineage');
  });
  it('reads exact typed policy identity and rejects conflicting or corrupt bindings without fallback', () => {
    const f = fixture(); const local = readRunPolicyIdentity(f.db, 'run');
    expect(local).toMatchObject({ kind: 'local-invocation', digest: f.saved.digest }); expect(Object.isFrozen(local)).toBe(true);
    const monetary = saveSelectionPolicy(f.db, { policyId: 'money', expectedRevision: null, createdAt: new Date(1000).toISOString(), sourceVersion: 'fixture',
      policy: { version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0, costBasis: 1, timeBasisMs: 1, currency: 'TEST', costLimit: null,
        remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['producer', 'checker'], pinnedCandidateId: null } });
    f.db.exec('DROP TRIGGER monetary_policy_excludes_local');
    f.db.prepare('INSERT INTO selection_run_policy VALUES(?,?,?,?,?)').run('run', monetary.policyId, monetary.revision, monetary.digest, new Date(1000).toISOString());
    expect(() => readRunPolicyIdentity(f.db, 'run')).toThrow('run_policy_identity_conflict');
    expect(() => createRequirementContractStore(f.db, { now: () => 1000, resolveChecker: () => undefined }).read('run')).toThrow('run_policy_identity_conflict');
    const corrupt = fixture(); corrupt.db.exec('DROP TRIGGER local_policy_no_update');
    corrupt.db.prepare("UPDATE local_selection_policy_snapshot SET policy_json='{}'").run();
    expect(() => readRunPolicyIdentity(corrupt.db, 'run')).toThrow();
  });
  it('commits count and stage before launch, uses M roles, and never makes count into acceptance', async () => {
    const f = fixture(); f.approve(); const first = await f.engine.start(f.plan, request);
    expect(first.selection).toMatchObject({ selected: true, ranking: 'not-performed', authority: 'none' });
    expect(f.truth.roles).toEqual(['model']); expect(f.budget.summary('run').committed).toBe(1);
    expect(f.db.prepare('SELECT count(*) n FROM integration_budget').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
    f.completions.get('first')!('succeeded'); await Promise.resolve(); f.truth.cleanup = true; f.truth.issue = true;
    expect(await first.reconcile()).toMatchObject({ state: 'completed', acceptance: 'unverified' });
    const second = await f.engine.start(f.plan, { ...request, taskId: 'verify', attemptId: 'second', requestId: 'request-second' });
    expect(second.candidateId).toBe('checker'); expect(f.truth.roles).toEqual(['model', 'model']);
    f.completions.get('second')!('succeeded'); await Promise.resolve(); await second.reconcile();
    expect(f.budget.summary('run').committed).toBe(2); expect(f.store.readiness('run').acceptance).toBe('unverified');
  });
  it('replays exact saved reservation and activity without relaunch or reobservation, including new engine instance', async () => {
    const f = fixture(); f.approve(); const first = await f.engine.start(f.plan, request);
    const other = createLocalOrchestrationEngine(f.db, f.managers, f.host);
    expect(await other.start(f.plan, request)).toMatchObject({ replayed: true, launch: 'not-relaunched', selection: first.selection, selectionAvailability: 'recorded' });
    expect(f.truth.launches).toEqual(['first']); expect(f.truth.observations).toBe(1); expect(f.budget.summary('run').committed).toBe(1);
    await expect(f.engine.start(f.plan, { ...request, timeoutMs: 999 })).rejects.toThrow('engine_replay_mismatch');
    await first.cancel(); f.completions.get('first')!('unknown');
  });
  it.each(['stage', 'async', 'cap', 'checks', 'stale', 'timeout'])('rolls back %s rejection without launching', async mode => {
    const f = fixture(mode === 'cap' ? 1 : 3); f.approve();
    if (mode === 'stage') f.truth.prepareFail = true;
    if (mode === 'async') f.truth.asyncPrepare = true;
    if (mode === 'checks') f.truth.checks = false;
    if (mode === 'stale') f.truth.now = 1101;
    let r = { ...request };
    if (mode === 'timeout') r.timeoutMs = 1001;
    if (mode === 'cap') {
      const first = await f.engine.start(f.plan, request); f.completions.get('first')!('succeeded'); await Promise.resolve(); f.truth.cleanup = true; f.truth.issue = true; await first.reconcile();
      r = { ...request, taskId: 'verify', attemptId: 'second', requestId: 'request-second' };
    }
    await expect(f.engine.start(f.plan, r)).rejects.toThrow();
    expect(f.truth.launches.length).toBe(mode === 'cap' ? 1 : 0);
    expect(f.budget.summary('run').committed).toBe(mode === 'cap' ? 1 : 0);
    expect(f.db.prepare('SELECT count(*) n FROM orchestration_activity').get()).toEqual({ n: mode === 'cap' ? 1 : 0 });
  });
  it('preserves unknown cleanup/count and refuses monetary receipt fields', async () => {
    const f = fixture(); f.approve(); const first = await f.engine.start(f.plan, request);
    f.completions.get('first')!('succeeded'); await Promise.resolve(); f.truth.issue = true; f.truth.billing = true;
    await expect(first.reconcile()).rejects.toThrow('local_engine_billing_or_receipt_fields');
    f.truth.billing = false; expect(await first.reconcile()).toMatchObject({ state: 'blocked' });
    expect(f.db.prepare("SELECT cleanup_verified FROM orchestration_attempt WHERE attempt_id='first'").get()).toEqual({ cleanup_verified: 0 });
    expect(f.budget.summary('run').committed).toBe(1);
    await expect(f.engine.start(f.plan, { ...request, taskId: 'verify', attemptId: 'second', requestId: 'two' })).rejects.toThrow('task_not_ready');
  });
  it('does not refund or infer cleanup after a thrown start', async () => {
    const f = fixture(); f.approve(); f.truth.failLaunch = true;
    const first = await f.engine.start(f.plan, request); expect(first.launch).toBe('denied-or-uncertain');
    expect(await first.reconcile()).toBeNull(); expect(f.budget.summary('run').committed).toBe(1);
    expect((await f.engine.start(f.plan, request)).launch).toBe('not-relaunched');
  });
  it('explicit trusted clean failure retry consumes another count and keeps the approved policy and criteria', async () => {
    const f = fixture(); const contract = f.retry(); f.approve();
    const first = await f.engine.start(f.plan, request); f.completions.get('first')!('failed'); await Promise.resolve();
    f.truth.issue = true; f.truth.cleanup = true; f.truth.failed = true; await first.reconcile();
    const r = { ...request, attemptId: 'retry', requestId: 'request-retry', retry: { previousAttemptId: 'first', receiptId: 'receipt-first', contractDigest: contract.digest } };
    const second = await f.engine.start(f.plan, r);
    expect(second.launch).toBe('started'); expect(f.budget.summary('run').committed).toBe(2);
    const decisions = createAttemptDecisionStore(f.db), original = decisions.read('first'), retried = decisions.read('retry');
    expect(original.snapshot?.policy).toEqual(retried.snapshot?.policy);
    expect(original.snapshot?.requestDigest).not.toBe(retried.snapshot?.requestDigest);
    expect(original.snapshot?.digest).not.toBe(retried.snapshot?.digest);
    expect((await f.engine.start(f.plan, r)).launch).toBe('not-relaunched'); expect(f.truth.launches).toEqual(['first', 'retry']);
    f.completions.get('retry')!('succeeded'); await Promise.resolve(); f.truth.failed = false; await second.reconcile();
  });
});
