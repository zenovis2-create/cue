import type { CueRuntime } from './core.mjs';

export interface DeploymentStagingConfiguration {
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly storageRoot?: string;
  readonly gitExecutable?: string;
}
export function parseDeploymentStagingConfiguration(raw: unknown): DeploymentStagingConfiguration;
export function createDeploymentStagingOrchestrationFactory(options: Readonly<{
  configuration?: string;
  createOrchestrationFactory(): Promise<NonNullable<CueRuntime['orchestrationFactory']>> | NonNullable<CueRuntime['orchestrationFactory']>;
  createStagingHost?(options: Readonly<{ storageRoot: string; gitExecutable?: string }>): unknown;
}>): Promise<NonNullable<CueRuntime['orchestrationFactory']>>;

