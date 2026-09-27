import type { InstallationGeneration } from './installation-identity.mjs';
import type { AppDaemon, CueRuntime } from './core.mjs';
import type { DefaultGeneratedJsonInstallation } from './default-generated-json-bootstrap.mjs';
export function discoverGeneratedJsonInstallation(guard: InstallationGeneration): DefaultGeneratedJsonInstallation;
export function createStartupOrchestrationFactory(input: { guard: InstallationGeneration; daemon: AppDaemon; nativeConfiguration?: string }): Promise<NonNullable<CueRuntime['orchestrationFactory']>>;
export function createStartupGoalPlanningFactory(input:{guard:InstallationGeneration;daemon:AppDaemon;config:unknown;nativeConfiguration?:string;executionFactory?:NonNullable<CueRuntime['orchestrationFactory']>}):Promise<NonNullable<CueRuntime['planningOrchestrationFactory']>>;
