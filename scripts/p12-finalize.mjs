import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  if (!name?.startsWith('--') || !value) throw new Error(`invalid finalizer argument near ${name ?? '<end>'}`);
  args.set(name, value);
}
const required = ['--source-manifest', '--gate-summary', '--security-review', '--release-review', '--output'];
for (const name of required) if (!args.has(name)) throw new Error(`missing ${name}`);

const repo = realpathSync(resolve(process.env.CUE_FINALIZE_REPO || fileURLToPath(new URL('..', import.meta.url))));
const within = path => {
  const absolute = resolve(repo, path);
  const rel = relative(repo, absolute);
  if (!rel || rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
    throw new Error(`finalizer path must be a repository descendant: ${path}`);
  }
  return absolute;
};
const jsonFile = path => {
  const absolute = within(path);
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`finalizer requires a regular file: ${path}`);
  return { absolute, bytes: readFileSync(absolute), value: JSON.parse(readFileSync(absolute, 'utf8')) };
};

const output = within(args.get('--output'));
if (relative(repo, output).replaceAll('\\', '/') !== 'evidence/P12/v01_verdict.json') {
  throw new Error('P12 verdict output must be evidence/P12/v01_verdict.json');
}
rmSync(output, { force: true });

const source = jsonFile(args.get('--source-manifest'));
const gates = jsonFile(args.get('--gate-summary'));
const security = jsonFile(args.get('--security-review'));
const release = jsonFile(args.get('--release-review'));
if (source.value.mode !== 'index' || typeof source.value.sourceTreeSha256 !== 'string') throw new Error('source manifest is not a staged-index manifest');
const sourceDigest = source.value.sourceTreeSha256;
if (gates.value.schema !== 'cue.p12.gates.v1' || gates.value.passed !== true || gates.value.sourceTreeSha256 !== sourceDigest) {
  throw new Error('gate summary is not a passing receipt for the staged source');
}
if (!gates.value.gates || Object.values(gates.value.gates).some(value => value !== true)) throw new Error('one or more release gates are not true');
for (const [role, review] of [['security', security.value], ['release', release.value]]) {
  if (review.schema !== 'cue.p12.review.v1' || review.role !== role || review.valid !== true || review.passed !== true || review.sourceTreeSha256 !== sourceDigest || !Array.isArray(review.blockers) || review.blockers.length !== 0) {
    throw new Error(`${role} review is not terminal passed:true for the staged source`);
  }
}

const manifestScript = fileURLToPath(new URL('p10c-source-manifest.mjs', import.meta.url));
const scratch = mkdtempSync(resolve(tmpdir(), 'cue-p12-finalize-'));
try {
  const recomputedPath = resolve(scratch, 'source.json');
  execFileSync(process.execPath, [manifestScript, recomputedPath, '--index'], {
    cwd: repo,
    env: { ...process.env, CUE_SOURCE_MANIFEST_REPO: repo },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const recomputed = JSON.parse(readFileSync(recomputedPath, 'utf8'));
  if (recomputed.sourceTreeSha256 !== sourceDigest || JSON.stringify(recomputed.files) !== JSON.stringify(source.value.files)) {
    throw new Error('staged source manifest no longer matches the index');
  }
} finally {
  rmSync(scratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

if (!Array.isArray(gates.value.receipts) || gates.value.receipts.length === 0) throw new Error('gate summary has no receipt inventory');
const receiptHashes = [];
const allowed = new Set([
  relative(repo, source.absolute).replaceAll('\\', '/'),
  relative(repo, gates.absolute).replaceAll('\\', '/'),
  relative(repo, security.absolute).replaceAll('\\', '/'),
  relative(repo, release.absolute).replaceAll('\\', '/'),
  'evidence/P12/v01_verdict.json',
]);
for (const receipt of gates.value.receipts) {
  if (!receipt || typeof receipt.path !== 'string' || typeof receipt.sha256 !== 'string' || !receipt.path.startsWith('evidence/P12/')) throw new Error('invalid gate receipt entry');
  const file = jsonFile.bind(null);
  const absolute = within(receipt.path);
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`receipt is not a regular file: ${receipt.path}`);
  const actual = sha256(readFileSync(absolute));
  if (actual !== receipt.sha256) throw new Error(`receipt hash mismatch: ${receipt.path}`);
  allowed.add(receipt.path.replaceAll('\\', '/'));
  receiptHashes.push({ path: receipt.path.replaceAll('\\', '/'), sha256: actual });
}

const evidenceRoot = resolve(repo, 'evidence', 'P12');
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const absolute = resolve(directory, entry.name);
  if (entry.isSymbolicLink()) throw new Error(`P12 evidence contains a symlink: ${relative(repo, absolute)}`);
  return entry.isDirectory() ? walk(absolute) : [relative(repo, absolute).replaceAll('\\', '/')];
});
for (const path of walk(evidenceRoot)) if (!allowed.has(path)) throw new Error(`unlisted P12 evidence file: ${path}`);

const verdict = {
  schema: 'cue.p12.verdict.v1',
  generatedAt: new Date().toISOString(),
  verdict: 'GO',
  passed: true,
  sourceTreeSha256: sourceDigest,
  sourceManifestSha256: sha256(source.bytes),
  gateSummarySha256: sha256(gates.bytes),
  reviews: {
    security: { passed: true, sha256: sha256(security.bytes) },
    release: { passed: true, sha256: sha256(release.bytes) },
  },
  receipts: receiptHashes.sort((left, right) => left.path.localeCompare(right.path)),
  binding: 'The source digest is recomputed from staged regular-file blobs excluding evidence/**. This tracked verdict intentionally omits the future commit SHA; an external post-commit attestation binds HEAD after the one final commit.',
};
writeFileSync(output, `${JSON.stringify(verdict, null, 2)}\n`);
console.log(JSON.stringify({ output, verdict: verdict.verdict, sourceTreeSha256: sourceDigest, receiptCount: receiptHashes.length }));
