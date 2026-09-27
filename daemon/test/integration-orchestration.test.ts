import { afterEach, describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { openLedger, type Ledger } from '../src/ledger.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createOrchestrationStore, type ClaimRequest, type ExecutionReceipt } from '../src/orchestration/store.js';
import { captureChangeSet, registerNativeChangeJournal } from '../src/change-records.js';
import { createHandoffActivityStore } from '../src/orchestration/handoff-activity.js';
import { createFinalPublicationStore } from '../src/final-publication.js';
const roots: string[] = [], handles: Ledger[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const approval = { policyRevision: 'p1', policyDigest: 'a'.repeat(64), requirementIds: ['req'], allowedCandidateIds: ['agent'], allowedScopeIds: ['workspace'] };
function plan(makerRole: 'implementation' | 'model-producer' = 'implementation') { return validateTaskPlan(approval, { revision: 'plan1', policyRevision: 'p1', policyDigest: approval.policyDigest, tasks: [
  { id: 'impl', role: makerRole, ownerId: 'maker', requirementIds: ['req'], dependencyIds: [], candidateIds: ['agent'], scopeIds: ['workspace'] },
  { id: 'verify', role: 'verifier', ownerId: 'checker', requirementIds: ['req'], dependencyIds: ['impl'], candidateIds: ['agent'], scopeIds: ['workspace'] },
] }); }
const claim = (edit: Partial<ClaimRequest> = {}): ClaimRequest => ({ runId: 'run', taskId: 'impl', attemptId: 'attempt', candidateId: 'agent', observedAtMs: 1000, ...edit });
const finish = (edit: Partial<ExecutionReceipt> = {}): ExecutionReceipt => ({ runId: 'run', taskId: 'impl', attemptId: 'attempt', receiptId: 'receipt', revision: 1, outcome: 'succeeded', cleanup: 'clean', evidenceRef: 'host-evidence', observedAtMs: 2000, ...edit });
function seed(db: Ledger, root: string, runId = 'run') {
  db.prepare("INSERT INTO task VALUES(?,'running',NULL,?)").run(`task-${runId}`, 'now');
  db.prepare("INSERT OR IGNORE INTO envelope VALUES('envelope',?,'[]','now')").run(root);
  db.prepare("INSERT INTO run VALUES(?,?,'envelope',0,'now')").run(runId, `task-${runId}`);
}
function fixture(makerRole: 'implementation' | 'model-producer' = 'implementation') {
  const root = mkdtempSync(join(tmpdir(), 'cue-orchestration-')); roots.push(root);
  const path = join(root, 'ledger.db'), db = openLedger(path); handles.push(db);
  db.exec(readFileSync(resolve('migrations/010_orchestration.sql'), 'utf8')); seed(db, root);
  const truth = { authorize: true, outcomeVerified: true, cleanupVerified: true };
  const store = createOrchestrationStore(db, { authorizePlan: () => truth.authorize, authorizeClaim: () => truth.authorize,
    verifyReceipt: () => ({ outcomeVerified: truth.outcomeVerified, cleanupVerified: truth.cleanupVerified }) });
  store.install('run', plan(makerRole)); return { root, path, db, truth, store };
}
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function publicationFixture(sharedWork?: string) {
  const root = mkdtempSync(join(tmpdir(), 'cue-orchestration-publication-')); roots.push(root);
  const path = join(root, 'ledger.db'), work = sharedWork ?? join(root, 'work'); if (!sharedWork) mkdirSync(work); writeFileSync(join(work, 'final.txt'), 'before');
  const db = openLedger(path); handles.push(db); const parent = digest('parent'), stage = digest('stage'), planDigest = digest('plan'), policy = digest('policy'), selection = digest('selection'), subject = digest('subject');
  db.prepare("INSERT INTO task VALUES('root','running',NULL,'now')").run(); db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(parent, work, '[]', 'now'); db.prepare("INSERT INTO run VALUES('run','root',?,0,'now')").run(parent);
  db.prepare("INSERT INTO orchestration_plan VALUES('run',?,?,?)").run(parent, planDigest, JSON.stringify({ revision: 'plan', tasks: [{ id: 'stage', role: 'implementation', dependencyIds: [] }] })); db.prepare("INSERT INTO orchestration_step VALUES('run','stage','running')").run();
  registerNativeChangeJournal(db, { runId: 'run', worktreeRealpath: work, targets: [{ taskId: 'stage', targetId: 'final-target', relativePath: 'final.txt', maxBackupBytes: 1024 }], observedAtMs: 0 });
  db.prepare("INSERT INTO workspace_write_lease VALUES(?,'run','lease-a')").run(work); db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','run','stage','candidate','running','{}',?,'lease-a',0)").run(work); db.prepare("INSERT INTO task VALUES('stage-task','running',NULL,'now')").run(); db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(stage, work, '[]', 'now'); db.prepare("INSERT INTO run VALUES('attempt','stage-task',?,0,'now')").run(stage);
  db.prepare("INSERT INTO orchestration_stage_envelope VALUES('attempt','run','stage','stage-task','attempt',?,?,?,?,?,?,?,?)").run(parent, stage, planDigest, policy, '{}', '{}', '{}', '{}'); db.prepare("INSERT INTO attempt_selection VALUES('attempt','run','request','monetary',?,?)").run(selection, '{}');
  createHandoffActivityStore(db, { authorizeArtifact: () => false, resolveArtifact: () => null }).recordLaunchIntent({ runId: 'run', taskId: 'stage', attemptId: 'attempt', candidateId: 'candidate', selectionDigest: selection, expectedSubjectDigest: subject, tool: { id: 'tool', revision: 'r' }, model: null, parentEnvelopeHash: parent, stageEnvelopeHash: stage, planDigest, policyDigest: policy });
  captureChangeSet(db, { changeSetId: 'set', runId: 'run', taskId: 'stage', attemptId: 'attempt', stageEnvelopeHash: stage, launchIntentId: 'attempt', worktree: work, targets: ['final.txt'], limits: { maxTargets: 1, maxBackupBytes: 1024 }, nowMs: 1 });
  return { path, work, db, target: join(work, 'final.txt') };
}
describe('S3 durable orchestration scheduling', () => {
  it('model producer never acquires or releases writer authority and cannot unlock a dependency without verified handoff', () => {
    const { root, db, store } = fixture('model-producer'); seed(db, root, 'other');
    db.prepare("INSERT INTO workspace_write_lease VALUES(?,'other','existing')").run(root);
    expect(() => store.claim(claim({ taskId: 'verify', attemptId: 'early' }))).toThrow('task_not_ready');
    expect(store.claim(claim()).launchRequired).toBe(true);
    expect(db.prepare("SELECT lease_acquired_at FROM orchestration_attempt WHERE attempt_id='attempt'").get()).toEqual({ lease_acquired_at: null });
    expect(db.prepare("SELECT write_in_progress FROM run WHERE id='run'").get()).toEqual({ write_in_progress: 0 });
    expect(store.finish(finish()).state).toBe('blocked'); expect(store.readiness('run').readyTaskIds).toEqual([]);
    expect(db.prepare('SELECT run_id,acquired_at FROM workspace_write_lease').all()).toEqual([{ run_id: 'other', acquired_at: 'existing' }]);
  });
  it('persists immutable plans bound to existing run and envelope', () => {
    const { store, db } = fixture(); store.install('run', plan());
    expect(store.readiness('run').readyTaskIds).toEqual(['impl']);
    expect(() => store.install('missing', plan())).toThrow('run_binding_missing');
    expect(() => db.prepare("UPDATE orchestration_plan SET digest='tampered'").run()).toThrow('immutable');
    expect(() => db.prepare('INSERT OR REPLACE INTO orchestration_plan SELECT * FROM orchestration_plan').run()).toThrow('immutable');
    db.prepare("UPDATE run SET envelope_hash='other' WHERE id='run'").run();
    expect(() => store.readiness('run')).toThrow();
  });
  it('claim replay never relaunches and mismatched attempt reuse rejects', () => {
    const { store, truth } = fixture();
    expect(store.claim(claim())).toMatchObject({ state: 'running', launchRequired: true, acceptance: 'unverified' });
    truth.authorize = false;
    expect(store.claim(claim())).toMatchObject({ state: 'running', launchRequired: false });
    expect(() => store.claim(claim({ observedAtMs: 1001 }))).toThrow('claim_replay_mismatch');
    expect(() => store.claim(claim({ attemptId: 'new' }))).toThrow('task_not_ready');
  });
  it.runIf(process.platform === 'win32')('native winner survives a stale losing writer and loser reopen/resend publishes zero', () => {
    const winner = publicationFixture(), loser = publicationFixture(winner.work);
    expect(createFinalPublicationStore(winner.db, { authorize: () => true, nowMs: 10 }).publish({ publicationId: 'winner', changeSetId: 'set', relativePath: 'final.txt', replacement: Buffer.from('A') })).toMatchObject({ state: 'committed' });
    expect(createFinalPublicationStore(loser.db, { authorize: () => true, nowMs: 10 }).publish({ publicationId: 'loser', changeSetId: 'set', relativePath: 'final.txt', replacement: Buffer.from('B') })).toEqual({ publicationId: 'loser', state: 'contention', reason: 'native-contention' });
    expect(readFileSync(winner.target, 'utf8')).toBe('A'); expect(loser.db.prepare('SELECT count(*) n FROM change_publication_result').get()).toEqual({ n: 1 });
    loser.db.close(); handles.splice(handles.indexOf(loser.db), 1); const reopened = openLedger(loser.path); handles.push(reopened);
    expect(createFinalPublicationStore(reopened, { authorize: () => { throw Error('replay must not authorize'); } }).publish({ publicationId: 'loser', changeSetId: 'set', relativePath: 'final.txt', replacement: Buffer.from('B') })).toEqual({ publicationId: 'loser', state: 'contention', reason: 'native-contention' });
    expect(reopened.prepare('SELECT count(*) n FROM change_publication_result').get()).toEqual({ n: 1 }); expect(readFileSync(winner.target, 'utf8')).toBe('A');
  });
  it('existing same-run or another-run writer lease blocks claim before ownership', () => {
    const { root, db, store } = fixture();
    db.prepare("INSERT INTO workspace_write_lease VALUES(?,'run','existing')").run(root);
    expect(() => store.claim(claim())).toThrow('writer_lease_busy');
    db.prepare('DELETE FROM workspace_write_lease').run(); seed(db, root, 'other');
    db.prepare("INSERT INTO workspace_write_lease VALUES(?,'other','existing')").run(root);
    expect(() => store.claim(claim())).toThrow('writer_lease_busy');
    expect(db.prepare('SELECT count(*) n FROM orchestration_attempt').get()).toEqual({ n: 0 });
  });
  it('tool success without host evidence cannot complete or unlock requirements', () => {
    const { store, truth, db } = fixture(); store.claim(claim()); truth.outcomeVerified = false;
    expect(store.finish(finish())).toMatchObject({ state: 'blocked', acceptance: 'unverified', launchRequired: false });
    expect(store.readiness('run').phase).toBe('blocked');
    expect(db.prepare("SELECT state FROM task WHERE id='task-run'").get()).toEqual({ state: 'running' });
  });
  it('unknown cleanup holds lease; later verified clean receipt only releases, never retries', () => {
    const { store, db } = fixture(); store.claim(claim());
    expect(store.finish(finish({ cleanup: 'unknown' })).state).toBe('blocked');
    expect(() => db.prepare("DELETE FROM workspace_write_lease WHERE run_id='run'").run()).toThrow('cleanup unverified');
    expect(() => db.prepare("UPDATE workspace_write_lease SET acquired_at='changed'").run()).toThrow('cleanup unverified');
    expect(() => db.prepare('INSERT OR REPLACE INTO workspace_write_lease SELECT * FROM workspace_write_lease').run()).toThrow('cleanup unverified');
    expect(() => db.prepare('INSERT OR IGNORE INTO workspace_write_lease SELECT * FROM workspace_write_lease').run()).toThrow('cleanup unverified');
    expect(store.finish(finish({ receiptId: 'clean-later', revision: 2 })).state).toBe('blocked');
    expect(db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
    expect(() => store.claim(claim({ attemptId: 'replacement' }))).toThrow('task_not_ready');
  });
  it('host receipt truth alone cannot create a terminal state or unlock dependencies without verified handoff', () => {
    const { store, db } = fixture(); store.claim(claim()); expect(store.finish(finish()).state).toBe('blocked');
    expect(store.claim(claim())).toMatchObject({ state: 'blocked', launchRequired: false });
    expect(store.finish(finish()).state).toBe('blocked');
    expect(() => store.finish(finish({ cleanup: 'unknown' }))).toThrow('finish_replay_mismatch');
    expect(store.readiness('run').readyTaskIds).toEqual([]);
    expect(() => store.claim(claim({ taskId: 'verify', attemptId: 'check' }))).toThrow('task_not_ready');
    expect(store.readiness('run')).toMatchObject({ phase: 'blocked', acceptance: 'unverified' });
    expect(db.prepare("SELECT state FROM task WHERE id='task-run'").get()).toEqual({ state: 'running' });
  });
  it('activity requires exact lineage and ordinal, preserving immutable replay facts', () => {
    const { store, db } = fixture(); store.claim(claim());
    const event = { runId: 'run', taskId: 'impl', attemptId: 'attempt', eventId: 'e1', ordinal: 1, kind: 'heartbeat' as const, data: { status: 'alive' }, observedAtMs: 1100 };
    store.activity(event); store.activity(event);
    expect(() => store.activity({ ...event, data: { status: 'different' } })).toThrow('activity_replay_mismatch');
    expect(() => store.activity({ ...event, eventId: 'e3', ordinal: 3 })).toThrow('activity_out_of_order');
    expect(() => store.activity({ ...event, taskId: 'verify' })).toThrow('lineage_mismatch');
    expect(() => db.prepare('INSERT OR REPLACE INTO orchestration_activity SELECT * FROM orchestration_activity').run()).toThrow('immutable');
    store.activity({ ...event, eventId: 'e2', ordinal: 2 });
    expect(db.prepare('SELECT count(*) n FROM orchestration_activity').get()).toEqual({ n: 2 });
  });
  it('reopen/crash blocks without automatic resumption and retains unresolved lease', () => {
    const { path, db, store } = fixture(); store.claim(claim()); db.close();
    const reopened = openLedger(path); handles.push(reopened);
    const resumed = createOrchestrationStore(reopened, { authorizePlan: () => true, authorizeClaim: () => true, verifyReceipt: () => ({ outcomeVerified: true, cleanupVerified: true }) });
    expect(resumed.recover('run')).toBe(1); expect(resumed.recover('run')).toBe(0);
    expect(resumed.claim(claim())).toMatchObject({ state: 'blocked', launchRequired: false });
    expect(resumed.readiness('run').phase).toBe('blocked');
    expect(reopened.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 1 });
    expect(resumed.finish(finish()).state).toBe('blocked');
    expect(reopened.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 0 });
  });
  it('host denial, disallowed candidate and early dependency claims are refused', () => {
    const { store, truth } = fixture();
    expect(() => store.claim(claim({ candidateId: 'other' }))).toThrow('candidate_not_allowed');
    expect(() => store.claim(claim({ taskId: 'verify' }))).toThrow('task_not_ready');
    truth.authorize = false; expect(() => store.claim(claim())).toThrow('claim_not_authorized');
  });
  it('independent connections atomically claim exactly once', async () => {
    const { path, db } = fixture(); const workers: Worker[] = [], results: Promise<string>[] = [];
    for (const attemptId of ['a', 'b']) {
      const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');
        (async()=>{const {openLedger}=await import(workerData.ledger); const {createOrchestrationStore}=await import(workerData.store);
          const db=openLedger(workerData.path); const store=createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>true,verifyReceipt:()=>({outcomeVerified:true,cleanupVerified:true})});
          parentPort.once('message',()=>{let result='claimed';try{store.claim(workerData.claim)}catch(e){result=e.message}finally{db.close()} parentPort.postMessage({result});parentPort.close()});parentPort.postMessage({ready:true});
        })().catch(e=>{parentPort.postMessage({result:e.message});parentPort.close()});`, { eval: true, workerData: { path, claim: claim({ attemptId }), ledger: pathToFileURL(resolve('dist/src/ledger.js')).href, store: pathToFileURL(resolve('dist/src/orchestration/store.js')).href } });
      workers.push(worker);
      await new Promise<void>((done, reject) => { worker.on('error', reject); worker.on('message', m => { if (m.ready) done(); else if (m.result !== 'claimed') reject(Error(m.result)); }); });
      results.push(new Promise((done, reject) => { worker.on('error', reject); worker.on('message', m => { if (m.result) done(m.result); }); }));
    }
    try { workers.forEach(w => w.postMessage('go')); expect((await Promise.all(results)).sort()).toEqual(['claimed', 'task_not_ready']); }
    finally { await Promise.all(workers.map(w => w.terminate())); }
    expect(db.prepare('SELECT count(*) n FROM orchestration_attempt').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({ n: 1 });
  }, 15000);
});
