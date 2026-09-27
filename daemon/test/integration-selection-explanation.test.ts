import { afterEach, describe, expect, it, vi } from 'vitest';
import { readOrchestrationSnapshot } from '../src/ui/orchestration.js';
import Database from 'better-sqlite3';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { applyOrchestrationRetryMigration } from '../src/orchestration/retry-migration.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createLocalOrchestrationEngine, createOrchestrationEngine, type EngineRequest } from '../src/orchestration/engine.js';
import { createLocalInvocationBudget } from '../src/local-invocation-budget.js';
import { createBudgetManager } from '../src/budget.js';
import { bindRunLocalSelectionPolicy, saveLocalSelectionPolicy, snapshotLocalSelectionDecision } from '../src/selection/local-policy-store.js';
import { bindRunSelectionPolicy, saveSelectionPolicy } from '../src/selection/policy-store.js';
import { snapshotSelectionDecision } from '../src/selection/policy.js';
import { createAttemptDecisionStore } from '../src/selection/attempt-decision-store.js';

const roots: string[] = [], dbs: Ledger[] = [];
afterEach(() => { for (const db of dbs.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const request: EngineRequest = { runId: 'run', taskId: 'make', attemptId: 'attempt', requestId: 'request', observedAtMs: 1000, timeoutMs: 1000 };
const checks = { eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true };
function fixture(local = false, legacy = false) {
  const root = mkdtempSync(join(tmpdir(), 'cue-selection-history-')); roots.push(root);
  const path = join(root, 'ledger.sqlite'); let db: Ledger;
  if (legacy) {
    db = new Database(path); db.pragma('foreign_keys=ON');
    for (const file of readdirSync(resolve('migrations')).filter(f => /^\d{3}.*\.sql$/.test(f) && Number(f.slice(0, 3)) <= 24).sort()) {
      if (file.startsWith('016')) applyOrchestrationRetryMigration(db);
      else db.transaction(() => db.exec(readFileSync(resolve('migrations', file), 'utf8')))();
    }
  } else db = openLedger(path);
  dbs.push(db);
  db.exec("INSERT INTO task VALUES('parent','running',NULL,'now'); INSERT INTO envelope VALUES('env','C:/fixture','[]','now'); INSERT INTO run VALUES('run','parent','env',0,'now')");
  const saved = local ? saveLocalSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, sourceVersion: 'fixture', createdAt: new Date(1000).toISOString(), policy: {
    version: 'cue-local-selection-v1', mode: 'efficiency', producerCandidateId: 'producer', checkerCandidateId: 'checker', limitAttempts: 3, timeoutMs: 1000,
  } }) : saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, sourceVersion: 'fixture', createdAt: new Date(1000).toISOString(), policy: {
    version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 1000, currency: 'TEST', costLimit: null, remainingTimeMs: null,
    maxEstimateAgeMs: 100, allowedCandidateIds: ['producer', 'checker', 'unknown'], pinnedCandidateId: null,
  } });
  (local ? bindRunLocalSelectionPolicy : bindRunSelectionPolicy)(db, { runId: 'run', policyId: 'policy', revision: 1, digest: saved.digest, boundAt: new Date(1000).toISOString() });
  const approval = { policyRevision: 'policy:1', policyDigest: saved.digest, requirementIds: ['req'], allowedCandidateIds: ['producer', 'checker', 'unknown'], allowedScopeIds: [] };
  const plan = validateTaskPlan(approval, { revision: 'plan', policyRevision: approval.policyRevision, policyDigest: saved.digest, tasks: [
    { id: 'make', role: 'model-producer', ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: local ? ['producer'] : ['producer', 'unknown'], scopeIds: [] },
    { id: 'check', role: 'verifier', ownerId: 'reviewer', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: ['checker'], scopeIds: [] },
  ] });
  const store = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true, verifyReceipt: () => ({ outcomeVerified: false, cleanupVerified: false }) }); store.install('run', plan);
  const budget = local ? createLocalInvocationBudget(db) : createBudgetManager(db, { verifyFinalReceipt: () => false });
  if (local) (budget as ReturnType<typeof createLocalInvocationBudget>).initialize({ runId: 'run', limit: 3, policyRevision: 'policy:1', source: 'PRIVATE_BUDGET_SOURCE', observedAtMs: 1000 });
  else (budget as ReturnType<typeof createBudgetManager>).initialize({ runId: 'run', currency: 'TEST', unit: 'micro', limitUnits: 100, policyRevision: 'policy:1', source: 'PRIVATE_BUDGET_SOURCE', observedAtMs: 1000 });
  const truth = { deny: false, prepareFail: false };
  // Deliberately denied synthetic runtime; no native process, evidence qualification or model invocation.
  const start = vi.fn(async () => ({ ok: false, reason: 'fixture-denied' }));
  const observe = vi.fn(() => [{ id: 'producer', checks: { ...checks, eligible: !truth.deny }, estimate: { scope: 'verified-completion-total', quality: 1, expectedCost: 1, conservativeMaxCost: 1,
    expectedTimeMs: 1, conservativeMaxTimeMs: 1, currency: 'TEST', source: 'PRIVATE_ESTIMATE_SOURCE', observedAtMs: 1000 } }, { id: 'unknown', checks, estimate: null }]);
  const terms = { runId: 'run', requestId: 'request', attemptId: 'attempt', currency: 'TEST', unit: 'micro', upperUnits: 10, source: 'PRIVATE_RESERVATION_SOURCE', observedAtMs: 1000, scope: 'verified-completion-attempt-total' };
  const host = { now: () => 1000, maxRequestAgeMs: 100, observeCandidates: observe, observeCandidate: vi.fn(() => ({ candidateId: 'producer', ...checks, eligible: !truth.deny })),
    reservation: () => terms, verifyBudgetMapping: () => true, authorizeExecution: () => true, prepareExecution: () => { if (truth.prepareFail) throw Error('prepare-failed'); }, receipts: () => ({ execution: null, billing: null }) };
  const reserve = vi.fn((input: any) => (budget.reserve as (value: any) => unknown)(input));
  const engine = (local ? createLocalOrchestrationEngine : createOrchestrationEngine)(db, { store, budget: { ...budget, reserve }, runtime: { start } } as any, host as any);
  return { db, path, plan, budget, store, engine, truth, host, observe, start, terms, reserve };
}
const migrate = (db: Ledger) => {
  for (const file of readdirSync(resolve('migrations')).filter(f => /^\d{3}.*\.sql$/.test(f) && Number(f.slice(0, 3)) >= 25).sort())
    db.transaction(() => db.exec(readFileSync(resolve('migrations', file), 'utf8')))();
};

describe('bounded historical selection explanation', () => {
  it.each([false, true])('projects real engine selection without writes or new runtime calls (local=%s)', async local => {
    const f = fixture(local); await f.engine.start(f.plan, request);
    const before = f.db.prepare('SELECT total_changes() n').get();
    const dto = readOrchestrationSnapshot(f.db, 'run')!;
    const selected = dto.stages.find(s => s.taskId === 'make')!.selection;
    expect(selected).toMatchObject({ status: 'recorded', kind: local ? 'local-invocation' : 'monetary', mode: 'efficiency', selectedId: 'producer', authority: 'historical-explanation-only', ranking: local ? 'not-performed' : 'scored' });
    expect(dto.attemptHistory[0]!.selection).toEqual(selected);
    expect(dto.stages.find(s => s.taskId === 'check')!.selection.status).toBe('not-started');
    expect(Object.isFrozen(selected)).toBe(true); expect(Object.isFrozen(selected.assessments)).toBe(true);
    expect(JSON.stringify(selected)).not.toContain('PRIVATE_'); expect(JSON.stringify(selected)).not.toContain('source');
    expect(dto.acceptance).toBe('unverified'); expect(dto.stages.find(s => s.taskId === 'make')!.cleanup).toBe('unknown');
    expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(before); expect(f.start).toHaveBeenCalledTimes(1);
  });
  it('caps candidates at fifty, retains total/truncation, and redacts path-like identifiers', async () => {
    const f = fixture(); const original = f.host.observeCandidates();
    f.host.observeCandidates.mockImplementation(() => [...original, { id: 'C:/private/path', checks, estimate: null }, ...Array.from({ length: 58 }, (_, n) => ({ id: `candidate-${String(n).padStart(2, '0')}`, checks, estimate: null }))]);
    await f.engine.start(f.plan, request);
    const selected = readOrchestrationSnapshot(f.db, 'run')!.stages.find(s => s.taskId === 'make')!.selection;
    expect(selected).toMatchObject({ totalAssessments: 61, truncated: true }); expect(selected.assessments).toHaveLength(50);
    expect(selected.assessments[0]!.id).toBeNull(); expect(JSON.stringify(selected)).not.toContain('C:/'); expect(JSON.stringify(selected)).not.toContain('private');
    expect(selected.selectedId).toBe('producer'); expect(Object.isFrozen(selected.assessments[0]!.exclusions)).toBe(true);
  });
  it('distinguishes sealed legacy history, corrupt records and new missing snapshots', async () => {
    const legacy = fixture(false, true);
    legacy.db.prepare("INSERT INTO orchestration_attempt VALUES('old','run','make','producer','running','{}','C:/fixture',NULL,0)").run();
    legacy.db.prepare("UPDATE orchestration_step SET state='running' WHERE run_id='run' AND task_id='make'").run();
    migrate(legacy.db);
    expect(readOrchestrationSnapshot(legacy.db, 'run')!.stages.find(s => s.taskId === 'make')!.selection.status).toBe('legacy-not-recorded');
    const f = fixture(); f.store.claim({ runId: 'run', taskId: 'make', attemptId: 'missing', candidateId: 'producer', observedAtMs: 1000 });
    expect(readOrchestrationSnapshot(f.db, 'run')!.stages.find(s => s.taskId === 'make')!.selection.status).toBe('invalid');
    const corrupt = fixture(); await corrupt.engine.start(corrupt.plan, request);
    corrupt.db.exec("DROP TRIGGER attempt_selection_update; UPDATE attempt_selection SET digest='" + 'a'.repeat(64) + "'");
    const before = corrupt.db.prepare('SELECT total_changes() n').get();
    const dto = readOrchestrationSnapshot(corrupt.db, 'run')!;
    expect(dto.stages.find(s => s.taskId === 'make')!.selection.status).toBe('invalid'); expect(dto.attemptHistory[0]!.selection.status).toBe('invalid');
    expect(corrupt.db.prepare('SELECT total_changes() n').get()).toEqual(before); expect(corrupt.start).toHaveBeenCalledTimes(1);
  });
});
