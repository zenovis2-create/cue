import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import { readAcceptedGoalPlanningOutput } from '../../app/accepted-goal-planning-output.mjs';
import { createGoalPlanningHost } from '../../app/goal-planning-host.mjs';
import { createNativeImplementationHost } from '../../app/native-implementation-host.mjs';
import { createDeploymentStagingOrchestrationFactory } from '../../app/deployment-staging-host.mjs';
import { makeAcceptedPlanningFixture } from './fixtures/goal-planning-host.js';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { WRITE_PROBES, MODEL_PROBES } from '../src/capability-admission.js';

const hash = (text:string|Buffer) => createHash('sha256').update(text).digest('hex');

test('planning is unavailable without a qualified host and cannot consume an unaccepted run', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-planning-core-'));
  const workspace = join(root, 'workspace'); mkdirSync(workspace);
  const config = initializeConfig(join(root, 'data'), { worktreeRoot: workspace });
  const daemon = new AppDaemon(config), core = createCueCore(config, daemon);
  try {
    expect(core.planningAvailability().available).toBe(false);
    expect(() => core.preparePlanningGoal({ goal: 'Change the requested file', autonomy: 3, selectionMode: 'efficiency' })).toThrow('planning_host_unavailable');
    expect(() => core.prepareGoalFromPlanningRun({ planningRunId: 'absent', autonomy: 3, selectionMode: 'efficiency' })).toThrow('planning_host_unavailable');
    expect(() => readAcceptedGoalPlanningOutput(daemon.db, 'absent')).toThrow('planning_output_unavailable');
    expect(daemon.db.prepare('SELECT COUNT(*) n FROM run').get()).toEqual({ n: 0 });
  } finally {
    await core.close();
    rmSync(root, { recursive: true, force: true });
  }
});

for(const scenario of ['valid','foreign-source','unknown-cleanup'] as const) test(`Core planning handoff: ${scenario}`, async () => {
  const root=mkdtempSync(join(tmpdir(),'cue-planning-lifecycle-')),workspace=join(root,'work');mkdirSync(workspace);
  writeFileSync(join(workspace,'target.txt'),'before');
  execFileSync('git',['init'],{cwd:workspace,stdio:'ignore'});execFileSync('git',['add','target.txt'],{cwd:workspace,stdio:'ignore'});
  execFileSync('git',['-c','user.name=Cue Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture'],{cwd:workspace,stdio:'ignore'});
  const config=initializeConfig(join(root,'data'),{worktreeRoot:workspace}),daemon=new AppDaemon(config),db=daemon.db,now=Date.now();
  const ids=['codex-current','independent-verifier'];
  const subject=Object.fromEntries(SUBJECT_FIELDS.map(key=>[key,key.endsWith('Sha256')?'a'.repeat(64):key])) as MeasurementSubject;
  const evidence=new Map<string,Buffer>(),refs:Record<string,{id:string;sha256:string}>={};
  for(const probe of [...WRITE_PROBES,...MODEL_PROBES]){const bytes=Buffer.from(JSON.stringify({probe,subjectDigest:subjectDigest(subject),measuredAt:new Date(now-1).toISOString(),kind:'live',status:'pass'}));evidence.set(probe,bytes);refs[probe]={id:probe,sha256:hash(bytes)};}
  const record=(id:string)=>({canonicalId:id,toolId:id,kind:'agent' as const,aliases:[],installation:'installed' as const,protocol:'verified' as const,authReference:`account-${id}`,authAvailable:true,sourceVersion:'fixture',observedAt:new Date(now).toISOString(),subjectDigest:subjectDigest(subject),binding:null});
  const policies:any={};for(const mode of ['efficiency','performance','value','speed'] as const){const saved=saveSelectionPolicy(db,{policyId:`proposal-${mode}`,expectedRevision:null,createdAt:new Date(now).toISOString(),sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode,qualityMinimum:0.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:10000,allowedCandidateIds:ids,pinnedCandidateId:null}});policies[mode]={policyId:saved.policyId,revision:saved.revision,digest:saved.digest};}
  const checker={id:'fixture-checker',revision:'v1',kinds:['code'],evidencePolicies:[{requirementId:'implementation-correct',kind:'code',producerTaskIds:['implement'],sourceRevision:'fixture-workspace-v1',targetIds:['target'],checkerId:'fixture-checker',checkerRevision:'v1',parametersDigest:'b'.repeat(64),hostileCheckIds:[],requiredSectionIds:[],claimIds:[],requiresRender:false}]};
  const observed=(id:string)=>({id,checks:{eligible:true,authenticated:true,compatible:true,dataAllowed:true,resourceAvailable:true,quotaAvailable:true},estimate:{scope:'verified-completion-total',quality:1,expectedCost:1,conservativeMaxCost:1,expectedTimeMs:1,conservativeMaxTimeMs:1,currency:'TEST',source:'fixture',observedAtMs:now}});
  let launches=0;let swapAtResolve=false;let sourceOriginal:any,foreignSourceContent:string|undefined,seenInstruction:any;
  const options:any={db,now:()=>now,workflow:{requirementId:'implementation-correct',requirementText:'Implement and verify the approved file.',checkerId:'fixture-checker',checkerRevision:'v1',parametersDigest:'b'.repeat(64),targets:[{targetId:'target',relativePath:'target.txt',maxBackupBytes:1024}],launchTimeoutMs:30000,taskTimeoutMs:90000,pollMs:25},policies,
    accounting:{currency:'TEST',unit:'micro',limitUnits:100,unitsPerCost:1,source:'fixture-authority',observedAtMs:now,upperUnitsByRole:{implementation:10,verifier:10}},
    implementation:{record:record(ids[0]),currentSubject:()=>subject,evidenceReferences:()=>refs,observeCandidate:()=>observed(ids[0]),executor:{db,binary:'C:/Program Files/OpenAI/Codex/codex.exe',model:'gpt-5',tool:{id:'codex',revision:'fixture'},availability:'ready',resolveBinding:()=>{launches++;throw Error('provider launch forbidden');}}},
    verifier:{record:record(ids[1]),currentSubject:()=>subject,evidenceReferences:()=>refs,observeCandidate:()=>observed(ids[1]),candidate:{kind:'agent',supportedRoles:['model'],cancellation:'supported',usage:'supported',availability:'ready',typedActivitySource:'host-codex-controller-v1',durableExecutionRef:'session-handle-v1',buildCurrentSubject:()=>subject,evidenceReferences:()=>refs,launch:async()=>{launches++;throw Error('provider launch forbidden');}}},
    requirementCheckers:[checker],resolveRequirementChecker:(id:string,revision:string)=>id===checker.id&&revision===checker.revision?checker:undefined,
    acceptance:{now:()=>now,timeoutMs:1000,maxObservationAgeMs:1000,resolveChecker:()=>undefined,principalForAttempt:()=>null,captureManifest:async()=>{throw Error('not executed')},isManifestCurrent:()=>false},
    authorizePublication:()=>true,verifyFinalBilling:()=>false,authority:{authorizePlan:()=>true,authorizeClaim:()=>true,authorizeStage:()=>true,verifyReceipt:()=>({outcomeVerified:false,cleanupVerified:false})},
    runtime:{evidence:{now:()=>now,maxAgeMs:1000,resolveEvidence:(ref:any)=>evidence.get(ref.id)},authorizeRun:()=>true,verifyCleanup:async()=>{throw Error('not executed')}},
    engine:{reservation:(context:any)=>({runId:context.request.runId,attemptId:context.request.attemptId,requestId:context.request.requestId,currency:'TEST',unit:'micro',upperUnits:10,source:'fixture-authority',observedAtMs:now,scope:'verified-completion-attempt-total'}),verifyBudgetMapping:()=>true,authorizeExecution:()=>true,receipts:()=>({execution:null,billing:null})}};
  const native=createNativeImplementationHost(options) as any;expect(native.available).not.toBe(false);
  const wrapped={...native,supportsGoalProposals:true,prepare(run:any){const {requirementCheckers,...rest}=native.prepare.call(this,run);return rest;},runtime:{...native.runtime,resolveCandidate(...args:any[]){if(swapAtResolve&&sourceOriginal){db.prepare('UPDATE artifact SET content=? WHERE id=?').run(foreignSourceContent,sourceOriginal.id);swapAtResolve=false;}const candidate=native.runtime.resolveCandidate(...args);return candidate&&{...candidate,launch:async(context:any)=>{seenInstruction=context.goalTaskInstruction;launches++;throw Error('provider launch forbidden');}};}}};
  const storageRoot=join(root,'staging');mkdirSync(storageRoot);
  const executionFactory=await createDeploymentStagingOrchestrationFactory({configuration:JSON.stringify({version:'cue-git-staging-deployment-v1',enabled:true,storageRoot}),createOrchestrationFactory:()=>()=>wrapped as any});
  const goal='Improve the parser safely';const policy=policies.efficiency;
  const body=(text:string)=>({version:'cue-goal-proposal-v1',goalSha256:hash(text),plan:{policyRevision:`${policy.policyId}:${policy.revision}`,policyDigest:policy.digest,tasks:[{id:'implement',role:'implementation',ownerId:'codex-implementation',requirementIds:['implementation-correct'],dependencyIds:[],candidateIds:[ids[0]],scopeIds:['approved-existing-files']},{id:'verify',role:'verifier',ownerId:'independent-verifier',requirementIds:['implementation-correct'],dependencyIds:['implement'],candidateIds:[ids[1]],scopeIds:[]}]},requirements:[{id:'implementation-correct',text:'Implement and verify the approved file.',kind:'code',required:true,checks:[{checkerId:'fixture-checker',revision:'v1',parametersDigest:'b'.repeat(64),targetIds:['target']}]}],instructions:[{taskId:'implement',text:`Implement ${text}`},{taskId:'verify',text:`Independently verify ${text}`}],changeTargets:[{taskId:'implement',targetId:'target',relativePath:'target.txt',maxBackupBytes:1024}]});
  const planningFixture=makeAcceptedPlanningFixture({db,root,goal,seedRun:false,executionContract:{executionPolicies:Object.fromEntries(['efficiency','performance','value','speed'].map(mode=>[mode,{policyRevision:`${policies[mode].policyId}:${policies[mode].revision}`,policyDigest:policies[mode].digest}])),approvedExecution:{allowedCandidateIds:ids,allowedScopeIds:['approved-existing-files'],checkerRegistry:[{checkerId:'fixture-checker',revision:'v1',kinds:['code'],parametersDigest:'b'.repeat(64),targetIds:['target']}],maxChangeTargets:1}},proposalBody:body});
  const core=createCueCore(config,daemon,{orchestrationFactory:executionFactory,planningOrchestrationFactory:()=>createGoalPlanningHost(planningFixture.options)});
  try{
    expect(core.planningAvailability().available).toBe(true);
    const planning=core.preparePlanningGoal({goal,autonomy:3,selectionMode:'efficiency'});expect(planning.phase).toBe('planning');
    if(scenario==='unknown-cleanup')planningFixture.controls.badCleanup=true;
    core.approve(planning.runId);core.execute(planning.runId);
    if(scenario==='unknown-cleanup'){
      for(let i=0;i<60&&planningFixture.controls.launches.length===0;i++)await new Promise(resolve=>setTimeout(resolve,50));
      expect(planningFixture.controls.launches).toEqual(['model']);
      const cleanupRows=()=>db.prepare('SELECT payload FROM cleanup_observation WHERE run_id IN (SELECT attempt_id FROM orchestration_attempt WHERE run_id=?)').all(planning.runId) as {payload:Buffer}[];
      for(let i=0;i<220&&cleanupRows().length===0;i++)await new Promise(resolve=>setTimeout(resolve,50));
      expect(cleanupRows().length).toBeGreaterThan(0);
      expect(JSON.parse(cleanupRows()[0].payload.toString())).toMatchObject({result:'unknown',reason:'identity-or-observation-unavailable'});
      expect((db.prepare("SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id=? AND task_id='verify-plan'").get(planning.runId) as any).n).toBe(0);
      expect(()=>readAcceptedGoalPlanningOutput(db,planning.runId)).toThrow();
      const before=(db.prepare('SELECT COUNT(*) n FROM run').get() as any).n;
      expect(()=>core.prepareGoalFromPlanningRun({planningRunId:planning.runId,autonomy:3,selectionMode:'efficiency'})).toThrow();
      expect((db.prepare('SELECT COUNT(*) n FROM run').get() as any).n).toBe(before);
      expect(launches).toBe(0);
      return;
    }
    for(let i=0;i<100&&!core.completion(planning.taskId).planning?.readyForExecution;i++)await new Promise(resolve=>setTimeout(resolve,50));
    const card=core.completion(planning.taskId);expect(card.planning?.readyForExecution,JSON.stringify(card)).toBe(true);
    const accepted=readAcceptedGoalPlanningOutput(db,planning.runId);expect(accepted.source.producerAttemptId).not.toBe(accepted.source.verifierAttemptId);
    expect(planningFixture.controls.launches).toEqual(['model','checker']);
    const outputRow=db.prepare("SELECT observation_id FROM generated_output_observation WHERE run_id=? AND target_id='goal-proposal'").get(planning.runId) as any;
    expect(()=>db.prepare('UPDATE generated_output_observation SET bytes=? WHERE observation_id=?').run(Buffer.from('{}'),outputRow.observation_id)).toThrow('immutable_generated_observation');
    const execution=core.prepareGoalFromPlanningRun({planningRunId:planning.runId,autonomy:3,selectionMode:'efficiency'});
    expect(execution.phase).toBe('execution');expect(execution.sourcePlanningRunId).toBe(planning.runId);
    expect(execution.orchestration?.goalProposal?.ref).toBe(accepted.ref);
    expect(execution.threeLines.join('\n')).toContain(planning.runId);
    sourceOriginal=db.prepare("SELECT id,content FROM artifact WHERE run_id=? AND kind='planning_source_v1'").get(execution.runId) as any;
    db.prepare('DELETE FROM artifact WHERE id=?').run(sourceOriginal.id);
    expect(()=>core.approve(execution.runId)).toThrow('planning_source_mismatch');expect(db.prepare('SELECT COUNT(*) n FROM approval_event WHERE run_id=?').get(execution.runId)).toEqual({n:0});
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(execution.taskId,execution.runId,'planning_source_v1',sourceOriginal.content,new Date().toISOString());
    sourceOriginal=db.prepare("SELECT id,content FROM artifact WHERE run_id=? AND kind='planning_source_v1'").get(execution.runId) as any;
    if(scenario==='foreign-source'){
      const other=core.preparePlanningGoal({goal,autonomy:3,selectionMode:'efficiency'});
      core.approve(other.runId);core.execute(other.runId);
      for(let i=0;i<100&&!core.completion(other.taskId).planning?.readyForExecution;i++)await new Promise(resolve=>setTimeout(resolve,50));
      expect(core.completion(other.taskId).planning?.readyForExecution).toBe(true);
      const otherAccepted=readAcceptedGoalPlanningOutput(db,other.runId);expect(otherAccepted.ref).toBe(accepted.ref);
      expect(otherAccepted.source.producerAttemptId).not.toBe(accepted.source.producerAttemptId);
      foreignSourceContent=JSON.stringify({planningRunId:other.runId,proposalRef:otherAccepted.ref,source:otherAccepted.source});
      db.prepare('UPDATE artifact SET content=? WHERE id=?').run(foreignSourceContent,sourceOriginal.id);
      expect(()=>core.approve(execution.runId)).toThrow('planning_source_mismatch');
      db.prepare('UPDATE artifact SET content=? WHERE id=?').run(sourceOriginal.content,sourceOriginal.id);
    }
    core.approve(execution.runId);swapAtResolve=scenario==='foreign-source';core.execute(execution.runId);
    for(let i=0;i<40&&(scenario==='foreign-source'?swapAtResolve:launches===0);i++)await new Promise(resolve=>setTimeout(resolve,50));
    if(scenario==='foreign-source'){expect(swapAtResolve).toBe(false);expect(launches).toBe(0);}
    else {expect(launches,JSON.stringify({completion:core.completion(execution.taskId),attempts:db.prepare('SELECT run_id,attempt_id,task_id,state,cleanup_verified FROM orchestration_attempt').all(),failures:db.prepare('SELECT * FROM orchestration_failure_observation').all()})).toBe(1);
      expect(seenInstruction).toMatchObject({proposalRef:accepted.ref,taskId:'implement',text:`Implement ${goal}`});}
  }finally{
    try{await core.close();}catch{db.close();}
    rmSync(root,{recursive:true,force:true});
  }
});
