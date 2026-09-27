import { matchesModelControlObservation, snapshotModelControlBundle, type ModelControlBundle } from '../model-control-bundle.js';
import { commitNativeIdentity, snapshotNativeIdentityBases, waitNativeResult } from './native-identity-commit.js';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { types } from 'node:util';
import type { AdapterExecution, RuntimeContext, ExecutionOutcome } from '../integration-runtime.js';
import type { AttemptBinding } from './integration-executors.js';
import type { IsolatedModelResult, IsolatedModelExecution } from './isolated-local-model.js';
import type { JsonFormatVerdict } from '../verification/json-format-checker.cjs';
import { spawnOwnedPiped } from '../process-launch.js';
import type { Ledger } from '../ledger.js';
import type { SessionRecord } from '../session-spawn.js';

const PROTOCOL = 'cue-json-checker-v1', CONTRACT = 'cue-json-format-v1', MAX = 1_048_576;
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(v);
const sha = (v: Uint8Array) => createHash('sha256').update(v).digest('hex');
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
const offsetOf = Object.getOwnPropertyDescriptor(typed, 'byteOffset')!.get!;
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!;
export interface IsolatedJsonCheckerResult extends IsolatedModelResult { readonly checkerVerdict: Readonly<JsonFormatVerdict> | null }
export interface IsolatedJsonCheckerExecution extends IsolatedModelExecution { readonly result: Promise<IsolatedJsonCheckerResult> }
/** Fixed deterministic computation only. Verdict is separate from execution success.
 * Combined base64 carrier must fit 1 MiB before launch (stricter than individual core limits).
 * No provider, request-supplied path, code, URL or permission input exists. */
export function createIsolatedJsonCheckerExecutor(host: {
  db: Ledger; controlBundle: ModelControlBundle; taskRootBase: string; profileRootBase: string;
  nodeExecutable: string; nodeSha256: string;
  resolveBinding(context: RuntimeContext): AttemptBinding & { inputBytes: Uint8Array; outputBytes: Uint8Array };
  timeoutMs?: number;
}): (context: RuntimeContext) => Promise<IsolatedJsonCheckerExecution> {
  const timeoutMs = host.timeoutMs ?? 30000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000 || !/^[a-fA-F0-9]{64}$/.test(host.nodeSha256) || !host.nodeExecutable) throw Error('checker_invalid_host');
  const nodeExecutable = host.nodeExecutable, nodeSha256 = host.nodeSha256;
  const maxRequestBytes = MAX, maxResultBytes = MAX;
  const controlBundle = snapshotModelControlBundle(host.controlBundle, 'json-checker', host.nodeSha256);
  const identityBases = snapshotNativeIdentityBases(host);
  return async context => {
    if (host.db.inTransaction) throw Error('native_identity_outer_transaction');
    context.signal.throwIfAborted();
    const binding = host.resolveBinding(context);
    if (process.platform !== 'win32' || context.role !== 'model' || !id(context.runId) || !id(binding.owner.task_id)
        || binding.owner.run_id !== context.runId || binding.envelope.run_id !== context.runId
        || binding.owner.cwd !== binding.envelope.worktree_realpath) throw Error('broker_binding_mismatch');
    // Snapshot bytes before any await; caller cannot mutate approved checker input in flight.
    function bytes(value: Uint8Array) {
      if (!types.isUint8Array(value) || types.isProxy(value)) throw Error('checker_invalid_bytes');
      try {
        const buffer = bufferOf.call(value), length = lengthOf.call(value), offset = offsetOf.call(value);
        if (types.isSharedArrayBuffer(buffer) || length > MAX) throw Error();
        return Buffer.from(new Uint8Array(buffer, offset, length));
      } catch { throw Error('checker_invalid_bytes'); }
    }
    const input = bytes(binding.inputBytes), output = bytes(binding.outputBytes);
    const requestId = randomUUID();
    const request = Object.freeze({ protocol: PROTOCOL, type: 'check', contract: CONTRACT, requestId, attemptId: context.runId,
      inputBase64: input.toString('base64'), outputBase64: output.toString('base64') });
    const identity = { protocol: PROTOCOL, type: 'checker_request', contract: CONTRACT, requestId, attemptId: context.runId,
      inputSha256: sha(input), outputSha256: sha(output) };
    const requestText = JSON.stringify(request);
    if (Buffer.byteLength(requestText) > MAX) throw Error('checker_request_limit');
    const controller = new AbortController();
    const metadata = { broker: true, controlBundle, clientKind: 'json-checker', nodeExecutable, nodeSha256, parentPid: process.pid, timeoutMs, maxRequestBytes, maxResultBytes };
    const executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const { child, session } = spawnOwnedPiped(host.db, binding.owner, executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
      fileURLToPath(new URL('../model-only-launch.ps1', import.meta.url)), '-PayloadBase64', Buffer.from(JSON.stringify(metadata)).toString('base64')]);
    let failed = false, requested = false, returned = false, closed = false, pending = '', totalBytes = 0;
    let verdict: Readonly<JsonFormatVerdict> | null = null;
    const observations: Record<string, unknown> = {};
    let identityRef: string | null = null;
    const stop = () => {
      failed = true; controller.abort(); child.stdin.destroy(); if (!closed) child.kill();
    };
    const onAbort = () => stop(); context.signal.addEventListener('abort', onAbort, { once: true });
    if (context.signal.aborted) stop();
    const timer = setTimeout(stop, timeoutMs);
    function line(value: string) {
      if (failed) return;
      if (value.startsWith('CUE_MODEL_FRAME=')) {
        const encoded = value.slice(16);
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw Error('broker_frame_encoding');
        const bytes = Buffer.from(encoded, 'base64');
        if (bytes.length > Math.max(maxRequestBytes, maxResultBytes) || bytes.toString('base64') !== encoded) throw Error('broker_frame_limit');
        const frame = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        if (!requested) {
          if (JSON.stringify(frame) !== JSON.stringify(identity)) throw Error('checker_request_identity');
          identityRef = commitNativeIdentity(host.db, context, session, controlBundle, observations, identityBases);
          context.signal.throwIfAborted(); controller.signal.throwIfAborted();
          requested = true;
          child.stdin.end(Buffer.from(JSON.stringify({ ...identity, type: 'authorize_check' })).toString('base64') + '\n');
        } else {
          if (returned || frame.protocol !== PROTOCOL || frame.type !== 'checker_result' || frame.contract !== CONTRACT
              || frame.requestId !== requestId || frame.attemptId !== context.runId
              || Object.keys(frame).sort().join(',') !== 'attemptId,contract,protocol,requestId,type,verdict') throw Error('checker_result_identity');
          const v = frame.verdict;
          if (!v || Object.keys(v).sort().join(',') !== 'contract,expectedSha256,inputSha256,outputSha256,reason,status'
              || v.contract !== CONTRACT || !['pass', 'fail', 'unknown'].includes(v.status) || typeof v.reason !== 'string' || v.reason.length > 128
              || v.inputSha256 !== identity.inputSha256 || v.outputSha256 !== identity.outputSha256
              || !(v.expectedSha256 === null || (typeof v.expectedSha256 === 'string' && /^[a-f0-9]{64}$/.test(v.expectedSha256)))
              || (v.status !== 'unknown' && v.expectedSha256 === null)) throw Error('checker_verdict_invalid');
          verdict = Object.freeze({ ...v }); returned = true;
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
      } catch { stop(); }
    });
    child.stderr.on('data', stop); child.stdin.on('error', stop); child.on('error', stop);
    const result = new Promise<IsolatedJsonCheckerResult>(resolve => {
      child.on('close', code => {
        closed = true;
        clearTimeout(timer); context.signal.removeEventListener('abort', onAbort); controller.abort();
        const native = observations.CUE_MODEL_OBSERVATION as { status?: string } | undefined;
        const cleanup = observations.CUE_MODEL_CLEANUP as { taskRootAbsent?: boolean; profileAbsent?: boolean } | undefined;
        const pinned = matchesModelControlObservation(controlBundle, observations.CUE_MODEL_BOUNDARY);
        const success = identityRef !== null && pinned && closed && !failed && !pending && code === 0 && returned
          && native?.status === 'observed' && cleanup?.taskRootAbsent === true && cleanup.profileAbsent === true && observations.CUE_MODEL_EXIT === '0';
        resolve(Object.freeze({ outcome: success ? 'succeeded' : 'failed', attemptId: context.runId, requestId,
          text: null, usage: null, terminal: null, checkerVerdict: returned ? verdict : null,
          observations: Object.freeze({ ...observations }), identityRef, cleanup: 'unknown', providerStopped: 'unknown' }));
      });
    });
    child.stdin.write(Buffer.from(requestText).toString('base64') + '\n');
    return Object.freeze({ result, session: Object.freeze(session), completion: result.then(value => value.outcome), cancel: async () => { stop(); await waitNativeResult(result); } });
  };
}
