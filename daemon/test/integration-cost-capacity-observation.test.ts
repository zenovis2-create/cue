import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createBudgetManager } from '../src/budget.js';
import { openLedger } from '../src/ledger.js';
import { bindAccountIdentities } from '../src/orchestration/account-binding.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { bindRunSelectionPolicy, saveSelectionPolicy } from '../src/selection/policy-store.js';
import {
  snapshotCostCapacityObservation,
  type CostCapacityObservationInput,
} from '../src/selection/cost-capacity-observation.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const canonicalReceipt = (value: object) => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
const base: CostCapacityObservationInput = {
  version: 'cue-cost-capacity-observation-v1',
  candidateId: 'candidate:primary',
  providerId: 'provider:fixture',
  accountRef: 'account:opaque-1',
  costDimension: 'api',
  costState: 'estimated',
  units: 125,
  currency: 'USD',
  unit: 'micro',
  sourceRef: 'provider:price:v1',
  sourceDigest: digest('offline-fixture'),
  observedAtMs: 1_000,
  validUntilMs: 1_200,
  price: 'known',
  quota: 'available',
  gpu: 'not-applicable',
  billing: 'open',
};

const snapshot = (edit: Partial<CostCapacityObservationInput> = {}, nowMs = 1_100, maxAgeMs = 500) =>
  snapshotCostCapacityObservation({ ...base, ...edit }, nowMs, maxAgeMs);

describe('S2 pure cost and capacity observation boundary', () => {
  it('returns a deterministic deeply frozen observation with fixed non-authority', () => {
    const first = snapshot();
    expect(first).toEqual(snapshot());
    expect(first).toMatchObject({
      freshness: 'fresh', denialReasons: [], authority: 'observation-only',
      candidateAuthority: false, budgetAuthority: false, selectionAuthority: false,
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.denialReasons)).toBe(true);
    expect(() => (first.denialReasons as string[]).push('cost-unknown')).toThrow();
  });

  it('derives freshness only from observation time, validity and maximum age', () => {
    expect(snapshot({}, 999).freshness).toBe('future');
    expect(snapshot({}, 999).denialReasons).toEqual(['observation-future']);
    expect(snapshot({}, 1_201).denialReasons).toEqual(['observation-stale']);
    expect(snapshot({ validUntilMs: 2_000 }, 1_501, 500).freshness).toBe('stale');
    expect(snapshot({ validUntilMs: 1_100 }, 1_100, 100).freshness).toBe('fresh');
    for (const extra of [{ fresh: true }, { freshness: 'fresh' }, { revision: 99 }]) {
      expect(() => snapshotCostCapacityObservation({ ...base, ...extra }, 1_100, 500)).toThrow('invalid_cost_capacity_observation');
    }
  });

  it('keeps API money, subscription usage and local resources distinct without conversion', () => {
    expect(snapshot({ costState: 'actual', units: 0, unit: 'minor', billing: 'final' })).toMatchObject({ currency: 'USD', unit: 'minor', units: 0 });
    expect(snapshot({ costDimension: 'subscription', currency: null, unit: 'subscription-unit', price: 'unknown' })).toMatchObject({ units: 125, currency: null, unit: 'subscription-unit' });
    expect(snapshot({ costDimension: 'local-resource', currency: null, unit: 'local-resource-unit', price: 'unknown', quota: 'unknown', gpu: 'sufficient', billing: 'unknown' })).toMatchObject({ units: 125, currency: null, unit: 'local-resource-unit' });
    for (const edit of [
      { currency: null },
      { unit: 'subscription-unit' },
      { costDimension: 'subscription', currency: 'USD', unit: 'subscription-unit', price: 'unknown' },
      { costDimension: 'subscription', currency: null, unit: 'local-resource-unit', price: 'unknown' },
      { costDimension: 'local-resource', currency: null, unit: 'minor', price: 'unknown', quota: 'unknown', billing: 'unknown' },
    ]) expect(() => snapshot(edit as Partial<CostCapacityObservationInput>)).toThrow('invalid_cost_capacity_observation');
  });

  it('preserves explicit unknown and unavailable states as ordered fail-closed denials', () => {
    expect(snapshot({ costState: 'unknown', units: null, price: 'unknown', quota: 'unknown' }).denialReasons)
      .toEqual(['cost-unknown', 'price-unknown', 'quota-unknown']);
    expect(snapshot({ quota: 'exhausted' }).denialReasons).toEqual(['quota-exhausted']);
    const local = { costDimension: 'local-resource', currency: null, unit: 'local-resource-unit', price: 'unknown', quota: 'unknown', billing: 'unknown' } as const;
    expect(snapshot({ ...local, gpu: 'unknown' }).denialReasons).toEqual(['gpu-unknown']);
    expect(snapshot({ ...local, gpu: 'insufficient' }).denialReasons).toEqual(['gpu-insufficient']);
  });

  it('rejects illegal price, GPU and billing combinations while final remains descriptive', () => {
    for (const edit of [
      { price: 'unknown' },
      { costState: 'unknown', units: null },
      { gpu: 'sufficient' },
      { costState: 'estimated', billing: 'final' },
      { costState: 'unknown', units: null, price: 'unknown', billing: 'final' },
      { costState: 'estimated', units: 0 },
      { costDimension: 'subscription', currency: null, unit: 'subscription-unit', price: 'known' },
      { costDimension: 'local-resource', currency: null, unit: 'local-resource-unit', price: 'unknown', quota: 'available', gpu: 'sufficient', billing: 'unknown' },
      { costDimension: 'local-resource', currency: null, unit: 'local-resource-unit', price: 'unknown', quota: 'unknown', gpu: 'sufficient', billing: 'final' },
    ]) expect(() => snapshot(edit as Partial<CostCapacityObservationInput>)).toThrow('invalid_cost_capacity_observation');
    const final = snapshot({ costState: 'actual', billing: 'final' });
    expect(final).toMatchObject({ billing: 'final', authority: 'observation-only', budgetAuthority: false });
  });

  it('rejects non-finite, fractional, negative and unsafe units and times plus inverted validity', () => {
    for (const value of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => snapshot({ units: value })).toThrow('invalid_cost_capacity_observation');
      expect(() => snapshot({ observedAtMs: value })).toThrow('invalid_cost_capacity_observation');
      expect(() => snapshot({}, value)).toThrow('invalid_cost_capacity_observation');
      expect(() => snapshot({}, 1_100, value)).toThrow('invalid_cost_capacity_observation');
    }
    expect(() => snapshot({ observedAtMs: 1_201, validUntilMs: 1_200 })).toThrow('invalid_cost_capacity_observation');
    expect(() => snapshot({ costState: 'unknown', units: 0, price: 'unknown' })).toThrow('invalid_cost_capacity_observation');
  });

  it('rejects unknown or symbol keys, custom prototypes and traps without touching them', () => {
    let touched = 0;
    const getter = Object.defineProperty({ ...base }, 'candidateId', { enumerable: true, get() { touched++; throw Error('getter'); } });
    const toJSON = { ...base, toJSON() { touched++; throw Error('toJSON'); } };
    const proxy = new Proxy(base, { ownKeys() { touched++; throw Error('proxy'); } });
    const revoked = Proxy.revocable(base, {}); revoked.revoke();
    const custom = Object.assign(Object.create({ inherited: true }), base);
    const symbol = { ...base, [Symbol('authority')]: true };
    for (const value of [getter, toJSON, proxy, revoked.proxy, custom, symbol]) {
      expect(() => snapshotCostCapacityObservation(value, 1_100, 500)).toThrow('invalid_cost_capacity_observation');
    }
    expect(touched).toBe(0);
  });

  it('rejects path, credential, policy, permission and command-looking embedded references', () => {
    const bad = [
      'C:/private/account', '../account', 'https://provider.test', 'account:api-key', 'account:secret',
      'policy:revision:1', 'permission:all', 'reservation:1', 'command:powershell', 'env:HOME', '$HOME', 'rm -rf',
    ];
    for (const value of bad) {
      for (const key of ['candidateId', 'providerId', 'accountRef', 'sourceRef'] as const) {
        expect(() => snapshot({ [key]: value })).toThrow('invalid_cost_capacity_observation');
      }
    }
    expect(() => snapshot({ sourceDigest: 'a'.repeat(63) })).toThrow('invalid_cost_capacity_observation');
    expect(() => snapshot({ sourceDigest: 'A'.repeat(64) })).toThrow('invalid_cost_capacity_observation');
  });

  it('copies own data and cannot be changed by later input mutation', () => {
    const input = { ...base };
    const result = snapshotCostCapacityObservation(input, 1_100, 500);
    input.units = 999;
    input.sourceRef = 'provider:changed';
    expect(result).toMatchObject({ units: 125, sourceRef: 'provider:price:v1' });
    const nullPrototype = Object.assign(Object.create(null), base);
    expect(snapshotCostCapacityObservation(nullPrototype, 1_100, 500)).toEqual(result);
  });
});

describe('S2 production budget observation bridge', () => {
  it('projects the latest persisted receipt with exact attempt/account/source lineage and no authority', () => {
    const db = openLedger();
    try {
      const h = 'a'.repeat(64);
      db.prepare("INSERT INTO task VALUES('task','running',NULL,'now')").run();
      db.prepare("INSERT INTO envelope VALUES(?,?,?,'now')").run(h, 'worktree', '[]');
      db.prepare("INSERT INTO run VALUES('run','task',?,0,'now')").run(h);
      const policy = saveSelectionPolicy(db, { policyId:'policy', expectedRevision:null, createdAt:new Date(1).toISOString(), sourceVersion:'fixture', policy:{ version:'cue-selection-v1', mode:'efficiency', qualityMinimum:.5, costBasis:1, timeBasisMs:1, currency:'USD', costLimit:null, remainingTimeMs:null, maxEstimateAgeMs:100, allowedCandidateIds:['candidate'], pinnedCandidateId:null } });
      bindRunSelectionPolicy(db, { runId:'run', policyId:'policy', revision:1, digest:policy.digest, boundAt:new Date(1).toISOString() });
      const approval = { policyRevision:'policy:1', policyDigest:policy.digest, requirementIds:['requirement'], allowedCandidateIds:['candidate'], allowedScopeIds:[] };
      const plan = validateTaskPlan(approval, { revision:'plan:1', policyRevision:'policy:1', policyDigest:policy.digest, tasks:[
        { id:'make', role:'model-producer', ownerId:'maker', requirementIds:['requirement'], dependencyIds:[], candidateIds:['candidate'], scopeIds:[] },
        { id:'check', role:'verifier', ownerId:'checker', requirementIds:['requirement'], dependencyIds:['make'], candidateIds:['candidate'], scopeIds:[] },
      ] });
      const orchestration = createOrchestrationStore(db, { authorizePlan:()=>true, authorizeClaim:()=>true, verifyReceipt:()=>({ outcomeVerified:false, cleanupVerified:false }) });
      orchestration.install('run', plan);
      db.transaction(() => bindAccountIdentities(db, [{ runId:'run', candidateId:'candidate', authReference:'account-opaque', toolId:'provider:fixture', sourceVersion:'fixture', subjectDigest:h, modelId:null, endpointId:null, planDigest:plan.digest, policyDigest:policy.digest, envelopeHash:h }])).immediate();
      orchestration.claim({ runId:'run', taskId:'make', attemptId:'attempt', candidateId:'candidate', observedAtMs:1_000 });
      const manager = createBudgetManager(db, { verifyFinalReceipt:()=>true });
      manager.initialize({ runId:'run', currency:'USD', unit:'micro', limitUnits:100, policyRevision:'policy:1', source:'policy:fixture', observedAtMs:900 });
      manager.reserve({ runId:'run', requestId:'request', attemptId:'attempt', currency:'USD', unit:'micro', upperUnits:20, source:'estimate:fixture', observedAtMs:1_000, scope:'verified-completion-attempt-total' });
      manager.observe({ runId:'run', requestId:'request', receiptId:'receipt:estimate', revision:1, currency:'USD', unit:'micro', kind:'estimated', units:12, providerFinal:false, source:'provider:usage:v1', observedAtMs:1_010 });

      expect(manager.costObservation('run', 'request', 1_020, 100)).toMatchObject({
        candidateId:'candidate', providerId:'provider:fixture', accountRef:'account-opaque', costDimension:'api',
        costState:'estimated', units:12, freshness:'fresh', sourceRef:'provider:usage:v1', quota:'unknown',
        denialReasons:['quota-unknown'], authority:'observation-only', candidateAuthority:false, budgetAuthority:false, selectionAuthority:false,
      });
      manager.observe({ runId:'run', requestId:'request', receiptId:'receipt:unknown', revision:2, currency:'USD', unit:'micro', kind:'unknown', units:null, providerFinal:false, source:'provider:usage:v2', observedAtMs:1_030 });
      expect(manager.costObservation('run', 'request', 1_200, 100)).toMatchObject({
        costState:'unknown', units:null, freshness:'stale', sourceRef:'provider:usage:v2',
        denialReasons:['observation-stale','cost-unknown','price-unknown','quota-unknown'],
      });
      expect(manager.costObservation('run', 'missing', 1_200, 100)).toBeNull();

      const saved = db.prepare("SELECT payload FROM integration_budget_receipt WHERE receipt_id='receipt:unknown'").get() as {payload:string};
      const parsed = JSON.parse(saved.payload);
      for (const edit of [{runId:'foreign'}, {requestId:'foreign'}, {unit:'minor'}, {providerFinal:'0'}]) {
        db.prepare("UPDATE integration_budget_receipt SET payload=? WHERE receipt_id='receipt:unknown'").run(canonicalReceipt({...parsed,...edit}));
        expect(() => manager.costObservation('run', 'request', 1_200, 100)).toThrow('budget_receipt_integrity');
      }
      const {source: _missing, ...missingField} = parsed;
      for (const malformed of [missingField, {...parsed, extra:'field'}]) {
        db.prepare("UPDATE integration_budget_receipt SET payload=? WHERE receipt_id='receipt:unknown'").run(canonicalReceipt(malformed));
        expect(() => manager.costObservation('run', 'request', 1_200, 100)).toThrow('budget_receipt_integrity');
      }
      db.prepare("UPDATE integration_budget_receipt SET payload=?,kind='actual' WHERE receipt_id='receipt:unknown'").run(saved.payload);
      expect(() => manager.costObservation('run', 'request', 1_200, 100)).toThrow('budget_receipt_integrity');
      db.prepare("UPDATE integration_budget_receipt SET kind='unknown',provider_final=1 WHERE receipt_id='receipt:unknown'").run();
      expect(() => manager.costObservation('run', 'request', 1_200, 100)).toThrow('budget_receipt_integrity');
    } finally { db.close(); }
  });
});
