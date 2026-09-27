import type { AppDaemon, CueConfig } from './core.mjs';
import type { DefaultGeneratedJsonInstallation } from './default-generated-json-bootstrap.mjs';
import type { InstallationGeneration } from './installation-identity.mjs';
import type { createModelQualification } from '../daemon/src/model-qualification.js';
type QualificationResult = Awaited<ReturnType<ReturnType<typeof createModelQualification>['collect']>>;
export interface GeneratedJsonQualificationResult {
  readonly version: 'cue-generated-qualification-operation-v1'; readonly generationDigest: string;
  readonly results: Readonly<Partial<Record<'json-checker' | 'model', QualificationResult>>>;
  readonly eligible: boolean; readonly allClean: boolean; readonly failure: string | null;
  readonly restartRequired: true; readonly daemonCloseRequired: true;
}
export function createGeneratedJsonQualification(input: {
  readonly daemon: AppDaemon; readonly config: CueConfig; readonly installation: DefaultGeneratedJsonInstallation; readonly generation: InstallationGeneration;
}): Readonly<{ collect(options?: { signal?: AbortSignal }): Promise<GeneratedJsonQualificationResult> }>;
