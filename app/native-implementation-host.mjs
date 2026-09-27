import { isAbsolute, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { createDefaultCodexCandidate, createCodexVerifierCandidate } from '../daemon/dist/src/adapters/integration-executors.js';
import { createIntegrationCatalog } from '../daemon/dist/src/integration-catalog.js';
import { subjectDigest } from '../daemon/dist/src/measurement-subject.js';
import { validateTaskPlan } from '../daemon/dist/src/orchestration/plan.js';
import { readSelectionPolicy } from '../daemon/dist/src/selection/policy-store.js';
import { selectCandidate } from '../daemon/dist/src/selection/policy.js';
import { createStagedExistingFilePublicationHost } from './staged-existing-file-publication-host.mjs';
import { bindProviderInstallationCandidate } from './provider-installation-binding.mjs';
import { createNativeExistingFileContract, NATIVE_EXISTING_FILE_CHECKER_ID, NATIVE_EXISTING_FILE_CHECKER_REVISION } from '../daemon/dist/src/verification/native-existing-file-checker.js';
import { createNativeExistingFileAcceptanceHost } from '../daemon/dist/src/verification/native-existing-file-acceptance-host.js';
import { createNativeRuntimeReceiptStore } from '../daemon/dist/src/orchestration/native-runtime-receipts.js';
import { readAccountIdentities } from '../daemon/dist/src/orchestration/account-binding.js';

const MODES = Object.freeze(['efficiency', 'performance', 'value', 'speed']);
const unavailable = reason => Object.freeze({ available: false, reasons: Object.freeze([reason]) });
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const bounded = (value, max) => Number.isSafeInteger(value) && value > 0 && value <= max;
const plain = value => value && typeof value === 'object' && !types.isProxy(value) && Object.getPrototypeOf(value) === Object.prototype;
function capture(value) {
  if (!plain(value)) throw Error('native-implementation-authority-invalid');
  const descriptors = Object.getOwnPropertyDescriptors(value), copy = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error('native-implementation-authority-invalid');
    copy[key] = descriptor.value;
  }
  return Object.freeze(copy);
}
function snapshot(value, depth = 0) {
  if (depth > 8) throw Error('native-implementation-data-invalid');
  if (value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value))) return value;
  if (!value || typeof value !== 'object' || types.isProxy(value)) throw Error('native-implementation-data-invalid');
  const array = Array.isArray(value), expected = array ? Array.prototype : Object.prototype;
  if (Object.getPrototypeOf(value) !== expected) throw Error('native-implementation-data-invalid');
  const descriptors = Object.getOwnPropertyDescriptors(value), copy = array ? [] : {};
  for (const key of Reflect.ownKeys(descriptors)) {
    if (array && key === 'length') continue;
    const descriptor = descriptors[key];
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error('native-implementation-data-invalid');
    copy[key] = snapshot(descriptor.value, depth + 1);
  }
  if (array && Reflect.ownKeys(descriptors).length !== value.length + 1) throw Error('native-implementation-data-invalid');
  return Object.freeze(copy);
}
function authoritySnapshot(value, depth = 0) {
  if (typeof value === 'function') return value;
  if (depth > 8) throw Error('native-implementation-authority-invalid');
  if (value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value))) return value;
  if (!value || typeof value !== 'object' || types.isProxy(value)) throw Error('native-implementation-authority-invalid');
  const array=Array.isArray(value); if (Object.getPrototypeOf(value)!==(array?Array.prototype:Object.prototype)) throw Error('native-implementation-authority-invalid');
  const descriptors=Object.getOwnPropertyDescriptors(value), copy=array?[]:{};
  for(const key of Reflect.ownKeys(descriptors)){if(array&&key==='length')continue;const descriptor=descriptors[key];if(typeof key!=='string'||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('native-implementation-authority-invalid');copy[key]=authoritySnapshot(descriptor.value,depth+1);}
  if(array&&Reflect.ownKeys(descriptors).length!==value.length+1)throw Error('native-implementation-authority-invalid');return Object.freeze(copy);
}
const clone = snapshot;

function safeTarget(target, taskId='implement') {
  if (!plain(target) || !id(target.targetId) || typeof target.relativePath !== 'string' || !target.relativePath
    || isAbsolute(target.relativePath) || relative('.', target.relativePath).split(/[\\/]/u).includes('..')
    || !bounded(target.maxBackupBytes, 16 * 1024 * 1024)) throw Error('native-implementation-target-invalid');
  return Object.freeze({ taskId, targetId: target.targetId, relativePath: target.relativePath, maxBackupBytes: target.maxBackupBytes });
}

/** Production implementation composition. Configuration can identify authority;
 * it cannot create qualification, billing evidence, acceptance, or permissions. */
export function createNativeImplementationHost(options) {
  if (!plain(options)) return unavailable('native-implementation-missing-authority');
  const optionFields = Object.getOwnPropertyDescriptors(options);
  if (Reflect.ownKeys(optionFields).some(key => typeof key !== 'string' || !optionFields[key]?.enumerable || !Object.hasOwn(optionFields[key], 'value'))) return unavailable('native-implementation-missing-authority');
  const value = key => optionFields[key]?.value;
  if (!value('db')?.open || typeof value('now') !== 'function' || !plain(value('workflow'))
    || !plain(value('implementation')) || !plain(value('verifier')) || !plain(value('accounting'))
    || !plain(value('authority')) || !plain(value('runtime')) || !plain(value('engine'))
    || typeof value('authorizePublication') !== 'function') {
    return unavailable('native-implementation-missing-authority');
  }
  try {
    const nowSource=value('now'), implementation=capture(value('implementation')), verifier=capture(value('verifier')),
      authority=authoritySnapshot(value('authority')), runtime=authoritySnapshot(value('runtime')), engine=authoritySnapshot(value('engine')),
      authorizePublication=value('authorizePublication'), resolveRequirementChecker=value('resolveRequirementChecker'), verifyFinalBilling=value('verifyFinalBilling'),
      policyRefs=clone(value('policies'));
    const now = () => { const current = nowSource(); if (!Number.isSafeInteger(current) || current < 0) throw Error('native-implementation-clock'); return current; };
    const workflow = clone(value('workflow')), accounting = clone(value('accounting'));
    if (workflow.expectedArtifacts === undefined && !plain(value('acceptance')))
      return unavailable('native-implementation-missing-authority');
    if (!id(workflow.requirementId) || typeof workflow.requirementText !== 'string' || !workflow.requirementText
      || workflow.requirementText.length > 4096 || !id(workflow.checkerId) || !id(workflow.checkerRevision)
      || !digest(workflow.parametersDigest) || !Array.isArray(workflow.targets) || workflow.targets.length < 1 || workflow.targets.length > 64
      || !bounded(workflow.launchTimeoutMs, 120000) || !bounded(workflow.taskTimeoutMs, 600000) || !bounded(workflow.pollMs, 1000)) {
      return unavailable('native-implementation-workflow-invalid');
    }
    const targets = Object.freeze(workflow.targets.map(target=>safeTarget(target)));
    if (new Set(targets.map(target => target.relativePath.toLocaleLowerCase('en-US'))).size !== targets.length) return unavailable('native-implementation-target-invalid');
    const builtIn = workflow.expectedArtifacts !== undefined;
    if (builtIn && (value('acceptance') !== undefined || value('resolveRequirementChecker') !== undefined || value('requirementCheckers') !== undefined))
      return unavailable('native-implementation-checker-override');
    const contract = builtIn ? createNativeExistingFileContract(workflow.expectedArtifacts) : null;
    if (contract && (workflow.checkerId !== NATIVE_EXISTING_FILE_CHECKER_ID || workflow.checkerRevision !== NATIVE_EXISTING_FILE_CHECKER_REVISION
      || workflow.parametersDigest !== contract.parametersDigest || targets.length !== contract.targets.length
      || targets.some(target => !contract.targets.some(expected => expected.targetId === target.targetId && expected.relativePath === target.relativePath && expected.maxBytes === target.maxBackupBytes))))
      return unavailable('native-implementation-contract-mismatch');
    const proposalRegistry=new Map(),proposalPaths=new Set(),proposalTargetIds=new Set();
    if(workflow.proposalRequirements!==undefined){
      if(!contract||!Array.isArray(workflow.proposalRequirements)||workflow.proposalRequirements.length<1||workflow.proposalRequirements.length>64)
        return unavailable('native-implementation-proposal-registry');
      for(const row of workflow.proposalRequirements){
        if(!plain(row)||!id(row.requirementId)||proposalRegistry.has(row.requirementId)||typeof row.requirementText!=='string'
          ||!row.requirementText||row.requirementText.length>4096)throw Error('native-implementation-proposal-registry');
        const approved=createNativeExistingFileContract(row.expectedArtifacts);
        for(const target of approved.targets){
          const path=target.relativePath.toLocaleLowerCase('en-US');
          if(proposalPaths.has(path)||proposalTargetIds.has(target.targetId))throw Error('native-implementation-proposal-registry');
          proposalPaths.add(path);proposalTargetIds.add(target.targetId);
        }
        proposalRegistry.set(row.requirementId,Object.freeze({requirementId:row.requirementId,requirementText:row.requirementText,contract:approved}));
      }
    }
    const proposalRuns=new Map();
    if (!bounded(accounting.limitUnits, Number.MAX_SAFE_INTEGER) || !bounded(accounting.unitsPerCost, Number.MAX_SAFE_INTEGER)
      || !['minor', 'micro'].includes(accounting.unit) || typeof accounting.currency !== 'string' || !accounting.currency
      || typeof accounting.source !== 'string' || !accounting.source || !Number.isSafeInteger(accounting.observedAtMs)
      || accounting.observedAtMs < 0 || accounting.observedAtMs > now()
      || !bounded(accounting.upperUnitsByRole?.implementation, Number.MAX_SAFE_INTEGER)
      || !bounded(accounting.upperUnitsByRole?.verifier, Number.MAX_SAFE_INTEGER)) return unavailable('native-implementation-accounting-unqualified');

    const implementationRecord = clone(implementation.record);
    const verifierRecord = clone(verifier.record);
    const verifierCandidateInput=verifier.candidate === undefined ? undefined : authoritySnapshot(verifier.candidate);
    if (implementationRecord.kind !== 'agent' || verifierRecord.kind !== 'agent' || implementationRecord.canonicalId === verifierRecord.canonicalId
      || !id(implementationRecord.canonicalId) || !id(verifierRecord.canonicalId)
      || typeof implementation.currentSubject !== 'function' || typeof implementation.evidenceReferences !== 'function'
      || typeof implementation.observeCandidate !== 'function' || typeof verifier.currentSubject !== 'function'
      || typeof verifier.evidenceReferences !== 'function' || typeof verifier.observeCandidate !== 'function'
      || !plain(implementation.executor) || (verifierCandidateInput === undefined) === (verifier.executor === undefined)
      || (verifierCandidateInput !== undefined && (!plain(verifierCandidateInput) || !verifierCandidateInput.supportedRoles?.includes('model')))
      || (verifier.executor !== undefined && !plain(verifier.executor))) return unavailable('native-implementation-candidates-unqualified');
    if (verifier.installation !== undefined && verifier.executor === undefined) return unavailable('native-implementation-verifier-installation-unbound');
    const boundImplementation = implementation.installation === undefined ? implementation
      : Object.freeze({ ...implementation, ...bindProviderInstallationCandidate({ installation: implementation.installation,
        provider: 'codex', executablePath: implementation.executor.binary, record: implementationRecord,
        currentSubject: implementation.currentSubject, evidenceReferences: implementation.evidenceReferences }) });
    const implementationExecutor = capture(implementation.executor), implementationResolveBinding = implementationExecutor.resolveBinding;
    if (typeof implementationResolveBinding !== 'function') return unavailable('native-implementation-candidates-unqualified');
    const defaultImplementationCandidate = createDefaultCodexCandidate({ ...implementationExecutor,
      resolveBinding: context => { const resolved=implementationResolveBinding(context); if(!plain(resolved)||!plain(resolved.options))throw Error('native-implementation-binding-invalid');
        const staged=context.stagedPublication,proposal=staged&&proposalRuns.get(staged.runId),approved=proposal?proposal.targetsByTask.get(staged.taskId):targets;
        if(!approved||proposal&&(!staged||staged.targets.length!==approved.length||approved.some(target=>!staged.targets.some(item=>item.relativePath===target.relativePath&&item.maxBytes===target.maxBackupBytes))))throw Error('native-implementation-target-binding');
        return Object.freeze({...resolved,options:Object.freeze({...resolved.options,verificationMode:'approved-existing-file-change',approvedExistingTargets:Object.freeze(approved.map(target=>Object.freeze({relativePath:target.relativePath,maxBytes:target.maxBackupBytes})))})}); },
      buildCurrentSubject: boundImplementation.currentSubject, evidenceReferences: boundImplementation.evidenceReferences });
    const implementationCandidate = Object.freeze({ ...defaultImplementationCandidate, stagedPublication: 'attempt-owned-existing-files-v1' });
    const boundVerifier = verifier.installation === undefined ? verifier
      : Object.freeze({ ...verifier, ...bindProviderInstallationCandidate({ installation: verifier.installation,
        provider: 'codex', executablePath: verifier.executor.binary, record: verifierRecord,
        currentSubject: verifier.currentSubject, evidenceReferences: verifier.evidenceReferences }) });
    const verifierCandidate = verifier.executor === undefined
      ? Object.freeze({ ...verifierCandidateInput, buildCurrentSubject: verifier.currentSubject, evidenceReferences: verifier.evidenceReferences })
      : createCodexVerifierCandidate({ ...capture(verifier.executor), buildCurrentSubject: boundVerifier.currentSubject,
        evidenceReferences: boundVerifier.evidenceReferences });
    const candidates = Object.freeze({ implementation: Object.freeze({ record: implementationRecord, candidate: implementationCandidate,
      observe: implementation.observeCandidate, subject: boundImplementation.currentSubject }), verifier: Object.freeze({ record: verifierRecord,
      candidate: verifierCandidate, observe: verifier.observeCandidate, subject: boundVerifier.currentSubject }) });
    const catalog = createIntegrationCatalog({ now, maxAgeMs: runtime.evidence.maxAgeMs,
      currentSubjectDigest: candidateId => Object.values(candidates).find(value => value.record.canonicalId === candidateId)?.subject()
        ? subjectDigest(Object.values(candidates).find(value => value.record.canonicalId === candidateId).subject()) : undefined }, [implementationRecord, verifierRecord]);
    const policies = {};
    function observe(role) {
      const observation=clone(candidates[role].observe());
      if(observation.id!==candidates[role].record.canonicalId||!observation.estimate||observation.estimate.currency!==accounting.currency
        ||observation.estimate.conservativeMaxCost===null||Math.ceil(observation.estimate.conservativeMaxCost*accounting.unitsPerCost)>accounting.upperUnitsByRole[role])
        throw Error(`native-implementation-${role}-unqualified`);
      return observation;
    }
    for (const mode of MODES) {
      const ref = policyRefs?.[mode], policy = ref && readSelectionPolicy(value('db'), ref.policyId, ref.revision);
      if (!policy || policy.digest !== ref.digest || policy.policy.mode !== mode || policy.policy.currency !== accounting.currency
        || policy.policy.pinnedCandidateId !== null || ![implementationRecord.canonicalId, verifierRecord.canonicalId].every(value => policy.policy.allowedCandidateIds.includes(value))) {
        return unavailable(`native-implementation-policy-${mode}`);
      }
      for (const role of ['implementation', 'verifier']) {
        const observation = observe(role);
        if (selectCandidate(policy.policy, [observation], now()).selectedId !== observation.id) return unavailable(`native-implementation-${role}-unqualified`);
      }
      policies[mode] = policy;
    }
    const finalPublication = createStagedExistingFilePublicationHost({ db: value('db'), authorizePublication });
    const nativeAcceptance = contract ? createNativeExistingFileAcceptanceHost({db:value('db'),now,
      ...(!proposalRegistry.size?{contract,producerTaskId:'implement'}:{}),
      producerPrincipalForAttempt(stage) {
        try {
          const row=value('db').prepare(`SELECT a.run_id,a.task_id,a.candidate_id,l.expected_subject_digest,r.payload_digest
            FROM orchestration_attempt a JOIN orchestration_launch_intent l ON l.attempt_id=a.attempt_id
            JOIN native_runtime_receipt r ON r.attempt_id=a.attempt_id AND r.outcome='succeeded'
            WHERE a.attempt_id=?`).get(stage.attemptId);
          if(!row||row.run_id!==stage.workflowRunId||row.task_id!==stage.taskId||row.candidate_id!==implementationRecord.canonicalId)return null;
          const account=readAccountIdentities(value('db'),stage.workflowRunId).find(identity=>identity.candidateId===row.candidate_id);
          if(!account||account.subjectDigest!==row.expected_subject_digest||account.planDigest!==stage.planDigest
            ||account.policyDigest!==stage.policyDigest||account.envelopeHash!==stage.parentEnvelopeHash)return null;
          const receipt=createNativeRuntimeReceiptStore(value('db')).read('cue-native-runtime-receipt:'+row.payload_digest);
          if(!receipt||receipt.outcome!=='succeeded'||receipt.runId!==stage.workflowRunId||receipt.taskId!==stage.taskId
            ||receipt.attemptId!==stage.attemptId||receipt.candidateId!==row.candidate_id||receipt.subjectDigest!==row.expected_subject_digest
            ||receipt.role!=='implementation'||receipt.verificationMode!=='approved-existing-file-change')return null;
          const session=value('db').prepare('SELECT run_id,task_id FROM session_handle WHERE handle=?').get(receipt.sessionHandle);
          if(!session||session.run_id!==stage.owner.run_id||session.task_id!==stage.owner.task_id)return null;
          return 'native-implementation:'+createHash('sha256').update(JSON.stringify([account.authReference,account.subjectDigest])).digest('hex');
        } catch {return null;}
      }}) : null;
    const acceptance=nativeAcceptance?.acceptance??authoritySnapshot(value('acceptance'));
    const requirementCheckers=nativeAcceptance?null:clone(value('requirementCheckers'));
    const fixedResolve=nativeAcceptance?(checkerId,revision)=>checkerId===contract.checkerId&&revision===contract.checkerRevision&&!proposalRegistry.size
      ? nativeAcceptance.requirementChecker(workflow.requirementId):undefined:resolveRequirementChecker;
    const prepared = new Map();
    function proposalPreparation(run,proposal,policy,ref){
      if(!nativeAcceptance||!proposalRegistry.size||!proposal||proposal.proposedPlan.policyRevision!==ref
        ||proposal.proposedPlan.policyDigest!==policy.digest)throw Error('native-implementation-proposal-unavailable');
      const tasks=proposal.proposedPlan.tasks,writers=tasks.filter(task=>task.role==='implementation'),verifiers=tasks.filter(task=>task.role==='verifier');
      if(tasks.length<3||tasks.length>64||writers.length<2||verifiers.length!==1||writers.length>proposalRegistry.size
        ||tasks.some(task=>!['implementation','verifier'].includes(task.role)))throw Error('native-implementation-proposal-shape');
      const verifierTask=verifiers[0],requirements=new Map(proposal.requirements.map(requirement=>[requirement.id,requirement]));
      if(requirements.size!==writers.length||requirements.size!==proposal.requirements.length
        ||verifierTask.candidateIds.length!==1||verifierTask.candidateIds[0]!==verifierRecord.canonicalId
        ||verifierTask.scopeIds.length!==0||verifierTask.requirementIds.length!==requirements.size
        ||new Set(verifierTask.requirementIds).size!==requirements.size
        ||verifierTask.requirementIds.some(id=>!requirements.has(id)))throw Error('native-implementation-proposal-verifier');
      const plan=validateTaskPlan({policyRevision:ref,policyDigest:policy.digest,requirementIds:proposal.requirementIds,
        allowedCandidateIds:policy.policy.allowedCandidateIds,allowedScopeIds:['approved-existing-files']},proposal.proposedPlan);
      const ordered=plan.topologicalOrder.map(id=>writers.find(task=>task.id===id)).filter(Boolean);
      const targetsByTask=new Map(),bindings=[],usedTargets=new Set(),usedPaths=new Set();
      for(let i=0;i<ordered.length;i++){
        const task=ordered[i];
        if(task.candidateIds.length!==1||task.candidateIds[0]!==implementationRecord.canonicalId
          ||task.scopeIds.length!==1||task.scopeIds[0]!=='approved-existing-files'
          ||task.requirementIds.length!==1||i>0&&!task.dependencyIds.includes(ordered[i-1].id)
          ||!verifierTask.dependencyIds.includes(task.id))throw Error('native-implementation-proposal-writer');
        const requirement=requirements.get(task.requirementIds[0]),registered=proposalRegistry.get(task.requirementIds[0]);
        if(!requirement||!registered||requirement.text!==registered.requirementText||requirement.kind!=='code'||requirement.required!==true
          ||requirement.checks.length!==1)throw Error('native-implementation-proposal-requirement');
        const check=requirement.checks[0],approved=registered.contract;
        if(check.checkerId!==NATIVE_EXISTING_FILE_CHECKER_ID||check.revision!==NATIVE_EXISTING_FILE_CHECKER_REVISION
          ||check.parametersDigest!==approved.parametersDigest||check.targetIds.length!==approved.targets.length
          ||new Set(check.targetIds).size!==check.targetIds.length||check.targetIds.some(id=>!approved.targets.some(target=>target.targetId===id)))
          throw Error('native-implementation-proposal-checker');
        const taskTargets=proposal.changeTargets.filter(target=>target.taskId===task.id).map(target=>safeTarget(target,task.id));
        if(taskTargets.length!==approved.targets.length||taskTargets.some(target=>!approved.targets.some(expected=>expected.targetId===target.targetId
          &&expected.relativePath===target.relativePath&&expected.maxBytes===target.maxBackupBytes)))throw Error('native-implementation-proposal-target');
        for(const target of taskTargets){const path=target.relativePath.toLocaleLowerCase('en-US');if(usedTargets.has(target.targetId)||usedPaths.has(path))throw Error('native-implementation-proposal-target');usedTargets.add(target.targetId);usedPaths.add(path);}
        targetsByTask.set(task.id,Object.freeze(taskTargets));
        bindings.push(Object.freeze({requirementId:registered.requirementId,producerTaskId:task.id,verifierTaskId:verifierTask.id,contract:approved}));
      }
      if(proposal.changeTargets.length!==usedTargets.size||proposal.requirementIds.length!==requirements.size
        ||proposal.requirementIds.some(id=>!requirements.has(id)))throw Error('native-implementation-proposal-coverage');
      const checkers=[nativeAcceptance.registerRun(run.runId,Object.freeze(bindings))];
      return Object.freeze({policy:{policyId:policy.policyId,revision:policy.revision,digest:policy.digest},requirementIds:proposal.requirementIds,
        proposedPlan:proposal.proposedPlan,scopes:[{id:'approved-existing-files',worktreeRealpath:run.envelope.worktree_realpath,allowedActions:['file_change'],egress:[]}],
        requirements:proposal.requirements,requirementCheckers:checkers,changeTargets:proposal.changeTargets,stagedPublication:true,executionStaging:true,
        budget:{runId:run.runId,currency:accounting.currency,unit:accounting.unit,limitUnits:accounting.limitUnits,policyRevision:ref,source:accounting.source,observedAtMs:accounting.observedAtMs},
        limits:{launchTimeoutMs:workflow.launchTimeoutMs,taskTimeoutMs:workflow.taskTimeoutMs,pollMs:workflow.pollMs,maxParallelReadTasks:1},
        targetsByTask});
    }
    const host = {
      executionStagingSupport: 'git-worktree-v1',...(proposalRegistry.size?{supportsGoalProposals:true}:{}),now,catalog,acceptance,resolveRequirementChecker:fixedResolve,
      finalPublication,
      prepare(run,proposal) {
        if (!this.executionStaging) throw Error('native-implementation-staging-unconfigured');
        const mode = run.selectionMode ?? 'efficiency', policy = policies[mode];
        if (!policy || !run.envelope.allowed_actions.includes('file_change')
          || run.envelope.egress.length !== 0) throw Error('native-implementation-parent-envelope');
        const prior = prepared.get(run.runId); if (prior) {
          if(prior.runJson!==JSON.stringify(run)||prior.proposalDigest!==(proposal?.digest??null))throw Error('native-implementation-run-changed');
          return prior.configuration;
        }
        const ref = `${policy.policyId}:${policy.revision}`;
        if(proposal){const configured=proposalPreparation(run,proposal,policy,ref),{targetsByTask,...configuration}=configured;
          proposalRuns.set(run.runId,Object.freeze({targetsByTask,tasks:new Map(proposal.proposedPlan.tasks.map(task=>[task.id,task]))}));
          prepared.set(run.runId,{runJson:JSON.stringify(run),proposalDigest:proposal.digest,configuration:Object.freeze(configuration)});
          return Object.freeze(configuration);}
        const proposedPlan = { revision: 'native-existing-files-v1', policyRevision: ref, policyDigest: policy.digest, tasks: [
          { id: 'implement', role: 'implementation', ownerId: 'codex-implementation', requirementIds: [workflow.requirementId], dependencyIds: [], candidateIds: [implementationRecord.canonicalId], scopeIds: ['approved-existing-files'] },
          { id: 'verify', role: 'verifier', ownerId: 'independent-verifier', requirementIds: [workflow.requirementId], dependencyIds: ['implement'], candidateIds: [verifierRecord.canonicalId], scopeIds: [] },
        ] };
        validateTaskPlan({ policyRevision: ref, policyDigest: policy.digest, requirementIds: [workflow.requirementId],
          allowedCandidateIds: policy.policy.allowedCandidateIds, allowedScopeIds: ['approved-existing-files'] }, proposedPlan);
        const value = Object.freeze({ policy: { policyId: policy.policyId, revision: policy.revision, digest: policy.digest }, requirementIds: [workflow.requirementId], proposedPlan,
          scopes: [{ id: 'approved-existing-files', worktreeRealpath: run.envelope.worktree_realpath, allowedActions: ['file_change'], egress: [] }],
          requirements: [{ id: workflow.requirementId, text: workflow.requirementText, kind: 'code', required: true,
            checks: [{ checkerId: workflow.checkerId, revision: workflow.checkerRevision, parametersDigest: workflow.parametersDigest, targetIds: targets.map(target => target.targetId) }] }],
          requirementCheckers:nativeAcceptance?(proposalRegistry.size?[nativeAcceptance.registerRun(run.runId,[{requirementId:workflow.requirementId,producerTaskId:'implement',verifierTaskId:'verify',contract}])]:[nativeAcceptance.requirementChecker(workflow.requirementId)]):requirementCheckers,
          changeTargets: targets, stagedPublication: true, executionStaging: true,
          budget: { runId: run.runId, currency: accounting.currency, unit: accounting.unit, limitUnits: accounting.limitUnits,
            policyRevision: ref, source: accounting.source, observedAtMs: accounting.observedAtMs },
          limits: { launchTimeoutMs: workflow.launchTimeoutMs, taskTimeoutMs: workflow.taskTimeoutMs, pollMs: workflow.pollMs } });
        prepared.set(run.runId,{runJson:JSON.stringify(run),proposalDigest:null,configuration:value}); return value;
      },
      verifyFinalBilling, authority,
      runtime: { ...runtime,
        resolveCandidate(candidateId) { return candidateId === implementationRecord.canonicalId ? implementationCandidate : candidateId === verifierRecord.canonicalId ? verifierCandidate : undefined; },
        authorizeRun(attemptId, candidateId, role, binding) { const proposed=proposalRuns.get(binding.workflowRunId)?.tasks.get(binding.taskId);
          return runtime.authorizeRun(attemptId, candidateId, role, binding) === true
          && (proposed?((role==='implementation'&&proposed.role==='implementation'&&candidateId===implementationRecord.canonicalId)
            ||(role==='model'&&proposed.role==='verifier'&&candidateId===verifierRecord.canonicalId))
            :((role === 'implementation' && binding.taskId === 'implement' && candidateId === implementationRecord.canonicalId)
            || (role === 'model' && binding.taskId === 'verify' && candidateId === verifierRecord.canonicalId))); },
      },
      engine: { ...engine,
        observeCandidates(_request, task) { const role = task.role === 'implementation' ? 'implementation' : task.role === 'verifier' ? 'verifier' : null;
          if (!role) throw Error('native-implementation-role'); return [observe(role)]; },
        reservation(context) { const terms=engine.reservation(context), role=context.task.role==='implementation'?'implementation':'verifier';
          if(terms.upperUnits!==accounting.upperUnitsByRole[role]||terms.currency!==accounting.currency||terms.unit!==accounting.unit||terms.source!==accounting.source)throw Error('native-implementation-reservation-unbound');return terms; },
        verifyBudgetMapping(policy,budget){return engine.verifyBudgetMapping(policy,budget)===true&&policy.policy.currency===accounting.currency&&budget.currency===accounting.currency&&budget.unit===accounting.unit&&budget.limitUnits===accounting.limitUnits;},
      },
      stage(context, run) { return { worktreeRealpath: run.envelope.worktree_realpath, allowedActions: context.task.role === 'implementation' ? ['file_change'] : [],
        egress: [], expiresAt: run.envelope.expires_at, autonomyLevel: 'bounded' }; },
    };
    return Object.freeze(host);
  } catch (error) {
    return unavailable(error instanceof Error && /^native-implementation-[a-z0-9-]+$/u.test(error.message) ? error.message : 'native-implementation-invalid');
  }
}
