import { applyOrchestrationRetryMigration } from '../src/orchestration/retry-migration.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createHandoffActivityStore } from '../src/orchestration/handoff-activity.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { createRequirementContractStore, type RequirementKind } from '../src/verification/requirements.js';
import { createBudgetManager } from '../src/budget.js';
import { createAcceptanceVerifier, readAcceptanceHistory, type AcceptanceHost, type AcceptanceChecker, type AcceptanceManifest, type RawCheckerObservation, type CheckerContext } from '../src/verification/acceptance.js';
import { createGeneratedOutputStore, generatedOutputParametersDigest } from '../src/verification/generated-output.js';
import type { EvidenceObservation } from '../src/verification/evidence-policy.js';
const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const kinds: RequirementKind[] = ['code', 'research', 'document', 'external'];
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
function fixture(multipleMakers = false, withRetry = false, retryTask = 'make', makerRole: 'implementation' | 'model-producer' = 'implementation', generated = false) {
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
    { id: 'make', role: makerRole, ownerId: 'maker', requirementIds: kinds, dependencyIds: [], candidateIds: ['agent'], scopeIds: makerRole === 'implementation' ? ['workspace'] : [] },
    ...(multipleMakers ? [{ id: 'make-extra', role: 'implementation' as const, ownerId: 'other-maker', requirementIds: kinds, dependencyIds: [], candidateIds: ['agent'], scopeIds: ['workspace'] }] : []),
    { id: 'check', role: 'verifier', ownerId: 'reviewer', requirementIds: kinds, dependencyIds: multipleMakers ? ['make', 'make-extra'] : ['make'], candidateIds: ['agent'], scopeIds: [] },
  ] });
  const artifactBytes=Buffer.from('acceptance-fixture-artifact');
  const store = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true, verifyReceipt: context => ({ outcomeVerified: true, cleanupVerified: true,handoff:{handoffId:`handoff-${context.attemptId}`,identityId:`identity-${context.attemptId}`,artifacts:[{kind:'output',sourceRef:`artifact-${context.attemptId}`}]}}),resolveHandoffArtifact:()=>artifactBytes,authorizeHandoffArtifact:()=>true, retry: { now: () => clock, authorizeContract: () => true, classifyFailure: () => ({ cause: 'transient', sourceRef: 'host-retry', sourceDigest: hash('retry'), observedAtMs: clock }) } });
  const handoffs=createHandoffActivityStore(db,{resolveArtifact:()=>artifactBytes,authorizeArtifact:()=>true});
  store.install('run', plan);
  const inputBytes = Buffer.from('{"answer":42}');
  const generatedParameters = { version: 'cue-generated-output-v1' as const, kind: 'generated-output' as const, targetId: 'target-document', requirementId: 'document', producerTaskId: 'make', checkerId: 'checker-document', checkerRevision: 'v1', inputSha256: hash(inputBytes.toString()), maxBytes: 1024 };
  const requirementStore = createRequirementContractStore(db, { now: () => clock, resolveChecker: (id, revision) => { const kind=kinds.find(value=>id===`checker-${value}`);if(!kind)return undefined;const parametersDigest=generated&&kind==='document'?generatedOutputParametersDigest(generatedParameters):hash(kind);return {id,revision,kinds:[kind],evidencePolicies:[{requirementId:kind,kind,producerTaskIds:plan.tasks.filter(task=>task.role!=='verifier').map(task=>task.id),sourceRevision:plan.digest,targetIds:[`target-${kind}`],checkerId:id,checkerRevision:revision,parametersDigest,hostileCheckIds:kind==='code'?['negative']:[],requiredSectionIds:kind==='document'?['approved-section']:[],claimIds:kind==='research'?['approved-claim']:[],requiresRender:kind==='document',...(kind==='external'?{remote:{accountId:'account',resourceId:'resource',operationId:'operation',idempotencyKey:'key',expectedTransition:'updated',observerId:'remote-reader',observerRevision:'v1'}}:{})}]}; } });
  requirementStore.bind('run', kinds.map(kind => ({ id: kind, text: `${kind} approved criterion`, kind, required: true, checks: [{ checkerId: `checker-${kind}`, revision: 'v1', parametersDigest: generated && kind === 'document' ? generatedOutputParametersDigest(generatedParameters) : hash(kind), targetIds: [`target-${kind}`] }] })));
  const outputs = createGeneratedOutputStore(db, { now: () => clock, authorizeObservation: () => true });
  if (generated) outputs.bindTarget({ runId: 'run', targetId: 'target-document', requirementId: 'document', producerTaskId: 'make', checkerId: 'checker-document', checkerRevision: 'v1', inputBytes, maxBytes: 1024, boundAtMs: clock });
  const retryContract = withRetry ? store.bindRetryContract({ runId: 'run', requirementsDigest: requirementStore.read('run')!.requirements.digest, maxAttemptsPerTask: 3, maxAttemptsTotal: 8, boundAtMs: clock, deadlineMs: clock + 30000 }) : null;
  db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal',0,'accept','now')").run(parentHash);
  db.prepare("UPDATE task SET state='running' WHERE id='root-task'").run();
  const binder = createStageEnvelopeBinder(db, { now: () => clock, authorizeStage: () => true, resolveScope: id => ({ id, worktreeRealpath: root, allowedActions: parent.allowed_actions, egress: [] }) });
  for (const task of multipleMakers ? ['make', 'make-extra', 'check'] : ['make', 'check']) {
    const attemptId = `attempt-${task}`;
    const writes = task === 'make-extra' || task === 'make' && makerRole === 'implementation';
    if (withRetry && task === retryTask) {
      store.claim({ runId: 'run', taskId: task, attemptId: 'failed-maker', candidateId: 'agent', observedAtMs: clock });
      if(!db.prepare("SELECT 1 FROM attempt_selection WHERE attempt_id='failed-maker'").get())db.prepare("INSERT INTO attempt_selection VALUES('failed-maker','run','fixture-failed','monetary',?,'{}')").run(hash('selection-failed-maker'));
      const failedStage=binder.bind({ workflowRunId: 'run', taskId: task, attemptId: 'failed-maker', parentEnvelope: parent, stage: { worktreeRealpath: root, allowedActions: writes ? ['file_change'] : [], egress: [], expiresAt: parent.expires_at, autonomyLevel: 'supervised' } });
      db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run('session-failed-maker',1,'now',root,failedStage.owner.task_id,failedStage.owner.run_id);
      const failedSelection=db.prepare("SELECT digest FROM attempt_selection WHERE attempt_id='failed-maker'").get() as {digest:string};
      handoffs.recordLaunchIntent({runId:'run',taskId:task,attemptId:'failed-maker',candidateId:'agent',selectionDigest:failedSelection.digest,expectedSubjectDigest:hash('failed-maker'),tool:{id:'fixture-tool',revision:'unknown'},model:null,parentEnvelopeHash:parentHash,stageEnvelopeHash:failedStage.envelopeHash,planDigest:failedStage.planDigest,policyDigest:failedStage.policyDigest});
      handoffs.recordAttemptIdentity({identityId:'identity-failed-maker',attemptId:'failed-maker',subjectDigest:hash('failed-maker'),durableRef:'session:session-failed-maker',observedAtMs:clock});
      store.finish({ runId: 'run', taskId: task, attemptId: 'failed-maker', receiptId: 'failed-maker-receipt', revision: 1, outcome: 'failed', cleanup: 'clean', evidenceRef: 'host-failure', observedAtMs: clock });
      store.claimRetry({ runId: 'run', taskId: task, attemptId, candidateId: 'agent', observedAtMs: clock, retry: { previousAttemptId: 'failed-maker', receiptId: 'failed-maker-receipt', contractDigest: retryContract!.digest } });
    } else store.claim({ runId: 'run', taskId: task, attemptId, candidateId: 'agent', observedAtMs: clock });
    if(!db.prepare('SELECT 1 FROM attempt_selection WHERE attempt_id=?').get(attemptId))db.prepare("INSERT INTO attempt_selection VALUES(?,'run',?,'monetary',?,'{}')").run(attemptId,`fixture-${attemptId}`,hash(`selection-${attemptId}`));
    const stage=binder.bind({ workflowRunId: 'run', taskId: task, attemptId, parentEnvelope: parent, stage: { worktreeRealpath: root, allowedActions: writes ? ['file_change'] : [], egress: [], expiresAt: parent.expires_at, autonomyLevel: 'supervised' } });
    db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(`session-${attemptId}`,1,'now',root,stage.owner.task_id,stage.owner.run_id);
    const selection=db.prepare('SELECT digest FROM attempt_selection WHERE attempt_id=?').get(attemptId) as {digest:string};
    handoffs.recordLaunchIntent({runId:'run',taskId:task,attemptId,candidateId:'agent',selectionDigest:selection.digest,expectedSubjectDigest:hash(attemptId),tool:{id:'fixture-tool',revision:'unknown'},model:null,parentEnvelopeHash:parentHash,stageEnvelopeHash:stage.envelopeHash,planDigest:stage.planDigest,policyDigest:stage.policyDigest});
    handoffs.recordAttemptIdentity({identityId:`identity-${attemptId}`,attemptId,subjectDigest:hash(attemptId),durableRef:`session:session-${attemptId}`,observedAtMs:clock});
    store.finish({ runId: 'run', taskId: task, attemptId, receiptId: `finished-${task}`, revision: 1, outcome: 'succeeded', cleanup: 'clean', evidenceRef: 'fixture-completion', observedAtMs: clock });
  }
  if (generated) {
    for (const attemptId of withRetry ? ['failed-maker', 'attempt-make'] : ['attempt-make']) outputs.record({ runId: 'run', targetId: 'target-document', attemptId, observationId: `output-${attemptId}`, observedAtMs: clock, bytes: Buffer.from('generated-response-fixture') });
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
      if (flags.rawMode === 'model-json') return { ...raw, bytes: Buffer.from('{"pass":true}'),evidence:undefined };
      if (flags.rawMode === 'wrong-lineage') return { ...raw, contextDigest: hash('another-run-plan-policy-parameters') };
      if (flags.rawMode === 'empty') return { ...raw, bytes: new Uint8Array() };
      if (flags.rawMode === 'missing-source') return { ...raw, sourceRefs: [] };
      if (flags.rawMode === 'fail') return { ...raw, bytes: Buffer.from('{"assertions":3,"failures":1}'),evidence:{...evidence,verdict:'fail'} };
      if (flags.rawMode === 'checker-fail') return { ...raw, bytes: Buffer.from('{"assertions":3,"failures":1}') };
      if (flags.rawMode === 'wrong-producer') return { ...raw,evidence:{...evidence,producerAttemptPrincipal:'caller-claimed-producer'} };
      if (flags.rawMode === 'stale-source') return { ...raw,evidence:{...evidence,sourceRevision:hash('stale-plan')} };
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
      const output = generated ? outputs.read('run', 'target-document', 'attempt-make') : null;
      const manifest: AcceptanceManifest = { ...context, artifacts: artifacts.map(a => output && a.targetId === 'target-document' ? { targetId: a.targetId, digest: output.record.sha256, sizeBytes: output.record.byteLength, sourceRef: `cue-generated-output:${output.record.digest}`, kind: 'generated-output' as const } : a), observedAt: flags.now };
      if (flags.manifestMode === 'empty-artifact') return { ...manifest, artifacts: artifacts.map(a => ({ ...a, sizeBytes: 0 })) };
      if (flags.manifestMode === 'missing-target') return { ...manifest, artifacts: artifacts.slice(1) };
      if (flags.manifestMode === 'wrong-run') return { ...manifest, runId: 'other' };
      return manifest;
    },
    isManifestCurrent() { flags.lockSeen = !!db.prepare("SELECT 1 FROM workspace_write_lease WHERE run_id='run'").get(); flags.onCurrent?.(); return flags.current; },
  };
  return { root, db, binder, store, budget, flags, host, outputs, verifier: createAcceptanceVerifier(db, host) };
}
describe('S4 host-observed requirement acceptance', () => {
  it('accepts only an explicitly approved generated document and validates history bytes', async () => {
    const f = fixture(false, false, 'make', 'model-producer', true);
    const result = await f.verifier.collect('run'); expect(result.verdict).toBe('pass');
    expect(f.verifier.finalize(result).status).toBe('accepted');
    expect(readAcceptanceHistory(f.db, 'run')?.receipt?.status).toBe('accepted');
    f.db.exec('DROP TRIGGER generated_observation_no_update');
    f.db.prepare('UPDATE generated_output_observation SET bytes=?').run(Buffer.from('changed'));
    expect(() => readAcceptanceHistory(f.db, 'run')).toThrow();
  });
  it('does not substitute generated strings for unapproved document or code evidence', async () => {
    for (const targetId of ['target-document', 'target-code']) {
      const f = fixture(false, false, 'make', 'model-producer'); const capture = f.host.captureManifest;
      f.host.captureManifest = async (...args) => { const m = await capture(...args); return { ...m, artifacts: m.artifacts.map(a => a.targetId === targetId ? { ...a, kind: 'generated-output' } : a) }; };
      expect((await f.verifier.collect('run')).verdict).toBe('unknown');
    }
  });
  it('does not downgrade an approved generated target to filesystem evidence', async () => {
    const f = fixture(false, false, 'make', 'model-producer', true); const capture = f.host.captureManifest;
    f.host.captureManifest = async (...args) => { const m = await capture(...args); return { ...m, artifacts: m.artifacts.map(a => a.kind === 'generated-output' ? { ...a, kind: 'filesystem' } : a) }; };
    const result = await f.verifier.collect('run');
    expect(result.verdict).toBe('unknown'); expect(f.verifier.finalize(result).status).toBe('blocked');
  });
  it('rejects a prior failed producer response and a forged source reference', async () => {
    for (const previous of [true, false]) {
      const f = fixture(false, true, 'make', 'model-producer', true); const capture = f.host.captureManifest;
      const old = f.outputs.read('run', 'target-document', 'failed-maker')!.record;
      f.host.captureManifest = async (...args) => { const m = await capture(...args); return { ...m, artifacts: m.artifacts.map(a => a.kind === 'generated-output' ? { ...a, sourceRef: previous ? `cue-generated-output:${old.digest}` : 'forged-source' } : a) }; };
      expect((await f.verifier.collect('run')).verdict).toBe('unknown');
    }
  });
  it('rechecks generated bytes after the host manifest callback before committing', async () => {
    const f = fixture(false, false, 'make', 'model-producer', true);
    const result = await f.verifier.collect('run'); expect(result.verdict).toBe('pass');
    f.flags.onCurrent = () => { f.db.exec('DROP TRIGGER generated_observation_no_update'); f.db.prepare('UPDATE generated_output_observation SET bytes=?').run(Buffer.from('changed')); };
    expect(f.verifier.finalize(result)).toMatchObject({ status: 'blocked', reason: 'generated_output_changed' });
    expect(f.db.prepare('SELECT COUNT(*) n FROM acceptance_final').get()).toEqual({ n: 0 });
  });
  it('model producer needs a separate verifier and rechecks that principal before acceptance', async () => {
    const f = fixture(false, false, 'make', 'model-producer');
    const independent = await f.verifier.collect('run');
    expect(independent.verdict).toBe('pass');
    f.flags.collision = true;
    expect(f.verifier.finalize(independent)).toMatchObject({ status: 'blocked', reason: 'independent_principal_changed' });
    expect((await f.verifier.collect('run')).verdict).toBe('unknown');
    f.flags.collision = false;
    expect(f.verifier.finalize(independent).status).toBe('accepted');
  });
  it('all historic model-producer principals count after a clean retry', async () => {
    const f = fixture(false, true, 'make', 'model-producer');
    expect((await f.verifier.collect('run')).verdict).toBe('pass');
    f.host.principalForAttempt = stage => stage.attemptId === 'attempt-make' ? 'new-maker' : 'former-model-maker';
    expect((await f.verifier.collect('run')).verdict).toBe('unknown');
    f.host.principalForAttempt = stage => stage.attemptId === 'failed-maker' ? null : stage.taskId === 'make' ? 'new-maker' : 'independent-reviewer';
    expect((await f.verifier.collect('run')).verdict).toBe('unknown');
  });
  it('mixed implementation and model producers both exclude their principals from reviewing', async () => {
    const f = fixture(true, false, 'make', 'model-producer');
    expect((await f.verifier.collect('run')).verdict).toBe('pass');
    for (const makerPrincipal of ['actual-make', 'actual-make-extra']) {
      f.host.principalForAttempt = stage => stage.taskId.startsWith('make') ? `actual-${stage.taskId}` : makerPrincipal;
      expect((await f.verifier.collect('run')).verdict).toBe('unknown');
    }
  });
  it('selects the current successful verifier instead of its prior failed attempt', async () => {
    const f = fixture(false, true, 'check');
    f.host.principalForAttempt = stage => stage.attemptId === 'failed-maker' ? null : stage.taskId === 'make' ? 'maker' : 'current-reviewer';
    const e = await f.verifier.collect('run');
    expect(e.verdict).toBe('pass');
    expect(f.verifier.finalize(e).status).toBe('accepted');
  });
  it('accepts clean failed maker then successful retry with independent current verifier', async () => {
    const f = fixture(false, true);
    const e = await f.verifier.collect('run');
    expect(e.verdict).toBe('pass');
    expect(f.verifier.finalize(e).status).toBe('accepted');
    expect(f.db.prepare("SELECT state,cleanup_verified FROM orchestration_attempt WHERE attempt_id='failed-maker'").get()).toEqual({ state: 'failed', cleanup_verified: 1 });
  });
  it('rejects verifier identity shared with a past failed maker, even when current maker differs', async () => {
    const f = fixture(false, true);
    f.host.principalForAttempt = stage => stage.attemptId === 'attempt-make' ? 'new-maker' : 'past-maker';
    expect((await f.verifier.collect('run')).verdict).toBe('unknown');
  });
  it('rejects unknown past cleanup and stale retry receipts after collection', async () => {
    const f = fixture(false, true), e = await f.verifier.collect('run');
    f.db.prepare("UPDATE orchestration_attempt SET cleanup_verified=0 WHERE attempt_id='failed-maker'").run();
    expect(f.verifier.finalize(e).status).toBe('blocked');
    expect((await f.verifier.collect('run')).verdict).toBe('unknown');
    const other = fixture(false, true), old = await other.verifier.collect('run');
    other.db.exec('DROP TRIGGER orchestration_retry_link_no_update');
    other.db.prepare("UPDATE orchestration_retry_link SET payload=?").run('{}');
    expect(other.verifier.finalize(old).status).toBe('blocked');
  });
  it('all required checks pass with opaque evaluation, atomic receipt and no billing prerequisite', async () => {
    const f = fixture(), evaluation = await f.verifier.collect('run');
    expect(evaluation.verdict).toBe('pass'); expect(Object.isFrozen(evaluation)).toBe(true);
    expect(f.verifier.finalize(evaluation)).toMatchObject({ status: 'accepted', runId: 'run', evaluationId: evaluation.id });
    expect(f.flags.lockSeen).toBe(true);
    expect(f.db.prepare("SELECT state FROM task WHERE id='root-task'").get()).toEqual({ state: 'completed' });
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
    expect(f.budget.summary('run').committedUnits).toBe(50n);
    expect(f.verifier.finalize(evaluation)).toEqual(f.verifier.read('run'));
    expect(() => f.verifier.finalize({ ...evaluation })).toThrow('unowned');
    f.flags.now++;
    const later = await f.verifier.collect('run');
    expect(() => f.verifier.finalize(later)).toThrow('acceptance_already_finalized');
  });
  it.each(['partial-targets', 'model-only-check'] as const)('A05 blocks an explicit completed model claim with %s after a valid control', async mode => {
    const f = fixture();
    const control = await f.verifier.collect('run');
    expect(control.verdict).toBe('pass');
    f.db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
      .run('root-task', 'run', 'model-completion-claim', JSON.stringify({ completed: true, message: 'All requirements are complete.', delivered: 'partial result' }), 'fixture');
    if (mode === 'partial-targets') f.flags.manifestMode = 'missing-target';
    else f.flags.rawMode = 'self-report';
    const partial = await f.verifier.collect('run');
    expect(partial.verdict).toBe('unknown');
    expect(f.verifier.finalize(partial).status).toBe('blocked');
    expect(readAcceptanceHistory(f.db, 'run')?.receipt?.status).not.toBe('accepted');
    const parent = f.db.prepare("SELECT state FROM task WHERE id='root-task'").get();
    expect(parent).toBeDefined();
    expect(parent).not.toEqual({ state: 'completed' });
    expect(f.budget.summary('run').committedUnits).toBe(50n);
  });
  it('model self-report, empty raw/source and wrong context cannot become pass', async () => {
    const f = fixture();
    for (const mode of ['self-report', 'model-json', 'wrong-lineage', 'empty', 'missing-source']) {
      f.flags.rawMode = mode; const e = await f.verifier.collect('run');
      expect(e.verdict).toBe('unknown'); expect(f.verifier.finalize(e).status).toBe('blocked');
    }
    f.flags.rawMode = 'fail'; expect((await f.verifier.collect('run')).verdict).toBe('fail');
    f.flags.rawMode = 'checker-fail'; expect((await f.verifier.collect('run')).verdict).toBe('fail');
    f.flags.rawMode = 'wrong-producer'; expect((await f.verifier.collect('run')).verdict).toBe('unknown');
    f.flags.rawMode = 'stale-source'; expect((await f.verifier.collect('run')).verdict).toBe('unknown');
  });
  it('empty, missing and foreign manifest artifacts reject success', async () => {
    const f = fixture();
    for (const mode of ['empty-artifact', 'missing-target', 'wrong-run']) { f.flags.manifestMode = mode; expect((await f.verifier.collect('run')).verdict).toBe('unknown'); }
  });
  it('principal collision, unknown principal and missing current checker yield unknown', async () => {
    const f = fixture(); f.flags.collision = true; expect((await f.verifier.collect('run')).verdict).toBe('unknown');
    f.flags.collision = false; f.flags.missingPrincipal = true; expect((await f.verifier.collect('run')).verdict).toBe('unknown');
    f.flags.missingPrincipal = false; f.flags.available = false; expect((await f.verifier.collect('run')).verdict).toBe('unknown');
  });
  it('finalization rechecks artifacts, identities and registered checker availability', async () => {
    const f = fixture(), e = await f.verifier.collect('run');
    f.flags.current = false; expect(f.verifier.finalize(e)).toMatchObject({ status: 'blocked', reason: 'artifact_manifest_changed' });
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
    f.flags.current = true; f.flags.available = false; expect(f.verifier.finalize(e)).toMatchObject({ reason: 'checker_unavailable' });
    f.flags.available = true; f.flags.collision = true; expect(f.verifier.finalize(e)).toMatchObject({ reason: 'independent_principal_changed' });
  });
  it('reviewer must differ from every actual maker, including a second implementation', async () => {
    const f = fixture(true); expect((await f.verifier.collect('run')).verdict).toBe('pass');
    f.flags.collision = true; expect((await f.verifier.collect('run')).verdict).toBe('unknown');
  });
  it('missing contracts and unknown cleanup block before collection', async () => {
    const f = fixture(); f.db.prepare("UPDATE orchestration_attempt SET cleanup_verified=0 WHERE attempt_id='attempt-make'").run();
    expect((await f.verifier.collect('run')).verdict).toBe('unknown'); expect(f.flags.captured).toBe(0);
    f.db.prepare("UPDATE orchestration_attempt SET cleanup_verified=1 WHERE attempt_id='attempt-make'").run();
    f.db.exec('DROP TRIGGER requirement_contract_no_delete'); f.db.prepare('DELETE FROM requirement_contract_binding').run();
    expect((await f.verifier.collect('run')).verdict).toBe('unknown');
  });
  it('finalization rejects new writer ownership and changed attempt state', async () => {
    const f = fixture(), e = await f.verifier.collect('run');
    f.db.prepare("INSERT INTO workspace_write_lease VALUES(?,'run','other-owner')").run(f.root);
    expect(f.verifier.finalize(e)).toMatchObject({ reason: 'writer_lease_busy' }); f.db.prepare('DELETE FROM workspace_write_lease').run();
    f.db.prepare("UPDATE orchestration_attempt SET cleanup_verified=0 WHERE attempt_id='attempt-check'").run();
    expect(f.verifier.finalize(e)).toMatchObject({ reason: 'acceptance_lineage_changed' });
  });
  it('collect timeout is total, cancellation prevents finalization and late data cannot complete', async () => {
    const f = fixture(); f.flags.delayMs = 20;
    // Control the total deadline independently of synchronous SQLite load. At
    // 35ms the second 20ms collector must be active, not between callbacks.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    try {
      const verifier = createAcceptanceVerifier(f.db, { ...f.host, timeoutMs: 35 });
      const pending = verifier.collect('run');
      await vi.advanceTimersByTimeAsync(0); expect(f.flags.captured).toBe(1);
      await vi.advanceTimersByTimeAsync(20); expect(f.flags.captured).toBe(2);
      await vi.advanceTimersByTimeAsync(15);
      const e = await pending; expect(e.verdict).toBe('unknown');
      expect(f.flags.aborted).toBe(true); expect(verifier.finalize(e).status).toBe('blocked');
      await vi.advanceTimersByTimeAsync(100); // late successful bytes cannot revive the evaluation
      expect(f.flags.captured).toBe(2);
      expect(verifier.finalize(e).status).toBe('blocked');
      f.flags.delayMs = 0; f.flags.hang = true; f.flags.aborted = false;
      const controller = new AbortController();
      const cancelled = verifier.collect('run', { signal: controller.signal });
      await vi.advanceTimersByTimeAsync(0); expect(f.flags.captured).toBe(3);
      controller.abort();
      expect((await cancelled).verdict).toBe('unknown'); expect(f.flags.aborted).toBe(true);
      expect(f.db.prepare('SELECT count(*) n FROM acceptance_final').get()).toEqual({ n: 0 });
    } finally { vi.useRealTimers(); }
  });
  it('cancellation or task transition during current-manifest callback cannot commit', async () => {
    const f = fixture(), controller = new AbortController(); const e = await f.verifier.collect('run', { signal: controller.signal });
    f.flags.onCurrent = () => controller.abort(); expect(f.verifier.finalize(e)).toMatchObject({ reason: 'acceptance_cancelled' });
    f.flags.onCurrent = undefined; const fresh = await f.verifier.collect('run');
    f.flags.onCurrent = () => f.db.prepare("UPDATE task SET state='blocked' WHERE id='root-task'").run();
    expect(f.verifier.finalize(fresh)).toMatchObject({ reason: 'acceptance_task_inactive' });
    expect(f.db.prepare('SELECT count(*) n FROM acceptance_final').get()).toEqual({ n: 0 });
  });
  it('raw evidence is immutable and corrupt snapshots prevent finalization', async () => {
    const f = fixture(), e = await f.verifier.collect('run');
    expect(() => f.db.prepare('INSERT OR REPLACE INTO acceptance_evaluation SELECT * FROM acceptance_evaluation').run()).toThrow('immutable');
    expect(() => f.db.prepare('INSERT OR REPLACE INTO acceptance_blob SELECT * FROM acceptance_blob').run()).toThrow('immutable');
    f.db.exec('DROP TRIGGER acceptance_blob_no_update'); f.db.prepare('UPDATE acceptance_blob SET bytes=?').run(Buffer.from('tampered'));
    expect(f.verifier.finalize(e)).toMatchObject({ reason: 'acceptance_evidence_corrupt' });
  });
  it('attempt lineage changes inside manifest recheck cannot commit an accepted receipt', async () => {
    const f = fixture(), evaluation = await f.verifier.collect('run');
    f.flags.onCurrent = () => f.db.prepare("UPDATE orchestration_attempt SET state='blocked' WHERE attempt_id='attempt-check'").run();
    expect(f.verifier.finalize(evaluation)).toMatchObject({ status: 'blocked', reason: 'acceptance_lineage_changed' });
    expect(f.db.prepare('SELECT count(*) n FROM acceptance_final').get()).toEqual({ n: 0 });
    expect(f.db.prepare("SELECT state FROM task WHERE id='root-task'").get()).toEqual({ state: 'running' });
  });
});
