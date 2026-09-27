import type {Ledger} from '../daemon/src/ledger.js';
import type {OrchestrationHost,OrchestrationRun,LocalOrchestrationHost} from './orchestration-driver.mjs';
import type {CatalogRecord} from '../daemon/src/integration-catalog.js';
import type {HostEvidencePolicy} from '../daemon/src/capability-admission.js';
import type {MeasurementSubject} from '../daemon/src/measurement-subject.js';
import type {SelectionCandidate} from '../daemon/src/selection/policy.js';
import type {LocalCandidateChecks} from '../daemon/src/selection/local-policy-store.js';
import type {ModelControlBundle} from '../daemon/src/model-control-bundle.js';
import type {createIsolatedLocalModelExecutor} from '../daemon/src/adapters/isolated-local-model.js';
import type {createIsolatedGoalProposalCheckerExecutor} from '../daemon/src/adapters/isolated-goal-proposal-checker.js';
import type {PlanningInputAuthority} from './goal-planning-contract.mjs';

export interface GoalPlanningHost extends OrchestrationHost {
  readonly parentTemplate:'goal-planning-v1';readonly planningEgress:readonly string[];
  capturePlanningInput(input:{goal:string;selectionMode?:'efficiency'|'performance'|'value'|'speed'}):string;
}
export interface GoalPlanningHostOptions {
  db:Ledger;now():number;
  installation:{nodeExecutable:string;nodeSha256:string;modelControlBundle:ModelControlBundle;checkerControlBundle:ModelControlBundle;taskRootBase:string;profileRootBase:string};
  candidates:Record<'model'|'checker',{record:CatalogRecord;currentSubject():MeasurementSubject;evidenceReferences():unknown;observeCandidate():SelectionCandidate}>;
  evidence:HostEvidencePolicy;
  policies:Record<'efficiency'|'performance'|'value'|'speed',{policyId:string;revision:number;digest:string}|{deploymentChannelId:string}>;
  executionPolicies:Record<'efficiency'|'performance'|'value'|'speed',Omit<PlanningInputAuthority['executionPolicy'],'mode'>>;
  approvedExecution:Pick<PlanningInputAuthority,'allowedCandidateIds'|'allowedScopeIds'|'checkerRegistry'> & {maxChangeTargets:number};
  accounting:{kind?:'monetary';currency:string;unit:'minor'|'micro';limitUnits:number;unitsPerCost:number;source:string;observedAtMs:number;upperUnitsByKind:Record<'model'|'checker',number>};
  maxOutputBytes?:number;maxOutputTokens?:number;
  executorFactories?:{model?:typeof createIsolatedLocalModelExecutor;checker?:typeof createIsolatedGoalProposalCheckerExecutor};
}
export interface LocalGoalPlanningHostOptions extends Omit<GoalPlanningHostOptions,'accounting'|'candidates'> {
  accounting:{kind:'local-invocation';source:string;observedAtMs:number};
  candidates:Record<'model'|'checker',{record:CatalogRecord;currentSubject():MeasurementSubject;evidenceReferences():unknown;observeCandidate():LocalCandidateChecks}>;
}
export function createGoalPlanningHost(options:GoalPlanningHostOptions):Readonly<{available:true;host:GoalPlanningHost}|{available:false;reasons:readonly string[]}>;
export function createGoalPlanningHost(options:LocalGoalPlanningHostOptions):Readonly<{available:true;host:GoalPlanningHost & LocalOrchestrationHost}|{available:false;reasons:readonly string[]}>;
