import type { Ledger } from '../ledger.js';
import { validateBaselineCandidateBinding } from './baseline-plan.js';
import { readRunPolicyIdentity } from '../selection/run-policy-identity.js';
import { createEvaluationEnrollmentStore, type EvaluationEnrollment } from './enrollment.js';
import { BASELINE_MAX_BYTES, BASELINE_ROW_COLUMNS, baselineHash, canonicalizeManualBaselineRequest, freezeBaseline,
  manualBaselineRequestPayload, validateStoredManualBaseline, baselineIdentity, type ManualBaselineAuthorityRequest } from './baseline-contract.js';
export type { ManualBaselineAuthorityRequest } from './baseline-contract.js';
export type ManualBaselineDeclaration = Readonly<ManualBaselineAuthorityRequest & {
  version: 'cue-manual-baseline-declaration-v1'; authority: 'explicit-user-baseline-authority-only';
  authorization: Readonly<{ verified: true; authorityRef: ManualBaselineAuthorityRequest['authorityRef'] }>;
  enrollment: EvaluationEnrollment; digest: string;
}>;
export type ExplicitUserBaselineAuthorityVerifier = (request: ManualBaselineAuthorityRequest) => boolean;

function fail(code: string): never { throw Error(`evaluation_baseline_${code}`); }
const confirming=new WeakSet<Ledger>();
function enrollmentValue(request:ManualBaselineAuthorityRequest){
  const item=request.dataset.cases.find(candidate=>candidate.id===request.caseId);if(!item)fail('case');
  return {version:'cue-evaluation-enrollment-v1',authority:'pre-approval-cohort-binding-only',enrollmentId:request.enrollmentId,
    runId:request.runId,dataset:request.dataset,caseId:request.caseId,inputDigest:item.inputDigest,split:item.split,arm:'manual-baseline',policy:request.policy,
    metric:request.metric,environment:request.environment,accountLimits:request.accountLimits,enrolledAtMs:request.enrolledAtMs,inputBinding:'claimed-not-verified'} as const;
}

/** Validate the complete immutable enrollment, including metric/environment,
 * against its separately authorized declaration. Safe inside a read snapshot. */
export function validateManualBaselineEnrollment(request:ManualBaselineAuthorityRequest,enrollment:EvaluationEnrollment|null){
  const expected=enrollmentValue(request),expectedPayload=JSON.stringify({...expected,dataset:undefined});
  if(!enrollment||JSON.stringify(enrollment)!==JSON.stringify({...expected,digest:baselineHash(expectedPayload)}))fail('integrity');
}

export function createEvaluationBaselineStore(db:Ledger, verifyExplicitUserBaselineAuthority?:ExplicitUserBaselineAuthorityVerifier) {
  const enrollments=createEvaluationEnrollmentStore(db);
  function row(baselineId:string) {
    return db.prepare(`SELECT ${BASELINE_ROW_COLUMNS}
      FROM evaluation_baseline_declaration INDEXED BY sqlite_autoindex_evaluation_baseline_declaration_1 WHERE baseline_id=?`)
      .get(BASELINE_MAX_BYTES+1,BASELINE_MAX_BYTES+1,baselineId) as any;
  }
  function decode(saved:any):ManualBaselineDeclaration {
    const {request,authorization}=validateStoredManualBaseline(saved);
    const enrollment=enrollments.read(request.enrollmentId);
    validateManualBaselineEnrollment(request,enrollment);if(!enrollment)fail('integrity');
    if(request.planDigest!==undefined)validateBaselineCandidateBinding(db,request);
    return freezeBaseline({...request,version:'cue-manual-baseline-declaration-v1',authority:'explicit-user-baseline-authority-only',authorization,enrollment,digest:saved.request_digest});
  }
  function read(baselineId:string):ManualBaselineDeclaration|null { const saved=row(baselineIdentity(baselineId)); return saved?decode(saved):null; }
  function preflight(request:ManualBaselineAuthorityRequest){
    const actual=readRunPolicyIdentity(db,request.runId);
    if (!actual || actual.kind!==request.policy.kind || actual.policyId!==request.policy.policyId || actual.revision!==request.policy.revision || actual.digest!==request.policy.digest) fail('policy_mismatch');
    validateBaselineCandidateBinding(db,request);
    enrollmentValue(request);
    const run=db.prepare('SELECT t.state FROM run r JOIN task t ON t.id=r.task_id WHERE r.id=?').get(request.runId) as {state:string}|undefined;
    if(!run||!['queued','awaiting_approval'].includes(run.state))fail('run_started');
    if(db.prepare('SELECT 1 FROM approval_event WHERE run_id=? LIMIT 1').get(request.runId)
      ||db.prepare('SELECT 1 FROM execution_event WHERE run_id=? LIMIT 1').get(request.runId)
      ||db.prepare('SELECT 1 FROM orchestration_attempt WHERE run_id=? LIMIT 1').get(request.runId))fail('run_started');
    const datasetPayload=JSON.stringify({id:request.dataset.id,revision:request.dataset.revision,cases:request.dataset.cases});
    const prior=db.prepare('SELECT digest,payload FROM evaluation_dataset WHERE dataset_id=? AND revision=?').get(request.dataset.id,request.dataset.revision) as any;
    if(prior&&(prior.digest!==request.dataset.digest||prior.payload!==datasetPayload))fail('dataset_conflict');
    if(db.prepare(`SELECT 1 FROM evaluation_enrollment WHERE enrollment_id=? OR run_id=?
      OR (dataset_digest=? AND case_id=? AND arm='manual-baseline' AND policy_digest=?)`).get(request.enrollmentId,request.runId,request.dataset.digest,request.caseId,request.policy.digest)
      ||db.prepare('SELECT 1 FROM evaluation_baseline_declaration WHERE enrollment_id=? OR run_id=?').get(request.enrollmentId,request.runId))fail('conflict');
  }
  return Object.freeze({
    read(baselineId:string) { if (!db.open || db.inTransaction) fail('outer_transaction'); return read(baselineId); },
    preflight(input:unknown){
      if(!db.open||db.inTransaction)fail('outer_transaction');
      const request=canonicalizeManualBaselineRequest(input);
      if(Buffer.byteLength(JSON.stringify(manualBaselineRequestPayload(request)))>BASELINE_MAX_BYTES)fail('payload');
      db.transaction(()=>preflight(request))();return request;
    },
    declare(input:unknown):ManualBaselineDeclaration {
      if (!db.open || db.inTransaction) fail('outer_transaction');
      if(confirming.has(db))fail('reentrant');
      const request=canonicalizeManualBaselineRequest(input), requestPayload=JSON.stringify(manualBaselineRequestPayload(request));
      if (Buffer.byteLength(requestPayload)>BASELINE_MAX_BYTES) fail('payload');
      const existing=row(request.baselineId);
      if (existing) { const value=decode(existing); if (requestPayload!==JSON.stringify(manualBaselineRequestPayload(value))) fail('replay_conflict'); return value; }
      if (typeof verifyExplicitUserBaselineAuthority!=='function') fail('authority_unavailable');
      // Do not prompt for an ineligible run. The callback is outside our writer
      // transaction; every condition is checked again under the write lock.
      db.transaction(()=>preflight(request))();
      let authorized=false;confirming.add(db);
      try { authorized=verifyExplicitUserBaselineAuthority(request)===true; } catch { fail('authority_denied'); }
      finally{confirming.delete(db);}
      if (!authorized) fail('authority_denied');
      if(!db.open||db.inTransaction)fail('outer_transaction');
      const authorization=freezeBaseline({verified:true as const,authorityRef:request.authorityRef}), authorizationPayload=JSON.stringify(authorization);
      return db.transaction(()=>{
        const replay=row(request.baselineId); if (replay) { const value=decode(replay); if (requestPayload!==JSON.stringify(manualBaselineRequestPayload(value))) fail('replay_conflict'); return value; }
        preflight(request);
        try { db.prepare(`INSERT INTO evaluation_baseline_declaration VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          request.baselineId,request.enrollmentId,request.runId,request.dataset.digest,request.caseId,request.policy.kind,request.policy.policyId,request.policy.revision,
          request.policy.digest,request.candidate.id,request.candidate.revision,request.candidate.digest,request.metric.digest,request.environment.digest,
          request.accountLimits.digest,request.enrolledAtMs,request.authorityRef.id,request.authorityRef.revision,request.authorityRef.digest,
          baselineHash(requestPayload),requestPayload,authorizationPayload);
          const datasetPayload=JSON.stringify({id:request.dataset.id,revision:request.dataset.revision,cases:request.dataset.cases});
          const priorDataset=db.prepare('SELECT digest,payload FROM evaluation_dataset WHERE dataset_id=? AND revision=?').get(request.dataset.id,request.dataset.revision) as any;
          if(priorDataset&&(priorDataset.digest!==request.dataset.digest||priorDataset.payload!==datasetPayload))fail('dataset_conflict');
          if(!priorDataset)db.prepare('INSERT INTO evaluation_dataset(digest,dataset_id,revision,payload) VALUES(?,?,?,?)').run(request.dataset.digest,request.dataset.id,request.dataset.revision,datasetPayload);
          const enrollmentPayload=JSON.stringify({...enrollmentValue(request),dataset:undefined});
          if(Buffer.byteLength(datasetPayload)>BASELINE_MAX_BYTES||Buffer.byteLength(enrollmentPayload)>BASELINE_MAX_BYTES)fail('payload');
          db.prepare('INSERT INTO evaluation_enrollment VALUES(?,?,?,?,?,?,?,?,?,?)').run(request.enrollmentId,request.runId,request.dataset.digest,request.caseId,
            'manual-baseline',request.policy.kind,request.policy.digest,'claimed-not-verified',baselineHash(enrollmentPayload),enrollmentPayload);
        } catch(error) { if (String(error).includes('immutable') || String(error).includes('UNIQUE')) fail('conflict'); throw error; }
        return decode(row(request.baselineId));
      }).immediate();
    },
  });
}
