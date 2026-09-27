import { createHash } from 'node:crypto';
import type { Ledger } from './ledger.js';
import { readAccountIdentities } from './orchestration/account-binding.js';
import { snapshotCostCapacityObservation, type CostCapacityObservation } from './selection/cost-capacity-observation.js';

export interface BudgetPolicy {
  runId: string; currency: string; unit: 'minor' | 'micro'; limitUnits: number;
  policyRevision: string; source: string; observedAtMs: number;
}
export interface BudgetReservation {
  runId: string; requestId: string; attemptId: string; currency: string; unit: 'minor' | 'micro';
  upperUnits: number; source: string; observedAtMs: number;
  scope: 'verified-completion-attempt-total';
}
export interface BudgetReceipt {
  runId: string; requestId: string; receiptId: string; revision: number;
  currency: string; unit: 'minor' | 'micro'; kind: 'actual' | 'estimated' | 'unknown';
  units: number | null; providerFinal: boolean; source: string; observedAtMs: number;
}
export interface BudgetSummary {
  readonly runId: string; readonly currency: string; readonly unit: 'minor' | 'micro';
  readonly limitUnits: bigint; readonly committedUnits: bigint; readonly actualUnits: bigint;
  readonly remainingUnits: bigint; readonly debtUnits: bigint;
}
type BudgetRow = { run_id: string; currency: string; unit: 'minor' | 'micro'; limit_units: number; policy_revision: string; source: string; observed_at_ms: number };
type ReceiptRow = { revision: number; kind: BudgetReceipt['kind']; units: number | null; provider_final: number; payload: string };
function check(value: unknown, keys: string[]): void {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error('invalid_budget_input');
  const names = Reflect.ownKeys(value);
  if (names.length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) throw Error('invalid_budget_input');
  for (const key of names) if (typeof key !== 'string' || !keys.includes(key) || !('value' in Object.getOwnPropertyDescriptor(value, key)!)) throw Error('invalid_budget_input');
}
function text(...values: string[]): void {
  for (const value of values) if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)) throw Error('invalid_budget_text');
}
function integer(...values: number[]): void {
  for (const value of values) if (!Number.isSafeInteger(value) || value < 0) throw Error('invalid_budget_units');
}
function currency(value: { currency: string; unit: string }): void {
  text(value.currency);
  if (!['minor', 'micro'].includes(value.unit)) throw Error('invalid_budget_unit');
}
function canonical(value: object): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
}
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

/** Host-only authority. The verifier must validate the final billing receipt, not a cancel ACK. */
export function createBudgetManager(db: Ledger, options: { verifyFinalReceipt: (receipt: Readonly<BudgetReceipt>) => boolean }) {
  function policy(runId: string): BudgetRow {
    text(runId);
    const row = db.prepare('SELECT * FROM integration_budget WHERE run_id=?').get(runId) as BudgetRow | undefined;
    if (!row) throw Error('budget_missing');
    return row;
  }
  function compatible(runId: string, value: { currency: string; unit: string }): BudgetRow {
    const row = policy(runId);
    if (row.currency !== value.currency || row.unit !== value.unit) throw Error('budget_currency_mismatch');
    return row;
  }
  function latest(runId: string, requestId: string): ReceiptRow | undefined {
    return db.prepare('SELECT revision,kind,units,provider_final,payload FROM integration_budget_receipt WHERE run_id=? AND request_id=? ORDER BY revision DESC LIMIT 1').get(runId, requestId) as ReceiptRow | undefined;
  }
  function snapshot(runId: string): BudgetSummary {
    const row = policy(runId);
    const reservations = db.prepare('SELECT request_id,upper_units FROM integration_budget_reservation WHERE run_id=?').all(runId) as { request_id: string; upper_units: number }[];
    let committed = 0n, actual = 0n;
    for (const reservation of reservations) {
      const receipt = latest(runId, reservation.request_id);
      const amount = BigInt(receipt?.units ?? 0);
      const upper = BigInt(reservation.upper_units);
      const observed = db.prepare('SELECT MAX(units) AS units FROM integration_budget_receipt WHERE run_id=? AND request_id=?').get(runId, reservation.request_id) as { units: number | null };
      const pendingUpper = BigInt(observed.units ?? 0) > upper ? BigInt(observed.units ?? 0) : upper;
      if (receipt?.kind === 'actual') actual += amount;
      committed += receipt?.kind === 'actual' && receipt.provider_final === 1 ? amount : pendingUpper;
    }
    const limit = BigInt(row.limit_units);
    return Object.freeze({ runId, currency: row.currency, unit: row.unit, limitUnits: limit, committedUnits: committed, actualUnits: actual,
      remainingUnits: limit > committed ? limit - committed : 0n, debtUnits: committed > limit ? committed - limit : 0n });
  }
  return Object.freeze({
    initialize(input: BudgetPolicy): BudgetSummary {
      check(input, ['runId', 'currency', 'unit', 'limitUnits', 'policyRevision', 'source', 'observedAtMs']);
      text(input.runId, input.policyRevision, input.source); currency(input); integer(input.limitUnits, input.observedAtMs);
      return db.transaction(() => {
        const existing = db.prepare('SELECT * FROM integration_budget WHERE run_id=?').get(input.runId) as BudgetRow | undefined;
        if (existing) {
          if (existing.currency !== input.currency || existing.unit !== input.unit || existing.limit_units !== input.limitUnits || existing.policy_revision !== input.policyRevision || existing.source !== input.source || existing.observed_at_ms !== input.observedAtMs) throw Error('budget_policy_mismatch');
        } else db.prepare('INSERT INTO integration_budget VALUES(?,?,?,?,?,?,?)').run(input.runId, input.currency, input.unit, input.limitUnits, input.policyRevision, input.source, input.observedAtMs);
        return snapshot(input.runId);
      }).immediate();
    },
    reserve(input: BudgetReservation): BudgetSummary {
      check(input, ['runId', 'requestId', 'attemptId', 'currency', 'unit', 'upperUnits', 'source', 'observedAtMs', 'scope']);
      text(input.runId, input.requestId, input.attemptId, input.source); currency(input); integer(input.upperUnits, input.observedAtMs);
      if (input.scope !== 'verified-completion-attempt-total') throw Error('budget_scope_mismatch');
      const payload = canonical(input);
      return db.transaction(() => {
        compatible(input.runId, input);
        const replay = db.prepare('SELECT payload FROM integration_budget_reservation WHERE run_id=? AND request_id=?').get(input.runId, input.requestId) as { payload: string } | undefined;
        if (replay) { if (replay.payload !== payload) throw Error('budget_request_mismatch'); return snapshot(input.runId); }
        const state = snapshot(input.runId);
        if (state.debtUnits > 0n || BigInt(input.upperUnits) > state.remainingUnits) throw Error('budget_limit_exceeded');
        db.prepare('INSERT INTO integration_budget_reservation VALUES(?,?,?,?,?)').run(input.runId, input.requestId, input.attemptId, input.upperUnits, payload);
        return snapshot(input.runId);
      }).immediate();
    },
    observe(input: BudgetReceipt): BudgetSummary {
      check(input, ['runId', 'requestId', 'receiptId', 'revision', 'currency', 'unit', 'kind', 'units', 'providerFinal', 'source', 'observedAtMs']);
      text(input.runId, input.requestId, input.receiptId, input.source); currency(input); integer(input.revision, input.observedAtMs);
      if (!['actual', 'estimated', 'unknown'].includes(input.kind) || typeof input.providerFinal !== 'boolean') throw Error('invalid_budget_receipt');
      if (input.kind === 'unknown') { if (input.units !== null || input.providerFinal) throw Error('invalid_unknown_receipt'); }
      else { if (input.units === null) throw Error('missing_budget_units'); integer(input.units); }
      if (input.providerFinal && input.kind !== 'actual') throw Error('final_actual_required');
      // Snapshot the exact receipt before giving a host verifier an immutable view.
      const receipt = Object.freeze({ ...input });
      const payload = canonical(receipt);
      return db.transaction(() => {
        compatible(receipt.runId, receipt);
        const replay = db.prepare('SELECT payload FROM integration_budget_receipt WHERE run_id=? AND receipt_id=?').get(receipt.runId, receipt.receiptId) as { payload: string } | undefined;
        if (replay) { if (replay.payload !== payload) throw Error('budget_receipt_mismatch'); return snapshot(receipt.runId); }
        if (!db.prepare('SELECT 1 FROM integration_budget_reservation WHERE run_id=? AND request_id=?').get(receipt.runId, receipt.requestId)) throw Error('reservation_missing');
        const previous = latest(receipt.runId, receipt.requestId);
        if (previous && (receipt.revision <= previous.revision || (previous.provider_final && !receipt.providerFinal) || (previous.kind === 'actual' && receipt.kind !== 'actual'))) throw Error('budget_receipt_regression');
        if (receipt.providerFinal && options.verifyFinalReceipt(receipt) !== true) throw Error('unverified_final_receipt');
        db.prepare('INSERT INTO integration_budget_receipt VALUES(?,?,?,?,?,?,?,?)').run(receipt.runId, receipt.receiptId, receipt.requestId, receipt.revision, receipt.kind, receipt.units, Number(receipt.providerFinal), payload);
        return snapshot(receipt.runId);
      }).immediate();
    },
    costObservation(runId: string, requestId: string, nowMs: number, maxAgeMs: number): CostCapacityObservation | null {
      text(runId, requestId); integer(nowMs, maxAgeMs);
      const row = db.prepare(`SELECT r.run_id,r.receipt_id,r.request_id,r.revision,r.kind,r.units,r.provider_final,r.payload,
          a.attempt_id,a.candidate_id,p.currency,p.unit
        FROM integration_budget_receipt r
        JOIN integration_budget_reservation b ON b.run_id=r.run_id AND b.request_id=r.request_id
        JOIN orchestration_attempt a ON a.attempt_id=b.attempt_id AND a.run_id=b.run_id
        JOIN integration_budget p ON p.run_id=r.run_id
        WHERE r.run_id=? AND r.request_id=? ORDER BY r.revision DESC LIMIT 1`).get(runId, requestId) as ({
          run_id:string;receipt_id:string;request_id:string;revision:number;kind:BudgetReceipt['kind'];units:number|null;
          provider_final:number;payload:string;attempt_id:string;candidate_id:string;currency:string;unit:string;
        })|undefined;
      if (!row) return null;
      const receipt = JSON.parse(row.payload) as BudgetReceipt;
      try {
        check(receipt, ['runId', 'requestId', 'receiptId', 'revision', 'currency', 'unit', 'kind', 'units', 'providerFinal', 'source', 'observedAtMs']);
        text(receipt.runId, receipt.requestId, receipt.receiptId, receipt.source); currency(receipt); integer(receipt.revision, receipt.observedAtMs);
      } catch { throw Error('budget_receipt_integrity'); }
      if (!['actual', 'estimated', 'unknown'].includes(receipt.kind) || typeof receipt.providerFinal !== 'boolean'
        || (receipt.kind === 'unknown' ? receipt.units !== null || receipt.providerFinal : receipt.units === null)
        || (receipt.units !== null && (!Number.isSafeInteger(receipt.units) || receipt.units < 0))
        || (receipt.providerFinal && receipt.kind !== 'actual')
        || canonical(receipt) !== row.payload || receipt.runId !== runId || receipt.runId !== row.run_id
        || receipt.requestId !== requestId || receipt.requestId !== row.request_id || receipt.receiptId !== row.receipt_id
        || receipt.revision !== row.revision || receipt.kind !== row.kind || receipt.units !== row.units
        || receipt.providerFinal !== Boolean(row.provider_final) || receipt.currency !== row.currency || receipt.unit !== row.unit
      ) throw Error('budget_receipt_integrity');
      const identity = readAccountIdentities(db, runId).find(value => value.candidateId === row.candidate_id);
      if (!identity) throw Error('budget_observation_identity_missing');
      return snapshotCostCapacityObservation({
        version: 'cue-cost-capacity-observation-v1', candidateId: row.candidate_id, providerId: identity.toolId,
        // Monetary budgets persist ISO-like currency with minor/micro units, the API-only shape in this boundary.
        // Subscription and local-resource observations require their distinct stores and are never inferred here.
        accountRef: identity.authReference, costDimension: 'api', costState: receipt.kind, units: receipt.units,
        currency: receipt.currency, unit: receipt.unit, sourceRef: receipt.source,
        sourceDigest: sha(canonical({ receipt: sha(row.payload), attemptId: row.attempt_id, identity: identity.digest })),
        observedAtMs: receipt.observedAtMs, validUntilMs: Number.MAX_SAFE_INTEGER,
        price: receipt.kind === 'unknown' ? 'unknown' : 'known', quota: 'unknown', gpu: 'not-applicable',
        billing: receipt.providerFinal ? 'final' : 'open',
      }, nowMs, maxAgeMs);
    },
    summary(runId: string): BudgetSummary { return db.transaction(() => snapshot(runId))(); },
  });
}
