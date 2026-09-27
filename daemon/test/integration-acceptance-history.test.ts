import { applyOrchestrationRetryMigration } from '../src/orchestration/retry-migration.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { createRequirementContractStore, type RequirementKind } from '../src/verification/requirements.js';
import { createBudgetManager } from '../src/budget.js';
import { readAcceptanceHistory, createAcceptanceVerifier, type AcceptanceHost, type AcceptanceChecker, type AcceptanceManifest, type RawCheckerObservation, type CheckerContext } from '../src/verification/acceptance.js';
import type { EvidenceObservation } from '../src/verification/evidence-policy.js';
const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const kinds: RequirementKind[] = ['code', 'research', 'document', 'external'];
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
function fixture(multipleMakers = false, withRetry = false) {
  const root = mkdtempSync(join(tmpdir(), 'cue-acceptance-')); roots.push(root);
  const db = openLedger(join(root, 'ledger.db')); handles.push(db);
  for (const file of ['009_selection_policy.sql', '010_orchestration.sql', '012_stage_envelope.sql', '013_requirement_contract.sql', '014_requirement_acceptance.sql']) db.exec(readFileSync(resolve('migrations', file), 'utf8'));
  if (withRetry) applyOrchestrationRetryMigration(db);
  const clock = Date.parse('2026-09-11T00:00:00.000Z');
  const parent = normalizeEnvelope({ run_id: 'run', worktree_realpath: root, allowed_actions: ['file_change'], egress: [], expires_at: new Date(clock + 3600000).toISOString(), autonomy_level: 'bounded' });
  const parentHash = envelopeHash(parent);
  db.prepare("INSERT INTO task VALUES('root-task','awaiting_approval',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(parentHash, root);
  db.prepare("INSERT INTO run VALUES('run','root-task',?,0,'now')").run(parentHash);
  const policy = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: new Date(clock).toISOString(), sourceVersion: 'fixture', policy: {
    version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: .5, costBasis: 1, timeBasisMs: 1000, currency: 'TEST', costLimit: null, remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['agent'], pinnedCandidateId: null,
  } });
  bindRunSelectionPolicy(db, { runId: 'run', policyId: 'policy', revision: 1, digest: policy.digest, boundAt: new Date(clock).toISOString() });
  const approval = { policyRevision: 'policy:1', policyDigest: policy.digest, requirementIds: kinds, allowedCandidateIds: ['agent'], allowedScopeIds: ['workspace'] };
  const plan = validateTaskPlan(approval, { revision: 'plan1', policyRevision: approval.policyRevision, policyDigest: approval.policyDigest, tasks: [
    { id: 'make', role: 'implementation', ownerId: 'maker', requirementIds: kinds, dependencyIds: [], candidateIds: ['agent'], scopeIds: ['workspace'] },
    ...(multipleMakers ? [{ id: 'make-extra', role: 'implementation' as const, ownerId: 'other-maker', requirementIds: kinds, dependencyIds: [], candidateIds: ['agent'], scopeIds: ['workspace'] }] : []),
    { id: 'check', role: 'verifier', ownerId: 'reviewer', requirementIds: kinds, dependencyIds: multipleMakers ? ['make', 'make-extra'] : ['make'], candidateIds: ['agent'], scopeIds: [] },
  ] });
  const artifactBytes=Buffer.from('acceptance-history-fixture-artifact');
  const store = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true,
    verifyReceipt: context => ({ outcomeVerified: true, cleanupVerified: true, handoff:{handoffId:`handoff-${context.attemptId}`,identityId:`identity-${context.attemptId}`,artifacts:[{kind:'output',sourceRef:`artifact-${context.attemptId}`}]}}),
    resolveHandoffArtifact:()=>artifactBytes,authorizeHandoffArtifact:()=>true,
    retry: { now: () => clock, authorizeContract: () => true, classifyFailure: () => ({ cause: 'transient', sourceRef: 'host-retry', sourceDigest: hash('retry'), observedAtMs: clock }) } });
  store.install('run', plan);
  const requirementStore = createRequirementContractStore(db, { now: () => clock, resolveChecker: (id, revision) => {const kind=kinds.find(value=>id===`checker-${value}`);if(!kind)return undefined;return {id,revision,kinds:[kind],evidencePolicies:[{
    requirementId:kind,kind,producerTaskIds:plan.tasks.filter(task=>task.role!=='verifier').map(task=>task.id),sourceRevision:plan.digest,targetIds:[`target-${kind}`],checkerId:id,checkerRevision:revision,parametersDigest:hash(kind),hostileCheckIds:kind==='code'?['negative']:[],requiredSectionIds:kind==='document'?['approved-section']:[],claimIds:kind==='research'?['approved-claim']:[],requiresRender:kind==='document',...(kind==='external'?{remote:{accountId:'account',resourceId:'resource',operationId:'operation',idempotencyKey:'key',expectedTransition:'updated',observerId:'remote-reader',observerRevision:'v1'}}:{})
  }]};} });
  requirementStore.bind('run', kinds.map(kind => ({ id: kind, text: `${kind} approved criterion`, kind, required: true, checks: [{ checkerId: `checker-${kind}`, revision: 'v1', parametersDigest: hash(kind), targetIds: [`target-${kind}`] }] })));
  const retryContract = withRetry ? store.bindRetryContract({ runId: 'run', requirementsDigest: requirementStore.read('run')!.requirements.digest, maxAttemptsPerTask: 3, maxAttemptsTotal: 8, boundAtMs: clock, deadlineMs: clock + 30000 }) : null;
  db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal',0,'accept','now')").run(parentHash);
  db.prepare("UPDATE task SET state='running' WHERE id='root-task'").run();
  const binder = createStageEnvelopeBinder(db, { now: () => clock, authorizeStage: () => true, resolveScope: id => ({ id, worktreeRealpath: root, allowedActions: parent.allowed_actions, egress: [] }) });
  const attest=(task:string,attemptId:string,stage:any)=>{const selectionDigest=hash(`selection-${attemptId}`),session=`session-${attemptId}`;
    db.prepare("INSERT INTO attempt_selection VALUES(?,'run',?,'monetary',?,'{}')").run(attemptId,`fixture-${attemptId}`,selectionDigest);
    db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(session,1,'now',root,stage.owner.task_id,stage.owner.run_id);
    store.handoffActivity.recordLaunchIntent({runId:'run',taskId:task,attemptId,candidateId:'agent',selectionDigest,expectedSubjectDigest:hash(attemptId),tool:{id:'fixture-tool',revision:'unknown'},model:null,parentEnvelopeHash:parentHash,stageEnvelopeHash:stage.envelopeHash,planDigest:stage.planDigest,policyDigest:stage.policyDigest});
    store.handoffActivity.recordAttemptIdentity({identityId:`identity-${attemptId}`,attemptId,subjectDigest:hash(attemptId),durableRef:`session:${session}`,observedAtMs:clock});};
  for (const task of multipleMakers ? ['make', 'make-extra', 'check'] : ['make', 'check']) {
    const attemptId = `attempt-${task}`;
    if (withRetry && task === 'make') {
      store.claim({ runId: 'run', taskId: task, attemptId: 'failed-maker', candidateId: 'agent', observedAtMs: clock });
      const failedStage=binder.bind({ workflowRunId: 'run', taskId: task, attemptId: 'failed-maker', parentEnvelope: parent, stage: { worktreeRealpath: root, allowedActions: ['file_change'], egress: [], expiresAt: parent.expires_at, autonomyLevel: 'supervised' } });
      attest(task,'failed-maker',failedStage);
      store.finish({ runId: 'run', taskId: task, attemptId: 'failed-maker', receiptId: 'failed-maker-receipt', revision: 1, outcome: 'failed', cleanup: 'clean', evidenceRef: 'host-failure', observedAtMs: clock });
      store.claimRetry({ runId: 'run', taskId: task, attemptId, candidateId: 'agent', observedAtMs: clock, retry: { previousAttemptId: 'failed-maker', receiptId: 'failed-maker-receipt', contractDigest: retryContract!.digest } });
    } else store.claim({ runId: 'run', taskId: task, attemptId, candidateId: 'agent', observedAtMs: clock });
    const stage=binder.bind({ workflowRunId: 'run', taskId: task, attemptId, parentEnvelope: parent, stage: { worktreeRealpath: root, allowedActions: task.startsWith('make') ? ['file_change'] : [], egress: [], expiresAt: parent.expires_at, autonomyLevel: 'supervised' } });
    attest(task,attemptId,stage);
    store.finish({ runId: 'run', taskId: task, attemptId, receiptId: `finished-${task}`, revision: 1, outcome: 'succeeded', cleanup: 'clean', evidenceRef: 'fixture-completion', observedAtMs: clock });
  }
  const budget = createBudgetManager(db, { verifyFinalReceipt: () => false });
  budget.initialize({ runId: 'run', currency: 'TEST', unit: 'micro', limitUnits: 100, policyRevision: 'policy:1', source: 'fixture', observedAtMs: clock });
  budget.reserve({ runId: 'run', requestId: 'bill', attemptId: 'attempt-make', currency: 'TEST', unit: 'micro', upperUnits: 50, source: 'pending-fixture', observedAtMs: clock, scope: 'verified-completion-attempt-total' });
  const flags = { now: clock, available: true, collision: false, missingPrincipal: false, current: true, rawMode: 'valid', manifestMode: 'valid', hang: false, delayMs: 0, captured: 0, aborted: false, lockSeen: false, onCurrent: undefined as (() => void) | undefined };
  const registry = new Map<string, AcceptanceChecker>();
  for (const kind of kinds) registry.set(`checker-${kind}`, {
    id: `checker-${kind}`, revision: 'v1', kinds: [kind], evidencePolicies:requirementStore.read('run')!.requirements.evidencePolicies.filter(policy=>policy.kind===kind),
    async collect(context, signal) {
      flags.captured++; signal.addEventListener('abort', () => { flags.aborted = true; });
      if (flags.hang) return await new Promise<RawCheckerObservation>(() => {});
      if (flags.delayMs) await new Promise(done => setTimeout(done, flags.delayMs));
      const targets=context.targets.map(target=>({targetId:target.targetId,kind:target.kind,byteLength:target.sizeBytes,digest:target.digest,...(kind==='research'?{sourceIdentity:'retrieved-source',retrievedAtMs:flags.now}:{}),...(kind==='external'?{accountId:'account',resourceId:'resource',operationId:'operation',idempotencyKey:'key',transition:'updated',observerId:'remote-reader',observerRevision:'v1',observedAtMs:flags.now}:{})}));
      const evidence:EvidenceObservation={origin:'host-observation',checkerId:context.check.checkerId,checkerRevision:context.check.revision,checkerPrincipal:context.reviewerPrincipal,producerAttemptPrincipal:context.producerPrincipals[0]??'',parametersDigest:context.check.parametersDigest,observedAtMs:flags.now,sourceRevision:context.evidencePolicy.sourceRevision,exitStatus:0,targetManifestDigest:hash(JSON.stringify(targets)),verdict:'pass',hostileChecks:kind==='code'?['negative']:[],claimSourceMap:kind==='research'?{'approved-claim':['target-research']} as Record<string,readonly string[]>:{},requirementSections:kind==='document'?['approved-section']:[],renderVerified:kind==='document',targets};
      const raw: RawCheckerObservation = { contextDigest: context.digest, principalId: context.reviewerPrincipal, sourceRefs: ['host-check/source'], observedAt: flags.now, origin: 'host-observation', bytes: Buffer.from(JSON.stringify({ assertions: 3, failures: 0 })),evidence };
      if (flags.rawMode === 'self-report') return { ...raw, origin: 'model-report' };
      if (flags.rawMode === 'model-json') return { ...raw, bytes: Buffer.from('{"pass":true}') };
      if (flags.rawMode === 'wrong-lineage') return { ...raw, contextDigest: hash('another-run-plan-policy-parameters') };
      if (flags.rawMode === 'empty') return { ...raw, bytes: new Uint8Array() };
      if (flags.rawMode === 'missing-source') return { ...raw, sourceRefs: [] };
      if (flags.rawMode === 'fail') return { ...raw, bytes: Buffer.from('{"assertions":3,"failures":1}'),evidence:{...evidence,verdict:'fail'} };
      return raw;
    },
    evaluate(_context, raw) { const parsed = JSON.parse(Buffer.from(raw.bytes).toString()); return Number.isSafeInteger(parsed.assertions) && parsed.assertions > 0 && Number.isSafeInteger(parsed.failures) ? parsed.failures === 0 ? 'pass' : 'fail' : 'unknown'; },
  });
  const host: AcceptanceHost = {
    now: () => flags.now, timeoutMs: 1000, maxObservationAgeMs: 10000,
    resolveChecker: (id, revision) => flags.available && revision === 'v1' ? registry.get(id) : undefined,
    principalForAttempt: binding => flags.missingPrincipal ? null : binding.taskId.startsWith('make') ? `actual-${binding.taskId}` : flags.collision ? multipleMakers ? 'actual-make-extra' : 'actual-make' : 'actual-reviewer',
    async captureManifest(context, signal) {
      signal.addEventListener('abort', () => { flags.aborted = true; });
      const artifacts = kinds.map(kind => ({ targetId: `target-${kind}`, digest: hash(`actual-${kind}`), sizeBytes: 10, sourceRef: `source/${kind}`,
        kind: kind === 'research' ? 'retrieved-source' as const : kind === 'external' ? 'remote-state' as const : 'filesystem' as const }));
      const manifest: AcceptanceManifest = { ...context, artifacts, observedAt: flags.now };
      if (flags.manifestMode === 'empty-artifact') return { ...manifest, artifacts: artifacts.map(a => ({ ...a, sizeBytes: 0 })) };
      if (flags.manifestMode === 'missing-target') return { ...manifest, artifacts: artifacts.slice(1) };
      if (flags.manifestMode === 'wrong-run') return { ...manifest, runId: 'other' };
      return manifest;
    },
    isManifestCurrent() { flags.lockSeen = !!db.prepare("SELECT 1 FROM workspace_write_lease WHERE run_id='run'").get(); flags.onCurrent?.(); return flags.current; },
  };
  return { root, db, binder, store, budget, flags, host, verifier: createAcceptanceVerifier(db, host) };
}
import { readOrchestrationSnapshot } from '../src/ui/orchestration.js';
describe('historical acceptance reader', () => {
  it('reads retry receipt history and detects modified or reversed retry chain', async () => {
    const f = fixture(false, true), e = await f.verifier.collect('run');
    expect(f.verifier.finalize(e).status).toBe('accepted');
    expect(readAcceptanceHistory(f.db, 'run')!.receipt!.evaluationId).toBe(e.id);
    f.db.exec('DROP TRIGGER orchestration_retry_link_no_update');
    f.db.prepare("UPDATE orchestration_retry_link SET previous_attempt_id=attempt_id").run();
    expect(() => readAcceptanceHistory(f.db, 'run')).toThrow('integrity');
  });
  it('keeps pre-retry historical encoding valid after migration installation', async () => {
    const f = fixture(), e = await f.verifier.collect('run');
    f.verifier.finalize(e);
    const before = readAcceptanceHistory(f.db, 'run');
    applyOrchestrationRetryMigration(f.db);
    expect(readAcceptanceHistory(f.db, 'run')).toEqual(before);
  });
  it('keeps collected pass separate from acceptance and projects real final receipt', async () => {
    const f = fixture();
    expect(readAcceptanceHistory(f.db, 'run')).toBeNull();
    const evaluation = await f.verifier.collect('run');
    expect(readAcceptanceHistory(f.db, 'run')).toMatchObject({ receipt: null, verdict: 'pass' });
    expect(readOrchestrationSnapshot(f.db, 'run')).toMatchObject({ acceptance: 'unverified', acceptanceRecord: null, requirementEvaluation: { verdict: 'pass' } });
    const receipt = f.verifier.finalize(evaluation);
    expect(receipt.status).toBe('accepted');
    f.flags.available = false;
    const before = f.db.prepare('SELECT total_changes() n').get();
    const history = readAcceptanceHistory(f.db, 'run')!;
    expect(history.receipt).toEqual(receipt);
    expect(history.outcomes).toEqual([...kinds].sort().map(requirementId => ({ requirementId, required: true, verdict: 'pass' })));
    expect(Object.isFrozen(history)).toBe(true); expect(Object.isFrozen(history.outcomes)).toBe(true); expect(Object.isFrozen(history.outcomes[0])).toBe(true); expect(Object.isFrozen(history.receipt)).toBe(true);
    expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(before);
    expect(JSON.stringify(history)).not.toContain(f.root); expect(JSON.stringify(history)).not.toContain('host-check/source'); expect(JSON.stringify(history)).not.toContain('assertions');
    expect(readOrchestrationSnapshot(f.db, 'run')).toMatchObject({ acceptance: 'verified', acceptanceRecord: { evaluationId: evaluation.id }, requirementEvaluation: { verdict: 'pass', outcomes: history.outcomes } });
    f.flags.now++;
    await f.verifier.collect('run');
    expect(readAcceptanceHistory(f.db, 'run')!.evaluationId).toBe(evaluation.id);
  });
  it('returns latest fail and unknown without receipt', async () => {
    const f = fixture(); f.flags.rawMode = 'fail';
    await f.verifier.collect('run');
    expect(readAcceptanceHistory(f.db, 'run')).toMatchObject({ receipt: null, verdict: 'fail' });
    f.flags.now++; f.flags.available = false;
    await f.verifier.collect('run');
    expect(readAcceptanceHistory(f.db, 'run')).toMatchObject({ receipt: null, verdict: 'unknown', outcomes: [...kinds].sort().map(requirementId => ({ requirementId, required: true, verdict: 'unknown' })) });
  });
  it('represents unavailable manifest and unresolved stages as unknown requirements', async () => {
    const f = fixture(); f.flags.manifestMode = 'wrong-run';
    await f.verifier.collect('run');
    expect(readAcceptanceHistory(f.db, 'run')!.outcomes.every(o => o.verdict === 'unknown')).toBe(true);
    f.flags.now++; f.db.prepare("UPDATE orchestration_attempt SET state='blocked' WHERE attempt_id='attempt-check'").run();
    await f.verifier.collect('run');
    expect(readAcceptanceHistory(f.db, 'run')!.outcomes).toHaveLength(4);
  });
  it('rejects corrupt evidence bytes and attempt lineage', async () => {
    const f = fixture(); await f.verifier.collect('run');
    f.db.prepare("UPDATE orchestration_attempt SET state='blocked' WHERE attempt_id='attempt-check'").run();
    expect(() => readAcceptanceHistory(f.db, 'run')).toThrow('integrity');
    const other = fixture(); await other.verifier.collect('run');
    other.db.exec('DROP TRIGGER acceptance_blob_no_update');
    other.db.prepare('UPDATE acceptance_blob SET bytes=?').run(Buffer.from('tampered'));
    expect(() => readAcceptanceHistory(other.db, 'run')).toThrow('integrity');
  });
  it('rejects damaged final receipt and hashed evaluation content', async () => {
    const f = fixture(); f.verifier.finalize(await f.verifier.collect('run'));
    f.db.exec('DROP TRIGGER acceptance_final_no_update');
    f.db.prepare("UPDATE acceptance_final SET payload='{}'").run();
    expect(() => readAcceptanceHistory(f.db, 'run')).toThrow('integrity');
    const other = fixture(); await other.verifier.collect('run');
    other.db.exec('DROP TRIGGER acceptance_evaluation_no_update');
    other.db.prepare("UPDATE acceptance_evaluation SET payload='{}'").run();
    expect(() => readAcceptanceHistory(other.db, 'run')).toThrow('integrity');
  });
});
