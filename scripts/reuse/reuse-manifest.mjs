import { readFileSync, lstatSync, realpathSync, openSync, fstatSync, closeSync } from 'node:fs';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const HASH = /^[a-f0-9]{64}$/;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = reason => { throw Error(`reuse_manifest_${reason}`); };
const canonical = v => v === null || typeof v !== 'object' ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
    : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
function digest(value, field) {
  if (typeof value !== 'string' || !HASH.test(value)) fail(field);
  return value;
}
function lifecycleBinding(value) {
  exact(value, ['revision', 'manifestDigest', 'receiptSha256']);
  if (typeof value.revision !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.revision)) fail('lifecycle_revision');
  digest(value.manifestDigest, 'lifecycle_manifest');
  digest(value.receiptSha256, 'lifecycle_receipt');
  return value;
}
function observedBinding(value) {
  if (value === null) return null;
  return lifecycleBinding(value);
}
function sameBinding(expected, observed) {
  return observed !== null && expected.revision === observed.revision
    && expected.manifestDigest === observed.manifestDigest && expected.receiptSha256 === observed.receiptSha256;
}

export function evaluateReuseEvidence(raw) {
  const input = snapshot(raw);
  exact(input, ['version', 'current', 'observed', 'fallback']);
  if (input.version !== 'cue-reuse-evidence-lifecycle-v1') fail('lifecycle_version');
  const current = lifecycleBinding(input.current);
  const observed = observedBinding(input.observed);
  if (input.fallback !== null) {
    exact(input.fallback, ['observed']);
    observedBinding(input.fallback.observed);
  }
  if (sameBinding(current, observed)) return Object.freeze({ reusable: true, action: 'use-current',
    revision: current.revision, bindingDigest: sha(canonical(current)), invalidation: null });
  const invalidation = observed === null ? 'missing-receipt' : 'changed-binding';
  if (input.fallback && sameBinding(current, input.fallback.observed)) {
    return Object.freeze({ reusable: true, action: 'use-pinned-fallback', revision: current.revision,
      bindingDigest: sha(canonical(current)), invalidation });
  }
  return Object.freeze({ reusable: false, action: 'refuse', revision: null, bindingDigest: null, invalidation });
}

// The root is host configuration, not receipt input. Fallback observations never
// select another catalog revision; only the current exact binding can be reused.
export function readSelectedReuseBasis(root = ROOT) {
  root = resolve(root);
  const verify = reader(root), catalogPath = 'docs/reuse-decisions/upstream-source-catalog.json';
  let path = root;
  for (const part of catalogPath.split('/')) {
    path = join(path, part);
    if (lstatSync(path).isSymbolicLink()) fail('link');
  }
  const info = lstatSync(path);
  if (!info.isFile() || info.size > 1048576) fail('input_file');
  const content = readFileSync(path);
  if (content.length !== info.size) fail('changed');
  verify({ path: catalogPath, sha256: sha(content) });
  const parsed = JSON.parse(content.toString('utf8'));
  if (!Array.isArray(parsed?.applicableSelections)) fail('selected_catalog');
  const selections = snapshot(parsed.applicableSelections.filter(entry => ['R-04', 'R-05', 'R-06', 'R-08'].includes(entry?.decisionId)).map(entry => entry.decisionId === 'R-08' ? {
    decisionId: entry.decisionId, disposition: entry.disposition, selectedIdentity: entry.selectedIdentity,
    decisionPinnedCommit: entry.decisionPinnedCommit, selectedExternalBytes: entry.selectedExternalBytes,
    cueProductBytes: entry.cueProductBytes, adoptionAuthorized: entry.adoptionAuthorized,sourceNotice:entry.sourceNotice,
    publicApiAndSeam:entry.publicApiAndSeam,patches:entry.patches,
  } : entry));
  const selected = ['R-04', 'R-05', 'R-06', 'R-08'].map(id => {
    const matches = selections.filter(entry => entry.decisionId === id);
    if (matches.length !== 1) fail('selected_catalog');
    const entry = matches[0];
    if (id === 'R-08') {
      if (entry.disposition !== 'limited-principles-only' || !/^[a-f0-9]{40}$/.test(entry.decisionPinnedCommit)
          || !Array.isArray(entry.cueProductBytes) || !entry.cueProductBytes.length || !Array.isArray(entry.selectedExternalBytes)
          || entry.selectedExternalBytes.length !== 0 || entry.adoptionAuthorized !== false||!Array.isArray(entry.patches)||entry.patches.length!==0) fail('selected_catalog');
      // R-08 selects design principles and explicitly selects zero external bytes.
      // Its Cue product-byte list is consumer evidence rather than adopted input,
      // but every catalog reference must still bind the current consumer bytes.
      text(entry.selectedIdentity);text(entry.sourceNotice);text(entry.publicApiAndSeam); for (const source of entry.cueProductBytes) verify(source);
      return { decisionId: id, selectedIdentity: entry.selectedIdentity, disposition: entry.disposition,
        selectedRevision: `commit:${entry.decisionPinnedCommit}`, descriptor: null, selectedBytes: entry.cueProductBytes,
        sourceNotice:entry.sourceNotice,publicApiAndSeam:entry.publicApiAndSeam,patches:entry.patches,adoptionAuthorized:false };
    }
    const descriptor = id === 'R-05' ? entry.decision : entry.manifest;
    const expectedPath = id === 'R-05' ? 'docs/reuse-decisions/R-05.md' : `docs/reuse-decisions/manifests/${id}.json`;
    if (!descriptor || descriptor.path !== expectedPath || !Array.isArray(entry.selectedBytes) || !entry.selectedBytes.length
      || entry.selectedRevision !== `sha256:${entry.selectedBytes[0]?.sha256}` || entry.adoptionAuthorized !== false
      ||!Array.isArray(entry.patches)) fail('selected_catalog');
    text(entry.selectedIdentity); text(entry.disposition);text(entry.sourceNotice);text(entry.publicApiAndSeam);
    verify(descriptor);
    for (const source of entry.selectedBytes) verify(source);
    return { decisionId: id, selectedIdentity: entry.selectedIdentity, disposition: entry.disposition,
      selectedRevision: entry.selectedRevision, descriptor, selectedBytes: entry.selectedBytes,sourceNotice:entry.sourceNotice,
      publicApiAndSeam:entry.publicApiAndSeam,patches:entry.patches,adoptionAuthorized:false };
  });
  return Object.freeze({ revision: `sha256:${sha(canonical(selected.map(entry => [entry.decisionId, entry.selectedRevision])))}`,
    manifestDigest: sha(canonical(selected)), selections: Object.freeze(selected.map(entry => Object.freeze(entry))) });
}
function snapshot(input) {
  let nodes = 0, bytes = 0;
  const ancestors = new Set();
  function copy(v, depth) {
    if (++nodes > 8192 || depth > 24) fail('input_limit');
    if (typeof v === 'string') { bytes += Buffer.byteLength(v); if (bytes > 1048576) fail('input_limit'); return v; }
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v !== 'object' || types.isProxy(v) || ancestors.has(v)) fail('plain_data');
    const array = Array.isArray(v);
    if (Object.getPrototypeOf(v) !== (array ? Array.prototype : Object.prototype)) fail('plain_data');
    const ds = Object.getOwnPropertyDescriptors(v), own = Reflect.ownKeys(ds);
    if (own.some(k => typeof k !== 'string')) fail('plain_data');
    ancestors.add(v);
    let out;
    if (array) {
      const n = ds.length.value;
      if (n > 256 || own.length !== n + 1) fail('input_limit');
      out = [];
      for (let i = 0; i < n; i++) {
        const d = ds[String(i)];
        if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) fail('plain_data');
        out.push(copy(d.value, depth + 1));
      }
    } else {
      if (own.length > 32) fail('input_limit');
      out = Object.create(null);
      for (const k of own) {
        const d = ds[k];
        if (!Object.hasOwn(d, 'value') || !d.enumerable) fail('plain_data');
        out[k] = copy(d.value, depth + 1);
      }
    }
    ancestors.delete(v);
    return Object.freeze(out);
  }
  return copy(input, 0);
}
function exact(o, keys) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || Object.keys(o).length !== keys.length
      || keys.some(k => !Object.hasOwn(o, k))) fail('fields');
}
function text(value, max = 512) {
  if (typeof value !== 'string' || !value.length || value.trim() !== value || Buffer.byteLength(value) > max || /[\x00-\x1f]/.test(value)) fail('text');
  return value;
}
function localPath(value) {
  text(value, 512);
  if (isAbsolute(value) || value.includes('\\') || value.includes(':')
      || value.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) fail('escape');
  return value;
}
function reader(root) {
  root = resolve(root);
  if (lstatSync(root).isSymbolicLink() || realpathSync(root).toLowerCase() !== root.toLowerCase()) fail('link');
  let total = 0;
  const cache = new Map();
  return ref => {
    exact(ref, ['path', 'sha256']); localPath(ref.path);
    if (typeof ref.sha256 !== 'string' || !HASH.test(ref.sha256)) fail('hash');
    const key = ref.path.toLowerCase();
    if (cache.has(key)) { if (cache.get(key) !== ref.sha256) fail('conflicting_hash'); return; }
    if (cache.size >= 256) fail('file_limit');
    let path = root;
    try {
      for (const part of ref.path.split('/')) {
        path = join(path, part);
        const info = lstatSync(path);
        if (info.isSymbolicLink()) fail('link');
        if (path !== join(root, ref.path) && !info.isDirectory()) fail('nonregular');
      }
      const rel = relative(root, realpathSync(path));
      if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\')) fail('escape');
      const fd = openSync(path, 'r');
      try {
        const before = fstatSync(fd);
        if (!before.isFile() || before.size > 4 * 1024 * 1024 || total + before.size > 16 * 1024 * 1024) fail('file_limit');
        const bytes = readFileSync(fd), after = fstatSync(fd);
        if (bytes.length !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs
            || after.ino !== before.ino || after.dev !== before.dev) fail('changed');
        if (sha(bytes) !== ref.sha256) fail('hash');
        total += bytes.length;
      } finally { closeSync(fd); }
    } catch (e) { if (String(e.message).startsWith('reuse_manifest_')) throw e; fail('missing'); }
    cache.set(key, ref.sha256);
  };
}
export function validateReuseManifest(raw, root = ROOT) {
  const input = snapshot(raw);
  exact(input, ['version', 'id', 'decision', 'scope', 'origin', 'source', 'package', 'compliance', 'cue', 'lifecycle']);
  if (input.version !== 'cue-reuse-manifest-v1' || !/^R-0[1246]$/.test(input.id)
      || !['defer', 'bounded-adoption'].includes(input.decision) || input.scope !== 'internal-only') fail('fields');
  exact(input.origin, ['kind', 'identity', 'revision']);
  if (!['cue-native', 'unselected'].includes(input.origin.kind)) fail('origin');
  text(input.origin.identity);
  if (input.origin.revision !== null) text(input.origin.revision);
  const lists = [];
  for (const group of [input.source, input.cue, input.lifecycle]) {
    if (!Array.isArray(group) || group.length < 1) fail('files'); lists.push(group);
  }
  exact(input.package, ['name', 'version', 'artifact', 'status']); text(input.package.name);
  if (!['complete', 'not-adopted'].includes(input.package.status)) fail('package');
  if (input.package.version !== null) text(input.package.version);
  if (input.package.status === 'complete') {
    if (!input.package.artifact || input.origin.kind !== 'cue-native') fail('package');
    exact(input.package.artifact, ['path', 'sha256']);
    if (input.origin.revision !== `sha256:${input.package.artifact.sha256}` || input.package.version !== input.origin.revision
        || !input.cue.some(f => f.path === input.package.artifact.path && f.sha256 === input.package.artifact.sha256)) fail('artifact_binding');
    lists.push([input.package.artifact]);
  } else if (input.package.artifact !== null || input.package.version !== null || input.origin.revision !== null) fail('package');
  exact(input.compliance, ['license', 'notice', 'assets', 'bom']);
  const unknown = [];
  for (const name of ['license', 'notice', 'assets', 'bom']) {
    const c = input.compliance[name]; exact(c, ['status', 'reason', 'evidence']); text(c.reason, 2048);
    if (!['complete', 'not-applicable', 'unknown'].includes(c.status) || !Array.isArray(c.evidence)) fail('compliance');
    if (c.status !== 'unknown' && c.evidence.length === 0) fail('compliance_evidence');
    if (c.status === 'not-applicable' && input.origin.kind !== 'cue-native') fail('compliance_na');
    if (c.status === 'unknown') unknown.push(name);
    lists.push(c.evidence);
  }
  // All input is now owned, immutable and validated before any filesystem read.
  const check = reader(root);
  for (const group of lists) {
    const seen = new Set();
    for (const ref of group) {
      exact(ref, ['path', 'sha256']); localPath(ref.path);
      if (seen.has(ref.path.toLowerCase())) fail('duplicate'); seen.add(ref.path.toLowerCase());
      check(ref);
    }
  }
  const complete = input.decision === 'bounded-adoption' && input.package.status === 'complete' && unknown.length === 0;
  return Object.freeze({ version: 'cue-reuse-validation-v1', id: input.id,
    manifestDigest: sha(canonical(input)), adoptionStatus: complete ? 'documented' : 'incomplete',
    adoptionAuthorized: false, verificationScope: 'local-byte-bindings-only', unknown: Object.freeze(unknown) });
}
export function readReuseManifest(path, root = ROOT) {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 1048576) fail('input_file');
  const bytes = readFileSync(path); if (bytes.length !== info.size) fail('changed');
  return validateReuseManifest(JSON.parse(bytes.toString('utf8')), root);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) fail('arguments');
  console.log(JSON.stringify(readReuseManifest(resolve(process.argv[2]))));
}
