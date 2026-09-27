import { describe, it, expect } from 'vitest';
import { selectCandidate, type SelectionPolicy, type SelectionCandidate } from '../src/selection/policy.js';
const policy: SelectionPolicy = { version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0.8, costBasis: 10, timeBasisMs: 100,
  currency: 'fixture', costLimit: 100, remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['balanced', 'quality', 'cheap', 'fast'], pinnedCandidateId: null };
function candidate(id: string, quality: number, cost: number, time: number): SelectionCandidate {
  return { id, checks: { eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true },
    estimate: { scope: 'verified-completion-total', quality, expectedCost: cost, conservativeMaxCost: cost + 1, expectedTimeMs: time, conservativeMaxTimeMs: time + 1, currency: 'fixture', source: 'offline-fixture', observedAtMs: 1000 } };
}
const candidates = [candidate('balanced', .9, 3, 30), candidate('quality', .99, 9, 90), candidate('cheap', .85, 1, 100), candidate('fast', .85, 10, 10)];
describe('S2 deterministic selection foundation', () => {
  it('four modes use different objectives with the same quality floor', () => {
    for (const [mode, id] of Object.entries({ efficiency: 'balanced', performance: 'quality', value: 'cheap', speed: 'fast' })) {
      expect(selectCandidate({ ...policy, mode: mode as SelectionPolicy['mode'] }, candidates, 1000).selectedId).toBe(id);
    }
  });
  it('fixed normalization survives candidate-set changes', () => {
    const first = selectCandidate(policy, candidates, 1000);
    const later = selectCandidate({ ...policy, allowedCandidateIds: [...policy.allowedCandidateIds, 'slow'] }, [...candidates, candidate('slow', .9, 99, 99999)], 1000);
    expect(later.selectedId).toBe(first.selectedId);
    expect(later.assessments.filter(a => a.id !== 'slow')).toEqual(first.assessments);
  });
  it('quality floor is mandatory in every mode', () => {
    const poor = candidate('cheap', .79, 0, 0);
    for (const mode of ['efficiency', 'performance', 'value', 'speed'] as const) {
      const result = selectCandidate({ ...policy, mode }, [poor], 1000);
      expect(result.selectedId).toBeNull(); expect(result.assessments[0].exclusions).toContain('quality-floor');
    }
  });
  it('unknown, stale, future and currency-mismatched estimates fail closed', () => {
    for (const edit of [null, { ...candidates[0].estimate!, observedAtMs: 1 }, { ...candidates[0].estimate!, observedAtMs: 1001 }, { ...candidates[0].estimate!, currency: 'other' }]) {
      expect(selectCandidate(policy, [{ ...candidates[0], estimate: edit }], 1000).selectedId).toBeNull();
    }
    const unknownBound = { ...candidates[0], estimate: { ...candidates[0].estimate!, conservativeMaxCost: null } };
    expect(selectCandidate(policy, [unknownBound], 1000).assessments[0].exclusions).toContain('unknown-cost-bound');
    expect(selectCandidate({ ...policy, costLimit: null }, [unknownBound], 1000).selectedId).toBe('balanced');
  });
  it('total retry/verifier/handoff cost can reverse a cheap first-call choice', () => {
    // Cheap first call is 1, but host total estimate is 12 after expected retries.
    const retried = candidate('cheap', .9, 12, 90);
    expect(selectCandidate({ ...policy, mode: 'value' }, [retried, candidates[0]], 1000).selectedId).toBe('balanced');
  });
  it('authorized remaining time is a hard filter even for performance or pins', () => {
    for (const mode of ['efficiency', 'performance', 'value', 'speed'] as const) {
      expect(selectCandidate({ ...policy, mode, remainingTimeMs: 30 }, [candidates[0]], 1000).assessments[0].exclusions).toContain('time-limit');
      const unknownTime = { ...candidates[0], estimate: { ...candidates[0].estimate!, conservativeMaxTimeMs: null } };
      expect(selectCandidate({ ...policy, mode, remainingTimeMs: 100 }, [unknownTime], 1000).assessments[0].exclusions).toContain('unknown-time-bound');
    }
    expect(selectCandidate({ ...policy, remainingTimeMs: 30, pinnedCandidateId: 'balanced' }, candidates, 1000)).toMatchObject({ selectedId: null, reason: 'pin-unavailable' });
    expect(selectCandidate({ ...policy, remainingTimeMs: 31 }, [candidates[0]], 1000).selectedId).toBe('balanced');
  });
  it('eligibility, auth, compatibility, data, quota and local resources filter before scoring', () => {
    for (const key of Object.keys(candidates[0].checks) as (keyof SelectionCandidate['checks'])[]) {
      const denied = { ...candidates[0], checks: { ...candidates[0].checks, [key]: false } };
      const result = selectCandidate(policy, [denied], 1000);
      expect(result.selectedId).toBeNull(); expect(result.assessments[0]).toMatchObject({ score: null, exclusions: [key] });
    }
    expect(selectCandidate({ ...policy, allowedCandidateIds: [] }, candidates, 1000).selectedId).toBeNull();
    expect(selectCandidate({ ...policy, costLimit: 1 }, candidates, 1000).selectedId).toBeNull();
  });
  it('manual pin never silently falls back; stable IDs break equal-score ties', () => {
    expect(selectCandidate({ ...policy, pinnedCandidateId: 'missing' }, candidates, 1000)).toMatchObject({ selectedId: null, reason: 'pin-unavailable' });
    expect(selectCandidate({ ...policy, pinnedCandidateId: 'quality' }, candidates, 1000)).toMatchObject({ selectedId: 'quality', reason: 'pinned' });
    const ties = [candidate('quality', .9, 2, 2), candidate('cheap', .9, 2, 2)];
    expect(selectCandidate(policy, ties, 1000)).toEqual(selectCandidate(policy, [...ties].reverse(), 1000));
    expect(selectCandidate(policy, ties, 1000).selectedId).toBe('cheap');
  });
  it('rejects malformed versions, numeric fields, duplicate IDs and untrusted extra fields', () => {
    for (const value of [NaN, Infinity, -1]) {
      expect(() => selectCandidate({ ...policy, qualityMinimum: value }, candidates, 1000)).toThrow();
      expect(() => selectCandidate(policy, [{ ...candidates[0], estimate: { ...candidates[0].estimate!, expectedCost: value } }], 1000)).toThrow();
    }
    expect(() => selectCandidate({ ...policy, costBasis: 0 }, candidates, 1000)).toThrow();
    expect(() => selectCandidate({ ...policy, version: 'other' } as unknown as SelectionPolicy, candidates, 1000)).toThrow();
    expect(() => selectCandidate(policy, [candidates[0], candidates[0]], 1000)).toThrow();
    expect(() => selectCandidate({ ...policy, permissions: 'all' } as SelectionPolicy, candidates, 1000)).toThrow();
  });
  it('immutable decision does not mutate host inputs or imply admission/reservation', () => {
    const before = structuredClone(candidates);
    const decision = selectCandidate(policy, candidates, 1000);
    expect(candidates).toEqual(before);
    expect(Object.isFrozen(decision) && Object.isFrozen(decision.assessments) && decision.assessments.every(a => Object.isFrozen(a) && Object.isFrozen(a.exclusions))).toBe(true);
    expect(decision).toMatchObject({ executionAdmissionRequired: true, budgetReservationRequired: true });
  });
});
