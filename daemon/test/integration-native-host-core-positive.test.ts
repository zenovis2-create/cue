import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test, vi } from 'vitest';
const issuer=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('../src/host-codex-runtime.js',async original=>({...await original() as object,readIssuedNativeRuntimeEvidence:issuer.read}));
import { createNativeImplementationHost } from '../../app/native-implementation-host.mjs';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import { createDeploymentStagingOrchestrationFactory } from '../../app/deployment-staging-host.mjs';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { createNativeExistingFileContract } from '../src/verification/native-existing-file-checker.js';
import { createOrchestrationStore } from '../src/orchestration/store.js';
import { createStageEnvelopeBinder } from '../src/orchestration/stage-envelope.js';
import { createHandoffActivityStore } from '../src/orchestration/handoff-activity.js';
import { createNativeRuntimeReceiptStore } from '../src/orchestration/native-runtime-receipts.js';
import { readAccountIdentities } from '../src/orchestration/account-binding.js';
import { createAcceptanceVerifier } from '../src/verification/acceptance.js';

test('Core binds the built-in native existing-file checker from approved expected bytes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-native-implementation-host-')), workspace = join(root, 'workspace'); mkdirSync(workspace);
  const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
  writeFileSync(join(workspace,'target.txt'),'original bytes');
  const expectedArtifacts=[{targetId:'target',relativePath:'target.txt',maxBytes:1024,expectedSha256:sha('replacement'),expectedByteLength:11,originalSha256:sha('original bytes')}];
  const contract=createNativeExistingFileContract(expectedArtifacts);
  const config = initializeConfig(join(root, 'data'), { worktreeRoot: workspace }), daemon = new AppDaemon(config), db = daemon.db;
  const now = Date.now(), ids = ['codex-current', 'independent-verifier']; let launches=0,reservations=0,verifierCost=1;
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key])) as MeasurementSubject;
  const observed = (candidateId:string) => ({ id:candidateId, checks:{eligible:true,authenticated:true,compatible:true,dataAllowed:true,resourceAvailable:true,quotaAvailable:true},
    estimate:{scope:'verified-completion-total',quality:1,expectedCost:1,conservativeMaxCost:1,expectedTimeMs:1,conservativeMaxTimeMs:1,currency:'TEST',source:'fixture',observedAtMs:now} });
  const policies:any = {};
  for (const mode of ['efficiency','performance','value','speed'] as const) {
    const saved=saveSelectionPolicy(db,{policyId:`native-${mode}`,expectedRevision:null,createdAt:new Date(now).toISOString(),sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode,
      qualityMinimum:0.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:10000,allowedCandidateIds:ids,pinnedCandidateId:null}});
    policies[mode]={policyId:saved.policyId,revision:saved.revision,digest:saved.digest};
  }
  const record=(canonicalId:string)=>({canonicalId,toolId:canonicalId,kind:'agent' as const,aliases:[],installation:'installed' as const,protocol:'verified' as const,
    authReference:`account-${canonicalId}`,authAvailable:true,sourceVersion:'fixture',observedAt:new Date(now).toISOString(),subjectDigest:subjectDigest(subject),binding:null});
  const options:any={db,now:()=>now,workflow:{requirementId:'implementation-correct',requirementText:'Implement the approved existing file and pass independent verification.',
    checkerId:contract.checkerId,checkerRevision:contract.checkerRevision,parametersDigest:contract.parametersDigest,expectedArtifacts,targets:[{targetId:'target',relativePath:'target.txt',maxBackupBytes:1024}],launchTimeoutMs:1000,taskTimeoutMs:5000,pollMs:5},
    policies,accounting:{currency:'TEST',unit:'micro',limitUnits:100,unitsPerCost:1,source:'fixture-authority',observedAtMs:now,upperUnitsByRole:{implementation:10,verifier:10}},
    implementation:{record:record(ids[0]),currentSubject:()=>subject,evidenceReferences:()=>({}),observeCandidate:()=>observed(ids[0]) as any,
      executor:{db,binary:'C:/Program Files/OpenAI/Codex/codex.exe',model:'gpt-5',tool:{id:'codex',revision:'fixture'},availability:'ready',resolveBinding:()=>{launches++;throw Error('provider launch forbidden');}}},
    verifier:{record:record(ids[1]),currentSubject:()=>subject,evidenceReferences:()=>({}),observeCandidate:()=>({...observed(ids[1]),estimate:{...observed(ids[1]).estimate,conservativeMaxCost:verifierCost}}) as any,candidate:{kind:'agent',supportedRoles:['model'],cancellation:'supported',usage:'supported',availability:'ready',typedActivitySource:'host-codex-controller-v1',durableExecutionRef:'session-handle-v1',buildCurrentSubject:()=>subject,evidenceReferences:()=>({}),launch:async()=>{launches++;throw Error('provider launch forbidden');}}},
    authorizePublication:()=>true,
    verifyFinalBilling:()=>false,authority:{authorizePlan:()=>true,authorizeClaim:()=>true,authorizeStage:()=>true,verifyReceipt:()=>({outcomeVerified:false,cleanupVerified:false})},
    runtime:{evidence:{now:()=>now,maxAgeMs:1000,resolveEvidence:()=>undefined},authorizeRun:()=>true,verifyCleanup:async()=>{throw Error('not executed');}},
    engine:{reservation:(context:any)=>{reservations++;return{runId:context.request.runId,attemptId:context.request.attemptId,requestId:context.request.requestId,currency:'TEST',unit:'micro',upperUnits:10,source:'fixture-authority',observedAtMs:now,scope:'verified-completion-attempt-total'};},verifyBudgetMapping:()=>true,authorizeExecution:()=>true,receipts:()=>({execution:null,billing:null})}
  };
  const result=createNativeImplementationHost(options);
  expect((result as any).acceptance.resolveChecker(contract.checkerId,contract.checkerRevision)).toBeDefined();
  expect((result as any).resolveRequirementChecker(contract.checkerId,contract.checkerRevision).evidencePolicies[0].parametersDigest).toBe(contract.parametersDigest);
  let getterReads=0;const hostileCandidate:any={};Object.defineProperty(hostileCandidate,'supportedRoles',{enumerable:true,get(){getterReads++;return['model'];}});
  expect(createNativeImplementationHost({...options,verifier:{...options.verifier,candidate:hostileCandidate}})).toEqual({available:false,reasons:['native-implementation-authority-invalid']});expect(getterReads).toBe(0);
  expect((result as any).executionStagingSupport).toBe('git-worktree-v1');
  verifierCost=100;expect(()=>((result as any).engine.observeCandidates({}, {role:'verifier'}))).toThrow('native-implementation-verifier-unqualified');expect(reservations).toBe(0);verifierCost=1;
  const storageRoot=join(root,'staging');mkdirSync(storageRoot);
  const factory=await createDeploymentStagingOrchestrationFactory({configuration:JSON.stringify({version:'cue-git-staging-deployment-v1',enabled:true,storageRoot}),
    createOrchestrationFactory:()=>()=>result as any,createStagingHost:()=>({inspectCleanRoot:(worktreeRealpath:string)=>({worktreeRealpath,rootIdentity:{volumeSerial:'1'.repeat(16),fileId:'2'.repeat(32)},baseCommitId:'d'.repeat(40),trackedModified:[],staged:[],untracked:[],conflicted:[],detached:false,unborn:false,reparseFree:true}),factory:{protocol:'cue-attempt-staging-factory-v1',sha256:'c'.repeat(64),create:(input:any)=>({worktreeRealpath:join(storageRoot,input.attemptId),rootIdentity:{volumeSerial:'3'.repeat(16),fileId:'4'.repeat(32)},reparseFree:true}),inspectRoot:(input:any)=>input,reconcilePublished:()=>{},cleanup:()=>({rootAbsent:true,metadataAbsent:true,evidenceSha256:'e'.repeat(64)}),inspectCleanup:()=>({rootAbsent:true,metadataAbsent:true,evidenceSha256:'e'.repeat(64)})}}) as any});
  const core=createCueCore(config,daemon,{orchestrationFactory:factory});
  try {
    const prepared=core.prepareGoal('Update target.txt under the approved existing-file contract.');
    expect(prepared.orchestration?.stages.map(stage=>stage.role)).toEqual(['implementation','verifier']);
    const baseline=await core.requestManualEvaluationBaseline({baselineId:'native-baseline',enrollmentId:'native-enrollment',runId:prepared.runId,
      dataset:{id:'native-cases',revision:'v1',cases:[{id:'eval',kind:'code',split:'evaluation',inputDigest:sha('eval')},{id:'hold',kind:'code',split:'holdout',inputDigest:sha('hold')}]},caseId:'eval',
      metric:{id:'metric',revision:'fixture',digest:sha('metric')},environment:{id:'env',revision:'fixture',digest:sha('env')},accountLimits:{id:'limits',revision:'fixture',digest:sha('limits')}},async view=>{
        expect(view.tasks.map(task=>task.candidateId)).toEqual(ids);expect(view.executionAuthorized).toBe(false);return true; // Explicitly injected test consent, not a real user.
      });
    expect(baseline.enrollment.arm).toBe('manual-baseline');expect(baseline.planDigest).toBe(prepared.orchestration?.planDigest);
    expect(db.prepare('SELECT COUNT(*) n FROM approval_event WHERE run_id=?').get(prepared.runId)).toEqual({n:0});
    core.approve(prepared.runId);
    db.prepare("UPDATE task SET state='running' WHERE id=?").run(prepared.taskId);
    expect(db.prepare('SELECT relative_path,max_backup_bytes FROM change_target_contract WHERE run_id=?').all(prepared.runId)).toEqual([{relative_path:'target.txt',max_backup_bytes:1024}]);
    expect(db.prepare('SELECT COUNT(*) n FROM approval_event WHERE run_id=?').get(prepared.runId)).toEqual({n:1});
    const bytes=Buffer.from('fixture-handoff');
    const store=createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>true,
      verifyReceipt:context=>({outcomeVerified:true,cleanupVerified:true,handoff:{handoffId:`handoff-${context.attemptId}`,
        identityId:`identity-${context.attemptId}`,artifacts:[{kind:'output',sourceRef:`artifact-${context.attemptId}`}]}}),
      resolveHandoffArtifact:()=>bytes,authorizeHandoffArtifact:()=>true});
    const handoffs=createHandoffActivityStore(db,{resolveArtifact:()=>bytes,authorizeArtifact:()=>true});
    const accounts=readAccountIdentities(db,prepared.runId);
    expect(accounts.map(account=>account.candidateId).sort()).toEqual([...ids].sort());
    const binder=createStageEnvelopeBinder(db,{now:()=>now,authorizeStage:()=>true,
      resolveScope:scopeId=>({id:scopeId,worktreeRealpath:workspace,allowedActions:['file_change'],egress:[]})});
    let deferredVerifierReceipt:{issued:object;binding:any}|null=null;
    for(const [task,candidate,role,mode] of [
      ['implement',ids[0],'implementation','approved-existing-file-change'],
      ['verify',ids[1],'model','read-only-result'],
    ] as const){
      const attemptId=`attempt-${task}`,subjectDigest=accounts.find(account=>account.candidateId===candidate)!.subjectDigest;
      store.claim({runId:prepared.runId,taskId:task,attemptId,candidateId:candidate,observedAtMs:now});
      db.prepare("INSERT INTO attempt_selection VALUES(?,?,?,?,?,?)").run(attemptId,prepared.runId,`selection-${task}`,'monetary',sha(task),'{}');
      const stage=binder.bind({workflowRunId:prepared.runId,taskId:task,attemptId,parentEnvelope:prepared.envelope as any,
        stage:{worktreeRealpath:workspace,allowedActions:task==='implement'?['file_change']:[],egress:[],expiresAt:prepared.envelope.expires_at as string,autonomyLevel:'bounded'}});
      const sessionHandle=`session-${task}`;
      db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(sessionHandle,task==='implement'?1201:1202,'now',workspace,stage.owner.task_id,attemptId);
      const selected=db.prepare('SELECT digest FROM attempt_selection WHERE attempt_id=?').get(attemptId) as {digest:string};
      handoffs.recordLaunchIntent({runId:prepared.runId,taskId:task,attemptId,candidateId:candidate,selectionDigest:selected.digest,
        expectedSubjectDigest:subjectDigest,tool:{id:'fixture-tool',revision:'unknown'},model:null,parentEnvelopeHash:stage.parentEnvelopeHash,
        stageEnvelopeHash:stage.envelopeHash,planDigest:stage.planDigest,policyDigest:stage.policyDigest});
      handoffs.recordAttemptIdentity({identityId:`identity-${attemptId}`,attemptId,subjectDigest,durableRef:`session:${sessionHandle}`,observedAtMs:now});
      const binding={runId:prepared.runId,taskId:task,attemptId,candidateId:candidate,subjectDigest,sessionHandle,role,verificationMode:mode};
      const issued={};
      issuer.read.mockImplementation((given:unknown,bound:unknown)=>{
        if(given!==issued||JSON.stringify(bound)!==JSON.stringify(binding))throw Error('not-issued');
        return {version:'cue-issued-native-runtime-evidence-v1',...binding,
          outcomeInputs:{status:'completed',failureKind:null,goalVerification:task==='implement'
            ?{passed:true,reason:'workspace_changed',changedPaths:['target.txt']}
            :{passed:false,reason:'read_only_result_received',changedPaths:[]}},
          controller:{pid:task==='implement'?1201:1202,createdFileTime:'133000000000000000'},workers:[],resources:[]};
      });
      if(task==='verify')deferredVerifierReceipt={issued,binding};
      else createNativeRuntimeReceiptStore(db).recordIssued(issued as never,binding,now);
      store.finish({runId:prepared.runId,taskId:task,attemptId,receiptId:`finished-${task}`,revision:1,outcome:'succeeded',cleanup:'clean',
        evidenceRef:'fixture-completion',observedAtMs:now});
    }
    writeFileSync(join(workspace,'target.txt'),'replacement');
    const acceptance=createAcceptanceVerifier(db,(result as any).acceptance);
    expect((await acceptance.collect(prepared.runId)).verdict).toBe('unknown');
    createNativeRuntimeReceiptStore(db).recordIssued(deferredVerifierReceipt!.issued as never,deferredVerifierReceipt!.binding,now);
    const evaluation=await acceptance.collect(prepared.runId);
    expect(evaluation.verdict).toBe('pass');
    writeFileSync(join(workspace,'target.txt'),'wrong bytes');
    expect((await acceptance.collect(prepared.runId)).verdict).toBe('fail');
    expect(launches).toBe(0);
  } finally { try { await core.close(); } catch { await daemon.close(); } rmSync(root,{recursive:true,force:true}); }
});
