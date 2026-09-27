import type { Ledger } from '../daemon/src/ledger.js';
import type { Envelope } from '../daemon/src/envelope.js';
import type { BudgetPolicy, BudgetReceipt } from '../daemon/src/budget.js';
import type { EngineHost, EngineContext, LocalEngineHost, LocalEngineContext } from '../daemon/src/orchestration/engine.js';
import type { LocalInvocationPolicy } from '../daemon/src/local-invocation-budget.js';
import type { ProposedPlan, PlanTask, PlanReadiness } from '../daemon/src/orchestration/plan.js';
import type { createOrchestrationStore } from '../daemon/src/orchestration/store.js';
import type { createStageEnvelopeBinder, StageEnvelopeBinding, StageEnvelopeRequest, StageScopeGrant } from '../daemon/src/orchestration/stage-envelope.js';
import type { createIntegrationCatalog } from '../daemon/src/integration-catalog.js';
import type { RuntimeHost, RuntimeRole, HostCandidate } from '../daemon/src/integration-runtime.js';
import type { RequirementContract, RequirementCheckerResolver, RegisteredRequirementChecker } from '../daemon/src/verification/requirements.js';
import type { AcceptanceHost } from '../daemon/src/verification/acceptance.js';
import type { createProviderLifecycleStore } from '../daemon/src/orchestration/provider-lifecycle.js';
import type { ProviderLifecycleEvidenceVerifier } from '../daemon/src/orchestration/provider-lifecycle-evidence.js';
import type { TerminalIntegrityResult } from '../daemon/src/orchestration/handoff-activity.js';
import type { RequestQueueHost, WaitRequestInput, WaitResponseInput, CheckpointInput } from '../daemon/src/request-queue.js';
import type { RecoveryPolicyHost } from '../daemon/src/orchestration/recovery-policy.js';
import type { CompletionEstimate } from '../daemon/src/selection/policy.js';
import type { FinalPublicationAuthority, FinalPublicationOptions } from '../daemon/src/final-publication.js';
import type { CleanRootInspection, StagingFactory } from '../daemon/src/orchestration/staging-authority.js';
import type { CapturedGoalProposal } from './goal-proposal.mjs';

export interface OrchestrationRun {
  readonly template?: Readonly<{ id: 'generated-json-v1'; inputText: string }>;
  readonly runId: string; readonly taskId: string; readonly envelopeHash: string;
  readonly envelope: Envelope; readonly goal: string; readonly scope: string;
  readonly selectionMode?: import('../daemon/src/selection/preferences.js').SelectionMode;
}
export interface OrchestrationApproval {
  readonly goalProposal?: Readonly<{ref:string;digest:string;instructions:CapturedGoalProposal['instructions']}>;
  readonly exploration?: Readonly<{candidateId:string;limitUnits:number;currency:string;unit:'minor'|'micro';taskIds:readonly string[];authorizationDigest:string;consentDigest:string}>;
  readonly initialDefault?: Readonly<{ digest: string; candidateId: string; conservativeMaxCost: number; conservativeMaxTimeMs: number; currency: string }>;
  readonly changeTargets?: readonly ChangeTargetApproval[];
  readonly generatedOutputs?: readonly GeneratedOutputApproval[];
  readonly mode: string; readonly policyRevision: string; readonly currency: string;
  readonly unit: 'minor' | 'micro'; readonly limitUnits: number; readonly stageCount: number;
  readonly planDigest: string;
  readonly requirementsDigest: string | null;
  readonly requirements: readonly RequirementContract[];
  readonly recoveryMode: 'manual' | 'automatic-approved';
  readonly maxParallelReadTasks: number;
  readonly stagedPublication:boolean;
  readonly executionStaging?:Readonly<{enabled:true;factoryProtocol:'cue-attempt-staging-factory-v1';factorySha256:string;publicationWorktreeRealpath:string;publicationRootIdentity:Readonly<{volumeSerial:string;fileId:string}>;baseCommitId:string;cleanSnapshotSha256:string}>;
  readonly retry: Readonly<{ maxAttemptsPerTask: number; maxAttemptsTotal: number; deadlineMs: number; contractDigest: string }> | null;
  readonly stages: readonly Pick<PlanTask, 'id' | 'role' | 'dependencyIds' | 'requirementIds' | 'scopeIds' | 'candidateIds'>[];
}
export interface ChangeTargetPreparation { readonly taskId:string; readonly targetId:string; readonly relativePath:string; readonly maxBackupBytes:number }
export interface ChangeTargetApproval extends ChangeTargetPreparation { readonly rootContractDigest:string }
export interface GeneratedOutputPreparation {
  readonly targetId: string; readonly requirementId: string; readonly producerTaskId: string;
  readonly checkerId: string; readonly checkerRevision: string; readonly inputText: string; readonly maxBytes: number;
}
export interface LocalOrchestrationApproval extends Omit<OrchestrationApproval, 'currency' | 'unit' | 'limitUnits'> {
  readonly accountingKind: 'local-invocation'; readonly limitInvocations: number; readonly timeoutMs: number;
}
export interface GeneratedOutputApproval extends Omit<GeneratedOutputPreparation, 'inputText'> {
  readonly inputSha256: string; readonly inputByteLength: number;
  readonly parametersDigest: string; readonly targetDigest: string;
}
export interface StagedPublicationContract {
  readonly version:'cue-staged-existing-files-v1';readonly contractId:string;readonly runId:string;readonly taskId:string;readonly attemptId:string;readonly changeSetId:string;
  readonly worktreeRealpath:string;readonly stagingOnly:true;readonly targets:readonly Readonly<{relativePath:string;maxBytes:number}>[];
}
export interface FinalPublicationHost {
  authorize(context:FinalPublicationAuthority):boolean;
  /** Registers host-owned staging resources only; it must not launch a provider or process. */
  openStagedAttempt(contract:StagedPublicationContract):Promise<Readonly<{contractId:string}>>;
  readStagedReplacement(input:Readonly<{contractId:string;runId:string;taskId:string;attemptId:string;changeSetId:string;relativePath:string;maxBytes:number;stagingOnly:true}>):Promise<Buffer>;
  readonly execute?:NonNullable<FinalPublicationOptions['execute']>;
}
export interface OrchestrationHost {
  readonly supportsGoalProposals?:true;
  readonly requiresExplicitTemplate?: true;
  readonly parentTemplate?: 'generated-json-v1' | 'goal-planning-v1';
  now(): number;
  readonly wait?: Omit<RequestQueueHost, 'now'>;
  readonly deliverWaitResponse?: (input: Readonly<{ dispatchId:string;attemptId:string;identityId:string;durableRef:string;requestId:string;responseId:string;contentRef:string;contentSha256:string;contentBytes:Uint8Array }>) => Promise<Readonly<{ dispatchId:string;attemptId:string;identityId:string;durableRef:string;contentSha256:string }>>;
  readonly catalog: ReturnType<typeof createIntegrationCatalog>;
  readonly resolveRequirementChecker?: RequirementCheckerResolver;
  /** Trusted registered host checkers; omitted hosts remain acceptance-unverified. */
  readonly acceptance?: AcceptanceHost;
  /** Trusted host observations used to derive recovery. Caller input never supplies facts or an action. */
  readonly recovery?: Omit<RecoveryPolicyHost,'now'|'resolveHandoffArtifact'|'authorizeHandoffArtifact'>;
  readonly finalPublication?:FinalPublicationHost;
  readonly executionStaging?:Readonly<{inspectCleanRoot(worktreeRealpath:string):CleanRootInspection;factory:StagingFactory}>;
  readonly lifecycleEvidence?:Readonly<{timeoutMs:number;verify:ProviderLifecycleEvidenceVerifier}>;
  prepare(run: OrchestrationRun, proposal?:CapturedGoalProposal): {
    policy: { policyId: string; revision: number; digest: string };
    requirementIds: readonly string[]; proposedPlan: ProposedPlan; scopes: readonly StageScopeGrant[];
    requirements?: readonly RequirementContract[];
    requirementCheckers?: readonly RegisteredRequirementChecker[];
    generatedOutputs?: readonly GeneratedOutputPreparation[];
    changeTargets?: readonly ChangeTargetPreparation[];
    stagedPublication?:true;
    executionStaging?:true;
    initialDefault?: Readonly<{ defaultCandidateId: string; conservativeEstimate: CompletionEstimate; source: string; boundAtMs: number }>;
    exploration?: Readonly<{candidateId:string;limitUnits:number;taskIds:readonly string[];authorizedAt:string;sourceVersion:string}>;
    retry?: { maxAttemptsPerTask: number; maxAttemptsTotal: number; deadlineMs: number };
    recoveryMode?: 'manual' | 'automatic-approved';
    budget: BudgetPolicy; limits: { launchTimeoutMs: number; taskTimeoutMs: number; pollMs: number; maxParallelReadTasks?: number };
  };
  verifyFinalBilling(receipt: Readonly<BudgetReceipt>): boolean;
  readonly authority: Parameters<typeof createOrchestrationStore>[1] & {
    authorizeStage: Parameters<typeof createStageEnvelopeBinder>[1]['authorizeStage'];
  };
  readonly runtime: Omit<RuntimeHost, 'resolveCandidate' | 'authorizeRun'> & {
    resolveCandidate(id: string, attemptId: string, role: RuntimeRole, binding: StageEnvelopeBinding): (HostCandidate & {readonly stagedPublication?:'attempt-owned-existing-files-v1'}) | undefined;
    authorizeRun(id: string, candidateId: string, role: RuntimeRole, binding: StageEnvelopeBinding): boolean;
  };
  readonly engine: Omit<EngineHost, 'now' | 'prepareExecution'>;
  stage(context: EngineContext, run: OrchestrationRun): StageEnvelopeRequest['stage'];
}
export interface LocalOrchestrationHost extends Omit<OrchestrationHost, 'prepare' | 'verifyFinalBilling' | 'engine' | 'stage'> {
  readonly accountingKind: 'local-invocation';
  prepare(run: OrchestrationRun): Omit<ReturnType<OrchestrationHost['prepare']>, 'budget' | 'initialDefault' | 'exploration'> & { budget: LocalInvocationPolicy; initialDefault?: never; exploration?: never };
  readonly engine: Omit<LocalEngineHost, 'now' | 'prepareExecution'>;
  stage(context: LocalEngineContext, run: OrchestrationRun): StageEnvelopeRequest['stage'];
}
export interface OrchestrationDriver<Approval = OrchestrationApproval> {
  waitRequest(input: WaitRequestInput): Readonly<WaitRequestInput>;
  waitResponse(input: WaitResponseInput): Readonly<{accepted:boolean;replay:boolean}>;
  waitResolve(requestId:string,status:'cancelled'|'expired',observedAtMs:number): Readonly<{status:string}>;
  checkpoint(input: CheckpointInput): Readonly<{streamId:string;cursor:number;advanced:number;sealed:boolean}>;
  reconcileCheckpoint(streamId:string): Readonly<{streamId:string;cursor:number;advanced:number;sealed:boolean}>;
  deliverWaitResponse(input:{requestId:string;responseId:string;claimedAtMs:number}):Promise<Readonly<Record<string,unknown>>>;
  recover(input: Readonly<{runId:string;decisionId:string;priorAttemptId:string;proposedCandidateId?:string;plan?:ProposedPlan}>): Readonly<{action:string;revision:number;planDigest:string}>;
  prepare(run: OrchestrationRun, proposal?:CapturedGoalProposal): Approval;
  assertGoalProposal(runId:string):string|null;
  approveExploration(runId:string): Readonly<{consentDigest:string;replay:boolean}>;
  activate(run: OrchestrationRun | string): { state: string; started: boolean };
  start(run: OrchestrationRun | string): Promise<void>;
  stop(runId: string): boolean;
  snapshot(runId: string): { runId: string; state: string; reason: string | null; readiness: PlanReadiness;
    recovery: Readonly<{decisionId:string;priorAttemptId:string;action:'replan'}> | null;
    terminalIntegrity: readonly TerminalIntegrityResult[]; unresolvedAttemptIds: readonly string[]; acceptance: 'verified' | 'unverified' };
  readTerminalIntegrity(attemptId: string): TerminalIntegrityResult;
  lifecycle(attemptId: string): ReturnType<ReturnType<typeof createProviderLifecycleStore>['project']>;
  settled(): Promise<void>;
  close(): Promise<void>;
}
export function createOrchestrationDriver(options: { db: Ledger; host: OrchestrationHost; assertRunSource?:(runId:string)=>void }): OrchestrationDriver;
export function createOrchestrationDriver(options: { db: Ledger; host: LocalOrchestrationHost; assertRunSource?:(runId:string)=>void }): OrchestrationDriver<LocalOrchestrationApproval>;
