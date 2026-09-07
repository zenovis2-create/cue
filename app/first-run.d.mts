import type { CueConfig } from './core.mjs';
export interface FirstRunOptions {
  readonly worktreeOverride?: string;
  readonly defaultRoot?: string;
  readonly chooseDirectory?: () => Promise<string | undefined>;
}
export function initializeFirstRunConfig(userDataPath: string, options?: FirstRunOptions): Promise<CueConfig>;
