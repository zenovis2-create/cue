import type { Ledger } from '../daemon/src/ledger.js';
import type { GoalProposal } from './goal-proposal.mjs';
import type { SelectionMode } from '../daemon/src/selection/preferences.js';

export interface AcceptedGoalPlanningOutput {
  readonly goal:string;readonly mode:SelectionMode;readonly ref:string;readonly body:GoalProposal;
  readonly source:Readonly<{planningRunId:string;producerAttemptId:string;verifierAttemptId:string;
    outputDigest:string;acceptanceEvaluationId:string;acceptanceManifestDigest:string}>;
}
export function readAcceptedGoalPlanningOutput(db:Ledger,planningRunId:string):AcceptedGoalPlanningOutput;
