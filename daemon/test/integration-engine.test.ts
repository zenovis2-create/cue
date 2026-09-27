import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createBudgetManager } from '../src/budget.js';
import { createIntegrationRuntime, type AdapterExecution, type ExecutionOutcome, type HostCandidate } from '../src/integration-runtime.js';
import { MODEL_PROBES, WRITE_PROBES } from '../src/capability-admission.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { bindRunSelectionPolicy, saveSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createOrchestrationEngine, selectionRevisionRef } from '../src/orchestration/engine.js';
import { bindAccountIdentities } from '../src/orchestration/account-binding.js';
import { readOrchestrationSnapshot } from '../src/ui/orchestration.js';

const dbs: Ledger[] = [];
afterEach(() => { for (const db of dbs.splice(0)) db.close(); });
function fixture(limit = 100, makerRole: 'implementation' | 'model-producer' = 'implementation', modelOnlyEvidence = false) {
  const db = openLedger(); dbs.push(db); for (const name of ['009_selection_policy.sql', '010_orchestration.sql']) db.exec(readFileSync(resolve('migrations', name), 'utf8'));
  const parentHash = 'e'.repeat(64);
  db.prepare("INSERT INTO task VALUES('task-run','running',NULL,'now')").run(); db.prepare("INSERT INTO envelope VALUES(?,'C:/fixture','[]','now')").run(parentHash); db.prepare("INSERT INTO run VALUES('run','task-run',?,0,'now')").run(parentHash);
  const policy = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: '2026-09-11T00:00:00.000Z', sourceVersion: 'fixture',
    policy: { version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 1000,
      currency: 'TEST', costLimit: null, remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['agent'], pinnedCandidateId: null } });
  bindRunSelectionPolicy(db, { runId: 'run', policyId: 'policy', revision: 1, digest: policy.digest, boundAt: '2026-09-11T00:00:00.000Z' });
  const approval = { policyRevision: selectionRevisionRef(policy), policyDigest: policy.digest, requirementIds: ['req'], allowedCandidateIds: ['agent'], allowedScopeIds: ['workspace'] };
  const plan = validateTaskPlan(approval, { revision: 'plan-1', policyRevision: approval.policyRevision, policyDigest: approval.policyDigest, tasks: [
    { id: 'make', role: makerRole, ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: ['agent'], scopeIds: ['workspace'] },
    { id: 'check', role: 'verifier', ownerId: 'checker', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: ['agent'], scopeIds: [] },
  ] });
  const truth = { claim: true, cleanup: false, receipt: false, finalBilling: false, attribution: null as null | Record<string, unknown>, costObservation: null as null | Record<string, unknown>, launches: 0, observations: 0, failLaunch: false, drift: false, now: 1000, deferred: false, cancels: 0, preparationFails: false, preparations: 0, resolvedRunId: '', resolvedRole: '' };
  const handoffBytes = Buffer.from('fixture verified output');
  const accountingEvidence = Buffer.from('fixture provider phase partition');
  const store = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => truth.claim,
    verifyReceipt: context => { const identity = db.prepare('SELECT identity_id FROM orchestration_attempt_identity WHERE attempt_id=?').get(context.attemptId) as { identity_id: string } | undefined;
      return { outcomeVerified: truth.receipt, cleanupVerified: truth.cleanup, ...(truth.receipt && truth.cleanup && identity ? { handoff: { handoffId: `handoff-${context.attemptId}`, identityId: identity.identity_id, artifacts: [{ kind: 'output', sourceRef: `output-${context.attemptId}` }] } } : {}) }; },
    authorizeHandoffArtifact: (ref, attemptId) => ref === `output-${attemptId}`,
    resolveHandoffArtifact: (ref, attemptId) => ref === `output-${attemptId}` ? handoffBytes : null });
  const budget = createBudgetManager(db, { verifyFinalReceipt: () => truth.finalBilling });
  budget.initialize({ runId: 'run', currency: 'TEST', unit: 'micro', limitUnits: limit, policyRevision: approval.policyRevision, source: 'explicit-host-mapping', observedAtMs: 1000 });
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key])) as MeasurementSubject;
  store.install('run',plan);db.transaction(()=>bindAccountIdentities(db,[{runId:'run',candidateId:'agent',authReference:'account.agent',toolId:'fixture-tool',sourceVersion:'fixture',subjectDigest:subjectDigest(subject),modelId:null,endpointId:null,planDigest:plan.digest,policyDigest:policy.digest,envelopeHash:parentHash}]))();
  const bytes = new Map<string, Buffer>(); const refs: Record<string, { id: string; sha256: string }> = {};
  for (const probe of modelOnlyEvidence ? MODEL_PROBES : [...MODEL_PROBES, ...WRITE_PROBES]) {
    const value = Buffer.from(JSON.stringify({ probe, subjectDigest: subjectDigest(subject), measuredAt: new Date(999).toISOString(), kind: 'live', status: 'pass' }));
    bytes.set(probe, value); refs[probe] = { id: probe, sha256: createHash('sha256').update(value).digest('hex') };
  }
  const completions = new Map<string, (outcome: ExecutionOutcome) => void>();
  let releaseLaunch: (() => void) | undefined;
  const candidate: HostCandidate = { kind: makerRole === 'model-producer' ? 'model' : 'agent', supportedRoles: makerRole === 'model-producer' ? ['model'] : ['implementation', 'model'], cancellation: 'supported', usage: 'unsupported', availability: 'ready',
    buildCurrentSubject: () => truth.drift ? { ...subject, adapterSha256: 'b'.repeat(64) } : subject, evidenceReferences: () => refs,
    async launch(context) { truth.launches++; expect(db.inTransaction).toBe(false);
      expect(budget.summary('run').committedUnits).toBeGreaterThan(0n);
      expect(db.prepare('SELECT state FROM orchestration_attempt WHERE attempt_id=?').get(context.runId)).toEqual({ state: 'running' });
      if (truth.failLaunch) throw Error('partial start');
      const durableHandle=`session-${context.runId}`;
      db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(durableHandle,123,'now','C:/fixture',`stage-task-${context.runId}`,context.runId);
      const execution: AdapterExecution = { completion: new Promise<ExecutionOutcome>(done => completions.set(context.runId, done)), async cancel() { truth.cancels++; } };
      Object.assign(execution,{durableRef:`session:${durableHandle}`});
      if (truth.deferred) return new Promise<AdapterExecution>(done => { releaseLaunch = () => done(execution); });
      return execution; },
  };
  const runtime = createIntegrationRuntime({ evidence: { now: () => 1000, maxAgeMs: 100, resolveEvidence: ref => bytes.get(ref.id) },
    resolveCandidate: (id, runId, role) => { truth.resolvedRunId = runId; truth.resolvedRole = role; return id === 'agent' ? candidate : undefined; }, authorizeRun: () => true,
    readLaunchIntent: attemptId => store.handoffActivity.readLaunchIntent(attemptId),
    recordAttemptIdentity: input => { store.handoffActivity.recordAttemptIdentity({ identityId: `identity-${input.attemptId}`, attemptId: input.attemptId, subjectDigest: input.subjectDigest, durableRef: input.durableRef, observedAtMs: input.observedAtMs }); },
    verifyCleanup: async context => ({ runId: context.runId, subjectDigest: context.subjectDigest, result: truth.cleanup ? 'verified-clean' : 'unknown', evidenceRef: 'fixture-cleanup' }) });
  const engine = createOrchestrationEngine(db, { store, budget, runtime }, {
    now: () => truth.now,
    observeCandidates() { truth.observations++; return [{ id: 'agent', checks: { eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true },
      estimate: { scope: 'verified-completion-total', quality: 1, expectedCost: 1, conservativeMaxCost: 1, expectedTimeMs: 1, conservativeMaxTimeMs: 1, currency: 'TEST', source: 'fixture', observedAtMs: 1000 } }]; },
    reservation: context => ({ runId: context.request.runId, requestId: context.request.requestId, attemptId: context.request.attemptId,
      currency: 'TEST', unit: 'micro', upperUnits: 60, source: 'explicit-host-upper', observedAtMs: 1000, scope: 'verified-completion-attempt-total' }),
    verifyBudgetMapping: () => true, authorizeExecution: () => true,
    prepareExecution: context => {
      truth.preparations++;
      expect(db.inTransaction).toBe(true);
      expect(db.prepare('SELECT state FROM orchestration_attempt WHERE attempt_id=?').get(context.request.attemptId)).toEqual({ state: 'running' });
      if (truth.preparationFails) throw Error('stage binding rejected');
      const stageHash = createHash('sha256').update(`stage\0${context.request.attemptId}`).digest('hex'), stageTask = `stage-task-${context.request.attemptId}`;
      db.prepare("INSERT INTO task VALUES(?,'running',NULL,'now')").run(stageTask);
      db.prepare("INSERT INTO envelope VALUES(?,'C:/fixture','[]','now')").run(stageHash);
      db.prepare("INSERT INTO run VALUES(?,?,?,0,'now')").run(context.request.attemptId,stageTask,stageHash);
      db.prepare('INSERT INTO orchestration_stage_envelope VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(context.request.attemptId,context.request.runId,context.request.taskId,stageTask,context.request.attemptId,parentHash,stageHash,plan.digest,policy.digest,'{}','{}','{}','{}');
    },
    recordLaunchIntent: context => { const stage = db.prepare('SELECT parent_envelope_hash,stage_envelope_hash,plan_digest,policy_digest FROM orchestration_stage_envelope WHERE attempt_id=?').get(context.request.attemptId) as any;
      const selection = db.prepare('SELECT digest FROM attempt_selection WHERE attempt_id=?').get(context.request.attemptId) as { digest: string };
      store.handoffActivity.recordLaunchIntent({ runId: context.request.runId, taskId: context.request.taskId, attemptId: context.request.attemptId, candidateId: context.candidateId,
        selectionDigest: selection.digest, expectedSubjectDigest: subjectDigest(subject), tool: { id: 'fixture-tool', revision: 'fixture-1' },
        model: makerRole === 'model-producer' ? { id: 'fixture-model', revision: 'fixture-1' } : null,
        parentEnvelopeHash: stage.parent_envelope_hash, stageEnvelopeHash: stage.stage_envelope_hash, planDigest: stage.plan_digest, policyDigest: stage.policy_digest }); },
    receipts: context => ({ execution: truth.receipt ? { runId: 'run', taskId: context.request.taskId, attemptId: context.request.attemptId,
      receiptId: `execution-${context.request.attemptId}`, revision: 1, outcome: 'succeeded', cleanup: truth.cleanup ? 'clean' : 'unknown', evidenceRef: 'host-proof', observedAtMs: 1001 } : null,
      billing: truth.finalBilling ? { runId: 'run', requestId: context.request.requestId, receiptId: `billing/${context.request.attemptId}`, revision: 1,
        currency: 'TEST', unit: 'micro', kind: 'actual', units: 20, providerFinal: true, source: 'host-proof', observedAtMs: 1001 } : null,
      ...(truth.attribution ? { attribution: truth.attribution } : {}), ...(truth.costObservation?{costObservation:truth.costObservation}:{}) }),
    resolveAccountingEvidence: ref => ref === 'provider-partition' ? accountingEvidence : null,
    resolveCostObservationSource: ref => ref === 'subscription-export' ? accountingEvidence : null,
  });
  return { db, engine, plan, store, budget, truth, completions, releaseLaunch: () => releaseLaunch!() };
}
const request = { runId: 'run', taskId: 'make', attemptId: 'attempt-1', requestId: 'request-1', observedAtMs: 1000, timeoutMs: 1000 };
describe('S2/S3 host engine bridge', () => {
  it('model producer selects only model runtime admission and never obtains a writer lease', async () => {
    const f = fixture(100, 'model-producer', true);
    const handle = await f.engine.start(f.plan, request);
    expect(handle.launch).toBe('started'); expect(f.truth.resolvedRole).toBe('model'); expect(f.truth.launches).toBe(1);
    expect(f.db.prepare('SELECT COUNT(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
    expect(f.db.prepare("SELECT write_in_progress FROM run WHERE id='run'").get()).toEqual({ write_in_progress: 0 });
    f.completions.get('attempt-1')!('succeeded'); await Promise.resolve(); f.truth.cleanup = true; f.truth.receipt = true;
    expect(await handle.reconcile()).toMatchObject({ state: 'completed', acceptance: 'unverified' });
    expect(f.store.readiness('run').readyTaskIds).toEqual(['check']);
    const legacy = fixture(100, 'implementation', true);
    expect((await legacy.engine.start(legacy.plan, request)).launch).toBe('denied-or-uncertain');
    expect(legacy.truth.resolvedRole).toBe('implementation'); expect(legacy.truth.launches).toBe(0);
  });
  it('stage preparation is atomic and runtime resolver receives the execution attempt identity', async () => {
    const failed = fixture(); failed.truth.preparationFails = true;
    await expect(failed.engine.start(failed.plan, request)).rejects.toThrow('stage binding rejected');
    expect(failed.truth.launches).toBe(0);
    expect(failed.budget.summary('run').committedUnits).toBe(0n);
    expect(failed.db.prepare('SELECT COUNT(*) n FROM orchestration_attempt').get()).toEqual({ n: 0 });
    const good = fixture(); await good.engine.start(good.plan, request);
    expect(good.truth.resolvedRunId).toBe(request.attemptId);
    await good.engine.start(good.plan, request);
    expect(good.truth.preparations).toBe(1);
  });
  it('real SQLite policy binding -> selection -> atomic reserve/claim -> adapter -> host receipts', async () => {
    const f = fixture(); const handle = await f.engine.start(f.plan, request); expect(handle.launch).toBe('started');
    expect(f.truth.launches).toBe(1); expect(f.budget.summary('run').committedUnits).toBe(60n);
    f.completions.get('attempt-1')!('succeeded'); await Promise.resolve(); f.truth.cleanup = true; f.truth.receipt = true; f.truth.finalBilling = true;
    expect(await handle.reconcile()).toMatchObject({ state: 'completed', acceptance: 'unverified' });
    expect(f.budget.summary('run').committedUnits).toBe(20n); expect(f.store.readiness('run').readyTaskIds).toEqual(['check']);
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
  });
  it('atomically persists a source-bound phase partition with final billing and clean handoff', async () => {
    const f = fixture();
    const handle = await f.engine.start(f.plan, request);
    f.completions.get('attempt-1')!('succeeded'); await Promise.resolve();
    f.truth.cleanup = true; f.truth.receipt = true; f.truth.finalBilling = true;
    const evidence = Buffer.from('fixture provider phase partition');
    f.truth.attribution = { version: 'cue-phase-cost-partition-v1', totalUnits: 20, baseUnits: 17, retryUnits: 0, verificationUnits: 0, handoffUnits: 3,
      evidenceRef: 'provider-partition', evidenceDigest: createHash('sha256').update(evidence).digest('hex'), observedAtMs: 1001 };
    expect(await handle.reconcile()).toMatchObject({ state: 'completed' });
    expect(f.db.prepare('SELECT request_id,total_units,base_units,retry_units,verification_units,handoff_units FROM handoff_cost_attribution').all()).toEqual([
      { request_id: 'request-1', total_units: 20, base_units: 17, retry_units: 0, verification_units: 0, handoff_units: 3 },
    ]);
    expect(f.budget.summary('run').committedUnits).toBe(20n);
  });
  it('ingests an explicit subscription observation without treating its units as money or billing authority', async()=>{
    const f=fixture(),handle=await f.engine.start(f.plan,request),evidence=Buffer.from('fixture provider phase partition');
    f.completions.get('attempt-1')!('succeeded');await Promise.resolve();f.truth.cleanup=true;f.truth.receipt=true;
    f.truth.costObservation={version:'cue-cost-capacity-observation-v1',candidateId:'agent',providerId:'fixture-tool',accountRef:'account.agent',costDimension:'subscription',costState:'estimated',units:7,currency:null,unit:'subscription-unit',sourceRef:'subscription-export',sourceDigest:createHash('sha256').update(evidence).digest('hex'),observedAtMs:1001,validUntilMs:1100,price:'unknown',quota:'available',gpu:'not-applicable',billing:'open'};
    expect(await handle.reconcile()).toMatchObject({state:'completed'});
    expect(f.db.prepare('SELECT cost_dimension,cost_state FROM orchestration_cost_observation').get()).toEqual({cost_dimension:'subscription',cost_state:'estimated'});
    expect(readOrchestrationSnapshot(f.db,'run',undefined,1200)?.attemptHistory[0]?.costObservation).toMatchObject({status:'observed',costDimension:'subscription',costState:'estimated',freshness:'stale',currency:null,unit:'subscription-unit'});
    expect(f.budget.summary('run').actualUnits).toBe(0n);
  });
  it('persists an explicit unknown API observation without inventing units or a receipt',async()=>{
    const f=fixture(),handle=await f.engine.start(f.plan,request),evidence=Buffer.from('fixture provider phase partition');
    f.completions.get('attempt-1')!('succeeded');await Promise.resolve();f.truth.cleanup=true;f.truth.receipt=true;
    f.truth.costObservation={version:'cue-cost-capacity-observation-v1',candidateId:'agent',providerId:'fixture-tool',accountRef:'account.agent',costDimension:'api',costState:'unknown',units:null,currency:'TEST',unit:'micro',sourceRef:'subscription-export',sourceDigest:createHash('sha256').update(evidence).digest('hex'),observedAtMs:1001,validUntilMs:1100,price:'unknown',quota:'unknown',gpu:'not-applicable',billing:'unknown'};
    await handle.reconcile();
    expect(readOrchestrationSnapshot(f.db,'run',undefined,1050)?.attemptHistory[0]?.costObservation).toMatchObject({status:'observed',costDimension:'api',costState:'unknown',units:null,freshness:'fresh',billing:'unknown'});
    expect(f.db.prepare('SELECT count(*) n FROM integration_budget_receipt').get()).toEqual({n:0});
    expect(f.budget.summary('run').committedUnits).toBe(60n);
  });
  it('rolls back terminal settlement when cost source bytes do not match',async()=>{
    const f=fixture(),handle=await f.engine.start(f.plan,request);
    f.completions.get('attempt-1')!('succeeded');await Promise.resolve();f.truth.cleanup=true;f.truth.receipt=true;
    f.truth.costObservation={version:'cue-cost-capacity-observation-v1',candidateId:'agent',providerId:'fixture-tool',accountRef:'account.agent',costDimension:'api',costState:'unknown',units:null,currency:'TEST',unit:'micro',sourceRef:'subscription-export',sourceDigest:'f'.repeat(64),observedAtMs:1001,validUntilMs:1100,price:'unknown',quota:'unknown',gpu:'not-applicable',billing:'unknown'};
    await expect(handle.reconcile()).rejects.toThrow('persisted_cost_observation_source');
    expect(f.db.prepare('SELECT count(*) n FROM orchestration_cost_observation').get()).toEqual({n:0});
    expect(f.db.prepare("SELECT state FROM orchestration_attempt WHERE attempt_id='attempt-1'").get()).toEqual({state:'running'});
    expect(f.budget.summary('run').committedUnits).toBe(60n);
  });
  it('exact replay does not reobserve, reserve or relaunch; conflicting replay rejects', async () => {
    const f = fixture(); await f.engine.start(f.plan, request); f.truth.claim = false;
    expect(await f.engine.start(f.plan, request)).toMatchObject({ replayed: true, launch: 'not-relaunched' });
    expect(f.truth.launches).toBe(1); expect(f.truth.observations).toBe(1); expect(f.budget.summary('run').committedUnits).toBe(60n);
    await expect(f.engine.start(f.plan, { ...request, timeoutMs: 1001 })).rejects.toThrow(/replay/);
  });
  it('denied claim leaves no reservation; insufficient funds roll back claimed task and writer lease', async () => {
    const a = fixture(); a.truth.claim = false; await expect(a.engine.start(a.plan, request)).rejects.toThrow(/claim_not_authorized/);
    expect(a.budget.summary('run').committedUnits).toBe(0n); expect(a.truth.launches).toBe(0);
    const b = fixture(59); await expect(b.engine.start(b.plan, request)).rejects.toThrow(/limit_exceeded/);
    expect(b.db.prepare('SELECT count(*) n FROM orchestration_attempt').get()).toEqual({ n: 0 });
    expect(b.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
    expect(b.truth.launches).toBe(0); expect(b.budget.summary('run').committedUnits).toBe(0n);
  });
  it('policy mismatch never mutates budget or invokes the adapter', async () => {
    const f = fixture(); const approval = { ...f.plan.approval, policyDigest: 'c'.repeat(64) };
    const wrong = validateTaskPlan(approval, { revision: f.plan.revision, policyRevision: approval.policyRevision, policyDigest: approval.policyDigest, tasks: f.plan.tasks });
    await expect(f.engine.start(wrong, request)).rejects.toThrow(/policy_plan_mismatch/); expect(f.truth.launches).toBe(0);
    expect(f.budget.summary('run').committedUnits).toBe(0n);
  });
  it('current runtime admission overrides optimistic host observations and retains uncertain funds', async () => {
    const f = fixture(); f.truth.drift = true;
    expect(await f.engine.start(f.plan, request)).toMatchObject({ launch: 'denied-or-uncertain', reason: 'ineligible' });
    expect(f.truth.launches).toBe(0); expect(f.budget.summary('run').committedUnits).toBe(60n);
  });
  it('partial start and cancel ACK cannot unlock a writer or invent final billing', async () => {
    const f = fixture(); f.truth.failLaunch = true;
    expect(await f.engine.start(f.plan, request)).toMatchObject({ launch: 'denied-or-uncertain' });
    expect(f.budget.summary('run').committedUnits).toBe(60n);
    const g = fixture(); const running = await g.engine.start(g.plan, request); await running.cancel(); g.truth.receipt = true;
    expect(await running.reconcile()).toMatchObject({ state: 'blocked' });
    await expect(g.engine.start(g.plan, { ...request, attemptId: 'replacement', requestId: 'replacement' })).rejects.toThrow(/task_not_ready/);
    expect(g.budget.summary('run').committedUnits).toBe(60n); expect(g.truth.launches).toBe(1);
    expect(g.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 1 });
  });
  it('concurrent replay cannot release ownership while a deferred launch may still create effects', async () => {
    const f = fixture(); f.truth.deferred = true;
    const pending = f.engine.start(f.plan, request);
    const replay = await f.engine.start(f.plan, request);
    f.truth.cleanup = true; f.truth.receipt = true; f.truth.finalBilling = true;
    expect(await replay.reconcile()).toBeNull();
    expect(f.budget.summary('run').committedUnits).toBe(60n);
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 1 });
    expect(await replay.cancel()).toBe('requested');
    const original = await pending; expect(original.launch).toBe('denied-or-uncertain');
    // Published runtime still knows its underlying adapter launch is pending.
    await expect(replay.reconcile()).rejects.toThrow(/cleanup_unverified/);
    expect(f.budget.summary('run').committedUnits).toBe(60n);
    f.releaseLaunch(); await new Promise(done => setImmediate(done));
    expect(f.truth.launches).toBe(1); expect(f.truth.cancels).toBe(1);
    f.truth.receipt = false; f.truth.finalBilling = false;
    expect(await replay.reconcile()).toBeNull();
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 1 });
  });
  it('old request timestamps cannot make stale estimates fresh against the host clock', async () => {
    const f = fixture(); f.truth.now = 2000;
    await expect(f.engine.start(f.plan, request)).rejects.toThrow(/stale_request/);
    await expect(f.engine.start(f.plan, { ...request, observedAtMs: 2000 })).rejects.toThrow(/no-eligible/);
    expect(f.truth.launches).toBe(0); expect(f.budget.summary('run').committedUnits).toBe(0n);
  });
});
