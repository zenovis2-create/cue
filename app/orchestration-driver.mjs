import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { performance } from 'node:perf_hooks';
import { envelopeHash } from '../daemon/dist/src/envelope.js';
import { readSelectionPolicy, readRunSelectionPolicy, bindRunSelectionPolicy } from '../daemon/dist/src/selection/policy-store.js';
import { validateTaskPlan } from '../daemon/dist/src/orchestration/plan.js';
import { createOrchestrationStore } from '../daemon/dist/src/orchestration/store.js';
import { createRecoveryPolicyStore } from '../daemon/dist/src/orchestration/recovery-policy.js';
import { createProviderLifecycleStore } from '../daemon/dist/src/orchestration/provider-lifecycle.js';
import { verifyProviderLifecycleEvidence } from '../daemon/dist/src/orchestration/provider-lifecycle-evidence.js';
import { createStageEnvelopeBinder } from '../daemon/dist/src/orchestration/stage-envelope.js';
import { createAttemptStagingAuthorityCoordinator } from '../daemon/dist/src/orchestration/staging-authority.js';
import { createOrchestrationEngine, selectionRevisionRef, createLocalOrchestrationEngine, localSelectionRevisionRef } from '../daemon/dist/src/orchestration/engine.js';
import { readLocalSelectionPolicy, readRunLocalSelectionPolicy, bindRunLocalSelectionPolicy } from '../daemon/dist/src/selection/local-policy-store.js';
import { bindInitialDefault, readInitialDefault } from '../daemon/dist/src/selection/initial-default.js';
import { bindAccountIdentities, readAccountIdentities } from '../daemon/dist/src/orchestration/account-binding.js';
import { createExplorationBudgetStore } from '../daemon/dist/src/selection/exploration-budget.js';
import { createLocalInvocationBudget } from '../daemon/dist/src/local-invocation-budget.js';
import { createBudgetManager } from '../daemon/dist/src/budget.js';
import { createIntegrationRuntime } from '../daemon/dist/src/integration-runtime.js';
import { createRequirementContractStore, validateRequirementContracts } from '../daemon/dist/src/verification/requirements.js';
import { createAcceptanceVerifier, readAcceptanceHistory } from '../daemon/dist/src/verification/acceptance.js';
import { createGeneratedOutputStore } from '../daemon/dist/src/verification/generated-output.js';
import { captureChangeSet, observeChangeSet, registerNativeChangeJournal } from '../daemon/dist/src/change-records.js';
import { createFinalPublicationStore } from '../daemon/dist/src/final-publication.js';
import { stagedPublicationContractId } from './staged-publication-contract.mjs';
import { captureGoalProposal, bindGoalProposal, readBoundGoalProposal, readGoalTaskInstruction } from './goal-proposal.mjs';

const uncertainChangeStatuses = new Set(['unknown', 'outside-manifest', 'moved', 'type-changed']);
function changeObservationBlocksRecovery(observations) {
  return observations.some(value => uncertainChangeStatuses.has(value.status));
}

function frozenData(value, depth = 0) {
  if (depth > 12) throw Error('driver_input_depth');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    if (typeof value === 'string' && Buffer.byteLength(value) > 1_048_576) throw Error('driver_input_size');
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || types.isProxy(value)) throw Error('driver_plain_data_required');
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) throw Error('driver_plain_data_required');
  const keys = Reflect.ownKeys(value);
  if (keys.length > 1024) throw Error('driver_input_size');
  const copy = array ? [] : {};
  for (const key of keys) {
    if (array && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || key === '__proto__' || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error('driver_plain_data_required');
    if (array && !/^(0|[1-9][0-9]*)$/.test(key)) throw Error('driver_array_required');
    copy[key] = frozenData(descriptor.value, depth + 1);
  }
  if (array && (copy.length !== value.length || keys.length !== value.length + 1)) throw Error('driver_dense_array_required');
  return Object.freeze(copy);
}
function bound(value, max) { if (!Number.isSafeInteger(value) || value < 1 || value > max) throw Error('driver_invalid_limit'); return value; }
function exactFields(value, keys, code) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length !== keys.length
      || keys.some(key => !Object.hasOwn(value, key))) throw Error(code);
  return value;
}
const lifecycleDataFields=Object.freeze({
  'cancel-requested':['reasonDigest'],'client-cancel-acknowledged':['status'],'provider-terminal':['status','receiptDigest'],
  'local-controller-observed':['status','observationDigest'],'local-tree-observed':['status','observationDigest'],
  'cleanup-observed':['status','receiptDigest'],'billing-finalized':['status','providerReceiptDigest'],'lifecycle-sealed':[],
});
function lifecycleString(value,maximum=4096){if(typeof value!=='string'||value.length===0||Buffer.byteLength(value)>maximum||value.includes('\0'))throw Error('driver_lifecycle_input');return value;}
function snapshotLifecycleEvent(input){
  if(!input||typeof input!=='object'||types.isProxy(input)||Object.getPrototypeOf(input)!==Object.prototype)throw Error('driver_lifecycle_input');
  const descriptors=Object.getOwnPropertyDescriptors(input),names=Reflect.ownKeys(descriptors);
  if((names.length!==2&&names.length!==3)||names.some(name=>typeof name!=='string'||!['kind','data','references'].includes(name)||!descriptors[name]?.enumerable||!Object.hasOwn(descriptors[name],'value'))||!descriptors.kind||!descriptors.data)throw Error('driver_lifecycle_input');
  const kind=descriptors.kind.value;if(typeof kind!=='string'||!Object.hasOwn(lifecycleDataFields,kind))throw Error('driver_lifecycle_input');const expected=lifecycleDataFields[kind];
  const data=descriptors.data.value;if(!data||typeof data!=='object'||types.isProxy(data)||Object.getPrototypeOf(data)!==Object.prototype)throw Error('driver_lifecycle_input');
  const dataDescriptors=Object.getOwnPropertyDescriptors(data),dataNames=Reflect.ownKeys(dataDescriptors);
  if(dataNames.length!==expected.length||dataNames.some(name=>typeof name!=='string'||!expected.includes(name)||!dataDescriptors[name]?.enumerable||!Object.hasOwn(dataDescriptors[name],'value')))throw Error('driver_lifecycle_input');
  const safeData=Object.freeze(Object.fromEntries(expected.map(name=>[name,lifecycleString(dataDescriptors[name].value)]))),submitted=descriptors.references?.value;
  if(submitted===undefined)return Object.freeze({kind,data:safeData});
  if(!Array.isArray(submitted)||types.isProxy(submitted)||Object.getPrototypeOf(submitted)!==Array.prototype)throw Error('driver_lifecycle_input');const arrayFields=Object.getOwnPropertyDescriptors(submitted),lengthField=arrayFields.length;
  if(!lengthField||!Object.hasOwn(lengthField,'value')||!Number.isSafeInteger(lengthField.value)||lengthField.value<0||lengthField.value>64||Reflect.ownKeys(arrayFields).length!==lengthField.value+1)throw Error('driver_lifecycle_input');
  const references=[];for(let index=0;index<lengthField.value;index++){const item=arrayFields[String(index)];if(!item?.enumerable||!Object.hasOwn(item,'value'))throw Error('driver_lifecycle_input');const value=item.value;if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error('driver_lifecycle_input');const fields=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(fields);if(keys.length!==3||keys.some(name=>typeof name!=='string'||!['refType','label','reference'].includes(name)||!fields[name]?.enumerable||!Object.hasOwn(fields[name],'value')))throw Error('driver_lifecycle_input');references.push(Object.freeze({refType:lifecycleString(fields.refType.value,128),label:lifecycleString(fields.label.value,128),reference:lifecycleString(fields.reference.value,1024)}));}
  return Object.freeze({kind,data:safeData,references:Object.freeze(references)});
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Main-process composition only. Host is trusted configuration, never renderer data.
 * Approved retries require host-verified clean transient failures. Acceptance verifies requirements;
 * runtime completion alone cannot complete the parent task. Every model/runtime
 * observation remains subject to existing admission and host evidence callbacks. */
export function createOrchestrationDriver({ db, host, assertRunSource }) {
  if(assertRunSource!==undefined&&typeof assertRunSource!=='function')throw Error('driver_source_assertion_invalid');
  function assertSource(runId){if(assertRunSource===undefined)return;const outcome=assertRunSource(runId);if(outcome!==undefined){if(outcome&&typeof outcome.then==='function')void outcome.catch(()=>{});throw Error('driver_source_assertion_async');}}
  if (host.accountingKind !== undefined && host.accountingKind !== 'local-invocation') throw Error('driver_accounting_kind');
  const local = host.accountingKind === 'local-invocation';
  const revisionRef = local ? localSelectionRevisionRef : selectionRevisionRef;
  const readPolicy = local ? readLocalSelectionPolicy : readSelectionPolicy;
  const readRunPolicy = local ? readRunLocalSelectionPolicy : readRunSelectionPolicy;
  const bindPolicy = local ? bindRunLocalSelectionPolicy : bindRunSelectionPolicy;
  const prepared = new Map(), lifecycleAdmissions = new Map();
  const stagingContracts = new Map(), openedStagingContracts = new Set(), deferredFinishes = new WeakMap(), publishingAttempts = new Set(), unsupportedStagingAttempts = new Set(), failedStagingAttempts = new Set();
  let closing = false;
  const now = () => { const value = host.now(); if (!Number.isSafeInteger(value) || value < 0) throw Error('driver_invalid_clock'); return value; };
  const waitHost = host.wait ? { ...host.wait, now } : undefined;
  const store = createOrchestrationStore(db, { ...host.authority, ...(waitHost ? { wait: waitHost } : {}) });
  const recovery = createRecoveryPolicyStore(db, host.recovery ? { ...host.recovery, now,
    resolveHandoffArtifact: host.authority.resolveHandoffArtifact,
    authorizeHandoffArtifact: host.authority.authorizeHandoffArtifact } : undefined);
  const providerLifecycle = createProviderLifecycleStore(db, { nowMs: now });
  const budget = local ? createLocalInvocationBudget(db) : createBudgetManager(db, { verifyFinalReceipt: receipt => host.verifyFinalBilling(receipt) === true });
  const explorationBudget = local ? null : createExplorationBudgetStore(db);
  const acceptance = host.acceptance ? createAcceptanceVerifier(db, { ...host.acceptance,
    isManifestCurrent(context, manifest) {
      const entry = prepared.get(context.runId);
      if (!entry || entry.cancelled || closing) return false;
      if (deadlineReached(entry)) { expire(entry); return false; }
      const current = host.acceptance.isManifestCurrent(context, manifest);
      if (deadlineReached(entry)) { expire(entry); return false; }
      return current;
    },
  }) : null;
  const resolveRequirementChecker = (id, revision) => {
    if (host.resolveRequirementChecker) return host.resolveRequirementChecker(id, revision);
    const checker = host.acceptance?.resolveChecker(id, revision);
    return checker ? { id: checker.id, revision: checker.revision, kinds: checker.kinds, evidencePolicies: checker.evidencePolicies } : undefined;
  };
  const requirementsStore = createRequirementContractStore(db, { now, resolveChecker: resolveRequirementChecker });
  // This instance binds/reads approval data only; it cannot authorize observations.
  const generatedStore = createGeneratedOutputStore(db, { now, authorizeObservation: () => false });
  const finalPublication = host.finalPublication;
  const executionStagingHost=host.executionStaging;
  const stagingCoordinator=executionStagingHost?createAttemptStagingAuthorityCoordinator(db,{now,inspectCleanRoot:executionStagingHost.inspectCleanRoot,factory:executionStagingHost.factory}):null;
  if (finalPublication !== undefined && (!finalPublication || typeof finalPublication !== 'object' || types.isProxy(finalPublication)
      || typeof finalPublication.authorize !== 'function' || typeof finalPublication.openStagedAttempt !== 'function'
      || typeof finalPublication.readStagedReplacement !== 'function' || (finalPublication.execute !== undefined && typeof finalPublication.execute !== 'function'))) throw Error('driver_final_publication_host');
  const finalPublicationFunctions=finalPublication&&Object.freeze({authorize:finalPublication.authorize,openStagedAttempt:finalPublication.openStagedAttempt,readStagedReplacement:finalPublication.readStagedReplacement,execute:finalPublication.execute});
  function assertAccount(entry,candidateId) {
    if(local)return;
    const catalog=host.catalog,lookup=catalog.lookup(candidateId);
    const bound=readAccountIdentities(db,entry.run.runId).find(value=>value.candidateId===candidateId);
    if(host.catalog!==catalog)throw Error('driver_account_identity_mismatch');
    const r=lookup.record;if(!bound||!lookup.available||!r||r.authReference===null||r.subjectDigest===null
      ||bound.authReference!==r.authReference||bound.toolId!==r.toolId||bound.sourceVersion!==r.sourceVersion||bound.subjectDigest!==r.subjectDigest
      ||bound.runId!==entry.run.runId||bound.planDigest!==entry.summary.planDigest||bound.policyDigest!==entry.plan.approval.policyDigest||bound.envelopeHash!==entry.run.envelopeHash
      ||bound.modelId!==(r.binding?.modelId??null)||bound.endpointId!==(r.binding?.endpointId??null))throw Error('driver_account_identity_mismatch');
  }
  const binder = createStageEnvelopeBinder(db, {
    now,
    resolveScope() { throw Error('driver_read_binder_cannot_grant'); },
    authorizeStage: context => host.authority.authorizeStage(context) === true,
  });
  const launchContexts = new WeakMap();
  const runtime = createIntegrationRuntime({
    ...host.runtime,
    verifyCleanup(context, execution) {
      return host.runtime.verifyCleanup(launchContexts.get(context) ?? context, execution);
    },
    ...(host.runtime.verifyFailedStartCleanup ? { verifyFailedStartCleanup(context) {
      return host.runtime.verifyFailedStartCleanup(launchContexts.get(context) ?? context);
    } } : {}),
    readLaunchIntent(attemptId) { return store.handoffActivity.readLaunchIntent(attemptId); },
    recordAttemptIdentity(input) {
      const identityId = `identity-${createHash('sha256').update(`${input.attemptId}\0${input.subjectDigest}`).digest('hex').slice(0,48)}`;
      store.handoffActivity.recordAttemptIdentity({ identityId, attemptId: input.attemptId,
        subjectDigest: input.subjectDigest, durableRef: input.durableRef, observedAtMs: input.observedAtMs });
    },
    recordActivity(attemptId, kind, data) {
      const attempt = db.prepare('SELECT run_id,task_id,state FROM orchestration_attempt WHERE attempt_id=?').get(attemptId);
      if (!attempt || attempt.state !== 'running') throw Error('driver_activity_terminal');
      const latest = db.prepare('SELECT MAX(ordinal) n FROM orchestration_activity WHERE attempt_id=?').get(attemptId).n ?? 0;
      const eventId = `event-${createHash('sha256').update(`${attemptId}\0${latest + 1}\0${kind}`).digest('hex').slice(0,48)}`;
      store.activity({ runId: attempt.run_id, taskId: attempt.task_id, attemptId, eventId, ordinal: latest + 1, kind, observedAtMs: now(), data });
    },
    recordLifecycle(attemptId, event) {
      const submitted=snapshotLifecycleEvent(event);
      const prior=lifecycleAdmissions.get(attemptId)??Promise.resolve();
      const operation=prior.catch(()=>{}).then(async()=>{
        const attempt=db.prepare('SELECT run_id,task_id,candidate_id,state FROM orchestration_attempt WHERE attempt_id=?').get(attemptId);
        if(!attempt||attempt.state!=='running'||closing)throw Error('driver_lifecycle_terminal');
        let evidenceBinding=null;
        if(submitted.kind==='provider-terminal'||submitted.kind==='billing-finalized'){
          const receiptReferences=(submitted.references??[]).filter(reference=>reference.label==='provider-receipt');
          if(receiptReferences.length!==1)throw Error('driver_lifecycle_evidence_reference');
          const lookup=host.catalog.lookup(attempt.candidate_id),record=lookup.record;
          const account=readAccountIdentities(db,attempt.run_id).find(value=>value.candidateId===attempt.candidate_id);
          if(!lookup.available||!record||record.authReference===null||record.subjectDigest===null||!account
            ||account.authReference!==record.authReference||account.toolId!==record.toolId||account.sourceVersion!==record.sourceVersion||account.subjectDigest!==record.subjectDigest)throw Error('driver_lifecycle_evidence_identity');
          evidenceBinding=Object.freeze({runId:attempt.run_id,taskId:attempt.task_id,attemptId,candidateId:attempt.candidate_id,
            providerId:record.toolId,providerRevision:record.sourceVersion,accountReference:account.authReference,accountDigest:account.digest,subjectDigest:account.subjectDigest,
            kind:submitted.kind,status:submitted.data.status,receiptReference:receiptReferences[0].reference,
            receiptDigest:submitted.kind==='provider-terminal'?submitted.data.receiptDigest:submitted.data.providerReceiptDigest});
          await verifyProviderLifecycleEvidence(evidenceBinding,host.lifecycleEvidence?.verify,host.lifecycleEvidence?.timeoutMs??1000);
        }
        return db.transaction(()=>{
          const current=db.prepare('SELECT run_id,task_id,candidate_id,state FROM orchestration_attempt WHERE attempt_id=?').get(attemptId);
          if(!current||current.state!=='running'||closing||current.run_id!==attempt.run_id||current.task_id!==attempt.task_id||current.candidate_id!==attempt.candidate_id)throw Error('driver_lifecycle_terminal');
          if(evidenceBinding){
            const lookup=host.catalog.lookup(current.candidate_id),record=lookup.record;
            const account=readAccountIdentities(db,current.run_id).find(value=>value.candidateId===current.candidate_id);
            if(!lookup.available||!record||!account||record.toolId!==evidenceBinding.providerId||record.sourceVersion!==evidenceBinding.providerRevision
              ||record.authReference!==evidenceBinding.accountReference||record.subjectDigest!==evidenceBinding.subjectDigest||account.digest!==evidenceBinding.accountDigest
              ||account.authReference!==evidenceBinding.accountReference||account.subjectDigest!==evidenceBinding.subjectDigest)throw Error('driver_lifecycle_evidence_changed');
          }
          const latest=db.prepare('SELECT MAX(ordinal) n FROM provider_lifecycle_event WHERE attempt_id=?').get(attemptId).n??0,ordinal=latest+1;
          const eventId=`lifecycle-${createHash('sha256').update(`${attemptId}\0${ordinal}\0${submitted.kind}`).digest('hex').slice(0,48)}`;
          const recorded=providerLifecycle.append({runId:current.run_id,taskId:current.task_id,attemptId,candidateId:current.candidate_id,eventId,ordinal,kind:submitted.kind,data:submitted.data});
          for(const [index,reference] of (submitted.references??[]).entries()){
            const bindingId=`binding-${createHash('sha256').update(`${eventId}\0${index}\0${reference.refType}\0${reference.label}`).digest('hex').slice(0,48)}`;
            providerLifecycle.bindReference({bindingId,runId:current.run_id,taskId:current.task_id,attemptId,candidateId:current.candidate_id,eventId,refType:reference.refType,label:reference.label,reference:reference.reference});
          }
          return recorded;
        }).immediate();
      });
      lifecycleAdmissions.set(attemptId,operation);operation.finally(()=>{if(lifecycleAdmissions.get(attemptId)===operation)lifecycleAdmissions.delete(attemptId);}).catch(()=>{});
      return operation;
    },
    resolveCandidate(candidateId, attemptId, role) {
      const staged=binder.read(attemptId),preparedEntry=staged&&prepared.get(staged.workflowRunId);if(preparedEntry)assertAccount(preparedEntry,candidateId);
      if (!host.catalog.lookup(candidateId).available) return undefined;
      const stage = binder.read(attemptId);
      if (!stage) return undefined;
      const entry = prepared.get(stage.workflowRunId);
      const candidate = host.runtime.resolveCandidate(candidateId, attemptId, role, stage);
      if (!entry || !candidate) return undefined;
      assertAccount(entry,candidateId);
      const stagedContract=stagingContracts.get(attemptId);
      if(stagedContract&&(!finalPublication||candidate.stagedPublication!=='attempt-owned-existing-files-v1')){unsupportedStagingAttempts.add(attemptId);return undefined;}
      if(candidate.kind==='agent'&&(candidate.typedActivitySource!=='host-codex-controller-v1'||candidate.durableExecutionRef!=='session-handle-v1'))return undefined;
      if((candidate.kind==='model'||candidate.kind==='checker')&&(candidate.typedActivitySource!=='isolated-generated-v1'||candidate.durableExecutionRef!=='session-handle-v1'))return undefined;
      const launch = candidate.launch.bind(candidate);
      return Object.freeze({ kind: candidate.kind, supportedRoles: candidate.supportedRoles,
        cancellation: candidate.cancellation, usage: candidate.usage, availability: candidate.availability,
        typedActivitySource:candidate.typedActivitySource,durableExecutionRef:candidate.durableExecutionRef,
        buildCurrentSubject: candidate.buildCurrentSubject.bind(candidate), evidenceReferences: candidate.evidenceReferences.bind(candidate),
        async launch(context) {
          assertSource(entry.run.runId);
          assertAccount(entry,candidateId);
          if (prepared.get(stage.workflowRunId) !== entry || entry.cancelled || closing) throw Error('driver_launch_cancelled');
          if (deadlineReached(entry)) { expire(entry); throw Error('driver_launch_deadline'); }
          if (Date.parse(stage.envelope.expires_at) <= now()) throw Error('driver_launch_approval_expired');
          assertAccount(entry,candidateId);
          if(prepared.get(stage.workflowRunId)!==entry||entry.cancelled||closing)throw Error('driver_launch_cancelled');
          const account=local?undefined:readAccountIdentities(db,entry.run.runId).find(value=>value.candidateId===candidateId);
          const contract=stagingContracts.get(context.runId);
          const actions=stage.envelope.allowed_actions,writable=actions.includes('file_change');
          if(actions.some(action=>!['read','list','search','file_change'].includes(action))){
            unsupportedStagingAttempts.add(context.runId);throw Error('driver_effect_action_unsupported');
          }
          if(writable&&(!entry.stagingPrepared||!contract||!finalPublication||candidate.stagedPublication!=='attempt-owned-existing-files-v1')){
            unsupportedStagingAttempts.add(context.runId);throw Error('driver_writable_staging_required');
          }
          if(contract&&!openedStagingContracts.has(contract.contractId)){
            try{
              const opened=frozenData(await boundedCall(Promise.resolve(finalPublicationFunctions.openStagedAttempt(contract)),Math.max(1,Math.floor(entry.configuration.limits.launchTimeoutMs/2))));
              exactFields(opened,['contractId'],'driver_staging_registration');
              if(opened.contractId!==contract.contractId||host.finalPublication!==finalPublication||finalPublication.openStagedAttempt!==finalPublicationFunctions.openStagedAttempt||finalPublication.readStagedReplacement!==finalPublicationFunctions.readStagedReplacement||prepared.get(stage.workflowRunId)!==entry||entry.cancelled||closing||deadlineReached(entry)||stagingContracts.get(context.runId)!==contract)throw Error('driver_staging_registration');
              openedStagingContracts.add(contract.contractId);
            }catch(error){failedStagingAttempts.add(context.runId);throw error;}
          }
          if(writable&&(!entry.stagingPrepared||stagingContracts.get(context.runId)!==contract||!finalPublication||candidate.stagedPublication!=='attempt-owned-existing-files-v1')){
            unsupportedStagingAttempts.add(context.runId);throw Error('driver_writable_staging_required');
          }
          const baseContext = account ? { ...context, accountIdentity:Object.freeze({reference:account.authReference,digest:account.digest}) } : context;
          const goalTaskInstruction=entry.goalProposal?readGoalTaskInstruction(db,entry.run.runId,entry.plan.digest,stage.taskId):null;
          if(entry.goalProposal&&goalTaskInstruction.proposalRef!==entry.goalProposal.ref)throw Error('driver_goal_proposal_drift');
          const launchContext = Object.freeze({ ...baseContext, ...(contract?{stagedPublication:contract}:{}), ...(goalTaskInstruction?{goalTaskInstruction}:{}) });
          launchContexts.set(context, launchContext);
          return launch(launchContext);
        },
      });
    },
    authorizeRun(attemptId, candidateId, role) {
      const stage = binder.read(attemptId);
      const entry = stage && prepared.get(stage.workflowRunId);
      if (!entry || entry.cancelled || closing || Date.parse(stage.envelope.expires_at) <= now()) return false;
      if (deadlineReached(entry)) { expire(entry); return false; }
      const authorized = host.runtime.authorizeRun(attemptId, candidateId, role, stage) === true;
      if (deadlineReached(entry)) { expire(entry); return false; }
      return authorized && !entry.cancelled && !closing && Date.parse(stage.envelope.expires_at) > now();
    },
  });
  const engineStore = Object.freeze({ ...store, finish(execution) {
    if((execution.outcome==='succeeded'||execution.outcome==='failed')&&execution.cleanup==='clean'&&stagingContracts.has(execution.attemptId)){
      if(execution.outcome==='failed')store.prepareFinish(execution);
      const deferred=Object.freeze({state:'blocked',acceptance:'unverified',launchRequired:false});deferredFinishes.set(deferred,execution);return deferred;
    }
    return store.finish(execution);
  } });
  const engine = (local ? createLocalOrchestrationEngine : createOrchestrationEngine)(db, { store:engineStore, budget, runtime }, {
    ...host.engine, now,
    observeCandidates(request, task) {
      return host.engine.observeCandidates(request, task).map(candidate => ({ ...candidate,
        checks: { ...candidate.checks, eligible: candidate.checks.eligible && host.catalog.lookup(candidate.id).available } }));
    },
    observeCandidate(request, task) {
      const candidate = host.engine.observeCandidate(request, task);
      return { ...candidate, eligible: candidate.eligible && host.catalog.lookup(candidate.candidateId).available };
    },
    authorizeExecution(context) {
      const entry = prepared.get(context.request.runId);
      return Boolean(entry && !entry.cancelled && !closing && host.engine.authorizeExecution(context) === true);
    },
    isStagingExecution(context){const entry=prepared.get(context.request.runId);return Boolean(entry?.stagingPrepared&&context.task.role==='implementation'&&entry.configuration.changeTargets?.some(target=>target.taskId===context.task.id));},
    prepareStagingSetup(context){
      const entry=prepared.get(context.request.runId);if(!entry?.stagingPrepared)return false;
      const lookup=host.catalog.lookup(context.candidateId);if(!stagingCoordinator||!lookup.available||!lookup.record?.subjectDigest)throw Error('driver_execution_staging_unavailable');
      stagingCoordinator.persistSetup({runId:entry.run.runId,taskId:context.task.id,attemptId:context.request.attemptId,candidateId:context.candidateId,expectedSubjectDigest:lookup.record.subjectDigest,prepared:entry.stagingPrepared});return true;
    },
    activateStaging(context){
      const entry=prepared.get(context.request.runId);if(!entry?.stagingPrepared)throw Error('driver_prepare_missing');
      if(entry.cancelled||closing||deadlineReached(entry)||host.engine.authorizeExecution(context)!==true)throw Error('driver_execution_staging_cancelled');
      const stage=host.stage(context,entry.run),lookup=host.catalog.lookup(context.candidateId);if(!lookup.available||!lookup.record?.subjectDigest)throw Error('driver_execution_staging_unavailable');
      const stageBinder=createStageEnvelopeBinder(db,{now,resolveScope(id,plan){if(plan.digest!==entry.plan.digest)throw Error('driver_plan_mismatch');const grant=entry.configuration.scopes.find(value=>value.id===id);if(!grant)throw Error('driver_scope_missing');return grant;},authorizeStage:stageContext=>host.authority.authorizeStage(stageContext)===true});
      const request={workflowRunId:entry.run.runId,taskId:context.task.id,attemptId:context.request.attemptId,...(context.request.revision!==undefined?{revision:context.request.revision,planDigest:context.request.planDigest}:{}),parentEnvelope:entry.run.envelope,stage};
      stagingCoordinator.prepareExecution({runId:entry.run.runId,taskId:context.task.id,attemptId:context.request.attemptId,candidateId:context.candidateId,expectedSubjectDigest:lookup.record.subjectDigest,prepared:entry.stagingPrepared,stageRequest:request,bind:value=>stageBinder.bind(value)});return undefined;
    },
    authorizeStagingLaunch(context){const entry=prepared.get(context.request.runId);if(!entry||entry.cancelled||closing||deadlineReached(entry)||host.engine.authorizeExecution(context)!==true)return false;assertAccount(entry,context.candidateId);return Boolean(db.prepare(`SELECT 1 FROM attempt_staging_setup s JOIN attempt_staging_authority sa USING(attempt_id) JOIN orchestration_attempt a ON a.attempt_id=s.attempt_id AND a.run_id=s.run_id AND a.task_id=s.task_id AND a.candidate_id=s.candidate_id JOIN orchestration_step os ON os.run_id=a.run_id AND os.task_id=a.task_id JOIN workspace_write_lease w ON w.run_id=s.run_id AND w.worktree_realpath=s.publication_worktree_realpath AND w.acquired_at=a.lease_acquired_at JOIN orchestration_account_identity i ON i.run_id=s.run_id AND i.candidate_id=s.candidate_id WHERE s.attempt_id=? AND a.state='running' AND os.state='running' AND sa.execution_worktree_realpath=(SELECT worktree_realpath FROM envelope WHERE envelope_hash=sa.stage_envelope_hash) AND i.payload->>'subjectDigest'=s.expected_subject_digest AND s.factory_protocol=? AND s.factory_sha256=? AND NOT EXISTS(SELECT 1 FROM attempt_staging_cleanup c WHERE c.attempt_id=s.attempt_id)`).get(context.request.attemptId,executionStagingHost.factory.protocol,executionStagingHost.factory.sha256));},
    prepareExecution(context) {
      const entry = prepared.get(context.request.runId);
      if (!entry) throw Error('driver_prepare_missing');
      const stage = host.stage(context, entry.run);
      const stageBinder = createStageEnvelopeBinder(db, { now,
        resolveScope(id, plan) {
          if (plan.digest !== entry.plan.digest) throw Error('driver_plan_mismatch');
          const grant = entry.configuration.scopes.find(value => value.id === id);
          if (!grant) throw Error('driver_scope_missing'); return grant;
        },
        authorizeStage: stageContext => host.authority.authorizeStage(stageContext) === true,
      });
      const bindRequest={ workflowRunId: entry.run.runId, taskId: context.task.id, attemptId: context.request.attemptId,
        ...(context.request.revision!==undefined?{revision:context.request.revision,planDigest:context.request.planDigest}:{}),
        parentEnvelope: entry.run.envelope, stage };
      stageBinder.bind(bindRequest);
      return undefined;
    },
    recordLaunchIntent(context) {
      const stageBinder = createStageEnvelopeBinder(db, { now,
        resolveScope() { throw Error('driver_read_binder_cannot_grant'); },
        authorizeStage: stageContext => host.authority.authorizeStage(stageContext) === true,
      });
      const binding = stageBinder.read(context.request.attemptId);
      const lookup = host.catalog.lookup(context.candidateId);
      assertAccount(entryFor(context.request.runId),context.candidateId);
      const selection = db.prepare('SELECT digest FROM attempt_selection WHERE attempt_id=?').get(context.request.attemptId);
      if (!binding || !lookup.available || !lookup.record || lookup.record.subjectDigest === null || !selection) throw Error('driver_launch_provenance_unavailable');
      const stagingSetup=db.prepare('SELECT candidate_id,expected_subject_digest FROM attempt_staging_setup WHERE attempt_id=?').get(context.request.attemptId);
      if(stagingSetup&&(stagingSetup.candidate_id!==context.candidateId||stagingSetup.expected_subject_digest!==lookup.record.subjectDigest))throw Error('driver_staging_subject_mismatch');
      store.handoffActivity.recordLaunchIntent({ runId: context.request.runId, taskId: context.task.id,
        attemptId: context.request.attemptId, candidateId: context.candidateId, selectionDigest: selection.digest,
        expectedSubjectDigest: lookup.record.subjectDigest,
        tool: { id: lookup.record.toolId, revision: lookup.record.sourceVersion || 'unknown' },
        model: lookup.record.binding ? { id: lookup.record.binding.modelId, revision: 'unknown' } : null,
        parentEnvelopeHash: binding.parentEnvelopeHash, stageEnvelopeHash: binding.envelopeHash,
        planDigest: context.plan.digest, policyDigest: context.plan.approval.policyDigest });
      const writable = binding.envelope.allowed_actions.includes('file_change');
      const targets = entryFor(context.request.runId).summary.changeTargets?.filter(target => target.taskId === context.task.id) ?? [];
      if (writable && !targets.length) throw Error('driver_change_targets_missing');
      if (!writable && targets.length) throw Error('driver_change_targets_readonly');
      if (writable) {
        const changeSetId=`changes-${createHash('sha256').update(context.request.attemptId).digest('hex').slice(0,48)}`;
        captureChangeSet(db, { changeSetId,
          runId:context.request.runId,taskId:context.task.id,attemptId:context.request.attemptId,stageEnvelopeHash:binding.envelopeHash,
          launchIntentId:context.request.attemptId,worktree:binding.publicationWorktreeRealpath,
          targets:targets.map(target=>target.relativePath),limits:{maxTargets:targets.length,maxBackupBytes:Math.max(...targets.map(target=>target.maxBackupBytes))},nowMs:now() });
        if(entryFor(context.request.runId).summary.stagedPublication){
          const contract=Object.freeze({version:'cue-staged-existing-files-v1',contractId:stagedPublicationContractId(context.request.attemptId,changeSetId),
            runId:context.request.runId,taskId:context.task.id,attemptId:context.request.attemptId,changeSetId,worktreeRealpath:binding.publicationWorktreeRealpath,stagingOnly:true,
            targets:Object.freeze(targets.map(target=>Object.freeze({relativePath:target.relativePath,maxBytes:target.maxBackupBytes}))) });
          stagingContracts.set(context.request.attemptId,contract);
        }
      }
      return undefined;
    },
  });
  function entryFor(runOrId) {
    const id = typeof runOrId === 'string' ? runOrId : runOrId?.runId;
    const entry = prepared.get(id); if (!entry) throw Error('driver_prepare_missing');
    if (typeof runOrId !== 'string' && JSON.stringify(frozenData(runOrId)) !== entry.runJson) throw Error('driver_run_changed');
    assertPersisted(entry); return entry;
  }
  function assertPersisted(entry) {
    assertSource(entry.run.runId);
    const row = db.prepare('SELECT task_id,envelope_hash FROM run WHERE id=?').get(entry.run.runId);
    const plan = entry.activeRevision
      ? db.prepare('SELECT plan_digest digest,envelope_hash FROM orchestration_plan_revision WHERE run_id=? AND revision=? AND plan_digest=?').get(entry.run.runId,entry.activeRevision.revision,entry.activeRevision.planDigest)
      : db.prepare('SELECT digest,envelope_hash FROM orchestration_plan WHERE run_id=?').get(entry.run.runId);
    const binding = readRunPolicy(db, entry.run.runId);
    const initialDefault = readInitialDefault(db, entry.run.runId);
    if (!row || row.task_id !== entry.run.taskId || row.envelope_hash !== entry.run.envelopeHash
        || !plan || plan.digest !== entry.plan.digest || plan.envelope_hash !== entry.run.envelopeHash
        || !binding || binding.snapshot.digest !== entry.plan.approval.policyDigest
        || revisionRef(binding.snapshot) !== entry.plan.approval.policyRevision) throw Error('driver_preparation_not_persisted');
    if(entry.goalProposal){
      const stored=readBoundGoalProposal(db,entry.run.runId,entry.plan.digest);
      if(stored.ref!==entry.goalProposal.ref||stored.bytes!==entry.goalProposal.bytes
        ||stored.proposedPlan.revision!==entry.plan.revision)throw Error('driver_goal_proposal_drift');
    }
    if(!local){const expected=[...new Set(entry.summary.stages.flatMap(task=>task.candidateIds))].sort();const actual=readAccountIdentities(db,entry.run.runId);if(actual.length!==expected.length||expected.some((id,index)=>actual[index]?.candidateId!==id))throw Error('driver_account_identity_mismatch');for(const id of expected)assertAccount(entry,id);}
    if (entry.summary.initialDefault
      ? (!initialDefault || initialDefault.digest !== entry.summary.initialDefault.digest
          || initialDefault.defaultCandidateId !== entry.summary.initialDefault.candidateId
          || initialDefault.conservativeEstimate.conservativeMaxCost !== entry.summary.initialDefault.conservativeMaxCost
          || initialDefault.conservativeEstimate.conservativeMaxTimeMs !== entry.summary.initialDefault.conservativeMaxTimeMs
          || initialDefault.conservativeEstimate.currency !== entry.summary.initialDefault.currency)
      : initialDefault !== null) throw Error('driver_initial_default_mismatch');
    const authorization=explorationBudget?.readAuthorization(entry.run.runId)??null;
    if(entry.exploration){
      if(!authorization||authorization.payloadSha256!==entry.exploration.authorizationDigest||authorization.candidateId!==entry.exploration.candidateId||authorization.limitUnits!==entry.exploration.limitUnits)throw Error('driver_exploration_mismatch');
      const consent=db.prepare('SELECT envelope_hash,plan_digest,policy_digest,authorization_digest,candidate_id,task_ids_json,consent_digest FROM exploration_consent WHERE run_id=?').get(entry.run.runId);
      if(!consent&&entry.activated)throw Error('exploration_consent_required');
      if(consent&&(consent.envelope_hash!==entry.run.envelopeHash||consent.plan_digest!==entry.plan.digest||consent.policy_digest!==entry.plan.approval.policyDigest||consent.authorization_digest!==entry.exploration.authorizationDigest||consent.candidate_id!==entry.exploration.candidateId||consent.task_ids_json!==JSON.stringify(entry.exploration.taskIds)||consent.consent_digest!==entry.exploration.consentDigest))throw Error('driver_exploration_consent_mismatch');
    }else if(authorization)throw Error('driver_exploration_mismatch');
    const funds = budget.summary(entry.run.runId);
    if (local ? (funds.limit !== entry.configuration.budget.limit || funds.policyRevision !== entry.configuration.budget.policyRevision
        || funds.source !== entry.configuration.budget.source || funds.observedAtMs !== entry.configuration.budget.observedAtMs)
      : (funds.limitUnits !== BigInt(entry.configuration.budget.limitUnits)
        || funds.currency !== entry.configuration.budget.currency || funds.unit !== entry.configuration.budget.unit)) throw Error('driver_budget_mismatch');
    const requirements = requirementsStore.read(entry.run.runId);
    if ((requirements?.requirements.digest ?? null) !== entry.summary.requirementsDigest) throw Error('driver_requirements_mismatch');
    const retry = store.readRetryContract(entry.run.runId);
    if ((retry?.digest ?? null) !== (entry.summary.retry?.contractDigest ?? null)) throw Error('driver_retry_contract_mismatch');
    const expected = entry.summary.generatedOutputs ?? [];
    const targets = db.prepare('SELECT target_id FROM generated_output_target WHERE run_id=? ORDER BY target_id').all(entry.run.runId);
    if (targets.length !== expected.length || targets.some(row => !expected.some(target => target.targetId === row.target_id))) throw Error('driver_generated_target_set_mismatch');
    for (const target of expected) {
      if (generatedStore.readTarget(entry.run.runId, target.targetId)?.targetDigest !== target.targetDigest) throw Error('driver_generated_target_mismatch');
    }
  }
  function block(entry, reason) {
    db.prepare("UPDATE task SET state='blocked',blocked_reason=? WHERE id=? AND state IN ('running','awaiting_approval','queued')").run(reason, entry.run.taskId);
  }
  function deadlineReached(entry) {
    const deadline = effectiveDeadline(entry);
    return Boolean(deadline !== null && (now() >= deadline
      || (entry.deadlineAt !== null && performance.now() >= entry.deadlineAt)));
  }
  function effectiveDeadline(entry) {
    const retry = entry.summary.retry?.deadlineMs ?? null;
    return entry.localDeadlineMs == null ? retry : retry === null ? entry.localDeadlineMs : Math.min(retry, entry.localDeadlineMs);
  }
  function clearDeadline(entry) { clearTimeout(entry.deadlineTimer); entry.deadlineTimer = null; }
  function expire(entry) {
    if (entry.cancelled) return;
    entry.cancelled = true; clearDeadline(entry); entry.acceptanceAbort.abort(); block(entry, 'orchestration_deadline');
    entry.cancellation = cancelActive(entry); void entry.cancellation.catch(() => {});
  }
  function armDeadline(entry, preserveAbsolute = false) {
    if (local&&!preserveAbsolute) entry.localDeadlineMs = Math.min(now() + entry.summary.timeoutMs, Date.parse(entry.run.envelope.expires_at));
    const deadline = effectiveDeadline(entry);
    if (deadline === null) return;
    if(!preserveAbsolute||entry.deadlineAt===null)entry.deadlineAt = performance.now() + Math.max(0, deadline - now());
    const tick = () => {
      if (entry.cancelled || closing) return;
      const remaining = entry.deadlineAt - performance.now();
      if (remaining <= 0) expire(entry);
      else entry.deadlineTimer = setTimeout(tick, Math.min(Math.ceil(remaining), 2_147_483_647));
    };
    tick();
  }
  function discardRolledBackPreparation(entry) {
    if (entry.activated || entry.request || entry.promise
        || db.prepare('SELECT 1 FROM orchestration_plan WHERE run_id=?').get(entry.run.runId)
        || db.prepare('SELECT 1 FROM orchestration_attempt WHERE run_id=?').get(entry.run.runId)) return false;
    prepared.delete(entry.run.runId);
    return true;
  }
  async function boundedCall(promise, milliseconds) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('driver_control_timeout')), milliseconds); })]); }
    finally { clearTimeout(timer); }
  }
  async function cancelActive(entry) {
    const active = [...entry.activeAttempts.values()];
    if (entry.request && !active.some(item => item.request.attemptId === entry.request.attemptId)) active.push({ request: entry.request, handle: entry.handle, startPromise: null, control: null });
    await Promise.allSettled(active.map(item => {
      if (item.control) return item.control;
      item.control = (async () => { try {
        const handle = item.handle ?? await engine.start(entry.plan, item.request); item.handle = handle;
        await boundedCall(handle.cancel(), entry.configuration.limits.launchTimeoutMs);
        await boundedCall(handle.reconcile(), entry.configuration.limits.launchTimeoutMs);
      } catch { /* Unknown ownership stays durable; close refuses it. */ } })();
      return item.control;
    }));
  }
  function makeRequest(entry, taskId) {
    const suffix = createHash('sha256').update(`${entry.run.runId}\0${entry.plan.digest}\0${taskId}`).digest('hex').slice(0, 48);
    return Object.freeze({ runId: entry.run.runId, taskId, attemptId: `attempt-${suffix}`, requestId: `request-${suffix}`,
      observedAtMs: now(), timeoutMs: entry.configuration.limits.launchTimeoutMs, ...(entry.activeRevision?{revision:entry.activeRevision.revision,planDigest:entry.activeRevision.planDigest}:{}),
      ...(entry.exploration?.taskIds.includes(taskId)?{exploration:{version:'cue-exploration-request-v1',authorizationDigest:entry.exploration.authorizationDigest,candidateId:entry.exploration.candidateId}}:{}) });
  }
  async function runParallelWave(entry, taskIds) {
    const records = taskIds.map(taskId => { const request = makeRequest(entry, taskId); const item = { taskId, request, handle: null, startPromise: null, control: null };
      entry.activeAttempts.set(request.attemptId, item); item.startPromise = engine.start(entry.plan, request).then(handle => { item.handle = handle; return handle; }); return item; });
    const starts = await Promise.allSettled(records.map(item => item.startPromise));
    if (starts.some(result => result.status === 'rejected') || entry.cancelled || closing) { await cancelActive(entry); return 'failed'; }
    const deadline = performance.now() + entry.configuration.limits.taskTimeoutMs;
    const pending = new Set(records);
    while (pending.size && !entry.cancelled && !closing && performance.now() < deadline) {
      if (deadlineReached(entry)) { expire(entry); break; }
      for (const item of [...pending]) {
        const receipt = await boundedCall(item.handle.reconcile(), entry.configuration.limits.launchTimeoutMs);
        if (!receipt) continue;
        if (receipt.state !== 'completed') { await cancelActive(entry); return 'failed'; }
        pending.delete(item);
      }
      if (pending.size) await delay(entry.configuration.limits.pollMs);
    }
    if (pending.size) { await cancelActive(entry); return 'timeout'; }
    entry.activeAttempts.clear(); return 'completed';
  }
  function applyRecovery(entry, value, automatic = false) {
    if(entry.exploration&&(value.plan||value.proposedCandidateId))throw Error('driver_exploration_recovery_unsupported');
    if(entry.recoveryApplying)throw Error('driver_recovery_in_progress');
    entry.recoveryApplying=true;
    const expectedRequest=entry.request,expectedRevision=entry.activeRevision;
    try{
    if(!entry.activeRevision||(entry.request&&entry.request.attemptId!==value.priorAttemptId&&db.prepare('SELECT 1 FROM orchestration_attempt WHERE attempt_id=?').get(entry.request.attemptId))||snapshot(entry.run.runId).unresolvedAttemptIds.length)throw Error('driver_recovery_not_settled');
    const observation=recovery.observeFailure({runId:value.runId,attemptId:value.priorAttemptId});
    const decision=recovery.recordDecision({decisionId:value.decisionId,observationId:observation.observationId,...(value.proposedCandidateId?{proposedCandidateId:value.proposedCandidateId}:{})});
    if(automatic&&(prepared.get(value.runId)!==entry||entry.request!==expectedRequest||entry.activeRevision!==expectedRevision||entry.request?.attemptId!==value.priorAttemptId||entry.cancelled||closing||deadlineReached(entry))){if(deadlineReached(entry))expire(entry);return Object.freeze({action:decision.action,revision:entry.activeRevision.revision,planDigest:entry.activeRevision.planDigest,applied:false});}
    if(decision.action==='replan'){
      if(!value.plan){if(automatic){entry.deferredRecovery=Object.freeze({decisionId:value.decisionId,priorAttemptId:value.priorAttemptId,action:'replan'});block(entry,'orchestration_evidence_unverified');return Object.freeze({action:decision.action,revision:entry.activeRevision.revision,planDigest:entry.activeRevision.planDigest,applied:false});}throw Error('driver_replan_missing');}
      const plan=recovery.appendRevision({runId:value.runId,decisionId:value.decisionId,approval:entry.plan.approval,plan:value.plan,createdAtMs:now()});
      entry.plan=plan;entry.activeRevision=Object.freeze({revision:decision.destinationRevision,planDigest:plan.digest});
    }else if(value.plan)throw Error('driver_plan_without_replan');
    if(decision.action==='stop'){if(automatic)block(entry,'orchestration_evidence_unverified');return Object.freeze({action:decision.action,revision:entry.activeRevision.revision,planDigest:entry.activeRevision.planDigest,applied:false});}
    const prior=db.prepare('SELECT task_id,candidate_id FROM orchestration_attempt WHERE attempt_id=? AND run_id=?').get(value.priorAttemptId,value.runId);
    if(entry.exploration&&prior&&entry.exploration.taskIds.includes(prior.task_id)&&prior.candidate_id!==entry.exploration.candidateId)throw Error('driver_exploration_recovery_mismatch');
    const taskId=decision.action==='replan'?store.readinessRevision(value.runId,entry.activeRevision.revision,entry.activeRevision.planDigest).readyTaskIds[0]:prior?.task_id;
    if(!taskId)throw Error('driver_recovery_task_missing');
    db.prepare("UPDATE orchestration_revision_step SET state='pending' WHERE run_id=? AND revision=? AND task_id=? AND state IN('failed','blocked')").run(value.runId,entry.activeRevision.revision,taskId);
    entry.pendingRecovery=Object.freeze({decisionId:value.decisionId,taskId,candidateId:decision.action==='switch'?decision.selectedCandidateId:decision.action==='retry'?prior.candidate_id:null,
      notBeforeMs:decision.action==='retry'&&decision.facts?.cause==='quota'?decision.facts.quotaResetAtMs:null});
    entry.deferredRecovery=null;
    entry.handle=null;entry.request=null;
    if(!automatic){entry.promise=null;db.prepare("UPDATE task SET state='running',blocked_reason=NULL WHERE id=? AND state='blocked'").run(entry.run.taskId);clearDeadline(entry);armDeadline(entry,true);}
    return Object.freeze({action:decision.action,revision:entry.activeRevision.revision,planDigest:entry.activeRevision.planDigest,applied:true});
    }finally{entry.recoveryApplying=false;}
  }
  async function publishStagedChanges(entry,execution) {
    const contract=stagingContracts.get(execution.attemptId);
    if(!contract||!finalPublication||host.finalPublication!==finalPublication||publishingAttempts.has(execution.attemptId))return false;
    publishingAttempts.add(execution.attemptId);
    try{
      for(const target of contract.targets){
        const publicationId=`publication-${createHash('sha256').update(`${execution.attemptId}\0${contract.changeSetId}\0${target.relativePath}`).digest('hex').slice(0,48)}`;
        const existing=db.prepare(`SELECT i.change_set_id,i.attempt_id,i.relative_path,r.state FROM change_publication_intent i
          LEFT JOIN change_publication_result r ON r.publication_id=i.publication_id WHERE i.publication_id=?`).get(publicationId);
        if(existing){if(existing.change_set_id!==contract.changeSetId||existing.attempt_id!==execution.attemptId||existing.relative_path!==target.relativePath||existing.state!=='committed')return false;continue;}
        const stagedInput=Object.freeze({contractId:contract.contractId,runId:contract.runId,taskId:contract.taskId,attemptId:contract.attemptId,
          changeSetId:contract.changeSetId,relativePath:target.relativePath,maxBytes:target.maxBytes,stagingOnly:true});
        const supplied=await boundedCall(Promise.resolve(finalPublicationFunctions.readStagedReplacement(stagedInput)),entry.configuration.limits.launchTimeoutMs);
        if(types.isProxy(supplied)||!Buffer.isBuffer(supplied)||supplied.length>target.maxBytes)return false;
        const replacement=Buffer.from(supplied);
        const current=()=>{if(deadlineReached(entry))return false;
          const attempt=db.prepare('SELECT state FROM orchestration_attempt WHERE attempt_id=? AND run_id=? AND task_id=?').get(execution.attemptId,contract.runId,contract.taskId);
          const changeSet=db.prepare('SELECT change_set_id FROM change_set WHERE change_set_id=? AND attempt_id=? AND run_id=? AND task_id=?').get(contract.changeSetId,contract.attemptId,contract.runId,contract.taskId);
          const rootTask=db.prepare('SELECT state FROM task WHERE id=?').get(entry.run.taskId);
          return host.finalPublication===finalPublication&&finalPublication.authorize===finalPublicationFunctions.authorize&&finalPublication.openStagedAttempt===finalPublicationFunctions.openStagedAttempt&&finalPublication.readStagedReplacement===finalPublicationFunctions.readStagedReplacement&&finalPublication.execute===finalPublicationFunctions.execute
            &&prepared.get(entry.run.runId)===entry&&!entry.cancelled&&!closing&&stagingContracts.get(execution.attemptId)===contract&&attempt?.state==='running'&&Boolean(changeSet)&&rootTask?.state==='running';};
        if(!current())return false;
        const publisher=createFinalPublicationStore(db,{authorize:context=>finalPublicationFunctions.authorize(context)===true&&current(),nowMs:now(),...(finalPublicationFunctions.execute?{execute:input=>finalPublicationFunctions.execute(input)}:{})});
        if(publisher.publish({publicationId,changeSetId:contract.changeSetId,relativePath:target.relativePath,replacement}).state!=='committed')return false;
      }
      return true;
    }finally{publishingAttempts.delete(execution.attemptId);}
  }
  async function drive(entry) {
    let pendingRetry = null;
    try {
      while (!entry.cancelled && !closing) {
        if (deadlineReached(entry)) { expire(entry); return; }
        const ready = entry.activeRevision?store.readinessRevision(entry.run.runId,entry.activeRevision.revision,entry.activeRevision.planDigest):store.readiness(entry.run.runId);
        if (!pendingRetry && ready.phase === 'completed') {
          if (!acceptance) { block(entry, 'acceptance_unverified'); return; }
          const evaluation = await acceptance.collect(entry.run.runId, { ...(entry.activeRevision??{}), signal: entry.acceptanceAbort.signal });
          if (entry.cancelled || closing || entry.acceptanceAbort.signal.aborted) return;
          if (deadlineReached(entry)) { expire(entry); return; }
          const receipt = acceptance.finalize(evaluation, entry.activeRevision??{revision:0,planDigest:entry.plan.digest});
          if (receipt.status !== 'accepted') block(entry, 'acceptance_unverified');
          return;
        }
        const recoveryPending=entry.pendingRecovery;
        if(recoveryPending?.notBeforeMs!==null&&recoveryPending?.notBeforeMs!==undefined&&now()<recoveryPending.notBeforeMs){
          await delay(Math.min(entry.configuration.limits.pollMs,recoveryPending.notBeforeMs-now()));continue;
        }
        const wave = !recoveryPending && !pendingRetry && entry.summary.maxParallelReadTasks > 1
          ? ready.readyTaskIds.filter(id => entry.plan.tasks.find(task => task.id === id)?.role !== 'implementation').slice(0, entry.summary.maxParallelReadTasks) : [];
        if (wave.length > 1) {
          const waveResult = await runParallelWave(entry, wave);
          if (waveResult !== 'completed') { if (!entry.cancelled) block(entry, waveResult === 'timeout' ? 'orchestration_timeout' : 'orchestration_evidence_unverified'); return; }
          continue;
        }
        const taskId = recoveryPending?.taskId ?? pendingRetry?.taskId ?? ready.readyTaskIds[0];
        if (!taskId) { block(entry, 'orchestration_not_ready'); return; }
        const retry = pendingRetry?.reference;
        const suffix = createHash('sha256').update(`${entry.run.runId}\0${entry.plan.digest}\0${taskId}${retry ? `\0${retry.previousAttemptId}\0${retry.receiptId}` : ''}${recoveryPending?`\0${recoveryPending.decisionId}`:''}`).digest('hex').slice(0, 48);
        entry.request = Object.freeze({ runId: entry.run.runId, taskId, attemptId: `attempt-${suffix}`, requestId: `request-${suffix}`,
          observedAtMs: now(), timeoutMs: entry.configuration.limits.launchTimeoutMs, ...(entry.activeRevision?{revision:entry.activeRevision.revision,planDigest:entry.activeRevision.planDigest}:{}), ...(retry ? { retry } : {}),
          ...(recoveryPending?{recoveryDecisionId:recoveryPending.decisionId,...(recoveryPending.candidateId?{forcedCandidateId:recoveryPending.candidateId}:{})}:{}),
          ...(entry.exploration?.taskIds.includes(taskId)?{exploration:{version:'cue-exploration-request-v1',authorizationDigest:entry.exploration.authorizationDigest,candidateId:entry.exploration.candidateId}}:{}) });
        pendingRetry = null;
        entry.handle = null;
        entry.handle = await engine.start(entry.plan, entry.request);
        if(unsupportedStagingAttempts.has(entry.request.attemptId)){block(entry,'existing_file_publication_unsupported');return;}
        if(failedStagingAttempts.has(entry.request.attemptId)){block(entry,'change_publication_staging_unavailable');return;}
        entry.pendingRecovery=null;
        const deadline = performance.now() + entry.configuration.limits.taskTimeoutMs;
        let finished = false;
        while (!entry.cancelled && !closing && performance.now() < deadline) {
          if (deadlineReached(entry)) { expire(entry); break; }
          let receipt = await boundedCall(entry.handle.reconcile(), entry.configuration.limits.launchTimeoutMs);
          if (receipt) {
            const deferred=deferredFinishes.get(receipt);
            if(deferred){if(deferred.outcome==='failed'){try{stagingCoordinator.cleanupDiscarded(deferred);}catch{block(entry,'change_publication_unresolved');return;}}else{let published=false;try{published=await publishStagedChanges(entry,deferred);}catch{}if(!published){block(entry,'change_publication_unresolved');return;}if(db.prepare('SELECT 1 FROM attempt_staging_authority WHERE attempt_id=?').get(deferred.attemptId)){try{stagingCoordinator.cleanupActive(deferred);}catch{block(entry,'change_publication_unresolved');return;}}}receipt=store.finish(deferred);const contract=stagingContracts.get(deferred.attemptId);if(contract)openedStagingContracts.delete(contract.contractId);stagingContracts.delete(deferred.attemptId);}
            const changeSet=db.prepare('SELECT change_set_id FROM change_set WHERE attempt_id=?').get(entry.request.attemptId);
            const journalRequired=(entry.summary.changeTargets??[]).some(target=>target.taskId===taskId);
            if(journalRequired&&!changeSet){block(entry,'change_journal_missing');return;}
            if(changeSet){const observations=observeChangeSet(db,changeSet.change_set_id,{nowMs:now()});if(changeObservationBlocksRecovery(observations)){block(entry,'change_observation_unknown');return;}}
            if(receipt.state==='failed'&&entry.summary.retry&&host.recovery&&entry.summary.recoveryMode==='automatic-approved'){
              const terminal=db.prepare('SELECT receipt_id FROM orchestration_receipt WHERE attempt_id=? ORDER BY revision DESC LIMIT 1').get(entry.request.attemptId);if(!terminal){block(entry,'orchestration_evidence_unverified');return;}
              const decisionId=`auto-${createHash('sha256').update(`${entry.run.runId}\0${entry.request.attemptId}\0${terminal.receipt_id}\0${entry.activeRevision.revision}`).digest('hex').slice(0,48)}`;
              try{const applied=applyRecovery(entry,{runId:entry.run.runId,decisionId,priorAttemptId:entry.request.attemptId},true);if(applied.applied){finished=true;break;}return;}catch{block(entry,'orchestration_evidence_unverified');return;}
            }
            if (receipt.state === 'failed' && entry.summary.retry && !host.recovery) {
              const previous = db.prepare(`SELECT r.receipt_id FROM orchestration_receipt r JOIN orchestration_attempt a ON a.attempt_id=r.attempt_id
                WHERE a.run_id=? AND a.task_id=? AND a.attempt_id=? AND a.state='failed' AND a.cleanup_verified=1 ORDER BY r.revision DESC LIMIT 1`)
                .get(entry.run.runId, taskId, entry.request.attemptId);
              if (previous) {
                // This is only a retry request. The store independently classifies
                // the exact receipt and checks approval, cleanup, caps and deadline.
                pendingRetry = { taskId, reference: Object.freeze({ previousAttemptId: entry.request.attemptId,
                  receiptId: previous.receipt_id, contractDigest: entry.summary.retry.contractDigest }) };
                finished = true; break;
              }
            }
            if (receipt.state !== 'completed') { block(entry, 'orchestration_evidence_unverified'); return; }
            finished = true; break;
          }
          await delay(entry.configuration.limits.pollMs);
        }
        if (!finished) {
          if (!entry.cancelled) block(entry, 'orchestration_timeout');
          await cancelActive(entry); return;
        }
        entry.request = null; entry.handle = null;
      }
    } catch { const attemptId=entry.request?.attemptId;block(entry,attemptId&&unsupportedStagingAttempts.has(attemptId)?'existing_file_publication_unsupported':attemptId&&failedStagingAttempts.has(attemptId)?'change_publication_staging_unavailable':'orchestration_execution_failed'); await cancelActive(entry); }
    finally { clearDeadline(entry); }
  }
  function snapshot(runOrId) {
    const entry = entryFor(runOrId);
    const task = db.prepare('SELECT state,blocked_reason AS reason FROM task WHERE id=?').get(entry.run.taskId);
    const unresolved = db.prepare('SELECT attempt_id FROM orchestration_attempt WHERE run_id=? AND cleanup_verified=0 ORDER BY attempt_id').all(entry.run.runId).map(row => row.attempt_id);
    let verified = false;
    try { verified = Boolean(readAcceptanceHistory(db, entry.run.runId,entry.activeRevision??{revision:0,planDigest:entry.plan.digest})?.receipt); }
    catch { /* Corrupt historical evidence cannot substantiate verified acceptance. */ }
    const terminalIntegrity=Object.freeze(db.prepare('SELECT attempt_id FROM orchestration_attempt WHERE run_id=? ORDER BY attempt_id').all(entry.run.runId)
      .map(row=>store.readTerminalIntegrity(row.attempt_id)));
    return Object.freeze({ runId: entry.run.runId, ...task, recovery:entry.deferredRecovery, readiness: entry.activeRevision?store.readinessRevision(entry.run.runId,entry.activeRevision.revision,entry.activeRevision.planDigest):store.readiness(entry.run.runId), terminalIntegrity,
      unresolvedAttemptIds: Object.freeze(unresolved), acceptance: verified ? 'verified' : 'unverified' });
  }
  function lifecycle(attemptId) {
    if (typeof attemptId !== 'string' || !attemptId.trim()) throw Error('driver_lifecycle_attempt');
    const attempt = db.prepare('SELECT run_id,task_id,candidate_id FROM orchestration_attempt WHERE attempt_id=?').get(attemptId);
    if (!attempt) throw Error('driver_lifecycle_attempt');
    return providerLifecycle.project({ runId: attempt.run_id, taskId: attempt.task_id, attemptId, candidateId: attempt.candidate_id });
  }
  const api = {
    waitRequest(input) { if (!store.requestQueue) throw Error('wait_unsupported'); return store.requestQueue.request(frozenData(input)); },
    waitResponse(input) { if (!store.requestQueue) throw Error('wait_unsupported'); return store.requestQueue.respond(frozenData(input)); },
    waitResolve(requestId, status, observedAtMs) { if (!store.requestQueue) throw Error('wait_unsupported'); return store.requestQueue.resolve(requestId, status, observedAtMs); },
    checkpoint(input) { if (!store.requestQueue) throw Error('wait_unsupported'); return store.requestQueue.checkpoint(frozenData(input)); },
    reconcileCheckpoint(streamId) { if (!store.requestQueue) throw Error('wait_unsupported'); return store.requestQueue.reconcileCheckpoint(streamId); },
    async deliverWaitResponse(input) {
      const claim = store.claimWaitResponse(frozenData(input));
      if (!claim.newlyClaimed) return Object.freeze({ ...claim, delivery: db.prepare('SELECT status FROM orchestration_wait_delivery_observation WHERE dispatch_id=?').get(claim.dispatchId)?.status === 'delivered' ? 'delivered-observed' : 'blocked-unresolved' });
      const attempt = db.prepare('SELECT run_id FROM orchestration_attempt WHERE attempt_id=?').get(claim.attemptId);
      const entry = attempt && prepared.get(attempt.run_id);
      const task = entry && db.prepare('SELECT state FROM task WHERE id=?').get(entry.run.taskId);
      const active=entry?.activeAttempts.get(claim.attemptId); const handle=active?.handle??(entry?.request?.attemptId===claim.attemptId?entry.handle:null);
      if (!entry || task?.state !== 'running' || entry.cancelled || closing || active?.control || !handle || !host.deliverWaitResponse) return Object.freeze({ ...claim, delivery: host.deliverWaitResponse ? 'blocked-unresolved' : 'unsupported' });
      try {
        const acknowledgement = await host.deliverWaitResponse(Object.freeze({ dispatchId: claim.dispatchId, attemptId: claim.attemptId,
          identityId: claim.identityId, durableRef: claim.durableRef, requestId: claim.requestId, responseId: claim.responseId,
          contentRef: claim.contentRef, contentSha256: claim.contentSha256, contentBytes: claim.contentBytes }));
        store.observeWaitDelivery({ dispatchId: claim.dispatchId, status: 'delivered', observedAtMs: now(), acknowledgement: frozenData(acknowledgement) });
        return Object.freeze({ ...claim, delivery: 'delivered-observed' });
      } catch {
        try { store.observeWaitDelivery({ dispatchId: claim.dispatchId, status: 'unknown', observedAtMs: now() }); } catch {}
        return Object.freeze({ ...claim, delivery: 'blocked-unresolved' });
      }
    },
    prepare(runInput, proposalInput) {
      if (closing) throw Error('driver_closed');
      const run = frozenData(runInput); const runJson = JSON.stringify(run);
      const proposalEnvelope=proposalInput===undefined?null:frozenData(proposalInput);
      const goalProposal=proposalEnvelope===null?null:captureGoalProposal(run.goal,proposalEnvelope.ref,proposalEnvelope.body);
      const previous = prepared.get(run.runId);
      if (previous) { if (previous.runJson !== runJson||previous.goalProposal?.ref!==(goalProposal?.ref??undefined)) throw Error('driver_run_changed'); assertPersisted(previous); return previous.summary; }
      if (run.envelope.run_id !== run.runId || envelopeHash(run.envelope) !== run.envelopeHash) throw Error('driver_envelope_mismatch');
      const hostConfiguration=frozenData(host.prepare(run,goalProposal));
      if(goalProposal&&(!host.supportsGoalProposals||local||typeof host.resolveRequirementChecker!=='function'||!host.acceptance||typeof host.acceptance.resolveChecker!=='function'||hostConfiguration.generatedOutputs!==undefined||hostConfiguration.retry!==undefined||hostConfiguration.recoveryMode==='automatic-approved'))throw Error('driver_goal_proposal_host_unsupported');
      const configuration=goalProposal?Object.freeze({...hostConfiguration,requirementIds:goalProposal.requirementIds,proposedPlan:goalProposal.proposedPlan,requirements:goalProposal.requirements,changeTargets:goalProposal.changeTargets.length?goalProposal.changeTargets:undefined}):hostConfiguration;
      const initialDefault = configuration.initialDefault === undefined ? null
        : exactFields(configuration.initialDefault, ['defaultCandidateId', 'conservativeEstimate', 'source', 'boundAtMs'], 'driver_initial_default_fields');
      if (local && initialDefault) throw Error('driver_local_initial_default_unsupported');
      const exploration = configuration.exploration === undefined ? null
        : exactFields(configuration.exploration, ['candidateId','limitUnits','taskIds','authorizedAt','sourceVersion'], 'driver_exploration_fields');
      if(local&&exploration)throw Error('driver_local_exploration_unsupported');
      if(initialDefault&&exploration)throw Error('driver_exploration_initial_default_conflict');
      const maxParallelReadTasks=configuration.limits.maxParallelReadTasks??1;
      const recoveryMode=configuration.recoveryMode??'manual';
      const stagedPublication=configuration.stagedPublication===true;
      const executionStaging=configuration.executionStaging===true;
      if(configuration.stagedPublication!==undefined&&!stagedPublication)throw Error('driver_staged_publication_invalid');
      if(stagedPublication&&configuration.changeTargets===undefined)throw Error('driver_staged_publication_targets');
      if(configuration.executionStaging!==undefined&&!executionStaging)throw Error('driver_execution_staging_invalid');
      if(executionStaging&&(!stagedPublication||!stagingCoordinator||!configuration.changeTargets?.length))throw Error('driver_execution_staging_unavailable');
      if(local&&executionStaging)throw Error('driver_local_execution_staging_unsupported');
      if(!['manual','automatic-approved'].includes(recoveryMode))throw Error('driver_recovery_mode');
      if(recoveryMode==='automatic-approved'&&(!host.recovery||configuration.retry===undefined||configuration.requirements===undefined))throw Error('driver_automatic_recovery_unsupported');
      bound(maxParallelReadTasks,8);
      if(maxParallelReadTasks>1&&(local||configuration.retry!==undefined||recoveryMode!=='manual'))throw Error('driver_parallel_read_unsupported');
      const policy = readPolicy(db, configuration.policy.policyId, configuration.policy.revision);
      if (!policy || policy.digest !== configuration.policy.digest) throw Error('driver_policy_mismatch');
      if (run.selectionMode !== undefined && policy.policy.mode !== run.selectionMode) throw Error('driver_selection_mode_mismatch');
      const ref = revisionRef(policy);
      const plan = validateTaskPlan({ policyRevision: ref, policyDigest: policy.digest, requirementIds: configuration.requirementIds,
        allowedCandidateIds: local ? [policy.policy.producerCandidateId, policy.policy.checkerCandidateId] : policy.policy.allowedCandidateIds, allowedScopeIds: configuration.scopes.map(scope => scope.id) }, configuration.proposedPlan);
      const accountIdentities=local?[]:[...new Set(plan.tasks.flatMap(task=>task.candidateIds))].sort().map(candidateId=>{const lookup=host.catalog.lookup(candidateId),r=lookup.record;if(!lookup.available||!r||r.authReference===null||r.subjectDigest===null)throw Error('driver_account_identity_unavailable');return{runId:run.runId,candidateId,authReference:r.authReference,toolId:r.toolId,sourceVersion:r.sourceVersion,subjectDigest:r.subjectDigest,modelId:r.binding?.modelId??null,endpointId:r.binding?.endpointId??null,planDigest:plan.digest,policyDigest:policy.digest,envelopeHash:run.envelopeHash};});
      let explorationInput=null;
      if(exploration){
        if(typeof exploration.candidateId!=='string'||!policy.policy.allowedCandidateIds.includes(exploration.candidateId)||!Number.isSafeInteger(exploration.limitUnits)||exploration.limitUnits<1||typeof exploration.authorizedAt!=='string'||new Date(exploration.authorizedAt).toISOString()!==exploration.authorizedAt||typeof exploration.sourceVersion!=='string'||!exploration.sourceVersion.trim())throw Error('driver_exploration_invalid');
        if(!Array.isArray(exploration.taskIds)||exploration.taskIds.length<1||new Set(exploration.taskIds).size!==exploration.taskIds.length||exploration.taskIds.some((id,index)=>typeof id!=='string'||id!==(index?exploration.taskIds[index-1]<id?id:null:id)||!plan.tasks.some(task=>task.id===id&&task.candidateIds.includes(exploration.candidateId))))throw Error('driver_exploration_tasks_invalid');
        if(exploration.limitUnits>configuration.budget.limitUnits)throw Error('driver_exploration_limit');
        explorationInput=exploration;
      }
      bound(configuration.limits.launchTimeoutMs, 120_000); bound(configuration.limits.taskTimeoutMs, 600_000); bound(configuration.limits.pollMs, 1000);
      if (configuration.budget.runId !== run.runId || configuration.budget.policyRevision !== ref
          || (local ? configuration.budget.limit !== policy.policy.limitAttempts : configuration.budget.currency !== policy.policy.currency)) throw Error('driver_budget_mismatch');
      if (local && (configuration.limits.taskTimeoutMs > policy.policy.timeoutMs || configuration.limits.launchTimeoutMs > policy.policy.timeoutMs)) throw Error('driver_timeout_policy');
      const configuredCheckers=configuration.requirementCheckers;
      if(configuredCheckers!==undefined&&(!Array.isArray(configuredCheckers)||configuredCheckers.length<1||configuredCheckers.length>128))throw Error('driver_requirement_checkers_invalid');
      if(configuredCheckers!==undefined){
        const requiredCheckerKeys=new Set((configuration.requirements??[]).flatMap(requirement=>requirement.checks??[]).map(check=>`${check.checkerId}\0${check.revision}`));
        const configuredKeys=configuredCheckers.map(checker=>`${checker?.id}\0${checker?.revision}`);
        if(new Set(configuredKeys).size!==configuredKeys.length||configuredKeys.some(key=>!requiredCheckerKeys.has(key)))throw Error('driver_requirement_checkers_invalid');
      }
      const configuredResolver=configuredCheckers===undefined?resolveRequirementChecker:(id,revision)=>configuredCheckers.find(checker=>checker.id===id&&checker.revision===revision);
      const bindingRequirementsStore=configuredCheckers===undefined?requirementsStore:createRequirementContractStore(db,{now,resolveChecker:configuredResolver});
      const requirements = configuration.requirements === undefined ? null
        : validateRequirementContracts(plan, configuration.requirements, configuredResolver);
      const stagingPrepared=executionStaging?stagingCoordinator.prepare(run.envelope.worktree_realpath):null;
      const stagingApproval=stagingPrepared?Object.freeze({enabled:true,factoryProtocol:executionStagingHost.factory.protocol,factorySha256:executionStagingHost.factory.sha256,publicationWorktreeRealpath:stagingPrepared.publicationWorktreeRealpath,publicationRootIdentity:stagingPrepared.publicationRootIdentity,baseCommitId:stagingPrepared.baseCommitId,cleanSnapshotSha256:stagingPrepared.cleanSnapshotSha256}):null;
      const summary = Object.freeze({ mode: policy.policy.mode, policyRevision: ref,
        ...(local ? { accountingKind: 'local-invocation', limitInvocations: configuration.budget.limit, timeoutMs: policy.policy.timeoutMs }
          : { currency: configuration.budget.currency, unit: configuration.budget.unit, limitUnits: configuration.budget.limitUnits }), stageCount: plan.tasks.length,
        requirementsDigest: requirements?.digest ?? null, requirements: requirements?.contracts ?? Object.freeze([]), retry: null, recoveryMode, maxParallelReadTasks, stagedPublication,...(stagingApproval?{executionStaging:stagingApproval}:{}),
        planDigest: plan.digest,...(goalProposal?{goalProposal:Object.freeze({ref:goalProposal.ref,digest:goalProposal.digest,instructions:goalProposal.instructions})}:{}), stages: Object.freeze(plan.tasks.map(task => Object.freeze({ id: task.id, role: task.role,
          dependencyIds: task.dependencyIds, requirementIds: task.requirementIds, scopeIds: task.scopeIds, candidateIds: task.candidateIds }))) });
      const entry = { run, runJson, goalProposal, configuration, plan, summary,stagingPrepared, exploration:null, cancelled: false, activated: false, promise: null, cancellation: null, request: null, handle: null, activeAttempts:new Map(),
        acceptanceAbort: new AbortController(), deadlineAt: null, deadlineTimer: null, pendingRecovery:null, deferredRecovery:null, recoveryApplying:false };
      prepared.set(run.runId, entry);
      try {
        db.transaction(() => {
          const row = db.prepare('SELECT task_id,envelope_hash FROM run WHERE id=?').get(run.runId);
          if (!row || row.task_id !== run.taskId || row.envelope_hash !== run.envelopeHash) throw Error('driver_run_binding_mismatch');
          bindPolicy(db, { runId: run.runId, policyId: policy.policyId, revision: policy.revision, digest: policy.digest, boundAt: new Date(now()).toISOString() });
          budget.initialize(configuration.budget);
          if(explorationInput){
            const authorization=explorationBudget.preauthorize({runId:run.runId,policyId:policy.policyId,policyRevision:policy.revision,policyDigest:policy.digest,candidateId:explorationInput.candidateId,currency:configuration.budget.currency,unit:configuration.budget.unit,limitUnits:explorationInput.limitUnits,authorizedAt:explorationInput.authorizedAt,sourceVersion:explorationInput.sourceVersion});
            const taskIds=Object.freeze([...explorationInput.taskIds]);
            const consentPayload=JSON.stringify({authorizationDigest:authorization.payloadSha256,candidateId:authorization.candidateId,envelopeHash:run.envelopeHash,planDigest:plan.digest,policyDigest:policy.digest,runId:run.runId,taskIds});
            const consentDigest=createHash('sha256').update(consentPayload).digest('hex');
            entry.exploration=Object.freeze({candidateId:authorization.candidateId,limitUnits:authorization.limitUnits,currency:authorization.currency,unit:authorization.unit,taskIds,authorizationDigest:authorization.payloadSha256,consentDigest});
            entry.summary=Object.freeze({...entry.summary,exploration:entry.exploration});
          } else if(explorationBudget?.readAuthorization(run.runId)) throw Error('driver_exploration_mismatch');
          if (initialDefault) {
            const storedDefault = bindInitialDefault(db, { version: 'cue-initial-default-v1', runId: run.runId,
              policyId: policy.policyId, policyRevision: policy.revision, policyDigest: policy.digest,
              defaultCandidateId: initialDefault.defaultCandidateId, conservativeEstimate: initialDefault.conservativeEstimate,
              source: initialDefault.source, boundAtMs: initialDefault.boundAtMs });
            entry.summary = Object.freeze({ ...entry.summary, initialDefault: Object.freeze({ digest: storedDefault.digest,
              candidateId: storedDefault.defaultCandidateId, conservativeMaxCost: storedDefault.conservativeEstimate.conservativeMaxCost,
              conservativeMaxTimeMs: storedDefault.conservativeEstimate.conservativeMaxTimeMs,
              currency: storedDefault.conservativeEstimate.currency }) });
          } else if (readInitialDefault(db, run.runId)) throw Error('driver_initial_default_mismatch');
          store.install(run.runId, plan);
          if(goalProposal)bindGoalProposal(db,{runId:run.runId,taskId:run.taskId,captured:goalProposal,now:now()});
          if(!local)bindAccountIdentities(db,accountIdentities);
          if (configuration.changeTargets !== undefined) {
            const declared=frozenData(configuration.changeTargets);
            if(!Array.isArray(declared)||declared.length<1||declared.length>64)throw Error('driver_change_targets_invalid');
            if(declared.some(target=>!plan.tasks.some(task=>task.id===target.taskId&&task.role==='implementation')))throw Error('driver_change_targets_readonly');
            const changeTargets=registerNativeChangeJournal(db,{runId:run.runId,worktreeRealpath:run.envelope.worktree_realpath,targets:declared,observedAtMs:now()});
            entry.summary=Object.freeze({...entry.summary,changeTargets});
            const taskRoots=new Map();
            for(const target of changeTargets){
              const prior=taskRoots.get(target.taskId);
              if(prior&&prior!==target.rootContractDigest)throw Error('driver_staging_task_contract_mismatch');
              taskRoots.set(target.taskId,target.rootContractDigest);
            }
            for(const [taskId,rootContractDigest] of taskRoots){
              const previous=db.prepare('SELECT created_at_ms,payload_sha256,payload FROM run_staging_task_authority WHERE run_id=? AND task_id=?').get(run.runId,taskId);
              const createdAtMs=previous?.created_at_ms??now();
              const payload=Buffer.from(JSON.stringify({createdAtMs,rootContractDigest,runId:run.runId,schemaVersion:'cue-run-staging-task-authority-v1',taskId}));
              const payloadSha256=createHash('sha256').update(payload).digest('hex');
              if(previous){if(previous.payload_sha256!==payloadSha256||!Buffer.isBuffer(previous.payload)||!previous.payload.equals(payload))throw Error('driver_staging_task_authority_mismatch');}
              else {if(db.prepare('SELECT 1 FROM approval_event WHERE run_id=?').get(run.runId))throw Error('driver_staging_task_authority_missing');
                db.prepare('INSERT INTO run_staging_task_authority VALUES(?,?,?,?,?,?)').run(run.runId,taskId,rootContractDigest,createdAtMs,payloadSha256,payload);}
            }
          }
          const stagingRecord=entry.summary.executionStaging??null,targetContractDigest=entry.summary.changeTargets?.[0]?.rootContractDigest??createHash('sha256').update('[]').digest('hex'),existingStaging=db.prepare('SELECT * FROM run_staging_authority WHERE run_id=?').get(run.runId),stagingCreatedAtMs=existingStaging?.created_at_ms??now();
          const stagingPayload=Buffer.from(JSON.stringify({baseCommitId:stagingRecord?.baseCommitId??null,cleanSnapshotSha256:stagingRecord?.cleanSnapshotSha256??null,createdAtMs:stagingCreatedAtMs,enabled:stagingRecord?1:0,envelopeHash:run.envelopeHash,factoryProtocol:stagingRecord?.factoryProtocol??null,factorySha256:stagingRecord?.factorySha256??null,planDigest:plan.digest,policyDigest:policy.digest,publicationRootIdentity:stagingRecord?{fileId:stagingRecord.publicationRootIdentity.fileId,volumeSerial:stagingRecord.publicationRootIdentity.volumeSerial}:null,publicationWorktreeRealpath:stagingRecord?.publicationWorktreeRealpath??null,runId:run.runId,schemaVersion:'cue-run-staging-authority-v1',targetContractDigest}));
          const stagingValues=[run.runId,run.envelopeHash,plan.digest,policy.digest,stagingRecord?1:0,stagingRecord?.factoryProtocol??null,stagingRecord?.factorySha256??null,stagingRecord?.publicationWorktreeRealpath??null,stagingRecord?.publicationRootIdentity.volumeSerial??null,stagingRecord?.publicationRootIdentity.fileId??null,stagingRecord?.baseCommitId??null,stagingRecord?.cleanSnapshotSha256??null,targetContractDigest,stagingCreatedAtMs,createHash('sha256').update(stagingPayload).digest('hex')];
          if(existingStaging){const columns=['run_id','envelope_hash','plan_digest','policy_digest','enabled','factory_protocol','factory_sha256','publication_worktree_realpath','publication_volume_serial','publication_file_id','base_commit_id','clean_snapshot_sha256','target_contract_digest','created_at_ms','payload_sha256'];if(columns.some((column,index)=>existingStaging[column]!==stagingValues[index])||!Buffer.isBuffer(existingStaging.payload)||!existingStaging.payload.equals(stagingPayload))throw Error('driver_staging_authority_mismatch');}
          else{if(db.prepare('SELECT 1 FROM approval_event WHERE run_id=?').get(run.runId))throw Error('driver_staging_authority_missing');db.prepare('INSERT INTO run_staging_authority VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...stagingValues,stagingPayload);}
          if (requirements) {
            const bound = bindingRequirementsStore.bind(run.runId, requirements.contracts);
            if (bound.requirements.digest !== requirements.digest) throw Error('driver_requirements_changed');
          }
          if (configuration.generatedOutputs !== undefined) {
            const inputs = configuration.generatedOutputs;
            if (!requirements || !Array.isArray(inputs) || inputs.length < 1 || inputs.length > 128) throw Error('driver_generated_targets_invalid');
            const ids = new Set();
            const targets = inputs.map(input => {
              const keys = ['targetId', 'requirementId', 'producerTaskId', 'checkerId', 'checkerRevision', 'inputText', 'maxBytes'];
              if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).length !== keys.length
                  || keys.some(key => !Object.hasOwn(input, key)) || typeof input.inputText !== 'string') throw Error('driver_generated_target_fields');
              if (ids.has(input.targetId)) throw Error('driver_generated_target_duplicate');
              ids.add(input.targetId);
              const inputBytes = Buffer.from(input.inputText, 'utf8');
              if (inputBytes.toString('utf8') !== input.inputText) throw Error('driver_generated_input_encoding');
              const target = generatedStore.bindTarget({ runId: run.runId, targetId: input.targetId, requirementId: input.requirementId,
                producerTaskId: input.producerTaskId, checkerId: input.checkerId, checkerRevision: input.checkerRevision,
                inputBytes, maxBytes: input.maxBytes, boundAtMs: now() });
              return Object.freeze({ targetId: target.targetId, requirementId: target.requirementId, producerTaskId: target.producerTaskId,
                checkerId: target.checkerId, checkerRevision: target.checkerRevision, inputSha256: target.inputSha256,
                inputByteLength: target.inputByteLength, maxBytes: target.maxBytes, parametersDigest: target.parametersDigest, targetDigest: target.targetDigest });
            });
            entry.summary = Object.freeze({ ...entry.summary, generatedOutputs: Object.freeze(targets) });
          }
          if (configuration.retry !== undefined) {
            if (!requirements) throw Error('driver_retry_requires_criteria');
            if (configuration.retry.deadlineMs > Date.parse(run.envelope.expires_at)) throw Error('driver_retry_exceeds_approval');
            const retry = store.bindRetryContract({ ...configuration.retry, runId: run.runId, requirementsDigest: requirements.digest, boundAtMs: now() });
            entry.summary = Object.freeze({ ...entry.summary, retry: Object.freeze({ maxAttemptsPerTask: retry.maxAttemptsPerTask,
              maxAttemptsTotal: retry.maxAttemptsTotal, deadlineMs: retry.deadlineMs, contractDigest: retry.digest }) });
          } else if (store.readRetryContract(run.runId)) throw Error('driver_retry_contract_mismatch');
          assertPersisted(entry);
        }).immediate();
      } catch (error) { prepared.delete(run.runId); throw error; }
      return entry.summary;
    },
    assertGoalProposal(runId) { const entry=entryFor(runId); return entry.goalProposal?.ref??null; },
    approveExploration(runId) {
      if(!db.inTransaction)throw Error('driver_exploration_transaction_required');
      const entry=entryFor(runId);if(!entry.exploration)throw Error('driver_exploration_not_configured');
      const x=entry.exploration,existing=db.prepare('SELECT * FROM exploration_consent WHERE run_id=?').get(runId);
      if(existing){if(existing.consent_digest!==x.consentDigest)throw Error('driver_exploration_consent_mismatch');return Object.freeze({consentDigest:x.consentDigest,replay:true});}
      db.prepare('INSERT INTO exploration_consent VALUES(?,?,?,?,?,?,?,?,?)').run(runId,entry.run.envelopeHash,entry.plan.digest,entry.plan.approval.policyDigest,x.authorizationDigest,x.candidateId,JSON.stringify(x.taskIds),x.consentDigest,now());
      return Object.freeze({consentDigest:x.consentDigest,replay:false});
    },
    activate(runOrId) {
      const entry = entryFor(runOrId);
      if (closing || entry.cancelled) throw Error('driver_closed');
      if (entry.activated) return Object.freeze({ state: db.prepare('SELECT state FROM task WHERE id=?').get(entry.run.taskId).state, started: false });
      db.transaction(() => {
        if(entry.exploration){const consent=db.prepare('SELECT consent_digest FROM exploration_consent WHERE run_id=?').get(entry.run.runId);if(!consent||consent.consent_digest!==entry.exploration.consentDigest)throw Error('exploration_consent_required');}
        if (!db.prepare("SELECT 1 FROM approval_event WHERE run_id=? AND envelope_hash=? AND decision='accept'").get(entry.run.runId, entry.run.envelopeHash)) throw Error('approval_required');
        if (Date.parse(entry.run.envelope.expires_at) <= now()) throw Error('approval_expired');
        if (entry.summary.retry && now() >= entry.summary.retry.deadlineMs) throw Error('driver_retry_deadline');
        const changed = db.prepare("UPDATE task SET state='running',blocked_reason=NULL WHERE id=? AND state='awaiting_approval'").run(entry.run.taskId);
        if (changed.changes !== 1) throw Error('approved_run_consumed');
      }).immediate();
      const approval=db.prepare("SELECT id FROM approval_event WHERE run_id=? AND envelope_hash=? AND decision='accept' ORDER BY id DESC LIMIT 1").get(entry.run.runId,entry.run.envelopeHash);
      if(entry.summary.retry){recovery.registerScope({runId:entry.run.runId,approvalId:approval.id,budgetKind:local?'local-invocation':'monetary',budgetIdentity:entry.run.runId,maxAttemptsTotal:entry.summary.retry.maxAttemptsTotal,deadlineMs:entry.summary.retry.deadlineMs,createdAtMs:now()});entry.activeRevision=Object.freeze({revision:0,planDigest:entry.plan.digest});}
      entry.activated = true; armDeadline(entry); return Object.freeze({ state: 'running', started: true });
    },
    start(runOrId) {
      const entry = entryFor(runOrId);
      if (entry.promise) return entry.promise;
      if (!entry.activated || closing || entry.cancelled) throw Error('driver_not_active');
      entry.promise = drive(entry); void entry.promise.catch(() => {}); return entry.promise;
    },
    stop(runId) {
      const entry = prepared.get(runId);
      if (entry && discardRolledBackPreparation(entry)) return false;
      if (!entry || entry.cancelled) return false;
      entry.cancelled = true; clearDeadline(entry); entry.acceptanceAbort.abort(); block(entry, 'cancelled');
      entry.cancellation = cancelActive(entry); void entry.cancellation.catch(() => {}); return true;
    },
    recover(input) {
      const value=frozenData(input);
      const keys=['runId','decisionId','priorAttemptId'];if(Object.hasOwn(value,'proposedCandidateId'))keys.push('proposedCandidateId');if(Object.hasOwn(value,'plan'))keys.push('plan');
      if(Reflect.ownKeys(value).length!==keys.length||Reflect.ownKeys(value).some(key=>typeof key!=='string'||!keys.includes(key)))throw Error('driver_recovery_fields');
      const entry=entryFor(value.runId);
      const result=applyRecovery(entry,value,false);return Object.freeze({action:result.action,revision:result.revision,planDigest:result.planDigest});
    },
    snapshot,
    readTerminalIntegrity(attemptId) { return store.readTerminalIntegrity(attemptId); },
    lifecycle,
    async settled() {
      for (const entry of prepared.values()) discardRolledBackPreparation(entry);
      await Promise.all([...prepared.values()].flatMap(entry => [entry.promise, entry.cancellation].filter(Boolean)));
      const unresolved = [...prepared.values()].flatMap(entry => snapshot(entry.run.runId).unresolvedAttemptIds);
      if (unresolved.length) throw Error('orchestration_cleanup_unverified');
    },
    async close() {
      closing = true;
      for (const id of prepared.keys()) api.stop(id);
      await api.settled();
    },
  };
  return Object.freeze(api);
}
