import type { Ledger } from '../daemon/src/ledger.js';
import type { ProposedPlan } from '../daemon/src/orchestration/plan.js';
import type { RequirementContract } from '../daemon/src/verification/requirements.js';
export interface GoalProposal {
  readonly version:'cue-goal-proposal-v1';readonly goalSha256:string;
  readonly plan:Readonly<Omit<ProposedPlan,'revision'>>;
  readonly requirements:readonly RequirementContract[];
  readonly instructions:readonly Readonly<{taskId:string;text:string}>[];
  readonly changeTargets:readonly Readonly<{taskId:string;targetId:string;relativePath:string;maxBackupBytes:number}>[];
}
export interface CapturedGoalProposal {
  readonly ref:string;readonly digest:string;readonly bytes:string;readonly body:GoalProposal;
  readonly proposedPlan:ProposedPlan;readonly requirements:readonly RequirementContract[];
  readonly requirementIds:readonly string[];readonly instructions:readonly Readonly<{taskId:string;text:string}>[];
  readonly changeTargets:GoalProposal['changeTargets'];
}
export function captureGoalProposal(goal:string,ref:string,input:GoalProposal):CapturedGoalProposal;
export function bindGoalProposal(db:Ledger,input:{runId:string;taskId:string;captured:CapturedGoalProposal;now:number}):void;
export function readBoundGoalProposal(db:Ledger,runId:string,expectedPlanDigest:string):CapturedGoalProposal;
export function readGoalTaskInstruction(db:Ledger,runId:string,planDigest:string,taskId:string):Readonly<{runId:string;planDigest:string;taskId:string;proposalRef:string;text:string}>;
