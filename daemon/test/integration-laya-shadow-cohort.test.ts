import { describe, expect, it } from 'vitest';
import { evaluateLayaShadowCohort } from '../src/selection/laya-shadow-cohort.js';
import type { LayaShadowPreparation, LayaShadowComparison } from '../src/selection/laya-shadow.js';

const input = (attemptId: string) => ({ attemptId, taskSummary: 'non-sensitive fixture', options: [
  { id: 'a', description: 'A' }, { id: 'b', description: 'B' },
] });
const row = (caseId: string, split: 'evaluation' | 'holdout', response: unknown | null, labelCandidateId: string | null) =>
  ({ caseId, split, input: input(caseId), response, labelCandidateId });
const reader = {
  prepare(value: ReturnType<typeof input>): LayaShadowPreparation {
    if (value.attemptId === 'missing') throw Error('laya_shadow_unavailable');
    return { version: 'cue-laya-shadow-v1', authority: 'none', promotionEligible: false, attemptId: value.attemptId,
      selectionDigest: value.attemptId, baselineId: 'a', status: 'ready', reason: 'ready', requestDigest: 'request',
      request: { state: { task: value.taskSummary, mode: 'efficiency' }, questions: { candidate: {
        type: 'choice', instructions: 'fixture', criteria: { a: 'A', b: 'B' },
      } } } };
  },
  compare(value: ReturnType<typeof input>, response: unknown): LayaShadowComparison {
    const proposedId = response === 'invalid' ? null : response as string;
    return { version: 'cue-laya-shadow-comparison-v1', authority: 'none', promotionEligible: false,
      attemptId: value.attemptId, selectionDigest: value.attemptId, requestDigest: 'request',
      baselineId: 'a', proposedId, disposition: proposedId === null ? 'invalid-response' : proposedId === 'a' ? 'agree' : 'disagree',
      evidence: 'unverified-response' };
  },
};

describe('offline Laya shadow cohort accounting', () => {
  it('keeps both splits and all missing, invalid and unavailable slots in the denominator', () => {
    const result = evaluateLayaShadowCohort({ source: 'offline-fixture', cases: [
      row('agree', 'evaluation', 'a', 'a'), row('disagree', 'evaluation', 'b', 'b'),
      row('invalid', 'evaluation', 'invalid', 'a'), row('no-response', 'evaluation', null, 'b'),
      row('missing', 'holdout', null, null), row('holdout-ready', 'holdout', 'b', null),
    ] }, reader);
    expect(result.splits.evaluation).toEqual({ total: 4, ready: 4, unavailable: 0, missingResponse: 1,
      invalidResponse: 1, agree: 1, disagree: 1, labeled: 4, unlabeled: 0, baselineLabelMatch: 2, shadowLabelMatch: 2 });
    expect(result.splits.holdout).toEqual({ total: 2, ready: 1, unavailable: 1, missingResponse: 0,
      invalidResponse: 0, agree: 0, disagree: 1, labeled: 0, unlabeled: 2, baselineLabelMatch: 0, shadowLabelMatch: 0 });
    expect(result.cases.map(c => c.status)).toEqual(['agree', 'disagree', 'invalid-response', 'missing-response', 'unavailable', 'disagree']);
    expect(result).toMatchObject({ source: 'offline-fixture', promotionEligible: false, improvementProven: false,
      qualityClaim: 'withheld-fixture-only' });
    expect(JSON.stringify(result)).not.toContain('non-sensitive fixture');
    expect(Object.isFrozen(result.splits.evaluation)).toBe(true);
  });
  it('rejects duplicate membership, non-eligible labels and malicious shapes rather than shrinking the cohort', () => {
    const good = row('one', 'evaluation', 'a', 'a'), holdout = row('two', 'holdout', null, null);
    expect(() => evaluateLayaShadowCohort({ source: 'offline-fixture', cases: [good, good] }, reader)).toThrow('laya_shadow_cohort_input');
    expect(() => evaluateLayaShadowCohort({ source: 'offline-fixture', cases: [good, { ...holdout, input: input('one') }] }, reader)).toThrow('laya_shadow_cohort_input');
    expect(() => evaluateLayaShadowCohort({ source: 'offline-fixture', cases: [good, { ...holdout, labelCandidateId: 'c' }] }, reader)).toThrow('laya_shadow_cohort_input');
    expect(() => evaluateLayaShadowCohort({ source: 'offline-fixture', cases: [good,
      { ...holdout, input: { ...input('missing'), options: [{ id: 'a', description: 'A' }, { id: 'a', description: 'duplicate' }] } }] }, reader)).toThrow('laya_shadow_input');
    expect(() => evaluateLayaShadowCohort({ source: 'offline-fixture', cases: [good, { ...holdout, split: 'evaluation' }] } as any, reader)).toThrow('laya_shadow_cohort_input');
    let accessed = false;
    expect(() => evaluateLayaShadowCohort({ source: 'offline-fixture', cases: [good, { ...holdout, get response() { accessed = true; return null; } }] }, reader)).toThrow('laya_shadow_cohort_input');
    expect(accessed).toBe(false);
  });
  it('fails closed if history changes between preparation and comparison', () => {
    const drifting = { ...reader, compare(value: ReturnType<typeof input>, response: unknown) {
      return { ...reader.compare(value, response), selectionDigest: 'different' };
    } };
    expect(() => evaluateLayaShadowCohort({ source: 'offline-fixture', cases: [
      row('one', 'evaluation', 'a', null), row('two', 'holdout', null, null),
    ] }, drifting)).toThrow('laya_shadow_cohort_lineage_changed');
  });
});
