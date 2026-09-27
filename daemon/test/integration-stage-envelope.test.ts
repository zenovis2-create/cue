import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { envelopeHash, normalizeEnvelope, type Envelope } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createStageEnvelopeBinder, type StageEnvelopeRequest } from '../src/orchestration/stage-envelope.js';
const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(autonomy: 'bounded' | 'supervised' = 'bounded', mismatchedPlanPolicy = false, makerRole: 'implementation' | 'model-producer' = 'implementation') {
  const root = mkdtempSync(join(tmpdir(), 'cue-stage-')); roots.push(root);
  const workspace = join(root, 'work'); mkdirSync(workspace); const sub = join(workspace, 'sub'); mkdirSync(sub);
  const path = join(root, 'ledger.db'), db = openLedger(path); handles.push(db);
  for (const file of ['009_selection_policy.sql', '010_orchestration.sql', '012_stage_envelope.sql']) db.exec(readFileSync(resolve('migrations', file), 'utf8'));
  const parent = normalizeEnvelope({ run_id: 'workflow', worktree_realpath: workspace, allowed_actions: ['command', 'file_change', 'read'], egress: ['https://approved.example'], expires_at: '2026-09-12T00:00:00.000Z', autonomy_level: autonomy });
  const parentHash = envelopeHash(parent), now = Date.parse('2026-09-11T00:00:00.000Z');
  db.prepare("INSERT INTO task VALUES('root-task','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,?,'now')").run(parentHash, parent.worktree_realpath, JSON.stringify(parent.egress));
  db.prepare("INSERT INTO run VALUES('workflow','root-task',?,0,'now')").run(parentHash);
  db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES('workflow',?,'desktop','goal','approval',0,'accept','now')").run(parentHash);
  const policy = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: new Date(now).toISOString(), sourceVersion: 'fixture', policy: {
    version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: .5, costBasis: 1, timeBasisMs: 1000, currency: 'TEST', costLimit: null, remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['agent'], pinnedCandidateId: null,
  } });
  bindRunSelectionPolicy(db, { runId: 'workflow', policyId: 'policy', revision: 1, digest: policy.digest, boundAt: new Date(now).toISOString() });
  const approval = { policyRevision: 'policy:1', policyDigest: mismatchedPlanPolicy ? 'b'.repeat(64) : policy.digest, requirementIds: ['req'], allowedCandidateIds: ['agent'], allowedScopeIds: ['workspace'] };
  const plan = validateTaskPlan(approval, { revision: 'plan1', policyRevision: approval.policyRevision, policyDigest: approval.policyDigest, tasks: [
    { id: 'make', role: makerRole, ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: ['agent'], scopeIds: ['workspace'] },
    { id: 'check', role: 'verifier', ownerId: 'checker', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: ['agent'], scopeIds: [] },
    { id: 'think', role: 'planner', ownerId: 'planner', requirementIds: ['req'], dependencyIds: [], candidateIds: ['agent'], scopeIds: ['workspace'] },
  ] });
  const artifact = Buffer.from('fixture evidence');
  const store = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true,
    verifyReceipt: context => ({ outcomeVerified: true, cleanupVerified: true, handoff: { handoffId: `handoff-${context.attemptId}`, identityId: `identity-${context.attemptId}`, artifacts: [{ kind: 'output', sourceRef: `artifact-${context.attemptId}` }] } }),
    authorizeHandoffArtifact: ref => ref === 'artifact-attempt-make', resolveHandoffArtifact: ref => ref === 'artifact-attempt-make' ? artifact : null });
  store.install('workflow', plan);
  store.claim({ runId: 'workflow', taskId: 'make', attemptId: 'attempt-make', candidateId: 'agent', observedAtMs: now });
  const state = { now, authorized: true, scopeRoot: workspace, scopeActions: [...parent.allowed_actions], scopeEgress: [...parent.egress] };
  const host = { now: () => state.now, authorizeStage: () => state.authorized, resolveScope: (scopeId: string) => ({ id: scopeId, worktreeRealpath: state.scopeRoot, allowedActions: state.scopeActions, egress: state.scopeEgress }) };
  const binder = createStageEnvelopeBinder(db, host);
  const request: StageEnvelopeRequest = { workflowRunId: 'workflow', taskId: 'make', attemptId: 'attempt-make', parentEnvelope: parent,
    stage: { worktreeRealpath: sub, allowedActions: ['file_change'], egress: [], expiresAt: '2026-09-11T12:00:00.000Z', autonomyLevel: 'supervised' } };
  return { db, root, path, parent, parentHash, workspace, sub, state, host, binder, request, store };
}
describe('S3 per-attempt stage envelope binding', () => {
  it('model producer binds an empty-action child envelope and cannot inherit parent file-change grants', () => {
    const f = fixture('bounded', false, 'model-producer');
    expect(() => f.binder.bind(f.request)).toThrow('readonly');
    const result = f.binder.bind({ ...f.request, stage: { ...f.request.stage, allowedActions: [] } });
    expect(result.envelope.allowed_actions).toEqual([]); expect(result.owner.run_id).toBe('attempt-make');
    expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
    expect(f.binder.read('attempt-make')?.envelope.allowed_actions).toEqual([]);
  });
  it('creates new immutable envelope and actual child task/run owner, no fake session', () => {
    const f = fixture(), result = f.binder.bind(f.request);
    expect(result.envelope.run_id).toBe('attempt-make'); expect(result.envelopeHash).not.toBe(f.parentHash);
    expect(result.owner).toEqual({ cwd: result.envelope.worktree_realpath, task_id: expect.stringMatching(/^stage-task-/), run_id: 'attempt-make' });
    expect(f.db.prepare('SELECT task_id,envelope_hash FROM run WHERE id=?').get(result.owner.run_id)).toEqual({ task_id: result.owner.task_id, envelope_hash: result.envelopeHash });
    expect(f.db.prepare('SELECT count(*) n FROM session_handle').get()).toEqual({ n: 0 });
    expect(Object.isFrozen(result) && Object.isFrozen(result.owner) && Object.isFrozen(result.envelope.allowed_actions)).toBe(true);
  });
  it('exact canonical replay survives reopening, mismatch creates no extra runs', () => {
    const f = fixture(), original = f.binder.bind(f.request); f.db.close();
    const reopened = openLedger(f.path); handles.push(reopened);
    const binder = createStageEnvelopeBinder(reopened, f.host);
    expect(binder.read('missing')).toBeNull();
    expect(binder.read('attempt-make')).toEqual({ ...original, replayed: true });
    expect(binder.bind(f.request)).toEqual({ ...original, replayed: true });
    expect(() => binder.bind({ ...f.request, stage: { ...f.request.stage, expiresAt: '2026-09-11T11:00:00.000Z' } })).toThrow('stage_replay_mismatch');
    expect(reopened.prepare('SELECT count(*) n FROM run').get()).toEqual({ n: 2 });
  });
  it('persisted read rejects corruption, observes rollback and never renews expired stages', () => {
    const f = fixture();
    expect(() => f.db.transaction(() => { f.binder.bind(f.request); throw Error('rollback'); })()).toThrow('rollback');
    expect(f.binder.read('attempt-make')).toBeNull();
    const binding = f.binder.bind(f.request);
    f.state.now = Date.parse('2026-09-14T00:00:00.000Z'); f.state.authorized = false;
    expect(f.binder.read('attempt-make')).toMatchObject({ envelope: { expires_at: binding.envelope.expires_at }, replayed: true });
    f.db.exec('DROP TRIGGER stage_envelope_no_update');
    f.db.prepare('UPDATE orchestration_stage_envelope SET stage_json=? WHERE attempt_id=?').run(JSON.stringify({ ...binding.envelope, allowed_actions: ['permissions'] }), 'attempt-make');
    expect(() => f.binder.read('attempt-make')).toThrow('stage_persisted_hash_mismatch');
  });
  it('rejects parent expansion or forged parent envelope even if run id matches', () => {
    const f = fixture();
    const change = (stage: Partial<StageEnvelopeRequest['stage']>) => ({ ...f.request, stage: { ...f.request.stage, ...stage } });
    expect(() => f.binder.bind(change({ allowedActions: ['permissions'] }))).toThrow('permission_expansion');
    expect(() => f.binder.bind(change({ egress: ['https://outside.example'] }))).toThrow('permission_expansion');
    expect(() => f.binder.bind(change({ expiresAt: '2026-09-13T00:00:00.000Z' }))).toThrow('expiry_expansion');
    expect(() => f.binder.bind({ ...f.request, parentEnvelope: { ...f.parent, allowed_actions: [...f.parent.allowed_actions, 'permissions'] } })).toThrow('parent_binding_mismatch');
    expect(f.db.prepare('SELECT count(*) n FROM orchestration_stage_envelope').get()).toEqual({ n: 0 });
  });
  it('rejects scope-specific privilege, worktree and symlink expansion', () => {
    const f = fixture(); f.state.scopeActions = ['read'];
    expect(() => f.binder.bind(f.request)).toThrow('permission_expansion');
    f.state.scopeActions = [...f.parent.allowed_actions]; f.state.scopeRoot = f.sub;
    expect(() => f.binder.bind({ ...f.request, stage: { ...f.request.stage, worktreeRealpath: f.workspace } })).toThrow('permission_expansion');
    const outside = join(f.root, 'outside'); mkdirSync(outside); const link = join(f.workspace, 'escape'); symlinkSync(outside, link, 'junction');
    expect(() => f.binder.bind({ ...f.request, stage: { ...f.request.stage, worktreeRealpath: link } })).toThrow('permission_expansion');
    f.state.scopeRoot = f.workspace; f.state.scopeActions.push('permissions');
    expect(() => f.binder.bind(f.request)).toThrow('scope_expansion');
  });
  it('supervised cannot become bounded, expired or denied stages cannot bind', () => {
    const f = fixture('supervised');
    expect(() => f.binder.bind({ ...f.request, stage: { ...f.request.stage, autonomyLevel: 'bounded' } })).toThrow('autonomy_expansion');
    f.state.now = Date.parse(f.request.stage.expiresAt); expect(() => f.binder.bind(f.request)).toThrow('stage_expired');
    f.state.now = Date.parse('2026-09-11T00:00:00.000Z'); f.state.authorized = false;
    expect(() => f.binder.bind(f.request)).toThrow('stage_not_authorized');
  });
  it('requires exact claimed lineage, accepted parent approval and policy digest', () => {
    const f = fixture();
    expect(() => f.binder.bind({ ...f.request, attemptId: 'not-claimed' })).toThrow('attempt_lineage');
    expect(() => f.binder.bind({ ...f.request, taskId: 'think' })).toThrow('attempt_lineage');
    f.db.prepare('DELETE FROM approval_event').run(); expect(() => f.binder.bind(f.request)).toThrow('parent_not_approved');
  });
  it('planner/verifier cannot receive write actions, model-only verifier can have empty scopes', () => {
    const f = fixture(); f.store.claim({ runId: 'workflow', taskId: 'think', attemptId: 'attempt-think', candidateId: 'agent', observedAtMs: f.state.now });
    expect(() => f.binder.bind({ ...f.request, taskId: 'think', attemptId: 'attempt-think' })).toThrow('readonly_role');
    expect(f.binder.bind({ ...f.request, taskId: 'think', attemptId: 'attempt-think', stage: { ...f.request.stage, allowedActions: [] } }).owner.run_id).toBe('attempt-think');
    f.binder.bind(f.request);
    const stage = f.db.prepare('SELECT parent_envelope_hash,stage_envelope_hash,plan_digest,policy_digest FROM orchestration_stage_envelope WHERE attempt_id=?').get('attempt-make') as any;
    const selectionBody = JSON.stringify({ fixture: true, attemptId: 'attempt-make' }), selectionDigest = createHash('sha256').update(selectionBody).digest('hex');
    f.db.prepare("INSERT INTO attempt_selection VALUES('attempt-make','workflow','fixture-request','monetary',?,?)").run(selectionDigest, selectionBody);
    const subjectDigest = createHash('sha256').update('fixture-subject').digest('hex');
    f.store.handoffActivity.recordLaunchIntent({ runId: 'workflow', taskId: 'make', attemptId: 'attempt-make', candidateId: 'agent', selectionDigest, expectedSubjectDigest: subjectDigest,
      tool: { id: 'fixture-tool', revision: 'v1' }, model: null, parentEnvelopeHash: stage.parent_envelope_hash, stageEnvelopeHash: stage.stage_envelope_hash, planDigest: stage.plan_digest, policyDigest: stage.policy_digest });
    f.db.prepare("INSERT INTO session_handle VALUES('session-attempt-make',1,'fixture',?,'root-task','attempt-make')").run(f.workspace);
    f.store.handoffActivity.recordAttemptIdentity({ identityId: 'identity-attempt-make', attemptId: 'attempt-make', subjectDigest, durableRef: 'session:session-attempt-make', observedAtMs: f.state.now });
    expect(f.store.finish({ runId: 'workflow', taskId: 'make', attemptId: 'attempt-make', receiptId: 'finished', revision: 1, outcome: 'succeeded', cleanup: 'clean', evidenceRef: 'host-proof', observedAtMs: f.state.now }).state).toBe('completed');
    f.store.claim({ runId: 'workflow', taskId: 'check', attemptId: 'attempt-check', candidateId: 'agent', observedAtMs: f.state.now });
    expect(f.binder.bind({ ...f.request, taskId: 'check', attemptId: 'attempt-check', stage: { ...f.request.stage, allowedActions: [] } }).envelope.allowed_actions).toEqual([]);
    expect(() => f.binder.bind({ ...f.request, taskId: 'check', attemptId: 'attempt-check', stage: { ...f.request.stage, allowedActions: ['command'] } })).toThrow();
  });
  it('rejects stored plan with a different policy digest and accessor input before evaluating it', () => {
    const f = fixture('bounded', true);
    expect(() => f.binder.bind(f.request)).toThrow('stage_policy_plan_mismatch');
    let evaluated = false;
    const hostile = { ...f.request };
    Object.defineProperty(hostile, 'parentEnvelope', { get() { evaluated = true; return f.parent; } });
    expect(() => f.binder.bind(hostile)).toThrow('invalid_stage_fields'); expect(evaluated).toBe(false);
  });
  it('guards REPLACE and owner/envelope lineage without freezing runtime state', () => {
    const f = fixture(), b = f.binder.bind(f.request);
    expect(() => f.db.prepare('INSERT OR REPLACE INTO orchestration_stage_envelope SELECT * FROM orchestration_stage_envelope').run()).toThrow('immutable');
    expect(() => f.db.prepare('INSERT OR REPLACE INTO run SELECT * FROM run WHERE id=?').run(b.owner.run_id)).toThrow('immutable');
    expect(() => f.db.prepare('UPDATE run SET envelope_hash=? WHERE id=?').run(f.parentHash, b.owner.run_id)).toThrow('immutable');
    expect(() => f.db.prepare('INSERT OR REPLACE INTO envelope SELECT * FROM envelope WHERE envelope_hash=?').run(b.envelopeHash)).toThrow('immutable');
    f.db.prepare('UPDATE run SET write_in_progress=1 WHERE id=?').run(b.owner.run_id);
    expect(f.db.prepare('SELECT write_in_progress FROM run WHERE id=?').get(b.owner.run_id)).toEqual({ write_in_progress: 1 });
  });
});
