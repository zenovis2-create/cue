import type { InstallationGeneration } from './installation-identity.mjs';
import type { AppDaemon } from './core.mjs';
import type { GeneratedJsonHandoffAuthority } from './generated-json-handoff-authority.mjs';
import type { ExternalEffectObserver, ExternalEffectVerifier } from '../daemon/src/held-recovery.js';
export interface NativeIdentityList {
  readonly version: 'cue-native-recovery-list-v1'; readonly authority: 'observation-only'; readonly runId: string; readonly truncated: boolean;
  readonly records: readonly Readonly<{ attemptId: string; identityRef: string; candidateId: string; subjectDigest: string }>[];
}
export interface NativeRecoverySummary {
  readonly version: 'cue-native-recovery-observation-v1'; readonly authority: 'observation-only'; readonly sourceKind: 'fixture' | 'native';
  readonly runId: string; readonly attemptId: string; readonly identityRef: string; readonly candidateId: string; readonly subjectDigest: string; readonly observedAt: string;
  readonly processes: Readonly<Record<'launcher' | 'client' | 'guardian', 'matching-alive' | 'matching-exited' | 'pid-reused' | 'absent' | 'unknown'>>;
  readonly paths: Readonly<Record<'taskRoot' | 'profileRoot' | 'profilePath', string>>; readonly pathProvenance: 'matched' | 'unknown';
  readonly timing: Readonly<{ initialGuardMs: number; observationMs: number; finalGuardMs: number; observationLimitMs: number; totalResponseBounded: boolean }>;
  readonly journal: Readonly<{ state: 'held' | 'eligible-for-disposition' | 'reconciled-stop' | 'unavailable'; reasonCode?: 'handoff-unavailable'|'handoff-integrity-unavailable'|'external-effect-authority-unavailable'|'cleanup-or-death-unverified'|'native-journal-observation-unavailable'; caseId?: string; revision?: number }>;
}
export interface NativeRecoveryHost {
  listRecoveryRuns(input: Record<string, never>): NativeRecoveryRunList;
  listNativeIdentities(input: { runId: string }): NativeIdentityList;
  observeNativeRecovery(input: { runId: string; attemptId: string; identityRef: string; signal?: AbortSignal }): Promise<NativeRecoverySummary>;
}
export interface NativeRecoveryRunList {
  readonly version: 'cue-native-recovery-runs-v1'; readonly authority: 'observation-only';
  readonly records: readonly Readonly<{ runId: string; state: string; recordedAttemptCount: number; identityRecordCount: number;
    missingIdentityAttemptCount: number; missingStageLinkCount: number;
    recordStatus: 'recorded-unverified' | 'no-recorded-identities' | 'lineage-incomplete' }>[];
  readonly truncated: boolean; readonly scanTruncated: boolean;
}
export function createNativeRecoveryHost(input: { guard: InstallationGeneration; daemon: AppDaemon; worktree: string; handoffAuthority?: Readonly<GeneratedJsonHandoffAuthority>; externalEffectObservers?: ReadonlyMap<string,ExternalEffectObserver>; externalEffectVerifier?: ExternalEffectVerifier }): NativeRecoveryHost;
