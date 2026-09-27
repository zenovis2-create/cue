export interface CueConfig { readonly version: number; readonly ledgerPath: string; readonly worktreeRoot: string }
export type SelectionMode = 'efficiency' | 'performance' | 'value' | 'speed';
export interface SelectionPreferences { readonly available: boolean; readonly mode: SelectionMode; readonly revision: number; readonly unavailableReasons?: readonly string[] }
export interface PreparedGoal {
  readonly phase:'planning'|'execution';
  readonly sourcePlanningRunId?:string;
  readonly resourcePin?: ResourcePinMetadata;
  readonly taskId: string;
  readonly runId: string;
  readonly autonomy: 1 | 2 | 3;
  readonly threeLines: readonly string[];
  readonly envelope: Readonly<Record<string, unknown>>;
  readonly orchestration: import('./orchestration-driver.mjs').OrchestrationApproval | import('./orchestration-driver.mjs').LocalOrchestrationApproval | null;
  readonly selectionMode?: SelectionMode;
}
export class AppDaemon {
  constructor(config: CueConfig);
  readonly db: any;
  readonly sessionEpoch: string;
  readonly status: string;
  /** Run ids whose runtime handle is retained until its teardown settles. */
  readonly settlingRunIds: readonly string[];
  /** Recorded host ownership, including asynchronous teardown and quarantine. */
  hasUnsettledRun(runId: string): boolean;
  own(runId: string, launched: any): void;
  release(runId: string): void;
  crash(reason?: string): void;
  stop(runId: string, reason?: string): boolean;
  /** Resolves once every retained runtime handle has settled its teardown. */
  settled(): Promise<void>;
  close(): Promise<void>;
}
export interface CueCore {
  projectSwitchReadiness(targetRoot?:string):Readonly<{ready:boolean;reason:string|null}>;
  /** Explicit post-attempt shadow observation only; never changes selection or admission. */
  prepareLayaShadowSelection(input: import('../daemon/src/selection/laya-shadow.js').LayaShadowInput): import('../daemon/src/selection/laya-shadow.js').LayaShadowPreparation;
  compareLayaShadowSelection(input: import('../daemon/src/selection/laya-shadow.js').LayaShadowInput, response: unknown): import('../daemon/src/selection/laya-shadow.js').LayaShadowComparison;
  evaluateLayaShadowCohort(input: import('../daemon/src/selection/laya-shadow-cohort.js').LayaShadowCohortInput): import('../daemon/src/selection/laya-shadow-cohort.js').LayaShadowCohort;
  listWorkspaceSessions(input:{limit:number;cursor:number|null}): import('./workspace-sessions.mjs').WorkspaceSessionList;
  readWorkspaceSession(input:{runId:string}): import('./workspace-sessions.mjs').WorkspaceSessionDetail;
  requestManualEvaluationBaseline(input: import('../daemon/src/evaluation/baseline-confirmation.js').ManualBaselineChoice, confirm: import('../daemon/src/evaluation/baseline-confirmation.js').ConfirmManualBaseline): Promise<import('../daemon/src/evaluation/baseline.js').ManualBaselineDeclaration>;
  declareManualEvaluationBaseline(input: Parameters<ReturnType<typeof import('../daemon/src/evaluation/baseline.js').createEvaluationBaselineStore>['declare']>[0]): import('../daemon/src/evaluation/baseline.js').ManualBaselineDeclaration;
  readManualEvaluationBaseline(baselineId: string): import('../daemon/src/evaluation/baseline.js').ManualBaselineDeclaration;
  enrollEvaluation(input: Parameters<ReturnType<typeof import('../daemon/src/evaluation/enrollment.js').createEvaluationEnrollmentStore>['enroll']>[0]): import('../daemon/src/evaluation/enrollment.js').EvaluationEnrollment;
  readEvaluationEnrollment(enrollmentId: string): import('../daemon/src/evaluation/enrollment.js').EvaluationEnrollment;
  observeEvaluation(input: { enrollmentId: string; observationId: string; expectedPriorRevision: number }): import('../daemon/src/evaluation/observations.js').EvaluationObservation;
  evaluationCoverage(input: { datasetDigest: string; arm: string; policyDigest: string; cutoffId: string }): ReturnType<ReturnType<typeof import('../daemon/src/evaluation/observations.js').createEvaluationObservationStore>['coverage']>;
  projectEvaluationObservation(input: { enrollmentId: string; observationId: string }): import('../daemon/src/evaluation/trials.js').EvaluationTrialProjection;
  createEvaluationComparison(input: Parameters<ReturnType<typeof import('../daemon/src/evaluation/comparisons.js').createEvaluationComparisonStore>['create']>[0]): import('../daemon/src/evaluation/comparisons.js').EvaluationComparisonSnapshot;
  createEvaluationComparisonFromRecords(input: { snapshotId: string; baselineProjectionIds: readonly string[]; candidateProjectionIds: readonly string[]; mode: SelectionMode; criteria?: { readonly maxPriceAgeMs: number; readonly minPairsPerSplit: number; readonly qualityFloor: number; readonly minSuccessRate: number; readonly maxUnknownRate: number; readonly costLimitUnits: number | null; readonly costBasisUnits: number; readonly timeBasisMs: number; readonly minImprovement: number } }): import('../daemon/src/evaluation/comparisons.js').EvaluationComparisonSnapshot;
  listEvaluationProjections(input: { limit: number; cursor: number | null }): { readonly version: 'cue-evaluation-projection-list-v1'; readonly authority: 'bounded-workspace-descriptive-index'; readonly order: 'sqlite-insertion-desc'; readonly records: readonly { readonly projectionId: string; readonly dataset: { readonly id: string; readonly revision: string }; readonly caseId: string; readonly split: 'evaluation'|'holdout'; readonly arm: SelectionMode|'manual-baseline'; readonly observedAtMs: number; readonly outcomeAvailability: 'recorded'|'unavailable'; readonly outcome: 'success'|'fail'|'cancelled'|'unknown'|null; readonly trialReady: false; readonly promotionEligible: false }[]; readonly nextCursor: number | null; readonly complete: boolean };
  readEvaluationComparison(snapshotId: string): import('../daemon/src/evaluation/comparisons.js').EvaluationComparisonSnapshot;
  listEvaluationComparisons(input: { limit: number; cursor: number | null }): { readonly version: 'cue-evaluation-comparison-list-v1'; readonly authority: 'bounded-workspace-descriptive-index'; readonly order: 'sqlite-insertion-desc'; readonly records: readonly { readonly snapshotId: string; readonly recordedAtMs: number; readonly dataset: { readonly id: string; readonly revision: string }; readonly mode: SelectionMode; readonly status: 'insufficient'|'observed-improvement'|'no-observed-improvement'; readonly promotionEligible: false }[]; readonly nextCursor: number | null; readonly complete: boolean };
  captureLocalEvaluationContracts(): ReturnType<typeof import('../daemon/src/evaluation/local-contracts.js').captureLocalEvaluationContracts>;
  registerEvaluationMetric(input: { id: string; revision: string }): import('../daemon/src/evaluation/measurement-contracts.js').MeasurementContract;
  registerEvaluationEnvironment(input: { id: string; revision: string }): import('../daemon/src/evaluation/measurement-contracts.js').MeasurementContract;
  registerEvaluationAccountLimits(input: { id: string; revision: string }): import('../daemon/src/evaluation/measurement-contracts.js').MeasurementContract;
  registerEvaluationPrice(input: { id: string; revision: string }): import('../daemon/src/evaluation/measurement-contracts.js').MeasurementContract;
  captureEvaluationMeasuredFact(input: { factId: string; enrollmentId: string; observationId: string }): import('../daemon/src/evaluation/measured-facts.js').EvaluationMeasuredFact;
  readEvaluationMeasuredFact(factId: string): import('../daemon/src/evaluation/measured-facts.js').EvaluationMeasuredFact;
  listEvaluationMeasuredComparisons(input: {limit:number;cursor:number|null}): ReturnType<ReturnType<typeof import('../daemon/src/evaluation/measured-comparisons.js').createMeasuredComparisonStore>['list']>;
  createEvaluationMeasuredComparison(input: import('../daemon/src/evaluation/measured-comparisons.js').MeasuredComparisonRequest): import('../daemon/src/evaluation/measured-comparisons.js').MeasuredComparisonSnapshot;
  readEvaluationMeasuredComparison(snapshotId: string): import('../daemon/src/evaluation/measured-comparisons.js').MeasuredComparisonSnapshot | null;
  inspectEvaluationMeasuredComparison(snapshotId: string): ReturnType<ReturnType<typeof import('../daemon/src/evaluation/measured-comparisons.js').createMeasuredComparisonStore>['inspect']>;
  convertEvaluationMeasuredTrial(input: { factId: string }): import('../daemon/src/evaluation/measured-trial.js').MeasuredTrialConversion;
  projectEvaluationMeasuredFactEvidence(input: { factId: string }): import('../daemon/src/evaluation/measured-fact-evidence.js').EvaluationMeasuredFactEvidence;
  listEvaluationMeasuredFacts(input: { limit: number; cursor: number | null }): { readonly version: 'cue-evaluation-measured-fact-list-v1'; readonly authority: 'bounded-workspace-descriptive-index'; readonly order: 'sqlite-insertion-desc'; readonly records: readonly { readonly factId: string; readonly producer: { readonly class: 'host-observed'|'offline-fixture'; readonly revision: string; readonly recordedAtMs: number }; readonly trialReady: false; readonly promotionEligible: false }[]; readonly nextCursor: number | null; readonly complete: boolean };
  listNativeIdentities(input: { runId: string }): import('./native-recovery-host.mjs').NativeIdentityList;
  listRecoveryRuns(input: Record<string, never>): import('./native-recovery-host.mjs').NativeRecoveryRunList;
  observeNativeRecovery(input: { runId: string; attemptId: string; identityRef: string; signal?: AbortSignal }): Promise<import('./native-recovery-host.mjs').NativeRecoverySummary>;
  candidateInventory(): CandidateInventory;
  createRetrospective(input: { draftId: string; runId: string }): import('../daemon/src/resources/retrospective.js').RetrospectiveDraft;
  readRetrospective(draftId: string): import('../daemon/src/resources/retrospective.js').RetrospectiveDraft | null;
  localJsonSetup(): LocalJsonSetup;
  configureLocalJson(input: { expectedRevision: number | null; enabled: boolean; limits: LocalJsonLimits }): LocalJsonSetup;
  localPlanningSetup(): LocalPlanningSetup;
  configureLocalPlanning(input: { expectedRevision: number | null; enabled: boolean; limits: LocalJsonLimits }): LocalPlanningSetup;
  prepareJsonTemplate(input: { templateId: 'generated-json-v1'; inputText: string; autonomy: 1 | 2 | 3; selectionMode: SelectionMode }): PreparedGoal;
  importResourcePackage(input: { root: string; manifestSha256: string }): ResourcePackageMetadata;
  removeResourcePackage(id: string): boolean;
  listResourcePackages(): readonly ResourcePackageMetadata[];
  readResourcePin(runId: string): ResourcePinMetadata;
  searchResources(input: { runId: string; query: string; limit: number }): readonly import('../daemon/src/knowledge/lexical.js').KnowledgeHit[];
  exportRunReport(runId: string): { readonly path: string; readonly receipt: Readonly<Record<string, unknown>> };
  prepareGoal(goal: string, autonomy?: 1 | 2 | 3, selectionMode?: SelectionMode): PreparedGoal;
  prepareGoalFromProposal(input:{goal:string;proposalRef:string;autonomy:1|2|3;selectionMode:SelectionMode}):PreparedGoal;
  planningAvailability():Readonly<{available:boolean;reasons:readonly string[]}>;
  preparePlanningGoal(input:{goal:string;autonomy:1|2|3;selectionMode:SelectionMode}):PreparedGoal;
  prepareGoalFromPlanningRun(input:{planningRunId:string;autonomy:1|2|3;selectionMode:SelectionMode}):PreparedGoal;
  selectionPreferences(): SelectionPreferences;
  setSelectionPreference(input: { mode: SelectionMode; expectedRevision: number }): SelectionPreferences;
  approve(runId: string, options?: { readonly allowExploration: true }): Readonly<{ approved: true; runId: string }>;
  execute(runId: string): any;
  stop(runId: string): boolean;
  completion(taskId: string): any;
  readonly daemon: AppDaemon;
  close(): Promise<void>;
}
export interface CandidateInventory {
  readonly version: 'cue-candidate-inventory-v1'; readonly readAt: string; readonly available: boolean;
  readonly unavailableReasons: readonly string[]; readonly authority: 'read-only-observation';
  readonly records: readonly { readonly canonicalId: string; readonly toolId: string;
    readonly kind: import('../daemon/src/integration-catalog.js').CatalogKind;
    readonly installation: 'installed' | 'missing' | 'unknown'; readonly protocol: 'verified' | 'unsupported' | 'unknown';
    readonly observedAt: string; readonly catalogAvailable: boolean;
    readonly reasons: readonly import('../daemon/src/integration-catalog.js').CatalogReason[];
    readonly authentication: 'unknown'; readonly capabilityEligibility: 'unknown'; readonly executionAuthority: 'not-granted-by-inventory' }[];
  readonly selection: SelectionPreferences;
  readonly configuration: { readonly settingsRevision: number | null; readonly restartRequired: boolean;
    readonly modeComparison: 'fixed-pair-unmeasured' | 'unknown';
    readonly policies: readonly { readonly mode: string; readonly policyId: string; readonly revision: number; readonly digest: string }[] };
}
export interface ResourcePackageMetadata {
  readonly id: string; readonly version: string; readonly manifestSha256: string;
  readonly resourceCount: number; readonly totalBytes: number; readonly authority: 'reference-only';
}
export interface LocalJsonLimits {
  readonly maxInvocations: number; readonly timeoutMs: number; readonly maxOutputBytes: number; readonly maxOutputTokens: number;
}
export interface LocalJsonSetup {
  readonly templateId: 'generated-json-v1'; readonly accountingKind: 'local-invocation'; readonly revision: number | null;
  readonly configured: boolean; readonly enabled: boolean; readonly limits: LocalJsonLimits | null;
  readonly restartRequired: boolean; readonly available: boolean; readonly modelId: 'qwen38-27b-unc';
  readonly endpoint: 'http://127.0.0.1:8085/v1'; readonly ranking: 'not-performed';
}
export interface LocalPlanningSetup {
  readonly templateId: 'goal-planning-v1'; readonly settingsId: 'goal-planning-default';
  readonly accountingKind: 'local-invocation'; readonly revision: number | null;
  readonly configured: boolean; readonly enabled: boolean; readonly limits: LocalJsonLimits | null;
  readonly restartRequired: boolean; readonly available: boolean; readonly modelId: 'qwen38-27b-unc';
  readonly endpoint: 'http://127.0.0.1:8085/v1'; readonly ranking: 'not-performed';
}
export interface ResourcePinMetadata {
  readonly runId: string; readonly pinSha256: string; readonly packages: readonly ResourcePackageMetadata[]; readonly authority: 'reference-only';
}
export function initializeConfig(userDataPath: string, defaults?: Partial<Pick<CueConfig, 'ledgerPath' | 'worktreeRoot'>>): CueConfig;
/** Validate already-read persisted JSON without creating configuration files. */
export function validatePersistedConfig(userDataPath: string, value: unknown): CueConfig;
export interface OrchestrationUnavailable { readonly available: false; readonly reasons: readonly string[] }
export interface CueRuntime {
  readonly planningOrchestrationFactory?: (context:{readonly db:import('../daemon/src/ledger.js').Ledger;readonly config:CueConfig;readonly worktree:string}) => import('./goal-planning-host.mjs').GoalPlanningHost | Readonly<{available:true;host:import('./goal-planning-host.mjs').GoalPlanningHost}> | OrchestrationUnavailable;
  readonly measuredFactHost?: import('../daemon/src/evaluation/measured-facts.js').MeasuredFactHost;
  readonly verifyExplicitUserBaselineAuthority?: import('../daemon/src/evaluation/baseline.js').ExplicitUserBaselineAuthorityVerifier;
  readonly nativeRecoveryFactory?: (context: { readonly db: import('../daemon/src/ledger.js').Ledger; readonly config: CueConfig; readonly worktree: string }) => import('./native-recovery-host.mjs').NativeRecoveryHost;
  readonly orchestrationFactory?: (context: { readonly db: import('../daemon/src/ledger.js').Ledger; readonly config: CueConfig; readonly worktree: string }) => import('./orchestration-driver.mjs').OrchestrationHost | import('./orchestration-driver.mjs').LocalOrchestrationHost | OrchestrationUnavailable;
  readonly orchestration?: import('./orchestration-driver.mjs').OrchestrationHost | import('./orchestration-driver.mjs').LocalOrchestrationHost;
  /** Protected synchronous artifact resolver. It cannot launch a planner or provider. */
  readonly resolveGoalProposal?: (ref:string)=>import('./goal-proposal.mjs').GoalProposal;
  readonly launchHost?: typeof import('../daemon/src/host-codex-runtime.js').launchHostCodexRun;
  readonly binary?: string;
  readonly binarySha256?: string;
  readonly codexHome?: string;
  readonly homeRoot?: string;
  readonly extraArgs?: readonly string[];
  readonly model?: string;
  readonly prompt?: (run: any) => string;
  readonly controllerArgs?: readonly string[];
  readonly requestTimeoutMs?: number;
  readonly runTimeoutMs?: number;
  readonly envelopeTtlMs?: number;
}
export function createCueCore(config: CueConfig, daemon?: AppDaemon, runtime?: CueRuntime): CueCore;
