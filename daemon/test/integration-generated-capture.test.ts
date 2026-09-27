import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { createRequirementContractStore, type RequirementKind } from '../src/verification/requirements.js';
import { createGeneratedOutputStore, generatedOutputParametersDigest, type GeneratedOutputParameters, type GeneratedOutputHost } from '../src/verification/generated-output.js';
import { createGeneratedModelOutput } from '../src/adapters/generated-model-output.js';
import { createIsolatedModelCleanup } from '../src/adapters/isolated-model-cleanup.js';
import { recordSession } from '../src/session-spawn.js';
import type { RuntimeContext } from '../src/integration-runtime.js';
import type { IsolatedModelResult } from '../src/adapters/isolated-local-model.js';
const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function fixture(kind: RequirementKind = 'document', makerRole: 'model-producer' | 'implementation' = 'model-producer') {
  const root = mkdtempSync(join(tmpdir(), 'cue-generated-')); roots.push(root); const path = join(root, 'ledger.db');
  const db = openLedger(path); handles.push(db); db.pragma('foreign_keys=ON');
  const parent = normalizeEnvelope({ run_id: 'run', worktree_realpath: root, allowed_actions: [], egress: [], expires_at: new Date(10000).toISOString(), autonomy_level: 'bounded' });
  const hash = envelopeHash(parent);
  db.prepare("INSERT INTO task VALUES('root','awaiting_approval',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(hash, root);
  db.prepare("INSERT INTO run VALUES('run','root',?,0,'now')").run(hash);
  const policy = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: new Date(1000).toISOString(), sourceVersion: 'fixture', policy: {
    version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 1, currency: 'TEST', costLimit: null,
    remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['model'], pinnedCandidateId: 'model',
  } });
  bindRunSelectionPolicy(db, { runId: 'run', policyId: 'policy', revision: 1, digest: policy.digest, boundAt: new Date(1000).toISOString() });
  const plan = validateTaskPlan({ policyRevision: 'policy:1', policyDigest: policy.digest, requirementIds: ['req'], allowedCandidateIds: ['model'], allowedScopeIds: [] },
    { revision: 'plan1', policyRevision: 'policy:1', policyDigest: policy.digest, tasks: [
      { id: 'make', role: makerRole, ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: ['model'], scopeIds: [] },
      { id: 'check', role: 'verifier', ownerId: 'reviewer', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: ['model'], scopeIds: [] },
    ] });
  const artifactBytes = Buffer.from('fixture handoff bytes');
  const scheduler = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true,
    verifyReceipt: context => ({ outcomeVerified: true, cleanupVerified: true, handoff: { handoffId: `handoff-${context.attemptId}`, identityId: `identity-${context.attemptId}`, artifacts: [{ kind: 'output', sourceRef: `artifact-${context.attemptId}` }] } }),
    resolveHandoffArtifact: (sourceRef, attemptId) => sourceRef === `artifact-${attemptId}` ? artifactBytes : null,
    authorizeHandoffArtifact: (sourceRef, attemptId) => sourceRef === `artifact-${attemptId}`,
    retry: { now: () => 1000, authorizeContract: () => true,
      classifyFailure: () => ({ cause: 'transient', sourceRef: 'host-proof', sourceDigest: 'a'.repeat(64), observedAtMs: 1000 }) } });
  scheduler.install('run', plan);
  const input = Buffer.from('{"message":"preserve this source value"}');
  const parameters: GeneratedOutputParameters = { version: 'cue-generated-output-v1', kind: 'generated-output', targetId: 'answer', requirementId: 'req', producerTaskId: 'make',
    checkerId: 'preserve-json-value', checkerRevision: 'v1', inputSha256: sha(input), maxBytes: 4096 };
  const requirementStore = createRequirementContractStore(db, { now: () => 1000, resolveChecker: (id, revision) => ({ id, revision, kinds: [kind], evidencePolicies: [{
    requirementId: 'req', kind, producerTaskIds: ['make'], sourceRevision: parameters.inputSha256, targetIds: ['answer'], checkerId: id,
    checkerRevision: revision, parametersDigest: generatedOutputParametersDigest(parameters), hostileCheckIds: [], requiredSectionIds: kind === 'document' ? ['json-document'] : [],
    claimIds: kind === 'research' ? ['claim'] : [], requiresRender: false,
    ...(kind === 'external' ? { remote: { accountId: 'account', resourceId: 'resource', operationId: 'operation', idempotencyKey: 'key', expectedTransition: 'updated', observerId: 'observer', observerRevision: 'v1' } } : {}),
  }] }) });
  const requirements = requirementStore.bind('run', [{ id: 'req', text: 'Produce the approved document response', kind, required: true,
    checks: [{ checkerId: parameters.checkerId, revision: parameters.checkerRevision, parametersDigest: generatedOutputParametersDigest(parameters), targetIds: ['answer'] }] }]);
  expect(requirements.requirements.evidencePolicies[0]).toMatchObject({ sourceRevision: parameters.inputSha256, targetIds: ['answer'], parametersDigest: generatedOutputParametersDigest(parameters) });
  const flags = { allowed: true, now: 1000, authorizations: 0, mutateCopy: false };
  const host: GeneratedOutputHost = { now: () => flags.now, authorizeObservation: context => {
    flags.authorizations++; expect(context.stage.owner.run_id).toBe(context.record.attemptId);
    expect(context.target.parametersDigest).toBe(generatedOutputParametersDigest(parameters));
    expect(Object.isFrozen(context.record)).toBe(true);
    if (flags.mutateCopy) context.bytes.fill(0);
    return flags.allowed;
  } };
  const output = createGeneratedOutputStore(db, host);
  const targetInput = { runId: 'run', targetId: 'answer', requirementId: 'req', producerTaskId: 'make', checkerId: parameters.checkerId,
    checkerRevision: parameters.checkerRevision, inputBytes: input, maxBytes: 4096, boundAtMs: 1000 };
  const approve = () => { db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal',0,'accept','now')").run(hash); db.prepare("UPDATE task SET state='running' WHERE id='root'").run(); };
  const binder = createStageEnvelopeBinder(db, { now: () => 1000, authorizeStage: () => true, resolveScope: () => { throw Error('no-scope'); } });
  const stage = (attemptId = 'first', taskId = 'make', retryDigest?: string) => {
    const request = { runId: 'run', taskId, attemptId, candidateId: 'model', observedAtMs: 1000 };
    if (retryDigest) scheduler.claimRetry({ ...request, retry: { previousAttemptId: 'first', receiptId: 'receipt-first', contractDigest: retryDigest } });
    else scheduler.claim(request);
    return binder.bind({ workflowRunId: 'run', taskId, attemptId, parentEnvelope: parent,
      stage: { worktreeRealpath: root, allowedActions: [], egress: [], expiresAt: parent.expires_at, autonomyLevel: 'bounded' } });
  };
  const finish = (outcome: 'failed' | 'succeeded' = 'failed') => scheduler.finish({ runId: 'run', taskId: 'make', attemptId: 'first', receiptId: 'receipt-first', revision: 1, outcome, cleanup: 'clean', evidenceRef: 'host-receipt', observedAtMs: 1000 });
  const observation = (attemptId = 'first') => ({ runId: 'run', targetId: 'answer', attemptId, observationId: `response-${attemptId}`, observedAtMs: flags.now, bytes: Buffer.from('actual response bytes') });
  return { db, path, output, host, flags, parameters, targetInput, approve, stage, finish, observation, scheduler, requirements };
}

function captureFixture() {
  const f = fixture(); f.output.bindTarget(f.targetInput); f.approve(); const stage = f.stage();
  const abort = new AbortController();
  const context: RuntimeContext = { runId: 'first', candidateId: 'model', role: 'model', subjectDigest: 'b'.repeat(64), signal: abort.signal };
  const session = { ...stage.owner, pid: 999999, start_time: 'host-process-start', handle: 'session-first' }; recordSession(f.db, session);
  let deliver!: (value: IsolatedModelResult) => void, reject!: (reason: Error) => void;
  const pending = new Promise<IsolatedModelResult>((resolve, fail) => { deliver = resolve; reject = fail; });
  const execution = { session, result: pending, completion: pending.then(value => value.outcome), cancel: async () => { calls.cancel++; } };
  const calls = { launched: 0, cancel: 0 };
  const bridge = createGeneratedModelOutput({ db: f.db, now: () => f.flags.now,
    launch: async (actual, approved) => {
      calls.launched++; expect(actual).toBe(context); expect(approved.stage.owner).toEqual(stage.owner);
      expect(approved.target.targetId).toBe('answer'); expect(approved.inputText).toBe(Buffer.from(f.targetInput.inputBytes).toString());
      expect(Object.isFrozen(approved)).toBe(true); return execution;
    } });
  const response = (changes: Partial<IsolatedModelResult> = {}): IsolatedModelResult => ({ outcome: 'succeeded', attemptId: 'first', requestId: 'actual-request',
    text: '{"returned":"answer bytes"}', usage: null, terminal: null, observations: {}, cleanup: 'unknown', providerStopped: 'unknown', ...changes });
  return { ...f, context, session, abort, calls, bridge, execution, deliver, reject, response };
}

describe('S4 host-owned generated response capture bridge', () => {
  it('captures exact owned UTF8 answer before exposing success and persists after reopen without completing any task', async () => {
    const f = captureFixture(), execution = await f.bridge.launch(f.context); f.deliver(f.response());
    expect(await execution.completion).toBe('succeeded'); expect((await execution.capture).status).toBe('recorded');
    const stored = f.output.read('run', 'answer', 'first')!;
    expect(Buffer.from(stored.bytes).toString()).toBe(f.response().text);
    expect(stored.record.sha256).toBe(sha(Buffer.from(f.response().text!)));
    expect(f.db.prepare("SELECT state,cleanup_verified FROM orchestration_attempt WHERE attempt_id='first'").get()).toEqual({ state: 'running', cleanup_verified: 0 });
    expect(f.db.prepare("SELECT state FROM task WHERE id='root'").get()).toEqual({ state: 'running' });
    expect(f.db.prepare('SELECT count(*) n FROM acceptance_final').get()).toEqual({ n: 0 });
    f.db.close(); const reopened = openLedger(f.path); handles.push(reopened);
    expect(createGeneratedOutputStore(reopened, { now: () => 1000, authorizeObservation: () => false }).read('run', 'answer', 'first')!.record).toEqual(stored.record);
  });
  it('refuses duplicate launches, wrong model context and missing targets without executor calls', async () => {
    const f = captureFixture(); const execution = await f.bridge.launch(f.context);
    await expect(f.bridge.launch(f.context)).rejects.toThrow('duplicate');
    await expect(f.bridge.launch({ ...f.context, role: 'implementation' })).rejects.toThrow('model_context');
    await expect(f.bridge.launch({ ...f.context, candidateId: 'foreign' })).rejects.toThrow('attempt');
    await expect(f.bridge.launch({ ...f.context, runId: 'missing' })).rejects.toThrow('attempt');
    expect(f.calls.launched).toBe(1); f.deliver(f.response()); await execution.completion;
  });
  it('preserves failed late responses after cancellation as history, without cleanup or acceptance grants', async () => {
    const f = captureFixture(), execution = await f.bridge.launch(f.context);
    f.abort.abort(); await execution.cancel(); expect(f.calls.cancel).toBe(1); f.finish('failed');
    f.deliver(f.response({ outcome: 'failed', text: 'late actual answer' }));
    expect(await execution.completion).toBe('failed'); expect((await execution.result).outcome).toBe('failed');
    expect((await execution.capture).status).toBe('recorded');
    expect(Buffer.from(f.output.read('run', 'answer', 'first')!.bytes).toString()).toBe('late actual answer');
    expect(f.db.prepare("SELECT state FROM orchestration_attempt WHERE attempt_id='first'").get()).toEqual({ state: 'blocked' });
  });
  it('rejects foreign response IDs, empty/oversized bytes, invalid unicode and model success without text consistently', async () => {
    for (const changes of [{ attemptId: 'foreign' }, { requestId: '' }, { text: '' }, { text: 'x'.repeat(4097) }, { text: '\ud800' }, { text: null }]) {
      const f = captureFixture(), execution = await f.bridge.launch(f.context); f.deliver(f.response(changes));
      expect(await execution.completion).toBe('unknown'); expect((await execution.result).outcome).toBe('unknown');
      expect((await execution.capture).status).toBe('unknown'); expect(f.output.read('run', 'answer', 'first')).toBeNull();
    }
  });
  it('rechecks actual session, context and target lineage after delayed response', async () => {
    for (const mutate of [
      (f: ReturnType<typeof captureFixture>) => { f.session.pid++; },
      (f: ReturnType<typeof captureFixture>) => { (f.context as { candidateId: string }).candidateId = 'foreign'; },
      (f: ReturnType<typeof captureFixture>) => { f.db.prepare("UPDATE session_handle SET start_time='reused' WHERE handle='session-first'").run(); },
      (f: ReturnType<typeof captureFixture>) => { f.db.exec('DROP TRIGGER generated_target_no_update'); f.db.prepare('UPDATE generated_output_target SET input_bytes=?').run(Buffer.from('drift')); },
    ]) {
      const f = captureFixture(), execution = await f.bridge.launch(f.context); mutate(f); f.deliver(f.response());
      expect(await execution.completion).toBe('unknown'); expect((await execution.capture).status).toBe('unknown');
      expect(f.db.prepare('SELECT count(*) n FROM generated_output_observation').get()).toEqual({ n: 0 });
    }
  });
  it('keeps rejection observed, exposes unknown capture and preserves cancel control', async () => {
    const f = captureFixture(), execution = await f.bridge.launch(f.context); f.reject(Error('owned process failed'));
    expect(await execution.completion).toBe('unknown'); await expect(execution.result).rejects.toThrow('owned process failed');
    expect(await execution.capture).toEqual({ status: 'unknown', reason: 'execution_rejected' }); await execution.cancel(); expect(f.calls.cancel).toBe(1);
  });
  it('composes cleanup outside capture and never upgrades fixture cleanup claims to verified', async () => {
    const f = captureFixture();
    const cleanup = createIsolatedModelCleanup({ db: f.db, launch: f.bridge.launch, taskRootBase: 'C:\\fixture-tasks', profileRootBase: 'C:\\fixture-profiles', persistObservation: async () => 'fixture-evidence' });
    const execution = await cleanup.launch(f.context); f.deliver(f.response()); await execution.completion;
    expect((await cleanup.verifyCleanup(f.context, execution)).result).toBe('unknown');
    expect(f.output.read('run', 'answer', 'first')).not.toBeNull();
  });
});
