import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createBudgetManager, type BudgetPolicy, type BudgetReservation, type BudgetReceipt } from '../src/budget.js';
const roots: string[] = [], dbs: Ledger[] = [];
afterEach(() => { for (const db of dbs.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const base: BudgetPolicy = { runId: 'run', currency: 'TEST', unit: 'micro', limitUnits: 100, policyRevision: 'p1', source: 'host-policy', observedAtMs: 1000 };
const reservation = (id = 'one', upperUnits = 60): BudgetReservation => ({ runId: 'run', requestId: id, attemptId: `attempt-${id}`, currency: 'TEST', unit: 'micro', upperUnits, source: 'fixture-total-including-verifier', observedAtMs: 1001, scope: 'verified-completion-attempt-total' });
const receipt = (edit: Partial<BudgetReceipt> = {}): BudgetReceipt => ({ runId: 'run', requestId: 'one', receiptId: 'receipt-1', revision: 1, currency: 'TEST', unit: 'micro', kind: 'actual', units: 40, providerFinal: true, source: 'trusted-billing-receipt', observedAtMs: 1002, ...edit });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-budget-')); roots.push(root);
  const path = join(root, 'ledger.db'), db = openLedger(path); dbs.push(db);
  const manager = createBudgetManager(db, { verifyFinalReceipt: r => r.source === 'trusted-billing-receipt' });
  manager.initialize(base); return { path, db, manager };
}
describe('S2 atomic persistent budget', () => {
  it('initialization is immutable and rejects currency/unit changes', () => {
    const { manager, db } = fixture();
    expect(manager.initialize(base).limitUnits).toBe(100n);
    expect(() => manager.initialize({ ...base, limitUnits: 101 })).toThrow('budget_policy_mismatch');
    expect(() => db.prepare('UPDATE integration_budget SET limit_units=999').run()).toThrow('immutable');
    expect(() => db.prepare("INSERT OR REPLACE INTO integration_budget VALUES('run','TEST','micro',999,'p2','tampered',1001)").run()).toThrow('immutable');
    expect(manager.summary('run').limitUnits).toBe(100n);
    expect(() => manager.reserve({ ...reservation(), currency: 'USD' })).toThrow('currency_mismatch');
    expect(() => manager.reserve({ ...reservation(), unit: 'minor' })).toThrow('currency_mismatch');
  });
  it('reservation exact replay is idempotent and attempt/request mismatches reject', () => {
    const { manager } = fixture();
    expect(manager.reserve(reservation()).remainingUnits).toBe(40n);
    expect(manager.reserve(reservation()).remainingUnits).toBe(40n);
    expect(() => manager.reserve({ ...reservation(), upperUnits: 61 })).toThrow('request_mismatch');
    expect(() => manager.reserve({ ...reservation('two', 1), attemptId: 'attempt-one' })).toThrow();
    expect(() => manager.reserve(reservation('two', 41))).toThrow('limit_exceeded');
    expect(manager.summary('run').committedUnits).toBe(60n);
  });
  it('unknown stop/cancel ACK and estimates retain the upper reservation', () => {
    const { manager } = fixture(); manager.reserve(reservation());
    expect(manager.observe(receipt({ kind: 'unknown', units: null, providerFinal: false, source: 'cancel-ack' })).committedUnits).toBe(60n);
    expect(manager.observe(receipt({ receiptId: 'e2', revision: 2, kind: 'estimated', units: 10, providerFinal: false })).committedUnits).toBe(60n);
    expect(() => manager.observe(receipt({ receiptId: 'e3', revision: 3, source: 'cancel-ack' }))).toThrow('unverified_final_receipt');
    expect(() => manager.observe(receipt({ receiptId: 'e4', revision: 3, kind: 'unknown', units: null }))).toThrow();
    expect(manager.summary('run').committedUnits).toBe(60n);
  });
  it('actual final settlement releases only verified excess and late actual replaces total', () => {
    const { manager } = fixture(); manager.reserve(reservation());
    expect(manager.observe(receipt()).remainingUnits).toBe(60n);
    expect(manager.observe(receipt()).actualUnits).toBe(40n);
    expect(() => manager.observe(receipt({ units: 41 }))).toThrow('receipt_mismatch');
    expect(manager.observe(receipt({ receiptId: 'late', revision: 2, units: 50 })).actualUnits).toBe(50n);
    expect(manager.summary('run').committedUnits).toBe(50n);
    expect(() => manager.observe(receipt({ receiptId: 'old', revision: 1 }))).toThrow('receipt_regression');
    expect(() => manager.observe(receipt({ receiptId: 'downgrade', revision: 3, kind: 'estimated', providerFinal: false }))).toThrow('receipt_regression');
  });
  it('overspend survives as debt and blocks even zero new reservations', () => {
    const { manager } = fixture(); manager.reserve(reservation());
    const state = manager.observe(receipt({ units: 125 }));
    expect(state.actualUnits).toBe(125n); expect(state.debtUnits).toBe(25n);
    expect(() => manager.reserve(reservation('new', 0))).toThrow('limit_exceeded');
    expect(manager.observe(receipt({ receiptId: 'corrected', revision: 2, units: 90 })).debtUnits).toBe(0n);
    expect(manager.reserve(reservation('new', 10)).remainingUnits).toBe(0n);
  });
  it('unfinalized actual and high estimates retain conservative obligations', () => {
    const { manager } = fixture(); manager.reserve(reservation());
    expect(manager.observe(receipt({ units: 80, kind: 'estimated', providerFinal: false })).committedUnits).toBe(80n);
    expect(manager.observe(receipt({ receiptId: 'a2', revision: 2, units: 20, providerFinal: false })).committedUnits).toBe(80n);
    expect(manager.summary('run').actualUnits).toBe(20n);
  });
  it('reopen and separate connections preserve all scopes and exact replay', () => {
    const { manager, path, db } = fixture(); manager.reserve(reservation()); manager.observe(receipt()); db.close();
    const second = openLedger(path); dbs.push(second);
    const reloaded = createBudgetManager(second, { verifyFinalReceipt: () => false });
    expect(reloaded.summary('run').actualUnits).toBe(40n);
    expect(reloaded.observe(receipt()).actualUnits).toBe(40n);
    reloaded.initialize({ ...base, runId: 'other', limitUnits: 1 });
    expect(reloaded.summary('other').remainingUnits).toBe(1n);
    expect(reloaded.summary('run').remainingUnits).toBe(60n);
  });
  it('safe integer validation and BigInt aggregates preserve large late actuals', () => {
    const { manager } = fixture();
    for (const upperUnits of [-1, .1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => manager.reserve({ ...reservation(), upperUnits })).toThrow();
    manager.reserve(reservation('one', 0)); manager.reserve(reservation('two', 0));
    manager.observe(receipt({ units: Number.MAX_SAFE_INTEGER }));
    const state = manager.observe(receipt({ requestId: 'two', receiptId: 'two-receipt', units: Number.MAX_SAFE_INTEGER }));
    expect(state.actualUnits).toBe(BigInt(Number.MAX_SAFE_INTEGER) * 2n);
    expect(state.debtUnits).toBe(BigInt(Number.MAX_SAFE_INTEGER) * 2n - 100n);
    expect(Object.isFrozen(state)).toBe(true);
  });
  it('independent SQLite writers compete atomically, only one upper bound fits', async () => {
    const { path, manager } = fixture();
    const workers: Worker[] = [];
    const ready: Promise<void>[] = [], results: Promise<string>[] = [];
    try { for (const id of ['a', 'b']) {
      const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');
        (async()=>{ const {openLedger}=await import(workerData.ledger); const {createBudgetManager}=await import(workerData.budget);
          const db=openLedger(workerData.path); const manager=createBudgetManager(db,{verifyFinalReceipt:()=>false});
          parentPort.once('message',()=>{ let result='reserved'; try {manager.reserve(workerData.request)} catch(e){result=e.message} finally {db.close()}
            parentPort.postMessage({result}); parentPort.close(); }); parentPort.postMessage({ready:true});
        })().catch(e=>{parentPort.postMessage({result:e.message});parentPort.close()});`,
        { eval: true, workerData: { path, request: reservation(id, 60), ledger: pathToFileURL(resolve('dist/src/ledger.js')).href, budget: pathToFileURL(resolve('dist/src/budget.js')).href } });
      workers.push(worker);
      let readySettled=false,resultSettled=false;
      const opened=new Promise<void>((resolveReady, reject) => { worker.on('error', reject); worker.on('message', m => { if (m.ready){readySettled=true;resolveReady();} else if (m.result && m.result !== 'reserved') reject(Error(m.result)); }); worker.on('exit',code=>{if(!readySettled)reject(Error(`worker_exited_before_ready:${code}`));}); });
      ready.push(opened); await opened;
      const workerResult=new Promise<string>((resolveResult, reject) => { worker.on('error', reject); worker.on('message', m => { if (m.result){resultSettled=true;resolveResult(m.result);} }); worker.on('exit',code=>{if(!resultSettled)reject(Error(`worker_exited_before_result:${code}`));}); });
      void workerResult.catch(()=>{}); results.push(workerResult);
    }
      await Promise.all(ready); workers.forEach(w => w.postMessage('go'));
      expect((await Promise.all(results)).sort()).toEqual(['budget_limit_exceeded', 'reserved']);
      expect(manager.summary('run').committedUnits).toBe(60n);
    } finally { await Promise.all(workers.map(w => w.terminate())); }
  }, 15000);
});
