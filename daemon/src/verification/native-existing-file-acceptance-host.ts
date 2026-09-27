import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Ledger } from '../ledger.js';
import { identifyChangeSnapshotRoot, snapshotRelativeNative, type ChangeSnapshotIdentity } from '../change-snapshot-host.js';
import { createStageEnvelopeBinder, type StageEnvelopeBinding } from '../orchestration/stage-envelope.js';
import { createNativeRuntimeReceiptStore } from '../orchestration/native-runtime-receipts.js';
import { validateTaskPlan, type ValidatedPlan } from '../orchestration/plan.js';
import { createRequirementContractStore } from './requirements.js';
import type { EvidencePolicyDescriptor, EvidenceTarget } from './evidence-policy.js';
import {
  createNativeExistingFileContract, verifyNativeExistingFileArtifacts,
  NATIVE_EXISTING_FILE_CHECKER_ID, NATIVE_EXISTING_FILE_CHECKER_REVISION,
} from './native-existing-file-checker.js';
import type {
  AcceptanceHost, AcceptanceContext, AcceptanceManifest, AcceptanceArtifact,
  CheckerContext, RawCheckerObservation, AcceptanceVerdict,
} from './acceptance.js';

export type NativeExistingFileContract = ReturnType<typeof createNativeExistingFileContract>;
export type NativeExistingFileTaskBinding = Readonly<{requirementId:string;producerTaskId:string;verifierTaskId:string;contract:NativeExistingFileContract}>;
export const NATIVE_EXISTING_FILE_OBSERVATION_VERSION = 'cue-native-existing-file-observation-v1';

const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function fail(code: string): never { throw Error(`native_acceptance_${code}`); }

/** This module's own current bytes. The independent principal is the checker code
 * itself, so a changed implementation is a changed principal. Unreadable is fatal:
 * a principal that cannot be measured must never be asserted.
 *
 * Consequence, by design: the compiled `dist` bytes and the transformed source bytes are
 * different files, so they yield different principals. A run whose host build is replaced
 * mid-flight therefore fails closed on the next principal comparison instead of accepting
 * across two different implementations. Receipts are not portable between builds, which is
 * the honest reading of "the checker's current authority-code digest". */
function ownCodeDigest(): string {
  try { return sha(readFileSync(fileURLToPath(import.meta.url))); } catch { fail('code_digest_unavailable'); }
}

/** Filesystem-target policy for the approved existing-file contract. `code` requires
 * empty sections/claims/hostile checks and a zero exit status, so those are fixed here
 * rather than accepted from a caller. */
export function nativeExistingFileEvidencePolicy(input: {
  requirementId: string; producerTaskId: string; contract: NativeExistingFileContract;
}): Readonly<EvidencePolicyDescriptor> {
  const { requirementId, producerTaskId, contract } = input;
  const rebuilt = createNativeExistingFileContract(contract.targets);
  if (rebuilt.parametersDigest !== contract.parametersDigest
    || contract.checkerId !== NATIVE_EXISTING_FILE_CHECKER_ID
    || contract.checkerRevision !== NATIVE_EXISTING_FILE_CHECKER_REVISION) fail('contract_integrity');
  return Object.freeze({
    requirementId, kind: 'code' as const,
    producerTaskIds: Object.freeze([producerTaskId]),
    sourceRevision: 'native-existing-file:' + sha(JSON.stringify({
      producerTaskId, parametersDigest: contract.parametersDigest,
      targets: contract.targets.map(t => [t.targetId, t.relativePath, t.expectedSha256, t.expectedByteLength]),
    })),
    targetIds: Object.freeze(contract.targets.map(t => t.targetId).sort()),
    checkerId: contract.checkerId, checkerRevision: contract.checkerRevision,
    parametersDigest: contract.parametersDigest,
    hostileCheckIds: Object.freeze([]), requiredSectionIds: Object.freeze([]),
    claimIds: Object.freeze([]), requiresRender: false,
  });
}

const policyIdentity = (p: EvidencePolicyDescriptor) => JSON.stringify([p.requirementId, p.kind, p.producerTaskIds,
  p.sourceRevision, [...p.targetIds].sort(), p.checkerId, p.checkerRevision, p.parametersDigest,
  [...p.hostileCheckIds].sort(), [...p.requiredSectionIds].sort(), [...p.claimIds].sort(), p.requiresRender, p.remote ?? null]);

type Measured = Readonly<{ targetId: string; relativePath: string; sha256: string; byteLength: number; sourceRef: string }>;

/** Fixed native existing-file acceptance host. It NEVER launches a process and never
 * writes: every artifact fact comes from the protected snapshot helper reading real
 * bytes under the run's own approved worktree. There is deliberately no authentication
 * flag, no transport, no authorization callback, no checker callback and no caller
 * verdict: an unprovable fact yields `unknown` or throws, never `pass`. */
export function createNativeExistingFileAcceptanceHost(host: {
  db: Ledger; now(): number;
  contract?: NativeExistingFileContract;
  producerTaskId?: string;
  producerPrincipalForAttempt(stage: StageEnvelopeBinding): string | null;
  timeoutMs?: number; maxObservationAgeMs?: number;
}) {
  const { db } = host;
  const taskId = (value:unknown): value is string => typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u.test(value);
  const contract = host.contract ? createNativeExistingFileContract(host.contract.targets) : null;
  if (contract && (contract.parametersDigest !== host.contract!.parametersDigest
    || host.contract!.checkerId !== NATIVE_EXISTING_FILE_CHECKER_ID
    || host.contract!.checkerRevision !== NATIVE_EXISTING_FILE_CHECKER_REVISION)) fail('contract_integrity');
  if (Boolean(contract) !== Boolean(host.producerTaskId) || (host.producerTaskId !== undefined && !taskId(host.producerTaskId))) fail('producer_task');
  if (typeof host.producerPrincipalForAttempt !== 'function') fail('producer_principal_resolver');
  const byRun = new Map<string,readonly NativeExistingFileTaskBinding[]>();
  function registerRun(runId:string, input:readonly NativeExistingFileTaskBinding[]) {
    if (!taskId(runId) || !Array.isArray(input) || input.length<1 || input.length>64) fail('bindings');
    const bindings=input.map(item=>{
      if (!item || !taskId(item.requirementId) || !taskId(item.producerTaskId) || !taskId(item.verifierTaskId)
        || item.producerTaskId===item.verifierTaskId || !item.contract) fail('bindings');
      const checked=createNativeExistingFileContract(item.contract.targets);
      if (checked.parametersDigest!==item.contract.parametersDigest || checked.checkerId!==NATIVE_EXISTING_FILE_CHECKER_ID
        || checked.checkerRevision!==NATIVE_EXISTING_FILE_CHECKER_REVISION) fail('contract_integrity');
      return Object.freeze({requirementId:item.requirementId,producerTaskId:item.producerTaskId,verifierTaskId:item.verifierTaskId,contract:checked});
    });
    const ids=bindings.map(b=>b.requirementId),targets=bindings.flatMap(b=>b.contract.targets);
    if (new Set(ids).size!==ids.length || new Set(targets.map(t=>t.targetId)).size!==targets.length
      || new Set(targets.map(t=>t.relativePath.toLocaleLowerCase('en-US'))).size!==targets.length) fail('bindings');
    const frozen=Object.freeze(bindings);
    const identity=(values:readonly NativeExistingFileTaskBinding[])=>JSON.stringify(values.map(b=>
      [b.requirementId,b.producerTaskId,b.verifierTaskId,b.contract.parametersDigest]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'en-US')));
    const prior=byRun.get(runId);
    if(prior&&identity(prior)!==identity(frozen))fail('bindings_conflict');
    if(!prior)byRun.set(runId,frozen);
    return Object.freeze({id:NATIVE_EXISTING_FILE_CHECKER_ID,revision:NATIVE_EXISTING_FILE_CHECKER_REVISION,kinds:Object.freeze(['code'] as const),
      evidencePolicies:Object.freeze((prior??frozen).map(b=>nativeExistingFileEvidencePolicy({requirementId:b.requirementId,producerTaskId:b.producerTaskId,contract:b.contract})))});
  }

  const revision = NATIVE_EXISTING_FILE_CHECKER_REVISION;
  const principal = 'native-existing-file-checker:' + sha(JSON.stringify({
    checkerId: NATIVE_EXISTING_FILE_CHECKER_ID, checkerRevision: revision,
    codeDigest: ownCodeDigest(), parametersDigest: contract?.parametersDigest ?? 'per-run-protected-contracts',
  }));

  const now = () => { const value = host.now(); if (!Number.isSafeInteger(value) || value < 0) fail('clock'); return value; };
  const timeoutMs = host.timeoutMs ?? 5000, maxAge = host.maxObservationAgeMs ?? 60000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000
    || !Number.isSafeInteger(maxAge) || maxAge < 1 || maxAge > 86400000) fail('limits');

  const stages = createStageEnvelopeBinder(db, { now, resolveScope: () => { throw Error('no-grants'); }, authorizeStage: () => false });
  const requirements = createRequirementContractStore(db, { now, resolveChecker: () => undefined });

  const receipts = createNativeRuntimeReceiptStore(db);

  /** The independent principal exists only behind an exact successful read-only verifier
   * runtime receipt (migration 050) for this very attempt. Validation is delegated to the
   * issued-receipt store, so a hand-written row cannot manufacture a principal: a missing
   * table, an absent receipt, or a receipt of any other role or verification mode is simply
   * no principal. Renaming a provider role or account can never produce one. */
  function readOnlyVerifierReceipt(stage: StageEnvelopeBinding) {
    let digest: string | undefined;
    try {
      const row = db.prepare("SELECT payload_digest FROM native_runtime_receipt WHERE attempt_id=? AND outcome='succeeded'")
        .get(stage.attemptId) as { payload_digest: string } | undefined;
      digest = row?.payload_digest;
    } catch { return null; }
    if (typeof digest !== 'string') return null;
    let receipt: ReturnType<typeof receipts.read>;
    try { receipt = receipts.read('cue-native-runtime-receipt:' + digest); } catch { return null; }
    if (!receipt || receipt.outcome !== 'succeeded' || receipt.role !== 'model'
      || receipt.verificationMode !== 'read-only-result'
      || receipt.attemptId !== stage.attemptId || receipt.runId !== stage.workflowRunId
      || receipt.taskId !== stage.taskId) return null;
    return receipt;
  }
  /** Read-only lineage read. The approved contract is only usable when the persisted,
   * immutable requirement check already pins its exact parametersDigest, so a swapped
   * contract cannot be smuggled in through construction. */
  function runData(context: AcceptanceContext) {
    const bound = requirements.read(context.runId); if (!bound) fail('requirements_missing');
    if (bound.requirements.digest !== context.requirementsDigest) fail('requirements_mismatch');
    const row = db.prepare('SELECT r.task_id,e.worktree_realpath FROM run r JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE r.id=?')
      .get(context.runId) as { task_id: string; worktree_realpath: string } | undefined;
    if (!row || typeof row.worktree_realpath !== 'string' || !row.worktree_realpath) fail('worktree_missing');
    const saved = db.prepare('SELECT payload FROM orchestration_plan WHERE run_id=?').get(context.runId) as { payload: string } | undefined;
    if (!saved) fail('plan_missing');
    const raw = JSON.parse(Buffer.isBuffer(saved.payload) ? saved.payload.toString() : saved.payload) as ValidatedPlan;
    const plan = validateTaskPlan(raw.approval, { revision: raw.revision, policyRevision: raw.approval.policyRevision, policyDigest: raw.approval.policyDigest, tasks: raw.tasks });
    if (plan.digest !== context.planDigest || bound.requirements.planDigest !== context.planDigest
      || bound.requirements.policyDigest !== context.policyDigest) fail('plan_mismatch');
    const registered=byRun.get(context.runId);
    const bindings=registered ?? (()=>{
      if (!contract || !host.producerTaskId) fail('bindings_missing');
      const matching=bound.requirements.contracts.filter(c=>c.checks.some(check=>check.checkerId===NATIVE_EXISTING_FILE_CHECKER_ID
        && check.revision===revision && check.parametersDigest===contract.parametersDigest));
      if(matching.length!==1)fail('contract_not_bound');
      const verifier=plan.tasks.find(task=>task.role==='verifier'&&task.requirementIds.includes(matching[0]!.id));
      if(!verifier)fail('verifier_task_absent');
      return Object.freeze([Object.freeze({requirementId:matching[0]!.id,producerTaskId:host.producerTaskId,verifierTaskId:verifier.id,contract})]);
    })();
    if(bound.requirements.contracts.length!==bindings.length)fail('requirement_coverage');
    for(const binding of bindings){
      const requirement=bound.requirements.contracts.find(c=>c.id===binding.requirementId);
      if(!requirement||requirement.kind!=='code'||requirement.checks.length!==1)fail('contract_not_bound');
      const check=requirement.checks[0]!,expectedIds=binding.contract.targets.map(t=>t.targetId).sort();
      if(check.checkerId!==NATIVE_EXISTING_FILE_CHECKER_ID||check.revision!==revision
        ||check.parametersDigest!==binding.contract.parametersDigest
        ||JSON.stringify([...check.targetIds].sort())!==JSON.stringify(expectedIds))fail('target_ids_mismatch');
      const producer=plan.tasks.find(t=>t.id===binding.producerTaskId),verifier=plan.tasks.find(t=>t.id===binding.verifierTaskId);
      if(!producer||producer.role!=='implementation'||!producer.requirementIds.includes(binding.requirementId)
        ||!verifier||verifier.role!=='verifier'||!verifier.requirementIds.includes(binding.requirementId)
        ||!verifier.dependencyIds.includes(producer.id))fail('task_mapping');
      const policy=bound.requirements.evidencePolicies.find(p=>p.requirementId===binding.requirementId&&p.parametersDigest===binding.contract.parametersDigest);
      if(!policy||policyIdentity(policy)!==policyIdentity(nativeExistingFileEvidencePolicy({requirementId:binding.requirementId,
        producerTaskId:binding.producerTaskId,contract:binding.contract})))fail('policy_mismatch');
    }
    return { worktree: row.worktree_realpath, bindings };
  }

  /** Real bytes only. A helper that is unavailable or cannot prove a path is a refusal,
   * never an empty or optimistic artifact set. */
  function measure(worktree: string, bindings:readonly NativeExistingFileTaskBinding[]): { rootIdentity: ChangeSnapshotIdentity; measured: readonly Measured[] } {
    const root = identifyChangeSnapshotRoot(worktree);
    if (root.state !== 'ok') fail(`root_${root.reason}`);
    const measured: Measured[] = [];
    for (const target of bindings.flatMap(binding=>binding.contract.targets)) {
      const response = snapshotRelativeNative({ root: worktree, expectedRoot: root.identity, targets: [target.relativePath], maxBytes: target.maxBytes });
      if (response.state !== 'ok') fail(`snapshot_${response.reason}`);
      if (response.rootIdentity.volumeSerial !== root.identity.volumeSerial || response.rootIdentity.fileId !== root.identity.fileId) fail('snapshot_root_drift');
      const observed = response.results.length === 1 ? response.results[0] : undefined;
      if (!observed || observed.state !== 'ok' || typeof observed.sha256 !== 'string' || !Number.isSafeInteger(observed.byteLength) || !observed.identity) fail('snapshot_target');
      measured.push(Object.freeze({
        targetId: target.targetId, relativePath: target.relativePath,
        sha256: observed.sha256, byteLength: observed.byteLength!,
        sourceRef: 'cue-native-existing-file:' + sha(JSON.stringify([target.relativePath, observed.sha256, observed.byteLength,
          observed.identity.volumeSerial, observed.identity.fileId])),
      }));
    }
    return { rootIdentity: root.identity, measured: Object.freeze(measured) };
  }

  const artifacts = (measured: readonly Measured[]): readonly AcceptanceArtifact[] => Object.freeze(
    [...measured].sort((a, b) => a.targetId.localeCompare(b.targetId, 'en-US')).map(item => Object.freeze({
      targetId: item.targetId, digest: item.sha256, sizeBytes: item.byteLength,
      sourceRef: item.sourceRef, kind: 'filesystem' as const,
    })));

  function manifestFor(context: AcceptanceContext): { manifest: AcceptanceManifest; measured: readonly Measured[]; bindings: readonly NativeExistingFileTaskBinding[] } {
    const data = runData(context);
    const { measured } = measure(data.worktree,data.bindings);
    const manifest: AcceptanceManifest = Object.freeze({
      runId: context.runId, revision: context.revision, planDigest: context.planDigest,
      policyDigest: context.policyDigest, requirementsDigest: context.requirementsDigest,
      artifacts: artifacts(measured), observedAt: now(),
    });
    return { manifest, measured, bindings:data.bindings };
  }

  const stable = (value: AcceptanceManifest) => sha(JSON.stringify({ ...value, observedAt: 0 }));
  const captured = new Map<string, string>();
  const issued = new Map<string, { hash: string; verdict: AcceptanceVerdict }>();

  const checker = Object.freeze({
    id: NATIVE_EXISTING_FILE_CHECKER_ID, revision, kinds: Object.freeze(['code'] as const),
    evidencePolicies: undefined as unknown as undefined,
    async collect(context: CheckerContext, signal: AbortSignal): Promise<RawCheckerObservation> {
      signal.throwIfAborted();
      const current = manifestFor(context);
      const binding=current.bindings.find(item=>item.requirementId===context.requirement.id);
      if(!binding)fail('requirement_mapping');
      const expectedPolicy = nativeExistingFileEvidencePolicy({ requirementId: binding.requirementId, producerTaskId: binding.producerTaskId, contract:binding.contract });
      const stage = stages.readHistorical(context.verifierAttemptId);
      if (!stage || stage.envelopeHash !== context.stageEnvelopeHash || stage.taskId!==binding.verifierTaskId) fail('stage_drift');
      // Recheck here too: a principal obtained earlier must still be provable at collect time.
      if (!readOnlyVerifierReceipt(stage)) fail('verifier_receipt_missing');
      if (context.reviewerPrincipal !== principal
        || context.check.checkerId !== NATIVE_EXISTING_FILE_CHECKER_ID || context.check.revision !== revision
        || context.check.parametersDigest !== binding.contract.parametersDigest
        || context.requirement.id !== binding.requirementId || context.requirement.kind !== 'code'
        || policyIdentity(context.evidencePolicy) !== policyIdentity(expectedPolicy)
        || JSON.stringify(context.targets) !== JSON.stringify(current.manifest.artifacts.filter(a=>binding.contract.targets.some(t=>t.targetId===a.targetId)))) fail('observation_mismatch');
      if(!context.producerPrincipals.length || context.producerPrincipals.some(value=>!value||value===principal))fail('producer_principal');
      if (captured.get(context.manifestDigest) !== stable(current.manifest)) fail('manifest_changed');
      const covered=current.measured.filter(item=>binding.contract.targets.some(t=>t.targetId===item.targetId));
      const result = verifyNativeExistingFileArtifacts(binding.contract, covered.map(item => ({
        targetId: item.targetId, relativePath: item.relativePath, sha256: item.sha256,
        byteLength: item.byteLength, sourceRef: item.sourceRef,
      })));
      const evidenceTargets: readonly EvidenceTarget[] = Object.freeze([...current.manifest.artifacts.filter(a=>binding.contract.targets.some(t=>t.targetId===a.targetId))]
        .map(target => Object.freeze({ targetId: target.targetId, kind: 'filesystem' as const, byteLength: target.sizeBytes, digest: target.digest }))
        .sort((a, b) => a.targetId.localeCompare(b.targetId, 'en-US')));
      const observedAt = now();
      const bytes = Buffer.from(JSON.stringify({
        version: NATIVE_EXISTING_FILE_OBSERVATION_VERSION, contextDigest: context.digest,
        verifierAttemptId: context.verifierAttemptId, stageEnvelopeHash: stage.envelopeHash,
        principal, parametersDigest: binding.contract.parametersDigest,
        manifest: current.manifest.artifacts, verdict: result.verdict, reasons: result.reasons, observedAt,
      }));
      // Defence in depth for the window between the first measurement and these bytes.
      // Independent review confirmed the exploitable case is already caught by the
      // `captured` guard above, so removing this line does not fail the owned suite; it is
      // kept because it closes a real time-of-check window, and that is recorded rather
      // than claimed as test-covered.
      if (stable(manifestFor(context).manifest) !== stable(current.manifest)) fail('manifest_changed');
      signal.throwIfAborted();
      issued.set(context.digest, { hash: sha(bytes), verdict: result.verdict });
      return Object.freeze({
        contextDigest: context.digest, principalId: principal, origin: 'host-observation' as const, observedAt,
        sourceRefs: Object.freeze(['cue-native-existing-file-observation:' + sha(bytes), ...covered.map(item => item.sourceRef)]),
        bytes,
        evidence: Object.freeze({
          origin: 'host-observation' as const, checkerId: NATIVE_EXISTING_FILE_CHECKER_ID, checkerRevision: revision,
          checkerPrincipal: principal, producerAttemptPrincipal: context.producerPrincipals[0] ?? '',
          parametersDigest: binding.contract.parametersDigest, observedAtMs: observedAt,
          sourceRevision: expectedPolicy.sourceRevision,
          exitStatus: result.verdict === 'pass' ? 0 : 1,
          targetManifestDigest: sha(JSON.stringify(evidenceTargets.map(target => ({ ...target })))),
          verdict: result.verdict, hostileChecks: Object.freeze([]), claimSourceMap: Object.freeze({}),
          requirementSections: Object.freeze([]), renderVerified: false, targets: evidenceTargets,
        }),
      });
    },
    evaluate(context: CheckerContext, observation: Readonly<RawCheckerObservation>): AcceptanceVerdict {
      const proof = issued.get(context.digest);
      if (!proof) return 'unknown';
      return observation.contextDigest === context.digest && observation.principalId === principal
        && observation.origin === 'host-observation' && proof.hash === sha(observation.bytes) ? proof.verdict : 'unknown';
    },
  });

  const acceptance = Object.freeze<AcceptanceHost>({
    now, timeoutMs, maxObservationAgeMs: maxAge,
    resolveChecker: (id, rev) => id === checker.id && rev === revision ? checker : undefined,
    principalForAttempt(stage) {
      const registered=byRun.get(stage.workflowRunId);
      const bindings=registered ?? (host.producerTaskId ? [{producerTaskId:host.producerTaskId,verifierTaskId:null}] : []);
      if (bindings.some(binding=>binding.producerTaskId===stage.taskId)) return host.producerPrincipalForAttempt(stage);
      if (registered && !registered.some(binding=>binding.verifierTaskId===stage.taskId)) return null;
      try {
        const current = stages.readHistorical(stage.attemptId);
        if (!current || current.envelopeHash !== stage.envelopeHash) return null;
      } catch { return null; }
      return readOnlyVerifierReceipt(stage) ? principal : null;
    },
    async captureManifest(context, signal) {
      signal.throwIfAborted();
      const value = manifestFor(context).manifest;
      signal.throwIfAborted();
      captured.set(sha(JSON.stringify(value)), stable(value));
      return value;
    },
    isManifestCurrent(context, previous) {
      try { return stable(manifestFor(context).manifest) === stable(previous); } catch { return false; }
    },
  });

  return Object.freeze({
    acceptance, principal, parametersDigest: contract?.parametersDigest ?? 'per-run-protected-contracts', registerRun,
    requirementChecker(requirementId: string) {
      if(!contract||!host.producerTaskId)fail('bindings_missing');
      const evidencePolicy = nativeExistingFileEvidencePolicy({ requirementId, producerTaskId: host.producerTaskId, contract });
      return Object.freeze({
        id: NATIVE_EXISTING_FILE_CHECKER_ID, revision, kinds: Object.freeze(['code'] as const),
        evidencePolicies: Object.freeze([evidencePolicy]),
      });
    },
  });
}
