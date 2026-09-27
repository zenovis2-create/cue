import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { createEvaluationEnrollmentStore } from '../src/evaluation/enrollment.js';

const handles: Ledger[] = [], roots: string[] = [];
afterEach(() => { for (const db of handles.splice(0)) if (db.open) db.close(); for (const root of roots.splice(0)) rmSync(root,{recursive:true,force:true}); });
const h = (s: string) => createHash('sha256').update(s).digest('hex');
const dataset = () => ({ id:'cohort', revision:'v1', cases:[
  { id:'eval', kind:'code', inputDigest:h('eval-input'), split:'evaluation' },
  { id:'hold', kind:'code', inputDigest:h('hold-input'), split:'holdout' },
] });
function fixture(file = ':memory:', runId = 'run') {
  const db = openLedger(file); handles.push(db);
  db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(`task-${runId}`,'awaiting_approval','now');
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(`env-${runId}`,'C:/fixture','[]','now');
  db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(runId,`task-${runId}`,`env-${runId}`,'now');
  const saved = saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-12T00:00:00.000Z',sourceVersion:'fixture',policy:{
    version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1000,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,
    allowedCandidateIds:['agent'],pinnedCandidateId:null,
  }});
  bindRunSelectionPolicy(db,{runId,policyId:saved.policyId,revision:saved.revision,digest:saved.digest,boundAt:'2026-09-12T00:00:00.000Z'});
  const input = { enrollmentId:`enroll-${runId}`,runId,dataset:dataset(),caseId:'eval',arm:'efficiency',
    policy:{kind:'monetary',policyId:saved.policyId,revision:saved.revision,digest:saved.digest},
    metric:{id:'quality',revision:'v1',digest:h('metric')},environment:{id:'host-class',revision:'v1',digest:h('environment')},
    accountLimits:{id:'account-class',revision:'v1',digest:h('account')},enrolledAtMs:1000 } as const;
  return {db,input,store:createEvaluationEnrollmentStore(db)};
}

test('pre-approval enrollment persists canonical dataset and explicit claimed input boundary across reopen', () => {
  const root=mkdtempSync(join(tmpdir(),'cue-enrollment-')); roots.push(root); const file=join(root,'ledger.db');
  const f=fixture(file), saved=f.store.enroll(f.input);
  expect(saved).toMatchObject({authority:'pre-approval-cohort-binding-only',inputDigest:h('eval-input'),split:'evaluation',inputBinding:'claimed-not-verified'});
  expect(Object.isFrozen(saved.dataset.cases[0])).toBe(true);
  f.db.close(); handles.splice(handles.indexOf(f.db),1);
  const reopened=openLedger(file); handles.push(reopened);
  expect(createEvaluationEnrollmentStore(reopened).read(saved.enrollmentId)).toEqual(saved);
});

test('exact replay remains readable after approval but changed replay is rejected', () => {
  const f=fixture(), saved=f.store.enroll(f.input);
  f.db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES(?,?,'thread','item',0,'accept','now')").run('run','env-run');
  expect(f.store.enroll(f.input)).toEqual(saved);
  expect(() => f.store.enroll({...f.input,metric:{...f.input.metric,digest:h('other')}})).toThrow('replay_conflict');
  expect(() => f.store.enroll({...f.input,enrollmentId:'later'})).toThrow('approval_accepted');
});

test('wrong policy, unknown case, completed run, execution and attempt guards reject late selection', () => {
  let f=fixture(); expect(() => f.store.enroll({...f.input,policy:{...f.input.policy,digest:h('wrong')}})).toThrow('policy_mismatch');
  expect(() => f.store.enroll({...f.input,caseId:'missing'})).toThrow('case');
  expect(() => f.store.enroll({...f.input,arm:'value'})).toThrow('arm_policy_mismatch');
  expect(() => f.store.enroll({...f.input,arm:'manual-baseline'})).toThrow('manual_baseline_unsupported');
  f.db.prepare("UPDATE task SET state='completed' WHERE id='task-run'").run();
  expect(() => f.store.enroll(f.input)).toThrow('run_started');
  f=fixture(':memory:','exec'); f.db.prepare("INSERT INTO execution_event(run_id,thread_id,execution_id,execution_ordinal,created_at) VALUES('exec','t','x',0,'now')").run();
  expect(() => f.store.enroll(f.input)).toThrow('attempt_started');
  f=fixture(':memory:','attempt');
  f.db.exec("INSERT INTO orchestration_plan VALUES('attempt','env-attempt','d','{}'); INSERT INTO orchestration_step VALUES('attempt','step','pending'); INSERT INTO orchestration_attempt VALUES('a','attempt','step','agent','running','{}','C:/fixture',NULL,0)");
  expect(() => f.store.enroll(f.input)).toThrow('attempt_started');
});

test('run and cohort slots are immutable and conflicting dataset revisions are atomic', () => {
  const a=fixture(':memory:','a'); a.store.enroll(a.input);
  const bRun='b';
  a.db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run(`task-${bRun}`,'awaiting_approval','now');
  a.db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(`env-${bRun}`,'C:/fixture','[]','now');
  a.db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(bRun,`task-${bRun}`,`env-${bRun}`,'now');
  bindRunSelectionPolicy(a.db,{runId:bRun,policyId:a.input.policy.policyId,revision:a.input.policy.revision,digest:a.input.policy.digest,boundAt:'2026-09-12T00:00:00.000Z'});
  expect(() => a.store.enroll({...a.input,enrollmentId:'enroll-b',runId:bRun})).toThrow('cohort_conflict');
  expect((a.db.prepare('SELECT count(*) n FROM evaluation_enrollment').get() as any).n).toBe(1);
  expect(() => a.db.prepare("UPDATE evaluation_enrollment SET case_id='hold'").run()).toThrow('immutable');
});

test('reopen revalidates canonical dataset bytes instead of trusting stored digest', () => {
  const f=fixture(), saved=f.store.enroll(f.input);
  f.db.exec('DROP TRIGGER evaluation_dataset_update');
  f.db.prepare('UPDATE evaluation_dataset SET payload=? WHERE digest=?').run(JSON.stringify({...dataset(),revision:'changed'}),saved.dataset.digest);
  expect(() => f.store.read(saved.enrollmentId)).toThrow('dataset_integrity');
});

test('read rejects oversized corrupt payload before parsing its truncated bytes', () => {
  const f=fixture(), saved=f.store.enroll(f.input);
  f.db.exec('DROP TRIGGER evaluation_enrollment_update; PRAGMA ignore_check_constraints=ON');
  f.db.prepare('UPDATE evaluation_enrollment SET payload=? WHERE enrollment_id=?').run('x'.repeat(1048577),saved.enrollmentId);
  expect(() => f.store.read(saved.enrollmentId)).toThrow('evaluation_enrollment_payload');
});
