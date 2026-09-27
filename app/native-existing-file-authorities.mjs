import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { types } from 'node:util';
import { identifyProviderInstallation } from './provider-installation.mjs';
import { createNativeImplementationHost } from './native-implementation-host.mjs';
import { measureNativeProviderSubject } from '../daemon/dist/src/native-provider-measurement-subject.js';
import { observeNativeServiceCapacity, readIssuedNativeServiceCapacity } from '../daemon/dist/src/native-account-observation.js';
import { createCapabilityEvidenceStore } from '../daemon/dist/src/capability-store.js';
import { createCapabilityAdmission } from '../daemon/dist/src/capability-admission.js';
import { createStageEnvelopeBinder } from '../daemon/dist/src/orchestration/stage-envelope.js';
import { createNativeRuntimeReceiptStore } from '../daemon/dist/src/orchestration/native-runtime-receipts.js';
import { createNativeProcessCleanup } from '../daemon/dist/src/native-process-cleanup.js';
import { createCleanupObservationStore } from '../daemon/dist/src/cleanup-observation-store.js';
import { createCleanCodexHome } from '../daemon/dist/src/tool-home.js';
import { createNativeExistingFileContract } from '../daemon/dist/src/verification/native-existing-file-checker.js';
import { NATIVE_EXISTING_FILE_CHECKER_ID, NATIVE_EXISTING_FILE_CHECKER_REVISION } from '../daemon/dist/src/verification/native-existing-file-checker.js';
import { readSelectionPolicy } from '../daemon/dist/src/selection/policy-store.js';
import { checkFrozenStagedInput, recordFrozenStagedInputObservation } from '../daemon/dist/src/evaluation/staged-input-guard.js';
import { validateTaskPlan } from '../daemon/dist/src/orchestration/plan.js';
import { readGoalTaskInstruction } from './goal-proposal.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const unavailable = code => Object.freeze({available:false,reasons:Object.freeze([code])});
const ids = Object.freeze({implementation:'codex-native-implementation',verifier:'codex-native-verifier'});
function data(value, depth = 0) {
  if (depth > 12) throw Error('native-authorities-configuration');
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || types.isProxy(value)) throw Error('native-authorities-configuration');
  const array = Array.isArray(value), descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) throw Error('native-authorities-configuration');
  const copy = array ? [] : {};
  for (const key of Reflect.ownKeys(descriptors)) {
    if (array && key === 'length') continue;
    const descriptor = descriptors[key];
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor,'value')) throw Error('native-authorities-configuration');
    copy[key] = data(descriptor.value, depth + 1);
  }
  if (array && Reflect.ownKeys(descriptors).length !== value.length + 1) throw Error('native-authorities-configuration');
  return Object.freeze(copy);
}
function exact(value, keys) { return value && Object.keys(value).sort().join('|') === [...keys].sort().join('|'); }
function positive(value) { return Number.isSafeInteger(value) && value > 0; }

/** Synchronous protected catalog for the first planning approval. No provider or service call. */
export function readNativeProposalExecutionCatalog({db,configuration}) {
  if(!db?.open)throw Error('native-proposal-catalog-ledger');
  const config=data(configuration),workflow=config?.workflow;
  if(!workflow||!Array.isArray(workflow.proposalRequirements)||workflow.proposalRequirements.length<1||workflow.proposalRequirements.length>64)throw Error('native-proposal-catalog-requirements');
  const requirementIds=new Set(),targetIds=new Set(),paths=new Set(),checkerRegistry=[];
  for(const row of workflow.proposalRequirements){
    if(!exact(row,['requirementId','requirementText','expectedArtifacts'])||typeof row.requirementId!=='string'||!row.requirementId
      ||requirementIds.has(row.requirementId)||typeof row.requirementText!=='string'||!row.requirementText||row.requirementText.length>4096)throw Error('native-proposal-catalog-requirement');
    requirementIds.add(row.requirementId);
    const contract=createNativeExistingFileContract(row.expectedArtifacts);
    for(const target of contract.targets){
      const path=target.relativePath.toLocaleLowerCase('en-US');
      if(targetIds.has(target.targetId)||paths.has(path))throw Error('native-proposal-catalog-targets');
      targetIds.add(target.targetId);paths.add(path);
    }
    checkerRegistry.push(Object.freeze({checkerId:NATIVE_EXISTING_FILE_CHECKER_ID,revision:NATIVE_EXISTING_FILE_CHECKER_REVISION,
      kinds:Object.freeze(['code']),parametersDigest:contract.parametersDigest,targetIds:Object.freeze(contract.targets.map(target=>target.targetId))}));
  }
  const executionPolicies={};
  for(const mode of ['efficiency','performance','value','speed']){
    const ref=config.policies?.[mode],stored=ref&&readSelectionPolicy(db,ref.policyId,ref.revision);
    if(!stored||stored.digest!==ref.digest||stored.policy.mode!==mode||!stored.policy.allowedCandidateIds.includes(ids.implementation)
      ||!stored.policy.allowedCandidateIds.includes(ids.verifier))throw Error('native-proposal-catalog-policy');
    executionPolicies[mode]=Object.freeze({policyRevision:`${stored.policyId}:${stored.revision}`,policyDigest:stored.digest});
  }
  return Object.freeze({executionPolicies:Object.freeze(executionPolicies),approvedExecution:Object.freeze({
    allowedCandidateIds:Object.freeze([ids.implementation,ids.verifier]),allowedScopeIds:Object.freeze(['approved-existing-files']),
    checkerRegistry:Object.freeze(checkerRegistry),maxChangeTargets:targetIds.size})});
}

export function nativeRuntimeReceiptOutcome(runtime, nativeOutcome) {
  if (!runtime || runtime.phase !== 'settled' || !['succeeded','failed'].includes(nativeOutcome)) return null;
  return runtime.outcome === 'succeeded' && runtime.cancellation === 'not-requested' && nativeOutcome === 'succeeded'
    ? 'succeeded' : 'failed';
}

/** The sole external inputs are declarative configuration, Cue's ledger and clock.
 * OS/service transport, receipt issuance, cleanup and checker code are fixed imports. */
export async function createNativeExistingFileAuthorities({db, now, configuration}) {
  if (!db?.open || typeof now !== 'function') throw Error('native-authorities-context');
  const config = data(configuration);
  if (!exact(config,['installation','authProfilePath','temporaryParent','workflow','accounting','policies','capabilityMaxAgeMs','model'])
      || !positive(config.capabilityMaxAgeMs) || typeof config.model !== 'string' || !config.model
      || !exact(config.accounting,['currency','unit','limitUnits','unitsPerCost','source','observedAtMs','upperUnitsByRole','conservativeTimeMs'])
      || !positive(config.accounting.conservativeTimeMs)) throw Error('native-authorities-configuration');
  const installation = identifyProviderInstallation(config.installation);
  if (installation.provider !== 'codex' || !installation.authProfiles.some(profile => profile.path === config.authProfilePath)) throw Error('native-authorities-profile');
  const measured = measureNativeProviderSubject(installation);
  const preflightRoot=realpathSync.native(config.temporaryParent);
  if(preflightRoot!==config.temporaryParent||!lstatSync(preflightRoot).isDirectory())throw Error('native-authorities-preflight-root');
  const preflightId='native-preflight-'+randomUUID(),preflightTask='native-preflight-task-'+randomUUID();
  const startedAt=new Date(now()).toISOString(),envelopeHash=sha(JSON.stringify(['native-service-capacity-preflight',preflightId,preflightRoot]));
  db.transaction(()=>{
    db.prepare('INSERT INTO envelope(envelope_hash,worktree_realpath,egress_json,created_at) VALUES(?,?,?,?)').run(envelopeHash,preflightRoot,'[]',startedAt);
    db.prepare('INSERT INTO task(id,state,blocked_reason,created_at) VALUES(?,?,?,?)').run(preflightTask,'running',null,startedAt);
    db.prepare('INSERT INTO run(id,task_id,envelope_hash,write_in_progress,started_at) VALUES(?,?,?,?,?)').run(preflightId,preflightTask,envelopeHash,0,startedAt);
  }).immediate();
  let service;
  try {
    service=await observeNativeServiceCapacity({db,owner:{cwd:preflightRoot,run_id:preflightId,task_id:preflightTask},
      installation,currentSubject:measured.subject,authProfilePath:config.authProfilePath,temporaryParent:preflightRoot,
      nowMs:now(),maxAgeMs:config.capabilityMaxAgeMs});
    db.prepare("UPDATE task SET state='completed' WHERE id=? AND state='running'").run(preflightTask);
  } catch(error) {
    db.prepare("UPDATE task SET state='failed' WHERE id=? AND state='running'").run(preflightTask);
    throw error;
  }
  const accountReference = 'account-' + service.accountIdentityDigest;
  const current = () => {
    const subject = measureNativeProviderSubject(installation);
    if (subject.subjectDigest !== measured.subjectDigest) throw Error('native-authorities-subject-drift');
    readIssuedNativeServiceCapacity(service,{installation,currentSubject:subject.subject,authProfilePath:config.authProfilePath,
      accountRef:service.accountRef,nowMs:now(),maxAgeMs:config.capabilityMaxAgeMs});
    return subject.subject;
  };
  current();
  const evidence = createCapabilityEvidenceStore(db,now);
  const evidencePolicy = Object.freeze({now,maxAgeMs:config.capabilityMaxAgeMs,resolveEvidence:ref=>evidence.resolveEvidence(ref)});
  const admit = createCapabilityAdmission(evidencePolicy);
  const references = () => evidence.referencesFor(measured.subjectDigest);
  const capacityAvailable = () => {
    const subject=current();
    return readIssuedNativeServiceCapacity(service,{installation,currentSubject:subject,authProfilePath:config.authProfilePath,
      accountRef:service.accountRef,nowMs:now(),maxAgeMs:config.capabilityMaxAgeMs}).available === true;
  };
  const eligible = role => {
    try { const admission=admit(current(),references()); return capacityAvailable() && (role==='implementation' ? admission.implementationEligible : admission.modelOnlyEligible); }
    catch { return false; }
  };
  const contract = createNativeExistingFileContract(config.workflow.expectedArtifacts);
  if (config.workflow.parametersDigest !== contract.parametersDigest) throw Error('native-authorities-contract');
  const receiptStore = createNativeRuntimeReceiptStore(db), processCleanup = createNativeProcessCleanup(db), cleanupStore = createCleanupObservationStore(db);
  return context => {
    if (!context || context.db !== db) return unavailable('native-authorities-ledger');
    try { current(); } catch { return unavailable('native-authorities-subject-or-service'); }
    const prepared = new Map(), issued = new Map(), clean = new Map();
    const roleOf=(runId,taskId)=>prepared.get(runId)?.plan.tasks.find(task=>task.id===taskId)?.role??null;
    const candidateOf=(runId,taskId)=>ids[roleOf(runId,taskId)]??null;
    const stageReader = createStageEnvelopeBinder(db,{now,resolveScope(){throw Error('native-authorities-read-only');},authorizeStage(){return false;}});
    function expected(runId,taskId,candidateId,planDigest,envelopeHash) {
      const entry=prepared.get(runId);
      return Boolean(entry && entry.plan.digest===planDigest && entry.envelopeHash===envelopeHash
        && candidateOf(runId,taskId)===candidateId && eligible(roleOf(runId,taskId)));
    }
    function preparedLineage(runId,taskId,candidateId,planDigest,envelopeHash) {
      const entry=prepared.get(runId);
      return Boolean(entry && entry.plan.digest===planDigest && entry.envelopeHash===envelopeHash
        && candidateOf(runId,taskId)===candidateId);
    }
    function boundAttempt(attemptId,taskId,candidateId) {
      const stage=stageReader.read(attemptId);
      const row=db.prepare(`SELECT a.run_id,a.task_id,a.candidate_id,a.state,l.expected_subject_digest,l.plan_digest,l.parent_envelope_hash,l.stage_envelope_hash
        FROM orchestration_attempt a JOIN orchestration_launch_intent l ON l.attempt_id=a.attempt_id WHERE a.attempt_id=?`).get(attemptId);
      if (!stage || !row || row.task_id!==taskId || row.candidate_id!==candidateId || row.state!=='running'
        || row.expected_subject_digest!==measured.subjectDigest || stage.envelopeHash!==row.stage_envelope_hash
        || !expected(row.run_id,taskId,candidateId,row.plan_digest,row.parent_envelope_hash)) throw Error('native-authorities-attempt');
      return stage;
    }
    function resolveBinding(context,role) {
      const stage=stageReader.read(context.runId),taskId=stage?.taskId;
      if(!taskId||roleOf(stage.workflowRunId,taskId)!==role)throw Error('native-authorities-task-role');
      boundAttempt(context.runId,taskId,context.candidateId);
      if (!eligible(role)) throw Error('native-authorities-admission');
      const entry=prepared.get(stage.workflowRunId),instruction=entry.proposal
        ?readGoalTaskInstruction(db,stage.workflowRunId,entry.plan.digest,taskId):null;
      if(entry.proposal&&(!context.goalTaskInstruction||JSON.stringify(context.goalTaskInstruction)!==JSON.stringify(instruction)))
        throw Error('native-authorities-instruction');
      const home=createCleanCodexHome(config.temporaryParent,config.authProfilePath);
      const options={codexHome:home,codexHomeOwnership:'ephemeral-owned',goal:instruction?.text??(role==='implementation'
        ?config.workflow.requirementText:'Read the approved staged files and report whether the requirement is met.'),
        requestTimeoutMs:config.workflow.launchTimeoutMs,runTimeoutMs:config.workflow.taskTimeoutMs};
      return {owner:stage.owner,envelope:stage.envelope,options};
    }
    const record = canonicalId => Object.freeze({canonicalId,toolId:'codex',kind:'agent',aliases:[],installation:'installed',protocol:'verified',
      authReference:accountReference,authAvailable:true,sourceVersion:installation.version.value,observedAt:new Date(service.observedAtMs).toISOString(),
      subjectDigest:measured.subjectDigest,binding:null});
    const observeCandidate = role => {
      const upper=config.accounting.upperUnitsByRole[role];
      const cost=upper/config.accounting.unitsPerCost;
      const qualified=eligible(role);
      return {id:ids[role],checks:{eligible:qualified,authenticated:qualified,compatible:qualified,dataAllowed:qualified,resourceAvailable:qualified,quotaAvailable:capacityAvailable()},
        estimate:{scope:'verified-completion-total',quality:0,expectedCost:cost,conservativeMaxCost:cost,expectedTimeMs:config.accounting.conservativeTimeMs,
          conservativeMaxTimeMs:config.accounting.conservativeTimeMs,currency:config.accounting.currency,
          source:'declared-conservative-prior',observedAtMs:config.accounting.observedAtMs}};
    };
    const executor = role => ({db,binary:installation.executablePath,model:config.model,
      tool:{id:'codex',revision:installation.executable.sha256},availability:'ready',resolveBinding:runtime=>resolveBinding(runtime,role)});
    const host = createNativeImplementationHost({db,now,workflow:config.workflow,accounting:config.accounting,policies:config.policies,
      implementation:{record:record(ids.implementation),installation,currentSubject:current,evidenceReferences:references,
        observeCandidate:()=>observeCandidate('implementation'),executor:executor('implementation')},
      verifier:{record:record(ids.verifier),installation,currentSubject:current,evidenceReferences:references,
        observeCandidate:()=>observeCandidate('verifier'),executor:executor('verifier')},
      authorizePublication(authority) {
        try {
          const {runId,taskId,attemptId,planDigest,stageEnvelopeHash}=authority.lineage;
          if (roleOf(runId,taskId)!=='implementation' || !preparedLineage(runId,taskId,ids.implementation,planDigest,authority.lineage.parentEnvelopeHash)
            || measureNativeProviderSubject(installation).subjectDigest!==measured.subjectDigest) return false;
          const row=db.prepare(`SELECT a.state,s.stage_envelope_hash,r.outcome,r.payload_digest
            FROM orchestration_attempt a JOIN orchestration_stage_envelope s ON s.attempt_id=a.attempt_id
            JOIN native_runtime_receipt r ON r.attempt_id=a.attempt_id WHERE a.attempt_id=?`).get(attemptId);
          const expectedArtifact=(prepared.get(runId)?.contractsByTask.get(taskId)??contract).targets.find(target=>target.relativePath===authority.target.relativePath);
          return row?.state==='running' && row.stage_envelope_hash===stageEnvelopeHash && row.outcome==='succeeded'
            && receiptStore.read('cue-native-runtime-receipt:'+row.payload_digest)?.outcome==='succeeded'
            && issued.get(attemptId)?.outcome==='succeeded'
            && clean.get(attemptId)?.result==='verified-clean' && expectedArtifact?.expectedSha256===authority.replacement.sha256
            && expectedArtifact?.expectedByteLength===authority.replacement.byteLength;
        } catch { return false; }
      },
      verifyFinalBilling:()=>false,
      authority:{
        authorizePlan(runId,envelopeHash,plan){const entry=prepared.get(runId);return Boolean(entry&&entry.envelopeHash===envelopeHash&&entry.plan.digest===plan.digest);},
        authorizeClaim(c){return expected(c.runId,c.task.id,c.candidateId,c.plan.digest,c.envelopeHash)&&c.worktreeRealpath===prepared.get(c.runId)?.worktree;},
        authorizeStage(c){const role=roleOf(c.parent.run_id,c.task.id),entry=prepared.get(c.parent.run_id);return Boolean(role&&entry&&entry.plan.digest===c.plan.digest
          && c.candidateId===ids[role]&&c.parent.worktree_realpath===entry.worktree&&c.stage.egress.length===0
          && (role==='implementation'?c.stage.allowed_actions.join(',')==='file_change':c.stage.allowed_actions.length===0));},
        verifyReceipt(c,receipt){const prior=issued.get(c.attemptId),cleanup=clean.get(c.attemptId);
          const {nativeRef,...publicReceipt}=prior??{};
          const exact=prior&&JSON.stringify(publicReceipt)===JSON.stringify(receipt)&&receipt.evidenceRef===cleanup?.evidenceRef;
          const identity=exact&&db.prepare('SELECT identity_id FROM orchestration_attempt_identity WHERE attempt_id=?').get(c.attemptId);
          return {outcomeVerified:Boolean(exact&&receipt.outcome===receiptStore.read(prior.nativeRef)?.outcome),
            cleanupVerified:Boolean(exact&&cleanup.result==='verified-clean'),
            ...(identity?{handoff:{handoffId:'native-handoff-'+sha(c.attemptId+'\0'+receipt.receiptId),identityId:identity.identity_id,
              artifacts:[{kind:'native-runtime-receipt',sourceRef:'native-runtime-receipt:'+prior.nativeRef.slice('cue-native-runtime-receipt:'.length)}]}}:{})};},
        authorizeHandoffArtifact(sourceRef,attemptId){return Boolean(this.resolveHandoffArtifact(sourceRef,attemptId));},
        resolveHandoffArtifact(sourceRef,attemptId){
          if(typeof sourceRef!=='string'||!/^native-runtime-receipt:[a-f0-9]{64}$/u.test(sourceRef))return null;
          const digest=sourceRef.slice('native-runtime-receipt:'.length),receipt=receiptStore.read('cue-native-runtime-receipt:'+digest);
          if(!receipt||receipt.attemptId!==attemptId)return null;
          const row=db.prepare('SELECT payload,payload_digest FROM native_runtime_receipt WHERE attempt_id=?').get(attemptId);
          return row?.payload_digest===digest&&Buffer.isBuffer(row.payload)?Uint8Array.from(row.payload):null;
        },
      },
      runtime:{evidence:evidencePolicy,
        authorizeRun(attemptId,candidateId,role,binding){try{const task=binding.taskId,expectedRole=roleOf(binding.workflowRunId,task);
          if(binding.attemptId!==attemptId||!((role==='implementation'&&expectedRole==='implementation')||(role==='model'&&expectedRole==='verifier'))
            ||candidateId!==candidateOf(binding.workflowRunId,task)||!boundAttempt(attemptId,task,candidateId)||!eligible(expectedRole))return false;
          if(role==='implementation'){
            const checked=checkFrozenStagedInput(db,{binding,contract:prepared.get(binding.workflowRunId)?.contractsByTask.get(task)});
            if(checked.status==='prelaunch-stage-seeds-match')recordFrozenStagedInputObservation(db,checked);
          }
          return true;}catch{return false;}},
        async verifyCleanup(context,execution){const ref=await execution.runtimeReceipt;if(!ref)throw Error('native-authorities-receipt-missing');
          const receipt=receiptStore.read(ref);if(!receipt||receipt.attemptId!==context.runId)throw Error('native-authorities-receipt-mismatch');
          const observation=processCleanup.observe(receipt);clean.set(context.runId,observation);return observation;},
      },
      engine:{
        reservation(c){const role=roleOf(c.request.runId,c.task.id);if(!role||!expected(c.request.runId,c.task.id,c.candidateId,c.plan.digest,prepared.get(c.request.runId)?.envelopeHash))throw Error('native-authorities-reservation');
          return {runId:c.request.runId,attemptId:c.request.attemptId,requestId:c.request.requestId,currency:config.accounting.currency,
            unit:config.accounting.unit,upperUnits:config.accounting.upperUnitsByRole[role],source:config.accounting.source,
            observedAtMs:now(),scope:'verified-completion-attempt-total'};},
        verifyBudgetMapping(policy,budget){return policy.policy.currency===config.accounting.currency&&budget.currency===config.accounting.currency
          &&budget.unit===config.accounting.unit&&budget.limitUnits===config.accounting.limitUnits;},
        authorizeExecution(c){return expected(c.request.runId,c.task.id,c.candidateId,c.plan.digest,prepared.get(c.request.runId)?.envelopeHash);},
        receipts(c,runtime){const observation=clean.get(c.request.attemptId);const row=db.prepare('SELECT payload_digest FROM native_runtime_receipt WHERE attempt_id=?').get(c.request.attemptId);
          const nativeRef=row?'cue-native-runtime-receipt:'+row.payload_digest:null,native=nativeRef&&receiptStore.read(nativeRef);
          if(!observation||!native||!cleanupStore.read(observation.evidenceRef))return{execution:null,billing:null};
          const outcome=nativeRuntimeReceiptOutcome(runtime,native.outcome);
          if(outcome===null)return{execution:null,billing:null};
          let receipt=issued.get(c.request.attemptId);
          if(receipt&&receipt.outcome!==outcome)throw Error('native-authorities-runtime-outcome-drift');
          if(!receipt){receipt={runId:c.request.runId,taskId:c.task.id,attemptId:c.request.attemptId,receiptId:'native-'+sha(c.request.attemptId),revision:1,
            outcome,cleanup:observation.result==='verified-clean'?'clean':'unknown',evidenceRef:observation.evidenceRef,observedAtMs:now(),nativeRef};
            issued.set(c.request.attemptId,receipt);}
          const {nativeRef:_,...execution}=receipt;
          return {execution,billing:{runId:c.request.runId,requestId:c.request.requestId,receiptId:'native-billing-'+sha(c.request.attemptId),revision:1,
            currency:config.accounting.currency,unit:config.accounting.unit,kind:'unknown',units:null,providerFinal:false,
            source:'native-provider-billing-unobserved',observedAtMs:now()}};},
      }});
    if (host.available === false) return host;
    return Object.freeze({...host,prepare(run,proposal){const summary=host.prepare.call(this,run,proposal);
      const ref=`${summary.policy.policyId}:${summary.policy.revision}`;
      const plan=validateTaskPlan({policyRevision:ref,policyDigest:summary.policy.digest,requirementIds:summary.requirementIds,
        allowedCandidateIds:[ids.implementation,ids.verifier],allowedScopeIds:['approved-existing-files']},summary.proposedPlan);
      const contractsByTask=new Map();
      if(proposal){const registry=new Map((config.workflow.proposalRequirements??[]).map(row=>[row.requirementId,createNativeExistingFileContract(row.expectedArtifacts)]));
        for(const task of plan.tasks.filter(task=>task.role==='implementation')){
          if(task.requirementIds.length!==1||!registry.has(task.requirementIds[0]))throw Error('native-authorities-proposal-registry');
          contractsByTask.set(task.id,registry.get(task.requirementIds[0]));
        }
      }else contractsByTask.set('implement',contract);
      prepared.set(run.runId,{plan,envelopeHash:run.envelopeHash,worktree:run.envelope.worktree_realpath,contractsByTask,proposal:Boolean(proposal)});return summary;}});
  };
}
