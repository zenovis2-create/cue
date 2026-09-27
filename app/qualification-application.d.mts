export interface QualificationExit {
  readonly version: 'cue-qualification-exit-v1'; readonly exitCode: 0 | 1 | 2 | 3 | 130;
  readonly eligible: boolean; readonly cleanup: 'confirmed' | 'unknown'; readonly aborted: boolean; readonly restartRequired: true;
}
export function runQualificationApplication(input: { guard: unknown }): Promise<QualificationExit>;
