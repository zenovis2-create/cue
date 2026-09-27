import { afterEach, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger, type Ledger } from '../src/ledger.js';
import { saveSelectionPolicy, bindRunSelectionPolicy } from '../src/selection/policy-store.js';
import { createEvaluationBaselineStore } from '../src/evaluation/baseline.js';
import { createEvaluationEnrollmentStore } from '../src/evaluation/enrollment.js';

const handles:Ledger[]=[],roots:string[]=[];
afterEach(()=>{for(const db of handles.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true})});
const h=(s:string)=>createHash('sha256').update(s).digest('hex');
const dataset=()=>({id:'cohort',revision:'v1',cases:[{id:'eval',kind:'code',inputDigest:h('eval'),split:'evaluation'},{id:'hold',kind:'code',inputDigest:h('hold'),split:'holdout'}]});
function fixture(file=':memory:',verify?:any){
  const db=openLedger(file);handles.push(db);
  db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run('task','awaiting_approval','now');
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('env','C:/fixture','[]','now');
  db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run('run','task','env','now');
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-12T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1000,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:100,allowedCandidateIds:['agent'],pinnedCandidateId:'agent'}});
  bindRunSelectionPolicy(db,{runId:'run',policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-12T00:00:00.000Z'});
  const input={baselineId:'baseline',enrollmentId:'enrollment',runId:'run',dataset:dataset(),caseId:'eval',policy:{kind:'monetary',policyId:'policy',revision:1,digest:policy.digest},candidate:{id:'agent',revision:'v1',digest:h('candidate')},metric:{id:'quality',revision:'v1',digest:h('metric')},environment:{id:'env',revision:'v1',digest:h('environment')},accountLimits:{id:'limits',revision:'v1',digest:h('limits')},enrolledAtMs:1000,authorityRef:{id:'user-decision',revision:'v1',digest:h('authority')}} as const;
  return {db,input,store:createEvaluationBaselineStore(db,verify)};
}
const counts=(db:Ledger)=>db.prepare(`SELECT (SELECT count(*) FROM evaluation_baseline_declaration) baselines,(SELECT count(*) FROM evaluation_enrollment) enrollments,
  (SELECT count(*) FROM approval_event) approvals,(SELECT count(*) FROM execution_event) executions,(SELECT count(*) FROM selection_policy_snapshot) policies`).get() as any;

test('explicit frozen authority atomically declares and enrolls a pinned manual baseline across reopen',()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-baseline-'));roots.push(root);const file=join(root,'ledger.db');let calls=0;
  const f=fixture(file,(request:any)=>{calls++;expect(Object.isFrozen(request)).toBe(true);expect(Object.isFrozen(request.dataset.cases[0])).toBe(true);expect(request.authorityRef.id).toBe('user-decision');return true});
  const before=counts(f.db),saved=f.store.declare(f.input);expect(calls).toBe(1);
  expect(saved).toMatchObject({authority:'explicit-user-baseline-authority-only',candidate:f.input.candidate,authorization:{verified:true,authorityRef:f.input.authorityRef},enrollment:{arm:'manual-baseline'}});
  expect(counts(f.db)).toEqual({...before,baselines:1,enrollments:1});
  f.db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('run','env','t','i',0,'accept','now')").run();
  expect(f.store.declare(f.input)).toEqual(saved);expect(calls).toBe(1);
  expect(()=>f.store.declare({...f.input,candidate:{...f.input.candidate,revision:'v2'}})).toThrow('replay_conflict');expect(calls).toBe(1);
  f.db.close();handles.splice(handles.indexOf(f.db),1);const reopened=openLedger(file);handles.push(reopened);
  expect(createEvaluationBaselineStore(reopened).read('baseline')).toEqual(saved);
  expect(counts(reopened)).toMatchObject({baselines:1,enrollments:1,approvals:1,executions:0,policies:1});
});

test('missing, false, throwing, malformed and unpinned authority paths write nothing',()=>{
  for(const verifier of [undefined,()=>false,()=>{throw Error('no')}]){const f=fixture(':memory:',verifier);const before=counts(f.db);expect(()=>f.store.declare(f.input)).toThrow(/authority/);expect(counts(f.db)).toEqual(before)}
  let touched=0;const f=fixture(':memory:',()=>{touched++;return true}),before=counts(f.db);
  expect(()=>f.store.declare(new Proxy(f.input,{}))).toThrow('input');
  const getter={...f.input};Object.defineProperty(getter,'authorityRef',{enumerable:true,get(){touched++;return f.input.authorityRef}});
  expect(()=>f.store.declare(getter)).toThrow('input');expect(touched).toBe(0);expect(counts(f.db)).toEqual(before);
  expect(()=>f.store.declare({...f.input,candidate:{...f.input.candidate,id:'other'}})).toThrow('candidate_mismatch');expect(counts(f.db)).toEqual(before);
});

test('direct enrollment, outer transactions, late declarations, tamper and oversized reads fail closed',()=>{
  const f=fixture(':memory:',()=>true),enrollments=createEvaluationEnrollmentStore(f.db),before=counts(f.db);
  expect(()=>enrollments.enroll({enrollmentId:f.input.enrollmentId,runId:f.input.runId,dataset:f.input.dataset,caseId:f.input.caseId,arm:'manual-baseline',policy:f.input.policy,metric:f.input.metric,environment:f.input.environment,accountLimits:f.input.accountLimits,enrolledAtMs:f.input.enrolledAtMs})).toThrow('manual_baseline_unsupported');
  expect(()=>f.db.transaction(()=>f.store.declare(f.input))()).toThrow('outer_transaction');expect(counts(f.db)).toEqual(before);
  const saved=f.store.declare(f.input);expect(()=>f.db.prepare('UPDATE evaluation_baseline_declaration SET case_id=\'hold\'').run()).toThrow('immutable');
  f.db.exec('DROP TRIGGER evaluation_baseline_declaration_update; PRAGMA ignore_check_constraints=ON');
  f.db.prepare('UPDATE evaluation_baseline_declaration SET request_payload=? WHERE baseline_id=?').run(JSON.stringify({...f.input,caseId:'hold'}),'baseline');
  expect(()=>f.store.read('baseline')).toThrow('integrity');
  f.db.prepare('UPDATE evaluation_baseline_declaration SET request_payload=?,candidate_revision=? WHERE baseline_id=?').run(JSON.stringify(f.input),'tampered','baseline');
  expect(()=>f.store.read('baseline')).toThrow('integrity');
  f.db.prepare('UPDATE evaluation_baseline_declaration SET request_payload=? WHERE baseline_id=?').run('x'.repeat(1048577),'baseline');
  expect(()=>f.store.read(saved.baselineId)).toThrow('payload');
  const late=fixture(':memory:',()=>true);late.db.prepare("INSERT INTO execution_event(run_id,thread_id,execution_id,execution_ordinal,created_at) VALUES('run','t','x',0,'now')").run();
  expect(()=>late.store.declare(late.input)).toThrow('run_started');expect(counts(late.db)).toMatchObject({baselines:0,enrollments:0,executions:1});
});

test('authorization bytes reject injected approval and promotion authority',()=>{
  const f=fixture(':memory:',()=>true);f.store.declare(f.input);
  f.db.exec('DROP TRIGGER evaluation_baseline_declaration_update');
  const injected={verified:true,authorityRef:f.input.authorityRef,approvalAuthority:true,promotionAuthority:true};
  f.db.prepare('UPDATE evaluation_baseline_declaration SET authorization_payload=? WHERE baseline_id=?').run(JSON.stringify(injected),'baseline');
  expect(()=>f.store.read('baseline')).toThrow('integrity');
  expect((f.db.prepare('SELECT count(*) n FROM approval_event').get() as any).n).toBe(0);
  expect((f.db.prepare('SELECT count(*) n FROM execution_event').get() as any).n).toBe(0);
});

test('forged declaration rows cannot authorize direct manual enrollment',()=>{
  for(const kind of ['empty-request','false-authorization','extra-authority','fully-canonical'] as const){
    const f=fixture(),requestPayload=kind==='empty-request'?'{}':JSON.stringify(f.input);
    const authorizationPayload=kind==='false-authorization'
      ?JSON.stringify({verified:false,authorityRef:f.input.authorityRef})
      :kind==='extra-authority'
        ?JSON.stringify({verified:true,authorityRef:f.input.authorityRef,approvalAuthority:true})
        :JSON.stringify({verified:true,authorityRef:f.input.authorityRef});
    f.db.prepare('INSERT INTO evaluation_baseline_declaration VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      f.input.baselineId,f.input.enrollmentId,f.input.runId,h(JSON.stringify(f.input.dataset)),f.input.caseId,f.input.policy.kind,
      f.input.policy.policyId,f.input.policy.revision,f.input.policy.digest,f.input.candidate.id,f.input.candidate.revision,f.input.candidate.digest,
      f.input.metric.digest,f.input.environment.digest,f.input.accountLimits.digest,f.input.enrolledAtMs,f.input.authorityRef.id,
      f.input.authorityRef.revision,f.input.authorityRef.digest,h(requestPayload),requestPayload,authorizationPayload);
    const manual={enrollmentId:f.input.enrollmentId,runId:f.input.runId,dataset:f.input.dataset,caseId:f.input.caseId,arm:'manual-baseline',
      policy:f.input.policy,metric:f.input.metric,environment:f.input.environment,accountLimits:f.input.accountLimits,enrolledAtMs:f.input.enrolledAtMs} as const;
    expect(()=>createEvaluationEnrollmentStore(f.db).enroll(manual)).toThrow('manual_baseline_unsupported');
    expect((f.db.prepare('SELECT count(*) n FROM evaluation_enrollment').get() as any).n).toBe(0);
  }
});
