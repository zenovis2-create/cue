import { createHash } from 'node:crypto';
import { constants, closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { types } from 'node:util';

type Kind = 'skill' | 'rule' | 'knowledge';
interface Entry { id: string; kind: Kind; path: string; sha256: string; byteLength: number }
interface Manifest { schemaVersion: 1; id: string; version: string; source: string; revision: string; resources: Entry[] }
export interface ResourceSnapshot {
  readonly id: string; readonly version: string; readonly source: string; readonly revision: string; readonly manifestSha256: string;
  readonly resources: readonly Readonly<Entry & { text: string }>[];
}
const verifiedSnapshots = new WeakSet<ResourceSnapshot>();
export const isVerifiedResourceSnapshot = (value: unknown): value is ResourceSnapshot =>
  typeof value === 'object' && value !== null && verifiedSnapshots.has(value as ResourceSnapshot);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v);
function fields(v: unknown, keys: string[]): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || types.isProxy(v) || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) throw Error('resource_schema');
  const own = Reflect.ownKeys(v);
  if (own.length !== keys.length || keys.some(k => !own.includes(k))) throw Error('resource_schema');
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(v, key)!;
    if (!d.enumerable || !Object.hasOwn(d, 'value')) throw Error('resource_schema');
  }
}
function safePath(v: unknown): asserts v is string {
  if (typeof v !== 'string' || v.length > 240 || !v || v.includes('\\') || v.includes(':') || v.startsWith('/') || !/\.(md|txt|json)$/.test(v)) throw Error('resource_path');
  const parts = v.split('/');
  if (parts.length > 8 || parts.some(p => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(p) || /[. ]$/.test(p)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)
    || /^(?:credentials?|secrets?|env|environment|auth|authentication|conversations?|raw[-_]conversations?|chat[-_]history|transcripts?|raw[-_]transcripts?)(?:[._-]|$)/i.test(p))) throw Error('resource_path');
}
function manifest(bytes: Buffer): Manifest {
  const v: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  fields(v, ['schemaVersion','id','version','source','revision','resources']);
  if (v.schemaVersion !== 1 || !id(v.id) || typeof v.version !== 'string' || !/^\d{1,5}\.\d{1,5}\.\d{1,5}(?:-[A-Za-z0-9.-]{1,32})?$/.test(v.version)
    || typeof v.source !== 'string' || v.source.length > 512 || typeof v.revision !== 'string' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(v.revision)
    || !Array.isArray(v.resources) || !v.resources.length || v.resources.length > 32) throw Error('resource_schema');
  const source = new URL(v.source);
  if (source.protocol !== 'https:' || source.username || source.password || source.search || source.hash) throw Error('resource_source');
  let total = 0; const ids = new Set<string>(), paths = new Set<string>();
  for (const e of v.resources) {
    fields(e, ['id','kind','path','sha256','byteLength']); safePath(e.path);
    if (!id(e.id) || typeof e.kind !== 'string' || !['skill','rule','knowledge'].includes(e.kind) || !digest(e.sha256)
      || !Number.isSafeInteger(e.byteLength) || Number(e.byteLength) < 1 || Number(e.byteLength) > 65536
      || ids.has(e.id) || paths.has(e.path.toLowerCase())) throw Error('resource_schema');
    ids.add(e.id); paths.add(e.path.toLowerCase()); total += Number(e.byteLength);
  }
  if (total > 1048576) throw Error('resource_size');
  return v as unknown as Manifest;
}
function contained(root: string, path: string): boolean {
  const r = relative(root, path); return !!r && !isAbsolute(r) && r !== '..' && !r.startsWith('..' + sep);
}
/** Reject link/reparse redirects at every package component. The host supplies a
 * trusted package root; it must not delegate concurrent filesystem mutation to a
 * model/plugin. Handle identity and pinned bytes also guard detected read races. */
function readFile(root: string, path: string, limit: number): Buffer {
  const parts = path.split('/'), full = join(root, ...parts);
  const inspect = () => {
    if (lstatSync(root).isSymbolicLink() || realpathSync(root) !== root) throw Error('resource_root_drift');
    let current = root;
    for (const [i,p] of parts.entries()) {
      current = join(current, p); const stat = lstatSync(current);
      if (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()) || !contained(root, realpathSync(current))) throw Error('resource_path_escape');
    }
    return lstatSync(full);
  };
  const before = inspect();
  if (before.size < 1 || before.size > limit) throw Error('resource_size');
  const fd = openSync(full, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) throw Error('resource_file_drift');
    const bytes = Buffer.alloc(limit + 1); let offset = 0;
    while (offset < bytes.length) { const n = readSync(fd, bytes, offset, bytes.length - offset, null); if (!n) break; offset += n; }
    const after = fstatSync(fd), pathAfter = inspect();
    if (offset !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs
      || pathAfter.dev !== after.dev || pathAfter.ino !== after.ino || pathAfter.size !== after.size || pathAfter.mtimeMs !== after.mtimeMs) throw Error('resource_file_drift');
    return bytes.subarray(0, offset);
  } finally { closeSync(fd); }
}

/** Declarative reference data only. No home writes, installation hooks, network,
 * execution, model selection, or verification authority. Pins are process-local;
 * restart-persistent run pinning and knowledge retrieval remain separate work. */
export function createResourcePackages() {
  const versions = new Map<string, ResourceSnapshot>(), active = new Map<string, ResourceSnapshot>();
  const runs = new Map<string, readonly ResourceSnapshot[]>();
  return Object.freeze({
    register(input: { root: string; manifestSha256: string }): ResourceSnapshot {
      fields(input, ['root','manifestSha256']);
      if (typeof input.root !== 'string' || !isAbsolute(input.root) || !digest(input.manifestSha256)) throw Error('resource_host_input');
      try {
        const requested = resolve(input.root);
        if (lstatSync(requested).isSymbolicLink()) throw Error('resource_root_link');
        const root = realpathSync(requested), bytes = readFile(root, 'manifest.json', 32768);
        if (sha(bytes) !== input.manifestSha256) throw Error('resource_manifest_hash');
        const parsed = manifest(bytes);
        const resources = parsed.resources.map(e => {
          const bytes = readFile(root, e.path, e.byteLength);
          if (bytes.length !== e.byteLength || sha(bytes) !== e.sha256) throw Error('resource_content_hash');
          const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          return Object.freeze({ ...e, text });
        });
        const snapshot = Object.freeze({ id: parsed.id, version: parsed.version, source: parsed.source, revision: parsed.revision, manifestSha256: input.manifestSha256, resources: Object.freeze(resources) });
        verifiedSnapshots.add(snapshot);
        const key = parsed.id + '@' + parsed.version, previous = versions.get(key);
        if (previous && previous.manifestSha256 !== snapshot.manifestSha256) throw Error('resource_version_conflict');
        const stored = previous ?? snapshot;
        versions.set(key, stored); active.set(parsed.id, stored); return stored;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('resource_')) throw error;
        throw Error('resource_package_unavailable');
      }
    },
    pinRun(runId: string): readonly ResourceSnapshot[] {
      if (!id(runId)) throw Error('resource_run_id');
      const previous = runs.get(runId); if (previous) return previous;
      const pinned = Object.freeze([...active.values()].sort((a,b) => a.id.localeCompare(b.id, 'en')));
      runs.set(runId, pinned); return pinned;
    },
    remove(packageId: string): boolean {
      if (!id(packageId)) throw Error('resource_package_id');
      return active.delete(packageId);
    },
  });
}
