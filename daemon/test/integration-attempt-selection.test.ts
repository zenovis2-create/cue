import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
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
import { createLayaShadowAdapter } from '../src/selection/laya-shadow.js';
import { createCueCore, initializeConfig } from '../../app/core.mjs';

const roots: string[] = [], dbs: Ledger[] = [];
afterEach(() => { for (const db of dbs.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const request: EngineRequest = { runId: 'run', taskId: 'make', attemptId: 'attempt', requestId: 'request', observedAtMs: 1000, timeoutMs: 1000 };
const checks = { eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true };
function fixture(local = false, legacy = false, coreWorktree = false) {
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
  const worktree = coreWorktree ? mkdtempSync(join(tmpdir(), 'cue-selection-work-')) : join(root, 'work');
  if (coreWorktree) roots.push(worktree);
  db.exec("INSERT INTO task VALUES('parent','running',NULL,'now')");
  db.prepare("INSERT INTO envelope VALUES('env',?,'[]','now')").run(coreWorktree ? realpathSync.native(worktree) : 'C:/fixture');
  db.exec("INSERT INTO run VALUES('run','parent','env',0,'now')");
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
  return { db, path, root, worktree, plan, budget, store, engine, truth, host, observe, start, terms, reserve };
}
const migrate = (db: Ledger) => {
  for (const file of readdirSync(resolve('migrations')).filter(f => /^\d{3}.*\.sql$/.test(f) && Number(f.slice(0, 3)) >= 25).sort())
    db.transaction(() => db.exec(readFileSync(resolve('migrations', file), 'utf8')))();
};

describe('Laya post-attempt shadow seam', () => {
  it('compares a typed Laya choice against a recorded monetary decision without changing claims or reservations', async () => {
    const f = fixture();
    f.observe.mockImplementation(() => ['producer', 'unknown'].map((id, i) => ({ id, checks,
      estimate: { scope: 'verified-completion-total', quality: 1, expectedCost: i + 1, conservativeMaxCost: i + 1,
        expectedTimeMs: i + 1, conservativeMaxTimeMs: i + 1, currency: 'TEST', source: 'fixture', observedAtMs: 1000 } })));
    await f.engine.start(f.plan, request);
    const adapter = createLayaShadowAdapter(f.db);
    const input = { attemptId: 'attempt', taskSummary: 'Bounded local fixture task', options: [
      { id: 'producer', description: 'Fixture model A' }, { id: 'unknown', description: 'Fixture model B' },
    ] };
    const prepared = adapter.prepare(input);
    expect(prepared).toMatchObject({ status: 'ready', baselineId: 'producer', authority: 'none', promotionEligible: false });
    expect(prepared.request?.questions.candidate.criteria).toEqual({ producer: 'Fixture model A', unknown: 'Fixture model B' });
    const response = { model: 'laya-rl-agent', answers: { candidate: { type: 'choice', choice: 'unknown',
      probabilities: { producer: 0.2, unknown: 0.8 }, confidence: 0.7, action: { act_probability: 0.9 } } },
      usage: { input_tokens: 37, output_tokens: 0 } };
    expect(adapter.compare(input, response)).toMatchObject({ disposition: 'disagree', baselineId: 'producer', proposedId: 'unknown', evidence: 'unverified-response', promotionEligible: false });
    expect(adapter.compare(input, { ...response, answers: { candidate: { ...response.answers.candidate, choice: 'outside' } } }).disposition).toBe('invalid-response');
    expect(adapter.compare(input, { ...response, answers: { candidate: { ...response.answers.candidate, probabilities: { producer: 0.2, unknown: 0.8, outside: 0 } } } }).disposition).toBe('invalid-response');
    expect(() => adapter.prepare({ ...input, options: [{ id: 'producer', description: 'A' }] })).toThrow('laya_shadow_input');
    expect(() => adapter.prepare({ ...input, options: [{ id: 'unknown', description: 'B' }, { id: 'producer', description: 'A' }] })).toThrow('laya_shadow_input');
    expect(f.db.prepare('SELECT count(*) n FROM orchestration_attempt').get()).toEqual({ n: 1 });
    expect(f.db.prepare('SELECT count(*) n FROM integration_budget_reservation').get()).toEqual({ n: 1 });
    expect(f.start).toHaveBeenCalledTimes(1);
  });
  it('uses the compiled Core path and refuses an absent attempt', async () => {
    const f = fixture(false, false, true);
    f.observe.mockImplementation(() => ['producer', 'unknown'].map((id, i) => ({ id, checks,
      estimate: { scope: 'verified-completion-total', quality: 1, expectedCost: i + 1, conservativeMaxCost: i + 1,
        expectedTimeMs: i + 1, conservativeMaxTimeMs: i + 1, currency: 'TEST', source: 'fixture', observedAtMs: 1000 } })));
    await f.engine.start(f.plan, request);
    f.db.close();
    const config = initializeConfig(join(f.root, 'data'), { ledgerPath: f.path, worktreeRoot: f.worktree });
    const core = createCueCore(config);
    try {
      const input = { attemptId: 'attempt', taskSummary: 'local fixture', options: [
        { id: 'producer', description: 'A' }, { id: 'unknown', description: 'B' },
      ] };
      expect(core.prepareLayaShadowSelection(input)).toMatchObject({ status: 'ready', baselineId: 'producer' });
      expect(core.compareLayaShadowSelection(input, { model: 'laya-rl-agent', answers: { candidate: {
        type: 'choice', choice: 'producer', probabilities: { producer: 0.7, unknown: 0.3 }, confidence: 0.5,
        action: { act_probability: 0.9 },
      } }, usage: { input_tokens: 10, output_tokens: 0 } })).toMatchObject({ disposition: 'agree', authority: 'none' });
      expect(() => core.prepareLayaShadowSelection({ ...input, attemptId: 'other' })).toThrow('laya_shadow_unavailable');
      const cohort = core.evaluateLayaShadowCohort({ source: 'offline-fixture', cases: [
        { caseId: 'eval', split: 'evaluation', input, response: { model: 'laya-rl-agent', answers: { candidate: {
          type: 'choice', choice: 'producer', probabilities: { producer: 0.7, unknown: 0.3 }, confidence: 0.5,
          action: { act_probability: 0.9 },
        } }, usage: { input_tokens: 10, output_tokens: 0 } }, labelCandidateId: 'producer' },
        { caseId: 'holdout', split: 'holdout', input: { ...input, attemptId: 'other' }, response: null, labelCandidateId: null },
      ] });
      expect(cohort).toMatchObject({ promotionEligible: false, improvementProven: false,
        splits: { evaluation: { total: 1, agree: 1, labeled: 1, baselineLabelMatch: 1, shadowLabelMatch: 1 },
          holdout: { total: 1, unavailable: 1, unlabeled: 1 } } });
    } finally { await core.close(); }
  });
  it('abstains for a fixed local pair or a single eligible option; never invents options', async () => {
    const local = fixture(true); await local.engine.start(local.plan, request);
    expect(createLayaShadowAdapter(local.db).prepare({ attemptId: 'attempt', taskSummary: 'fixture', options: [] })).toMatchObject({ status: 'unavailable', reason: 'fixed-pair-or-pinned', request: null });
    const monetary = fixture(); await monetary.engine.start(monetary.plan, request);
    const adapter = createLayaShadowAdapter(monetary.db);
    expect(adapter.prepare({ attemptId: 'attempt', taskSummary: 'fixture', options: [] })).toMatchObject({ status: 'unavailable', reason: 'insufficient-options', request: null });
    expect(adapter.compare({ attemptId: 'attempt', taskSummary: 'fixture', options: [] }, {})).toMatchObject({ disposition: 'unavailable', proposedId: null });
    let accessed = false;
    expect(() => adapter.prepare({ attemptId: 'attempt', taskSummary: 'fixture', get options() { accessed = true; return []; } } as any)).toThrow('laya_shadow_input');
    expect(accessed).toBe(false);
  });
});

describe('immutable attempt selection history', () => {
  it.each([false, true])('persists choice, excludes private sources, replays without observation/reservation/launch and reopens (local=%s)', async local => {
    const f = fixture(local); const first = await f.engine.start(f.plan, request);
    const store = createAttemptDecisionStore(f.db), saved = store.read('attempt');
    expect(saved.availability).toBe('recorded'); expect(saved.snapshot?.decision).toEqual(first.selection); expect(Object.isFrozen(saved.snapshot?.decision)).toBe(true);
    const payload = (f.db.prepare('SELECT payload FROM attempt_selection').get() as any).payload;
    expect(payload).not.toContain('PRIVATE_'); expect(payload).not.toContain('expectedCost');
    if (!local) expect((first.selection as any).assessments.find((x: any) => x.id === 'unknown').exclusions).toContain('unknown-estimate');
    const reserve = f.reserve.mockClear().mockImplementation(() => { throw Error('must-not-reserve'); });
    const again = await f.engine.start(f.plan, request); expect(again.selection).toEqual(first.selection); expect(again.launch).toBe('not-relaunched'); expect(reserve).not.toHaveBeenCalled(); expect(f.start).toHaveBeenCalledTimes(1);
    expect(local ? f.host.observeCandidate : f.observe).toHaveBeenCalledTimes(1);
    f.db.close(); const reopened = openLedger(f.path); dbs.push(reopened); expect(createAttemptDecisionStore(reopened).read('attempt')).toEqual(saved);
  });
  it('rolls back claim, reservation and journal on snapshot insertion or stage preparation failure', async () => {
    for (const stage of [false, true]) {
      const f = fixture(); f.truth.prepareFail = stage;
      if (!stage) f.db.exec("CREATE TRIGGER fixture_reject BEFORE INSERT ON attempt_selection BEGIN SELECT RAISE(ABORT,'fixture-rejected'); END");
      await expect(f.engine.start(f.plan, request)).rejects.toThrow();
      for (const table of ['orchestration_attempt', 'integration_budget_reservation', 'orchestration_activity', 'attempt_selection']) expect(f.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
      expect(f.start).not.toHaveBeenCalled();
    }
  });
  it('does not persist invented decisions for unavailable candidates or infer cleanup from a recorded choice', async () => {
    const f = fixture(); f.truth.deny = true; await expect(f.engine.start(f.plan, request)).rejects.toThrow('engine_selection_no-eligible-candidate');
    expect(f.db.prepare('SELECT count(*) n FROM attempt_selection').get()).toEqual({ n: 0 });
    f.truth.deny = false; const handle = await f.engine.start(f.plan, request); expect(await handle.reconcile()).toBeNull();
    expect(f.db.prepare('SELECT state,cleanup_verified FROM orchestration_attempt').get()).toEqual({ state: 'running', cleanup_verified: 0 });
  });
  it('upgrades a real pre025 ledger once and never adds new missing records to legacy membership', async () => {
    const f = fixture(false, true);
    const oldRequest = { ...request, attemptId: 'old' };
    f.db.transaction(() => {
      const claim = JSON.stringify({ attemptId: 'old', candidateId: 'producer', observedAtMs: 1000, runId: 'run', taskId: 'make' });
      f.db.prepare("INSERT INTO orchestration_attempt VALUES('old','run','make','producer','running',?,'C:/fixture',NULL,0)").run(claim);
      f.db.prepare("UPDATE orchestration_step SET state='running' WHERE run_id='run' AND task_id='make'").run();
      (f.budget as ReturnType<typeof createBudgetManager>).reserve({ ...f.terms, attemptId: 'old', unit: 'micro', scope: 'verified-completion-attempt-total' });
      f.db.prepare("INSERT INTO orchestration_activity VALUES('engine-request/old','old',1,?)").run(JSON.stringify({ runId: 'run', taskId: 'make', attemptId: 'old', eventId: 'engine-request/old', ordinal: 1, kind: 'progress', detail: JSON.stringify(oldRequest), observedAtMs: 1000 }));
    })();
    migrate(f.db); expect(createAttemptDecisionStore(f.db).read('old')).toEqual({ availability: 'legacy-not-recorded', snapshot: null });
    expect(await f.engine.start(f.plan, oldRequest)).toMatchObject({ selection: null, selectionAvailability: 'legacy-not-recorded', launch: 'not-relaunched' });
    expect(f.observe).not.toHaveBeenCalled(); expect(f.start).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled();
    // A new run permits a separate ordinary claim without inventing retry authority.
    f.db.exec("INSERT INTO task VALUES('parent2','running',NULL,'now'); INSERT INTO run VALUES('run2','parent2','env',0,'now')");
    f.store.install('run2', f.plan); f.store.claim({ runId: 'run2', taskId: 'make', attemptId: 'new', candidateId: 'producer', observedAtMs: 1000 });
    f.db.close(); const db = openLedger(f.path); dbs.push(db);
    expect(() => createAttemptDecisionStore(db).read('new')).toThrow('snapshot-missing');
    expect(db.prepare('SELECT attempt_id FROM attempt_selection_legacy').all()).toEqual([{ attempt_id: 'old' }]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    for (const sql of ["INSERT OR REPLACE INTO attempt_selection_migration VALUES(1,'cue-attempt-selection-v1')", "INSERT INTO attempt_selection_migration VALUES(1,'cue-attempt-selection-v1') ON CONFLICT DO NOTHING", "DELETE FROM attempt_selection_migration", "INSERT OR REPLACE INTO attempt_selection_legacy VALUES('old')", "INSERT INTO attempt_selection_legacy VALUES('old') ON CONFLICT DO UPDATE SET attempt_id='old'", "DELETE FROM attempt_selection_legacy"]) expect(() => db.exec(sql)).toThrow();
  });
  it('rejects SQL replacement, inconsistent replay and tampered or newly missing snapshots after reopen', async () => {
    const f = fixture(); const first = await f.engine.start(f.plan, request); const store = createAttemptDecisionStore(f.db);
    expect(() => store.record({ attemptId: 'attempt', selectedAtMs: 1000, decision: first.selection! })).toThrow('claim-transaction-required');
    expect(f.db.transaction(() => store.record({ attemptId: 'attempt', selectedAtMs: 1000, decision: first.selection! }))().digest).toBe(store.read('attempt').snapshot?.digest);
    expect(() => f.db.transaction(() => store.record({ attemptId: 'attempt', selectedAtMs: 1001, decision: first.selection! }))()).toThrow('conflict');
    for (const sql of ['INSERT OR REPLACE INTO attempt_selection SELECT * FROM attempt_selection', 'DELETE FROM attempt_selection', "UPDATE attempt_selection SET digest='" + 'a'.repeat(64) + "'"]) expect(() => f.db.exec(sql)).toThrow();
    f.db.exec("DROP TRIGGER attempt_selection_update; UPDATE attempt_selection SET digest='" + 'a'.repeat(64) + "'");
    expect(() => store.read('attempt')).toThrow('integrity');
    f.db.exec('DROP TRIGGER attempt_selection_delete; DELETE FROM attempt_selection'); f.db.close();
    const db = openLedger(f.path); dbs.push(db); expect(() => createAttemptDecisionStore(db).read('attempt')).toThrow('snapshot-missing');
  });
  it.each(['changed-digest', 'cross-attempt', 'raw-detail'])('rejects hostile typed request journal mutation: %s', async mutation => {
    const f = fixture(); await f.engine.start(f.plan, request);
    const row = f.db.prepare("SELECT payload FROM orchestration_activity WHERE event_id='engine-request-attempt'").get() as { payload: string };
    const event = JSON.parse(row.payload);
    if (mutation === 'changed-digest') event.data.summary = 'a'.repeat(64);
    if (mutation === 'cross-attempt') event.attemptId = 'another-attempt';
    if (mutation === 'raw-detail') { delete event.data; event.detail = JSON.stringify(request); }
    f.db.exec('DROP TRIGGER orchestration_activity_no_update');
    f.db.prepare("UPDATE orchestration_activity SET payload=? WHERE event_id='engine-request-attempt'").run(JSON.stringify(event));
    expect(() => createAttemptDecisionStore(f.db).read('attempt')).toThrow(/attempt_selection_(request|integrity)/);
  });
  it('rejects unbounded, accessor, extra-field and inconsistent public output snapshots', async () => {
    const f = fixture(); const first = await f.engine.start(f.plan, request); const d = first.selection as any;
    expect(() => snapshotSelectionDecision({ ...d, rawPrompt: 'private' })).toThrow();
    expect(() => snapshotSelectionDecision({ ...d, assessments: [{ ...d.assessments[0], score: Infinity }] })).toThrow();
    let read = false; const malicious = { ...d, get assessments() { read = true; return []; } };
    expect(() => snapshotSelectionDecision(malicious)).toThrow(); expect(read).toBe(false);
    expect(() => snapshotLocalSelectionDecision({ selected: true, candidateId: 'producer', reasons: ['unknown'], authority: 'none', ranking: 'not-performed' })).toThrow();
  });
});
