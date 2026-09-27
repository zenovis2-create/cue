import { afterEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createBudgetManager } from '../src/budget.js';
import { bindAccountIdentities } from '../src/orchestration/account-binding.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { bindRunSelectionPolicy, saveSelectionPolicy } from '../src/selection/policy-store.js';
import { readOrchestrationSnapshot } from '../src/ui/orchestration.js';
const handles: Ledger[] = [];
afterEach(() => handles.splice(0).forEach(db => db.close()));
function fixture() {
  const db = openLedger(); handles.push(db);
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
  const snapshot = (now = 1020) => readOrchestrationSnapshot(db, 'run', undefined, now)!;
  return { db, manager, snapshot };
}

test('UI consumes actual persisted monetary observation, derives expiry and redacts identity/source', () => {
  const f = fixture();
  const before = f.db.prepare('SELECT total_changes() n').get();
  const current = f.snapshot();
  const cost = current.stages.find(row => row.taskId === 'make')!.costObservation;
  expect(cost).toMatchObject({ status: 'observed', costState: 'estimated', units: 12, currency: 'USD', unit: 'micro', freshness: 'fresh', authority: 'observation-only' });
  expect(current.attemptHistory[0].costObservation).toEqual(cost);
  expect(f.snapshot(1111).stages.find(row => row.taskId === 'make')!.costObservation).toMatchObject({ freshness: 'stale' });
  expect(f.snapshot(1009).stages.find(row => row.taskId === 'make')!.costObservation).toMatchObject({ freshness: 'future' });
  expect(current.stages.find(row => row.taskId === 'check')!.costObservation.status).toBe('unavailable');
  const json = JSON.stringify(cost);
  for (const secret of ['account-opaque', 'provider:fixture', 'provider:usage:v1', 'sourceRef', 'sourceDigest', 'accountRef']) expect(json).not.toContain(secret);
  expect(f.snapshot(-1).stages[0].costObservation.status).toBe('unavailable');
  expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(before);
  expect(current.acceptance).toBe('unverified');
});

test('unknown/actual receipt updates remain descriptive and corrupt source isolates as unavailable', () => {
  const f = fixture();
  f.manager.observe({runId:'run',requestId:'request',receiptId:'unknown',revision:2,currency:'USD',unit:'micro',kind:'unknown',units:null,providerFinal:false,source:'usage:next',observedAtMs:1030});
  expect(f.snapshot(1040).attemptHistory[0].costObservation).toMatchObject({ costState:'unknown', units:null, freshness:'fresh' });
  f.manager.observe({runId:'run',requestId:'request',receiptId:'actual',revision:3,currency:'USD',unit:'micro',kind:'actual',units:9,providerFinal:true,source:'usage:final',observedAtMs:1050});
  expect(f.snapshot(1060).attemptHistory[0].costObservation).toMatchObject({ costState:'actual', units:9, billing:'final' });
  expect(f.snapshot(1060).budget.costStatus).toBe('unknown');
  const saved = f.db.prepare("SELECT payload FROM integration_budget_receipt WHERE receipt_id='actual'").get() as {payload:string};
  const original = JSON.parse(saved.payload);
  const corrupt = {...original,requestId:'foreign'};
  f.db.prepare("UPDATE integration_budget_receipt SET payload=? WHERE receipt_id='actual'").run(JSON.stringify(Object.fromEntries(Object.entries(corrupt).sort(([a],[b])=>a.localeCompare(b)))));
  expect(f.snapshot(1060).attemptHistory[0].costObservation.status).toBe('unavailable');
  expect(f.snapshot(1060).stages).toHaveLength(2);
});

test('renderer shows fresh/stale/unknown and removes previous amount on invalid or new run', () => {
  const f=fixture(),dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'});
  try {
    Object.assign(dom.window,{cue:{}});dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));
    const draw=(snapshot: unknown)=>(dom.window as any).renderCard({taskId:'task',runId:'run',state:'running',status:'running',stage:'work',executionOwnership:{status:'unresolved'},orchestration:snapshot});
    draw(f.snapshot());
    const text=()=>dom.window.document.querySelector('#orchestration-attempts .cost-observation')!.textContent!;
    expect(text()).toContain('12 USD/micro');expect(text()).toContain('추정');expect(text()).toContain('유효 기간 내');
    draw(f.snapshot(2000));expect(text()).toContain('유효 기간 경과');
    f.manager.observe({runId:'run',requestId:'request',receiptId:'unknown',revision:2,currency:'USD',unit:'micro',kind:'unknown',units:null,providerFinal:false,source:'usage:next',observedAtMs:1030});
    draw(f.snapshot(1040));expect(text()).toContain('금액 미확인');expect(text()).not.toContain('12 USD');
    const base=f.snapshot();
    draw({...base,attemptHistory:[{attemptId:'subscription',costObservation:{status:'observed',authority:'observation-only',costDimension:'subscription',costState:'estimated',units:7,currency:null,unit:'subscription-unit',freshness:'fresh',observedAtMs:1000,billing:'open'}}]});
    expect(text()).toContain('구독 사용량');expect(text()).toContain('7 subscription-unit');expect(text()).not.toContain('금액');
    draw({...base,attemptHistory:[{attemptId:'local',costObservation:{status:'observed',authority:'observation-only',costDimension:'local-resource',costState:'actual',units:1,currency:null,unit:'local-resource-unit',freshness:'stale',observedAtMs:1000,billing:'unknown'}}]});
    expect(text()).toContain('로컬 자원 사용량');expect(text()).toContain('1 local-resource-unit');expect(text()).not.toContain('무료');
    draw({...f.snapshot(),runId:'new',attemptHistory:[]});expect(dom.window.document.querySelector('#orchestration-attempts .cost-observation')).toBeNull();
    draw({...f.snapshot(),attemptHistory:[{attemptId:'a',costObservation:{status:'unavailable'}}]});expect(text()).toBe('비용 관측 미확인');
    expect(dom.window.document.querySelector<HTMLButtonElement>('#stop')!.disabled).toBe(false);
  } finally {dom.window.close();}
});
