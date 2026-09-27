import { test, expect } from 'vitest';
import { freezeEvaluationDataset, createEvaluationStudy } from '../src/evaluation/comparison.js';
import type { ComparisonConstraints, EvaluationTrial } from '../src/evaluation/comparison.js';
const manifest = () => ({ id: 'suite', revision: 'v1', cases: ['eval1', 'eval2', 'hold1', 'hold2'].map((id, n) => ({ id, kind: 'code', inputDigest: String(n + 1).padStart(64, '0'), split: n < 2 ? 'evaluation' : 'holdout' })) });
const constraints = (mode: ComparisonConstraints['mode'] = 'value'): ComparisonConstraints => ({ mode,
  baselinePolicyDigest: 'a'.repeat(64), candidatePolicyDigest: 'b'.repeat(64), nowMs: 200, maxPriceAgeMs: 1000,
  minPairsPerSplit: 2, qualityFloor: 0.8, minSuccessRate: 1, maxUnknownRate: 0, costLimitUnits: mode === 'performance' ? 100 : null,
  costBasisUnits: 10, timeBasisMs: 100, minImprovement: 0.001 });
function trial(caseId: string, arm: EvaluationTrial['arm'], change: Partial<EvaluationTrial> = {}): EvaluationTrial {
  return { id: `${caseId}-${arm}`, caseId, arm, policyDigest: (arm === 'manual-baseline' ? 'a' : 'b').repeat(64), policyRevision: 'v1',
    toolId: 'tool', toolRevision: 'v1', modelId: 'model', modelRevision: 'v1', source: 'fixture', environmentDigest: 'd'.repeat(64), accountLimitsDigest: 'e'.repeat(64),
    observedAtMs: 100, priceObservedAtMs: 50, priceSourceDigest: 'c'.repeat(64), outcome: 'success', quality: 0.8, elapsedMs: arm === 'manual-baseline' ? 100 : 50,
    costs: { currency: 'TEST', unit: 'micro', baseUnits: arm === 'manual-baseline' ? 10 : 6, retryUnits: 0, handoffUnits: 0, verificationUnits: 0 }, ...change };
}
function fixture(mode: ComparisonConstraints['mode'] = 'value', mutate: (value: EvaluationTrial) => EvaluationTrial = value => value) {
  const dataset = freezeEvaluationDataset(manifest()); const study = createEvaluationStudy(dataset);
  for (const item of dataset.cases) for (const arm of ['manual-baseline', mode] as const) study.record(mutate(trial(item.id, arm)));
  return { dataset, study, compare: () => study.compare(constraints(mode)) };
}
test('dataset hashing is canonical, frozen and exact input holdout overlap is rejected', () => {
  const source = manifest(); const first = freezeEvaluationDataset(source);
  expect(freezeEvaluationDataset({ ...source, cases: [...source.cases].reverse() }).digest).toBe(first.digest);
  source.cases[0].id = 'mutated'; expect(first.cases.some(c => c.id === 'mutated')).toBe(false);
  expect(Object.isFrozen(first.cases[0])).toBe(true);
  const duplicated = manifest(); duplicated.cases[2].inputDigest = duplicated.cases[0].inputDigest;
  expect(() => freezeEvaluationDataset(duplicated)).toThrow('dataset_overlap');
  const ids = manifest(); ids.cases[2].id = ids.cases[0].id;
  expect(() => freezeEvaluationDataset(ids)).toThrow('dataset_overlap');
  expect(() => createEvaluationStudy({ ...first })).toThrow('unfrozen_dataset');
});
test('trial costs include retry/handoff/verification and replay never drops failed observations', () => {
  const study = createEvaluationStudy(freezeEvaluationDataset(manifest()));
  const input = trial('eval1', 'value', { outcome: 'fail', quality: null, costs: { currency: 'TEST', unit: 'micro', baseUnits: 1, retryUnits: 2, handoffUnits: 3, verificationUnits: 4 } });
  const saved = study.record(input); expect(saved.totalCostUnits).toBe(10);
  expect(study.record(input)).toBe(saved);
  expect(() => study.record({ ...input, quality: 0.5 })).toThrow('trial_replay_conflict');
  expect(() => study.record({ ...input, id: 'replacement' })).toThrow('duplicate_case_arm');
  expect(study.snapshot().trials[0].outcome).toBe('fail'); expect(Object.isFrozen(saved.costs)).toBe(true);
});
test('descriptive paired variance is reported with both splits and promotion always false', () => {
  const f = fixture('value', t => t.arm === 'value' && t.caseId.endsWith('1') ? { ...t, costs: { ...t.costs, baseUnits: 8 } } : t);
  const report = f.compare();
  expect(report).toMatchObject({ status: 'observed-improvement', promotionEligible: false, statisticalQualification: 'not-performed', measurementSource: 'fixture', qualityMetric: 'non-success-scored-zero' });
  for (const split of report.splits) expect(split.pairedImprovement).toEqual({ n: 2, mean: 3, sampleVariance: 2 });
  expect(report.splits[0].baseline.totalCostUnits).toBe('20');
  expect(report.splits[0].baseline).toMatchObject({ currency: 'TEST', unit: 'micro' });
  expect(JSON.parse(JSON.stringify(report)).promotionEligible).toBe(false);
});
test('failure, cancellation and unknown all remain in success denominators and quality floor', () => {
  for (const outcome of ['fail', 'cancelled', 'unknown'] as const) {
    const f = fixture('value', t => t.arm === 'value' && t.caseId.endsWith('1') ? { ...t, outcome, quality: null } : t);
    const report = f.compare();
    expect(report.status).toBe('insufficient');
    expect(report.splits[0].candidate.n).toBe(2);
    expect(report.splits[0].candidate.successRate).toBe(0.5);
    expect(report.splits[0].candidate.outcomes[outcome]).toBe(1);
    expect(report.splits[0].candidate.quality!.mean).toBe(0.4);
  }
});
test('missing holdout pairs and insufficient sample cannot be hidden by evaluation improvement', () => {
  const dataset = freezeEvaluationDataset(manifest()), study = createEvaluationStudy(dataset);
  for (const item of dataset.cases) { study.record(trial(item.id, 'manual-baseline')); if (item.split === 'evaluation') study.record(trial(item.id, 'value')); }
  expect(study.compare(constraints()).splits[1].reasons).toContain('incomplete-paired-coverage');
  expect(fixture().study.compare({ ...constraints(), minPairsPerSplit: 3 }).status).toBe('insufficient');
});
test('cheap first call with expensive retries/handoffs does not look like cheaper completion', () => {
  const f = fixture('value', t => t.arm === 'value' ? { ...t, costs: { ...t.costs, baseUnits: 1, retryUnits: 9, handoffUnits: 5 } } : t);
  expect(f.compare().status).toBe('no-observed-improvement');
  expect(f.compare().splits[0].candidate.totalCostUnits).toBe('30');
});
test('unknown total costs block cost comparison; speed-only comparison still records uncertainty', () => {
  const change = (t: EvaluationTrial): EvaluationTrial => t.arm !== 'manual-baseline' ? { ...t, costs: { ...t.costs, retryUnits: null } } : t;
  expect(fixture('value', change).compare().splits[0].reasons).toContain('unknown-cost');
  const speed = fixture('speed', change).compare();
  expect(speed.status).toBe('observed-improvement'); expect(speed.splits[0].candidate.totalCostUnits).toBeNull();
  expect(speed.promotionEligible).toBe(false);
});
test.each(['currency', 'unit'] as const)('mixed %s within an arm hides monetary aggregates without suppressing speed measurements', field => {
  const mutate = (t: EvaluationTrial): EvaluationTrial => t.arm !== 'manual-baseline' && t.caseId.endsWith('1')
    ? { ...t, costs: { ...t.costs, ...(field === 'currency' ? { currency: 'OTHER' } : { unit: 'minor' as const }) } } : t;
  const speed = fixture('speed', mutate).compare();
  expect(speed.status).toBe('observed-improvement');
  for (const split of speed.splits) {
    expect(split.candidate[field]).toBeNull();
    expect(split.candidate.totalCostUnits).toBeNull();
    expect(split.candidate.cost).toBeNull();
    expect(split.baseline.totalCostUnits).toBe('20');
    expect(split.pairedImprovement).toEqual({ n: 2, mean: 50, sampleVariance: 0 });
  }
  for (const mode of ['value', 'efficiency', 'performance', 'speed'] as const) {
    const study = fixture(mode, mutate).study;
    const result = study.compare({ ...constraints(mode), costLimitUnits: 100 });
    expect(result.status).toBe('insufficient');
    for (const split of result.splits) {
      expect(split.reasons).toContain('incompatible-cost-units');
      expect(split.pairedImprovement).toBeNull();
    }
  }
});

test('all four objectives preserve quality constraints and performance requires explicit budget cap', () => {
  for (const mode of ['efficiency', 'performance', 'value', 'speed'] as const) {
    const f = fixture(mode, t => mode === 'performance' && t.arm === mode ? { ...t, quality: 0.9 } : t);
    expect(f.compare().status).toBe('observed-improvement');
  }
  const performance = fixture('performance');
  expect(() => performance.study.compare({ ...constraints('performance'), costLimitUnits: null })).toThrow('constraints');
  expect(performance.study.compare({ ...constraints('performance'), costLimitUnits: 5 }).splits[0].reasons).toContain('per-trial-budget-limit');
  expect(fixture('speed', t => t.arm === 'speed' ? { ...t, quality: 0.5 } : t).compare().status).toBe('insufficient');
});
test('stale prices, mixed sources, incompatible units and environmental changes deny comparable conclusions', () => {
  for (const [mutate, reason] of [
    [(t: EvaluationTrial) => ({ ...t, priceObservedAtMs: null }), 'unverified-or-stale-price'],
    [(t: EvaluationTrial) => ({ ...t, environmentDigest: 'f'.repeat(64) }), 'unmatched-environment'],
    [(t: EvaluationTrial) => ({ ...t, source: 'observed' as const }), 'mixed-measurement-provenance'],
    [(t: EvaluationTrial) => ({ ...t, costs: { ...t.costs, currency: 'OTHER' } }), 'incompatible-cost-units'],
  ] as const) {
    const result = fixture('value', t => t.arm === 'value' ? mutate(t) : t).compare();
    expect(result.splits[0].reasons).toContain(reason);
  }
  expect(fixture().study.compare({ ...constraints(), maxPriceAgeMs: 1 }).status).toBe('insufficient');
});
test('manifest-like authority injection, getters and fractional/overflow costs are rejected', () => {
  const study = createEvaluationStudy(freezeEvaluationDataset(manifest()));
  let reads = 0;
  const input = Object.defineProperty({ ...trial('eval1', 'value') }, 'quality', { enumerable: true, get() { reads++; return 1; } });
  expect(() => study.record(input)).toThrow('fields'); expect(reads).toBe(0);
  expect(() => study.record({ ...trial('eval1', 'value'), promotionEligible: true })).toThrow('fields');
  expect(() => study.record(trial('eval1', 'value', { costs: { currency: 'TEST', unit: 'micro', baseUnits: 0.5, retryUnits: 0, handoffUnits: 0, verificationUnits: 0 } }))).toThrow('cost_units');
  expect(() => study.record(trial('eval1', 'value', { costs: { currency: 'TEST', unit: 'micro', baseUnits: Number.MAX_SAFE_INTEGER, retryUnits: 1, handoffUnits: 0, verificationUnits: 0 } }))).toThrow('cost_overflow');
});
