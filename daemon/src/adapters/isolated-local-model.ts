import { matchesModelControlObservation, snapshotModelControlBundle, type ModelControlBundle } from '../model-control-bundle.js';
import { commitNativeIdentity, snapshotNativeIdentityBases, waitNativeResult } from './native-identity-commit.js';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { AdapterExecution, RuntimeContext, ExecutionOutcome } from '../integration-runtime.js';
import type { AttemptBinding } from './integration-executors.js';
import { readLocalModelHttpFailure, streamLocalModel, type LocalModelEvent } from './local-model.js';
import { spawnOwnedPiped } from '../process-launch.js';
import type { Ledger } from '../ledger.js';
import type { SessionRecord } from '../session-spawn.js';
import type { HostFailureDiagnosticCode } from '../orchestration/failure-diagnostic.js';

const PROTOCOL = 'cue-model-broker-v1';
export const ISOLATED_LOCAL_MODEL = 'qwen38-27b-unc';
export const ISOLATED_LOCAL_ENDPOINT = 'http://127.0.0.1:8085/v1';
const MAX = 1_048_576;
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(value);
function bound(value: number, max: number) { if (!Number.isSafeInteger(value) || value < 1 || value > max) throw Error('broker_invalid_bound'); return value; }
type Terminal = Extract<LocalModelEvent, { type: 'terminal' }>;
type Usage = Omit<Extract<LocalModelEvent, { type: 'usage' }>, 'type'>;
class BrokerFailure extends Error { constructor(readonly diagnosticCode: HostFailureDiagnosticCode) { super('broker-failure'); } }
const brokerFail = (code: HostFailureDiagnosticCode): never => { throw new BrokerFailure(code); };
export interface IsolatedModelResult {
  readonly outcome: ExecutionOutcome;
  readonly attemptId: string;
  readonly requestId: string;
  readonly text: string | null;
  readonly usage: Usage | null;
  readonly terminal: Terminal | null;
  readonly observations: Readonly<Record<string, unknown>>;
  readonly cleanup: 'unknown';
  readonly providerStopped: 'unknown';
  readonly identityRef?: string | null;
  readonly diagnosticCode?: HostFailureDiagnosticCode;
}
export interface IsolatedModelExecution extends AdapterExecution { readonly result: Promise<IsolatedModelResult>; readonly session: Readonly<SessionRecord> }

/** Host-only composition. Admission/cleanup remain independent. The transport
 * override is a trusted test seam; no endpoint/model override exists in requests. */
export function createIsolatedLocalModelExecutor(host: {
  db: Ledger; controlBundle: ModelControlBundle; taskRootBase: string; profileRootBase: string;
  nodeExecutable: string; nodeSha256: string;
  resolveBinding(context: RuntimeContext): AttemptBinding & { prompt: string };
  timeoutMs?: number; maxOutputTokens?: number; maxRequestBytes?: number; maxResultBytes?: number;
  transport?: typeof streamLocalModel;
}): (context: RuntimeContext) => Promise<IsolatedModelExecution> {
  const timeoutMs = bound(host.timeoutMs ?? 30000, 30000);
  if (timeoutMs < 100 || !/^[a-fA-F0-9]{64}$/.test(host.nodeSha256) || typeof host.nodeExecutable !== 'string' || !host.nodeExecutable) throw Error('broker_invalid_host');
  const maxOutputTokens = bound(host.maxOutputTokens ?? 512, 32768);
  const maxRequestBytes = bound(host.maxRequestBytes ?? MAX, MAX), maxResultBytes = bound(host.maxResultBytes ?? MAX, MAX);
  const nodeExecutable = host.nodeExecutable, nodeSha256 = host.nodeSha256, transport = host.transport ?? streamLocalModel;
  const controlBundle = snapshotModelControlBundle(host.controlBundle, 'model', host.nodeSha256);
  const identityBases = snapshotNativeIdentityBases(host);
  return async context => {
    if (host.db.inTransaction) throw Error('native_identity_outer_transaction');
    context.signal.throwIfAborted();
    const binding = host.resolveBinding(context);
    if (process.platform !== 'win32' || context.role !== 'model' || !id(context.runId) || !id(binding.owner.task_id)
        || binding.owner.run_id !== context.runId || binding.envelope.run_id !== context.runId
        || binding.owner.cwd !== binding.envelope.worktree_realpath || typeof binding.prompt !== 'string' || !binding.prompt.trim()) throw Error('broker_binding_mismatch');
    const requestId = randomUUID();
    const request = Object.freeze({ protocol: PROTOCOL, type: 'generate', requestId, attemptId: context.runId,
      model: ISOLATED_LOCAL_MODEL, prompt: binding.prompt, maxOutputTokens, maxResultBytes });
    const requestText = JSON.stringify(request);
    if (Buffer.byteLength(requestText) > maxRequestBytes) throw Error('broker_request_limit');
    const controller = new AbortController();
    const metadata = { broker: true, controlBundle, nodeExecutable, nodeSha256, parentPid: process.pid, timeoutMs, maxRequestBytes, maxResultBytes };
    const executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const { child, session } = spawnOwnedPiped(host.db, binding.owner, executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
      fileURLToPath(new URL('../model-only-launch.ps1', import.meta.url)), '-PayloadBase64', Buffer.from(JSON.stringify(metadata)).toString('base64')]);
    let failed = false, requested = false, returned = false, closed = false, pending = '', totalBytes = 0;
    let diagnosticCode: HostFailureDiagnosticCode | null = null;
    let expectedReply: Record<string, unknown> | null = null;
    let answerText: string | null = null, answerUsage: Usage | null = null, terminal: Terminal | null = null;
    const observations: Record<string, unknown> = {};
    let identityRef: string | null = null;
    const stop = (code: HostFailureDiagnosticCode = 'unknown') => {
      diagnosticCode ??= code;
      failed = true; controller.abort(); child.stdin.destroy(); if (!closed) child.kill();
    };
    const onAbort = () => stop('cancelled'); context.signal.addEventListener('abort', onAbort, { once: true });
    if (context.signal.aborted) stop('cancelled');
    const timer = setTimeout(() => stop('deadline-exceeded'), timeoutMs);
    const brokerFailure = (error: unknown) => {
      if (error instanceof BrokerFailure) stop(error.diagnosticCode);
      else if (readLocalModelHttpFailure(error)) stop(readLocalModelHttpFailure(error)!);
      else if (!controller.signal.aborted) stop('transport-failed');
      else stop();
    };
    async function broker() {
      let text = '', textBytes = 0, count = 0;
      let usage: Usage = { inputTokens: null, outputTokens: null, totalTokens: null };
      let end: Terminal | null = null;
      for await (const event of transport({ endpoint: ISOLATED_LOCAL_ENDPOINT, model: ISOLATED_LOCAL_MODEL, prompt: request.prompt,
        maxOutputTokens, maxResponseBytes: MAX * 8, timeoutMs, signal: controller.signal })) {
        controller.signal.throwIfAborted();
        if (++count > 65536 || end) brokerFail('protocol-invalid');
        if (event.type === 'text') { textBytes += Buffer.byteLength(event.text); if (textBytes > maxResultBytes) brokerFail('output-limit'); text += event.text; }
        else if (event.type === 'usage') { usage = { inputTokens: event.inputTokens, outputTokens: event.outputTokens, totalTokens: event.totalTokens }; }
        else if (event.type === 'terminal') end = Object.freeze({ ...event });
        else brokerFail('protocol-invalid');
      }
      controller.signal.throwIfAborted();
      if (!end) brokerFail('protocol-invalid');
      expectedReply = { protocol: PROTOCOL, type: 'model_response', requestId, attemptId: context.runId,
        model: ISOLATED_LOCAL_MODEL, text, usage, terminal: end };
      const response = JSON.stringify(expectedReply);
      if (Buffer.byteLength(response) > maxResultBytes) brokerFail('output-limit');
      answerText = text; answerUsage = Object.freeze(usage); terminal = end;
      child.stdin.end(Buffer.from(response).toString('base64') + '\n');
    }
    function line(value: string) {
      if (failed) return;
      if (value.startsWith('CUE_MODEL_FRAME=')) {
        const encoded = value.slice(16);
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw Error('broker_frame_encoding');
        const bytes = Buffer.from(encoded, 'base64');
        if (bytes.length > Math.max(maxRequestBytes, maxResultBytes) || bytes.toString('base64') !== encoded) throw Error('broker_frame_limit');
        const frame = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        if (!requested) {
          if (JSON.stringify(frame) !== JSON.stringify({ ...request, type: 'model_request' })) throw Error('broker_request_identity');
          try { identityRef = commitNativeIdentity(host.db, context, session, controlBundle, observations, identityBases); }
          catch { stop('native-boundary-unverified'); return; }
          context.signal.throwIfAborted(); controller.signal.throwIfAborted();
          requested = true; void broker().catch(brokerFailure);
        } else {
          if (returned || !expectedReply || JSON.stringify(frame) !== JSON.stringify({ ...expectedReply, type: 'model_result' })) throw Error('broker_result_identity');
          returned = true;
        }
      } else {
        const match = /^(CUE_MODEL_(?:HOST_IDENTITY|GUARDIAN_PID|BOUNDARY|OBSERVATION|PID|PROCESS_LIMIT|STOP_REASON|EXIT|CLEANUP|RESPONSE))=(.*)$/.exec(value);
        if (!match || Object.hasOwn(observations, match[1]!)) throw Error('broker_unexpected_native_output');
        const key = match[1]!, raw = match[2]!;
        observations[key] = raw.startsWith('{') ? JSON.parse(raw) : raw;
      }
    }
    child.stdout.on('data', (chunk: Buffer) => {
      if (failed) return;
      try {
        totalBytes += chunk.length; if (totalBytes > 3 * MAX + 65536) throw Error('broker_total_output_limit');
        pending += chunk.toString('utf8'); if (Buffer.byteLength(pending) > 2 * MAX) throw Error('broker_output_line_limit');
        let end; while ((end = pending.indexOf('\n')) >= 0) { const value = pending.slice(0, end).replace(/\r$/, ''); pending = pending.slice(end + 1); line(value); }
      } catch { stop('protocol-invalid'); }
    });
    child.stderr.on('data', () => stop('native-io-failed')); child.stdin.on('error', () => stop('native-io-failed')); child.on('error', () => stop('native-io-failed'));
    const result = new Promise<IsolatedModelResult>(resolve => {
      child.on('close', code => {
        closed = true;
        clearTimeout(timer); context.signal.removeEventListener('abort', onAbort); controller.abort();
        const native = observations.CUE_MODEL_OBSERVATION as { status?: string } | undefined;
        const cleanup = observations.CUE_MODEL_CLEANUP as { taskRootAbsent?: boolean; profileAbsent?: boolean } | undefined;
        const pinned = matchesModelControlObservation(controlBundle, observations.CUE_MODEL_BOUNDARY);
        const success = identityRef !== null && pinned && closed && !failed && !pending && code === 0 && returned && terminal?.status === 'completed'
          && native?.status === 'observed' && cleanup?.taskRootAbsent === true && cleanup.profileAbsent === true && observations.CUE_MODEL_EXIT === '0';
        if (!success && diagnosticCode === null) {
          diagnosticCode = identityRef === null || !pinned || native?.status !== 'observed' ? 'native-boundary-unverified'
            : pending || !returned ? 'protocol-invalid'
            : terminal?.status !== 'completed' ? 'terminal-incomplete'
            : cleanup?.taskRootAbsent !== true || cleanup.profileAbsent !== true ? 'cleanup-unverified'
            : code !== 0 || observations.CUE_MODEL_EXIT !== '0' ? 'native-exit-failed' : 'unknown';
        }
        resolve(Object.freeze({ outcome: success ? 'succeeded' : 'failed', attemptId: context.runId, requestId,
          text: returned ? answerText : null, usage: returned ? answerUsage : null, terminal: returned ? terminal : null,
          observations: Object.freeze({ ...observations }), identityRef, cleanup: 'unknown', providerStopped: 'unknown',
          ...(!success ? { diagnosticCode: diagnosticCode! } : {}) }));
      });
    });
    child.stdin.write(Buffer.from(requestText).toString('base64') + '\n');
    return Object.freeze({ result, session: Object.freeze(session), completion: result.then(value => value.outcome), cancel: async () => { stop('cancelled'); await waitNativeResult(result); } });
  };
}
