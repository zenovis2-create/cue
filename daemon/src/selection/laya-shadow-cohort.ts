import { types } from 'node:util';
import { snapshotLayaShadowInput, type LayaShadowInput, type LayaShadowPreparation, type LayaShadowComparison } from './laya-shadow.js';

export interface LayaShadowCohortInput {
  source: 'offline-fixture';
  cases: readonly {
    caseId: string;
    split: 'evaluation' | 'holdout';
    input: LayaShadowInput;
    response: unknown | null; // null is an explicit missing response, not an abstention by the model.
    labelCandidateId: string | null;
  }[];
}
export interface LayaShadowReader {
  prepare(input: LayaShadowInput): LayaShadowPreparation;
  compare(input: LayaShadowInput, response: unknown): LayaShadowComparison;
}
export interface LayaShadowCounts {
  total: number; ready: number; unavailable: number; missingResponse: number;
  invalidResponse: number; agree: number; disagree: number;
  labeled: number; unlabeled: number; baselineLabelMatch: number; shadowLabelMatch: number;
}
export type LayaShadowCohort = Readonly<{
  version: 'cue-laya-shadow-cohort-v1'; source: 'offline-fixture'; authority: 'none';
  promotionEligible: false; improvementProven: false; qualityClaim: 'withheld-fixture-only';
  splits: Readonly<Record<'evaluation' | 'holdout', Readonly<LayaShadowCounts>>>;
  cases: readonly Readonly<{
    caseId: string; split: 'evaluation' | 'holdout'; selectionDigest: string | null; requestDigest: string | null;
    status: 'unavailable' | 'missing-response' | 'invalid-response' | 'agree' | 'disagree';
    baselineId: string | null; proposedId: string | null;
    labelAvailable: boolean; baselineLabelMatch: boolean | null; shadowLabelMatch: boolean | null;
  }>[];
}>;

function fail(): never { throw new TypeError('laya_shadow_cohort_input'); }
function fields(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const d = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !d[k]?.enumerable || !Object.hasOwn(d[k], 'value'))) fail();
  return Object.fromEntries(keys.map(k => [k, d[k]!.value]));
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u.test(value)) fail();
  return value;
}
function empty(): LayaShadowCounts {
  return { total: 0, ready: 0, unavailable: 0, missingResponse: 0, invalidResponse: 0,
    agree: 0, disagree: 0, labeled: 0, unlabeled: 0, baselineLabelMatch: 0, shadowLabelMatch: 0 };
}

/** Transient fixture-only analysis. This reads historical choices through a workspace-bound
 * reader, never launches Laya, changes routing or asserts counterfactual execution quality. */
export function evaluateLayaShadowCohort(raw: LayaShadowCohortInput, reader: LayaShadowReader): LayaShadowCohort {
  const top = fields(raw, ['source', 'cases']);
  if (top.source !== 'offline-fixture' || !Array.isArray(top.cases) || types.isProxy(top.cases)
    || top.cases.length < 2 || top.cases.length > 128 || Reflect.ownKeys(top.cases).length !== top.cases.length + 1) fail();
  const counts = { evaluation: empty(), holdout: empty() };
  const seenCases = new Set<string>(), seenAttempts = new Set<string>();
  const rows: LayaShadowCohort['cases'][number][] = [];
  for (let i = 0; i < top.cases.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(top.cases, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail();
    const c = fields(descriptor.value, ['caseId', 'split', 'input', 'response', 'labelCandidateId']);
    const caseId = id(c.caseId), split = c.split;
    if (split !== 'evaluation' && split !== 'holdout') fail();
    if (seenCases.has(caseId)) fail(); seenCases.add(caseId);
    const shadow = snapshotLayaShadowInput(c.input);
    const attemptId = id(shadow.attemptId);
    if (seenAttempts.has(attemptId)) fail(); seenAttempts.add(attemptId);
    const label = c.labelCandidateId === null ? null : id(c.labelCandidateId);
    const group = counts[split];
    if (group.total >= 64) fail();
    // Missing/foreign attempts remain in the denominator, while corrupted historical
    // snapshots and malformed option sets fail closed rather than being silently skipped.
    let prepared: LayaShadowPreparation | null;
    try { prepared = reader.prepare(shadow); }
    catch (error) {
      if (error instanceof Error && ['laya_shadow_unavailable', 'attempt_selection_attempt-missing'].includes(error.message)) prepared = null;
      else throw error;
    }
    let status: LayaShadowCohort['cases'][number]['status'] = 'unavailable';
    let proposedId: string | null = null;
    if (prepared?.status === 'ready') {
      if (label !== null && !Object.hasOwn(prepared.request!.questions.candidate.criteria, label)) fail();
      if (c.response === null) status = 'missing-response';
      else {
        const compared = reader.compare(shadow, c.response);
        if (compared.selectionDigest !== prepared.selectionDigest || compared.requestDigest !== prepared.requestDigest
          || compared.baselineId !== prepared.baselineId) throw Error('laya_shadow_cohort_lineage_changed');
        status = compared.disposition === 'unavailable' ? 'unavailable' : compared.disposition;
        proposedId = compared.proposedId;
      }
    }
    group.total++;
    if (prepared?.status === 'ready') group.ready++;
    if (status === 'unavailable') group.unavailable++;
    else if (status === 'missing-response') group.missingResponse++;
    else if (status === 'invalid-response') group.invalidResponse++;
    else group[status]++;
    const labelAvailable = prepared?.status === 'ready' && label !== null;
    if (labelAvailable) group.labeled++; else group.unlabeled++;
    const baselineMatch = labelAvailable ? prepared!.baselineId === label : null;
    const shadowMatch = labelAvailable && proposedId !== null ? proposedId === label : null;
    if (baselineMatch) group.baselineLabelMatch++;
    if (shadowMatch) group.shadowLabelMatch++;
    rows.push(Object.freeze({ caseId, split, selectionDigest: prepared?.selectionDigest ?? null,
      requestDigest: prepared?.requestDigest ?? null, status, baselineId: prepared?.baselineId ?? null,
      proposedId, labelAvailable, baselineLabelMatch: baselineMatch, shadowLabelMatch: shadowMatch }));
  }
  if (!counts.evaluation.total || !counts.holdout.total) fail();
  return Object.freeze({ version: 'cue-laya-shadow-cohort-v1', source: 'offline-fixture', authority: 'none',
    promotionEligible: false, improvementProven: false, qualityClaim: 'withheld-fixture-only',
    splits: Object.freeze({ evaluation: Object.freeze(counts.evaluation), holdout: Object.freeze(counts.holdout) }),
    cases: Object.freeze(rows) });
}
