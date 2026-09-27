import type { Ledger } from '../daemon/src/ledger.js';
import type { MeasurementSubject } from '../daemon/src/measurement-subject.js';
import type { CatalogRecord } from '../daemon/src/integration-catalog.js';
import type { SelectionCandidate } from '../daemon/src/selection/policy.js';
import type { HostCandidate } from '../daemon/src/integration-runtime.js';
import type { OrchestrationHost } from './orchestration-driver.mjs';
import type { createDefaultCodexCandidate } from '../daemon/src/adapters/integration-executors.js';
import type { ProviderInstallationDescriptor } from './provider-installation.mjs';

export interface NativeImplementationHostOptions {
  db: Ledger; now(): number;
  workflow: Readonly<{ requirementId:string;requirementText:string;checkerId:string;checkerRevision:string;parametersDigest:string;
    targets:readonly Readonly<{targetId:string;relativePath:string;maxBackupBytes:number}>[];
    expectedArtifacts?:readonly Readonly<{targetId:string;relativePath:string;maxBytes:number;expectedSha256:string;expectedByteLength:number;originalSha256:string}>[];
    proposalRequirements?:readonly Readonly<{requirementId:string;requirementText:string;
      expectedArtifacts:readonly Readonly<{targetId:string;relativePath:string;maxBytes:number;expectedSha256:string;expectedByteLength:number;originalSha256:string}>[]}>[];
    launchTimeoutMs:number;taskTimeoutMs:number;pollMs:number }>;
  policies:Record<'efficiency'|'performance'|'value'|'speed',Readonly<{policyId:string;revision:number;digest:string}>>;
  accounting:Readonly<{currency:string;unit:'minor'|'micro';limitUnits:number;unitsPerCost:number;source:string;observedAtMs:number;upperUnitsByRole:Readonly<{implementation:number;verifier:number}>}>;
  implementation:Readonly<{record:CatalogRecord;currentSubject():MeasurementSubject;evidenceReferences():unknown;observeCandidate():SelectionCandidate;installation?:ProviderInstallationDescriptor;
    /** The host binds workflow targets to the executor's native existing-file runtime mode. */
    executor:Parameters<typeof createDefaultCodexCandidate>[0]}>;
  verifier:Readonly<{record:CatalogRecord;currentSubject():MeasurementSubject;evidenceReferences():unknown;observeCandidate():SelectionCandidate} & (
    {candidate:HostCandidate;executor?:never;installation?:never} |
    {candidate?:never;executor:Parameters<typeof createDefaultCodexCandidate>[0];installation?:ProviderInstallationDescriptor}
  )>;
  requirementCheckers?:readonly unknown[];resolveRequirementChecker?:NonNullable<OrchestrationHost['resolveRequirementChecker']>;acceptance?:NonNullable<OrchestrationHost['acceptance']>;
  authorizePublication:Parameters<typeof import('./staged-existing-file-publication-host.mjs').createStagedExistingFilePublicationHost>[0]['authorizePublication'];
  verifyFinalBilling:OrchestrationHost['verifyFinalBilling'];authority:OrchestrationHost['authority'];
  runtime:Omit<OrchestrationHost['runtime'],'resolveCandidate'>;engine:Omit<OrchestrationHost['engine'],'observeCandidates'>;
}
export function createNativeImplementationHost(options:NativeImplementationHostOptions):(OrchestrationHost&Readonly<{executionStagingSupport:'git-worktree-v1'}>)|Readonly<{available:false;reasons:readonly string[]}>;
