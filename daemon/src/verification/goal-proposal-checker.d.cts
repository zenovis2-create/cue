export interface GoalProposalVerdict {
  readonly contract:'cue-goal-proposal-v1';readonly status:'pass'|'fail'|'unknown';readonly reason:string;
  readonly inputSha256:string|null;readonly outputSha256:string|null;readonly proposalDigest:string|null;
}
export function checkGoalProposal(inputBytes:Uint8Array,outputBytes:Uint8Array):Readonly<GoalProposalVerdict>;
export const CONTRACT:'cue-goal-proposal-v1';
export const MAX:1048576;
