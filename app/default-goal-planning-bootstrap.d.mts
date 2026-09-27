import type {Ledger} from '../daemon/src/ledger.js';
import type {ModelMeasurementInput,createModelMeasurementSubject} from '../daemon/src/model-measurement-subject.js';
import type {LocalOrchestrationHost} from './orchestration-driver.mjs';
import type {GoalPlanningHost} from './goal-planning-host.mjs';
import type {PlanningInputAuthority} from './goal-planning-contract.mjs';
export const DEFAULT_GOAL_PLANNING_SETTINGS_ID:'goal-planning-default';
export interface GoalPlanningBootstrapContext {readonly db:Ledger;readonly config:unknown;readonly worktree:string}
export interface GoalPlanningInstallation {
  readonly measurement:Omit<ModelMeasurementInput,'kind'>;readonly controlRoot:string;readonly taskRootBase:string;readonly profileRootBase:string;
  readonly loadedHost:Readonly<{executable:string;runtime:'node'|'electron';version:string}>;
}
export interface GoalPlanningBootstrapAuthority {
  now():number;readonly maxEvidenceAgeMs:number;
  discoverInstallation(context:Readonly<GoalPlanningBootstrapContext>):GoalPlanningInstallation|null;
  validateLoadedInstallation(value:Readonly<{hostExecutable:string;hostRuntime:'node'|'electron';hostVersion:string;installation:GoalPlanningInstallation;model:ReturnType<typeof createModelMeasurementSubject>;checker:ReturnType<typeof createModelMeasurementSubject>}>):boolean;
  observeReadiness(kind:'model'|'checker',context:Readonly<{db:Ledger;subjectDigest:string}>):Readonly<{authenticated:boolean;dataAllowed:boolean;resourceAvailable:boolean;quotaAvailable:boolean}>;
  readExecutionContract(context:Readonly<GoalPlanningBootstrapContext>):Readonly<{executionPolicies:Record<'efficiency'|'performance'|'value'|'speed',Omit<PlanningInputAuthority['executionPolicy'],'mode'>>;approvedExecution:Pick<PlanningInputAuthority,'allowedCandidateIds'|'allowedScopeIds'|'checkerRegistry'> & {maxChangeTargets:number}}>;
}
export function createDefaultGoalPlanningBootstrap(authority?:Partial<GoalPlanningBootstrapAuthority>):
  (context:GoalPlanningBootstrapContext)=>GoalPlanningHost & LocalOrchestrationHost|Readonly<{available:false;reasons:readonly string[]}>;
