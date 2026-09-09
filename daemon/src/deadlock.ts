export type DeadlockChoice = 'continue' | 'expand' | 'stop';
export interface DeadlockState { status: 'running' | '막힘 — 봉투 밖'; digestCounts: Record<string,number>; suppressed: string[]; choices: readonly ['이 상태로 계속','범위 넓히기','중단']; defaultChoice: DeadlockChoice }

export function initialDeadlockState(): DeadlockState { return {status:'running',digestCounts:{},suppressed:[],choices:['이 상태로 계속','범위 넓히기','중단'],defaultChoice:'continue'}; }
export function noteOutsideRequest(state: DeadlockState, digest: string, stalledAfterApproval = false): DeadlockState {
  if (state.suppressed.includes(digest)) return state;
  const count=(state.digestCounts[digest] ?? 0)+1;
  return {...state,digestCounts:{...state.digestCounts,[digest]:count},status:count>=2||stalledAfterApproval?'막힘 — 봉투 밖':'running'};
}
export function chooseDeadlock(state: DeadlockState, choice: DeadlockChoice, digest: string): DeadlockState {
  if(choice==='continue') return {...state,status:'running',suppressed:[...new Set([...state.suppressed,digest])]};
  return {...state,status:choice==='stop'?'막힘 — 봉투 밖':'running'};
}
