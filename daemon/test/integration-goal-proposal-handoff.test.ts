import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import { createNativeImplementationHost } from '../../app/native-implementation-host.mjs';
import { createDeploymentStagingOrchestrationFactory } from '../../app/deployment-staging-host.mjs';
import { captureGoalProposal } from '../../app/goal-proposal.mjs';
import type { GoalProposal } from '../../app/goal-proposal.mjs';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { WRITE_PROBES, MODEL_PROBES } from '../src/capability-admission.js';

const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;

test('goal proposals are goal-bound and reject duplicate, missing, and accessor instructions',()=>{
  const make=(goal:string)=>({version:'cue-goal-proposal-v1',goalSha256:hash(goal),plan:{policyRevision:'policy:1',policyDigest:'a'.repeat(64),tasks:[
    {id:'make',role:'implementation',ownerId:'maker',requirementIds:['req'],dependencyIds:[],candidateIds:['agent'],scopeIds:['work']},
    {id:'check',role:'verifier',ownerId:'checker',requirementIds:['req'],dependencyIds:['make'],candidateIds:['reviewer'],scopeIds:[]}]},
    requirements:[{id:'req',text:'Check source',kind:'code',required:true,checks:[{checkerId:'tests',revision:'v1',parametersDigest:'b'.repeat(64),targetIds:['workspace']}]}],
    instructions:[{taskId:'make',text:`Implement ${goal}`},{taskId:'check',text:`Verify ${goal}`}],changeTargets:[]});
  const capture=(goal:string,body:any)=>{const digest=hash(JSON.stringify(canonical(body)));return captureGoalProposal(goal,`goal-proposal:${digest}`,body)};
  expect(capture('first',make('first')).digest).not.toBe(capture('second',make('second')).digest);
  expect(()=>capture('first',make('second'))).toThrow('goal_proposal_goal_mismatch');
  const duplicate=make('first');duplicate.instructions[1].taskId='make';expect(()=>capture('first',duplicate)).toThrow('goal_proposal_instruction_coverage');
  const missing=make('first');missing.instructions.pop();expect(()=>capture('first',missing)).toThrow('goal_proposal_bounds');
  const accessor=make('first');let reads=0;Object.defineProperty(accessor.instructions[0],'text',{enumerable:true,get(){reads++;return 'bad'}});
  expect(()=>captureGoalProposal('first','goal-proposal:'+('0'.repeat(64)),accessor as any)).toThrow('goal_proposal_data');expect(reads).toBe(0);
});

test('Core consumes a pinned proposal in the driver and rejects mutated artifact before approval',async()=>{
  const root=mkdtempSync(join(tmpdir(),'cue-goal-proposal-')),workspace=join(root,'workspace');mkdirSync(workspace);writeFileSync(join(workspace,'target.txt'),'before');
  execFileSync('git',['init'],{cwd:workspace,stdio:'ignore'});execFileSync('git',['add','target.txt'],{cwd:workspace,stdio:'ignore'});
  execFileSync('git',['-c','user.name=Cue Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture'],{cwd:workspace,stdio:'ignore'});
  const config=initializeConfig(join(root,'data'),{worktreeRoot:workspace}),daemon=new AppDaemon(config),db=daemon.db,now=Date.now();
  const candidateIds=['codex-current','independent-verifier'];
  const subject=Object.fromEntries(SUBJECT_FIELDS.map(key=>[key,key.endsWith('Sha256')?'a'.repeat(64):key])) as MeasurementSubject;
  const evidence=new Map<string,Buffer>(),refs:Record<string,{id:string;sha256:string}>={};
  for(const probe of [...WRITE_PROBES,...MODEL_PROBES]){const bytes=Buffer.from(JSON.stringify({probe,subjectDigest:subjectDigest(subject),measuredAt:new Date(now-1).toISOString(),kind:'live',status:'pass'}));evidence.set(probe,bytes);refs[probe]={id:probe,sha256:hash(bytes.toString())};}
  const record=(id:string)=>({canonicalId:id,toolId:id,kind:'agent' as const,aliases:[],installation:'installed' as const,protocol:'verified' as const,authReference:`account-${id}`,authAvailable:true,sourceVersion:'fixture',observedAt:new Date(now).toISOString(),subjectDigest:subjectDigest(subject),binding:null});
  const policies:any={};for(const mode of ['efficiency','performance','value','speed'] as const){const saved=saveSelectionPolicy(db,{policyId:`proposal-${mode}`,expectedRevision:null,createdAt:new Date(now).toISOString(),sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode,qualityMinimum:0.5,costBasis:1,timeBasisMs:1,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:10000,allowedCandidateIds:candidateIds,pinnedCandidateId:null}});policies[mode]={policyId:saved.policyId,revision:saved.revision,digest:saved.digest};}
  const checker={id:'fixture-checker',revision:'v1',kinds:['code'],evidencePolicies:[{requirementId:'implementation-correct',kind:'code',producerTaskIds:['implement'],sourceRevision:'fixture-workspace-v1',targetIds:['target'],checkerId:'fixture-checker',checkerRevision:'v1',parametersDigest:'b'.repeat(64),hostileCheckIds:[],requiredSectionIds:[],claimIds:[],requiresRender:false}]};
  const observed=(id:string)=>({id,checks:{eligible:true,authenticated:true,compatible:true,dataAllowed:true,resourceAvailable:true,quotaAvailable:true},estimate:{scope:'verified-completion-total',quality:1,expectedCost:1,conservativeMaxCost:1,expectedTimeMs:1,conservativeMaxTimeMs:1,currency:'TEST',source:'fixture',observedAtMs:now}});
  let launches=0;const seen:any[]=[],trace:string[]=[];
  const options:any={db,now:()=>now,workflow:{requirementId:'implementation-correct',requirementText:'Implement and verify the approved file.',checkerId:'fixture-checker',checkerRevision:'v1',parametersDigest:'b'.repeat(64),targets:[{targetId:'target',relativePath:'target.txt',maxBackupBytes:1024}],launchTimeoutMs:30000,taskTimeoutMs:90000,pollMs:25},policies,
    accounting:{currency:'TEST',unit:'micro',limitUnits:100,unitsPerCost:1,source:'fixture-authority',observedAtMs:now,upperUnitsByRole:{implementation:10,verifier:10}},
    implementation:{record:record(candidateIds[0]),currentSubject:()=>subject,evidenceReferences:()=>refs,observeCandidate:()=>observed(candidateIds[0]),executor:{db,binary:'C:/Program Files/OpenAI/Codex/codex.exe',model:'gpt-5',tool:{id:'codex',revision:'fixture'},availability:'ready',resolveBinding:()=>{launches++;throw Error('provider launch forbidden');}}},
    verifier:{record:record(candidateIds[1]),currentSubject:()=>subject,evidenceReferences:()=>refs,observeCandidate:()=>observed(candidateIds[1]),candidate:{kind:'agent',supportedRoles:['model'],cancellation:'supported',usage:'supported',availability:'ready',typedActivitySource:'host-codex-controller-v1',durableExecutionRef:'session-handle-v1',buildCurrentSubject:()=>subject,evidenceReferences:()=>refs,launch:async()=>{launches++;throw Error('provider launch forbidden');}}},
    requirementCheckers:[checker],resolveRequirementChecker:(id:string,revision:string)=>id===checker.id&&revision===checker.revision?checker:undefined,
    acceptance:{now:()=>now,timeoutMs:1000,maxObservationAgeMs:1000,resolveChecker:()=>undefined,principalForAttempt:()=>null,captureManifest:async()=>{throw Error('not executed')},isManifestCurrent:()=>false},
    authorizePublication:()=>true,verifyFinalBilling:()=>false,authority:{authorizePlan:()=>true,authorizeClaim:()=>true,authorizeStage:()=>true,verifyReceipt:()=>({outcomeVerified:false,cleanupVerified:false})},
    runtime:{evidence:{now:()=>now,maxAgeMs:1000,resolveEvidence:(ref:any)=>evidence.get(ref.id)},authorizeRun:()=>true,verifyCleanup:async()=>{throw Error('not executed')}},
    engine:{reservation:(context:any)=>({runId:context.request.runId,attemptId:context.request.attemptId,requestId:context.request.requestId,currency:'TEST',unit:'micro',upperUnits:10,source:'fixture-authority',observedAtMs:now,scope:'verified-completion-attempt-total'}),verifyBudgetMapping:()=>true,authorizeExecution:()=>true,receipts:()=>({execution:null,billing:null})}};
  const native=createNativeImplementationHost(options) as any;expect(native.available).not.toBe(false);
  const storageRoot=join(root,'staging');mkdirSync(storageRoot);
  const wrapped={...native,supportsGoalProposals:true,prepare(run:any){const {requirementCheckers,...rest}=native.prepare.call(this,run);return rest;},finalPublication:{...native.finalPublication,openStagedAttempt:async(contract:any)=>{trace.push('open-staged');return{contractId:contract.contractId};}},engine:{...native.engine,observeCandidates(...args:any[]){trace.push('observe');return native.engine.observeCandidates(...args);}},stage(...args:any[]){trace.push('stage');return native.stage(...args);},runtime:{...native.runtime,resolveCandidate(...args:any[]){const candidate=native.runtime.resolveCandidate(...args);trace.push(`candidate:${Boolean(candidate)}:${candidate?.stagedPublication}:${candidate?.kind}`);return candidate&&{...candidate,launch:async(context:any)=>{trace.push('launch');seen.push(context.goalTaskInstruction);throw Error('offline launch observed');}}}}};
  const factory=await createDeploymentStagingOrchestrationFactory({configuration:JSON.stringify({version:'cue-git-staging-deployment-v1',enabled:true,storageRoot}),createOrchestrationFactory:()=>()=>wrapped as any});
  const proposalFor=(goal:string):GoalProposal=>{const policy=policies.efficiency,ref=`${policy.policyId}:${policy.revision}`;return {version:'cue-goal-proposal-v1',goalSha256:hash(goal),plan:{policyRevision:ref,policyDigest:policy.digest,tasks:[{id:'implement',role:'implementation',ownerId:'codex-implementation',requirementIds:['implementation-correct'],dependencyIds:[],candidateIds:[candidateIds[0]],scopeIds:['approved-existing-files']},{id:'verify',role:'verifier',ownerId:'independent-verifier',requirementIds:['implementation-correct'],dependencyIds:['implement'],candidateIds:[candidateIds[1]],scopeIds:[]}]},requirements:[{id:'implementation-correct',text:'Implement and verify the approved file.',kind:'code',required:true,checks:[{checkerId:'fixture-checker',revision:'v1',parametersDigest:'b'.repeat(64),targetIds:['target']}]}],instructions:[{taskId:'implement',text:`Implement ${goal}`},{taskId:'verify',text:`Independently verify ${goal}`}],changeTargets:[{taskId:'implement',targetId:'target',relativePath:'target.txt',maxBackupBytes:1024}]};};
  const proposals=new Map<string,any>();const add=(goal:string)=>{const body=proposalFor(goal),captured=captureGoalProposal(goal,`goal-proposal:${hash(JSON.stringify(canonical(body)))}`,body);proposals.set(captured.ref,body);return captured.ref;};
  const core=createCueCore(config,daemon,{orchestrationFactory:factory,resolveGoalProposal:(ref:string)=>proposals.get(ref)});
  try{
    const firstGoal='Change target for alpha',secondGoal='Change target for beta',firstRef=add(firstGoal),secondRef=add(secondGoal);expect(firstRef).not.toBe(secondRef);
    const unknownGoal='Change target with unknown checker',unknown:any=structuredClone(proposalFor(unknownGoal));
    unknown.requirements[0].checks[0].checkerId='unregistered-checker';
    const unknownRef=`goal-proposal:${hash(JSON.stringify(canonical(unknown)))}`;proposals.set(unknownRef,unknown);
    const runsBefore=(db.prepare('SELECT COUNT(*) n FROM run').get() as any).n;
    expect(()=>core.prepareGoalFromProposal({goal:unknownGoal,proposalRef:unknownRef,autonomy:3,selectionMode:'efficiency'})).toThrow();
    expect((db.prepare('SELECT COUNT(*) n FROM run').get() as any).n).toBe(runsBefore);expect(seen).toEqual([]);
    const first=core.prepareGoalFromProposal({goal:firstGoal,proposalRef:firstRef,autonomy:3,selectionMode:'efficiency'});
    expect(first.orchestration?.goalProposal?.ref).toBe(firstRef);expect(first.orchestration?.stages.map((x:any)=>x.id)).toEqual(['implement','verify']);
    expect(first.threeLines.join('\n')).toContain(firstRef);
    expect(()=>core.prepareGoalFromProposal({goal:firstGoal,proposalRef:secondRef,autonomy:3,selectionMode:'efficiency'})).toThrow('goal_proposal_goal_mismatch');
    const artifact=db.prepare("SELECT id,content FROM artifact WHERE run_id=? AND kind='goal_proposal_v1'").get(first.runId) as any;
    db.prepare('UPDATE artifact SET content=? WHERE id=?').run(artifact.content.replace('alpha','tampered'),artifact.id);
    expect(()=>core.approve(first.runId)).toThrow();expect(db.prepare('SELECT COUNT(*) n FROM approval_event WHERE run_id=?').get(first.runId)).toEqual({n:0});expect(seen).toEqual([]);
    db.prepare('UPDATE artifact SET content=? WHERE id=?').run(artifact.content,artifact.id);
    core.approve(first.runId);
    db.prepare('UPDATE artifact SET content=? WHERE id=?').run(artifact.content.replace('alpha','swapped'),artifact.id);
    expect(()=>core.execute(first.runId)).toThrow();expect(seen).toEqual([]);
    expect(db.prepare('SELECT approval_state FROM run_session_epoch WHERE run_id=?').get(first.runId)).toEqual({approval_state:'approved'});
    expect(db.prepare('SELECT COUNT(*) n FROM execution_event WHERE run_id=?').get(first.runId)).toEqual({n:0});
    expect(db.prepare('SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id=?').get(first.runId)).toEqual({n:0});
    db.prepare('UPDATE artifact SET content=? WHERE id=?').run(artifact.content,artifact.id);
    core.execute(first.runId);await new Promise(resolve=>setTimeout(resolve,1500));
    if(seen.length!==1)throw Error(JSON.stringify({trace,attempts:db.prepare('SELECT attempt_id,state FROM orchestration_attempt').all()}));
    expect(seen.some(item=>item?.proposalRef===firstRef&&item.taskId==='implement'&&item.text===`Implement ${firstGoal}`),JSON.stringify({seen,trace,completion:core.completion(first.taskId)})).toBe(true);expect(launches).toBe(0);
    // The synthetic launch stops before a provider exists. The durable attempt must remain unresolved.
    await expect(core.close()).rejects.toThrow('orchestration_cleanup_unverified');
    expect(db.prepare('SELECT state,cleanup_verified FROM orchestration_attempt').all()).toEqual([{state:'running',cleanup_verified:0}]);
  }finally{
    // Do not hide a primary assertion failure with a cleanup expectation.
    // This fixture never launches a provider; unresolved cleanup is asserted above.
    try { await core.close(); } catch { /* retained synthetic attempt */ }
    if(db.open)db.close();rmSync(root,{recursive:true,force:true});
  }
});
