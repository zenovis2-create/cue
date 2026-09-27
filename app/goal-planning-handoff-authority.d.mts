import type { Ledger } from '../daemon/src/ledger.js';
export interface GoalPlanningHandoffAuthority {
  authorizeHandoffArtifact(sourceRef:string,attemptId:string):boolean;
  resolveHandoffArtifact(sourceRef:string,attemptId:string):Uint8Array|null;
}
export function createGoalPlanningHandoffAuthority(input:{db:Ledger}):Readonly<GoalPlanningHandoffAuthority>;
