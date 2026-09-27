import { openLedger, type Ledger } from '../../src/ledger.js';
import { createBudgetManager } from '../../src/budget.js';
import { bindRunSelectionPolicy, saveSelectionPolicy } from '../../src/selection/policy-store.js';
import { createOrchestrationEngine, selectionRevisionRef, type EngineRequest } from '../../src/orchestration/engine.js';
import type { EngineHost } from '../../src/orchestration/engine.js';
import type { SelectionCandidate } from '../../src/selection/policy.js';
import { createOrchestrationStore } from '../../src/orchestration/store.js';
import { validateTaskPlan } from '../../src/orchestration/plan.js';

export const initialSelectionRequest: EngineRequest = { runId:'run',taskId:'make',attemptId:'attempt-1',requestId:'request-1',observedAtMs:1000,timeoutMs:1000 };

/** Minimal copy of the proven integration-engine fixture's complete plan shape. */
export function createInitialSelectionLedgerFixture(options:{candidateIds?:string[];pinnedCandidateId?:string|null;costLimit?:number|null;remainingTimeMs?:number|null}={}): {
  db: Ledger; engine: ReturnType<typeof createOrchestrationEngine>; plan: ReturnType<typeof validateTaskPlan>;
  budget: ReturnType<typeof createBudgetManager>; policy: ReturnType<typeof saveSelectionPolicy>; host:EngineHost; truth: { launches:number; preparations:number; observations:number; initialObservations:number; authorizations:number; reservations:number; failPreparation:boolean; eligible:boolean;candidates:SelectionCandidate[];initialObservation:unknown|null };
} {
  const db=openLedger(), envelope='e'.repeat(64);
  db.prepare("INSERT INTO task VALUES('task-run','running',NULL,'now')").run();
  db.prepare("INSERT INTO envelope VALUES(?,'C:/fixture','[]','now')").run(envelope);
  db.prepare("INSERT INTO run VALUES('run','task-run',?,0,'now')").run(envelope);
  const candidateIds=options.candidateIds??['agent'];
  const policy=saveSelectionPolicy(db,{policyId:'policy',expectedRevision:null,createdAt:'2026-09-14T00:00:00.000Z',sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode:'efficiency',qualityMinimum:.5,costBasis:1,timeBasisMs:1000,currency:'TEST',costLimit:options.costLimit??null,remainingTimeMs:options.remainingTimeMs??null,maxEstimateAgeMs:100,allowedCandidateIds:candidateIds,pinnedCandidateId:options.pinnedCandidateId??null}});
  bindRunSelectionPolicy(db,{runId:'run',policyId:'policy',revision:1,digest:policy.digest,boundAt:'2026-09-14T00:00:00.000Z'});
  const approval={policyRevision:selectionRevisionRef(policy),policyDigest:policy.digest,requirementIds:['req'],allowedCandidateIds:candidateIds,allowedScopeIds:['workspace']};
  const plan=validateTaskPlan(approval,{revision:'plan-1',policyRevision:approval.policyRevision,policyDigest:approval.policyDigest,tasks:[
    {id:'make',role:'implementation' as const,ownerId:'maker',requirementIds:['req'],dependencyIds:[],candidateIds,scopeIds:['workspace']},
    {id:'check',role:'verifier' as const,ownerId:'checker',requirementIds:['req'],dependencyIds:['make'],candidateIds:['agent'],scopeIds:[]},
  ]});
  const defaultCandidate:SelectionCandidate={id:'agent',checks:{eligible:true,authenticated:true,compatible:true,dataAllowed:true,resourceAvailable:true,quotaAvailable:true},estimate:{scope:'verified-completion-total',quality:1,expectedCost:1,conservativeMaxCost:1,expectedTimeMs:1,conservativeMaxTimeMs:1,currency:'TEST',source:'fixture',observedAtMs:1000}};
  const truth={launches:0,preparations:0,observations:0,initialObservations:0,authorizations:0,reservations:0,failPreparation:false,eligible:true,candidates:[defaultCandidate],initialObservation:null as unknown|null};
  const store=createOrchestrationStore(db,{authorizePlan:()=>true,authorizeClaim:()=>true,verifyReceipt:()=>({outcomeVerified:false,cleanupVerified:false}),resolveHandoffArtifact:()=>null,authorizeHandoffArtifact:()=>false});
  const budget=createBudgetManager(db,{verifyFinalReceipt:()=>false});
  budget.initialize({runId:'run',currency:'TEST',unit:'micro',limitUnits:100,policyRevision:approval.policyRevision,source:'fixture',observedAtMs:1000});
  const runtime={start:async()=>{truth.launches++;return {ok:true,reason:null,handle:null}}} as any;
  const host:EngineHost={
    now:()=>1000,
    observeCandidates:()=>{truth.observations++;return truth.candidates.map(candidate=>candidate.id==='agent'?{...candidate,checks:{...candidate.checks,eligible:truth.eligible}}:candidate)},
    observeInitialSelection:()=>{truth.initialObservations++;return truth.initialObservation as any},
    reservation:context=>{truth.reservations++;return {runId:context.request.runId,requestId:context.request.requestId,attemptId:context.request.attemptId,currency:'TEST',unit:'micro',upperUnits:40,source:'fixture-total',observedAtMs:1000,scope:'verified-completion-attempt-total'}},
    verifyBudgetMapping:()=>true,authorizeExecution:()=>{truth.authorizations++;return true},
    prepareExecution:()=>{truth.preparations++;db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES('task-run','run','initial-selection-baseline','prepared','now')").run();if(truth.failPreparation)throw Error('fixture_prepare_failure');},
    receipts:()=>({execution:null,billing:null}),
  };
  const engine=createOrchestrationEngine(db,{store,budget,runtime},host);
  return {db,engine,plan,budget,policy,host,truth};
}
