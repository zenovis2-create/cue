export interface CueConfig { readonly version: number; readonly ledgerPath: string; readonly worktreeRoot: string }
export interface PreparedGoal {
  readonly taskId: string;
  readonly runId: string;
  readonly autonomy: 1 | 2 | 3;
  readonly threeLines: readonly string[];
  readonly envelope: Readonly<Record<string, unknown>>;
}
export class AppDaemon {
  constructor(config: CueConfig);
  readonly db: any;
  readonly status: string;
  crash(reason?: string): void;
  close(): void;
}
export interface CueCore {
  prepareGoal(goal: string, autonomy?: 1 | 2 | 3): PreparedGoal;
  approve(runId: string): Readonly<{ approved: true; runId: string }>;
  execute(runId: string): any;
  completion(taskId: string): any;
  readonly daemon: AppDaemon;
  close(): void;
}
export function initializeConfig(userDataPath: string, defaults?: Partial<Pick<CueConfig, 'ledgerPath' | 'worktreeRoot'>>): CueConfig;
export function createCueCore(config: CueConfig, daemon?: AppDaemon): CueCore;
