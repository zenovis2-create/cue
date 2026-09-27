import { test, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createIntegrationRuntime } from '../src/integration-runtime.js';
import type { AdapterExecution, CleanupReceipt, ExecutionOutcome, HostCandidate, RuntimeHandle } from '../src/integration-runtime.js';
import type { StartOptions } from '../src/integration-runtime.js';
import { getEventListeners } from 'node:events';
import { WRITE_PROBES, MODEL_PROBES } from '../src/capability-admission.js';
import { SUBJECT_FIELDS, subjectDigest } from '../src/measurement-subject.js';
import type { MeasurementSubject } from '../src/measurement-subject.js';

function fixture() {
  let now = 1000;
  let subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key])) as MeasurementSubject;
  const refs: Record<string, { id: string; sha256: string }> = {};
  const store = new Map<string, Buffer>();
  for (const probe of [...WRITE_PROBES, ...MODEL_PROBES]) {
    const bytes = Buffer.from(JSON.stringify({ probe, subjectDigest: subjectDigest(subject), measuredAt: new Date(999).toISOString(), kind: 'live', status: 'pass' }));
    refs[probe] = { id: probe, sha256: createHash('sha256').update(bytes).digest('hex') }; store.set(probe, bytes);
  }
  let launches = 0; let cancels = 0; let authorized = true;
  let cleanup: CleanupReceipt['result'] = 'unknown';
  let wrongRun = false; let launchFailure = false;
  const completions = new Map<string, (value: ExecutionOutcome) => void>();
  const executions = new Map<string, AdapterExecution>();
  const contexts = new Map<string, any>();
  const lifecycle: any[] = [];
  let lifecycleFailure: string | null = null;
  const candidate: HostCandidate = {
    kind: 'agent', supportedRoles: ['implementation', 'model'], cancellation: 'supported', usage: 'unsupported', availability: 'ready',
    evidenceReferences: () => refs, buildCurrentSubject: () => subject,
    async launch(context) {
      launches++;
      contexts.set(context.runId, context);
      if (launchFailure) throw Error('partial launch');
      const execution = { completion: new Promise<ExecutionOutcome>(resolve => completions.set(context.runId, resolve)), async cancel() { cancels++; } };
      executions.set(context.runId, execution); return execution;
    },
  };
  const runtime = createIntegrationRuntime({
    evidence: { now: () => now, maxAgeMs: 100, resolveEvidence: ref => store.get(ref.id) },
    resolveCandidate: id => id === 'known' ? candidate : undefined,
    authorizeRun: () => authorized,
    recordLifecycle: (_attemptId, event) => {
      if (lifecycleFailure === event.kind) throw Error('synthetic_lifecycle_failure');
      lifecycle.push(event);
    },
    async verifyFailedStartCleanup(context) {
      return { runId: context.runId, subjectDigest: context.subjectDigest, result: cleanup, evidenceRef: 'synthetic-failed-start-observation' };
    },
    async verifyCleanup(context, execution) {
      expect(executions.get(context.runId)).toBe(execution);
      return { runId: wrongRun ? 'other' : context.runId, subjectDigest: context.subjectDigest, result: cleanup, evidenceRef: 'synthetic-host-observation' };
    },
  });
  return { runtime, candidate, refs, store, completions, contexts, lifecycle,
    launches: () => launches, cancels: () => cancels,
    expire: () => { now = 1100; }, drift: () => { subject = { ...subject, adapterSha256: 'b'.repeat(64) }; },
    unauthorized: () => { authorized = false; }, failLaunch: () => { launchFailure = true; },
    failLifecycle: (kind: string) => { lifecycleFailure = kind; },
    cleanup: (value: CleanupReceipt['result'], mismatch = false) => { cleanup = value; wrongRun = mismatch; },
  };
}
async function start(f: ReturnType<typeof fixture>, runId = 'run'): Promise<RuntimeHandle> {
  const result = await f.runtime.start(runId, 'known', 'implementation');
  if (!result.ok) throw Error(result.reason);
  return result.handle;
}
test('unknown, unavailable, unauthorized and unsupported roles never launch', async () => {
  const f = fixture();
  expect(await f.runtime.start('x', 'unknown', 'model')).toMatchObject({ ok: false, reason: 'unknown-candidate' });
  Object.assign(f.candidate, { availability: 'unauthenticated' });
  expect(await f.runtime.start('x', 'known', 'model')).toMatchObject({ ok: false, reason: 'unavailable' });
  Object.assign(f.candidate, { availability: 'ready', kind: 'model' });
  expect(await f.runtime.start('x', 'known', 'implementation')).toMatchObject({ ok: false, reason: 'unsupported-role' });
  f.unauthorized();
  expect(await f.runtime.start('x', 'known', 'model')).toMatchObject({ ok: false, reason: 'unauthorized' });
  expect(f.launches()).toBe(0);
});
test('missing, expired, artifact-drift and current subject-drift deny at launch', async () => {
  for (const mutate of [ (f: ReturnType<typeof fixture>) => { delete f.refs.P1; },
    (f: ReturnType<typeof fixture>) => f.expire(), (f: ReturnType<typeof fixture>) => f.drift(),
    (f: ReturnType<typeof fixture>) => f.store.set('P1', Buffer.from('changed')) ]) {
    const f = fixture(); mutate(f);
    expect(await f.runtime.start('run', 'known', 'implementation')).toMatchObject({ ok: false, reason: 'ineligible', cleanup: 'not-started' });
    expect(f.launches()).toBe(0);
  }
});
test('each new execution rebuilds subject and rechecks fresh eligibility', async () => {
  const f = fixture(); await start(f); f.drift();
  expect(await f.runtime.start('next', 'known', 'implementation')).toMatchObject({ ok: false, reason: 'ineligible' });
  expect(f.launches()).toBe(1);
});
test('model and implementation roles require their own measured vector', async () => {
  const f = fixture(); for (const p of WRITE_PROBES) delete f.refs[p];
  expect(await f.runtime.start('model', 'known', 'model')).toMatchObject({ ok: true });
  expect(await f.runtime.start('writer', 'known', 'implementation')).toMatchObject({ ok: false, reason: 'ineligible' });
  const g = fixture(); for (const p of MODEL_PROBES) delete g.refs[p];
  expect(await g.runtime.start('writer', 'known', 'implementation')).toMatchObject({ ok: true });
  expect(await g.runtime.start('model', 'known', 'model')).toMatchObject({ ok: false, reason: 'ineligible' });
});

test('checker cannot write and requires every current M probe even when declared supported', async () => {
  const f = fixture(); Object.assign(f.candidate, { kind: 'checker' });
  expect(await f.runtime.start('write', 'known', 'implementation')).toMatchObject({ ok: false, reason: 'unsupported-role' });
  expect(f.launches()).toBe(0);
  for (const p of WRITE_PROBES) delete f.refs[p];
  expect(await f.runtime.start('check', 'known', 'model')).toMatchObject({ ok: true });
  for (const probe of MODEL_PROBES) {
    const g = fixture(); Object.assign(g.candidate, { kind: 'checker' }); delete g.refs[probe];
    expect(await g.runtime.start('missing', 'known', 'model')).toMatchObject({ ok: false, reason: 'ineligible' });
    expect(g.launches()).toBe(0);
  }
  f.drift();
  expect(await f.runtime.start('drift', 'known', 'model')).toMatchObject({ ok: false, reason: 'ineligible' });
});
test('cancel acknowledgment does not settle; unknown or residual cleanup remains open', async () => {
  const f = fixture(); const run = await start(f);
  expect(await run.inspectCleanup()).toBe('not-ready');
  expect(await run.cancel()).toBe('requested');
  expect(await run.cancel()).toBe('requested'); expect(f.cancels()).toBe(1);
  expect(f.lifecycle.map(event => event.kind)).toEqual(['cancel-requested', 'client-cancel-acknowledged']);
  expect(run.snapshot()).toMatchObject({ phase: 'cancel-requested', cancellation: 'acknowledged', cleanup: 'unmeasured', outcome: 'unknown' });
  expect(await run.inspectCleanup()).toBe('unknown');
  f.cleanup('residual'); expect(await run.inspectCleanup()).toBe('residual');
  expect(run.snapshot().phase).toBe('cancel-requested');
  f.cleanup('verified-clean'); expect(await run.inspectCleanup()).toBe('verified-clean');
  expect(run.snapshot()).toMatchObject({ phase: 'settled', outcome: 'unknown' });
});
test('explicit synthetic provider evidence is forwarded while completion invents no provider fact', async () => {
  const f = fixture(); const run = await start(f);
  await f.contexts.get('run').emitLifecycle({ kind: 'provider-terminal', data: { status: 'succeeded', receiptDigest: 'b'.repeat(64) },
    references: [{ refType: 'turn', label: 'provider-turn', reference: 'opaque-turn-reference' }] });
  f.completions.get('run')!('succeeded'); await Promise.resolve();
  expect(f.lifecycle).toHaveLength(1);
  expect(f.lifecycle[0]).toMatchObject({ kind: 'provider-terminal', data: { status: 'succeeded' } });
  expect(run.snapshot()).toMatchObject({ outcome: 'succeeded', cleanup: 'unmeasured' });
});
test('adapter lifecycle seam rejects forged internal kinds and hostile inputs', async () => {
  const f = fixture(); await start(f); const emit = f.contexts.get('run').emitLifecycle;
  await expect(emit({ kind: 'cleanup-observed', data: { status: 'clean', receiptDigest: 'b'.repeat(64) } })).rejects.toThrow('runtime_lifecycle_input');
  await expect(emit(new Proxy({ kind: 'provider-terminal', data: {} }, {}))).rejects.toThrow('runtime_lifecycle_input');
  const accessor: any = { kind: 'provider-terminal', data: {} };
  Object.defineProperty(accessor, 'kind', { enumerable: true, get() { throw Error('getter'); } });
  await expect(emit(accessor)).rejects.toThrow('runtime_lifecycle_input');
  const references: any[] = [];
  Object.defineProperty(references, '0', { enumerable: true, get() { throw Error('reference-getter'); } });
  references.length = 1;
  await expect(emit({ kind: 'provider-terminal', data: { status: 'succeeded', receiptDigest: 'b'.repeat(64) }, references })).rejects.toThrow('runtime_lifecycle_input');
  expect(f.lifecycle).toEqual([]);
});
test('lifecycle callback failure fails cancellation and clean settlement closed', async () => {
  const f = fixture(); const run = await start(f); f.failLifecycle('cancel-requested');
  expect(await run.cancel()).toBe('failed');
  expect(run.snapshot()).toMatchObject({ phase: 'cancel-requested', cancellation: 'failed' });
  f.cleanup('verified-clean'); expect(await run.inspectCleanup()).toBe('unknown');
  expect(run.snapshot().phase).not.toBe('settled');
});
test('successful execution still requires independent, run-bound cleanup', async () => {
  const f = fixture(); const run = await start(f);
  f.completions.get('run')!('succeeded'); await Promise.resolve();
  expect(run.snapshot()).toMatchObject({ phase: 'awaiting-cleanup', outcome: 'succeeded', cleanup: 'unmeasured' });
  f.cleanup('verified-clean', true); expect(await run.inspectCleanup()).toBe('unknown');
  expect(run.snapshot().phase).toBe('awaiting-cleanup');
  f.cleanup('verified-clean'); expect(await run.inspectCleanup()).toBe('verified-clean');
  expect(await run.cancel()).toBe('settled'); expect(f.cancels()).toBe(0);
});
test('unsupported cancellation is explicit and leaves active run intact', async () => {
  const f = fixture(); Object.assign(f.candidate, { cancellation: 'unsupported' });
  const run = await start(f);
  expect(run.capabilities).toEqual({ cancellation: 'unsupported', usage: 'unsupported' });
  expect(await run.cancel()).toBe('unsupported'); expect(f.cancels()).toBe(0);
  expect(run.snapshot().phase).toBe('running');
});
test('run ownership isolates completion, cancellation and cleanup; IDs cannot launch twice', async () => {
  const f = fixture(); const one = await start(f, 'one'); const two = await start(f, 'two');
  expect(await f.runtime.start('one', 'known', 'implementation')).toMatchObject({ ok: false, reason: 'duplicate-run' });
  await one.cancel(); f.cleanup('verified-clean'); await one.inspectCleanup();
  expect(two.snapshot()).toMatchObject({ phase: 'running', cancellation: 'not-requested', cleanup: 'unmeasured' });
  f.completions.get('one')!('succeeded'); await Promise.resolve();
  expect(one.snapshot()).toMatchObject({ phase: 'settled', outcome: 'unknown' });
  expect(f.launches()).toBe(2); expect(Object.isFrozen(one.context)).toBe(true);
});
test('launch failure conservatively keeps cleanup unknown and disallows duplicate retry', async () => {
  const f = fixture(); f.failLaunch();
  expect(await f.runtime.start('run', 'known', 'implementation')).toMatchObject({ ok: false, reason: 'launch-failed', cleanup: 'unknown' });
  expect(await f.runtime.start('run', 'known', 'implementation')).toMatchObject({ ok: false, reason: 'duplicate-run' });
  expect(f.launches()).toBe(1);
});
test('pre-aborted or invalid bounded start never invokes launch', async () => {
  const f = fixture(); const controller = new AbortController(); controller.abort();
  expect(await f.runtime.start('run', 'known', 'implementation', { signal: controller.signal })).toMatchObject({ ok: false, reason: 'aborted', cleanup: 'not-started' });
  for (const timeoutMs of [0, -1, Infinity, 120001]) {
    expect(await f.runtime.start('run', 'known', 'implementation', { timeoutMs })).toMatchObject({ ok: false, reason: 'invalid-request' });
  }
  expect(f.launches()).toBe(0);
});
test('hung launch times out with retained ownership and cannot claim clean while pending', async () => {
  vi.useFakeTimers();
  try {
    const f = fixture(); let signal: AbortSignal | undefined;
    f.candidate.launch = context => { signal = context.signal; return new Promise(() => {}); };
    const pending = f.runtime.start('run', 'known', 'implementation', { timeoutMs: 10 });
    await vi.advanceTimersByTimeAsync(10);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, reason: 'launch-timeout', cleanup: 'unknown' });
    if (result.ok || !result.handle) throw Error('missing recovery handle');
    expect(signal?.aborted).toBe(true);
    f.cleanup('verified-clean');
    expect(await result.handle.inspectCleanup()).toBe('unknown');
    expect(result.handle.snapshot().phase).not.toBe('settled');
    expect(await f.runtime.start('run', 'known', 'implementation')).toMatchObject({ ok: false, reason: 'duplicate-run' });
  } finally { vi.useRealTimers(); }
});
test('abort during launch returns recovery handle; late resolution is owned and cancelled', async () => {
  const f = fixture(); const original = f.candidate.launch;
  let release!: () => void;
  f.candidate.launch = async context => { await new Promise<void>(resolve => { release = resolve; }); return original(context); };
  const controller = new AbortController();
  const pending = f.runtime.start('run', 'known', 'implementation', { signal: controller.signal });
  controller.abort(); const result = await pending;
  expect(result).toMatchObject({ ok: false, reason: 'aborted', cleanup: 'unknown' });
  if (result.ok || !result.handle) throw Error('missing recovery handle');
  expect(await result.handle.inspectCleanup()).toBe('unknown');
  release(); await vi.waitFor(() => expect(f.cancels()).toBe(1));
  expect(result.handle.snapshot().phase).not.toBe('settled');
  f.cleanup('verified-clean'); expect(await result.handle.inspectCleanup()).toBe('verified-clean');
});
test('abort after returned handle cancels the same execution without declaring completion', async () => {
  const f = fixture(); const controller = new AbortController();
  const result = await f.runtime.start('run', 'known', 'implementation', { signal: controller.signal });
  if (!result.ok) throw Error(result.reason);
  controller.abort(); await vi.waitFor(() => expect(f.cancels()).toBe(1));
  expect(result.handle.context.signal.aborted).toBe(true);
  expect(result.handle.snapshot()).toMatchObject({ phase: 'cancel-requested', cleanup: 'unknown', outcome: 'unknown' });
});
test('late launch rejection is observed and preserves unknown cleanup', async () => {
  const f = fixture(); let reject!: (reason: Error) => void;
  f.candidate.launch = () => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; });
  const controller = new AbortController();
  const pending = f.runtime.start('run', 'known', 'implementation', { signal: controller.signal });
  controller.abort(); const result = await pending;
  if (result.ok || !result.handle) throw Error('missing recovery handle');
  reject(Error('late failure')); await Promise.resolve();
  expect(result.handle.snapshot()).toMatchObject({ phase: 'awaiting-cleanup', cleanup: 'unknown' });
  expect(await result.handle.inspectCleanup()).toBe('unknown');
  f.cleanup('verified-clean');
  expect(await result.handle.inspectCleanup()).toBe('verified-clean');
});
test('invalid late control handle consumes rejected completion and retains cleanup ownership', async () => {
  const f = fixture();
  f.candidate.launch = async () => ({ completion: Promise.reject(Error('invalid control failed')), cancel: undefined } as unknown as AdapterExecution);
  const result = await f.runtime.start('run', 'known', 'implementation');
  expect(result).toMatchObject({ ok: false, reason: 'launch-failed', cleanup: 'unknown' });
  if (result.ok || !result.handle) throw Error('missing recovery handle');
  expect(await result.handle.inspectCleanup()).toBe('unknown');
});
test('malformed options are denied without invoking getters or proxy traps', async () => {
  const f = fixture(); let reads = 0;
  const accessor = Object.defineProperty({}, 'timeoutMs', { enumerable: true, get() { reads++; throw Error('getter'); } });
  const proxy = new Proxy({}, { getPrototypeOf() { reads++; throw Error('proxy'); } });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  const forgedSignal = Object.create(AbortSignal.prototype);
  for (const options of [null, [], accessor, proxy, revoked.proxy, { unknown: true }, { timeoutMs: null },
    { signal: forgedSignal }, { signal: new Proxy(new AbortController().signal, {}) }, Object.create({ timeoutMs: 10 })]) {
    expect(await f.runtime.start('run', 'known', 'model', options as StartOptions)).toMatchObject({ ok: false, reason: 'invalid-request', cleanup: 'not-started' });
  }
  expect(reads).toBe(0); expect(f.launches()).toBe(0);
});
test('mutating original options cannot replace cancellation signal or leak listener on settlement', async () => {
  const f = fixture(); const original = new AbortController(); const replacement = new AbortController();
  const options = { signal: original.signal, timeoutMs: 1000 };
  const result = await f.runtime.start('run', 'known', 'implementation', options);
  if (!result.ok) throw Error(result.reason);
  expect(getEventListeners(original.signal, 'abort')).toHaveLength(1);
  options.signal = replacement.signal; options.timeoutMs = 1;
  replacement.abort();
  expect(result.handle.snapshot().phase).toBe('running');
  f.completions.get('run')!('succeeded'); await Promise.resolve();
  f.cleanup('verified-clean'); await result.handle.inspectCleanup();
  expect(getEventListeners(original.signal, 'abort')).toHaveLength(0);
  expect(result.handle.snapshot().phase).toBe('settled');
});
