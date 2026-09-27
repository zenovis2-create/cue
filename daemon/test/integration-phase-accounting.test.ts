import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createBudgetManager, type BudgetReceipt } from '../src/budget.js';
import { createHandoffAccountingStore, type PhaseCostPartition } from '../src/evaluation/handoff-accounting.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';

const dbs: Ledger[] = [];
afterEach(() => { for (const db of dbs.splice(0)) if (db.open) db.close(); });
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

function fixture() {
  const db = openLedger(); dbs.push(db);
  db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES('env','C:/fixture','[]','now')").run();
  db.prepare("INSERT INTO run VALUES('run','root','env',0,'now')").run();
  const approval = { policyRevision: 'p1', policyDigest: 'a'.repeat(64), requirementIds: ['r'], allowedCandidateIds: ['candidate'], allowedScopeIds: [] };
  const plan = validateTaskPlan(approval, { revision: 'one', policyRevision: 'p1', policyDigest: approval.policyDigest, tasks: [
    { id: 'make', role: 'implementation', ownerId: 'maker', requirementIds: ['r'], dependencyIds: [], candidateIds: ['candidate'], scopeIds: [] },
    { id: 'check', role: 'verifier', ownerId: 'checker', requirementIds: ['r'], dependencyIds: ['make'], candidateIds: ['candidate'], scopeIds: [] },
  ] });
  db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run('run', 'env', plan.digest, JSON.stringify(plan));
  for (const task of plan.tasks) db.prepare("INSERT INTO orchestration_step VALUES(?,?,'completed')").run('run', task.id);
  const sorted = (value: object) => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
  const contract = sorted({ runId: 'run', requirementsDigest: 'c'.repeat(64), maxAttemptsPerTask: 3, maxAttemptsTotal: 8, deadlineMs: 100, boundAtMs: 1, schemaVersion: 'cue-retry-v1', envelopeHash: 'env', planDigest: plan.digest, policyDigest: approval.policyDigest });
  const contractDigest = sha(contract);
  db.prepare("INSERT INTO requirement_contract_binding VALUES('run','env',?,?,?,?,?)").run(plan.digest, approval.policyDigest, 'c'.repeat(64), '{}', 'now');
  db.prepare('INSERT INTO orchestration_retry_contract VALUES(?,?,?)').run('run', contract, contractDigest);
  for (const [attemptId, taskId] of [['base', 'make'], ['prior', 'make'], ['retry', 'make'], ['verify', 'check']] as const)
    db.prepare("INSERT INTO orchestration_attempt VALUES(?,?,?,?,?,'{}','C:/fixture',NULL,1)").run(attemptId, 'run', taskId, 'candidate', 'completed');
  db.prepare("INSERT INTO orchestration_receipt VALUES('prior-receipt','prior',1,?)").run(JSON.stringify({ runId: 'run', taskId: 'make', attemptId: 'prior', receiptId: 'prior-receipt', revision: 1, outcome: 'failed', cleanup: 'clean', evidenceRef: 'test', observedAtMs: 2 }));
  db.prepare("INSERT INTO orchestration_retry_link VALUES('retry','prior','prior-receipt',?,?)").run(contractDigest, sorted({ request: { previousAttemptId: 'prior', receiptId: 'prior-receipt', contractDigest }, reason: { cause: 'transient', sourceRef: 'test', sourceDigest: 'd'.repeat(64), observedAtMs: 3 } }));
  const budget = createBudgetManager(db, { verifyFinalReceipt: () => true });
  budget.initialize({ runId: 'run', currency: 'USD', unit: 'minor', limitUnits: 1000, policyRevision: 'p1', source: 'test', observedAtMs: 1 });
  const evidence = Buffer.from('source-bound-provider-partition');
  const receipt = (requestId: string, units: number): BudgetReceipt => ({ runId: 'run', requestId, receiptId: `billing-${requestId}`, revision: 1, currency: 'USD', unit: 'minor', kind: 'actual', units, providerFinal: true, source: 'provider-export:test', observedAtMs: 5 });
  const add = (requestId: string, attemptId: string, taskId: string, units: number, outcome: 'succeeded' | 'failed') => {
    budget.reserve({ runId: 'run', requestId, attemptId, currency: 'USD', unit: 'minor', upperUnits: units + 10, source: 'host-upper', observedAtMs: 2, scope: 'verified-completion-attempt-total' });
    budget.observe(receipt(requestId, units));
    const artifact = { kind: 'output', sourceRef: `output-${attemptId}`, sha256: sha(`output-${attemptId}`), byteLength: 1 };
    const payload = JSON.stringify({ schemaVersion: 'cue-handoff-v1', handoffId: `handoff-${attemptId}`, attemptId, receiptId: `terminal-${attemptId}`, receiptRevision: 1, identityId: `identity-${attemptId}`, outcome, cleanup: 'clean', artifacts: [artifact] });
    db.pragma('foreign_keys=OFF');
    const launchPayload = JSON.stringify({ attemptId });
    db.prepare('INSERT INTO orchestration_launch_intent VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(attemptId, 'run', taskId, 'candidate', sha(`selection-${attemptId}`), sha(`subject-${attemptId}`), 'tool', 'v1', null, null, sha('parent'), sha(`stage-${attemptId}`), plan.digest, approval.policyDigest, sha(launchPayload), Buffer.from(launchPayload));
    db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(attemptId, 123, 'now', 'C:/fixture', 'root', attemptId);
    const identityPayload = JSON.stringify({ identityId: `identity-${attemptId}`, attemptId, subjectDigest: sha(`subject-${attemptId}`), durableRef: `session:${attemptId}`, observedAtMs: 1 });
    db.prepare('INSERT INTO orchestration_attempt_identity VALUES(?,?,?,?,?,?,?)').run(`identity-${attemptId}`, attemptId, sha(`subject-${attemptId}`), `session:${attemptId}`, 1, sha(identityPayload), Buffer.from(identityPayload));
    db.prepare('INSERT INTO orchestration_receipt VALUES(?,?,1,?)').run(`terminal-${attemptId}`, attemptId, JSON.stringify({ runId: 'run', taskId, attemptId, receiptId: `terminal-${attemptId}`, revision: 1, outcome, cleanup: 'clean', evidenceRef: 'host-proof', observedAtMs: 5 }));
    db.prepare('INSERT INTO orchestration_handoff VALUES(?,?,?,?,?,?,?,?,?)').run(`handoff-${attemptId}`, attemptId, `terminal-${attemptId}`, 1, `identity-${attemptId}`, outcome, 'clean', sha(payload), Buffer.from(payload));
    db.prepare('INSERT INTO orchestration_handoff_artifact VALUES(?,?,?,?,?,?,?)').run(`handoff-${attemptId}`, 0, attemptId, artifact.kind, artifact.sourceRef, artifact.sha256, artifact.byteLength);
    db.pragma('foreign_keys=ON');
  };
  add('base-request', 'base', 'make', 40, 'succeeded');
  add('retry-request', 'retry', 'make', 50, 'failed');
  add('verify-request', 'verify', 'check', 10, 'succeeded');
  budget.reserve({ runId: 'run', requestId: 'unknown-request', attemptId: 'prior', currency: 'USD', unit: 'minor', upperUnits: 80, source: 'host-upper', observedAtMs: 2, scope: 'verified-completion-attempt-total' });
  return { db, budget, evidence };
}

test('records source-bound base, retry, verification and handoff cost without releasing unknown obligations', () => {
  const f = fixture(), store = createHandoffAccountingStore(f.db), evidenceDigest = sha(f.evidence);
  const record = (requestId: string, attemptId: string, partition: Omit<PhaseCostPartition, 'version' | 'evidenceRef' | 'evidenceDigest' | 'observedAtMs'>) => f.db.transaction(() => store.recordAttempt({
    runId: 'run', requestId, attemptId,
    partition: { version: 'cue-phase-cost-partition-v1', ...partition, evidenceRef: 'provider-export:test', evidenceDigest, observedAtMs: 5 },
    resolveEvidence: ref => ref === 'provider-export:test' ? f.evidence : null,
  }))();
  record('base-request', 'base', { totalUnits: 40, baseUnits: 35, retryUnits: 0, verificationUnits: 0, handoffUnits: 5 });
  record('retry-request', 'retry', { totalUnits: 50, baseUnits: 0, retryUnits: 43, verificationUnits: 0, handoffUnits: 7 });
  record('verify-request', 'verify', { totalUnits: 10, baseUnits: 0, retryUnits: 0, verificationUnits: 8, handoffUnits: 2 });
  expect(f.db.prepare('SELECT request_id,total_units,base_units,retry_units,verification_units,handoff_units FROM handoff_cost_attribution ORDER BY request_id').all()).toEqual([
    { request_id: 'base-request', total_units: 40, base_units: 35, retry_units: 0, verification_units: 0, handoff_units: 5 },
    { request_id: 'retry-request', total_units: 50, base_units: 0, retry_units: 43, verification_units: 0, handoff_units: 7 },
    { request_id: 'verify-request', total_units: 10, base_units: 0, retry_units: 0, verification_units: 8, handoff_units: 2 },
  ]);
  expect(f.budget.summary('run')).toMatchObject({ committedUnits: 180n, actualUnits: 100n, remainingUnits: 820n });
});

test('rejects invented partitions atomically and leaves the reservation committed', () => {
  const f = fixture(), store = createHandoffAccountingStore(f.db);
  expect(() => f.db.transaction(() => store.recordAttempt({ runId: 'run', requestId: 'base-request', attemptId: 'base', partition: {
    version: 'cue-phase-cost-partition-v1', totalUnits: 39, baseUnits: 34, retryUnits: 0, verificationUnits: 0, handoffUnits: 5,
    evidenceRef: 'provider-export:test', evidenceDigest: sha(f.evidence), observedAtMs: 5,
  }, resolveEvidence: () => f.evidence }))()).toThrow(/handoff_accounting_billing/);
  expect(f.db.prepare('SELECT count(*) n FROM handoff_cost_attribution').get()).toEqual({ n: 0 });
  expect(f.budget.summary('run').committedUnits).toBe(180n);
});
