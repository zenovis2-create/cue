import { afterEach, expect, test } from 'vitest';
import { openLedger, type Ledger } from '../src/ledger.js';
import { saveLocalSelectionPolicy, bindRunLocalSelectionPolicy } from '../src/selection/local-policy-store.js';
import { createLocalInvocationBudget } from '../src/local-invocation-budget.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { readOrchestrationSnapshot } from '../src/ui/orchestration.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const dbs: Ledger[] = [];
afterEach(() => { for (const db of dbs.splice(0)) db.close(); });
function fixture(bind = true) {
  const db = openLedger(); dbs.push(db);
  db.exec("INSERT INTO task VALUES('root','running',NULL,'now'); INSERT INTO envelope VALUES('env','fixture','[]','now'); INSERT INTO run VALUES('run','root','env',0,'now')");
  const policy = saveLocalSelectionPolicy(db, { policyId: 'local', expectedRevision: null, createdAt: '2026-09-11T00:00:00.000Z', sourceVersion: 'test',
    policy: { version: 'cue-local-selection-v1', mode: 'value', producerCandidateId: 'producer', checkerCandidateId: 'checker', limitAttempts: 2, timeoutMs: 10000 } });
  if (bind) bindRunLocalSelectionPolicy(db, { runId: 'run', policyId: policy.policyId, revision: policy.revision, digest: policy.digest, boundAt: '2026-09-11T00:00:00.000Z' });
  const approval = { policyRevision: 'local:1', policyDigest: policy.digest, requirementIds: ['r'], allowedCandidateIds: ['producer', 'checker'], allowedScopeIds: [] };
  const plan = validateTaskPlan(approval, { revision: 'one', policyRevision: approval.policyRevision, policyDigest: policy.digest, tasks: [
    { id: 'produce', role: 'model-producer', ownerId: 'maker', requirementIds: ['r'], dependencyIds: [], candidateIds: ['producer'], scopeIds: [] },
    { id: 'verify', role: 'verifier', ownerId: 'checker', requirementIds: ['r'], dependencyIds: ['produce'], candidateIds: ['checker'], scopeIds: [] },
  ] });
  const store = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true, verifyReceipt: () => ({ outcomeVerified: true, cleanupVerified: false }) });
  store.install('run', plan);
  const counts = createLocalInvocationBudget(db);
  counts.initialize({ runId: 'run', limit: 2, policyRevision: 'local:1', source: 'private-source-not-for-ui', observedAtMs: 1000 });
  return { db, counts, store };
}

test('count projection is distinct from money and does not imply cleanup or acceptance', () => {
  const { db, counts, store } = fixture();
  db.transaction(() => {
    store.claim({ runId: 'run', taskId: 'produce', attemptId: 'attempt', candidateId: 'producer', observedAtMs: 1001 });
    counts.reserve({ runId: 'run', taskId: 'produce', attemptId: 'attempt', requestId: 'request', candidateId: 'producer', kind: 'producer', observedAtMs: 1001 });
  }).immediate();
  const before = db.prepare('SELECT total_changes() n').get();
  const result = readOrchestrationSnapshot(db, 'run')!;
  expect(result.policy).toMatchObject({ mode: 'value', revision: 1 });
  expect(result.localAccounting).toEqual({ kind: 'local-invocation', status: 'recorded', limit: 2, committed: 1, remaining: 1,
    semantics: 'committed-dispatch-intent', providerBilling: 'not-measured' });
  expect(result.budget).toMatchObject({ status: 'unknown', currency: null, actualUnits: null, costStatus: 'unknown' });
  expect(result.stages.find(s => s.taskId === 'produce')?.cleanup).toBe('unknown');
  expect(result.acceptance).toBe('unverified');
  expect(JSON.stringify(result)).not.toContain('private-source');
  expect(Object.isFrozen(result.localAccounting)).toBe(true);
  expect(db.prepare('SELECT total_changes() n').get()).toEqual(before);
});

test('unbound local counts stay unknown rather than displaying a guessed balance', () => {
  const { db } = fixture(false);
  expect(readOrchestrationSnapshot(db, 'run')!.localAccounting).toMatchObject({ status: 'unknown', limit: null, committed: null, remaining: null });
});

test('absent local accounting does not add new properties to legacy projection', () => {
  const db = openLedger(); dbs.push(db);
  expect(readOrchestrationSnapshot(db, 'missing')).toBeNull();
  db.exec("INSERT INTO task VALUES('root','running',NULL,'now'); INSERT INTO envelope VALUES('env','fixture','[]','now'); INSERT INTO run VALUES('run','root','env',0,'now'); INSERT INTO orchestration_plan VALUES('run','env','digest','{}')");
  expect(readOrchestrationSnapshot(db, 'run')).not.toHaveProperty('localAccounting');
});

test('actual renderer distinguishes count approval and observation from monetary cost', () => {
  const { db } = fixture();
  const dom = new JSDOM(readFileSync(resolve('../app/renderer/index.html'), 'utf8'), { runScripts: 'outside-only' });
  try {
    dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'), 'utf8'));
    Object.assign(dom.window, { localSnapshot: readOrchestrationSnapshot(db, 'run'), localPlan: {
      accountingKind: 'local-invocation', mode: 'value', policyRevision: 'local:1', limitInvocations: 2, timeoutMs: 10000,
      stageCount: 2, planDigest: 'a'.repeat(64), stages: [], requirements: [], requirementsDigest: null,
    } });
    dom.window.eval('renderApprovalPlan(localPlan); renderOrchestration(localSnapshot)');
    const approval = dom.window.document.querySelector('#approval-plan-summary')!.textContent!;
    expect(approval).toContain('실행 지시 상한 2회');
    expect(approval).toContain('모드별 성능 차이 미검증');
    expect(approval).not.toMatch(/undefined|USD|micro/);
    const count = dom.window.document.querySelector('#orchestration-budget')!.textContent!;
    expect(count).toContain('실행 지시 0/2회');
    expect(count).toContain('금전 비용 미측정');
    dom.window.eval("localSnapshot = {...localSnapshot, localAccounting:{kind:'local-invocation',status:'unknown'}}; renderOrchestration(localSnapshot)");
    expect(dom.window.document.querySelector('#orchestration-budget')!.textContent).toBe('실행 지시 횟수 미확인 · 금전 비용 미측정');
  } finally { dom.window.close(); }
});
