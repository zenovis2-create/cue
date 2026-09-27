import { types } from 'node:util';

export type CostDimension = 'api' | 'subscription' | 'local-resource';
export type CostState = 'actual' | 'estimated' | 'unknown';
export type CostUnit = 'minor' | 'micro' | 'subscription-unit' | 'local-resource-unit';
export type ObservationFreshness = 'fresh' | 'stale' | 'future';
export type CostCapacityDenial =
  | 'observation-future'
  | 'observation-stale'
  | 'cost-unknown'
  | 'price-unknown'
  | 'quota-exhausted'
  | 'quota-unknown'
  | 'gpu-insufficient'
  | 'gpu-unknown';

export interface CostCapacityObservationInput {
  readonly version: 'cue-cost-capacity-observation-v1';
  readonly candidateId: string;
  readonly providerId: string;
  readonly accountRef: string;
  readonly costDimension: CostDimension;
  readonly costState: CostState;
  readonly units: number | null;
  readonly currency: string | null;
  readonly unit: CostUnit;
  readonly sourceRef: string;
  readonly sourceDigest: string;
  readonly observedAtMs: number;
  readonly validUntilMs: number;
  readonly price: 'known' | 'unknown';
  readonly quota: 'available' | 'exhausted' | 'unknown';
  readonly gpu: 'sufficient' | 'insufficient' | 'not-applicable' | 'unknown';
  readonly billing: 'open' | 'final' | 'unknown';
}

export interface CostCapacityObservation extends CostCapacityObservationInput {
  readonly freshness: ObservationFreshness;
  readonly denialReasons: readonly CostCapacityDenial[];
  readonly authority: 'observation-only';
  readonly candidateAuthority: false;
  readonly budgetAuthority: false;
  readonly selectionAuthority: false;
}

const INPUT_KEYS = [
  'version', 'candidateId', 'providerId', 'accountRef', 'costDimension', 'costState', 'units', 'currency', 'unit',
  'sourceRef', 'sourceDigest', 'observedAtMs', 'validUntilMs', 'price', 'quota', 'gpu', 'billing',
] as const;
const DIGEST = /^[a-f0-9]{64}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;
const CURRENCY = /^[A-Z][A-Z0-9]{2,11}$/;
const FORBIDDEN_REF = /(?:^|[._:@-])(?:api[-_]?key|authorization|bearer|credential|password|secret|token|permission|policy|reservation|command|powershell|cmd|bash|shell|exec|spawn|sudo|curl|wget|env)(?:$|[._:@-])/i;

function fail(): never {
  throw new TypeError('invalid_cost_capacity_observation');
}

function exactRecord(value: unknown): Record<(typeof INPUT_KEYS)[number], unknown> {
  if (value === null || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)) fail();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.length !== INPUT_KEYS.length) fail();
  const copy = {} as Record<(typeof INPUT_KEYS)[number], unknown>;
  for (const key of INPUT_KEYS) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
    copy[key] = descriptor.value;
  }
  return copy;
}

function safeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail();
  return value;
}

function safeRef(value: unknown): string {
  if (typeof value !== 'string' || !SAFE_REF.test(value) || FORBIDDEN_REF.test(value)) fail();
  return value;
}

function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail();
  return value as T;
}

/**
 * Copies an untrusted, plain-data observation into an immutable observation-only
 * snapshot. It performs no I/O and confers no selection or budget authority.
 */
export function snapshotCostCapacityObservation(input: unknown, nowMs: number, maxAgeMs: number): CostCapacityObservation {
  const now = safeInteger(nowMs);
  const maximumAge = safeInteger(maxAgeMs);
  const fields = exactRecord(input);

  if (fields.version !== 'cue-cost-capacity-observation-v1') fail();
  const candidateId = safeRef(fields.candidateId);
  const providerId = safeRef(fields.providerId);
  const accountRef = safeRef(fields.accountRef);
  const sourceRef = safeRef(fields.sourceRef);
  if (typeof fields.sourceDigest !== 'string' || !DIGEST.test(fields.sourceDigest)) fail();

  const costDimension = oneOf(fields.costDimension, ['api', 'subscription', 'local-resource'] as const);
  const costState = oneOf(fields.costState, ['actual', 'estimated', 'unknown'] as const);
  const unit = oneOf(fields.unit, ['minor', 'micro', 'subscription-unit', 'local-resource-unit'] as const);
  const price = oneOf(fields.price, ['known', 'unknown'] as const);
  const quota = oneOf(fields.quota, ['available', 'exhausted', 'unknown'] as const);
  const gpu = oneOf(fields.gpu, ['sufficient', 'insufficient', 'not-applicable', 'unknown'] as const);
  const billing = oneOf(fields.billing, ['open', 'final', 'unknown'] as const);
  const observedAtMs = safeInteger(fields.observedAtMs);
  const validUntilMs = safeInteger(fields.validUntilMs);
  if (validUntilMs < observedAtMs) fail();

  let units: number | null;
  if (costState === 'unknown') {
    if (fields.units !== null) fail();
    units = null;
  } else {
    units = safeInteger(fields.units);
    // A zero estimate cannot be promoted to a sourced claim of free execution.
    if (units === 0 && costState !== 'actual') fail();
  }

  let currency: string | null;
  if (costDimension === 'api') {
    if (typeof fields.currency !== 'string' || !CURRENCY.test(fields.currency) || !['minor', 'micro'].includes(unit)) fail();
    if (gpu !== 'not-applicable') fail();
    currency = fields.currency;
  } else {
    if (fields.currency !== null) fail();
    if (costDimension === 'subscription') {
      if (unit !== 'subscription-unit' || gpu !== 'not-applicable') fail();
    } else if (unit !== 'local-resource-unit' || quota !== 'unknown' || billing !== 'unknown') fail();
    currency = null;
  }

  if (costDimension === 'api') {
    if ((costState === 'unknown') !== (price === 'unknown')) fail();
  } else if (price !== 'unknown') fail();
  if (billing === 'final' && costState !== 'actual') fail();

  const freshness: ObservationFreshness = observedAtMs > now
    ? 'future'
    : (now > validUntilMs || now - observedAtMs > maximumAge ? 'stale' : 'fresh');
  const denialReasons: CostCapacityDenial[] = [];
  if (freshness === 'future') denialReasons.push('observation-future');
  if (freshness === 'stale') denialReasons.push('observation-stale');
  if (costState === 'unknown') denialReasons.push('cost-unknown');
  if (costDimension === 'api' && price === 'unknown') denialReasons.push('price-unknown');
  if (costDimension !== 'local-resource' && quota === 'exhausted') denialReasons.push('quota-exhausted');
  if (costDimension !== 'local-resource' && quota === 'unknown') denialReasons.push('quota-unknown');
  if (costDimension === 'local-resource' && gpu === 'insufficient') denialReasons.push('gpu-insufficient');
  if (costDimension === 'local-resource' && gpu === 'unknown') denialReasons.push('gpu-unknown');

  return Object.freeze({
    version: 'cue-cost-capacity-observation-v1', candidateId, providerId, accountRef, costDimension, costState, units,
    currency, unit, sourceRef, sourceDigest: fields.sourceDigest, observedAtMs, validUntilMs, price, quota, gpu, billing,
    freshness, denialReasons: Object.freeze(denialReasons), authority: 'observation-only', candidateAuthority: false,
    budgetAuthority: false, selectionAuthority: false,
  });
}
