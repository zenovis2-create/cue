import type { Ledger } from '../ledger.js';
import type { RuntimeContext } from '../integration-runtime.js';
import type { SessionRecord } from '../session-spawn.js';
import { matchesModelControlObservation, type ModelControlBundle } from '../model-control-bundle.js';
import { createNativeExecutionIdentityStore, type NativeExecutionIdentity } from '../native-execution-identity-store.js';
import { win32 } from 'node:path';
import { types } from 'node:util';

export function snapshotNativeHostIdentity(input: unknown) {
  function record(value: unknown, keys: string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('native_identity_host_frame');
    const d = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !d[k]?.enumerable || !Object.hasOwn(d[k], 'value'))) throw Error('native_identity_host_frame');
    return Object.fromEntries(keys.map(k => [k, d[k]!.value]));
  }
  const outer = record(input, ['launcher', 'guardian']);
  const processIdentity = (value: unknown) => {
    const p = record(value, ['pid', 'createdFileTime']);
    if (typeof p.pid !== 'number' || !Number.isSafeInteger(p.pid) || p.pid < 1 || p.pid > 2147483647
      || typeof p.createdFileTime !== 'string' || !/^[1-9]\d{0,19}$/.test(p.createdFileTime) || BigInt(p.createdFileTime) > 18446744073709551615n) throw Error('native_identity_host_frame');
    return Object.freeze({ pid: p.pid, createdFileTime: p.createdFileTime });
  };
  const result = { launcher: processIdentity(outer.launcher), guardian: processIdentity(outer.guardian) };
  if (result.launcher.pid === result.guardian.pid) throw Error('native_identity_host_frame');
  return Object.freeze(result);
}

/** Bounds a caller's wait only; never settles/replaces native completion. */
export async function waitNativeResult<T>(result: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([result, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Error('native_completion_unresolved')), 5000);
  })]); } finally { clearTimeout(timer); }
}

export function snapshotNativeIdentityBases(input: { taskRootBase: string; profileRootBase: string }) {
  const result = { taskRootBase: input.taskRootBase, profileRootBase: input.profileRootBase };
  for (const value of Object.values(result)) if (typeof value !== 'string' || value.length > 2048 || !/^[A-Za-z]:[\\/]/.test(value)
    || value.includes('\0') || value.split(/[\\/]/).some(v => v === '.' || v === '..')) throw Error('native_identity_host_bases');
  return Object.freeze(result);
}

/** Protected native frames only. This commits recorded identity, never OS truth or
 * cleanup authority. Caller must perform this before service authorization. */
export function commitNativeIdentity(db: Ledger, context: RuntimeContext, session: SessionRecord,
  control: ModelControlBundle, frames: Readonly<Record<string, unknown>>, bases: ReturnType<typeof snapshotNativeIdentityBases>): string {
  context.signal.throwIfAborted();
  if (context.role !== 'model') throw Error('native_identity_role');
  const b = frames.CUE_MODEL_BOUNDARY as Record<string, unknown> | undefined;
  const n = frames.CUE_MODEL_OBSERVATION as Record<string, unknown> | undefined;
  const h = snapshotNativeHostIdentity(frames.CUE_MODEL_HOST_IDENTITY);
  if (!b || !n || !h || Object.keys(h).sort().join(',') !== 'guardian,launcher'
    || n.status !== 'observed' || n.phase !== 'suspended-before-resume' || n.appContainer !== true
    || n.appContainerSid !== b.sid || typeof n.pid !== 'number' || String(n.pid) !== frames.CUE_MODEL_PID
    || typeof h.guardian?.pid !== 'number' || String(h.guardian.pid) !== frames.CUE_MODEL_GUARDIAN_PID
    || !matchesModelControlObservation(control, b)) throw Error('native_identity_frames');
  if (typeof b.profile !== 'string' || typeof b.taskRoot !== 'string' || typeof b.profilePath !== 'string'
    || win32.normalize(b.taskRoot).toLowerCase() !== win32.join(bases.taskRootBase, b.profile).toLowerCase()
    || win32.normalize(b.profilePath).toLowerCase() !== win32.join(bases.profileRootBase, b.profile, 'AC').toLowerCase()) throw Error('native_identity_host_paths');
  const ref = createNativeExecutionIdentityStore(db).record({
    version: 'cue-native-execution-identity-v1', runId: context.runId, candidateId: context.candidateId, role: 'model', subjectDigest: context.subjectDigest,
    session, processes: { launcher: h.launcher, guardian: h.guardian, client: { pid: n.pid, createdFileTime: n.createdFileTime } },
    boundary: { profile: b.profile, sid: b.sid, taskRoot: b.taskRoot, profilePath: b.profilePath, clientKind: b.clientKind,
      controlBundleSha256: control.sha256, launcherSha256: control.launcherSha256, clientSha256: b.clientSha256, guardianSha256: control.guardianSha256 },
    observedAt: new Date().toISOString(),
  } as NativeExecutionIdentity);
  context.signal.throwIfAborted();
  return ref;
}
