import { afterEach, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { openLedger, type Ledger } from '../src/ledger.js';
import { readOrchestrationSnapshot } from '../src/ui/orchestration.js';
import { createBudgetManager } from '../src/budget.js';
import { applyOrchestrationRetryMigration } from '../src/orchestration/retry-migration.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
const handles: Ledger[] = [];
afterEach(() => { handles.splice(0).forEach(db => db.close()); });
function fixture(includeVerifier = false, includeAttempt = true, role = 'implementation') {
  const db = openLedger(); handles.push(db);
  db.prepare("INSERT INTO task VALUES('task','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES('envelope','C:/private/host-secret','[]','now')").run();
  db.prepare("INSERT INTO run VALUES('run','task','envelope',0,'now')").run();
  db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run('run', 'envelope', 'a'.repeat(64), JSON.stringify({ revision: 'plan1', tasks: [{ id: 'impl', role }, ...(includeVerifier ? [{ id: 'verifier', role: 'verifier' }] : [])], token: 'secret-payload' }));
  if (includeVerifier) db.prepare("INSERT INTO orchestration_step VALUES('run','verifier','pending')").run();
  db.prepare("INSERT INTO orchestration_step VALUES('run','impl','completed')").run();
  if (includeAttempt) db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','run','impl','candidate','completed',?,'C:/private/host-secret',NULL,1)").run(JSON.stringify({ model: 'invented', token: 'secret-payload' }));
  return db;
}
test('legacy run without a plan returns null; completed execution is still unverified acceptance', () => {
  const db = fixture();
  expect(readOrchestrationSnapshot(db, 'missing')).toBeNull();
  const snapshot = readOrchestrationSnapshot(db, 'run')!;
  expect(snapshot).toMatchObject({ policy: null, acceptance: 'unverified', budget: { status: 'unknown', actualUnits: null, remainingUnits: null } });
  expect(snapshot.stages[0]).toMatchObject({ state: 'blocked', candidateId: 'candidate', modelId: null, toolId: null, cleanup: 'unknown', acceptance: 'unverified' });
  const json = JSON.stringify(snapshot);
  expect(json).not.toContain('secret'); expect(json).not.toContain('invented'); expect(json).not.toContain('C:/');
  expect(Object.isFrozen(snapshot.stages[0])).toBe(true);
});
test('model output producer role is projected and displayed without granting acceptance', () => {
  const snapshot = readOrchestrationSnapshot(fixture(false, true, 'model-producer'), 'run')!;
  expect(snapshot.stages[0]).toMatchObject({ role: 'model-producer', acceptance: 'unverified' });
  const dom = new JSDOM(readFileSync(resolve('../app/renderer/index.html'), 'utf8'), { runScripts: 'outside-only' });
  try {
    dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'), 'utf8'));
    dom.window.eval(`renderCard(${JSON.stringify({ state: 'completed', status: 'completed', stage: 'fixture', orchestration: snapshot })})`);
    expect(dom.window.document.querySelector('#orchestration-stages')!.textContent).toContain('모델 출력 생성');
    expect(dom.window.document.querySelector('#state-title')!.textContent).toBe('실행 완료 · 인수 미확인');
  } finally { dom.window.close(); }
});
test('policy is loaded from the immutable run binding, not plan metadata', () => {
  const db = fixture();
  const saved = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: '2026-09-11T00:00:00.000Z', sourceVersion: 'fixture',
    policy: { version: 'cue-selection-v1', mode: 'value', qualityMinimum: 0.8, costBasis: 1, timeBasisMs: 100,
      currency: 'USD', costLimit: null, remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['candidate'], pinnedCandidateId: null } });
  bindRunSelectionPolicy(db, { runId: 'run', policyId: saved.policyId, revision: saved.revision, digest: saved.digest, boundAt: '2026-09-11T00:00:00.000Z' });
  expect(readOrchestrationSnapshot(db, 'run')!.policy).toEqual({ mode: 'value', revision: saved.revision, digest: saved.digest });
});
test('budget serializes exact units and preserves unknown final billing until actual final receipt', () => {
  const db = fixture(); const manager = createBudgetManager(db, { verifyFinalReceipt: () => true });
  manager.initialize({ runId: 'run', currency: 'USD', unit: 'micro', limitUnits: 100, policyRevision: 'p1', source: 'host', observedAtMs: 1 });
  manager.reserve({ runId: 'run', requestId: 'request', attemptId: 'attempt', currency: 'USD', unit: 'micro', upperUnits: 80, source: 'host', observedAtMs: 2, scope: 'verified-completion-attempt-total' });
  expect(readOrchestrationSnapshot(db, 'run')!.budget).toMatchObject({ remainingUnits: '20', debtUnits: '0', actualUnits: null, costStatus: 'unknown' });
  manager.observe({ runId: 'run', requestId: 'request', receiptId: 'receipt', revision: 1, currency: 'USD', unit: 'micro', kind: 'actual', units: 120, providerFinal: true, source: 'host', observedAtMs: 3 });
  const snapshot = readOrchestrationSnapshot(db, 'run')!;
  expect(snapshot.budget).toMatchObject({ remainingUnits: '0', debtUnits: '20', actualUnits: null, costStatus: 'unknown' });
  expect(() => JSON.stringify(snapshot)).not.toThrow();
  db.prepare("UPDATE orchestration_attempt SET cleanup_verified=0 WHERE attempt_id='attempt'").run();
  expect(readOrchestrationSnapshot(db, 'run')!.budget.costStatus).toBe('unknown');
});
test('final receipt cannot finalize cost while any planned verifier is pending or cleanup is unknown', () => {
  const db = fixture(true);
  const manager = createBudgetManager(db, { verifyFinalReceipt: () => true });
  manager.initialize({ runId: 'run', currency: 'USD', unit: 'micro', limitUnits: 100, policyRevision: 'p1', source: 'host', observedAtMs: 1 });
  manager.reserve({ runId: 'run', requestId: 'request', attemptId: 'attempt', currency: 'USD', unit: 'micro', upperUnits: 50, source: 'host', observedAtMs: 2, scope: 'verified-completion-attempt-total' });
  manager.observe({ runId: 'run', requestId: 'request', receiptId: 'receipt', revision: 1, currency: 'USD', unit: 'micro', kind: 'actual', units: 20, providerFinal: true, source: 'host', observedAtMs: 3 });
  db.prepare("UPDATE orchestration_attempt SET cleanup_verified=0 WHERE attempt_id='attempt'").run();
  expect(readOrchestrationSnapshot(db, 'run')!.budget).toMatchObject({ costStatus: 'unknown', actualUnits: null });
  db.prepare("UPDATE orchestration_attempt SET cleanup_verified=1 WHERE attempt_id='attempt'").run();
  expect(readOrchestrationSnapshot(db, 'run')!.budget).toMatchObject({ costStatus: 'unknown', actualUnits: null });
});
test('unattached reservations and zero attempts never imply final run billing', () => {
  for (const includeAttempt of [true, false]) {
    const db = fixture(false, includeAttempt);
    const manager = createBudgetManager(db, { verifyFinalReceipt: () => true });
    manager.initialize({ runId: 'run', currency: 'USD', unit: 'micro', limitUnits: 100, policyRevision: 'p1', source: 'host', observedAtMs: 1 });
    manager.reserve({ runId: 'run', requestId: 'request', attemptId: 'unattached', currency: 'USD', unit: 'micro', upperUnits: 50, source: 'host', observedAtMs: 2, scope: 'verified-completion-attempt-total' });
    manager.observe({ runId: 'run', requestId: 'request', receiptId: 'receipt', revision: 1, currency: 'USD', unit: 'micro', kind: 'actual', units: 20, providerFinal: true, source: 'host', observedAtMs: 3 });
    expect(readOrchestrationSnapshot(db, 'run')!.budget).toMatchObject({ costStatus: 'unknown', actualUnits: null });
    expect(db.prepare('SELECT COUNT(*) n FROM orchestration_attempt').get()).toEqual({ n: includeAttempt ? 1 : 0 });
  }
});
test('activity and stages are bounded; payload details and extra secret fields are not projected', () => {
  const db = fixture();
  for (let n = 0; n < 260; n++) db.prepare("INSERT INTO orchestration_step VALUES('run',?,'pending')").run(`task-${n}`);
  for (let n = 0; n < 25; n++) db.prepare('INSERT INTO orchestration_activity VALUES(?,?,?,?)').run(`event-${n}`, 'attempt', n,
    JSON.stringify({ kind: 'tool', observedAtMs: n, detail: 'C:/private/host-secret', token: 'secret-payload' }));
  const snapshot = readOrchestrationSnapshot(db, 'run')!;
  expect(snapshot.stages).toHaveLength(256); expect(snapshot.stagesTruncated).toBe(true);
  expect(snapshot.activity).toHaveLength(20); expect(snapshot.activityTruncated).toBe(true);
  expect(snapshot.activity[0]).toMatchObject({ eventId: 'event-24', ordinal: 24, kind: 'legacy-activity-unavailable', availability: 'legacy-activity-unavailable', data: null });
  expect(JSON.stringify(snapshot)).not.toContain('secret');
});
test('retry history keeps one latest attempt per stage and bills failed historical attempts before final cost', () => {
  const db = fixture(); applyOrchestrationRetryMigration(db);
  // Simulate imported historical rows whose terminal provenance predates handoffs;
  // the read-only projection must not treat these fixture rows as authority.
  db.exec('DROP TRIGGER attempt_terminal_requires_handoff');
  db.exec('DROP TRIGGER attempt_terminal_current_integrity');
  db.prepare("UPDATE orchestration_attempt SET state='failed' WHERE attempt_id='attempt'").run();
  db.prepare("INSERT INTO orchestration_attempt VALUES('retry-attempt','run','impl','replacement','completed','{}','C:/private/host-secret',NULL,1)").run();
  db.prepare("INSERT INTO orchestration_receipt VALUES('failed-receipt','attempt',1,?)").run(JSON.stringify({ outcome: 'failed', cleanup: 'clean' }));
  db.prepare("INSERT INTO orchestration_retry_link VALUES('retry-attempt','attempt','failed-receipt',?,'{}')").run('a'.repeat(64));
  db.prepare("INSERT INTO orchestration_activity VALUES('old-event','attempt',0,?)").run(JSON.stringify({ kind: 'progress', observedAtMs: 1, detail: 'old failure detail secret' }));
  const manager = createBudgetManager(db, { verifyFinalReceipt: () => true });
  manager.initialize({ runId: 'run', currency: 'USD', unit: 'micro', limitUnits: 100, policyRevision: 'p1', source: 'host', observedAtMs: 1 });
  for (const attempt of ['attempt', 'retry-attempt']) manager.reserve({ runId: 'run', requestId: attempt, attemptId: attempt, currency: 'USD', unit: 'micro', upperUnits: 40, source: 'host', observedAtMs: 2, scope: 'verified-completion-attempt-total' });
  manager.observe({ runId: 'run', requestId: 'retry-attempt', receiptId: 'retry-bill', revision: 1, currency: 'USD', unit: 'micro', kind: 'actual', units: 20, providerFinal: true, source: 'host', observedAtMs: 3 });
  let snapshot = readOrchestrationSnapshot(db, 'run')!;
  expect(snapshot.stages).toHaveLength(1);
  expect(snapshot.stages[0]).toMatchObject({ attemptId: 'retry-attempt', candidateId: 'replacement', attemptCount: 2, failedAttemptCount: 1 });
  expect(snapshot.attemptHistory.map(attempt => attempt.state)).toEqual(['blocked', 'blocked']);
  expect(snapshot.activity[0]).toMatchObject({ attemptId: 'attempt', kind: 'legacy-activity-unavailable' });
  expect(snapshot.budget.costStatus).toBe('unknown');
  manager.observe({ runId: 'run', requestId: 'attempt', receiptId: 'old-bill', revision: 1, currency: 'USD', unit: 'micro', kind: 'actual', units: 30, providerFinal: true, source: 'host', observedAtMs: 4 });
  snapshot = readOrchestrationSnapshot(db, 'run')!;
  expect(snapshot.budget).toMatchObject({ actualUnits: null, remainingUnits: '50', costStatus: 'unknown' });
  db.prepare("UPDATE orchestration_attempt SET cleanup_verified=0 WHERE attempt_id='attempt'").run();
  expect(readOrchestrationSnapshot(db, 'run')!.budget.costStatus).toBe('unknown');
  expect(JSON.stringify(snapshot)).not.toContain('secret');
});
test('large attempt history is bounded without losing total and failed counts', () => {
  const db = fixture(); applyOrchestrationRetryMigration(db);
  for (let n = 0; n < 55; n++) db.prepare("INSERT INTO orchestration_attempt VALUES(?,'run','impl','candidate','failed','{}','C:/private/host-secret',NULL,1)").run(`old-${n}`);
  const snapshot = readOrchestrationSnapshot(db, 'run')!;
  expect(snapshot.stages).toHaveLength(1);
  expect(snapshot.attemptHistory).toHaveLength(50);
  expect(snapshot.attemptCount).toBe(56); expect(snapshot.attemptHistoryTruncated).toBe(true);
  expect(snapshot.stages[0]).toMatchObject({ attemptCount: 56, failedAttemptCount: 55 });
});
test('renderer hides legacy observations and uses text nodes while preserving stop controls', () => {
  const db = fixture();
  const dom = new JSDOM(readFileSync(resolve('../app/renderer/index.html'), 'utf8'), { runScripts: 'outside-only' });
  try {
    dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'), 'utf8'));
    const card = { state: 'running', status: 'running', stage: 'fixture', approvalSummary: '', autonomySummary: '', orchestration: readOrchestrationSnapshot(db, 'run') };
    dom.window.eval(`renderCard(${JSON.stringify(card)})`);
    expect(dom.window.document.querySelector<HTMLElement>('#orchestration')!.hidden).toBe(false);
    expect(dom.window.document.querySelector('#orchestration-acceptance')!.textContent).toContain('미확인');
    expect(dom.window.document.querySelector<HTMLButtonElement>('#stop')!.disabled).toBe(false);
    expect(dom.window.document.querySelector('#orchestration-stages')!.textContent).toContain('막힘');
    dom.window.eval(`renderCard(${JSON.stringify({ ...card, state: 'completed' })})`);
    expect(dom.window.document.querySelector('#state-title')!.textContent).toBe('실행 완료 · 인수 미확인');
    const historicalCard = { ...card, state: 'completed', orchestration: { ...card.orchestration,
      acceptance: 'verified', acceptanceRecord: { acceptedAt: 1000, evaluationId: 'evaluation' },
      requirementEvaluation: { id: 'evaluation', verdict: 'pass', outcomes: [{ requirementId: '<img src=x>', required: true, verdict: 'pass' }, { requirementId: 'optional', required: false, verdict: 'unknown' }] } } };
    dom.window.eval(`renderCard(${JSON.stringify(historicalCard)})`);
    expect(dom.window.document.querySelector('#state-title')!.textContent).toBe('완료 · 인수 기록 확인');
    expect(dom.window.document.querySelector('#orchestration-acceptance')!.textContent).toContain('현재 파일을 다시 검사한 결과는 아닙니다');
    expect(dom.window.document.querySelector('#orchestration-requirements')!.textContent).toContain('<img src=x> · 필수 · 통과');
    expect(dom.window.document.querySelector('#orchestration-requirements img')).toBeNull();
    dom.window.eval(`renderCard(${JSON.stringify({ ...historicalCard, orchestration: { ...historicalCard.orchestration, acceptance: 'unverified', acceptanceRecord: null } })})`);
    expect(dom.window.document.querySelector('#state-title')!.textContent).toBe('실행 완료 · 인수 미확인');
    expect(dom.window.document.querySelector('#orchestration-acceptance')!.textContent).toContain('최근 검사 통과 (인수 확정 아님)');
    for (const [verdict, label] of [['fail', '실패'], ['unknown', '미확인']]) {
      const pendingEvaluation = { ...historicalCard, orchestration: { ...historicalCard.orchestration,
        acceptance: 'verified', acceptanceRecord: null, requirementEvaluation: { id: 'later', verdict,
          outcomes: [{ requirementId: 'req', required: true, verdict }] } } };
      dom.window.eval(`renderCard(${JSON.stringify(pendingEvaluation)})`);
      expect(dom.window.document.querySelector('#state-title')!.textContent).toBe('실행 완료 · 인수 미확인');
      expect(dom.window.document.querySelector('#orchestration-requirements')!.textContent).toContain(`req · 필수 · ${label}`);
    }
    dom.window.eval(`renderCard(${JSON.stringify({ ...card, state: 'completed', orchestration: null })})`);
    expect(dom.window.document.querySelector('#state-title')!.textContent).toBe('완료');
    dom.window.eval(`renderCard(${JSON.stringify({ ...card, orchestration: null })})`);
    expect(dom.window.document.querySelector<HTMLElement>('#orchestration')!.hidden).toBe(true);
  } finally { dom.window.close(); }
});
