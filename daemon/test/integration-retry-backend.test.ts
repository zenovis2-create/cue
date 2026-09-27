import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { openLedger, type Ledger } from '../src/ledger.js';
import { applyOrchestrationRetryMigration } from '../src/orchestration/retry-migration.js';
import { createOrchestrationStore, type ClaimRequest, type RetryReason, type RetryReference } from '../src/orchestration/store.js';
import { createOrchestrationEngine, type EngineRequest } from '../src/orchestration/engine.js';
import { createIntegrationRuntime } from '../src/integration-runtime.js';
import { createBudgetManager } from '../src/budget.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createRequirementContractStore } from '../src/verification/requirements.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';

const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const request = (attemptId = 'first', taskId = 'make'): ClaimRequest => ({ runId: 'run', taskId, attemptId, candidateId: 'agent', observedAtMs: 1000 });
function fixture(upgraded = true) {
  const root = mkdtempSync(join(tmpdir(), 'cue-retry-')); roots.push(root);
  const path = join(root, 'ledger.db'), db = upgraded ? openLedger(path) : new Database(path); handles.push(db);
  // An actual prior schema, independent of the current openLedger migrations.
  if (!upgraded) for (const name of readdirSync(resolve('migrations')).filter(name => /^\d{3}_.*\.sql$/.test(name) && Number(name.slice(0, 3)) <= 15).sort()) db.exec(readFileSync(resolve('migrations', name), 'utf8'));
  db.pragma('foreign_keys=ON');
  if (upgraded) applyOrchestrationRetryMigration(db);
  const envelope = normalizeEnvelope({ run_id: 'run', worktree_realpath: root, allowed_actions: ['file_change'], egress: [],
    expires_at: new Date(100000).toISOString(), autonomy_level: 'bounded' });
  const hash = envelopeHash(envelope);
  db.prepare("INSERT INTO task VALUES('parent','awaiting_approval',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(hash, root);
  db.prepare("INSERT INTO run VALUES('run','parent',?,0,'now')").run(hash);
  const policy = saveSelectionPolicy(db, { policyId: 'policy', expectedRevision: null, createdAt: new Date(1000).toISOString(), sourceVersion: 'fixture', policy: {
    version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 1, currency: 'TEST', costLimit: null,
    remainingTimeMs: null, maxEstimateAgeMs: 100, allowedCandidateIds: ['agent'], pinnedCandidateId: 'agent',
  } });
  bindRunSelectionPolicy(db, { runId: 'run', policyId: 'policy', revision: 1, digest: policy.digest, boundAt: new Date(1000).toISOString() });
  const approval = { policyRevision: 'policy:1', policyDigest: policy.digest, requirementIds: ['req'], allowedCandidateIds: ['agent'], allowedScopeIds: ['work'] };
  const plan = validateTaskPlan(approval, { revision: 'plan1', policyRevision: 'policy:1', policyDigest: policy.digest, tasks: [
    { id: 'make', role: 'implementation', ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: ['agent'], scopeIds: ['work'] },
    { id: 'check', role: 'verifier', ownerId: 'checker', requirementIds: ['req'], dependencyIds: ['make'], candidateIds: ['agent'], scopeIds: [] },
  ] });
  const artifactBytes=Buffer.from('retry fixture output');
  const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
  const truth = { now: 1000, classify: true, cleanup: true, launches: [] as string[], failPreparation: false };
  const host = { authorizePlan: () => true, authorizeClaim: () => true,
    verifyReceipt: (context:any) => ({ outcomeVerified: true, cleanupVerified: truth.cleanup, ...(truth.cleanup?{handoff:{handoffId:`handoff-${context.attemptId}`,identityId:`identity-${context.attemptId}`,artifacts:[{kind:'output',sourceRef:`artifact-${context.attemptId}`}]}}:{}) }),
    resolveHandoffArtifact: (sourceRef:string,attemptId:string) => sourceRef===`artifact-${attemptId}`?artifactBytes:null,
    authorizeHandoffArtifact: (sourceRef:string,attemptId:string) => sourceRef===`artifact-${attemptId}`,
    retry: { now: () => truth.now, authorizeContract: () => true,
      classifyFailure: (_context: unknown, receipt: any): RetryReason | null => {
        expect(receipt.outcome).toBe('failed'); expect(Object.isFrozen(receipt)).toBe(true);
        return truth.classify ? { cause: 'transient', sourceRef: 'host-proof', sourceDigest: 'a'.repeat(64), observedAtMs: truth.now } : null;
      } },
  };
  const store = createOrchestrationStore(db, host); store.install('run', plan);
  const requirements = createRequirementContractStore(db, { now: () => 1000, resolveChecker: () => ({ id: 'tests', revision: 'v1', kinds: ['code'], evidencePolicies:[{
    requirementId:'req',kind:'code',producerTaskIds:['make'],sourceRevision:'fixture-source-v1',targetIds:['work'],checkerId:'tests',checkerRevision:'v1',parametersDigest:'b'.repeat(64),hostileCheckIds:['negative'],requiredSectionIds:[],claimIds:[],requiresRender:false,
  }] }) }).bind('run', [
    { id: 'req', text: 'Required behavior', kind: 'code', required: true, checks: [{ checkerId: 'tests', revision: 'v1', parametersDigest: 'b'.repeat(64), targetIds: ['work'] }] },
  ]);
  const terms = { runId: 'run', requirementsDigest: requirements.requirements.digest, maxAttemptsPerTask: 3, maxAttemptsTotal: 4, deadlineMs: 5000, boundAtMs: 1000 };
  const approve = () => {
    db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal','approval',0,'accept','now')").run(hash);
    db.prepare("UPDATE task SET state='running' WHERE id='parent'").run();
  };
  const bindStage = (attemptId: string, taskId = 'make') => createStageEnvelopeBinder(db, { now: () => truth.now, authorizeStage: () => true,
    resolveScope: () => ({ id: 'work', worktreeRealpath: root, allowedActions: ['file_change'], egress: [] }) }).bind({
      workflowRunId: 'run', taskId, attemptId, parentEnvelope: envelope,
      stage: { worktreeRealpath: root, allowedActions: taskId === 'make' ? ['file_change'] : [], egress: [], expiresAt: envelope.expires_at, autonomyLevel: 'bounded' },
    });
  const finish = (attemptId = 'first', outcome: 'failed' | 'succeeded' = 'failed', taskId = 'make') => {
    let stage=db.prepare('SELECT parent_envelope_hash,stage_envelope_hash,plan_digest,policy_digest FROM orchestration_stage_envelope WHERE attempt_id=?').get(attemptId) as any;
    if(!stage){bindStage(attemptId,taskId);stage=db.prepare('SELECT parent_envelope_hash,stage_envelope_hash,plan_digest,policy_digest FROM orchestration_stage_envelope WHERE attempt_id=?').get(attemptId) as any;}
    let selection=db.prepare('SELECT digest FROM attempt_selection WHERE attempt_id=?').get(attemptId) as {digest:string}|undefined;
    if(!selection){const body=JSON.stringify({fixture:true,attemptId});const digest=sha(body);db.prepare("INSERT INTO attempt_selection VALUES(?,?,'fixture-request','monetary',?,?)").run(attemptId,'run',digest,body);selection={digest};}
    const subject=sha(`subject-${attemptId}`),session=`session-${attemptId}`;
    store.handoffActivity.recordLaunchIntent({runId:'run',taskId,attemptId,candidateId:'agent',selectionDigest:selection.digest,expectedSubjectDigest:subject,tool:{id:'fixture-tool',revision:'v1'},model:null,parentEnvelopeHash:stage.parent_envelope_hash,stageEnvelopeHash:stage.stage_envelope_hash,planDigest:stage.plan_digest,policyDigest:stage.policy_digest});
    if(!db.prepare('SELECT 1 FROM session_handle WHERE handle=?').get(session))db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(session,1,'fixture',root,'parent',attemptId);
    store.handoffActivity.recordAttemptIdentity({identityId:`identity-${attemptId}`,attemptId,subjectDigest:subject,durableRef:`session:${session}`,observedAtMs:truth.now});
    return store.finish({ runId: 'run', taskId, attemptId, receiptId: `receipt-${attemptId}`, revision: 1, outcome, cleanup: truth.cleanup ? 'clean' : 'unknown', evidenceRef: 'host-proof', observedAtMs: truth.now });
  };
  const retry = (contractDigest: string, attemptId = 'second', previousAttemptId = 'first') => ({ ...request(attemptId),
    retry: { previousAttemptId, receiptId: `receipt-${previousAttemptId}`, contractDigest } });
  const budget = createBudgetManager(db, { verifyFinalReceipt: () => false });
  budget.initialize({ runId: 'run', currency: 'TEST', unit: 'micro', limitUnits: 100, policyRevision: 'policy:1', source: 'fixture', observedAtMs: 1000 });
  // Inert host runtime fixture: this unit verifies transaction composition, not OS admission.
  const runtime = { start: async (attemptId: string) => {
    expect(db.inTransaction).toBe(false); truth.launches.push(attemptId);
    return { ok: true, handle: { cancel: async () => 'requested', inspectCleanup: async () => 'not-ready', snapshot: () => null } };
  } } as unknown as ReturnType<typeof createIntegrationRuntime>;
  const engine = createOrchestrationEngine(db, { store, budget, runtime }, {
    now: () => truth.now, verifyBudgetMapping: () => true, authorizeExecution: () => true,
    observeCandidates: () => [{ id: 'agent', checks: { eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true },
      estimate: { scope: 'verified-completion-total', quality: 1, expectedCost: 1, conservativeMaxCost: 1, expectedTimeMs: 1, conservativeMaxTimeMs: 1, currency: 'TEST', source: 'fixture', observedAtMs: truth.now } }],
    reservation: context => ({ runId: 'run', attemptId: context.request.attemptId, requestId: context.request.requestId, currency: 'TEST', unit: 'micro', upperUnits: 40,
      scope: 'verified-completion-attempt-total', source: 'fixture', observedAtMs: truth.now }),
    prepareExecution: context => { if (truth.failPreparation) throw Error('fixture_prepare_fail'); bindStage(context.request.attemptId, context.task.id); },
    receipts: () => ({ execution: null, billing: null }),
  });
  const engineRequest = (attemptId = 'first', retry?: RetryReference): EngineRequest =>
    ({ runId: 'run', taskId: 'make', attemptId, requestId: `request-${attemptId}`, observedAtMs: truth.now, timeoutMs: 100, ...(retry ? { retry } : {}) });
  return { root, path, db, store, host, truth, plan, terms, approve, finish, retry, bindStage, budget, engine, engineRequest };
}

describe('S4 explicit retry backend', () => {
  it('compiled helper upgrades legacy attempts without losing FK-linked history and reopens idempotently', async () => {
    const f = fixture(false); f.approve(); f.store.claim(request());
    const stageHash='f'.repeat(64);
    f.db.prepare("INSERT INTO task VALUES('stage-task','running',NULL,'now')").run();
    f.db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(stageHash,f.root);
    f.db.prepare("INSERT INTO run VALUES('stage-run','stage-task',?,0,'now')").run(stageHash);
    f.db.prepare("INSERT INTO orchestration_stage_envelope VALUES('first','run','make','stage-task','stage-run',?,?,?,?,?,?,?,?)")
      .run(f.db.prepare("SELECT envelope_hash FROM run WHERE id='run'").pluck().get(),stageHash,f.plan.digest,f.plan.approval.policyDigest,'{}','{}','{}','{}');
    f.db.prepare("INSERT INTO orchestration_activity VALUES('event','first',1,?)").run(JSON.stringify({runId:'run',taskId:'make',attemptId:'first',eventId:'event',ordinal:1,kind:'progress',detail:'old',observedAtMs:1000}));
    const receipt={runId:'run',taskId:'make',attemptId:'first',receiptId:'receipt-first',revision:1,outcome:'failed',cleanup:'clean',evidenceRef:'host-proof',observedAtMs:1000};
    f.db.prepare("INSERT INTO orchestration_receipt VALUES('receipt-first','first',1,?)").run(JSON.stringify(Object.fromEntries(Object.entries(receipt).sort(([a],[b])=>a.localeCompare(b)))));
    f.db.prepare("UPDATE orchestration_attempt SET state='failed',cleanup_verified=1 WHERE attempt_id='first'").run();
    f.db.prepare("DELETE FROM workspace_write_lease WHERE run_id='run'").run();
    f.db.prepare("UPDATE orchestration_step SET state='failed' WHERE run_id='run' AND task_id='make'").run();
    expect(f.store.readiness('run').readyTaskIds).toEqual([]);
    const before = f.db.prepare('SELECT * FROM orchestration_attempt').all();
    const compiled = await import(pathToFileURL(resolve('dist/src/orchestration/retry-migration.js')).href);
    compiled.applyOrchestrationRetryMigration(f.db); applyOrchestrationRetryMigration(f.db);
    expect(f.db.prepare('SELECT * FROM orchestration_attempt').all()).toEqual(before);
    expect(f.db.pragma('foreign_key_check')).toEqual([]); expect(f.db.pragma('foreign_keys', { simple: true })).toBe(1);
    f.db.close(); const reopened = openLedger(f.path); handles.push(reopened); applyOrchestrationRetryMigration(reopened);
    for (const table of ['orchestration_receipt', 'orchestration_activity', 'orchestration_stage_envelope']) expect(reopened.prepare(`SELECT COUNT(*) n FROM ${table}`).get()).toEqual({ n: 1 });
    expect(reopened.pragma('foreign_key_check')).toEqual([]);
    expect(() => f.store.readRetryContract('run')).toThrow(); // original connection is closed
    const reader = createOrchestrationStore(reopened, f.host); expect(reader.readRetryContract('run')).toBeNull();
    expect(() => reader.claimRetry(f.retry('a'.repeat(64)))).toThrow('retry_contract_missing');
  });
  it('refuses migration inside a transaction and restores FK settings after failed upgrade', () => {
    const f = fixture(false);
    expect(() => f.db.transaction(() => applyOrchestrationRetryMigration(f.db))()).toThrow('outer_boundary');
    f.db.pragma('foreign_keys=OFF'); f.db.prepare("INSERT INTO orchestration_activity VALUES('bad','missing',1,'{}')").run(); f.db.pragma('foreign_keys=ON');
    expect(() => applyOrchestrationRetryMigration(f.db)).toThrow('existing_fk_violation');
    expect(f.db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='orchestration_retry_schema'").get()).toBeUndefined();
  });
  it('binds exact immutable criteria before approval and never retrofits existing approvals', () => {
    const f = fixture(); const contract = f.store.bindRetryContract(f.terms);
    expect(Object.isFrozen(contract)).toBe(true); expect(f.store.bindRetryContract(f.terms)).toEqual(contract);
    expect(() => f.store.bindRetryContract({ ...f.terms, requirementsDigest: 'c'.repeat(64) })).toThrow('criteria_mismatch');
    expect(() => f.store.bindRetryContract({ ...f.terms, maxAttemptsTotal: 1 })).toThrow('limits');
    expect(() => f.db.exec('INSERT OR REPLACE INTO orchestration_retry_contract SELECT * FROM orchestration_retry_contract')).toThrow('immutable');
    f.approve(); expect(f.store.readRetryContract('run')).toEqual(contract);
    const legacy = fixture(); legacy.approve(); expect(() => legacy.store.bindRetryContract(legacy.terms)).toThrow('not_authorized');
  });
  it('creates a new attempt from an exact clean transient receipt while retaining failed history and replay safety', () => {
    const f = fixture(); const c = f.store.bindRetryContract(f.terms); f.approve(); f.store.claim(request()); f.finish();
    const retry = f.retry(c.digest); expect(f.store.claimRetry(retry)).toMatchObject({ launchRequired: true, state: 'running' });
    f.truth.classify = false; expect(f.store.claimRetry(retry).launchRequired).toBe(false);
    expect(() => f.store.claimRetry({ ...retry, retry: { ...retry.retry, receiptId: 'other' } })).toThrow('replay_mismatch');
    expect(() => f.db.exec('INSERT OR REPLACE INTO orchestration_retry_link SELECT * FROM orchestration_retry_link')).toThrow('immutable');
    expect(() => f.db.exec("DELETE FROM orchestration_attempt WHERE attempt_id='first'")).toThrow('immutable');
    f.finish('second', 'succeeded'); expect(f.store.readiness('run').readyTaskIds).toEqual(['check']);
    expect(f.db.prepare('SELECT attempt_id,state FROM orchestration_attempt ORDER BY rowid').all()).toEqual([{ attempt_id: 'first', state: 'failed' }, { attempt_id: 'second', state: 'completed' }]);
  });
  it('allows normal clock advancement while rejecting future binding timestamps and elapsed deadlines', () => {
    const f = fixture(); f.truth.now = 1001;
    expect(f.store.bindRetryContract(f.terms).boundAtMs).toBe(1000);
    const future = fixture(); expect(() => future.store.bindRetryContract({ ...future.terms, boundAtMs: 1001 })).toThrow('not_authorized');
    const expired = fixture(); expired.truth.now = 5000; expect(() => expired.store.bindRetryContract(expired.terms)).toThrow('not_authorized');
  });
  it('denies unknown cleanup, nonclassified/model failure, mismatched receipts and expired contracts', () => {
    for (const mode of ['cleanup', 'classification', 'receipt', 'deadline']) {
      const f = fixture(); const c = f.store.bindRetryContract(f.terms); f.approve(); f.store.claim(request());
      if (mode === 'cleanup') f.truth.cleanup = false;
      f.finish(); if (mode === 'classification') f.truth.classify = false; if (mode === 'deadline') f.truth.now = 5000;
      const retry = f.retry(c.digest); if (mode === 'receipt') retry.retry.receiptId = 'wrong';
      expect(() => f.store.claimRetry(retry)).toThrow();
      expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_attempt').get()).toEqual({ n: 1 });
    }
  });
  it('applies cumulative and per-task attempt caps to retries and later ordinary stages', () => {
    const f = fixture(); const c = f.store.bindRetryContract({ ...f.terms, maxAttemptsPerTask: 2, maxAttemptsTotal: 2 });
    f.approve(); f.store.claim(request()); f.finish(); f.store.claimRetry(f.retry(c.digest)); f.finish('second');
    expect(() => f.store.claimRetry(f.retry(c.digest, 'third', 'second'))).toThrow('attempt_limit');
    const g = fixture(); const gc = g.store.bindRetryContract({ ...g.terms, maxAttemptsTotal: 2 });
    g.approve(); g.store.claim(request()); g.finish(); g.store.claimRetry(g.retry(gc.digest)); g.finish('second', 'succeeded');
    expect(() => g.store.claim(request('verifier', 'check'))).toThrow('attempt_limit');
  });
  it('engine atomically reserves cumulative unknown cost and rolls retry back on budget or stage failure', async () => {
    const f = fixture(); const c = f.store.bindRetryContract(f.terms); f.approve();
    await f.engine.start(f.plan, f.engineRequest()); f.finish();
    f.truth.failPreparation = true;
    await expect(f.engine.start(f.plan, f.engineRequest('second', f.retry(c.digest).retry))).rejects.toThrow('fixture_prepare_fail');
    expect(f.budget.summary('run').committedUnits).toBe(40n);
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_retry_link').get()).toEqual({ n: 0 });
    f.truth.failPreparation = false;
    const second = f.engineRequest('second', f.retry(c.digest).retry);
    await f.engine.start(f.plan, second); expect((await f.engine.start(f.plan, second)).replayed).toBe(true);
    f.finish('second'); expect(f.budget.summary('run').committedUnits).toBe(80n);
    await expect(f.engine.start(f.plan, f.engineRequest('third', f.retry(c.digest, 'third', 'second').retry))).rejects.toThrow('limit_exceeded');
    expect(f.truth.launches).toEqual(['first', 'second']);
    expect(f.db.prepare("SELECT 1 FROM orchestration_attempt WHERE attempt_id='third'").get()).toBeUndefined();
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_stage_envelope').get()).toEqual({ n: 2 });
    expect(f.db.pragma('foreign_key_check')).toEqual([]);
  });
  it('fails closed without trusted handoff artifact resolution and leaves retry state untouched', () => {
    const f = fixture(); const c = f.store.bindRetryContract(f.terms); f.approve(); f.store.claim(request()); f.finish();
    const unresolved=createOrchestrationStore(f.db,{...f.host,resolveHandoffArtifact:()=>null});
    expect(()=>unresolved.claimRetry(f.retry(c.digest))).toThrow('retry_task_not_ready');
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_attempt').get()).toEqual({n:1});
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_retry_link').get()).toEqual({n:0});
  });
  it('separate concurrent connections consume a previous failure exactly once', async () => {
    const f = fixture(); const c = f.store.bindRetryContract(f.terms); f.approve(); f.store.claim(request()); f.finish();
    const workers: Worker[] = [], ready: Promise<void>[] = [], results: Promise<string>[] = [];
    try { for (const attempt of ['second-a', 'second-b']) {
      const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');
        (async()=>{const {openLedger}=await import(workerData.ledger);const {createOrchestrationStore}=await import(workerData.store);const db=openLedger(workerData.path);
          const artifact=Buffer.from('retry fixture output');
          const store=createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>true,verifyReceipt:()=>({outcomeVerified:true,cleanupVerified:true}),resolveHandoffArtifact:(sourceRef,attemptId)=>sourceRef==='artifact-'+attemptId?artifact:null,authorizeHandoffArtifact:(sourceRef,attemptId)=>sourceRef==='artifact-'+attemptId,retry:{now:()=>1000,authorizeContract:()=>true,classifyFailure:()=>({cause:'transient',sourceRef:'host-proof',sourceDigest:'a'.repeat(64),observedAtMs:1000})}});
          parentPort.once('message',()=>{let result='claimed';try{store.claimRetry(workerData.request)}catch(e){result=e.message}finally{db.close()}parentPort.postMessage({result});parentPort.close()});parentPort.postMessage({ready:true});
        })().catch(e=>{parentPort.postMessage({result:e.message});parentPort.close()});`, { eval: true, workerData: { path: f.path, request: f.retry(c.digest, attempt),
          ledger: pathToFileURL(resolve('dist/src/ledger.js')).href, store: pathToFileURL(resolve('dist/src/orchestration/store.js')).href } });
      workers.push(worker);
      let openedSettled=false,resultSettled=false;
      const opened=new Promise<void>((done, reject) => { worker.on('error', reject); worker.on('message', m => { if (m.ready){openedSettled=true;done();} else if (m.result !== 'claimed') reject(Error(m.result)); }); worker.on('exit',code=>{if(!openedSettled)reject(Error(`worker_exited_before_ready:${code}`));}); });
      ready.push(opened); await opened;
      const workerResult=new Promise<string>((done, reject) => { worker.on('error', reject); worker.on('message', m => { if (m.result){resultSettled=true;done(m.result);} }); worker.on('exit',code=>{if(!resultSettled)reject(Error(`worker_exited_before_result:${code}`));}); });
      void workerResult.catch(()=>{}); results.push(workerResult);
    }
      await Promise.all(ready); workers.forEach(w => w.postMessage('go')); expect((await Promise.all(results)).sort()).toEqual(['claimed', 'retry_previous_consumed']); }
    finally { await Promise.all(workers.map(w => w.terminate())); }
    expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_attempt').get()).toEqual({ n: 2 });
    expect(f.db.prepare('SELECT attempt_id,previous_attempt_id FROM orchestration_retry_link').all()).toHaveLength(1);
    expect(f.db.prepare("SELECT COUNT(*) n FROM orchestration_attempt WHERE attempt_id IN ('second-a','second-b')").get()).toEqual({n:1});
  }, 15000);
});
