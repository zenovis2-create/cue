import type { Ledger } from '../daemon/src/ledger.js';
import type { ModelMeasurementInput, createModelMeasurementSubject } from '../daemon/src/model-measurement-subject.js';
import type { LocalOrchestrationHost } from './orchestration-driver.mjs';
export const DEFAULT_GENERATED_JSON_SETTINGS_ID: 'generated-json-default';
export interface DefaultGeneratedJsonContext { readonly db: Ledger; readonly config: unknown; readonly worktree: string }
export interface DefaultGeneratedJsonInstallation {
  readonly measurement: Omit<ModelMeasurementInput, 'kind'>;
  readonly controlRoot: string; readonly taskRootBase: string; readonly profileRootBase: string;
  readonly loadedHost: Readonly<{ executable: string; runtime: 'node' | 'electron'; version: string }>;
}
export interface LoadedGeneratedJsonInstallation {
  readonly hostExecutable: string; readonly hostRuntime: 'node' | 'electron'; readonly hostVersion: string;
  readonly installation: Readonly<DefaultGeneratedJsonInstallation>;
  readonly model: ReturnType<typeof createModelMeasurementSubject>; readonly checker: ReturnType<typeof createModelMeasurementSubject>;
}
export interface DefaultGeneratedJsonAuthority {
  now(): number; readonly maxEvidenceAgeMs: number;
  discoverInstallation(context: Readonly<DefaultGeneratedJsonContext>): DefaultGeneratedJsonInstallation | null;
  /** Must bind these discovery descriptors to the actual loaded host/control
   * roots and independently validate the actual process-start loaded closure. No
   * built-in validator or current-disk-only proof is supplied by this bootstrap. */
  validateLoadedInstallation(value: Readonly<LoadedGeneratedJsonInstallation>): boolean;
  observeReadiness(kind: 'model' | 'checker', context: Readonly<{ db: Ledger; subjectDigest: string }>):
    Readonly<{ authenticated: boolean; dataAllowed: boolean; resourceAvailable: boolean; quotaAvailable: boolean }>;
}
export function createDefaultGeneratedJsonBootstrap(authority?: Partial<DefaultGeneratedJsonAuthority>):
  (context: DefaultGeneratedJsonContext) => LocalOrchestrationHost | Readonly<{ available: false; reasons: readonly string[] }>;
