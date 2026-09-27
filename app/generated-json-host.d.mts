import type { Ledger } from '../daemon/src/ledger.js';
import type { OrchestrationHost, OrchestrationRun, LocalOrchestrationHost } from './orchestration-driver.mjs';
import type { LocalCandidateChecks } from '../daemon/src/selection/local-policy-store.js';
import type { CatalogRecord } from '../daemon/src/integration-catalog.js';
import type { HostEvidencePolicy } from '../daemon/src/capability-admission.js';
import type { MeasurementSubject } from '../daemon/src/measurement-subject.js';
import type { SelectionCandidate } from '../daemon/src/selection/policy.js';
import type { ModelControlBundle } from '../daemon/src/model-control-bundle.js';
import type { createIsolatedLocalModelExecutor } from '../daemon/src/adapters/isolated-local-model.js';
import type { createIsolatedJsonCheckerExecutor } from '../daemon/src/adapters/isolated-json-checker.js';
export interface GeneratedJsonHostOptions {
  db: Ledger; now(): number; inputForRun(run: OrchestrationRun): string;
  installation: { nodeExecutable: string; nodeSha256: string; modelControlBundle: ModelControlBundle; checkerControlBundle: ModelControlBundle; taskRootBase: string; profileRootBase: string };
  candidates: Record<'model' | 'checker', { record: CatalogRecord; currentSubject(): MeasurementSubject; evidenceReferences(): unknown; observeCandidate(): SelectionCandidate }>;
  evidence: HostEvidencePolicy;
  policies: Record<'efficiency' | 'performance' | 'value' | 'speed', { policyId: string; revision: number; digest: string } | { deploymentChannelId: string }>;
  accounting: { kind?: 'monetary'; currency: string; unit: 'minor' | 'micro'; limitUnits: number; unitsPerCost: number; source: string; observedAtMs: number; upperUnitsByKind: Record<'model' | 'checker', number> };
  maxOutputBytes?: number; maxOutputTokens?: number;
  /** Trusted deterministic testing only; absent defaults to real pinned executors. */
  executorFactories?: { model?: typeof createIsolatedLocalModelExecutor; checker?: typeof createIsolatedJsonCheckerExecutor };
}
export interface LocalGeneratedJsonHostOptions extends Omit<GeneratedJsonHostOptions, 'accounting' | 'candidates'> {
  accounting: { kind: 'local-invocation'; source: string; observedAtMs: number };
  candidates: Record<'model' | 'checker', { record: CatalogRecord; currentSubject(): MeasurementSubject; evidenceReferences(): unknown; observeCandidate(): LocalCandidateChecks }>;
}
export function createGeneratedJsonHost(options: GeneratedJsonHostOptions):
  Readonly<{ available: true; host: OrchestrationHost & { readonly parentTemplate: 'generated-json-v1' } }>
  | Readonly<{ available: false; reasons: readonly string[] }>;
export function createGeneratedJsonHost(options: LocalGeneratedJsonHostOptions):
  Readonly<{ available: true; host: LocalOrchestrationHost & { readonly parentTemplate: 'generated-json-v1' } }>
  | Readonly<{ available: false; reasons: readonly string[] }>;
