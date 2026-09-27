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
import { createGeneratedJsonHandoffAuthority } from '../../app/generated-json-handoff-authority.mjs';
const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function fixture(kind: RequirementKind = 'document', makerRole: 'model-producer' | 'implementation' = 'model-producer', outputTargetId = 'answer') {
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
  const artifactBytes=Buffer.from('generated output fixture handoff');
  const scheduler = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true,
    verifyReceipt: (context:any) => ({ outcomeVerified: true, cleanupVerified: true, handoff:{handoffId:`handoff-${context.attemptId}`,identityId:`identity-${context.attemptId}`,artifacts:[{kind:'output',sourceRef:`artifact-${context.attemptId}`}]}}),
    resolveHandoffArtifact:(sourceRef:string,attemptId:string)=>sourceRef===`artifact-${attemptId}`?artifactBytes:null,
    authorizeHandoffArtifact:(sourceRef:string,attemptId:string)=>sourceRef===`artifact-${attemptId}`,
    retry: { now: () => 1000, authorizeContract: () => true,
      classifyFailure: () => ({ cause: 'transient', sourceRef: 'host-proof', sourceDigest: 'a'.repeat(64), observedAtMs: 1000 }) } });
  scheduler.install('run', plan);
  const input = Buffer.from('{"message":"preserve this source value"}');
  const parameters: GeneratedOutputParameters = { version: 'cue-generated-output-v1', kind: 'generated-output', targetId: outputTargetId, requirementId: 'req', producerTaskId: 'make',
    checkerId: 'preserve-json-value', checkerRevision: 'v1', inputSha256: sha(input), maxBytes: 4096 };
  const requirementStore = createRequirementContractStore(db, { now: () => 1000, resolveChecker: (id, revision) => ({ id, revision, kinds: [kind], evidencePolicies: [{
    requirementId: 'req', kind, producerTaskIds: ['make'], sourceRevision: parameters.inputSha256, targetIds: [outputTargetId], checkerId: id,
    checkerRevision: revision, parametersDigest: generatedOutputParametersDigest(parameters), hostileCheckIds: [], requiredSectionIds: kind === 'document' ? ['json-document'] : [],
    claimIds: kind === 'research' ? ['claim'] : [], requiresRender: false,
    ...(kind === 'external' ? { remote: { accountId: 'account', resourceId: 'resource', operationId: 'operation', idempotencyKey: 'key', expectedTransition: 'updated', observerId: 'observer', observerRevision: 'v1' } } : {}),
  }] }) });
  const requirements = requirementStore.bind('run', [{ id: 'req', text: 'Produce the approved document response', kind, required: true,
    checks: [{ checkerId: parameters.checkerId, revision: parameters.checkerRevision, parametersDigest: generatedOutputParametersDigest(parameters), targetIds: [outputTargetId] }] }]);
  const flags = { allowed: true, now: 1000, authorizations: 0, mutateCopy: false };
  const host: GeneratedOutputHost = { now: () => flags.now, authorizeObservation: context => {
    flags.authorizations++; expect(context.stage.owner.run_id).toBe(context.record.attemptId);
    expect(context.target.parametersDigest).toBe(generatedOutputParametersDigest(parameters));
    expect(Object.isFrozen(context.record)).toBe(true);
    if (flags.mutateCopy) context.bytes.fill(0);
    return flags.allowed;
  } };
  const output = createGeneratedOutputStore(db, host);
  const targetInput = { runId: 'run', targetId: outputTargetId, requirementId: 'req', producerTaskId: 'make', checkerId: parameters.checkerId,
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
  const finish = (outcome: 'failed' | 'succeeded' = 'failed') => {
    const attemptId='first',stageRow=db.prepare('SELECT parent_envelope_hash,stage_envelope_hash,plan_digest,policy_digest FROM orchestration_stage_envelope WHERE attempt_id=?').get(attemptId) as any;
    const selectionBody=JSON.stringify({fixture:true,attemptId}),selectionDigest=sha(selectionBody),subject=sha(`subject-${attemptId}`),session=`session-${attemptId}`;
    db.prepare("INSERT INTO attempt_selection VALUES(?,?,'fixture-request','monetary',?,?)").run(attemptId,'run',selectionDigest,selectionBody);
    scheduler.handoffActivity.recordLaunchIntent({runId:'run',taskId:'make',attemptId,candidateId:'model',selectionDigest,expectedSubjectDigest:subject,tool:{id:'fixture-tool',revision:'v1'},model:null,parentEnvelopeHash:stageRow.parent_envelope_hash,stageEnvelopeHash:stageRow.stage_envelope_hash,planDigest:stageRow.plan_digest,policyDigest:stageRow.policy_digest});
    db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(session,1,'fixture',root,'root',attemptId);
    scheduler.handoffActivity.recordAttemptIdentity({identityId:`identity-${attemptId}`,attemptId,subjectDigest:subject,durableRef:`session:${session}`,observedAtMs:1000});
    return scheduler.finish({ runId: 'run', taskId: 'make', attemptId, receiptId: 'receipt-first', revision: 1, outcome, cleanup: 'clean', evidenceRef: 'host-receipt', observedAtMs: 1000 });
  };
  const observation = (attemptId = 'first') => ({ runId: 'run', targetId: outputTargetId, attemptId, observationId: `response-${attemptId}`, observedAtMs: flags.now, bytes: Buffer.from('actual response bytes') });
  return { db, path, output, host, flags, parameters, targetInput, approve, stage, finish, observation, scheduler, requirements };
}

describe('S4 immutable generated-output storage', () => {
  it('reuses exact persisted generated-output bytes for offline recovery across reopen and rejects cross-attempt or tampered bytes',()=>{const f=fixture('document','model-producer','formatted-json');f.output.bindTarget(f.targetInput);f.approve();f.stage();f.output.record(f.observation());const ref='generated-output:response-first',authority=createGeneratedJsonHandoffAuthority({db:f.db});expect(Buffer.from(authority.resolveHandoffArtifact(ref,'first')!)).toEqual(Buffer.from('actual response bytes'));expect(authority.resolveHandoffArtifact(ref,'wrong-attempt')).toBeNull();f.db.close();const reopened=openLedger(f.path);handles.push(reopened);expect(createGeneratedJsonHandoffAuthority({db:reopened}).authorizeHandoffArtifact(ref,'first')).toBe(true);reopened.exec('DROP TRIGGER generated_observation_no_update');reopened.prepare("UPDATE generated_output_observation SET bytes=? WHERE observation_id='response-first'").run(Buffer.from('tampered'));expect(createGeneratedJsonHandoffAuthority({db:reopened}).resolveHandoffArtifact(ref,'first')).toBeNull();});
  it('binds exact input/checker parameters before approval and preserves byte hashes after reopen', () => {
    const f = fixture(); const target = f.output.bindTarget(f.targetInput);
    expect(target.parametersDigest).toBe(generatedOutputParametersDigest(f.parameters)); expect(Object.isFrozen(target)).toBe(true);
    expect(f.output.bindTarget(f.targetInput)).toEqual(target);
    f.targetInput.inputBytes.fill(0);
    expect(f.output.readInput('run', 'answer')!.bytes.toString()).toBe('{"message":"preserve this source value"}');
    f.approve(); f.stage(); const observed = f.observation(); const stored = f.output.record(observed); observed.bytes.fill(0);
    expect(stored.sha256).toBe(sha(Buffer.from('actual response bytes'))); f.db.close();
    const reopened = openLedger(f.path); handles.push(reopened); const reader = createGeneratedOutputStore(reopened, { now: () => 999999, authorizeObservation: () => false });
    expect(reader.readTarget('run', 'answer')).toEqual(target);
    const firstRead = reader.read('run', 'answer', 'first')!; expect(firstRead.record).toEqual(stored); firstRead.bytes.fill(0);
    expect(reader.read('run', 'answer', 'first')!.bytes.toString()).toBe('actual response bytes');
    expect(reopened.pragma('foreign_key_check')).toEqual([]);
  });
  it('rejects late binding, wrong inputs/checker semantics and path-like targets', () => {
    const late = fixture(); late.approve(); expect(() => late.output.bindTarget(late.targetInput)).toThrow('too_late');
    const f = fixture();
    for (const change of [{ inputBytes: Buffer.from('changed') }, { checkerRevision: 'v2' }, { checkerId: 'another' }, { maxBytes: 2048 }, { targetId: '../../escape' }]) {
      expect(() => f.output.bindTarget({ ...f.targetInput, ...change })).toThrow();
    }
    expect(f.db.prepare('SELECT COUNT(*) n FROM generated_output_target').get()).toEqual({ n: 0 });
    const bound = f.output.bindTarget(f.targetInput);
    expect(() => f.output.bindTarget({ ...f.targetInput, boundAtMs: 999 })).toThrow('replay_mismatch');
    expect(f.output.readTarget('run', 'answer')).toEqual(bound);
  });
  it('cannot substitute generated bytes for code, research sources, external truth or implementation authority', () => {
    for (const kind of ['code', 'research', 'external'] as const) {
      const f = fixture(kind); expect(() => f.output.bindTarget(f.targetInput)).toThrow('approved_output_contract_missing');
    }
    const writer = fixture('document', 'implementation'); expect(() => writer.output.bindTarget(writer.targetInput)).toThrow('producer_mismatch');
  });
  it('requires actual producer stage lineage and synchronous host byte authorization', async () => {
    const f = fixture(); f.output.bindTarget(f.targetInput); f.approve();
    expect(() => f.output.record(f.observation())).toThrow('attempt_lineage');
    f.stage(); f.flags.allowed = false; expect(() => f.output.record(f.observation())).toThrow('not_authorized');
    f.flags.allowed = true; f.flags.mutateCopy = true;
    const good = f.output.record(f.observation()); expect(good.sha256).toBe(sha(Buffer.from('actual response bytes')));
    f.finish('succeeded'); f.stage('verifier', 'check');
    expect(() => f.output.record(f.observation('verifier'))).toThrow('attempt_lineage');
    expect(() => f.output.record({ ...f.observation(), runId: 'foreign' })).toThrow('target_missing');
    const g = fixture(); g.output.bindTarget(g.targetInput); g.approve(); g.stage();
    const invalid = createGeneratedOutputStore(g.db, { now: () => 1000, authorizeObservation: (() => Promise.reject(Error('not synchronous'))) as unknown as GeneratedOutputHost['authorizeObservation'] });
    expect(() => invalid.record(g.observation())).toThrow('not_authorized'); await Promise.resolve();
  });
  it('records opaque late responses without changing outcome, cleanup or acceptance, and rejects empty/oversized inputs', () => {
    const f = fixture(); f.output.bindTarget(f.targetInput); f.approve(); f.stage(); f.finish();
    f.db.prepare("UPDATE task SET state='blocked' WHERE id='root'").run();
    for (const raw of [Buffer.alloc(0), Buffer.alloc(4097), new Uint8Array(new SharedArrayBuffer(4))]) expect(() => f.output.record({ ...f.observation(), bytes: raw })).toThrow('bytes_limit');
    const response = f.output.record({ ...f.observation(), bytes: Buffer.from('{"pass":true,"command":"do not execute"}') });
    expect(response.kind).toBe('generated-output');
    expect(f.db.prepare("SELECT state FROM task WHERE id='root'").get()).toEqual({ state: 'blocked' });
    expect(f.db.prepare("SELECT state,cleanup_verified FROM orchestration_attempt WHERE attempt_id='first'").get()).toEqual({ state: 'failed', cleanup_verified: 1 });
    expect(f.db.prepare('SELECT COUNT(*) n FROM acceptance_final').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT COUNT(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
  });
  it('keeps retries separate and rejects reused observation IDs or changed bytes', () => {
    const f = fixture(); f.output.bindTarget(f.targetInput);
    const retry = f.scheduler.bindRetryContract({ runId: 'run', requirementsDigest: f.requirements.requirements.digest, maxAttemptsPerTask: 2, maxAttemptsTotal: 3, deadlineMs: 5000, boundAtMs: 1000 });
    f.approve(); f.stage(); const first = f.output.record(f.observation());
    f.flags.allowed = false; expect(f.output.record(f.observation())).toEqual(first); expect(f.flags.authorizations).toBe(1);
    expect(() => f.output.record({ ...f.observation(), bytes: Buffer.from('different') })).toThrow('replay_mismatch');
    f.finish(); f.stage('retry', 'make', retry.digest); f.flags.allowed = true;
    expect(() => f.output.record({ ...f.observation('retry'), observationId: 'response-first' })).toThrow('replay_mismatch');
    const second = f.output.record({ ...f.observation('retry'), bytes: Buffer.from('retry response') });
    expect(second.stageEnvelopeHash).not.toBe(first.stageEnvelopeHash);
    expect(f.output.read('run', 'answer', 'first')!.record).toEqual(first);
    expect(f.output.read('run', 'answer', 'retry')!.bytes.toString()).toBe('retry response');
    expect(f.output.read('run', 'answer', 'not-a-current-selector')).toBeNull();
  });
  it('SQL immutability rejects REPLACE and reads reject privileged bytes or lineage corruption', () => {
    const f = fixture(); f.output.bindTarget(f.targetInput); f.approve(); f.stage(); f.output.record(f.observation());
    for (const table of ['generated_output_target', 'generated_output_observation']) {
      expect(() => f.db.exec(`INSERT OR REPLACE INTO ${table} SELECT * FROM ${table}`)).toThrow('immutable');
      expect(() => f.db.exec(`DELETE FROM ${table}`)).toThrow('immutable');
    }
    f.db.exec('DROP TRIGGER generated_observation_no_update'); f.db.prepare('UPDATE generated_output_observation SET bytes=?').run(Buffer.from('tampered'));
    expect(() => f.output.read('run', 'answer', 'first')).toThrow('integrity');
    const g = fixture(); g.output.bindTarget(g.targetInput); g.approve(); g.stage(); g.output.record(g.observation());
    g.db.exec('DROP TRIGGER generated_target_no_update'); g.db.prepare('UPDATE generated_output_target SET input_bytes=?').run(Buffer.from('tampered input'));
    expect(() => g.output.readInput('run', 'answer')).toThrow();
    const h = fixture(); h.output.bindTarget(h.targetInput); h.approve(); h.stage(); h.output.record(h.observation());
    h.db.exec('DROP TRIGGER stage_envelope_no_update'); h.db.prepare('UPDATE orchestration_stage_envelope SET stage_envelope_hash=parent_envelope_hash').run();
    expect(() => h.output.read('run', 'answer', 'first')).toThrow();
  });
});
