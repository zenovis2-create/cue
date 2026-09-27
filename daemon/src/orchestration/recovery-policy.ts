import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { validateTaskPlan, type PlanApproval, type ProposedPlan, type ValidatedPlan } from './plan.js';
import { createHandoffActivityStore } from './handoff-activity.js';
import { createBudgetManager } from '../budget.js';
import { createLocalInvocationBudget } from '../local-invocation-budget.js';
import { readHeldRecoveryDisposition } from '../held-recovery.js';

export type FailureCause='transient'|'authentication'|'quota'|'capability-mismatch'|'quality-failure'|'policy-violation'|'unknown';
export type RecoveryAction='retry'|'switch'|'replan'|'stop';
export interface RecoveryFacts {
  cause:FailureCause; priorCandidateId:string; candidateId:string|null; candidateApproved:boolean; candidateAuthenticated:boolean; candidateCapable:boolean;
  terminalHandoffVerified:boolean; cleanupVerified:boolean; writerLeaseReleasable:boolean; externalEffects:'not-applicable'|'confirmed'|'unknown';
  retryableHostCode:boolean; quotaResetAtMs:number|null; nowMs:number; deadlineMs:number; attemptsUsed:number; maxAttemptsTotal:number;
  independentQualityFailure:boolean; unchangedPlan:boolean; policySealed:boolean;
  priorCandidateEligible:boolean;
  budgetAvailable:boolean;
}
export interface RecoveryDecision { readonly action:RecoveryAction; readonly selectedCandidateId:string|null; readonly reason:string; readonly digest:string }
const actions:readonly RecoveryAction[]=['retry','switch','replan','stop'];
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
function stop(reason:string,facts:RecoveryFacts):RecoveryDecision { const value={action:'stop' as const,selectedCandidateId:null,reason}; return Object.freeze({...value,digest:hash(JSON.stringify({facts,...value}))}); }

/** Caller input supplies facts only. The host policy selects the branch. */
export function decideRecovery(facts:RecoveryFacts):RecoveryDecision {
  if(!facts||!['transient','authentication','quota','capability-mismatch','quality-failure','policy-violation','unknown'].includes(facts.cause)
    ||!Number.isSafeInteger(facts.nowMs)||!Number.isSafeInteger(facts.deadlineMs)||!Number.isSafeInteger(facts.attemptsUsed)||!Number.isSafeInteger(facts.maxAttemptsTotal)) throw Error('recovery_facts_invalid');
  if(facts.policySealed||facts.cause==='policy-violation')return stop('policy-violation',facts);
  if(facts.cause==='unknown'||!facts.terminalHandoffVerified||!facts.cleanupVerified||!facts.writerLeaseReleasable||facts.externalEffects==='unknown')return stop('unsafe-or-unknown-state',facts);
  if(facts.nowMs>=facts.deadlineMs||facts.attemptsUsed>=facts.maxAttemptsTotal||!facts.budgetAvailable)return stop('original-limit-exhausted',facts);
  let action:RecoveryAction='stop',reason='no-authorized-branch',selectedCandidateId:string|null=null;
  const alternate=!!facts.candidateId&&facts.candidateId!==facts.priorCandidateId&&facts.candidateApproved&&facts.candidateAuthenticated&&facts.candidateCapable;
  switch(facts.cause){
    case'transient': if(facts.retryableHostCode&&facts.priorCandidateEligible){action='retry';reason='verified-transient';}else if(alternate){action='switch';selectedCandidateId=facts.candidateId;reason='approved-alternate';} break;
    case'authentication': if(alternate){action='switch';selectedCandidateId=facts.candidateId;reason='authenticated-alternate';} break;
    case'quota': if(alternate){action='switch';selectedCandidateId=facts.candidateId;reason='quota-alternate';}else if(facts.quotaResetAtMs!==null&&facts.quotaResetAtMs>=facts.nowMs&&facts.quotaResetAtMs<facts.deadlineMs){action='retry';reason='authoritative-reset';} break;
    case'capability-mismatch': if(alternate){action='switch';selectedCandidateId=facts.candidateId;reason='capable-alternate';}else{action='replan';reason='same-requirements-replan';} break;
    case'quality-failure': if(facts.independentQualityFailure){action='replan';reason='independent-quality-failure';} break;
  }
  if(action==='retry'&&facts.cause==='quality-failure'&&facts.unchangedPlan)return stop('unchanged-quality-retry-forbidden',facts);
  const value={action,selectedCandidateId,reason};
  if(!actions.includes(action))throw Error('recovery_action_invalid');
  return Object.freeze({...value,digest:hash(JSON.stringify({facts,...value}))});
}

export function assertRecoveryAction(decision:RecoveryDecision,requested:RecoveryAction):void {
  if(decision.action!==requested)throw Error('caller_recovery_branch_rejected');
}

const bytes=(value:unknown)=>Buffer.from(JSON.stringify(value));
const requireId=(value:string)=>{if(typeof value!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(value))throw Error('recovery_id_invalid');return value;};
export interface RecoveryScopeInput {runId:string;approvalId:number;budgetKind:'monetary'|'local-invocation';budgetIdentity:string;maxAttemptsTotal:number;deadlineMs:number;createdAtMs:number}
export interface RecoveryAuthoritySnapshot {version:'cue-recovery-classification-v1';retryableHostCode:boolean;quotaResetAtMs:number|null;independentQualityFailure:boolean;priorCandidateEligible:boolean}
export interface FailureObservationInput {observationId:string;runId:string;attemptId:string;receiptId:string;handoffId:string;cause:FailureCause;observedAtMs:number;sourceRef:string;sourceDigest:string;cleanupState:'verified-clean'|'unknown';externalEffects:'not-applicable'|'confirmed'|'unknown';authority?:Readonly<RecoveryAuthoritySnapshot>}
export interface RecoveryObservation {
  cause:FailureCause; sourceRef:string; observedAtMs:number; externalEffects:'not-applicable'|'confirmed'|'unknown'; retryableHostCode:boolean;
  quotaResetAtMs:number|null; independentQualityFailure:boolean; priorCandidateEligible:boolean;
}
export interface RecoveryPolicyHost {
  now():number;
  observeFailure(context:Readonly<{runId:string;attemptId:string;receiptId:string;handoffId:string;candidateId:string}>):RecoveryObservation|null;
  readObservation(sourceRef:string,attemptId:string):Uint8Array|null;
  observeCandidate(context:Readonly<{runId:string;taskId:string;priorCandidateId:string;candidateId:string}>):Readonly<{authenticated:boolean;capable:boolean}>|null;
  resolveHandoffArtifact?(sourceRef:string,attemptId:string):Uint8Array|null;
  authorizeHandoffArtifact?(sourceRef:string,attemptId:string):boolean;
}

function ownData(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error('recovery_observation_invalid');
  const descriptors=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(descriptors).length!==keys.length)throw Error('recovery_observation_invalid');
  const copy:Record<string,unknown>={};for(const key of keys){const descriptor=descriptors[key];if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('recovery_observation_invalid');copy[key]=descriptor.value;}return copy;
}
function snapshotObservation(value:unknown):Readonly<RecoveryObservation>{
  const data=ownData(value,['cause','sourceRef','observedAtMs','externalEffects','retryableHostCode','quotaResetAtMs','independentQualityFailure','priorCandidateEligible']);
  if(!['transient','authentication','quota','capability-mismatch','quality-failure','policy-violation','unknown'].includes(data.cause as string)||!['not-applicable','confirmed','unknown'].includes(data.externalEffects as string)
    ||!Number.isSafeInteger(data.observedAtMs)||(data.observedAtMs as number)<0||(data.quotaResetAtMs!==null&&(!Number.isSafeInteger(data.quotaResetAtMs)||(data.quotaResetAtMs as number)<0))
    ||typeof data.retryableHostCode!=='boolean'||typeof data.independentQualityFailure!=='boolean'||typeof data.priorCandidateEligible!=='boolean')throw Error('recovery_observation_invalid');
  requireId(data.sourceRef as string);return Object.freeze(data as unknown as RecoveryObservation);
}
function authorityOf(value:Readonly<RecoveryObservation>):Readonly<RecoveryAuthoritySnapshot>{return Object.freeze({version:'cue-recovery-classification-v1',retryableHostCode:value.retryableHostCode,quotaResetAtMs:value.quotaResetAtMs,independentQualityFailure:value.independentQualityFailure,priorCandidateEligible:value.priorCandidateEligible});}
function snapshotAuthority(value:unknown):Readonly<RecoveryAuthoritySnapshot>{const data=ownData(value,['version','retryableHostCode','quotaResetAtMs','independentQualityFailure','priorCandidateEligible']);if(data.version!=='cue-recovery-classification-v1'||typeof data.retryableHostCode!=='boolean'||typeof data.independentQualityFailure!=='boolean'||typeof data.priorCandidateEligible!=='boolean'||(data.quotaResetAtMs!==null&&(!Number.isSafeInteger(data.quotaResetAtMs)||(data.quotaResetAtMs as number)<0)))throw Error('recovery_observation_invalid');return Object.freeze(data as unknown as RecoveryAuthoritySnapshot);}
function decodeObservationPayload(payload:Buffer):Readonly<{schemaVersion:'cue-failure-observation-v1'}&FailureObservationInput>{const parsed=JSON.parse(payload.toString()) as unknown;if(!parsed||typeof parsed!=='object'||types.isProxy(parsed)||Object.getPrototypeOf(parsed)!==Object.prototype)throw Error('recovery_observation_integrity');const hasAuthority=Object.hasOwn(parsed,'authority'),keys=['schemaVersion','observationId','runId','attemptId','receiptId','handoffId','cause','observedAtMs','sourceRef','sourceDigest','cleanupState','externalEffects',...(hasAuthority?['authority']:[])],data=ownData(parsed,keys);if(JSON.stringify(parsed)!==payload.toString()||data.schemaVersion!=='cue-failure-observation-v1'||!['transient','authentication','quota','capability-mismatch','quality-failure','policy-violation','unknown'].includes(data.cause as string)||!['not-applicable','confirmed','unknown'].includes(data.externalEffects as string)||data.cleanupState!=='verified-clean'||!Number.isSafeInteger(data.observedAtMs)||(data.observedAtMs as number)<0||typeof data.sourceDigest!=='string'||!/^[0-9a-f]{64}$/.test(data.sourceDigest))throw Error('recovery_observation_integrity');for(const key of ['observationId','runId','attemptId','receiptId','handoffId','sourceRef'])requireId(data[key] as string);if(hasAuthority)data.authority=snapshotAuthority(data.authority);return Object.freeze(data as unknown as {schemaVersion:'cue-failure-observation-v1'}&FailureObservationInput);}
function snapshotCandidateObservation(value:unknown):Readonly<{authenticated:boolean;capable:boolean}>|null{if(value===null||value===undefined)return null;const data=ownData(value,['authenticated','capable']);if(typeof data.authenticated!=='boolean'||typeof data.capable!=='boolean')throw Error('recovery_candidate_observation_invalid');return Object.freeze(data as {authenticated:boolean;capable:boolean});}

/** Durable append-only recovery facts. The store derives authority from existing bindings. */
export function createRecoveryPolicyStore(db:Ledger,host?:RecoveryPolicyHost){
  const handoffs=createHandoffActivityStore(db,{resolveArtifact:(ref,attempt)=>host?.resolveHandoffArtifact?.(ref,attempt)??null,authorizeArtifact:(ref,attempt)=>host?.authorizeHandoffArtifact?.(ref,attempt)===true});
  function original(runId:string):{plan:ValidatedPlan;envelopeHash:string;policyDigest:string;requirementsDigest:string}{
    requireId(runId); const row=db.prepare(`SELECT p.payload,p.digest,p.envelope_hash,q.policy_digest,q.requirements_digest FROM orchestration_plan p JOIN requirement_contract_binding q ON q.run_id=p.run_id WHERE p.run_id=?`).get(runId) as any;
    if(!row)throw Error('recovery_original_binding_missing'); const saved=JSON.parse(row.payload) as ValidatedPlan;
    const plan=validateTaskPlan(saved.approval,{revision:saved.revision,policyRevision:saved.approval.policyRevision,policyDigest:saved.approval.policyDigest,tasks:saved.tasks});
    if(plan.digest!==row.digest||plan.approval.policyDigest!==row.policy_digest)throw Error('recovery_original_binding_changed');
    return{plan,envelopeHash:row.envelope_hash,policyDigest:row.policy_digest,requirementsDigest:row.requirements_digest};
  }
  function registerScope(input:RecoveryScopeInput){
    const base=original(input.runId); const approval=db.prepare("SELECT id FROM approval_event WHERE id=? AND run_id=? AND envelope_hash=? AND decision='accept'").get(input.approvalId,input.runId,base.envelopeHash);
    if(!approval||db.prepare('SELECT 1 FROM orchestration_recovery_legacy WHERE run_id=?').get(input.runId))throw Error('recovery_scope_unavailable');
    const retry=db.prepare('SELECT payload,digest FROM orchestration_retry_contract WHERE run_id=?').get(input.runId) as any;if(!retry)throw Error('recovery_contract_missing');const retryData=JSON.parse(retry.payload);
    if(input.budgetIdentity!==input.runId||retryData.maxAttemptsTotal!==input.maxAttemptsTotal||retryData.deadlineMs!==input.deadlineMs||retryData.requirementsDigest!==base.requirementsDigest||retryData.planDigest!==base.plan.digest||retryData.policyDigest!==base.policyDigest
      ||!Number.isSafeInteger(input.maxAttemptsTotal)||input.maxAttemptsTotal<1||!Number.isSafeInteger(input.deadlineMs)||input.deadlineMs<=input.createdAtMs)throw Error('recovery_scope_limits');
    const payload={schemaVersion:'cue-recovery-scope-v1',...input,envelopeHash:base.envelopeHash,policyDigest:base.policyDigest,requirementsDigest:base.requirementsDigest,originalPlanDigest:base.plan.digest}; const encoded=bytes(payload),digest=hash(encoded.toString());
    return db.transaction(()=>{const old=db.prepare('SELECT payload FROM orchestration_recovery_scope WHERE run_id=?').get(input.runId) as any;if(old){if(!Buffer.from(old.payload).equals(encoded))throw Error('recovery_scope_replay_mismatch');return Object.freeze(payload);}
      db.prepare('INSERT INTO orchestration_recovery_scope VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(input.runId,base.envelopeHash,input.approvalId,base.policyDigest,base.requirementsDigest,base.plan.digest,input.budgetKind,requireId(input.budgetIdentity),input.maxAttemptsTotal,input.deadlineMs,digest,encoded);
      const canonical={revision:base.plan.revision,approval:base.plan.approval,tasks:base.plan.tasks,topologicalOrder:base.plan.topologicalOrder}; const planBytes=bytes(canonical);
      db.prepare('INSERT INTO orchestration_plan_revision VALUES(?,0,NULL,NULL,NULL,?,?,?,?,?,?)').run(input.runId,base.plan.digest,base.requirementsDigest,base.policyDigest,base.envelopeHash,input.createdAtMs,planBytes);
      for(const task of base.plan.tasks){const b=bytes(task);db.prepare("INSERT INTO orchestration_revision_step VALUES(?,0,?,'pending',?,?)").run(input.runId,task.id,hash(b.toString()),b);}
      return Object.freeze(payload);}).immediate();
  }
  function observeFailure(ids:{runId:string;attemptId:string}){
    requireId(ids.runId);requireId(ids.attemptId);
    const terminal=db.prepare(`SELECT a.run_id,a.task_id,a.candidate_id,a.state,a.cleanup_verified,r.receipt_id,r.payload,h.handoff_id
      FROM orchestration_attempt a JOIN orchestration_receipt r ON r.attempt_id=a.attempt_id
      JOIN orchestration_handoff h ON h.attempt_id=a.attempt_id AND h.receipt_id=r.receipt_id
      WHERE a.attempt_id=? AND a.run_id=? ORDER BY r.revision DESC LIMIT 1`).get(ids.attemptId,ids.runId) as any;
    if(!terminal||terminal.state!=='failed'||terminal.cleanup_verified!==1||handoffs.readTerminalIntegrity(ids.attemptId).status!=='verified')throw Error('failure_observation_unverified');
    const rawObserved=host?.observeFailure(Object.freeze({runId:ids.runId,attemptId:ids.attemptId,receiptId:terminal.receipt_id,handoffId:terminal.handoff_id,candidateId:terminal.candidate_id}))??null;
    const observed=rawObserved===null?null:snapshotObservation(rawObserved);
    const now=host?.now();
    if(!observed||!Number.isSafeInteger(now)||!Number.isSafeInteger(observed.observedAtMs)||observed.observedAtMs>(now as number)||!['transient','authentication','quota','capability-mismatch','quality-failure','policy-violation','unknown'].includes(observed.cause))throw Error('failure_observation_unavailable');
    requireId(observed.sourceRef);const resolvedProof=host?.readObservation(observed.sourceRef,ids.attemptId);if(!resolvedProof)throw Error('failure_observation_unavailable');const proof=Buffer.from(resolvedProof);
    const input:FailureObservationInput={observationId:`observation-${hash(`${ids.runId}\0${ids.attemptId}`).slice(0,48)}`,runId:ids.runId,attemptId:ids.attemptId,receiptId:terminal.receipt_id,handoffId:terminal.handoff_id,cause:observed.cause,observedAtMs:observed.observedAtMs,sourceRef:observed.sourceRef,sourceDigest:hash(proof),cleanupState:'verified-clean',externalEffects:observed.externalEffects,authority:authorityOf(observed)};
    const encoded=bytes({schemaVersion:'cue-failure-observation-v1',...input});const digest=hash(encoded.toString());
    return db.transaction(()=>{const old=db.prepare('SELECT payload FROM orchestration_failure_observation WHERE attempt_id=?').get(input.attemptId) as any;if(old){if(!Buffer.from(old.payload).equals(encoded))throw Error('failure_observation_replay_mismatch');return Object.freeze(input);}
      db.prepare('INSERT INTO orchestration_failure_observation VALUES(?,?,?,?,?,?,?,?,?)').run(input.observationId,input.runId,input.attemptId,input.receiptId,input.handoffId,input.cause,input.observedAtMs,digest,encoded);return Object.freeze(input);}).immediate();
  }
  function recordDecision(input:{decisionId:string;observationId:string;proposedCandidateId?:string}){
    requireId(input.decisionId);if(input.proposedCandidateId!==undefined)requireId(input.proposedCandidateId);
    if(db.inTransaction)throw Error('recovery_outer_transaction');
    return db.transaction(()=>{
    const observation=db.prepare('SELECT observation_id,run_id,attempt_id,receipt_id,handoff_id,cause,observed_at_ms,payload_sha256,payload FROM orchestration_failure_observation WHERE observation_id=?').get(input.observationId) as any;if(!observation)throw Error('recovery_observation_mismatch');
    const observationBody=decodeObservationPayload(Buffer.from(observation.payload));
    if(hash(observation.payload)!==observation.payload_sha256||observationBody.observationId!==observation.observation_id||observationBody.runId!==observation.run_id||observationBody.attemptId!==observation.attempt_id||observationBody.receiptId!==observation.receipt_id||observationBody.handoffId!==observation.handoff_id||observationBody.cause!==observation.cause||observationBody.observedAtMs!==observation.observed_at_ms)throw Error('recovery_observation_integrity');
    const existing=db.prepare('SELECT * FROM orchestration_recovery_decision WHERE observation_id=?').get(input.observationId) as any;
    if(existing){const disposition=readHeldRecoveryDisposition(db,observation.attempt_id),body=JSON.parse(Buffer.from(existing.payload).toString());if(!observationBody.authority&&body.action!=='stop')throw Error('recovery_observation_authority_missing');if(disposition==='stop'&&body.action!=='stop')throw Error('recovery_held_reconciled_stop');if(existing.decision_id!==input.decisionId||(input.proposedCandidateId!==undefined&&existing.selected_candidate_id!==input.proposedCandidateId)||hash(existing.payload)!==existing.digest||body.decisionId!==existing.decision_id||body.observationId!==existing.observation_id||body.runId!==existing.run_id||body.priorAttemptId!==existing.prior_attempt_id||body.action!==existing.action||body.sourceRevision!==existing.source_revision||body.destinationRevision!==existing.destination_revision||body.selectedCandidateId!==existing.selected_candidate_id)throw Error('recovery_decision_replay_mismatch');return Object.freeze(body);}
    if(db.prepare("SELECT 1 FROM orchestration_recovery_decision WHERE run_id=? AND action='stop'").get(observation.run_id))throw Error('recovery_run_sealed');
    const prior=db.prepare('SELECT task_id,candidate_id FROM orchestration_attempt WHERE attempt_id=?').get(observation.attempt_id) as any;
    const scope=db.prepare('SELECT * FROM orchestration_recovery_scope WHERE run_id=?').get(observation.run_id) as any;
    const scopeBody=JSON.parse(Buffer.from(scope.payload).toString());
    if(hash(scope.payload)!==scope.payload_sha256||scopeBody.runId!==scope.run_id||scopeBody.deadlineMs!==scope.deadline_ms||scopeBody.maxAttemptsTotal!==scope.max_attempts_total||scopeBody.originalPlanDigest!==scope.original_plan_digest||scopeBody.requirementsDigest!==scope.requirements_digest||scopeBody.policyDigest!==scope.policy_digest||scopeBody.envelopeHash!==scope.envelope_hash)throw Error('recovery_scope_integrity');
    const current=db.prepare('SELECT MAX(revision) revision FROM orchestration_plan_revision WHERE run_id=?').get(observation.run_id) as any;
    const priorRevision=db.prepare('SELECT revision FROM orchestration_attempt_revision WHERE attempt_id=?').get(observation.attempt_id) as any;
    if(!priorRevision||priorRevision.revision!==current.revision)throw Error('recovery_stale_revision');
    const planRow=db.prepare('SELECT plan_digest FROM orchestration_plan_revision WHERE run_id=? AND revision=?').get(observation.run_id,current.revision) as any;
    const plan=readRevision(observation.run_id,current.revision,planRow.plan_digest),task=plan.tasks.find(t=>t.id===prior.task_id);
    const saved=observationBody;
    if(!saved.authority||saved.authority.version!=='cue-recovery-classification-v1')throw Error('recovery_observation_authority_missing');
    const rawLive=host?.observeFailure(Object.freeze({runId:observation.run_id,attemptId:observation.attempt_id,receiptId:saved.receiptId,handoffId:saved.handoffId,candidateId:prior.candidate_id}))??null;
    const live=rawLive===null?null:snapshotObservation(rawLive);const resolvedLiveBytes=live&&host?.readObservation(live.sourceRef,observation.attempt_id);const liveBytes=resolvedLiveBytes&&Buffer.from(resolvedLiveBytes);
    if(!live||live.cause!==saved.cause||live.sourceRef!==saved.sourceRef||live.observedAtMs!==saved.observedAtMs||live.externalEffects!==saved.externalEffects||JSON.stringify(authorityOf(live))!==JSON.stringify(saved.authority)||!liveBytes||hash(liveBytes)!==saved.sourceDigest)throw Error('failure_observation_stale');
    const candidates=(task?.candidateIds??[]).filter(value=>value!==prior.candidate_id&&plan.approval.allowedCandidateIds.includes(value)).sort();
    let candidate:string|null=null,candidateObservation:Readonly<{authenticated:boolean;capable:boolean}>|null=null;
    for(const value of candidates){const status=snapshotCandidateObservation(host?.observeCandidate(Object.freeze({runId:observation.run_id,taskId:prior.task_id,priorCandidateId:prior.candidate_id,candidateId:value}))??null);if(status?.authenticated===true&&status.capable===true){candidate=value;candidateObservation=status;break;}}
    if(input.proposedCandidateId!==undefined&&input.proposedCandidateId!==candidate)throw Error('recovery_candidate_mismatch');
    // Snapshot the last host-owned value before final authority reads. No host callback
    // may run after this point, so a reentrant host cannot consume a slot after it was read.
    const nowMs=host?.now()??Number.NaN;
    const disposition=readHeldRecoveryDisposition(db,observation.attempt_id);
    const terminalHandoffVerified=handoffs.readTerminalIntegrity(observation.attempt_id).status==='verified';
    const writerLeaseReleasable=(db.prepare('SELECT write_in_progress FROM run WHERE id=?').get(observation.run_id) as any)?.write_in_progress===0;
    const attemptsUsed=(db.prepare('SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id=?').get(observation.run_id) as any).n;
    const budgetAvailable=scope.budget_kind==='monetary'
      ?createBudgetManager(db,{verifyFinalReceipt:()=>false}).summary(observation.run_id).remainingUnits>0n
      :createLocalInvocationBudget(db).summary(observation.run_id).remaining>0;
    const facts:RecoveryFacts={cause:observation.cause,priorCandidateId:prior.candidate_id,candidateId:candidate,candidateApproved:Boolean(candidate&&task?.candidateIds.includes(candidate)&&plan.approval.allowedCandidateIds.includes(candidate)),candidateAuthenticated:candidateObservation?.authenticated===true,candidateCapable:candidateObservation?.capable===true,terminalHandoffVerified,cleanupVerified:true,writerLeaseReleasable,externalEffects:saved.externalEffects,retryableHostCode:saved.authority.retryableHostCode,quotaResetAtMs:saved.authority.quotaResetAtMs,nowMs,deadlineMs:scope.deadline_ms,attemptsUsed,maxAttemptsTotal:scope.max_attempts_total,independentQualityFailure:saved.authority.independentQualityFailure,unchangedPlan:true,policySealed:disposition==='stop',priorCandidateEligible:saved.authority.priorCandidateEligible,budgetAvailable};
    const decision=decideRecovery(facts);
    const destination=decision.action==='stop'?null:decision.action==='replan'?current.revision+1:current.revision;
    const body={schemaVersion:'cue-recovery-decision-v1',decisionId:input.decisionId,observationId:input.observationId,runId:observation.run_id,priorAttemptId:observation.attempt_id,action:decision.action,selectedCandidateId:decision.selectedCandidateId,sourceRevision:current.revision,destinationRevision:destination,facts,digest:decision.digest};const encoded=bytes(body),digest=hash(encoded.toString());
    const old=db.prepare('SELECT payload FROM orchestration_recovery_decision WHERE observation_id=?').get(input.observationId) as any;if(old){if(!Buffer.from(old.payload).equals(encoded))throw Error('recovery_decision_replay_mismatch');return Object.freeze(body);}
    db.prepare('INSERT INTO orchestration_recovery_decision VALUES(?,?,?,?,?,?,?,?,?,?)').run(requireId(input.decisionId),observation.run_id,input.observationId,observation.attempt_id,decision.action,current.revision,destination,decision.selectedCandidateId,digest,encoded);return Object.freeze(body);
    }).immediate();
  }
  function appendRevision(input:{runId:string;decisionId:string;approval:PlanApproval;plan:ProposedPlan;createdAtMs:number}){
    if(db.inTransaction)throw Error('recovery_outer_transaction');
    return db.transaction(()=>{
    const base=original(input.runId),decision=db.prepare("SELECT source_revision,destination_revision,prior_attempt_id FROM orchestration_recovery_decision WHERE decision_id=? AND run_id=? AND action='replan'").get(input.decisionId,input.runId) as any;if(!decision)throw Error('replan_decision_required');
    const disposition=readHeldRecoveryDisposition(db,decision.prior_attempt_id);if(disposition==='stop')throw Error('recovery_held_reconciled_stop');
    const parent=db.prepare('SELECT plan_digest FROM orchestration_plan_revision WHERE run_id=? AND revision=?').get(input.runId,decision.source_revision) as any;if(!parent)throw Error('replan_parent_missing');
    if(JSON.stringify(input.approval)!==JSON.stringify(base.plan.approval))throw Error('replan_authority_changed'); const plan=validateTaskPlan(input.approval,input.plan);
    const requirements=new Set(base.plan.approval.requirementIds);if([...requirements].some(id=>!plan.tasks.some(t=>t.requirementIds.includes(id))))throw Error('replan_requirement_missing');
    const parentPlan=readRevision(input.runId,decision.source_revision,parent.plan_digest);
    for(const old of parentPlan.tasks){const next=plan.tasks.find(task=>task.id===old.id);if(next&&JSON.stringify(next.requirementIds)!==JSON.stringify(old.requirementIds))throw Error('replan_task_requirement_changed');}
    if(db.prepare("SELECT 1 FROM orchestration_attempt_revision ar JOIN orchestration_attempt a ON a.attempt_id=ar.attempt_id WHERE ar.run_id=? AND ar.revision=? AND a.state='running'").get(input.runId,decision.source_revision))throw Error('replan_running_attempt');
    const canonical={revision:plan.revision,approval:plan.approval,tasks:plan.tasks,topologicalOrder:plan.topologicalOrder};const encoded=bytes(canonical);
    const existing=db.prepare('SELECT plan_digest,payload FROM orchestration_plan_revision WHERE decision_id=?').get(input.decisionId) as any;if(existing){if(existing.plan_digest!==plan.digest||!Buffer.from(existing.payload).equals(encoded))throw Error('replan_replay_mismatch');return readRevision(input.runId,decision.destination_revision,plan.digest);}
      db.prepare('INSERT INTO orchestration_plan_revision VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(input.runId,decision.destination_revision,decision.source_revision,parent.plan_digest,input.decisionId,plan.digest,base.requirementsDigest,base.policyDigest,base.envelopeHash,input.createdAtMs,encoded);
      db.prepare("UPDATE orchestration_revision_step SET state='superseded' WHERE run_id=? AND revision=? AND state IN('pending','blocked')").run(input.runId,decision.source_revision);
      for(const task of plan.tasks){const b=bytes(task);db.prepare("INSERT INTO orchestration_revision_step VALUES(?,?,?,'pending',?,?)").run(input.runId,decision.destination_revision,task.id,hash(b.toString()),b);}return plan;
    }).immediate();
  }
  function readRevision(runId:string,revision:number,planDigest:string):ValidatedPlan{
    const row=db.prepare('SELECT * FROM orchestration_plan_revision WHERE run_id=? AND revision=? AND plan_digest=?').get(runId,revision,planDigest) as any;if(!row)throw Error('explicit_revision_missing');const p=JSON.parse(Buffer.from(row.payload).toString());const plan=validateTaskPlan(p.approval,{revision:p.revision,policyRevision:p.approval.policyRevision,policyDigest:p.approval.policyDigest,tasks:p.tasks});const scope=db.prepare('SELECT requirements_digest,policy_digest,envelope_hash FROM orchestration_recovery_scope WHERE run_id=?').get(runId) as any;if(plan.digest!==row.plan_digest||!scope||row.requirements_digest!==scope.requirements_digest||row.policy_digest!==scope.policy_digest||row.envelope_hash!==scope.envelope_hash)throw Error('revision_integrity');return plan;
  }
  return Object.freeze({registerScope,observeFailure,recordDecision,appendRevision,readRevision});
}
