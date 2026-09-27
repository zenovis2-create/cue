import { createHash } from 'node:crypto';
import type { RequirementKind } from './requirements.js';

export type EvidenceVerdict = 'pass' | 'fail' | 'unknown';
export interface EvidencePolicyDescriptor {
  readonly requirementId: string; readonly kind: RequirementKind; readonly producerTaskIds: readonly string[]; readonly sourceRevision:string;
  readonly targetIds: readonly string[]; readonly checkerId: string; readonly checkerRevision: string; readonly parametersDigest: string;
  readonly hostileCheckIds: readonly string[]; readonly requiredSectionIds: readonly string[]; readonly claimIds: readonly string[];
  readonly requiresRender: boolean;
  readonly remote?: Readonly<{ accountId: string; resourceId: string; operationId: string; idempotencyKey: string; expectedTransition: string; observerId: string; observerRevision: string }>;
}
export interface EvidenceTarget {
  readonly targetId: string; readonly kind: 'filesystem' | 'retrieved-source' | 'generated-output' | 'remote-state'; readonly byteLength: number; readonly digest: string;
  readonly sourceIdentity?: string; readonly retrievedAtMs?: number; readonly accountId?: string; readonly resourceId?: string; readonly operationId?: string;
  readonly idempotencyKey?: string; readonly transition?: string; readonly observerId?: string; readonly observerRevision?: string; readonly observedAtMs?: number;
}
export interface EvidenceObservation {
  readonly origin: 'host-observation' | 'model-report'; readonly checkerId: string; readonly checkerRevision: string; readonly checkerPrincipal: string;
  readonly producerAttemptPrincipal: string; readonly parametersDigest: string; readonly observedAtMs: number; readonly sourceRevision: string;
  readonly exitStatus: number | null; readonly targetManifestDigest: string; readonly verdict: EvidenceVerdict; readonly hostileChecks: readonly string[];
  readonly claimSourceMap: Readonly<Record<string, readonly string[]>>; readonly requirementSections: readonly string[]; readonly renderVerified: boolean; readonly targets: readonly EvidenceTarget[];
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const validHash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096 && !/[\u0000-\u001f\u007f]/u.test(value);
const unique = (value: unknown, empty = false): value is readonly string[] => Array.isArray(value) && (empty || value.length > 0) && value.length <= 256 && new Set(value).size === value.length && value.every(text);
const same = (a: readonly string[], b: readonly string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export function validateEvidencePolicy(value: EvidencePolicyDescriptor): Readonly<EvidencePolicyDescriptor> {
  if (!value || !['code', 'research', 'document', 'external'].includes(value.kind) || !text(value.requirementId) || !unique(value.producerTaskIds)||!text(value.sourceRevision)
    || !unique(value.targetIds) || !text(value.checkerId) || !text(value.checkerRevision) || !validHash(value.parametersDigest)
    || !unique(value.hostileCheckIds, true) || !unique(value.requiredSectionIds, true) || !unique(value.claimIds, true) || typeof value.requiresRender!=='boolean') throw Error('evidence_policy_invalid');
  if ((value.kind === 'research') !== (value.claimIds.length > 0)) throw Error(value.kind === 'research' ? 'evidence_policy_claims_required' : 'evidence_policy_claims_unexpected');
  if ((value.kind === 'document') !== (value.requiredSectionIds.length > 0)) throw Error(value.kind === 'document' ? 'evidence_policy_sections_required' : 'evidence_policy_sections_unexpected');
  if (value.kind === 'external') {
    const remote = value.remote;
    if (!remote || !text(remote.accountId) || !text(remote.resourceId) || !text(remote.operationId) || !text(remote.idempotencyKey)
      || !text(remote.expectedTransition) || !text(remote.observerId) || !text(remote.observerRevision)) throw Error('evidence_policy_remote_required');
  } else if (value.remote !== undefined) throw Error('evidence_policy_remote_unexpected');
  return Object.freeze({ ...value, producerTaskIds:Object.freeze([...value.producerTaskIds].sort()),targetIds: Object.freeze([...value.targetIds].sort()), hostileCheckIds: Object.freeze([...value.hostileCheckIds].sort()),
    requiredSectionIds: Object.freeze([...value.requiredSectionIds].sort()), claimIds: Object.freeze([...value.claimIds].sort()), remote: value.remote ? Object.freeze({ ...value.remote }) : undefined });
}

export function evaluateEvidence(policyInput: EvidencePolicyDescriptor, observation: EvidenceObservation, nowMs: number, maxAgeMs: number): Readonly<{ verdict: EvidenceVerdict; reasons: readonly string[] }> {
  const policy = validateEvidencePolicy(policyInput), reasons: string[] = [];
  if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 0) throw Error('evidence_time_invalid');
  if (!observation || observation.origin !== 'host-observation') reasons.push('trusted-observation-required');
  if (observation?.checkerId !== policy.checkerId || observation?.checkerRevision !== policy.checkerRevision || observation?.parametersDigest !== policy.parametersDigest) reasons.push('checker-binding-mismatch');
  if (!text(observation?.checkerPrincipal) || !text(observation?.producerAttemptPrincipal) || observation.checkerPrincipal === observation.producerAttemptPrincipal) reasons.push('independent-checker-required');
  if (!Number.isSafeInteger(observation?.observedAtMs) || observation.observedAtMs > nowMs || nowMs - observation.observedAtMs > maxAgeMs) reasons.push('stale-or-future-observation');
  if (!text(observation?.sourceRevision)) reasons.push('source-revision-required');
  const targets = Array.isArray(observation?.targets) ? observation.targets : [], ids = targets.map(target => target?.targetId);
  if (!same(ids as string[], policy.targetIds) || new Set(ids).size !== ids.length || targets.some(target => !target || !text(target.targetId) || !Number.isSafeInteger(target.byteLength) || target.byteLength <= 0 || !validHash(target.digest))) reasons.push('target-manifest-mismatch');
  const manifest = hash(JSON.stringify(targets.map(target => ({ ...target })).sort((a, b) => a.targetId.localeCompare(b.targetId))));
  if (observation?.targetManifestDigest !== manifest) reasons.push('manifest-digest-mismatch');
  if (!unique(observation?.hostileChecks, true) || !policy.hostileCheckIds.every(id => observation.hostileChecks.includes(id))) reasons.push('hostile-check-missing');
  if (policy.kind === 'code' && (targets.some(target => target.kind !== 'filesystem') || observation.exitStatus !== 0)) reasons.push('code-check-incomplete');
  if (policy.kind === 'research') {
    if (targets.some(target => target.kind !== 'retrieved-source' || !text(target.sourceIdentity) || !Number.isSafeInteger(target.retrievedAtMs) || target.retrievedAtMs! > observation.observedAtMs || observation.observedAtMs - target.retrievedAtMs! > maxAgeMs)) reasons.push('retrieved-source-invalid');
    if (policy.claimIds.some(claim => !Array.isArray(observation.claimSourceMap?.[claim]) || !observation.claimSourceMap[claim].length || observation.claimSourceMap[claim].some(id => !policy.targetIds.includes(id)))) reasons.push('claim-source-map-incomplete');
  }
  if (policy.kind === 'document' && (targets.some(target => !['filesystem', 'generated-output'].includes(target.kind)) || !same(observation.requirementSections ?? [], policy.requiredSectionIds) || (policy.requiresRender&&!observation.renderVerified))) reasons.push('document-check-incomplete');
  if (policy.kind === 'external') {
    const remote = policy.remote!;
    if (targets.some(target => target.kind !== 'remote-state' || target.accountId !== remote.accountId || target.resourceId !== remote.resourceId || target.operationId !== remote.operationId
      || target.idempotencyKey !== remote.idempotencyKey || target.transition !== remote.expectedTransition || target.observerId !== remote.observerId || target.observerRevision !== remote.observerRevision
      || !Number.isSafeInteger(target.observedAtMs) || target.observedAtMs! > observation.observedAtMs || observation.observedAtMs - target.observedAtMs! > maxAgeMs)) reasons.push('authoritative-remote-state-required');
  }
  if (observation?.verdict === 'fail') return Object.freeze({ verdict: 'fail', reasons: Object.freeze(reasons.length ? reasons : ['checker-failed']) });
  return Object.freeze({ verdict: reasons.length ? 'unknown' : observation?.verdict === 'pass' ? 'pass' : 'unknown', reasons: Object.freeze(reasons) });
}
