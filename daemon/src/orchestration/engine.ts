import { types } from 'node:util';
import { createHash } from 'node:crypto';
import type { Ledger } from '../ledger.js';
import { createBudgetManager, type BudgetReceipt, type BudgetReservation } from '../budget.js';
import { createIntegrationRuntime, type RuntimeHandle, type RunSnapshot } from '../integration-runtime.js';
import { readRunSelectionPolicy, type StoredSelectionPolicy } from '../selection/policy-store.js';
import { selectCandidate, type SelectionCandidate, type SelectionDecision } from '../selection/policy.js';
import { createAttemptDecisionStore } from '../selection/attempt-decision-store.js';
import { readInitialDefault, readInitialDefaultAttempt, recordInitialDefaultAttempt } from '../selection/initial-default.js';
import { createExplorationBudgetStore } from '../selection/exploration-budget.js';
import { createLocalInvocationBudget } from '../local-invocation-budget.js';
import { readRunLocalSelectionPolicy, selectLocalCandidate, type LocalCandidateChecks, type LocalSelectionDecision, type StoredLocalSelectionPolicy } from '../selection/local-policy-store.js';
import { deriveReadyTasks, type PlanTask, type ValidatedPlan } from './plan.js';
import { createOrchestrationStore, snapshotRetryReference, type RetryReference, type ClaimReceipt, type ClaimRequest, type ExecutionReceipt } from './store.js';
import { createHandoffAccountingStore } from '../evaluation/handoff-accounting.js';
import { createPersistedCostObservationStore } from '../selection/persisted-cost-observations.js';

export interface EngineRequest {
  runId: string; taskId: string; attemptId: string; requestId: string; observedAtMs: number; timeoutMs: number;
  revision?: number; planDigest?: string;
  recoveryDecisionId?: string; forcedCandidateId?: string;
  retry?: Readonly<RetryReference>;
  exploration?: Readonly<ExplorationRequest>;
}
export interface ExplorationRequest { version:'cue-exploration-request-v1';authorizationDigest:string;candidateId:string }
export interface EngineContext {
  readonly request: Readonly<EngineRequest>;
  readonly plan: ValidatedPlan;
  readonly task: PlanTask;
  readonly policy: StoredSelectionPolicy;
  readonly candidateId: string;
}
export interface EngineHost {
  now(): number;
  observeCandidates(request: Readonly<EngineRequest>, task: PlanTask): readonly SelectionCandidate[];
  observeInitialSelection?(request: Readonly<EngineRequest>, task: PlanTask): InitialSelectionObservation | null;
  reservation(context: EngineContext): BudgetReservation;
  // No inferred conversion between selector money and persisted minor/micro units.
  verifyBudgetMapping(policy: StoredSelectionPolicy, budget: Readonly<{ currency: string; unit: string; limitUnits: number; policyRevision: string }>): boolean;
  authorizeExecution(context: EngineContext): boolean;
  // Synchronous host-only persistence, inside claim/reserve transaction. Bind the
  // stage's narrowed envelope and SessionOwner to attemptId before any launch.
  prepareExecution(context: EngineContext): undefined;
  isStagingExecution?(context:EngineContext):boolean;
  prepareStagingSetup?(context: EngineContext): boolean;
  activateStaging?(context: EngineContext): undefined;
  authorizeStagingLaunch?(context:EngineContext):boolean;
  recordLaunchIntent?(context: EngineContext): undefined;
  receipts(context: EngineContext, runtime: Readonly<RunSnapshot> | null): {
    execution: ExecutionReceipt | null; billing: BudgetReceipt | null; attribution?: unknown; costObservation?: unknown;
  };
  resolveAccountingEvidence?(ref:string):Uint8Array|null;
  resolveCostObservationSource?(ref:string):Uint8Array|null;
}
export interface EngineAttempt {
  readonly request: Readonly<EngineRequest>;
  readonly candidateId: string;
  readonly replayed: boolean;
  readonly launch: 'started' | 'denied-or-uncertain' | 'not-relaunched';
  readonly reason: string | null;
  readonly selection: SelectionDecision | null;
  readonly selectionAvailability: 'recorded' | 'legacy-not-recorded';
  readonly acceptance: 'unverified';
  cancel(): Promise<string>;
  reconcile(): Promise<ClaimReceipt | null>;
}
export const selectionRevisionRef = (snapshot: StoredSelectionPolicy): string => `${snapshot.policyId}:${snapshot.revision}`;
export const localSelectionRevisionRef = (snapshot: StoredLocalSelectionPolicy): string => `${snapshot.policyId}:${snapshot.revision}`;
export interface LocalEngineContext extends Omit<EngineContext, 'policy'> { readonly policy: StoredLocalSelectionPolicy }
export interface LocalEngineAttempt extends Omit<EngineAttempt, 'selection'> { readonly selection: LocalSelectionDecision | null }
export interface LocalEngineHost {
  now(): number;
  readonly maxRequestAgeMs: number;
  observeCandidate(request: Readonly<EngineRequest>, task: PlanTask): LocalCandidateChecks;
  authorizeExecution(context: LocalEngineContext): boolean;
  prepareExecution(context: LocalEngineContext): undefined;
  recordLaunchIntent?(context: LocalEngineContext): undefined;
  receipts(context: LocalEngineContext, runtime: Readonly<RunSnapshot> | null): { execution: ExecutionReceipt | null; costObservation?: unknown };
  resolveCostObservationSource?(ref:string):Uint8Array|null;
}
export interface InitialSelectionObservation { version:'cue-initial-observation-v1';candidateId:string;disposition:'no-statistics';source:string;observedAtMs:number }
type LocalManagers = { store: ReturnType<typeof createOrchestrationStore>; budget: ReturnType<typeof createLocalInvocationBudget>; runtime: ReturnType<typeof createIntegrationRuntime> };
type Managers = {
  store: ReturnType<typeof createOrchestrationStore>;
  budget: ReturnType<typeof createBudgetManager>;
  runtime: ReturnType<typeof createIntegrationRuntime>;
};
function requestSnapshot(value: EngineRequest): Readonly<EngineRequest> {
  const keys = ['runId', 'taskId', 'attemptId', 'requestId', 'observedAtMs', 'timeoutMs'];
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('invalid_engine_request');
  if (Object.hasOwn(value, 'retry')) keys.push('retry');
  if (Object.hasOwn(value, 'exploration')) keys.push('exploration');
  const revised=Object.hasOwn(value,'revision')||Object.hasOwn(value,'planDigest');if(revised)keys.push('revision','planDigest');
  const recovery=Object.hasOwn(value,'recoveryDecisionId');if(recovery)keys.push('recoveryDecisionId');
  const forced=Object.hasOwn(value,'forcedCandidateId');if(forced)keys.push('forcedCandidateId');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length || Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !keys.includes(key))) throw Error('invalid_engine_request');
  const copy: Record<string, unknown> = {};
  for (const key of keys) { const d = descriptors[key]; if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) throw Error('invalid_engine_request'); copy[key] = d.value; }
  if (Object.hasOwn(copy, 'retry')) copy.retry = snapshotRetryReference(copy.retry as RetryReference);
  if(Object.hasOwn(copy,'exploration')){const raw=copy.exploration;if(!raw||typeof raw!=='object'||types.isProxy(raw)||Object.getPrototypeOf(raw)!==Object.prototype)throw Error('invalid_engine_exploration');const d=Object.getOwnPropertyDescriptors(raw);if(Reflect.ownKeys(d).length!==3||!['version','authorizationDigest','candidateId'].every(k=>d[k]?.enumerable&&Object.hasOwn(d[k]!,'value')))throw Error('invalid_engine_exploration');const exploration={version:d.version!.value,authorizationDigest:d.authorizationDigest!.value,candidateId:d.candidateId!.value};if(exploration.version!=='cue-exploration-request-v1'||typeof exploration.authorizationDigest!=='string'||!/^[a-f0-9]{64}$/.test(exploration.authorizationDigest)||typeof exploration.candidateId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(exploration.candidateId))throw Error('invalid_engine_exploration');copy.exploration=Object.freeze(exploration);}
  for (const key of keys.slice(0, 4)) if (typeof copy[key] !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,79}$/u.test(copy[key] as string)) throw Error('invalid_engine_id');
  if (!Number.isSafeInteger(copy.observedAtMs) || (copy.observedAtMs as number) < 0 || !Number.isSafeInteger(copy.timeoutMs)
      || (copy.timeoutMs as number) < 1 || (copy.timeoutMs as number) > 120_000) throw Error('invalid_engine_limits');
  if(revised&&(!Number.isSafeInteger(copy.revision)||(copy.revision as number)<0||typeof copy.planDigest!=='string'||!/^[a-f0-9]{64}$/.test(copy.planDigest)))throw Error('invalid_engine_revision');
  if(recovery&&(!revised||typeof copy.recoveryDecisionId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,79}$/.test(copy.recoveryDecisionId)))throw Error('invalid_engine_recovery');
  if(forced&&(!recovery||typeof copy.forcedCandidateId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,79}$/.test(copy.forcedCandidateId)))throw Error('invalid_engine_recovery');
  return Object.freeze(copy) as unknown as Readonly<EngineRequest>;
}

function initialFields(value:unknown,keys:readonly string[]):Record<string,unknown>{if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error('engine_initial_observation_invalid');const descriptors=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(descriptors).length!==keys.length)throw Error('engine_initial_observation_invalid');const copy:Record<string,unknown>={};for(const key of keys){const descriptor=descriptors[key];if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('engine_initial_observation_invalid');copy[key]=descriptor.value;}return copy;}
function snapshotInitialObservation(value:unknown):Readonly<InitialSelectionObservation>{const data=initialFields(value,['version','candidateId','disposition','source','observedAtMs']);if(data.version!=='cue-initial-observation-v1'||data.disposition!=='no-statistics'||typeof data.candidateId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(data.candidateId)||typeof data.source!=='string'||!data.source.trim()||data.source.length>256||/[\u0000-\u001f\u007f]/u.test(data.source)||!Number.isSafeInteger(data.observedAtMs)||(data.observedAtMs as number)<0)throw Error('engine_initial_observation_invalid');return Object.freeze(data as unknown as InitialSelectionObservation);}
function initialNumber(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;}
function initialText(value:unknown):value is string{return typeof value==='string'&&!!value.trim()&&value.length<=256&&!/[\u0000-\u001f\u007f]/u.test(value);}
function snapshotInitialCandidates(value:unknown):readonly SelectionCandidate[]{if(!Array.isArray(value)||types.isProxy(value)||Object.getPrototypeOf(value)!==Array.prototype||Reflect.ownKeys(value).length!==value.length+1)throw Error('engine_initial_candidates_invalid');const result:SelectionCandidate[]=[];for(let i=0;i<value.length;i++){const item=Object.getOwnPropertyDescriptor(value,String(i));if(!item||!Object.hasOwn(item,'value'))throw Error('engine_initial_candidates_invalid');const candidate=initialFields(item.value,['id','checks','estimate']),checks=initialFields(candidate.checks,['eligible','authenticated','compatible','dataAllowed','resourceAvailable','quotaAvailable']);if(typeof candidate.id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(candidate.id)||Object.values(checks).some(check=>typeof check!=='boolean'))throw Error('engine_initial_candidates_invalid');let estimate:SelectionCandidate['estimate']=null;if(candidate.estimate!==null){const source=initialFields(candidate.estimate,['scope','quality','expectedCost','conservativeMaxCost','expectedTimeMs','conservativeMaxTimeMs','currency','source','observedAtMs']);if(source.scope!=='verified-completion-total'||!initialNumber(source.quality)||source.quality>1||!initialNumber(source.expectedCost)||!initialNumber(source.expectedTimeMs)||!initialNumber(source.observedAtMs)||!initialText(source.currency)||!initialText(source.source)||(source.conservativeMaxCost!==null&&(!initialNumber(source.conservativeMaxCost)||source.conservativeMaxCost<source.expectedCost))||(source.conservativeMaxTimeMs!==null&&(!initialNumber(source.conservativeMaxTimeMs)||source.conservativeMaxTimeMs<source.expectedTimeMs)))throw Error('engine_initial_candidates_invalid');estimate=Object.freeze(source) as unknown as SelectionCandidate['estimate'];}result.push(Object.freeze({id:candidate.id,checks:Object.freeze(checks) as unknown as SelectionCandidate['checks'],estimate}));}return Object.freeze(result);}

/** Thin bridge. Injected managers are trusted host instances over this exact db.
 * Nested manager transactions are SQLite savepoints under the single outer write
 * transaction. No runtime launch or await occurs until its commit.
 */
export function createOrchestrationEngine(db: Ledger, managers: Managers, host: EngineHost) {
  const lifecycle = createEngineLifecycle<EngineContext, SelectionDecision | null>(db, managers, (context, snapshot) => host.receipts(context, snapshot), billing => { if (billing) managers.budget.observe(billing); }, (context,attribution) => {
    if(attribution===undefined||attribution===null)return;if(!host.resolveAccountingEvidence)throw Error('engine_accounting_evidence_unavailable');
    createHandoffAccountingStore(db).recordAttempt({runId:context.request.runId,requestId:context.request.requestId,attemptId:context.request.attemptId,partition:attribution,resolveEvidence:host.resolveAccountingEvidence});
  },(context,observation)=>{if(observation===undefined||observation===null)return;if(!host.resolveCostObservationSource)throw Error('engine_cost_observation_source_unavailable');createPersistedCostObservationStore(db).record({runId:context.request.runId,attemptId:context.request.attemptId,observation,resolveSource:host.resolveCostObservationSource});});
  function checkBinding(runId: string, plan: ValidatedPlan): StoredSelectionPolicy {
    deriveReadyTasks(plan, plan.tasks.map(task => ({ taskId: task.id, status: 'pending' })));
    const bound = readRunSelectionPolicy(db, runId);
    if (!bound || plan.approval.policyDigest !== bound.snapshot.digest || plan.approval.policyRevision !== selectionRevisionRef(bound.snapshot)) throw Error('engine_policy_plan_mismatch');
    const row = db.prepare('SELECT currency,unit,limit_units AS limitUnits,policy_revision AS policyRevision FROM integration_budget WHERE run_id=?').get(runId) as { currency: string; unit: string; limitUnits: number; policyRevision: string } | undefined;
    if (!row || row.currency !== bound.snapshot.policy.currency || row.policyRevision !== selectionRevisionRef(bound.snapshot)
        || host.verifyBudgetMapping(bound.snapshot, Object.freeze(row)) !== true) throw Error('engine_budget_mapping_mismatch');
    return bound.snapshot;
  }
  return Object.freeze({
    async start(plan: ValidatedPlan, input: EngineRequest): Promise<EngineAttempt> {
      const request = requestSnapshot(input);
      if(request.exploration){const schema=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('exploration_budget_authorization','exploration_budget_reservation')").get() as {n:number};const guards=db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('exploration_budget_authorization_insert_guard','exploration_budget_reservation_insert_guard','exploration_budget_authorization_no_update','exploration_budget_authorization_no_delete','exploration_budget_authorization_no_replace','exploration_budget_reservation_no_update','exploration_budget_reservation_no_delete','exploration_budget_reservation_no_replace')").get() as {n:number};if(schema.n!==2||guards.n!==8)throw Error('engine_exploration_migration_unavailable');}
      if(request.planDigest!==undefined&&request.planDigest!==plan.digest)throw Error('engine_revision_plan_mismatch');
      const encoded = JSON.stringify(request);
      const journalId = `engine-request-${request.attemptId}`;
      const prepared = db.transaction(() => {
        const policy = checkBinding(request.runId, plan);
        const initialDefault = readInitialDefault(db, request.runId);
        const exploration=request.exploration;
        let explorationStore:ReturnType<typeof createExplorationBudgetStore>|null=null;
        if(exploration){
          explorationStore=createExplorationBudgetStore(db);
          let authorization;try{authorization=explorationStore.readAuthorization(request.runId);}catch{throw Error('engine_exploration_authorization_invalid');}
          if(!authorization||authorization.payloadSha256!==exploration.authorizationDigest||authorization.candidateId!==exploration.candidateId||authorization.policyId!==policy.policyId||authorization.policyRevision!==policy.revision||authorization.policyDigest!==policy.digest)throw Error('engine_exploration_authorization_mismatch');
        }
        if (request.revision === undefined || request.revision === 0) managers.store.install(request.runId, plan);
        const task = plan.tasks.find(item => item.id === request.taskId);
        if (!task) throw Error('engine_task_missing');
        const old = db.prepare('SELECT claim_payload FROM orchestration_attempt WHERE attempt_id=?').get(request.attemptId) as { claim_payload: string } | undefined;
        if (old) {
          const journal = db.prepare('SELECT payload FROM orchestration_activity WHERE event_id=?').get(journalId) as { payload: string } | undefined;
          const legacySelection = !journal ? createAttemptDecisionStore(db).read(request.attemptId) : null;
          if (!journal ? legacySelection?.availability !== 'legacy-not-recorded'
            : JSON.parse(journal.payload).data?.summary !== createHash('sha256').update(encoded).digest('hex')) throw Error('engine_replay_mismatch');
          const claim = JSON.parse(old.claim_payload) as ClaimRequest;
          const reserved = db.prepare('SELECT attempt_id,payload FROM integration_budget_reservation WHERE run_id=? AND request_id=?').get(request.runId, request.requestId) as { attempt_id: string; payload: string } | undefined;
          if (claim.runId !== request.runId || claim.taskId !== request.taskId || !reserved || reserved.attempt_id !== request.attemptId) throw Error('engine_replay_binding_missing');
          const receipt = managers.store.claim(claim);
          if (receipt.launchRequired) throw Error('engine_replay_invariant');
          const saved = createAttemptDecisionStore(db).read(request.attemptId);
          if(initialDefault){const marker=readInitialDefaultAttempt(db,request.attemptId);if(!marker||marker.runId!==request.runId||marker.requestId!==request.requestId||marker.candidateId!==claim.candidateId||marker.defaultDigest!==initialDefault.digest)throw Error('engine_initial_replay_binding_missing');}
          if(exploration){const linked=db.prepare('SELECT attempt_id,candidate_id FROM exploration_budget_reservation WHERE run_id=? AND request_id=?').get(request.runId,request.requestId) as {attempt_id:string;candidate_id:string}|undefined;if(!linked||linked.attempt_id!==request.attemptId||linked.candidate_id!==exploration.candidateId||claim.candidateId!==exploration.candidateId)throw Error('engine_exploration_replay_binding_missing');explorationStore!.summary(request.runId);}
          return { context: Object.freeze({ request, plan, task, policy, candidateId: claim.candidateId }), selection: (saved.snapshot?.decision as SelectionDecision) ?? null, replay: true, staged:Boolean(db.prepare('SELECT 1 FROM attempt_staging_setup WHERE attempt_id=?').get(request.attemptId)) };
        }
        const now = host.now();
        if (!Number.isSafeInteger(now) || now < 0 || request.observedAtMs > now
            || now - request.observedAtMs > policy.policy.maxEstimateAgeMs) throw Error('engine_stale_request');
        const allowed = policy.policy.allowedCandidateIds.filter(candidate => task.candidateIds.includes(candidate) && plan.approval.allowedCandidateIds.includes(candidate)
          && (!request.forcedCandidateId || candidate===request.forcedCandidateId));
        let initialObservation:Readonly<InitialSelectionObservation>|null=null;
        let selection:SelectionDecision;
        if(!initialDefault)selection=selectCandidate({ ...policy.policy, allowedCandidateIds: exploration?allowed.filter(id=>id===exploration.candidateId):allowed }, host.observeCandidates(request, task), now);
        else{
          const candidates=snapshotInitialCandidates(host.observeCandidates(request,task));
          const observed=host.observeInitialSelection?.(request,task)??null;
          if(observed===null)selection=selectCandidate({ ...policy.policy, allowedCandidateIds: exploration?allowed.filter(id=>id===exploration.candidateId):allowed },candidates,now);
          else{
            initialObservation=snapshotInitialObservation(observed);
            if(exploration)throw Error('engine_exploration_initial_default_conflict');
            if(initialObservation.candidateId!==initialDefault.defaultCandidateId||initialObservation.observedAtMs>now||now-initialObservation.observedAtMs>policy.policy.maxEstimateAgeMs||initialDefault.conservativeEstimate.observedAtMs>now||now-initialDefault.conservativeEstimate.observedAtMs>policy.policy.maxEstimateAgeMs)throw Error('engine_initial_observation_stale_or_mismatched');
            if(candidates.find(candidate=>candidate.id===initialDefault.defaultCandidateId)?.estimate!==null)throw Error('engine_initial_observation_contradicts_empirical');
            const preparedCandidates=candidates.map(candidate=>candidate.id===initialDefault.defaultCandidateId&&candidate.estimate===null?Object.freeze({...candidate,estimate:initialDefault.conservativeEstimate}):candidate);
            selection=selectCandidate({ ...policy.policy, allowedCandidateIds: allowed.filter(id=>id===initialDefault.defaultCandidateId) },preparedCandidates,now);
          }
        }
        if (!selection.selectedId) throw Error(`engine_selection_${selection.reason}`);
        const context: EngineContext = Object.freeze({ request, plan, task, policy, candidateId: selection.selectedId });
        if (host.authorizeExecution(context) !== true) throw Error('engine_stage_not_authorized');
        const terms = host.reservation(context);
        if (terms.runId !== request.runId || terms.attemptId !== request.attemptId || terms.requestId !== request.requestId
            || terms.currency !== policy.policy.currency) throw Error('engine_reservation_lineage');
        if (!Number.isSafeInteger(terms.observedAtMs) || terms.observedAtMs > now
            || now - terms.observedAtMs > policy.policy.maxEstimateAgeMs) throw Error('engine_stale_reservation');
        const claimInput = { runId: request.runId, taskId: request.taskId, attemptId: request.attemptId,
          candidateId: context.candidateId, observedAtMs: request.observedAtMs,...(request.revision!==undefined?{revision:request.revision,planDigest:request.planDigest}:{}),...(request.recoveryDecisionId?{recoveryDecisionId:request.recoveryDecisionId}:{}) };
        const claim = request.retry ? managers.store.claimRetry({ ...claimInput, retry: request.retry }) : managers.store.claim(claimInput);
        if (!claim.launchRequired) throw Error('engine_claim_invariant');
        managers.budget.reserve(terms);
        if(exploration){if(context.candidateId!==exploration.candidateId)throw Error('engine_exploration_candidate_mismatch');explorationStore!.reserve({runId:request.runId,requestId:request.requestId,attemptId:request.attemptId,candidateId:context.candidateId,upperUnits:terms.upperUnits});}
        const staged=host.isStagingExecution?.(context)===true;
        if(!staged){const stageResult: unknown = host.prepareExecution(context);if(stageResult!==undefined){if(stageResult instanceof Promise)void stageResult.catch(()=>{});throw Error('engine_preparation_must_be_synchronous');}}
        // Existing durable activity journal records exact replay input, including timeout.
        managers.store.activity({ runId: request.runId, taskId: request.taskId, attemptId: request.attemptId,
          eventId: journalId, ordinal: 1, kind: 'progress', data: { summary: createHash('sha256').update(encoded).digest('hex'), progress: 0 }, observedAtMs: request.observedAtMs });
        createAttemptDecisionStore(db).record({ attemptId: request.attemptId, selectedAtMs: now, decision: selection });
        if(initialDefault)recordInitialDefaultAttempt(db,{version:'cue-initial-default-v1',attemptId:request.attemptId,runId:request.runId,requestId:request.requestId,disposition:initialObservation?'no-statistics':'legacy-observation-absent',candidateId:context.candidateId,defaultDigest:initialDefault.digest,observation:initialObservation?{source:initialObservation.source,observedAtMs:initialObservation.observedAtMs}:null});
        if(staged&&host.prepareStagingSetup?.(context)!==true)throw Error('engine_staging_setup_required');
        if(!staged){const launchIntentResult: unknown = host.recordLaunchIntent?.(context);if(launchIntentResult!==undefined)throw Error('engine_launch_intent_must_be_synchronous');}
        return { context, selection, replay: false,staged };
      }).immediate();
      if(prepared.staged){if(db.inTransaction)throw Error('engine_staging_outer_transaction');const activation:unknown=host.activateStaging?.(prepared.context);if(activation!==undefined)throw Error('engine_staging_activation_must_be_synchronous');db.transaction(()=>{if(host.authorizeStagingLaunch?.(prepared.context)!==true)throw Error('engine_staging_launch_not_authorized');const intent:unknown=host.recordLaunchIntent?.(prepared.context);if(intent!==undefined)throw Error('engine_launch_intent_must_be_synchronous');}).immediate();}
      return lifecycle(prepared.context, prepared.replay, prepared.selection);
    },
  });
}

/** Fixed local pair with host-observed eligibility and committed dispatch counts.
 * This path performs no monetary selection, estimates, settlement or optimization. */
export function createLocalOrchestrationEngine(db: Ledger, managers: LocalManagers, host: LocalEngineHost) {
  const maxRequestAgeMs = host.maxRequestAgeMs;
  if (!Number.isSafeInteger(maxRequestAgeMs) || maxRequestAgeMs < 1 || maxRequestAgeMs > 600000) throw Error('local_engine_request_age_limit');
  const lifecycle = createEngineLifecycle<LocalEngineContext, LocalSelectionDecision | null>(db, managers, (context, snapshot) => {
    const value = host.receipts(context, snapshot);
    if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype
      || ![1,2].includes(Reflect.ownKeys(value).length) || !Object.hasOwn(value, 'execution') || Reflect.ownKeys(value).some(key=>key!=='execution'&&key!=='costObservation')
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, 'execution')!, 'value')) throw Error('local_engine_billing_or_receipt_fields');
    return { execution: value.execution, billing: null, ...(Object.hasOwn(value,'costObservation')?{costObservation:value.costObservation}:{}) };
  }, billing => { if (billing !== null) throw Error('local_engine_billing_unsupported'); }, (_context,attribution) => { if(attribution!==undefined&&attribution!==null)throw Error('local_engine_billing_unsupported'); },(context,observation)=>{if(observation===undefined||observation===null)return;if(!host.resolveCostObservationSource)throw Error('engine_cost_observation_source_unavailable');createPersistedCostObservationStore(db).record({runId:context.request.runId,attemptId:context.request.attemptId,observation,resolveSource:host.resolveCostObservationSource});});
  function binding(runId: string, plan: ValidatedPlan): StoredLocalSelectionPolicy {
    deriveReadyTasks(plan, plan.tasks.map(task => ({ taskId: task.id, status: 'pending' })));
    const bound = readRunLocalSelectionPolicy(db, runId);
    if (!bound || bound.snapshot.digest !== plan.approval.policyDigest || localSelectionRevisionRef(bound.snapshot) !== plan.approval.policyRevision) throw Error('local_engine_policy_plan_mismatch');
    const p = bound.snapshot.policy, budget = managers.budget.summary(runId);
    if (budget.limit !== p.limitAttempts || budget.policyRevision !== localSelectionRevisionRef(bound.snapshot)) throw Error('local_engine_budget_binding');
    const producer = plan.tasks.filter(t => t.role === 'model-producer'), checker = plan.tasks.filter(t => t.role === 'verifier');
    if (plan.tasks.length !== 2 || producer.length !== 1 || checker.length !== 1
      || producer[0]!.candidateIds.length !== 1 || producer[0]!.candidateIds[0] !== p.producerCandidateId
      || checker[0]!.candidateIds.length !== 1 || checker[0]!.candidateIds[0] !== p.checkerCandidateId
      || producer[0]!.dependencyIds.length !== 0 || checker[0]!.dependencyIds.length !== 1 || checker[0]!.dependencyIds[0] !== producer[0]!.id) throw Error('local_engine_fixed_pair');
    return bound.snapshot;
  }
  return Object.freeze({
    async start(plan: ValidatedPlan, input: EngineRequest): Promise<LocalEngineAttempt> {
      const request = requestSnapshot(input), encoded = JSON.stringify(request), journalId = `engine-request-${request.attemptId}`;
      if(request.exploration)throw Error('local_engine_exploration_unsupported');
      if(request.planDigest!==undefined&&request.planDigest!==plan.digest)throw Error('engine_revision_plan_mismatch');
      const prepared = db.transaction(() => {
        const policy = binding(request.runId, plan);
        if (request.timeoutMs > policy.policy.timeoutMs) throw Error('local_engine_timeout_policy');
        if (request.revision === undefined || request.revision === 0) managers.store.install(request.runId, plan);
        const task = plan.tasks.find(t => t.id === request.taskId); if (!task) throw Error('engine_task_missing');
        const old = db.prepare('SELECT claim_payload FROM orchestration_attempt WHERE attempt_id=?').get(request.attemptId) as { claim_payload: string } | undefined;
        const candidateId = task.role === 'model-producer' ? policy.policy.producerCandidateId : policy.policy.checkerCandidateId;
        const terms = { runId: request.runId, requestId: request.requestId, attemptId: request.attemptId, taskId: request.taskId,
          candidateId, kind: task.role === 'model-producer' ? 'producer' as const : 'checker' as const, observedAtMs: request.observedAtMs };
        if (old) {
          const journal = db.prepare('SELECT payload FROM orchestration_activity WHERE event_id=?').get(journalId) as { payload: string } | undefined;
          const legacySelection = !journal ? createAttemptDecisionStore(db).read(request.attemptId) : null;
          if (!journal ? legacySelection?.availability !== 'legacy-not-recorded'
            : JSON.parse(journal.payload).data?.summary !== createHash('sha256').update(encoded).digest('hex')) throw Error('engine_replay_mismatch');
          const claim = JSON.parse(old.claim_payload) as ClaimRequest;
          if (claim.runId !== request.runId || claim.taskId !== request.taskId || claim.candidateId !== candidateId) throw Error('engine_replay_binding_missing');
          const reserved = db.prepare('SELECT 1 FROM local_invocation_reservation WHERE request_id=? AND attempt_id=? AND run_id=?').get(request.requestId, request.attemptId, request.runId);
          if (!reserved) throw Error('engine_replay_binding_missing');
          managers.budget.summary(request.runId);
          if (managers.store.claim(claim).launchRequired) throw Error('engine_replay_invariant');
          const saved = createAttemptDecisionStore(db).read(request.attemptId);
          return { context: Object.freeze({ request, plan, task, policy, candidateId }), selection: (saved.snapshot?.decision as LocalSelectionDecision) ?? null, replay: true };
        }
        const now = host.now();
        if (!Number.isSafeInteger(now) || now < request.observedAtMs || now - request.observedAtMs > maxRequestAgeMs) throw Error('engine_stale_request');
        const selection = selectLocalCandidate(policy.policy, task.role, host.observeCandidate(request, task));
        if (!selection.selected || selection.candidateId !== candidateId) throw Error('local_engine_selection_' + selection.reasons.join('_'));
        const context = Object.freeze({ request, plan, task, policy, candidateId });
        if (host.authorizeExecution(context) !== true) throw Error('engine_stage_not_authorized');
        const claimInput = { runId: request.runId, taskId: request.taskId, attemptId: request.attemptId, candidateId, observedAtMs: request.observedAtMs,...(request.revision!==undefined?{revision:request.revision,planDigest:request.planDigest}:{}),...(request.recoveryDecisionId?{recoveryDecisionId:request.recoveryDecisionId}:{}) };
        const claim = request.retry ? managers.store.claimRetry({ ...claimInput, retry: request.retry }) : managers.store.claim(claimInput);
        if (!claim.launchRequired) throw Error('engine_claim_invariant');
        managers.budget.reserve(terms);
        const result: unknown = host.prepareExecution(context);
        if (result !== undefined) { if (result instanceof Promise) void result.catch(() => {}); throw Error('engine_preparation_must_be_synchronous'); }
        managers.store.activity({ runId: request.runId, taskId: request.taskId, attemptId: request.attemptId,
          eventId: journalId, ordinal: 1, kind: 'progress', data: { summary: createHash('sha256').update(encoded).digest('hex'), progress: 0 }, observedAtMs: request.observedAtMs });
        createAttemptDecisionStore(db).record({ attemptId: request.attemptId, selectedAtMs: now, decision: selection });
        const launchIntentResult: unknown = host.recordLaunchIntent?.(context);
        if (launchIntentResult !== undefined) throw Error('engine_launch_intent_must_be_synchronous');
        return { context, selection, replay: false };
      }).immediate();
      return lifecycle(prepared.context, prepared.replay, prepared.selection);
    },
  });
}

type LifecycleContext = Pick<EngineContext, 'request' | 'task' | 'candidateId'>;
function createEngineLifecycle<C extends LifecycleContext, S>(db: Ledger,
  managers: Pick<Managers, 'store' | 'runtime'>,
  receive: (context: C, runtime: Readonly<RunSnapshot>) => { execution: ExecutionReceipt | null; billing: BudgetReceipt | null; attribution?:unknown;costObservation?:unknown },
  settleBilling: (billing: BudgetReceipt | null) => void,
  settleAttribution:(context:C,attribution:unknown)=>void,
  settleCostObservation:(context:C,observation:unknown)=>void) {
  const ownership = new Map<string, { controller: AbortController; state: 'starting' | 'published' | 'uncertain'; handle?: RuntimeHandle }>();
  return async (context: C, replayed: boolean, selection: S) => {
      const request = context.request;
      let launch: EngineAttempt['launch'] = 'not-relaunched';
      let reason: string | null = null;
      if (!replayed) {
        // Publish ownership before the first await: concurrent replay cannot mistake
        // a not-yet-returned launch for an absent process or bypass generation checks.
        const owned: { controller: AbortController; state: 'starting' | 'published' | 'uncertain'; handle?: RuntimeHandle } = {
          controller: new AbortController(), state: 'starting',
        };
        ownership.set(request.attemptId, owned);
        try {
          // Current subject/admission is independently rebuilt by the runtime now.
          // model-producer makes requirement artifacts through the M-only runtime;
          // only the legacy implementation role selects P/write admission.
          const started = await managers.runtime.start(request.attemptId, context.candidateId,
            context.task.role === 'implementation' ? 'implementation' : 'model', { timeoutMs: request.timeoutMs, signal: owned.controller.signal });
          if (started.handle) { owned.handle = started.handle; owned.state = 'published'; }
          else owned.state = 'uncertain';
          launch = started.ok ? 'started' : 'denied-or-uncertain';
          reason = started.ok ? null : started.reason;
        } catch { owned.state = 'uncertain'; launch = 'denied-or-uncertain'; reason = 'runtime-host-error'; }
        // No inferred refund/cleanup on a failed start. The durable claim remains owned.
      }
      return Object.freeze({ request, candidateId: context.candidateId, replayed: replayed, launch, reason,
        selection: selection, selectionAvailability: selection === null ? 'legacy-not-recorded' as const : 'recorded' as const, acceptance: 'unverified' as const,
        async cancel() {
          const owned = ownership.get(request.attemptId);
          if (!owned) return 'unavailable';
          owned.controller.abort();
          return owned.handle ? owned.handle.cancel() : 'requested';
        },
        async reconcile() {
          const owned = ownership.get(request.attemptId);
          // Restart, thrown start and pending launch need separate host recovery/fencing.
          // An ordinary clean receipt cannot prove that a future launch is impossible.
          if (!owned || owned.state !== 'published' || !owned.handle) return null;
          const handle = owned.handle;
          if (await handle.inspectCleanup() === 'not-ready') return null;
          const snapshot = handle.snapshot();
          const receipts = receive(context, snapshot);
          const execution = receipts.execution;
          const billing = receipts.billing;
          const attribution = receipts.attribution;
          const costObservation = receipts.costObservation;
          if (execution && (execution.runId !== request.runId || execution.taskId !== request.taskId || execution.attemptId !== request.attemptId)) throw Error('engine_receipt_lineage');
          if (execution?.cleanup === 'clean' && snapshot && snapshot.cleanup !== 'verified-clean') throw Error('engine_cleanup_unverified');
          if (billing && (billing.runId !== request.runId || billing.requestId !== request.requestId)) throw Error('engine_billing_lineage');
          return db.transaction(() => {
            settleBilling(billing);
            const result=execution ? managers.store.finish(execution) : null;
            if(attribution!==undefined&&attribution!==null){if(!execution||execution.cleanup!=='clean'||!billing)throw Error('engine_accounting_lineage');settleAttribution(context,attribution)}
            if(costObservation!==undefined&&costObservation!==null){if(!execution)throw Error('engine_cost_observation_lineage');settleCostObservation(context,costObservation)}
            return result;
          }).immediate();
        },
      });
  };
}
