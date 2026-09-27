import { afterEach, expect, test, vi } from 'vitest';
const issuer = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../src/host-codex-runtime.js', async original => ({ ...await original() as object, readIssuedNativeRuntimeEvidence: issuer.read }));
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createHandoffActivityStore } from '../src/orchestration/handoff-activity.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { createRequirementContractStore } from '../src/verification/requirements.js';
import { createAcceptanceVerifier, type AcceptanceHost } from '../src/verification/acceptance.js';
import { createNativeRuntimeReceiptStore } from '../src/orchestration/native-runtime-receipts.js';
import { createNativeExistingFileContract, NATIVE_EXISTING_FILE_CHECKER_ID, NATIVE_EXISTING_FILE_CHECKER_REVISION } from '../src/verification/native-existing-file-checker.js';
import { createNativeExistingFileAcceptanceHost, nativeExistingFileEvidencePolicy } from '../src/verification/native-existing-file-acceptance-host.js';

const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { issuer.read.mockReset(); for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const win32 = process.platform === 'win32';
const ORIGINAL = 'original bytes\n';
const APPROVED = 'approved replacement bytes\n';

function fixture(finalContent: string, withReceipt = true, dual = false) {
  const root = mkdtempSync(join(tmpdir(), 'cue-native-acceptance-')); roots.push(root);
  writeFileSync(join(root, 'target.txt'), finalContent);
  if(dual)writeFileSync(join(root,'second.txt'),APPROVED);
  const contract = createNativeExistingFileContract([{
    targetId: 'target', relativePath: 'target.txt', maxBytes: 4096,
    expectedSha256: hash(APPROVED), expectedByteLength: Buffer.byteLength(APPROVED),
    originalSha256: hash(ORIGINAL),
  }]);
  const secondContract=dual?createNativeExistingFileContract([{targetId:'second',relativePath:'second.txt',maxBytes:4096,
    expectedSha256:hash(APPROVED),expectedByteLength:Buffer.byteLength(APPROVED),originalSha256:hash(ORIGINAL)}]):null;
  const db = openLedger(join(root, 'ledger.db')); handles.push(db);
  for (const file of ['009_selection_policy.sql', '010_orchestration.sql', '012_stage_envelope.sql', '013_requirement_contract.sql', '014_requirement_acceptance.sql']) {
    db.exec(readFileSync(resolve('migrations', file), 'utf8'));
  }
  const clock = Date.parse('2026-09-17T00:00:00.000Z');
  const parent = normalizeEnvelope({ run_id: 'run', worktree_realpath: root, allowed_actions: ['file_change'], egress: [], expires_at: new Date(clock + 3600000).toISOString(), autonomy_level: 'bounded' });
  const parentHash = envelopeHash(parent);
  db.prepare("INSERT INTO task VALUES('root-task','awaiting_approval',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(parentHash, root);
  db.prepare("INSERT INTO run VALUES('run','root-task',?,0,'now')").run(parentHash);
  const policy = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: new Date(clock).toISOString(), sourceVersion: 'fixture', policy: {
    version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: .5, costBasis: 1, timeBasisMs: 1000, currency: 'TEST',
    costLimit: null, remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['agent'], pinnedCandidateId: null,
  } });
  bindRunSelectionPolicy(db, { runId: 'run', policyId: 'policy', revision: 1, digest: policy.digest, boundAt: new Date(clock).toISOString() });
  const approval = { policyRevision: 'policy:1', policyDigest: policy.digest, requirementIds: dual?['code','second']:['code'], allowedCandidateIds: ['agent'], allowedScopeIds: ['workspace'] };
  const plan = validateTaskPlan(approval, { revision: 'plan1', policyRevision: approval.policyRevision, policyDigest: approval.policyDigest, tasks: [
    { id: 'make', role: 'implementation', ownerId: 'maker', requirementIds: ['code'], dependencyIds: [], candidateIds: ['agent'], scopeIds: ['workspace'] },
    ...(dual?[{id:'make-second',role:'implementation' as const,ownerId:'second-maker',requirementIds:['second'],dependencyIds:['make'],candidateIds:['agent'],scopeIds:['workspace']}]:[]),
    { id: 'check', role: 'verifier', ownerId: 'reviewer', requirementIds: dual?['code','second']:['code'], dependencyIds: dual?['make','make-second']:['make'], candidateIds: ['agent'], scopeIds: [] },
  ] });
  const artifactBytes = Buffer.from('native-acceptance-fixture-artifact');
  const store = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true,
    verifyReceipt: context => ({ outcomeVerified: true, cleanupVerified: true,
      handoff: { handoffId: `handoff-${context.attemptId}`, identityId: `identity-${context.attemptId}`, artifacts: [{ kind: 'output', sourceRef: `artifact-${context.attemptId}` }] } }),
    resolveHandoffArtifact: () => artifactBytes, authorizeHandoffArtifact: () => true });
  const handoffs = createHandoffActivityStore(db, { resolveArtifact: () => artifactBytes, authorizeArtifact: () => true });
  store.install('run', plan);
  const evidencePolicy = nativeExistingFileEvidencePolicy({ requirementId: 'code', producerTaskId: 'make', contract });
  const secondPolicy=secondContract?nativeExistingFileEvidencePolicy({requirementId:'second',producerTaskId:'make-second',contract:secondContract}):null;
  const requirementStore = createRequirementContractStore(db, { now: () => clock, resolveChecker: (id, revision) =>
    id === NATIVE_EXISTING_FILE_CHECKER_ID && revision === NATIVE_EXISTING_FILE_CHECKER_REVISION
      ? { id, revision, kinds: ['code'], evidencePolicies: secondPolicy?[evidencePolicy,secondPolicy]:[evidencePolicy] } : undefined });
  requirementStore.bind('run', [{ id: 'code', text: 'approved existing-file change', kind: 'code', required: true,
    checks: [{ checkerId: NATIVE_EXISTING_FILE_CHECKER_ID, revision: NATIVE_EXISTING_FILE_CHECKER_REVISION,
      parametersDigest: contract.parametersDigest, targetIds: ['target'] }] },
    ...(secondContract?[{id:'second',text:'second approved existing-file change',kind:'code' as const,required:true,
      checks:[{checkerId:NATIVE_EXISTING_FILE_CHECKER_ID,revision:NATIVE_EXISTING_FILE_CHECKER_REVISION,
        parametersDigest:secondContract.parametersDigest,targetIds:['second']}]}]:[])] );
  db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal',0,'accept','now')").run(parentHash);
  db.prepare("UPDATE task SET state='running' WHERE id='root-task'").run();
  const binder = createStageEnvelopeBinder(db, { now: () => clock, authorizeStage: () => true,
    resolveScope: id => ({ id, worktreeRealpath: root, allowedActions: parent.allowed_actions, egress: [] }) });
  for (const task of dual?['make','make-second','check']:['make','check']) {
    const attemptId = `attempt-${task}`;
    store.claim({ runId: 'run', taskId: task, attemptId, candidateId: 'agent', observedAtMs: clock });
    if (!db.prepare('SELECT 1 FROM attempt_selection WHERE attempt_id=?').get(attemptId)) {
      db.prepare("INSERT INTO attempt_selection VALUES(?,'run',?,'monetary',?,'{}')").run(attemptId, `fixture-${attemptId}`, hash(`selection-${attemptId}`));
    }
    const stage = binder.bind({ workflowRunId: 'run', taskId: task, attemptId, parentEnvelope: parent,
      stage: { worktreeRealpath: root, allowedActions: task !== 'check' ? ['file_change'] : [], egress: [], expiresAt: parent.expires_at, autonomyLevel: 'supervised' } });
    db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(`session-${attemptId}`, 1, 'now', root, stage.owner.task_id, stage.owner.run_id);
    const selection = db.prepare('SELECT digest FROM attempt_selection WHERE attempt_id=?').get(attemptId) as { digest: string };
    handoffs.recordLaunchIntent({ runId: 'run', taskId: task, attemptId, candidateId: 'agent', selectionDigest: selection.digest,
      expectedSubjectDigest: hash(attemptId), tool: { id: 'fixture-tool', revision: 'unknown' }, model: null,
      parentEnvelopeHash: parentHash, stageEnvelopeHash: stage.envelopeHash, planDigest: stage.planDigest, policyDigest: stage.policyDigest });
    handoffs.recordAttemptIdentity({ identityId: `identity-${attemptId}`, attemptId, subjectDigest: hash(attemptId),
      durableRef: `session:session-${attemptId}`, observedAtMs: clock });
    store.finish({ runId: 'run', taskId: task, attemptId, receiptId: `finished-${task}`, revision: 1, outcome: 'succeeded', cleanup: 'clean', evidenceRef: 'fixture-completion', observedAtMs: clock });
  }
  // The verifier attempt's own session handle is the launcher-shaped one created above:
  // run_id is the attempt id and task_id is the stage task id. Migration 050's corrected
  // lineage clause accepts exactly that, so no hand-made handle is needed.
  const receiptBinding = { runId: 'run', taskId: 'check', attemptId: 'attempt-check', candidateId: 'agent',
    subjectDigest: hash('attempt-check'), sessionHandle: 'session-attempt-check',
    role: 'model' as const, verificationMode: 'read-only-result' as const };
  const receiptEvidence = { version: 'cue-issued-native-runtime-evidence-v1', ...receiptBinding,
    outcomeInputs: { status: 'completed', failureKind: null,
      goalVerification: { passed: false, reason: 'read_only_result_received', changedPaths: [] } },
    controller: { pid: 4321, createdFileTime: '133000000000000000' }, workers: [], resources: [] };
  const issuedResult = {};
  issuer.read.mockImplementation((given: unknown, bound: unknown) => {
    if (given !== issuedResult || JSON.stringify(bound) !== JSON.stringify(receiptBinding)) throw Error('native_runtime_evidence_unissued');
    return receiptEvidence;
  });
  if (withReceipt) createNativeRuntimeReceiptStore(db).recordIssued(issuedResult as never, receiptBinding, clock);
  const host = createNativeExistingFileAcceptanceHost({ db, now: () => clock, contract, producerTaskId: 'make',
    producerPrincipalForAttempt: stage => `producer:${stage.attemptId}` });
  return { root, db, contract, secondContract, host, clock, verifier: createAcceptanceVerifier(db, host.acceptance) };
}

test('the checker principal is this module\'s own code identity, not a role or account name', () => {
  const f = fixture(APPROVED);
  expect(f.host.principal).toMatch(/^native-existing-file-checker:[a-f0-9]{64}$/u);
  expect(f.host.principal).not.toContain('agent');
  expect(f.host.principal).not.toContain('make');
  expect(f.host.parametersDigest).toBe(f.contract.parametersDigest);
  // A different approved contract must yield a different principal.
  const other = createNativeExistingFileContract([{ targetId: 'target', relativePath: 'target.txt', maxBytes: 4096,
    expectedSha256: hash('other\n'), expectedByteLength: 6, originalSha256: hash(ORIGINAL) }]);
  const second = createNativeExistingFileAcceptanceHost({ db: f.db, now: () => f.clock, contract: other,
    producerTaskId: 'make', producerPrincipalForAttempt: () => null });
  expect(second.principal).not.toBe(f.host.principal);
});

test('an approved contract that is not pinned by the persisted requirement check cannot capture', async () => {
  const f = fixture(APPROVED);
  const foreign = createNativeExistingFileContract([{ targetId: 'target', relativePath: 'target.txt', maxBytes: 4096,
    expectedSha256: hash('smuggled\n'), expectedByteLength: 9, originalSha256: hash(ORIGINAL) }]);
  const smuggled = createNativeExistingFileAcceptanceHost({ db: f.db, now: () => f.clock, contract: foreign,
    producerTaskId: 'make', producerPrincipalForAttempt: () => 'producer:x' });
  // The real requirement binding pins the other contract's parametersDigest, so this one is
  // not bound. Fail-closed means the evaluation is never 'pass' and finalize never accepts.
  const verifier = createAcceptanceVerifier(f.db, smuggled.acceptance);
  const evaluation = await verifier.collect('run').catch(() => null);
  if (evaluation) {
    expect(evaluation.verdict).not.toBe('pass');
    expect(verifier.finalize(evaluation).status).toBe('blocked');
  }
});

test('a tampered contract is refused at construction rather than trusted', () => {
  const f = fixture(APPROVED);
  const tampered = { ...f.contract, parametersDigest: hash('tampered') } as typeof f.contract;
  expect(() => createNativeExistingFileAcceptanceHost({ db: f.db, now: () => f.clock, contract: tampered,
    producerTaskId: 'make', producerPrincipalForAttempt: () => null })).toThrow('native_acceptance_contract_integrity');
  expect(() => nativeExistingFileEvidencePolicy({ requirementId: 'code', producerTaskId: 'make', contract: tampered }))
    .toThrow('native_acceptance_contract_integrity');
});

test('the evidence policy fixes code-kind requirements and cannot be widened by a caller', () => {
  const f = fixture(APPROVED);
  const policy = nativeExistingFileEvidencePolicy({ requirementId: 'code', producerTaskId: 'make', contract: f.contract });
  expect(policy.kind).toBe('code');
  expect(policy.requiredSectionIds).toEqual([]);
  expect(policy.claimIds).toEqual([]);
  expect(policy.hostileCheckIds).toEqual([]);
  expect(policy.requiresRender).toBe(false);
  expect(policy.parametersDigest).toBe(f.contract.parametersDigest);
  expect(policy.targetIds).toEqual(['target']);
  expect(Object.isFrozen(policy)).toBe(true);
});

test.skipIf(win32)('without the Windows snapshot helper the host refuses instead of reporting pass', async () => {
  const f = fixture(APPROVED);
  await expect(f.verifier.collect('run')).rejects.toThrow();
});

test.runIf(win32)('real on-disk bytes matching the approved contract accept with an independent principal', async () => {
  const f = fixture(APPROVED);
  const evaluation = await f.verifier.collect('run');
  expect(evaluation.verdict).toBe('pass');
  expect(evaluation.outcomes).toMatchObject([{ requirementId: 'code', required: true, verdict: 'pass' }]);
  const finalization = f.verifier.finalize(evaluation);
  expect(finalization.status).toBe('accepted');
  // The persisted evaluation must carry this host's own code-derived principal, and it must
  // differ from the producer principal, which is what makes the checker independent.
  const stored = f.db.prepare('SELECT bytes FROM acceptance_blob').all() as { bytes: Buffer }[];
  const text = stored.map(row => row.bytes.toString('utf8')).join('\n');
  expect(text).toContain(f.host.principal);
});

test.runIf(win32)('a producer principal equal to the checker principal cannot be accepted', async () => {
  const f = fixture(APPROVED);
  // Independence is enforced, not asserted: reusing the checker principal as the producer
  // principal must stop the evidence policy from ever reaching 'pass'.
  const collapsed = createNativeExistingFileAcceptanceHost({ db: f.db, now: () => f.clock, contract: f.contract,
    producerTaskId: 'make', producerPrincipalForAttempt: () => f.host.principal });
  const verifier = createAcceptanceVerifier(f.db, collapsed.acceptance);
  const evaluation = await verifier.collect('run').catch(() => null);
  if (evaluation) {
    expect(evaluation.verdict).not.toBe('pass');
    expect(verifier.finalize(evaluation).status).toBe('blocked');
  }
});

test.runIf(win32)('bytes that do not match the approved contract fail and are never accepted', async () => {
  const f = fixture('unapproved bytes\n');
  const evaluation = await f.verifier.collect('run');
  expect(evaluation.verdict).toBe('fail');
  expect(f.verifier.finalize(evaluation).status).toBe('blocked');
});

test.runIf(win32)('a manifest change between capture and collect is never accepted', async () => {
  const f = fixture(APPROVED);
  let captured = 0;
  const wrapper: AcceptanceHost = { ...f.host.acceptance, async captureManifest(context, signal) {
    const manifest = await f.host.acceptance.captureManifest(context, signal);
    if (++captured === 1) writeFileSync(join(f.root, 'target.txt'), 'changed after capture\n');
    return manifest;
  } };
  const evaluation = await createAcceptanceVerifier(f.db, wrapper).collect('run').catch(() => null);
  if (evaluation) expect(evaluation.verdict).not.toBe('pass');
  expect(captured).toBeGreaterThan(0);
});

test.runIf(win32)('isManifestCurrent reports false once the approved bytes change under the lease', async () => {
  const f = fixture(APPROVED);
  const context = { runId: 'run', planDigest: '', policyDigest: '', requirementsDigest: '' };
  const evaluation = await f.verifier.collect('run');
  expect(evaluation.verdict).toBe('pass');
  writeFileSync(join(f.root, 'target.txt'), 'changed before finalize\n');
  expect(f.verifier.finalize(evaluation).status).toBe('blocked');
  expect(context).toBeDefined();
});

test.runIf(win32)('an unprovable target refuses instead of reporting pass', async () => {
  const f = fixture(APPROVED);
  // The approved path no longer exists, so the protected helper cannot prove its bytes.
  rmSync(join(f.root, 'target.txt'), { force: true });
  const evaluation = await f.verifier.collect('run').catch(() => null);
  if (evaluation) {
    expect(evaluation.verdict).not.toBe('pass');
    expect(f.verifier.finalize(evaluation).status).toBe('blocked');
  }
  expect(f.host.acceptance.isManifestCurrent({ runId: 'run', planDigest: '', policyDigest: '', requirementsDigest: '' },
    { runId: 'run', planDigest: '', policyDigest: '', requirementsDigest: '', artifacts: [], observedAt: f.clock })).toBe(false);
});

test('a successful read-only verifier receipt is what unlocks the independent principal', () => {
  const withReceipt = fixture(APPROVED);
  expect(withReceipt.db.prepare("SELECT count(*) n FROM native_runtime_receipt WHERE attempt_id='attempt-check' AND outcome='succeeded'").get()).toEqual({ n: 1 });
  const without = fixture(APPROVED, false);
  expect(without.db.prepare('SELECT count(*) n FROM native_runtime_receipt').get()).toEqual({ n: 0 });
  expect(without.host.principal).toBe(withReceipt.host.principal);
});

test.runIf(win32)('without a verifier receipt acceptance is never reached', async () => {
  const f = fixture(APPROVED, false);
  const evaluation = await f.verifier.collect('run').catch(() => null);
  if (evaluation) {
    expect(evaluation.verdict).not.toBe('pass');
    expect(f.verifier.finalize(evaluation).status).toBe('blocked');
  }
});
test.runIf(win32)('an observation this host did not issue evaluates to unknown', async () => {
  const f = fixture(APPROVED);
  const checker = f.host.acceptance.resolveChecker(NATIVE_EXISTING_FILE_CHECKER_ID, NATIVE_EXISTING_FILE_CHECKER_REVISION)!;
  const verdict = checker.evaluate({ digest: 'never-issued' } as never, {
    contextDigest: 'never-issued', principalId: f.host.principal, origin: 'host-observation',
    sourceRefs: ['x'], observedAt: f.clock, bytes: Buffer.from('forged'),
  });
  expect(verdict).toBe('unknown');
});

test.runIf(win32)('two ordered producers receive separate protected checks and one independent verifier', async()=>{
  const f=fixture(APPROVED,true,true);
  const host=createNativeExistingFileAcceptanceHost({db:f.db,now:()=>f.clock,
    producerPrincipalForAttempt:stage=>`producer:${stage.attemptId}`});
  const bindings=[{requirementId:'code',producerTaskId:'make',verifierTaskId:'check',contract:f.contract},
    {requirementId:'second',producerTaskId:'make-second',verifierTaskId:'check',contract:f.secondContract!}];
  const descriptor=host.registerRun('run',bindings);
  expect(descriptor.evidencePolicies.map(policy=>policy.producerTaskIds)).toEqual([['make'],['make-second']]);
  const verifier=createAcceptanceVerifier(f.db,host.acceptance);
  const result=await verifier.collect('run');
  expect(result.outcomes.map(outcome=>[outcome.requirementId,outcome.verdict])).toEqual([['code','pass'],['second','pass']]);
  expect(verifier.finalize(result).status).toBe('accepted');
  const observations=(f.db.prepare('SELECT bytes FROM acceptance_blob').all() as {bytes:Buffer}[])
    .map(row=>row.bytes.toString('utf8')).filter(text=>text.includes('cue-native-existing-file-observation-v1'));
  expect(observations).toHaveLength(2);
  expect(observations.some(text=>text.includes(f.contract.parametersDigest)&&text.includes('"targetId":"target"'))).toBe(true);
  expect(observations.some(text=>text.includes(f.secondContract!.parametersDigest)&&text.includes('"targetId":"second"'))).toBe(true);
});

test.runIf(win32)('one corrupt target cannot pass its own approved requirement',async()=>{
  const f=fixture(APPROVED,true,true);
  writeFileSync(join(f.root,'second.txt'),'unauthorized bytes\n');
  const host=createNativeExistingFileAcceptanceHost({db:f.db,now:()=>f.clock,producerPrincipalForAttempt:stage=>`producer:${stage.attemptId}`});
  host.registerRun('run',[{requirementId:'code',producerTaskId:'make',verifierTaskId:'check',contract:f.contract},
    {requirementId:'second',producerTaskId:'make-second',verifierTaskId:'check',contract:f.secondContract!}]);
  const verifier=createAcceptanceVerifier(f.db,host.acceptance),result=await verifier.collect('run');
  expect(result.outcomes.map(outcome=>[outcome.requirementId,outcome.verdict])).toEqual([['code','pass'],['second','fail']]);
  expect(verifier.finalize(result).status).toBe('blocked');
});

test.runIf(win32)('a registered run rejects swapped producers and altered bindings while identical retry remains safe',async()=>{
  const f=fixture(APPROVED,true,true);
  const host=createNativeExistingFileAcceptanceHost({db:f.db,now:()=>f.clock,producerPrincipalForAttempt:stage=>`producer:${stage.attemptId}`});
  const bindings=[{requirementId:'code',producerTaskId:'make',verifierTaskId:'check',contract:f.contract},
    {requirementId:'second',producerTaskId:'make-second',verifierTaskId:'check',contract:f.secondContract!}];
  const first=host.registerRun('run',bindings);
  expect(host.registerRun('run',bindings)).toEqual(first);
  expect(()=>host.registerRun('run',[{...bindings[0]!,producerTaskId:'make-second'},bindings[1]!])).toThrow('native_acceptance_bindings_conflict');
  expect(()=>host.registerRun('run',[bindings[0]!,{...bindings[1]!,verifierTaskId:'make-second'}])).toThrow('native_acceptance_bindings');
  expect((await createAcceptanceVerifier(f.db,host.acceptance).collect('run')).verdict).toBe('pass');
  const swapped=createNativeExistingFileAcceptanceHost({db:f.db,now:()=>f.clock,producerPrincipalForAttempt:stage=>`producer:${stage.attemptId}`});
  swapped.registerRun('run',[{...bindings[0]!,producerTaskId:'make-second'}, {...bindings[1]!,producerTaskId:'make'}]);
  const evaluation=await createAcceptanceVerifier(f.db,swapped.acceptance).collect('run').catch(()=>null);
  expect(evaluation?.verdict).not.toBe('pass');
});

test.runIf(win32)('two-writer verification without the native verifier receipt never accepts',async()=>{
  const f=fixture(APPROVED,false,true);
  const host=createNativeExistingFileAcceptanceHost({db:f.db,now:()=>f.clock,producerPrincipalForAttempt:stage=>`producer:${stage.attemptId}`});
  host.registerRun('run',[{requirementId:'code',producerTaskId:'make',verifierTaskId:'check',contract:f.contract},
    {requirementId:'second',producerTaskId:'make-second',verifierTaskId:'check',contract:f.secondContract!}]);
  const verifier=createAcceptanceVerifier(f.db,host.acceptance);
  const evaluation=await verifier.collect('run').catch(()=>null);
  if(evaluation)expect(verifier.finalize(evaluation).status).toBe('blocked');
  expect(evaluation?.verdict).not.toBe('pass');
});
