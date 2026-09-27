import type { Ledger } from '../ledger.js';
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Envelope } from '../envelope.js';
import type { SessionOwner } from '../session-spawn.js';
import type { AdapterExecution, ExecutionOutcome, RuntimeContext } from '../integration-runtime.js';
import type { MeasurementSubject } from '../measurement-subject.js';
import { launchHostCodexRun, readIssuedHostRuntimeTiming, type HostCodexRuntimeOptions, type HostCodexRuntimeResult, type RunningHostCodexRun } from '../host-codex-runtime.js';
import { streamLocalModel, type LocalModelEvent, type LocalModelRequest } from './local-model.js';
import { createNativeRuntimeReceiptStore } from '../orchestration/native-runtime-receipts.js';

export interface AttemptBinding { owner: SessionOwner; envelope: Envelope }
export interface CodexExecution extends AdapterExecution {
  readonly backend: RunningHostCodexRun;
  readonly result: Promise<HostCodexRuntimeResult>;
  readonly runtimeReceipt: Promise<string|null>;
}
export interface ExecutorEvent {
  readonly attemptId: string;
  readonly taskId: string;
  readonly candidateId: string;
  readonly model: string;
  readonly ordinal: number;
  readonly event: LocalModelEvent;
}
function text(value: unknown, label: string, max = 256): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) throw Error(`invalid_executor_${label}`);
  return value;
}
function bounded(value: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw Error('invalid_executor_bound');
  return value;
}
function own(value: unknown, label: string): Record<string, PropertyDescriptor> {
  if (value === null || typeof value !== 'object' || types.isProxy(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error(`invalid_executor_${label}`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || !descriptors[key]!.enumerable)) {
    throw Error(`invalid_executor_${label}`);
  }
  return descriptors;
}
function value(descriptors: Record<string, PropertyDescriptor>, key: string, label: string): unknown {
  const descriptor = descriptors[key];
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw Error(`invalid_executor_${label}`);
  return descriptor.value;
}
function strings(input: unknown, label: string, maxItems = 256): string[] {
  if (input === null || typeof input !== 'object' || types.isProxy(input) || !Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Array.prototype) throw Error(`invalid_executor_${label}`);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const length = Object.getOwnPropertyDescriptor(input, 'length');
  if (!length || !Object.hasOwn(length, 'value') || !Number.isSafeInteger(length.value) || length.value < 0 || length.value > maxItems) {
    throw Error(`invalid_executor_${label}`);
  }
  const keys = Reflect.ownKeys(input);
  if (keys.length !== length.value + 1 || keys.some(key => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key)))) {
    throw Error(`invalid_executor_${label}`);
  }
  const result: string[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw Error(`invalid_executor_${label}`);
    result[index] = text(descriptor.value, label, 32_768);
  }
  return result;
}
function binding(context: RuntimeContext, input: AttemptBinding): AttemptBinding {
  const bindingInput = own(input, 'binding');
  const ownerInput = own(value(bindingInput, 'owner', 'owner'), 'owner');
  const envelopeInput = own(value(bindingInput, 'envelope', 'envelope'), 'envelope');
  const owner = Object.freeze({
    cwd: text(value(ownerInput, 'cwd', 'cwd'), 'cwd', 4096),
    task_id: text(value(ownerInput, 'task_id', 'task'), 'task'),
    run_id: text(value(ownerInput, 'run_id', 'run'), 'run'),
  });
  const envelope = Object.freeze({
    run_id: text(value(envelopeInput, 'run_id', 'run'), 'run'),
    worktree_realpath: text(value(envelopeInput, 'worktree_realpath', 'worktree'), 'worktree', 4096),
    egress: Object.freeze(strings(value(envelopeInput, 'egress', 'egress'), 'egress')) as unknown as string[],
    expires_at: text(value(envelopeInput, 'expires_at', 'expiry'), 'expiry'),
    autonomy_level: value(envelopeInput, 'autonomy_level', 'autonomy') as Envelope['autonomy_level'],
    allowed_actions: Object.freeze(strings(value(envelopeInput, 'allowed_actions', 'actions'), 'action')) as unknown as string[],
  });
  if (!['supervised', 'bounded'].includes(envelope.autonomy_level)) throw Error('invalid_executor_autonomy');
  if (owner.run_id !== context.runId || envelope.run_id !== context.runId
      || owner.cwd !== envelope.worktree_realpath) throw Error('executor_attempt_binding_mismatch');
  return Object.freeze({ owner, envelope });
}

function runtimeOptions(input: unknown): Omit<HostCodexRuntimeOptions, 'binary' | 'model' | 'onEvent'> {
  const descriptors = own(input, 'options');
  const allowed = new Set(['codexHome', 'codexHomeOwnership', 'goal', 'requestTimeoutMs', 'runTimeoutMs', 'controllerArgs', 'verificationMode', 'approvedExistingTargets']);
  if (Object.keys(descriptors).some(key => !allowed.has(key))) throw Error('invalid_executor_options');
  const optionalBound = (key: 'requestTimeoutMs' | 'runTimeoutMs') => descriptors[key] === undefined ? undefined : bounded(descriptors[key]!.value, 900_000);
  const controllerArgs = descriptors.controllerArgs === undefined ? undefined : Object.freeze(strings(descriptors.controllerArgs.value, 'controller_arg'));
  const verificationMode = descriptors.verificationMode?.value;
  const codexHomeOwnership=descriptors.codexHomeOwnership?.value;
  if(codexHomeOwnership!==undefined&&codexHomeOwnership!=='ephemeral-owned'&&codexHomeOwnership!=='retained-authorized')throw Error('invalid_executor_home_ownership');
  if (verificationMode !== undefined && verificationMode !== 'approved-existing-file-change') throw Error('invalid_executor_verification_mode');
  let approvedExistingTargets: readonly Readonly<{ relativePath: string; maxBytes: number }>[] | undefined;
  if (descriptors.approvedExistingTargets !== undefined) {
    const raw = descriptors.approvedExistingTargets.value;
    if (!Array.isArray(raw) || types.isProxy(raw) || Object.getPrototypeOf(raw)!==Array.prototype) throw Error('invalid_executor_targets');
    const arrayDescriptors=Object.getOwnPropertyDescriptors(raw),length=Object.getOwnPropertyDescriptor(raw,'length');
    if(!length||!Object.hasOwn(length,'value')||!Number.isSafeInteger(length.value)||length.value<1||length.value>64||Reflect.ownKeys(arrayDescriptors).length!==length.value+1)throw Error('invalid_executor_targets');
    const captured:Readonly<{relativePath:string;maxBytes:number}>[]=[];
    for(let index=0;index<length.value;index+=1){const slot=arrayDescriptors[String(index)];if(!slot?.enumerable||!Object.hasOwn(slot,'value'))throw Error('invalid_executor_target');const item=slot.value;
      const target = own(item, 'target');
      const keys = Object.keys(target);
      if (keys.length !== 2 || !keys.includes('relativePath') || !keys.includes('maxBytes')) throw Error('invalid_executor_target');
      const maxBytes=value(target, 'maxBytes', 'target_bytes');
      if(typeof maxBytes!=='number')throw Error('invalid_executor_target');
      captured.push(Object.freeze({ relativePath: text(value(target, 'relativePath', 'target_path'), 'target_path', 4096), maxBytes: bounded(maxBytes, 16 * 1024 * 1024) }));}
    approvedExistingTargets = Object.freeze(captured);
  }
  if ((verificationMode === undefined) !== (approvedExistingTargets === undefined)) throw Error('invalid_executor_target_mode');
  return Object.freeze({
    codexHome: text(value(descriptors, 'codexHome', 'codex_home'), 'codex_home', 4096),
    ...(codexHomeOwnership===undefined?{}:{codexHomeOwnership}),
    goal: text(value(descriptors, 'goal', 'goal'), 'goal', 1_048_576),
    ...(optionalBound('requestTimeoutMs') === undefined ? {} : { requestTimeoutMs: optionalBound('requestTimeoutMs') }),
    ...(optionalBound('runTimeoutMs') === undefined ? {} : { runTimeoutMs: optionalBound('runTimeoutMs') }),
    ...(controllerArgs === undefined ? {} : { controllerArgs }),
    ...(verificationMode === undefined ? {} : { verificationMode, approvedExistingTargets }),
  });
}

/** Attach this function as HostCandidate.launch. The host must separately provide
 * current subject/evidence, qualification, authorization and cleanup observers.
 * No synthetic qualification or credential discovery is supplied here. */
type CodexExecutorHost = {
  db: Ledger;
  binary: string;
  model: string;
  tool: Readonly<{ id: string; revision: string }>;
  resolveBinding(context: RuntimeContext): AttemptBinding & { options: Omit<HostCodexRuntimeOptions, 'binary' | 'model' | 'onEvent'> };
  launch?: typeof launchHostCodexRun;
  onActivity?: (input: Readonly<{ attemptId: string; taskId: string; ordinal: number; event: unknown }>) => void | Promise<void>;
  activityTimeoutMs?: number;
};

function codexExecutor(host: CodexExecutorHost, expectedRole: RuntimeContext['role'], readOnly: boolean): (context: RuntimeContext) => Promise<CodexExecution> {
  const hostInput = own(host, 'host');
  const binary = text(value(hostInput, 'binary', 'binary'), 'binary', 4096), model = text(value(hostInput, 'model', 'model'), 'model');
  const toolInput = own(value(hostInput, 'tool', 'tool'), 'tool');
  const tool=Object.freeze({id:text(value(toolInput,'id','tool_id'),'tool_id'),revision:text(value(toolInput,'revision','tool_revision'),'tool_revision')});
  const launchInput = hostInput.launch?.value;
  if (launchInput !== undefined && typeof launchInput !== 'function') throw Error('invalid_executor_launch');
  const launch = (launchInput ?? launchHostCodexRun) as typeof launchHostCodexRun;
  const resolveBinding = value(hostInput, 'resolveBinding', 'resolve_binding');
  if (typeof resolveBinding !== 'function') throw Error('invalid_executor_resolve_binding');
  const onActivity = hostInput.onActivity?.value;
  if (onActivity !== undefined && typeof onActivity !== 'function') throw Error('invalid_executor_activity');
  const activityTimeoutMs = hostInput.activityTimeoutMs === undefined ? 1_000 : bounded(hostInput.activityTimeoutMs.value, 5_000);
  const db = value(hostInput, 'db', 'db') as Ledger;
  return async context => {
    if (context.role !== expectedRole) throw Error('codex_executor_role_mismatch');
    context.signal.throwIfAborted();
    const resolved = resolveBinding(context) as AttemptBinding & { options: Omit<HostCodexRuntimeOptions, 'binary' | 'model' | 'onEvent'> };
    const bound = binding(context, resolved);
    const resolvedInput = own(resolved, 'binding');
    const baseOptions = runtimeOptions(value(resolvedInput, 'options', 'options'));
    if (readOnly && (bound.envelope.allowed_actions.length !== 0 || bound.envelope.egress.length !== 0)) throw Error('codex_verifier_write_authority');
    let activityOrdinal = 0;
    let activityFailed = false;
    let acceptingActivity = true;
    let observedUsage = false;
    let observedUsageTotal: number | undefined;
    let stopAfterActivityFailure = (): void => {};
    const pendingActivity = new Set<Promise<void>>();
    const failActivity = (): void => { activityFailed = true; stopAfterActivityFailure(); };
    const track = (invoke: () => void | Promise<void>): void => {
      if (pendingActivity.size >= 256) { failActivity(); return; }
      let returned: void | Promise<void>;
      try { returned = invoke(); }
      catch { failActivity(); return; }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('codex_executor_activity_timeout')), activityTimeoutMs); timer.unref?.(); });
      const observed = Promise.race([Promise.resolve(returned), timeout]).then(
        () => undefined,
        () => { failActivity(); },
      ).finally(() => { if (timer) clearTimeout(timer); });
      pendingActivity.add(observed);
      void observed.finally(() => pendingActivity.delete(observed));
    };
    const emit = (kind: Parameters<NonNullable<RuntimeContext['emitActivity']>>[0], data: Readonly<Record<string, unknown>>, event?: unknown): void => {
      if (!acceptingActivity) return;
      const ordinal = ++activityOrdinal;
      if (event !== undefined && onActivity) track(() => onActivity(Object.freeze({ attemptId: context.runId, taskId: bound.owner.task_id, ordinal, event })));
      if (context.emitActivity) track(() => context.emitActivity!(kind, data));
    };
    const options: HostCodexRuntimeOptions = Object.freeze({ ...baseOptions, binary, model, runtimeRole:expectedRole, ...(readOnly ? { verificationMode: 'read-only-result' as const } : {}),
      ...((onActivity || context.emitActivity) ? { onEvent: (event: Parameters<NonNullable<HostCodexRuntimeOptions['onEvent']>>[0]) => {
        if (event.kind === 'input') emit('progress',{summary:`host-rpc-ack-only:${event.method}:${event.sha256}:${event.byteLength}`,progress:0},event);
        else if (event.kind === 'tool') emit('tool',{toolId:tool.id,toolRevision:tool.revision,callRef:event.callRef,status:event.status},event);
        else if (event.kind === 'output') emit('output',{contentRef:event.contentRef,sha256:event.sha256,byteLength:event.byteLength,truncated:event.truncated},event);
        else if (event.kind === 'artifact') emit('artifact',{kind:event.artifactKind,sourceRef:event.sourceRef,sha256:event.sha256,byteLength:event.byteLength},event);
        else if (event.kind === 'usage') {
          if (!cancelled && (observedUsageTotal === undefined || event.totalTokens > observedUsageTotal)) {
            const quantity = event.totalTokens - (observedUsageTotal ?? 0);
            observedUsage = true;
            observedUsageTotal = event.totalTokens;
            emit('usage',{unit:'token',quantity,status:'observed'},event);
          }
        }
        else emit('terminal',{status:event.status,handoffRef:'unknown'},event);
      } } : {}) });
    let backend: RunningHostCodexRun | undefined;
    let cancelled = false;
    let stopping: Promise<void> | undefined;
    const cancel = (): Promise<void> => {
      cancelled = true;
      if (!backend) return Promise.resolve();
      if (!stopping) {
        stopping = Promise.resolve();
        try { backend.stop(); emit('cancel', { status: 'client-cancel-acknowledged' }); }
        catch { stopping = Promise.reject(new Error('codex_executor_stop_failed')); }
        void stopping.catch(() => {});
      }
      return stopping;
    };
    stopAfterActivityFailure = () => { void cancel().catch(() => {}); };
    const onAbort = () => { void cancel().catch(() => {}); };
    context.signal.addEventListener('abort', onAbort, { once: true });
    try {
      context.signal.throwIfAborted();
      backend = launch(db, bound.owner, bound.envelope, options);
      emit('heartbeat',{status:'alive'});
      if (activityFailed || cancelled || context.signal.aborted) void cancel().catch(() => {});
      const owned = backend;
      // Preserve full backend result for host receipt verification, never log stderr/secrets.
      const result = owned.done;
      const mode=options.verificationMode??'workspace-change';
      const runtimeReceipt:Promise<string|null>=(mode==='approved-existing-file-change'||mode==='read-only-result')?result.then(value=>{
        const lineage=db.prepare('SELECT a.run_id,a.task_id,a.candidate_id,l.expected_subject_digest FROM orchestration_attempt a JOIN orchestration_launch_intent l ON l.attempt_id=a.attempt_id WHERE a.attempt_id=?').get(context.runId) as {run_id:string;task_id:string;candidate_id:string;expected_subject_digest:string}|undefined;
        if(!lineage||lineage.candidate_id!==context.candidateId||lineage.expected_subject_digest!==context.subjectDigest)throw Error('codex_executor_runtime_receipt_binding');
        return createNativeRuntimeReceiptStore(db).recordIssued(value,Object.freeze({runId:lineage.run_id,taskId:lineage.task_id,attemptId:context.runId,candidateId:context.candidateId,subjectDigest:context.subjectDigest,sessionHandle:owned.session.handle,role:expectedRole,verificationMode:mode}),Date.now()).ref;
      }):Promise.resolve(null);
      const completion = result.then<ExecutionOutcome, ExecutionOutcome>(async value => {
        const timing = readIssuedHostRuntimeTiming(value, context.runId, owned.session.handle);
        if (timing) emit('progress', { summary: JSON.stringify(timing), progress: 0 });
        if (!observedUsage) emit('usage',{unit:'token',quantity:0,status:'unknown'});
        acceptingActivity = false;
        await Promise.allSettled([...pendingActivity]);
        try{await runtimeReceipt;}catch{return 'failed';}
        const verified = readOnly ? value.goalVerification.reason === 'read_only_result_received' : value.goalVerification.passed;
        return !activityFailed && !cancelled && value.status === 'completed' && !value.failureKind && verified ? 'succeeded' : 'failed';
      }, async () => {
        if (!observedUsage) emit('usage',{unit:'token',quantity:0,status:'unknown'});
        acceptingActivity = false;
        await Promise.allSettled([...pendingActivity]);
        return 'failed' as const;
      }).finally(() => {
        context.signal.removeEventListener('abort', onAbort);
      });
      const handle=owned.session?.handle;
      if(typeof handle!=='string'||!handle||handle.length>120) { await cancel().catch(() => {}); throw Error('codex_executor_durable_identity'); }
      return Object.freeze({ backend: owned, result, runtimeReceipt, completion, cancel, durableRef:`session:${handle}` });
    } catch (error) {
      context.signal.removeEventListener('abort', onAbort);
      // The common runtime marks ownership before invoking launch and retains unknown
      // cleanup for synchronous backend failures, including partial starts.
      throw error;
    }
  };
}

export function createCodexExecutor(host: CodexExecutorHost): (context: RuntimeContext) => Promise<CodexExecution> {
  return codexExecutor(host, 'implementation', false);
}

/** Default production Codex candidate composition. Capability declarations and
 * canonical tool identity are host inputs, never model/event labels. */
export function createDefaultCodexCandidate(host: Parameters<typeof createCodexExecutor>[0] & {
  buildCurrentSubject(): MeasurementSubject;
  evidenceReferences(): unknown;
  availability: 'ready' | 'not-installed' | 'unauthenticated' | 'incompatible';
}) {
  const launch=createCodexExecutor(host);
  return Object.freeze({kind:'agent' as const,supportedRoles:Object.freeze(['implementation'] as const),cancellation:'supported' as const,usage:'supported' as const,
    availability:host.availability,typedActivitySource:'host-codex-controller-v1' as const,durableExecutionRef:'session-handle-v1' as const,
    buildCurrentSubject:host.buildCurrentSubject,evidenceReferences:host.evidenceReferences,launch});
}

/** Read-only Codex verifier composition. The orchestration verifier maps to the
 * runtime model role; its per-attempt envelope must contain no actions or egress. */
export function createCodexVerifierCandidate(host: Parameters<typeof createCodexExecutor>[0] & {
  buildCurrentSubject(): MeasurementSubject;
  evidenceReferences(): unknown;
  availability: 'ready' | 'not-installed' | 'unauthenticated' | 'incompatible';
}) {
  const launch=codexExecutor(host,'model',true);
  return Object.freeze({kind:'agent' as const,supportedRoles:Object.freeze(['model'] as const),cancellation:'supported' as const,usage:'supported' as const,
    availability:host.availability,typedActivitySource:'host-codex-controller-v1' as const,durableExecutionRef:'session-handle-v1' as const,
    buildCurrentSubject:host.buildCurrentSubject,evidenceReferences:host.evidenceReferences,launch});
}

export function createLocalModelExecutor(host: {
  request: Omit<LocalModelRequest, 'prompt' | 'signal'>;
  resolveBinding(context: RuntimeContext): AttemptBinding & { prompt: string };
  onEvent(event: Readonly<ExecutorEvent>): void | Promise<void>;
  callbackTimeoutMs?: number;
  maxEvents?: number;
  onActivity?: (input: Readonly<{ attemptId: string; taskId: string; ordinal: number; event: unknown }>) => void | Promise<void>;
}): (context: RuntimeContext) => Promise<AdapterExecution> {
  const request = Object.freeze({ ...host.request });
  text(request.model, 'model'); text(request.endpoint, 'endpoint', 4096);
  const callbackTimeoutMs = bounded(host.callbackTimeoutMs ?? 1000, 5000);
  const maxEvents = bounded(host.maxEvents ?? 4096, 65_536);
  const onEvent = host.onEvent;
  return async context => {
    if (context.role !== 'model') throw Error('local_executor_role_mismatch');
    context.signal.throwIfAborted();
    const resolved = host.resolveBinding(context); const bound = binding(context, resolved);
    const prompt = text(resolved.prompt, 'prompt', 1_048_576);
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    context.signal.addEventListener('abort', onAbort, { once: true });
    if (context.signal.aborted) controller.abort();
    const cancel = async () => { controller.abort(); };
    const completion = (async (): Promise<ExecutionOutcome> => {
      let terminal: Extract<LocalModelEvent, { type: 'terminal' }> | undefined;
      let ordinal = 0;
      try {
        for await (const event of streamLocalModel({ ...request, prompt, signal: controller.signal })) {
          if (++ordinal > maxEvents || (event.type === 'text' && Buffer.byteLength(event.text) > 65_536)) throw Error('executor_callback_limit');
          const message = Object.freeze({ attemptId: context.runId, taskId: bound.owner.task_id,
            candidateId: context.candidateId, model: request.model, ordinal, event });
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            // A deadline bounds this transport's wait, not arbitrary host callback
            // side effects. Host sinks must fence late writes by attempt/ordinal.
            await Promise.race([
              Promise.resolve().then(async () => { const safe=safeLocalActivity(event); await onEvent(message); await host.onActivity?.({ attemptId: context.runId, taskId: bound.owner.task_id, ordinal, event: safe }); await context.emitActivity?.(safe.kind as any,safeData(safe)); }),
              new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('executor_callback_timeout')), callbackTimeoutMs); }),
            ]);
          } finally { if (timer) clearTimeout(timer); }
          controller.signal.throwIfAborted();
          if (event.type === 'terminal') terminal = event;
        }
        return !controller.signal.aborted && terminal?.status === 'completed' ? 'succeeded' : 'failed';
      } catch {
        controller.abort();
        return 'failed';
      } finally {
        context.signal.removeEventListener('abort', onAbort);
        controller.abort();
      }
    })();
    // This resolves only the text transport outcome. Provider process stop, final
    // billing and requirement acceptance remain separate host observations.
    return Object.freeze({ completion, cancel });
  };
}

function safeLocalActivity(event: LocalModelEvent): Readonly<Record<string, unknown>> {
  if (event.type === 'text') { const bytes=Buffer.from(event.text,'utf8'); return Object.freeze({ kind:'output', contentRef:'unknown', sha256:Buffer.from(createHash('sha256').update(bytes).digest('hex')).toString(), byteLength:bytes.byteLength, truncated:false }); }
  if (event.type === 'usage') { const known=event.inputTokens!==null&&event.outputTokens!==null; return Object.freeze({ kind:'usage', unit:'token', quantity:known?event.inputTokens!+event.outputTokens!:0, status:known?'observed':'unknown' }); }
  return Object.freeze({ kind:'terminal', status:event.status, handoffRef:'unknown' });
}
function safeData(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> { const {kind:_,...data}=value;return Object.freeze(data); }
