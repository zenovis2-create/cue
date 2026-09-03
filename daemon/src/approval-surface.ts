export type AutonomyLevel = 1 | 2 | 3;
export interface ApprovalCopy {
  readonly what: string;
  readonly extent: string;
  readonly excluded: string;
  readonly envelopeSummary: string;
  readonly autonomy?: AutonomyLevel;
}

export function renderApproval(copy: ApprovalCopy): string {
  const level = copy.autonomy ?? 3;
  return [
    `무엇을: ${copy.what}`,
    `어디까지: ${copy.extent}`,
    `안 건드릴 것: ${copy.excluded}`,
    `봉투: ${copy.envelopeSummary} · 자율성 ③`.replace('③', ['','①','②','③'][level]),
  ].join('\n');
}

export interface InterviewCandidate { readonly question: string; readonly changesEnvelope: boolean }
export function interview(candidates: readonly InterviewCandidate[]): readonly string[] {
  return candidates.filter(candidate => candidate.changesEnvelope).slice(0, 3).map(candidate => candidate.question);
}

export function narrowUncertainty(copy: ApprovalCopy, uncertainArea: string): ApprovalCopy {
  return Object.freeze({...copy, excluded: `${copy.excluded}; 불확실: ${uncertainArea}`});
}
