import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { createNativeImplementationHost } from '../../app/native-implementation-host.mjs';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import { createDeploymentStagingOrchestrationFactory } from '../../app/deployment-staging-host.mjs';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';

test('native implementation host refuses before provider composition when authority is incomplete', () => {
  let touched = 0;
  const result = createNativeImplementationHost(Object.defineProperty({}, 'db', { enumerable: true, get() { touched++; throw Error('provider touched'); } }) as any);
  expect(result).toEqual({ available: false, reasons: ['native-implementation-missing-authority'] });
  expect(touched).toBe(0);
});

test('Core prepares and approves the staged existing-file implementation and independent verifier plan without launching providers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-native-implementation-host-')), workspace = join(root, 'workspace'); mkdirSync(workspace);
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
  const evidencePolicy={requirementId:'implementation-correct',kind:'code' as const,producerTaskIds:['implement'],sourceRevision:'fixture-workspace-v1',targetIds:['target'],
    checkerId:'fixture-checker',checkerRevision:'v1',parametersDigest:'b'.repeat(64),hostileCheckIds:[],requiredSectionIds:[],claimIds:[],requiresRender:false};
  const checker={id:'fixture-checker',revision:'v1',kinds:['code'] as const,evidencePolicies:[evidencePolicy]};
  const options:any={db,now:()=>now,workflow:{requirementId:'implementation-correct',requirementText:'Implement the approved existing file and pass independent verification.',
    checkerId:'fixture-checker',checkerRevision:'v1',parametersDigest:'b'.repeat(64),targets:[{targetId:'target',relativePath:'target.txt',maxBackupBytes:1024}],launchTimeoutMs:1000,taskTimeoutMs:5000,pollMs:5},
    policies,accounting:{currency:'TEST',unit:'micro',limitUnits:100,unitsPerCost:1,source:'fixture-authority',observedAtMs:now,upperUnitsByRole:{implementation:10,verifier:10}},
    implementation:{record:record(ids[0]),currentSubject:()=>subject,evidenceReferences:()=>({}),observeCandidate:()=>observed(ids[0]) as any,
      executor:{db,binary:'C:/Program Files/OpenAI/Codex/codex.exe',model:'gpt-5',tool:{id:'codex',revision:'fixture'},availability:'ready',resolveBinding:()=>{launches++;throw Error('provider launch forbidden');}}},
    verifier:{record:record(ids[1]),currentSubject:()=>subject,evidenceReferences:()=>({}),observeCandidate:()=>({...observed(ids[1]),estimate:{...observed(ids[1]).estimate,conservativeMaxCost:verifierCost}}) as any,candidate:{kind:'agent',supportedRoles:['model'],cancellation:'supported',usage:'supported',availability:'ready',typedActivitySource:'host-codex-controller-v1',durableExecutionRef:'session-handle-v1',buildCurrentSubject:()=>subject,evidenceReferences:()=>({}),launch:async()=>{launches++;throw Error('provider launch forbidden');}}},
    requirementCheckers:[checker],resolveRequirementChecker:(id:string,revision:string)=>id===checker.id&&revision===checker.revision?checker as any:undefined,
    acceptance:{now:()=>now,timeoutMs:1000,maxObservationAgeMs:1000,resolveChecker:()=>undefined,principalForAttempt:()=>null,captureManifest:async()=>{throw Error('not executed');},isManifestCurrent:()=>false},
    authorizePublication:()=>true,
    verifyFinalBilling:()=>false,authority:{authorizePlan:()=>true,authorizeClaim:()=>true,authorizeStage:()=>true,verifyReceipt:()=>({outcomeVerified:false,cleanupVerified:false})},
    runtime:{evidence:{now:()=>now,maxAgeMs:1000,resolveEvidence:()=>undefined},authorizeRun:()=>true,verifyCleanup:async()=>{throw Error('not executed');}},
    engine:{reservation:(context:any)=>{reservations++;return{runId:context.request.runId,attemptId:context.request.attemptId,requestId:context.request.requestId,currency:'TEST',unit:'micro',upperUnits:10,source:'fixture-authority',observedAtMs:now,scope:'verified-completion-attempt-total'};},verifyBudgetMapping:()=>true,authorizeExecution:()=>true,receipts:()=>({execution:null,billing:null})}
  };
  const result=createNativeImplementationHost(options);
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
    core.approve(prepared.runId);
    expect(db.prepare('SELECT relative_path,max_backup_bytes FROM change_target_contract WHERE run_id=?').all(prepared.runId)).toEqual([{relative_path:'target.txt',max_backup_bytes:1024}]);
    expect(db.prepare('SELECT COUNT(*) n FROM approval_event WHERE run_id=?').get(prepared.runId)).toEqual({n:1});
    core.execute(prepared.runId); await expect.poll(()=>core.completion(prepared.taskId).state).toBe('blocked'); expect(launches).toBe(0);
  } finally { await core.close(); rmSync(root,{recursive:true,force:true}); }
});
