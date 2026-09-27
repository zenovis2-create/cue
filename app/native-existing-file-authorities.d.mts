import type { Ledger } from '../daemon/src/ledger.js';
import type { ProviderInstallationInput } from './provider-installation.mjs';
import type { NativeImplementationHostOptions } from './native-implementation-host.mjs';
import type { OrchestrationHost } from './orchestration-driver.mjs';

export interface NativeExistingFileConfiguration {
  readonly installation: ProviderInstallationInput;
  readonly authProfilePath: string;
  readonly temporaryParent: string;
  readonly workflow: NativeImplementationHostOptions['workflow'] & { readonly expectedArtifacts: NonNullable<NativeImplementationHostOptions['workflow']['expectedArtifacts']>;
    readonly proposalRequirements?:readonly Readonly<{requirementId:string;requirementText:string;expectedArtifacts:NonNullable<NativeImplementationHostOptions['workflow']['expectedArtifacts']>}>[] };
  readonly accounting: NativeImplementationHostOptions['accounting'] & { readonly conservativeTimeMs: number };
  readonly policies: NativeImplementationHostOptions['policies'];
  readonly capabilityMaxAgeMs: number;
  readonly model: string;
}
export function readNativeProposalExecutionCatalog(input:Readonly<{db:Ledger;configuration:NativeExistingFileConfiguration}>):Readonly<{
  executionPolicies:Readonly<Record<'efficiency'|'performance'|'value'|'speed',Readonly<{policyRevision:string;policyDigest:string}>>>;
  approvedExecution:Readonly<{allowedCandidateIds:readonly string[];allowedScopeIds:readonly string[];
    checkerRegistry:readonly Readonly<{checkerId:string;revision:string;kinds:readonly 'code'[];parametersDigest:string;targetIds:readonly string[]}>[];
    maxChangeTargets:number}>;
}>;
export function nativeRuntimeReceiptOutcome(runtime: Readonly<{phase:string;outcome:string;cancellation:string}> | null,
  nativeOutcome:'succeeded'|'failed'): 'succeeded'|'failed'|null;
export function createNativeExistingFileAuthorities(input: Readonly<{
  db: Ledger; now(): number; configuration: NativeExistingFileConfiguration;
}>): Promise<(context: Readonly<{db: Ledger; config: unknown; worktree: string}>) =>
  (OrchestrationHost & Readonly<{executionStagingSupport:'git-worktree-v1'}>) | Readonly<{available:false;reasons:readonly string[]}>>;
