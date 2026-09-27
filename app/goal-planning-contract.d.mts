import type {GoalProposal} from './goal-proposal.mjs';
export interface PlanningInputAuthority {
  goal:string; selectionMode:'efficiency'|'performance'|'value'|'speed';
  executionPolicy:{policyRevision:string;policyDigest:string;mode:string};
  allowedCandidateIds:readonly string[];allowedScopeIds:readonly string[];
  checkerRegistry:readonly Readonly<{checkerId:string;revision:string;kinds:readonly ('code'|'research'|'document'|'external')[];parametersDigest:string;targetIds:readonly string[]}>[];
  targetLimits:{maxBytes:number;maxChangeTargets:number};
}
export function capturePlanningInput(input:PlanningInputAuthority):string;
export function checkGoalPlanningProposal(input:{goal:string;inputText:string;outputBytes:Buffer}):Readonly<{status:'pass'|'fail'|'unknown';reason:string;proposalRef?:string;proposalDigest?:string}>;
