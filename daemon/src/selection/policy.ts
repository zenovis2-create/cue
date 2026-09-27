import { types } from 'node:util';
/** Host-owned selection only. Dispatch must re-admit and atomically reserve budget. */
export interface SelectionPolicy {
  version: 'cue-selection-v1';
  mode: 'efficiency' | 'performance' | 'value' | 'speed';
  qualityMinimum: number;
  costBasis: number;
  timeBasisMs: number;
  currency: string;
  costLimit: number | null;
  remainingTimeMs: number | null;
  maxEstimateAgeMs: number;
  allowedCandidateIds: readonly string[];
  pinnedCandidateId: string | null;
}
export interface CompletionEstimate {
  // Host aggregate includes retries, verification and handoffs, not just first call.
  scope: 'verified-completion-total';
  quality: number;
  expectedCost: number;
  conservativeMaxCost: number | null;
  expectedTimeMs: number;
  conservativeMaxTimeMs: number | null;
  currency: string;
  source: string;
  observedAtMs: number;
}
export interface SelectionCandidate {
  id: string;
  // Host-observed predicates, never accepted from model generated configuration.
  checks: {
    eligible: boolean; authenticated: boolean; compatible: boolean;
    dataAllowed: boolean; resourceAvailable: boolean; quotaAvailable: boolean;
  };
  estimate: CompletionEstimate | null;
}
export interface CandidateAssessment {
  readonly id: string;
  readonly score: number | null;
  readonly exclusions: readonly string[];
}
export interface SelectionDecision {
  readonly policyVersion: SelectionPolicy['version'];
  readonly mode: SelectionPolicy['mode'];
  readonly selectedId: string | null;
  readonly reason: 'ranked' | 'pinned' | 'pin-unavailable' | 'no-eligible-candidate';
  readonly assessments: readonly CandidateAssessment[];
  readonly executionAdmissionRequired: true;
  readonly budgetReservationRequired: true;
}
function fail(): never { throw new TypeError('invalid_selection_input'); }
function record(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail();
  for (const key of own) {
    if (typeof key !== 'string' || !keys.includes(key) || !('value' in Object.getOwnPropertyDescriptor(value, key)!)) fail();
  }
}
function number(value: unknown, positive = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || (positive && value === 0)) fail();
}
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)) fail();
}
function estimate(value: CompletionEstimate): void {
  record(value, ['scope', 'quality', 'expectedCost', 'conservativeMaxCost', 'expectedTimeMs', 'conservativeMaxTimeMs', 'currency', 'source', 'observedAtMs']);
  if (value.scope !== 'verified-completion-total') fail();
  number(value.quality); if (value.quality > 1) fail();
  number(value.expectedCost); number(value.expectedTimeMs); number(value.observedAtMs);
  text(value.currency); text(value.source);
  if (value.conservativeMaxCost !== null) {
    number(value.conservativeMaxCost);
    if (value.conservativeMaxCost < value.expectedCost) fail();
  }
  if (value.conservativeMaxTimeMs !== null) {
    number(value.conservativeMaxTimeMs);
    if (value.conservativeMaxTimeMs < value.expectedTimeMs) fail();
  }
}
const checkNames = ['eligible', 'authenticated', 'compatible', 'dataAllowed', 'resourceAvailable', 'quotaAvailable'] as const;

export function selectCandidate(policy: SelectionPolicy, candidates: readonly SelectionCandidate[], nowMs: number): SelectionDecision {
  record(policy, ['version', 'mode', 'qualityMinimum', 'costBasis', 'timeBasisMs', 'currency', 'costLimit', 'remainingTimeMs', 'maxEstimateAgeMs', 'allowedCandidateIds', 'pinnedCandidateId']);
  if (policy.version !== 'cue-selection-v1' || !['efficiency', 'performance', 'value', 'speed'].includes(policy.mode)) fail();
  number(nowMs); number(policy.qualityMinimum); if (policy.qualityMinimum > 1) fail();
  number(policy.costBasis, true); number(policy.timeBasisMs, true); number(policy.maxEstimateAgeMs);
  text(policy.currency);
  if (policy.costLimit !== null) number(policy.costLimit);
  if (policy.remainingTimeMs !== null) number(policy.remainingTimeMs);
  if (!Array.isArray(policy.allowedCandidateIds) || policy.allowedCandidateIds.length > 1000) fail();
  for (const id of policy.allowedCandidateIds) text(id);
  if (new Set(policy.allowedCandidateIds).size !== policy.allowedCandidateIds.length) fail();
  if (policy.pinnedCandidateId !== null) text(policy.pinnedCandidateId);
  if (!Array.isArray(candidates) || candidates.length > 1000) fail();
  const seen = new Set<string>();
  const assessments = candidates.map((candidate: SelectionCandidate) => {
    record(candidate, ['id', 'checks', 'estimate']); text(candidate.id);
    if (seen.has(candidate.id)) fail(); seen.add(candidate.id);
    record(candidate.checks, checkNames);
    for (const key of checkNames) if (typeof candidate.checks[key] !== 'boolean') fail();
    const exclusions: string[] = [];
    if (!policy.allowedCandidateIds.includes(candidate.id)) exclusions.push('not-allowed');
    for (const key of checkNames) if (!candidate.checks[key]) exclusions.push(key);
    const value = candidate.estimate;
    if (value === null) exclusions.push('unknown-estimate');
    else {
      estimate(value);
      if (value.observedAtMs > nowMs || nowMs - value.observedAtMs > policy.maxEstimateAgeMs) exclusions.push('stale-estimate');
      if (value.currency !== policy.currency) exclusions.push('currency-mismatch');
      if (value.quality < policy.qualityMinimum) exclusions.push('quality-floor');
      if (policy.costLimit !== null) {
        if (value.conservativeMaxCost === null) exclusions.push('unknown-cost-bound');
        else if (value.conservativeMaxCost > policy.costLimit) exclusions.push('cost-limit');
      }
      if (policy.remainingTimeMs !== null) {
        if (value.conservativeMaxTimeMs === null) exclusions.push('unknown-time-bound');
        else if (value.conservativeMaxTimeMs > policy.remainingTimeMs) exclusions.push('time-limit');
      }
    }
    let score: number | null = null;
    if (!exclusions.length && value !== null) {
      switch (policy.mode) {
        case 'efficiency': score = 0.5 * (value.expectedCost / policy.costBasis) + 0.5 * (value.expectedTimeMs / policy.timeBasisMs); break;
        case 'performance': score = 1 - value.quality; break;
        case 'value': score = value.expectedCost; break;
        case 'speed': score = value.expectedTimeMs; break;
      }
      if (!Number.isFinite(score)) { score = null; exclusions.push('score-overflow'); }
    }
    return Object.freeze({ id: candidate.id, score, exclusions: Object.freeze(exclusions) });
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const eligible = assessments.filter(item => item.score !== null);
  let chosen: CandidateAssessment | undefined;
  let reason: SelectionDecision['reason'];
  if (policy.pinnedCandidateId !== null) {
    chosen = eligible.find(item => item.id === policy.pinnedCandidateId);
    reason = chosen ? 'pinned' : 'pin-unavailable';
  } else {
    // Stable ID order is maintained for equal scores and independent of caller order.
    chosen = eligible.reduce<CandidateAssessment | undefined>((best, item) => !best || item.score! < best.score! ? item : best, undefined);
    reason = chosen ? 'ranked' : 'no-eligible-candidate';
  }
  return Object.freeze({ policyVersion: policy.version, mode: policy.mode, selectedId: chosen?.id ?? null, reason,
    assessments: Object.freeze(assessments), executionAdmissionRequired: true, budgetReservationRequired: true });
}

/** Historical output validation only; does not observe, select or grant admission. */
export function snapshotSelectionDecision(input: unknown): SelectionDecision {
  if (types.isProxy(input)) fail();
  record(input, ['policyVersion','mode','selectedId','reason','assessments','executionAdmissionRequired','budgetReservationRequired']);
  if (input.policyVersion !== 'cue-selection-v1' || !['efficiency','performance','value','speed'].includes(input.mode as string)
    || !['ranked','pinned','pin-unavailable','no-eligible-candidate'].includes(input.reason as string)
    || input.executionAdmissionRequired !== true || input.budgetReservationRequired !== true) fail();
  if (input.selectedId !== null) text(input.selectedId);
  const values = input.assessments;
  if (!Array.isArray(values) || types.isProxy(values) || values.length > 1000 || Reflect.ownKeys(values).length !== values.length + 1) fail();
  const allowed = [...checkNames, 'not-allowed','unknown-estimate','stale-estimate','currency-mismatch','quality-floor','unknown-cost-bound','cost-limit','unknown-time-bound','time-limit','score-overflow'];
  const assessments: CandidateAssessment[] = [];
  for (let i = 0; i < values.length; i++) {
    const d = Object.getOwnPropertyDescriptor(values, String(i)); if (!d || !('value' in d) || types.isProxy(d.value)) fail();
    const v = d.value; record(v, ['id','score','exclusions']); text(v.id);
    if (i && assessments[i - 1]!.id >= v.id) fail();
    if (v.score !== null && (typeof v.score !== 'number' || !Number.isFinite(v.score) || v.score < 0)) fail();
    const exclusions = v.exclusions;
    if (!Array.isArray(exclusions) || types.isProxy(exclusions) || exclusions.length > allowed.length || Reflect.ownKeys(exclusions).length !== exclusions.length + 1) fail();
    const reasons: string[] = [];
    for (let j = 0; j < exclusions.length; j++) { const e = Object.getOwnPropertyDescriptor(exclusions, String(j)); if (!e || !('value' in e) || typeof e.value !== 'string' || !allowed.includes(e.value) || reasons.includes(e.value)) fail(); reasons.push(e.value); }
    if ((v.score === null) !== (reasons.length > 0)) fail();
    assessments.push(Object.freeze({ id: v.id, score: v.score as number | null, exclusions: Object.freeze(reasons) }));
  }
  const eligible = assessments.filter(a => a.score !== null), chosen = eligible.find(a => a.id === input.selectedId);
  if (input.selectedId !== null && (!chosen || !['ranked','pinned'].includes(input.reason as string))) fail();
  if (input.selectedId === null && !['pin-unavailable','no-eligible-candidate'].includes(input.reason as string)) fail();
  if (input.reason === 'no-eligible-candidate' && eligible.length) fail();
  if (input.reason === 'ranked' && eligible.some(a => a.score! < chosen!.score! || (a.score === chosen!.score && a.id < chosen!.id))) fail();
  return Object.freeze({ policyVersion: input.policyVersion, mode: input.mode as SelectionPolicy['mode'], selectedId: input.selectedId as string | null,
    reason: input.reason as SelectionDecision['reason'], assessments: Object.freeze(assessments), executionAdmissionRequired: true, budgetReservationRequired: true });
}
