import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { SelectionMode } from '../selection/preferences.js';

export type EvaluationSplit = 'evaluation' | 'holdout';
export interface EvaluationCase { readonly id: string; readonly kind: 'code' | 'research' | 'document' | 'external'; readonly inputDigest: string; readonly split: EvaluationSplit }
export interface EvaluationDataset { readonly id: string; readonly revision: string; readonly cases: readonly EvaluationCase[]; readonly digest: string }
export interface TrialCosts {
  readonly currency: string; readonly unit: 'minor' | 'micro';
  readonly baseUnits: number | null; readonly retryUnits: number | null;
  readonly handoffUnits: number | null; readonly verificationUnits: number | null;
}
export interface EvaluationTrial {
  readonly id: string; readonly caseId: string; readonly arm: SelectionMode | 'manual-baseline'; readonly policyDigest: string; readonly policyRevision: string;
  readonly toolId: string; readonly toolRevision: string; readonly modelId: string; readonly modelRevision: string;
  readonly source: 'fixture' | 'observed'; readonly environmentDigest: string; readonly accountLimitsDigest: string;
  readonly observedAtMs: number; readonly priceObservedAtMs: number | null; readonly priceSourceDigest: string | null;
  readonly outcome: 'success' | 'fail' | 'cancelled' | 'unknown'; readonly quality: number | null;
  readonly elapsedMs: number | null; readonly costs: TrialCosts;
}
export interface ComparisonConstraints {
  readonly mode: SelectionMode; readonly baselinePolicyDigest: string; readonly candidatePolicyDigest: string;
  readonly nowMs: number; readonly maxPriceAgeMs: number; readonly minPairsPerSplit: number;
  readonly qualityFloor: number; readonly minSuccessRate: number; readonly maxUnknownRate: number;
  readonly costLimitUnits: number | null; readonly costBasisUnits: number; readonly timeBasisMs: number;
  readonly minImprovement: number;
}
type RecordedTrial = Readonly<EvaluationTrial & { readonly datasetDigest: string; readonly split: EvaluationSplit; readonly totalCostUnits: number | null }>;
const SHA = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const MODES = ['efficiency', 'performance', 'value', 'speed'];
const datasets = new WeakSet<object>();
const costKeys = ['currency', 'unit', 'baseUnits', 'retryUnits', 'handoffUnits', 'verificationUnits'];
const trialKeys = ['id', 'caseId', 'arm', 'policyDigest', 'policyRevision', 'toolId', 'toolRevision', 'modelId', 'modelRevision', 'source', 'environmentDigest', 'accountLimitsDigest', 'observedAtMs', 'priceObservedAtMs', 'priceSourceDigest', 'outcome', 'quality', 'elapsedMs', 'costs'];
const constraintKeys = ['mode', 'baselinePolicyDigest', 'candidatePolicyDigest', 'nowMs', 'maxPriceAgeMs', 'minPairsPerSplit', 'qualityFloor', 'minSuccessRate', 'maxUnknownRate', 'costLimitUnits', 'costBasisUnits', 'timeBasisMs', 'minImprovement'];
const validId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
const validHash = (v: unknown): v is string => typeof v === 'string' && SHA.test(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const fraction = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
function fail(reason: string): never { throw Error(`evaluation_${reason}`); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('plain_record_required');
  const ds = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(ds).length !== keys.length) fail('fields');
  const copy: Record<string, unknown> = {};
  for (const key of keys) {
    if (!ds[key]?.enumerable || !Object.hasOwn(ds[key], 'value')) fail('fields');
    copy[key] = ds[key].value;
  }
  return copy;
}
function array(value: unknown): unknown[] {
  if (!value || typeof value !== 'object' || types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 2048) fail('array');
  if (Reflect.ownKeys(value).length !== value.length + 1) fail('array');
  const result: unknown[] = [];
  for (let i = 0; i < value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d?.enumerable || !Object.hasOwn(d, 'value')) fail('array');
    result.push(d.value);
  }
  return result;
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Content-only manifest. Holdout IDs and exact input digests cannot overlap.
 * No task execution, model calls, prices or statistical authority are inferred.
 */
export function freezeEvaluationDataset(input: unknown): EvaluationDataset {
  const data = record(input, ['id', 'revision', 'cases']);
  if (!validId(data.id) || !validId(data.revision)) fail('dataset_identity');
  const ids = new Set<string>(), contents = new Set<string>();
  const cases = array(data.cases).map(value => {
    const c = record(value, ['id', 'kind', 'inputDigest', 'split']);
    if (!validId(c.id) || !validHash(c.inputDigest) || !['code', 'research', 'document', 'external'].includes(c.kind as string) || !['evaluation', 'holdout'].includes(c.split as string)) fail('case');
    if (ids.has(c.id) || contents.has(c.inputDigest)) fail('dataset_overlap');
    ids.add(c.id); contents.add(c.inputDigest);
    return Object.freeze(c) as unknown as EvaluationCase;
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (!cases.some(c => c.split === 'evaluation') || !cases.some(c => c.split === 'holdout')) fail('independent_holdout_required');
  const value = { id: data.id, revision: data.revision, cases: Object.freeze(cases) };
  const frozen = Object.freeze({ ...value, digest: digest(value) }); datasets.add(frozen); return frozen;
}

function statistics(values: readonly number[]) {
  let mean = 0, m2 = 0, n = 0;
  for (const value of values) { n++; const delta = value - mean; mean += delta / n; m2 += delta * (value - mean); }
  return Object.freeze({ n, mean: n ? mean : null, sampleVariance: n > 1 ? Math.max(0, m2 / (n - 1)) : null });
}
const quality = (trial: RecordedTrial): number | null => trial.outcome === 'success' ? trial.quality : 0;
function summary(trials: readonly RecordedTrial[]) {
  const counts = { success: 0, fail: 0, cancelled: 0, unknown: 0 };
  for (const trial of trials) counts[trial.outcome]++;
  const knownCosts = trials.filter(t => t.totalCostUnits !== null);
  const comparableCosts = new Set(trials.map(t => JSON.stringify([t.costs.currency, t.costs.unit]))).size === 1 && knownCosts.length === trials.length;
  const qualities = trials.map(quality);
  return Object.freeze({ n: trials.length, outcomes: Object.freeze(counts),
    currency: new Set(trials.map(t => t.costs.currency)).size === 1 ? trials[0].costs.currency : null,
    unit: new Set(trials.map(t => t.costs.unit)).size === 1 ? trials[0].costs.unit : null,
    successRate: trials.length ? counts.success / trials.length : null,
    unknownRate: trials.length ? counts.unknown / trials.length : null,
    quality: qualities.every(q => q !== null) ? statistics(qualities as number[]) : null,
    elapsed: trials.every(t => t.elapsedMs !== null) ? statistics(trials.map(t => t.elapsedMs!)) : null,
    totalCostUnits: comparableCosts ? knownCosts.reduce((sum, t) => sum + BigInt(t.totalCostUnits!), 0n).toString() : null,
    cost: comparableCosts ? statistics(knownCosts.map(t => t.totalCostUnits!)) : null });
}

/** Append-only in-memory evaluation foundation. Callers are trusted measurement
 * producers; digests prove identity/integrity, not real-world measurement truth.
 * Every comparison is descriptive and promotionEligible is ALWAYS false.
 */
export function createEvaluationStudy(dataset: EvaluationDataset) {
  if (!datasets.has(dataset)) fail('unfrozen_dataset');
  const trials = new Map<string, RecordedTrial>();
  const slots = new Set<string>();
  return Object.freeze({
    record(input: unknown): RecordedTrial {
      const t = record(input, trialKeys);
      const c = record(t.costs, costKeys);
      if (!['id', 'caseId', 'policyRevision', 'toolId', 'toolRevision', 'modelId', 'modelRevision'].every(k => validId(t[k])) ||
          !['policyDigest', 'environmentDigest', 'accountLimitsDigest'].every(k => validHash(t[k])) ||
          ![...MODES, 'manual-baseline'].includes(t.arm as string) || !['fixture', 'observed'].includes(t.source as string) ||
          !integer(t.observedAtMs) || !(t.priceObservedAtMs === null || integer(t.priceObservedAtMs)) ||
          !(t.priceSourceDigest === null || validHash(t.priceSourceDigest)) ||
          !['success', 'fail', 'cancelled', 'unknown'].includes(t.outcome as string) ||
          !(t.quality === null || fraction(t.quality)) || !(t.elapsedMs === null || integer(t.elapsedMs)) ||
          !validId(c.currency) || !['minor', 'micro'].includes(c.unit as string)) fail('trial');
      const item = dataset.cases.find(item => item.id === t.caseId); if (!item) fail('unknown_case');
      const components = ['baseUnits', 'retryUnits', 'handoffUnits', 'verificationUnits'].map(key => c[key]);
      if (!components.every(value => value === null || integer(value))) fail('cost_units');
      const total = components.includes(null) ? null : (components as number[]).reduce((a, b) => a + b, 0);
      if (total !== null && !integer(total)) fail('cost_overflow');
      const value = Object.freeze({ ...t, costs: Object.freeze(c), datasetDigest: dataset.digest, split: item.split, totalCostUnits: total }) as unknown as RecordedTrial;
      const previous = trials.get(value.id);
      if (previous) { if (JSON.stringify(previous) !== JSON.stringify(value)) fail('trial_replay_conflict'); return previous; }
      const slot = JSON.stringify([value.caseId, value.arm, value.policyDigest]);
      if (slots.has(slot)) fail('duplicate_case_arm');
      if (trials.size >= 16384) fail('trial_limit');
      slots.add(slot); trials.set(value.id, value); return value;
    },
    snapshot() { return Object.freeze({ dataset, trials: Object.freeze([...trials.values()]) }); },
    compare(input: ComparisonConstraints) {
      const c = record(input, constraintKeys) as unknown as ComparisonConstraints;
      if (!MODES.includes(c.mode) || !validHash(c.baselinePolicyDigest) || !validHash(c.candidatePolicyDigest) ||
          ![c.nowMs, c.maxPriceAgeMs, c.minPairsPerSplit, c.costBasisUnits, c.timeBasisMs].every(integer) ||
          c.minPairsPerSplit < 2 || c.costBasisUnits < 1 || c.timeBasisMs < 1 ||
          ![c.qualityFloor, c.minSuccessRate, c.maxUnknownRate].every(fraction) ||
          !(c.costLimitUnits === null || integer(c.costLimitUnits)) || (c.mode === 'performance' && c.costLimitUnits === null) ||
          !Number.isFinite(c.minImprovement) || c.minImprovement < 0) fail('constraints');
      const needsCost = c.mode !== 'speed' || c.costLimitUnits !== null;
      const needsTime = c.mode === 'speed' || c.mode === 'efficiency';
      const selected = [...trials.values()].filter(t => (t.arm === 'manual-baseline' && t.policyDigest === c.baselinePolicyDigest) || (t.arm === c.mode && t.policyDigest === c.candidatePolicyDigest));
      const splits = (['evaluation', 'holdout'] as const).map(split => {
        const items = dataset.cases.filter(item => item.split === split);
        const baseline = [...trials.values()].filter(t => t.split === split && t.arm === 'manual-baseline' && t.policyDigest === c.baselinePolicyDigest);
        const candidate = [...trials.values()].filter(t => t.split === split && t.arm === c.mode && t.policyDigest === c.candidatePolicyDigest);
        const reasons = new Set<string>();
        if (baseline.length !== items.length || candidate.length !== items.length) reasons.add('incomplete-paired-coverage');
        if (items.length < c.minPairsPerSplit) reasons.add('insufficient-sample');
        const paired = items.flatMap(item => {
          const b = baseline.find(t => t.caseId === item.id), a = candidate.find(t => t.caseId === item.id);
          return a && b ? [{ baseline: b, candidate: a }] : [];
        });
        const all = [...baseline, ...candidate];
        if (new Set(selected.map(t => t.source)).size !== 1) reasons.add('mixed-measurement-provenance');
        if (['manual-baseline', c.mode].some(arm => new Set(selected.filter(t => t.arm === arm).map(t => t.policyRevision)).size > 1)) reasons.add('policy-revision-conflict');
        if (all.some(t => t.observedAtMs > c.nowMs)) reasons.add('future-trial');
        if (paired.some(p => p.baseline.environmentDigest !== p.candidate.environmentDigest || p.baseline.accountLimitsDigest !== p.candidate.accountLimitsDigest)) reasons.add('unmatched-environment');
        if (all.some(t => quality(t) === null)) reasons.add('unknown-quality');
        if (needsTime && all.some(t => t.elapsedMs === null)) reasons.add('unknown-time');
        if (needsCost) {
          if (all.some(t => t.totalCostUnits === null)) reasons.add('unknown-cost');
          if (new Set(selected.map(t => `${t.costs.currency}/${t.costs.unit}`)).size !== 1) reasons.add('incompatible-cost-units');
          if (all.some(t => t.priceObservedAtMs === null || t.priceSourceDigest === null || t.priceObservedAtMs > t.observedAtMs || c.nowMs - t.priceObservedAtMs > c.maxPriceAgeMs)) reasons.add('unverified-or-stale-price');
        }
        const b = summary(baseline), a = summary(candidate);
        if (a.quality?.mean === null || a.quality === null || a.quality.mean < c.qualityFloor) reasons.add('quality-floor');
        if (a.successRate === null || a.successRate < c.minSuccessRate) reasons.add('success-rate-floor');
        if (a.unknownRate === null || a.unknownRate > c.maxUnknownRate) reasons.add('unknown-rate-limit');
        if (c.mode !== 'performance' && a.quality?.mean !== null && b.quality?.mean !== null && a.quality && b.quality && a.quality.mean < b.quality.mean) reasons.add('quality-regression');
        if (c.costLimitUnits !== null && candidate.some(t => t.totalCostUnits === null || t.totalCostUnits > c.costLimitUnits!)) reasons.add('per-trial-budget-limit');
        const objective = (t: RecordedTrial) => c.mode === 'performance' ? quality(t)! : c.mode === 'value' ? t.totalCostUnits!
          : c.mode === 'speed' ? t.elapsedMs! : t.totalCostUnits! / c.costBasisUnits + t.elapsedMs! / c.timeBasisMs;
        const metricMissing = all.some(t => quality(t) === null || (needsCost && t.totalCostUnits === null) || (needsTime && t.elapsedMs === null));
        const differences = metricMissing || reasons.has('incompatible-cost-units') ? null : statistics(paired.map(p => c.mode === 'performance'
          ? objective(p.candidate) - objective(p.baseline) : objective(p.baseline) - objective(p.candidate)));
        const improved = reasons.size === 0 && differences?.mean !== null && differences !== null && differences.mean > c.minImprovement;
        return Object.freeze({ split, baseline: b, candidate: a, pairedImprovement: differences,
          status: reasons.size ? 'insufficient' as const : improved ? 'observed-improvement' as const : 'no-observed-improvement' as const,
          reasons: Object.freeze([...reasons]) });
      });
      return Object.freeze({ datasetDigest: dataset.digest, mode: c.mode, constraints: Object.freeze({ ...c }),
        measurementSource: new Set(selected.map(t => t.source)).size === 1 ? selected[0].source : 'mixed-or-empty',
        qualityMetric: 'non-success-scored-zero' as const,
        status: splits.some(s => s.status === 'insufficient') ? 'insufficient' : splits.every(s => s.status === 'observed-improvement') ? 'observed-improvement' : 'no-observed-improvement',
        splits: Object.freeze(splits), promotionEligible: false as const, statisticalQualification: 'not-performed' as const,
        numericPrecision: 'floating-point-descriptive' as const });
    },
  });
}
