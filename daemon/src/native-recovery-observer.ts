import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { dirname, join, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';
import type { Ledger } from './ledger.js';
import { createNativeExecutionIdentityStore } from './native-execution-identity-store.js';
import { runProcessSync } from './process-launch.js';

type PathKind = 'directory' | 'file' | 'reparse' | 'absent' | 'unknown';
type ProcessState = 'matching-alive' | 'matching-exited' | 'pid-reused' | 'absent' | 'unknown';
export interface NativeQuery { readonly version: 'cue-native-query-v1'; readonly nonce: string; readonly processes: readonly Readonly<{ pid: number }>[] }
export interface NativeRecoveryHost {
  db: Ledger;
  /** Protected loaded-source scope check, not historical qualification. */
  assertInstallationCurrent(phase: 'before-observation' | 'before-publish'): true;
  /** Both replacements are explicit offline fixtures, never live facts. */
  fixture?: { query(input: NativeQuery, signal: AbortSignal): Promise<unknown>; stat(path: string, signal: AbortSignal): Promise<PathKind> };
}
const helper = join(dirname(fileURLToPath(import.meta.url)), 'native-process-observation.ps1');
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const loadedHelperHash = hash(readFileSync(helper));
function fail(code: string): never { throw Error('native_recovery_' + code); }
function data(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || types.isProxy(v) || Object.getPrototypeOf(v) !== Object.prototype) fail('input');
  const d = Object.getOwnPropertyDescriptors(v);
  if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !d[k]?.enumerable || !Object.hasOwn(d[k], 'value'))) fail('input');
  return Object.fromEntries(keys.map(k => [k, d[k]!.value]));
}
function text(v: unknown): string { if (typeof v !== 'string' || !v || v.length > 256 || v.includes('\0')) fail('input'); return v; }
function path(v: unknown): string {
  if (typeof v !== 'string' || v.length > 2048 || !/^[A-Za-z]:[\\/]/.test(v) || v.includes('\0') || v.split(/[\\/]/).some(p => p === '.' || p === '..') || v.slice(2).includes(':')) fail('path');
  return win32.normalize(v);
}
const same = (a: string, b: string) => win32.normalize(a).toLowerCase() === win32.normalize(b).toLowerCase();
function frozen<T>(v: T): T { if (v && typeof v === 'object') { for (const child of Object.values(v)) frozen(child); Object.freeze(v); } return v; }
const names = ['launcher', 'client', 'guardian'] as const;

/** Observation only: no persistence, receipt, acceptance, termination or restart.
 * The caller owns the current installation guard. Recorded subject is lineage,
 * not evidence that old qualification applies to this new observer. */
export function createNativeRecoveryObserver(host: NativeRecoveryHost) {
  const db = host.db, guard = host.assertInstallationCurrent, fixture = host.fixture;
  if (typeof guard !== 'function' || (fixture && (typeof fixture.query !== 'function' || typeof fixture.stat !== 'function'))) fail('host');
  const queryFixture = fixture?.query, statFixture = fixture?.stat, store = createNativeExecutionIdentityStore(db);
  return Object.freeze({ async observe(input: { identityRef: string; runId: string; candidateId: string; subjectDigest: string; signal?: AbortSignal }) {
    if (!input || types.isProxy(input)) fail('input');
    const fields = data(input, Object.hasOwn(input, 'signal') ? ['identityRef', 'runId', 'candidateId', 'subjectDigest', 'signal'] : ['identityRef', 'runId', 'candidateId', 'subjectDigest']);
    const identityRef = text(fields.identityRef), runId = text(fields.runId), candidateId = text(fields.candidateId), subjectDigest = text(fields.subjectDigest);
    const signal = fields.signal as AbortSignal | undefined;
    if (signal !== undefined && !(signal instanceof AbortSignal)) fail('signal');
    const identity = store.read(identityRef);
    if (!identity || identity.runId !== runId || identity.candidateId !== candidateId || identity.subjectDigest !== subjectDigest) fail('lineage');
    const encoded = JSON.stringify(identity), controller = new AbortController();
    let deadline = Infinity;
    const onAbort = () => controller.abort(); signal?.addEventListener('abort', onAbort, { once: true }); if (signal?.aborted) onAbort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    function current() {
      controller.signal.throwIfAborted(); if (performance.now() >= deadline) fail('timeout');
      if (!db.open || db.inTransaction || JSON.stringify(store.read(identityRef)) !== encoded) fail('lineage-drift');
      if (hash(readFileSync(helper)) !== loadedHelperHash) fail('helper-drift');
      if (!db.open || db.inTransaction || JSON.stringify(store.read(identityRef)) !== encoded) fail('lineage-drift');
      controller.signal.throwIfAborted(); if (performance.now() >= deadline) fail('timeout');
    }
    async function bounded<T>(operation: () => Promise<T>): Promise<T> {
      current(); let rejectAbort!: () => void;
      const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = () => reject(Error('native_recovery_aborted')); controller.signal.addEventListener('abort', rejectAbort, { once: true }); });
      try { const value = await Promise.race([operation(), aborted]); current(); return value; }
      finally { controller.signal.removeEventListener('abort', rejectAbort); }
    }
    try {
      current();
      // Full loaded-installation hashing is synchronous and is not a five-second
      // total-response guarantee. Exactly two full guards bracket OS observation.
      const initialGuardStart = performance.now();
      const initial: unknown = guard('before-observation'); if (initial instanceof Promise) void initial.catch(() => {}); if (initial !== true) fail('installation');
      const initialGuardMs = performance.now() - initialGuardStart;
      current(); const observationStart = performance.now(); deadline = observationStart + 5000; timer = setTimeout(onAbort, 5000);
      const request: NativeQuery = frozen({ version: 'cue-native-query-v1', nonce: randomUUID(), processes: names.map(n => ({ pid: identity.processes[n].pid })) });
      let raw: unknown;
      try {
        raw = await bounded(async () => {
          if (queryFixture) return queryFixture(request, controller.signal);
          if (process.platform !== 'win32') fail('unsupported');
          const result = runProcessSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper, '-PayloadBase64', Buffer.from(JSON.stringify(request)).toString('base64')],
            { encoding: 'utf8', windowsHide: true, timeout: Math.max(1, Math.floor(deadline - performance.now())), maxBuffer: 16384 });
          if (result.error || result.status !== 0 || result.stderr.trim() || Buffer.byteLength(result.stdout) > 16384) fail('query');
          return JSON.parse(result.stdout);
        });
      } catch { current(); raw = null; }
      let processes = Object.fromEntries(names.map(n => [n, { expected: identity.processes[n], observedCreatedFileTime: null as string | null, state: 'unknown' as ProcessState }]));
      let paths = { taskRoot: 'unknown', profileRoot: 'unknown', profilePath: 'unknown' }, pathProvenance: 'matched' | 'unknown' = 'unknown';
      try {
        const r = data(raw, ['version', 'nonce', 'processes', 'temp', 'localAppData']);
        if (r.version !== request.version || r.nonce !== request.nonce || !Array.isArray(r.processes) || types.isProxy(r.processes) || r.processes.length !== 3) fail('response');
        const parsed = names.map((n, index) => {
          const p = data((r.processes as unknown[])[index], ['pid', 'createdFileTime', 'liveness']);
          if (p.pid !== identity.processes[n].pid || !['alive', 'exited', 'absent', 'unknown'].includes(p.liveness as string)) fail('response');
          const created = p.createdFileTime;
          if (p.liveness === 'alive' || p.liveness === 'exited') {
            if (typeof created !== 'string' || !/^[1-9]\d{0,19}$/.test(created) || BigInt(created) > 18446744073709551615n) fail('response');
          } else if (created !== null) fail('response');
          const state: ProcessState = p.liveness === 'absent' ? 'absent' : p.liveness === 'unknown' ? 'unknown'
            : created !== identity.processes[n].createdFileTime ? 'pid-reused' : p.liveness === 'alive' ? 'matching-alive' : 'matching-exited';
          return [n, { expected: identity.processes[n], observedCreatedFileTime: created as string | null, state }];
        });
        processes = Object.fromEntries(parsed);
        const temp = path(r.temp), local = path(r.localAppData), profile = identity.boundary.profile;
        const taskRoot = win32.join(temp, profile), profileRoot = win32.join(local, 'Packages', profile), profilePath = win32.join(profileRoot, 'AC');
        if (same(path(identity.boundary.taskRoot), taskRoot) && same(path(identity.boundary.profilePath), profilePath)) {
          const presence = async (target: string): Promise<string> => {
            const root = win32.parse(target).root, parts = target.slice(root.length).split('\\').filter(Boolean); if (parts.length > 64) return 'unknown';
            let location = root;
            for (const part of ['', ...parts]) {
              if (part) location = win32.join(location, part);
              const kind = await bounded(async (): Promise<PathKind> => {
                if (statFixture) return statFixture(location, controller.signal);
                try { const stat = await lstat(location); return stat.isSymbolicLink() ? 'reparse' : stat.isDirectory() ? 'directory' : 'file'; }
                catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'absent' : 'unknown'; }
              });
              if (kind === 'absent') return 'absent'; if (kind !== 'directory') return 'unknown';
            }
            return 'present';
          };
          paths = { taskRoot: await presence(taskRoot), profileRoot: await presence(profileRoot), profilePath: await presence(profilePath) };
          pathProvenance = Object.values(paths).includes('unknown') ? 'unknown' : 'matched';
        }
      } catch { current(); paths = { taskRoot: 'unknown', profileRoot: 'unknown', profilePath: 'unknown' }; }
      current();
      const observationMs = performance.now() - observationStart;
      clearTimeout(timer); deadline = Infinity;
      const finalGuardStart = performance.now();
      const final: unknown = guard('before-publish'); if (final instanceof Promise) void final.catch(() => {}); if (final !== true) fail('installation');
      const finalGuardMs = performance.now() - finalGuardStart;
      current();
      return frozen({ version: 'cue-native-recovery-observation-v1' as const, authority: 'observation-only' as const,
        sourceKind: fixture ? 'fixture' as const : 'native' as const, identityRef, runId, candidateId, subjectDigest,
        observedAt: new Date().toISOString(), processes, paths, pathProvenance,
        timing: { initialGuardMs, observationMs, finalGuardMs, observationLimitMs: 5000, totalResponseBounded: false } });
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
  } });
}
