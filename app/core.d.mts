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
  stop(runId: string, reason?: string): boolean;
  close(): void;
}
export interface CueCore {
  prepareGoal(goal: string, autonomy?: 1 | 2 | 3): PreparedGoal;
  approve(runId: string): Readonly<{ approved: true; runId: string }>;
  execute(runId: string): any;
  stop(runId: string): boolean;
  completion(taskId: string): any;
  readonly daemon: AppDaemon;
  close(): void;
}
export function initializeConfig(userDataPath: string, defaults?: Partial<Pick<CueConfig, 'ledgerPath' | 'worktreeRoot'>>): CueConfig;
export interface CueRuntime {
  readonly binary?: string;
  readonly binarySha256?: string;
  readonly codexHome?: string;
  readonly homeRoot?: string;
  readonly extraArgs?: readonly string[];
  readonly model?: string;
  readonly prompt?: (run: any) => string;
  readonly controllerArgs?: readonly string[];
  readonly requestTimeoutMs?: number;
  readonly runTimeoutMs?: number;
  readonly envelopeTtlMs?: number;
}
export function createCueCore(config: CueConfig, daemon?: AppDaemon, runtime?: CueRuntime): CueCore;
