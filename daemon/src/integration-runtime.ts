import { createCapabilityAdmission } from './capability-admission.js';
import type { Admission, HostEvidencePolicy } from './capability-admission.js';
import { subjectDigest } from './measurement-subject.js';
import type { MeasurementSubject } from './measurement-subject.js';
import type { ProviderLifecycleKind, ProviderReferenceType } from './orchestration/provider-lifecycle.js';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

function snapshotLifecycleData(value: unknown, depth = 0): unknown {
  if (depth > 8) throw Error('runtime_lifecycle_input');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && Buffer.byteLength(value) <= 4096 && !value.includes('\0')) return value;
  if (!value || typeof value !== 'object' || types.isProxy(value)) throw Error('runtime_lifecycle_input');
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) throw Error('runtime_lifecycle_input');
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
  if (keys.length > 64) throw Error('runtime_lifecycle_input');
  const copy: any = array ? [] : {};
  for (const key of keys) {
    if (array && key === 'length') continue;
    const descriptor = descriptors[key as keyof typeof descriptors];
    if (typeof key !== 'string' || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || (array && !/^(0|[1-9][0-9]*)$/.test(key))) throw Error('runtime_lifecycle_input');
    copy[key] = snapshotLifecycleData(descriptor.value, depth + 1);
  }
  if (array && (copy.length !== value.length || keys.length !== value.length + 1)) throw Error('runtime_lifecycle_input');
  return Object.freeze(copy);
}

export type RuntimeRole = 'implementation' | 'model';
export type RuntimePhase = 'launching' | 'running' | 'cancel-requested' | 'awaiting-cleanup' | 'settled';
export type ExecutionOutcome = 'succeeded' | 'failed' | 'unknown';
export interface ProviderLifecycleEmission {
  readonly kind: Extract<ProviderLifecycleKind, 'provider-terminal' | 'billing-finalized'>;
  readonly data: Readonly<Record<string, unknown>>;
  readonly references?: readonly Readonly<{ refType: ProviderReferenceType; label: string; reference: string }>[];
}
export interface RuntimeContext {
  // Supplied by the driver after matching the approved credential binding; no secret bytes.
  readonly accountIdentity?: Readonly<{reference:string;digest:string}>;
  readonly goalTaskInstruction?: Readonly<{runId:string;planDigest:string;taskId:string;proposalRef:string;text:string}>;
  readonly runId: string;
  readonly candidateId: string;
  readonly role: RuntimeRole;
  readonly subjectDigest: string;
  readonly signal: AbortSignal;
  emitActivity?(kind: 'heartbeat'|'progress'|'output'|'tool'|'artifact'|'usage'|'cancel'|'terminal', data: Readonly<Record<string, unknown>>): void | Promise<void>;
  emitLifecycle?(event: ProviderLifecycleEmission): Promise<void>;
}
export interface AdapterExecution {
  // Trusted adapter-owned control object, never exposed through the public handle.
  readonly completion: Promise<ExecutionOutcome>;
  readonly durableRef?: string;
  cancel(): Promise<void>;
}
export interface HostCandidate {
  readonly kind: 'agent' | 'model' | 'checker';
  readonly supportedRoles: readonly RuntimeRole[];
  readonly cancellation: 'supported' | 'unsupported';
  readonly usage: 'supported' | 'unsupported';
  readonly availability: 'ready' | 'not-installed' | 'unauthenticated' | 'incompatible';
  readonly typedActivitySource?: 'host-codex-controller-v1' | 'isolated-generated-v1';
  readonly durableExecutionRef?: 'session-handle-v1';
  // Build from currently running artifacts; do not accept a submitted manifest's subject.
  buildCurrentSubject(): MeasurementSubject;
  evidenceReferences(): unknown;
  launch(context: Readonly<RuntimeContext>): Promise<AdapterExecution>;
}
export interface CleanupReceipt {
  readonly runId: string;
  readonly subjectDigest: string;
  readonly result: 'verified-clean' | 'residual' | 'unknown';
  readonly evidenceRef: string;
}
export interface RuntimeHost {
  readonly evidence: HostEvidencePolicy;
  // Host registry only: no candidate implementations from models or manifests.
  resolveCandidate(candidateId: string, runId: string, role: RuntimeRole): HostCandidate | undefined;
  // Existing envelope/lease/authorization checks belong here before activation.
  authorizeRun(runId: string, candidateId: string, role: RuntimeRole): boolean;
  readLaunchIntent?(attemptId: string): Readonly<{ candidateId: string; expectedSubjectDigest: string }> | null;
  recordAttemptIdentity?(input: Readonly<{ attemptId: string; subjectDigest: string; durableRef: string; observedAtMs: number }>): void;
  recordActivity?(attemptId: string, kind: 'heartbeat'|'progress'|'output'|'tool'|'artifact'|'usage'|'cancel'|'terminal', data: Readonly<Record<string, unknown>>): void;
  recordLifecycle?(attemptId: string, event: Readonly<{ kind: ProviderLifecycleKind; data: Readonly<Record<string, unknown>>;
    references?: readonly Readonly<{ refType: ProviderReferenceType; label: string; reference: string }>[] }>): void;
  readonly lifecycleTimeoutMs?: number;
  // Independent host observation of identity, death and remnants. Adapter exit,
  // cancellation acknowledgement and self-reported cleanup are not proof.
  verifyFailedStartCleanup?(context: Readonly<RuntimeContext>): Promise<CleanupReceipt>;
  verifyCleanup(context: Readonly<RuntimeContext>, execution: AdapterExecution): Promise<CleanupReceipt>;
}
export interface RunSnapshot {
  readonly runId: string;
  readonly phase: RuntimePhase;
  readonly outcome: ExecutionOutcome;
  readonly cancellation: 'not-requested' | 'requested' | 'acknowledged' | 'failed';
  readonly cleanup: 'unmeasured' | 'verified-clean' | 'residual' | 'unknown';
}
export interface RuntimeHandle {
  readonly context: Readonly<RuntimeContext>;
  readonly capabilities: Readonly<{ cancellation: HostCandidate['cancellation']; usage: HostCandidate['usage'] }>;
  snapshot(): Readonly<RunSnapshot>;
  cancel(): Promise<'requested' | 'unsupported' | 'settled' | 'failed'>;
  inspectCleanup(): Promise<'not-ready' | 'verified-clean' | 'residual' | 'unknown'>;
}
export interface StartOptions { readonly signal?: AbortSignal; readonly timeoutMs?: number }
export type StartResult =
  | { readonly ok: true; readonly handle: RuntimeHandle }
  | { readonly ok: false; readonly reason: 'invalid-request' | 'duplicate-run' | 'unknown-candidate' |
      'unavailable' | 'unsupported-role' | 'unauthorized' | 'ineligible' | 'host-error' | 'launch-failed' | 'launch-timeout' | 'aborted';
      readonly handle?: RuntimeHandle; readonly admission?: Admission; readonly cleanup: 'not-started' | 'unknown' };

/** Integration seam only; not wired into dispatch. This is transient control,
 * not a second ledger, task-completion judge or persistent recovery mechanism.
 * Adapter launch failures conservatively retain the run ID and unknown cleanup.
 */
export function createIntegrationRuntime(host: RuntimeHost) {
  const admit = createCapabilityAdmission(host.evidence);
  const usedRunIds = new Set<string>();
  const lifecycleTimeoutMs = host.lifecycleTimeoutMs ?? 1000;
  if (!Number.isSafeInteger(lifecycleTimeoutMs) || lifecycleTimeoutMs < 1 || lifecycleTimeoutMs > 5000) throw Error('runtime_lifecycle_timeout');
  return Object.freeze({
    async start(runId: string, candidateId: string, role: RuntimeRole, options: StartOptions = {}): Promise<StartResult> {
      const denied = (reason: Extract<StartResult, { ok: false }>['reason'], admission?: Admission): StartResult =>
        Object.freeze({ ok: false, reason, cleanup: reason === 'launch-failed' ? 'unknown' : 'not-started', ...(admission ? { admission } : {}) });
      if (typeof runId !== 'string' || !runId.trim() || typeof candidateId !== 'string' || !candidateId.trim() ||
          !['implementation', 'model'].includes(role)) return denied('invalid-request');
      if (options === null || typeof options !== 'object' || types.isProxy(options) ||
          ![Object.prototype, null].includes(Object.getPrototypeOf(options))) return denied('invalid-request');
      const descriptors = Object.getOwnPropertyDescriptors(options);
      if (Reflect.ownKeys(options).some(key => typeof key !== 'string' ||
          !['signal', 'timeoutMs'].includes(key) || !Object.hasOwn(descriptors[key], 'value') ||
          !descriptors[key].enumerable)) return denied('invalid-request');
      const timeoutMs = descriptors.timeoutMs?.value === undefined ? 30_000 : descriptors.timeoutMs.value;
      const signal: AbortSignal | undefined = descriptors.signal?.value;
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000 ||
          (signal !== undefined && (types.isProxy(signal) || !(signal instanceof AbortSignal)))) return denied('invalid-request');
      // Use native brand checks and event methods, not caller-owned overrides.
      const aborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!;
      const isAborted = () => signal !== undefined && aborted.call(signal) === true;
      try { if (isAborted()) return denied('aborted'); } catch { return denied('invalid-request'); }
      const controller = new AbortController();
      let lifecycleFailed = false, lifecycleClosed = false;
      let cancelRecorded = false;
      let lifecycleChain = Promise.resolve();
      let lifecycleCount = 0;
      const recordLifecycle = (event: Parameters<NonNullable<RuntimeHost['recordLifecycle']>>[1]) => {
        if (!host.recordLifecycle || lifecycleClosed || lifecycleFailed || ++lifecycleCount > 256) return Promise.reject(Error('runtime_lifecycle_closed'));
        const operation = lifecycleChain.then(() => { host.recordLifecycle!(runId, event); });
        lifecycleChain = operation;
        void operation.catch(() => { lifecycleFailed = true; });
        return operation;
      };
      const adapterLifecycle = (input: ProviderLifecycleEmission) => {
        if (!input || typeof input !== 'object' || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) return Promise.reject(Error('runtime_lifecycle_input'));
        const descriptors = Object.getOwnPropertyDescriptors(input);
        const keys = Reflect.ownKeys(input);
        if (keys.some(key => typeof key !== 'string' || !['kind','data','references'].includes(key) || !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key]!, 'value'))
            || !['provider-terminal','billing-finalized'].includes(descriptors.kind?.value as string)) return Promise.reject(Error('runtime_lifecycle_input'));
        const kind = descriptors.kind!.value as ProviderLifecycleEmission['kind'];
        const submittedReferences = descriptors.references?.value;
        let references: unknown;
        try { references = submittedReferences === undefined ? undefined : snapshotLifecycleData(submittedReferences); }
        catch (error) { return Promise.reject(error); }
        if (references !== undefined && (!Array.isArray(references) || references.length > 64)) return Promise.reject(Error('runtime_lifecycle_input'));
        const safeReferences = references?.map((reference: unknown) => {
          if (!reference || typeof reference !== 'object' || types.isProxy(reference) || Object.getPrototypeOf(reference) !== Object.prototype) throw Error('runtime_lifecycle_input');
          const fields = Object.getOwnPropertyDescriptors(reference), names = Reflect.ownKeys(reference);
          if (names.length !== 3 || names.some(key => typeof key !== 'string' || !['refType','label','reference'].includes(key) || !fields[key]?.enumerable || !Object.hasOwn(fields[key]!, 'value'))) throw Error('runtime_lifecycle_input');
          return Object.freeze({ refType: fields.refType!.value, label: fields.label!.value, reference: fields.reference!.value });
        });
        let data: unknown;
        try { data = snapshotLifecycleData(descriptors.data?.value); }
        catch (error) { return Promise.reject(error); }
        return recordLifecycle(Object.freeze({ kind, data: data as Readonly<Record<string, unknown>>,
          ...(safeReferences ? { references: Object.freeze(safeReferences) } : {}) }));
      };
      if (usedRunIds.has(runId)) return denied('duplicate-run');
      let candidate: HostCandidate | undefined;
      let context: Readonly<RuntimeContext>;
      let capabilities: RuntimeHandle['capabilities'];
      let launch: HostCandidate['launch'];
      try {
        candidate = host.resolveCandidate(candidateId, runId, role);
        if (!candidate) return denied('unknown-candidate');
        if (candidate.availability !== 'ready') return denied('unavailable');
        // Deterministic checkers use the same restricted M boundary, without
        // claiming to be a model or gaining an implementation/write role.
        if (!['agent', 'model', 'checker'].includes(candidate.kind) || !candidate.supportedRoles.includes(role) ||
            (candidate.kind !== 'agent' && role === 'implementation')) return denied('unsupported-role');
        if (host.authorizeRun(runId, candidateId, role) !== true) return denied('unauthorized');
        capabilities = Object.freeze({ cancellation: candidate.cancellation, usage: candidate.usage });
        if (![capabilities.cancellation, capabilities.usage].every(v => ['supported', 'unsupported'].includes(v))) return denied('host-error');
        launch = candidate.launch.bind(candidate);
        const references = candidate.evidenceReferences();
        const subject = candidate.buildCurrentSubject();
        const admission = admit(subject, references);
        if (!(role === 'implementation' ? admission.implementationEligible : admission.modelOnlyEligible)) return denied('ineligible', admission);
        context = Object.freeze({ runId, candidateId, role, subjectDigest: subjectDigest(subject), signal: controller.signal,
          ...(host.recordActivity ? { emitActivity: (kind: Parameters<NonNullable<RuntimeHost['recordActivity']>>[1], data: Readonly<Record<string, unknown>>) => host.recordActivity!(runId, kind, data) } : {}),
          ...(host.recordLifecycle ? { emitLifecycle: adapterLifecycle } : {}) });
        const intent = host.readLaunchIntent?.(runId);
        if (host.readLaunchIntent && (!intent || intent.candidateId !== candidateId || intent.expectedSubjectDigest !== context.subjectDigest)) return denied('host-error');
        if (host.readLaunchIntent && subjectDigest(candidate.buildCurrentSubject()) !== context.subjectDigest) return denied('ineligible', admission);
      } catch { return denied('host-error'); }
      // From here onward a launch may have side effects, even if it never returns.
      usedRunIds.add(runId);
      let execution: AdapterExecution | undefined;
      let launchPending = true;
      let phase: RuntimePhase = 'launching';
      let outcome: ExecutionOutcome = 'unknown';
      let cancellation: RunSnapshot['cancellation'] = 'not-requested';
      let cleanup: RunSnapshot['cleanup'] = 'unmeasured';
      let cancelPromise: Promise<'requested' | 'failed'> | undefined;
      let cleanupPromise: Promise<'verified-clean' | 'residual' | 'unknown'> | undefined;
      let abortedReason: 'aborted' | 'launch-timeout' | undefined;
      let stopStart!: (reason: 'aborted' | 'launch-timeout') => void;
      const stopped = new Promise<'aborted' | 'launch-timeout'>(resolve => { stopStart = resolve; });
      const detach = () => { if (signal) EventTarget.prototype.removeEventListener.call(signal, 'abort', onAbort); };
      const handle: RuntimeHandle = Object.freeze({
        context, capabilities,
        snapshot: () => Object.freeze({ runId, phase, outcome, cancellation, cleanup }),
        async cancel() {
          if (phase === 'settled') return 'settled';
          if (capabilities.cancellation === 'unsupported') return 'unsupported';
          controller.abort();
          if (!cancelRecorded) {
            cancelRecorded = true;
            cancellation = 'requested';
            if (host.recordLifecycle) try {
              await recordLifecycle({ kind: 'cancel-requested', data: { reasonDigest: createHash('sha256').update(`client-cancel\0${runId}`).digest('hex') } });
            } catch { cancellation = 'failed'; }
          }
          phase = 'cancel-requested';
          if (!execution) return 'requested';
          if (cancelPromise) return cancelPromise;
          const ownedExecution = execution;
          cancelPromise = Promise.resolve().then(() => ownedExecution.cancel()).then(async () => {
            if (lifecycleFailed) throw Error('runtime_lifecycle_failed');
            if (host.recordLifecycle) await recordLifecycle({ kind: 'client-cancel-acknowledged', data: { status: 'acknowledged' } });
            cancellation = 'acknowledged'; return 'requested' as const;
          }).catch(() => { cancellation = 'failed'; return 'failed' as const; });
          return cancelPromise;
        },
        async inspectCleanup() {
          if (phase === 'settled') return 'verified-clean';
          if (phase === 'running' || phase === 'launching') return 'not-ready';
          if (cleanupPromise) return cleanupPromise;
          // Capture launch generation. A pending launch may create effects AFTER a
          // clean observation, so no receipt can settle it until launch resolves.
          const wasPending = launchPending;
          const inspectedExecution = execution;
          cleanupPromise = Promise.resolve().then(async () => {
            try {
              const observation = inspectedExecution
                ? host.verifyCleanup(context, inspectedExecution)
                : host.verifyFailedStartCleanup?.(context);
              let timer: ReturnType<typeof setTimeout> | undefined;
              const receipt = observation === undefined ? undefined : await Promise.race([observation,
                new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('runtime_cleanup_timeout')), lifecycleTimeoutMs); })])
                .finally(() => { if (timer) clearTimeout(timer); });
              if (!receipt || wasPending || launchPending || execution !== inspectedExecution ||
                  receipt.runId !== runId || receipt.subjectDigest !== context.subjectDigest ||
                  typeof receipt.evidenceRef !== 'string' || !receipt.evidenceRef.trim() ||
                  !['verified-clean', 'residual', 'unknown'].includes(receipt.result)) cleanup = 'unknown';
              else cleanup = receipt.result;
              if (receipt && host.recordLifecycle && !lifecycleFailed) {
                const status = cleanup === 'verified-clean' ? 'clean' : cleanup === 'residual' ? 'dirty' : 'unknown';
                try { await recordLifecycle({ kind: 'cleanup-observed', data: { status,
                  receiptDigest: createHash('sha256').update(`${receipt.runId}\0${receipt.subjectDigest}\0${receipt.result}\0${receipt.evidenceRef}`).digest('hex') } }); }
                catch { cleanup = 'unknown'; }
              }
              if (lifecycleFailed) cleanup = 'unknown';
            } catch { cleanup = 'unknown'; }
            if (cleanup === 'verified-clean' && !lifecycleFailed) { lifecycleClosed = true; phase = 'settled'; detach(); }
            return cleanup as 'verified-clean' | 'residual' | 'unknown';
          }).finally(() => { cleanupPromise = undefined; });
          return cleanupPromise;
        },
      });
      function interrupt(reason: 'aborted' | 'launch-timeout') {
        if (phase === 'settled') return;
        abortedReason ??= reason;
        controller.abort();
        cancellation = cancellation === 'not-requested' ? 'requested' : cancellation;
        phase = 'cancel-requested'; cleanup = 'unknown';
        stopStart(abortedReason);
        if (capabilities.cancellation === 'supported') void handle.cancel();
      }
      function onAbort() { interrupt('aborted'); }
      if (signal) EventTarget.prototype.addEventListener.call(signal, 'abort', onAbort, { once: true });
      const timer = setTimeout(() => interrupt('launch-timeout'), timeoutMs);
      // Calling launch synchronously keeps admission immediately adjacent to launch.
      // Its promise is always observed, including resolution after timeout/abort.
      let launched: Promise<AdapterExecution>;
      try { launched = Promise.resolve(launch(context)); }
      catch { launched = Promise.reject(new Error('launch-failed')); }
      if (isAborted()) interrupt('aborted');
      const observed = launched.then(value => {
        launchPending = false;
        // Consume a returned completion even when the remaining control shape is
        // invalid, otherwise a rejected completion could escape as unhandled.
        if (value?.completion instanceof Promise) void value.completion.catch(() => {});
        if (!value || !(value.completion instanceof Promise) || typeof value.cancel !== 'function') {
          phase = 'awaiting-cleanup'; cleanup = 'unknown'; return 'launch-failed' as const;
        }
        execution = value;
        try {
          if(host.recordAttemptIdentity && (typeof value.durableRef!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value.durableRef)))throw Error('runtime_durable_identity_missing');
          if(host.recordAttemptIdentity)host.recordAttemptIdentity({ attemptId: runId, subjectDigest: context.subjectDigest, durableRef:value.durableRef!, observedAtMs: Date.now() });
        }
        catch { phase = 'awaiting-cleanup'; cleanup = 'unknown'; void value.cancel().catch(() => {}); return 'launch-failed' as const; }
        void value.completion.then(result => {
          if (phase === 'settled') return;
          outcome = result === 'succeeded' || result === 'failed' ? result : 'unknown';
          phase = 'awaiting-cleanup';
        }, () => { if (phase !== 'settled') { outcome = 'failed'; phase = 'awaiting-cleanup'; } });
        if (controller.signal.aborted) {
          phase = 'cancel-requested';
          if (capabilities.cancellation === 'supported') void handle.cancel();
        } else phase = 'running';
        return 'started' as const;
      }, () => {
        launchPending = false; phase = 'awaiting-cleanup'; cleanup = 'unknown';
        return 'launch-failed' as const;
      }).catch(() => {
        launchPending = false; phase = 'awaiting-cleanup'; cleanup = 'unknown';
        return 'launch-failed' as const;
      });
      const winner = await Promise.race([observed, stopped]);
      clearTimeout(timer);
      if (winner !== 'started' || abortedReason) {
        return Object.freeze({ ok: false, reason: abortedReason ?? (winner === 'started' ? 'aborted' : winner), cleanup: 'unknown', handle });
      }
      return Object.freeze({ ok: true, handle });
    },
  });
}
