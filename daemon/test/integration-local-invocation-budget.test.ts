import { afterEach, describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { Worker } from 'node:worker_threads';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createBudgetManager } from '../src/budget.js';
import { createLocalInvocationBudget, type LocalInvocationReservation } from '../src/local-invocation-budget.js';
import { normalizeEnvelope, envelopeHash } from '../src/envelope.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { createHash } from 'node:crypto';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';

const roots: string[] = [], dbs: Ledger[] = [];
afterEach(() => { for (const db of dbs.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const base = { runId: 'run', limit: 3, policyRevision: 'selection:1', source: 'approved-local-count', observedAtMs: 1000 };
const request = (taskId = 'm1', edit: Partial<LocalInvocationReservation> = {}): LocalInvocationReservation => ({ runId: 'run', requestId: 'request-' + taskId,
  attemptId: 'attempt-' + taskId, taskId, candidateId: 'local', kind: taskId === 'v' ? 'checker' : 'producer', observedAtMs: 1001, ...edit });
function fixture(limit = 3) {
  const root = mkdtempSync(join(tmpdir(), 'cue-local-count-')); roots.push(root);
  const path = join(root, 'ledger.sqlite'), db = openLedger(path); dbs.push(db);
  db.exec(readFileSync(resolve('migrations/021_local_invocation_budget.sql'), 'utf8'));
  const parent=normalizeEnvelope({run_id:'run',worktree_realpath:root,allowed_actions:[],egress:[],expires_at:new Date(10000).toISOString(),autonomy_level:'bounded'}),parentHash=envelopeHash(parent);
  db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,?,'[]','now')").run(parentHash,root);
  db.prepare("INSERT INTO run VALUES('run','root',?,0,'now')").run(parentHash);
  const policy=saveSelectionPolicy(db,{policyId:'selection',expectedRevision:null,createdAt:new Date(1000).toISOString(),sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['local'],pinnedCandidateId:'local'}});
  bindRunSelectionPolicy(db,{runId:'run',policyId:'selection',revision:1,digest:policy.digest,boundAt:new Date(1000).toISOString()});
  const approval = { policyRevision: 'selection:1', policyDigest: policy.digest, requirementIds: ['r'], allowedCandidateIds: ['local'], allowedScopeIds: [] };
  const plan = validateTaskPlan(approval, { revision: 'one', policyRevision: approval.policyRevision, policyDigest: approval.policyDigest, tasks: [
    ...['m1', 'm2'].map(id => ({ id, role: 'model-producer' as const, ownerId: id, requirementIds: ['r'], dependencyIds: [], candidateIds: ['local'], scopeIds: [] })),
    { id: 'v', role: 'verifier', ownerId: 'reviewer', requirementIds: ['r'], dependencyIds: ['m1', 'm2'], candidateIds: ['local'], scopeIds: [] },
  ] });
  const artifactBytes=Buffer.from('local-budget-fixture-artifact');
  const store = createOrchestrationStore(db, { authorizePlan: () => true, authorizeClaim: () => true,
    verifyReceipt: context => ({ outcomeVerified: true, cleanupVerified: true,handoff:{handoffId:`handoff-${context.attemptId}`,identityId:`identity-${context.attemptId}`,artifacts:[{kind:'output',sourceRef:`artifact-${context.attemptId}`}]}}),resolveHandoffArtifact:()=>artifactBytes,authorizeHandoffArtifact:()=>true });
  store.install('run', plan);
  db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('run',?,'desktop','goal',0,'accept','now')").run(parentHash);
  const manager = createLocalInvocationBudget(db); manager.initialize({ ...base, limit });
  const claim = (r = request()) => db.transaction(() => {
    store.claim({ runId: r.runId, taskId: r.taskId, attemptId: r.attemptId, candidateId: r.candidateId, observedAtMs: r.observedAtMs });
    return manager.reserve(r);
  }).immediate();
  const binder=createStageEnvelopeBinder(db,{now:()=>1001,authorizeStage:()=>true,resolveScope:()=>{throw Error('no-scope');}});
  const finish = (taskId: string, outcome: 'succeeded' | 'failed' = 'succeeded') => {const attemptId='attempt-'+taskId,stage=binder.bind({workflowRunId:'run',taskId,attemptId,parentEnvelope:parent,stage:{worktreeRealpath:root,allowedActions:[],egress:[],expiresAt:parent.expires_at,autonomyLevel:'bounded'}}),selectionDigest=createHash('sha256').update(`selection-${attemptId}`).digest('hex'),subject=createHash('sha256').update(attemptId).digest('hex'),session=`session-${attemptId}`;
    db.prepare("INSERT INTO attempt_selection VALUES(?,'run',?,'local-invocation',?,'{}')").run(attemptId,`request-${taskId}`,selectionDigest);db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(session,1,'now',root,stage.owner.task_id,stage.owner.run_id);
    store.handoffActivity.recordLaunchIntent({runId:'run',taskId,attemptId,candidateId:'local',selectionDigest,expectedSubjectDigest:subject,tool:{id:'fixture-tool',revision:'v1'},model:null,parentEnvelopeHash:parentHash,stageEnvelopeHash:stage.envelopeHash,planDigest:stage.planDigest,policyDigest:stage.policyDigest});store.handoffActivity.recordAttemptIdentity({identityId:`identity-${attemptId}`,attemptId,subjectDigest:subject,durableRef:`session:${session}`,observedAtMs:1001});
    return store.finish({ runId: 'run', taskId, attemptId, receiptId: 'receipt-' + taskId, revision: 1, outcome, cleanup: 'clean', evidenceRef: 'trusted-fixture', observedAtMs: 1002 });};
  return { db, path, manager, claim, finish, store };
}

describe('nonmonetary committed dispatch intents', () => {
  it('counts producer and checker exactly once, freezes summaries, and retains failed dispatch counts', () => {
    const f = fixture(); expect(Object.isFrozen(f.manager.summary('run'))).toBe(true);
    expect(f.claim()).toMatchObject({ committed: 1, remaining: 2 });
    expect(f.claim()).toMatchObject({ committed: 1, remaining: 2 });
    f.claim(request('m2')); f.finish('m1'); f.finish('m2'); f.claim(request('v')); f.finish('v', 'failed');
    expect(f.manager.summary('run')).toMatchObject({ limit: 3, committed: 3, remaining: 0 });
    expect(Object.keys(f.manager.summary('run'))).not.toContain('currency');
    expect(f.db.prepare('SELECT count(*) n FROM integration_budget_receipt').get()).toEqual({ n: 0 });
  });
  it('requires an outer claim transaction and rejects forged attempt, role, candidate and replay fields', () => {
    const f = fixture(); expect(() => f.manager.reserve(request())).toThrow('claim_transaction_required');
    expect(() => f.db.transaction(() => f.manager.reserve(request()))()).toThrow('attempt_mismatch');
    f.claim();
    for (const edit of [{ kind: 'checker' as const }, { candidateId: 'other' }, { observedAtMs: 1002 }, { requestId: 'different' }]) {
      expect(() => f.db.transaction(() => f.manager.reserve(request('m1', edit)))()).toThrow('request_mismatch');
    }
    expect(() => f.claim(request('m2', { kind: 'checker' }))).toThrow('kind_mismatch');
    expect(f.db.prepare("SELECT 1 FROM orchestration_attempt WHERE task_id='m2'").get()).toBeUndefined();
  });
  it('rolls back both new claims and reservations on count exhaustion or caller rollback', () => {
    const f = fixture(1); f.claim();
    expect(() => f.claim(request('m2'))).toThrow('limit_exceeded');
    expect(f.db.prepare('SELECT count(*) n FROM orchestration_attempt').get()).toEqual({ n: 1 });
    const other = fixture();
    expect(() => other.db.transaction(() => { other.claim(); throw Error('caller rollback'); })()).toThrow('caller rollback');
    expect(other.manager.summary('run').committed).toBe(0);
    expect(other.db.prepare('SELECT count(*) n FROM orchestration_attempt').get()).toEqual({ n: 0 });
  });
  it('preserves committed intents across reopen and accepts exact historical replay after completion', () => {
    const f = fixture(); f.claim(); f.finish('m1', 'failed'); f.db.close();
    const reopened = openLedger(f.path); dbs.push(reopened);
    const manager = createLocalInvocationBudget(reopened);
    expect(manager.summary('run')).toMatchObject({ committed: 1, remaining: 2 });
    expect(reopened.transaction(() => manager.reserve(request()))()).toMatchObject({ committed: 1 });
    // A trusted new retry claim is a different immutable attempt; old rows remain.
    reopened.prepare("INSERT INTO orchestration_attempt SELECT 'retry-m1',run_id,task_id,candidate_id,'running',claim_payload,worktree_realpath,NULL,0 FROM orchestration_attempt WHERE attempt_id='attempt-m1'").run();
    const retry = request('m1', { requestId: 'retry-request', attemptId: 'retry-m1', observedAtMs: 1003 });
    expect(reopened.transaction(() => manager.reserve(retry))()).toMatchObject({ committed: 2 });
    expect(manager.summary('run').remaining).toBe(1);
  });
  it('rejects monetary overlap in both SQL insertion directions without changing monetary-only behavior', () => {
    const f = fixture();
    const money = createBudgetManager(f.db, { verifyFinalReceipt: () => false });
    expect(() => money.initialize({ runId: 'run', currency: 'TEST', unit: 'micro', limitUnits: 3, policyRevision: 'p1', source: 'host', observedAtMs: 1000 })).toThrow('incompatible budget');
    f.db.prepare("INSERT INTO task VALUES('money-root','running',NULL,'now')").run();
    f.db.prepare("INSERT INTO run VALUES('money','money-root','envelope',0,'now')").run();
    money.initialize({ runId: 'money', currency: 'TEST', unit: 'micro', limitUnits: 3, policyRevision: 'p1', source: 'host', observedAtMs: 1000 });
    expect(money.summary('money').remainingUnits).toBe(3n);
    expect(() => f.manager.initialize({ ...base, runId: 'money' })).toThrow('incompatible_budget');
    expect(() => f.db.prepare("INSERT INTO local_invocation_budget VALUES('money',3,'{}',?)").run('a'.repeat(64))).toThrow('incompatible budget');
  });
  it('rejects unknown/accessor/prototype inputs, unsafe counts, policy mutation and SQL replacement', () => {
    const f = fixture();
    for (const value of [{ ...base, extra: true }, { ...base, limit: Number.MAX_SAFE_INTEGER + 1 }, { ...base, source: 'x\n' },
      Object.assign(Object.create({ inherited: true }), base), Object.defineProperty({ ...base }, 'limit', { get() { throw Error('getter ran'); } })]) {
      expect(() => f.manager.initialize(value)).toThrow(/local_invocation_/);
    }
    expect(() => f.manager.initialize({ ...base, limit: 4 })).toThrow('policy_mismatch');
    f.claim();
    for (const table of ['local_invocation_budget', 'local_invocation_reservation']) {
      expect(() => f.db.prepare(`UPDATE ${table} SET digest=?`).run('a'.repeat(64))).toThrow('immutable');
      expect(() => f.db.prepare(`DELETE FROM ${table}`).run()).toThrow('immutable');
      expect(() => f.db.prepare(`INSERT OR REPLACE INTO ${table} SELECT * FROM ${table}`).run()).toThrow('immutable');
    }
    f.db.exec('DROP TRIGGER local_invocation_reservation_no_update');
    f.db.prepare("UPDATE local_invocation_reservation SET payload='{}'").run();
    expect(() => f.manager.summary('run')).toThrow(/local_invocation_/);
  });
  it('serializes competing claim transactions from separate worker DB connections', async () => {
    const f = fixture(1);
    const workers:Worker[]=[],pending:Promise<string>[]=[];
    const code = `const {parentPort,workerData}=require('node:worker_threads'); (async()=>{
      const {openLedger}=await import(workerData.ledger); const {createLocalInvocationBudget}=await import(workerData.budget);
      const {createOrchestrationStore}=await import(workerData.store); const db=openLedger(workerData.path);
      const manager=createLocalInvocationBudget(db), store=createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>true,verifyReceipt:()=>({outcomeVerified:true,cleanupVerified:true})});
      parentPort.once('message',()=>{try {db.transaction(()=>{const r=workerData.request;store.claim({runId:r.runId,taskId:r.taskId,attemptId:r.attemptId,candidateId:r.candidateId,observedAtMs:1001});manager.reserve(r)}).immediate();parentPort.postMessage('committed')}
      catch(e){parentPort.postMessage(String(e))}finally{db.close();parentPort.close()}});parentPort.postMessage('ready');
    })().catch(e=>{parentPort.postMessage(String(e));process.exitCode=1});`;
    try {for(const taskId of ['m1','m2']){
      const r = request(taskId);
      const worker = new Worker(code, { eval: true, workerData: { path: f.path, request: r,
        ledger: pathToFileURL(resolve('dist/src/ledger.js')).href, budget: pathToFileURL(resolve('dist/src/local-invocation-budget.js')).href,
        store: pathToFileURL(resolve('dist/src/orchestration/store.js')).href } });
      workers.push(worker);let readySettled=false,resultSettled=false;await new Promise<void>((done,reject)=>{worker.once('error',reject);worker.once('message',message=>{readySettled=true;message==='ready'?done():reject(Error(message));});worker.once('exit',code=>{if(!readySettled)reject(Error(`worker_exited_before_ready:${code}`));});});
      const result=new Promise<string>((done,reject)=>{worker.once('error',reject);worker.once('message',message=>{resultSettled=true;done(message);});worker.once('exit',code=>{if(!resultSettled)reject(Error(`worker_exited_before_result:${code}`));});});void result.catch(()=>{});pending.push(result);
    }
    workers.forEach(worker=>worker.postMessage('go'));const results=await Promise.all(pending);
    expect(results.filter(r => r === 'committed')).toHaveLength(1);
    expect(results.some(r => r.includes('limit_exceeded'))).toBe(true);
    expect(f.manager.summary('run')).toMatchObject({ committed: 1, remaining: 0 });
    expect(f.db.prepare('SELECT count(*) n FROM orchestration_attempt').get()).toEqual({ n: 1 });
    }finally{await Promise.all(workers.map(worker=>worker.terminate()));}
  });
});
