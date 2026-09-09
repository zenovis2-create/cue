import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(process.env.CUE_SOURCE_MANIFEST_REPO || fileURLToPath(new URL('..', import.meta.url)));
const indexMode = process.argv.includes('--index');
const headMode = process.argv.includes('--head');
if (indexMode && headMode) throw new Error('choose exactly one source manifest mode');
const positional = process.argv.slice(2).filter(arg => arg !== '--index' && arg !== '--head');
const outputPath = resolve(repoRoot, positional[0] || 'evidence/P10C/source_tree_manifest.json');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

let files;
if (indexMode) {
  const drift = [
    ...execFileSync('git', ['diff', '--name-only', '-z'], { cwd: repoRoot, encoding: 'utf8' }).split('\0'),
    ...execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: repoRoot, encoding: 'utf8' }).split('\0'),
  ].filter(Boolean).map(path => path.replaceAll('\\', '/')).filter(path => !path.startsWith('evidence/'));
  if (drift.length > 0) throw new Error(`unstaged or untracked source drift: ${[...new Set(drift)].sort().join(', ')}`);
  const raw = execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: repoRoot, encoding: 'utf8' });
  const entries = raw.split('\0').filter(Boolean).map(entry => {
    const tab = entry.indexOf('\t');
    if (tab < 0) throw new Error('invalid staged-index entry');
    const [mode, oid, stage] = entry.slice(0, tab).split(' ');
    const path = entry.slice(tab + 1).replaceAll('\\', '/');
    return { mode, oid, stage, path };
  });
  const unmerged = entries.filter(entry => entry.stage !== '0');
  if (unmerged.length > 0) throw new Error(`source manifest rejects unmerged index entries: ${unmerged.map(entry => entry.path).join(', ')}`);
  files = entries.filter(entry => !entry.path.startsWith('evidence/')).map(entry => {
      if (entry.mode !== '100644' && entry.mode !== '100755') throw new Error(`source manifest accepts staged regular files only: ${entry.path}`);
      const bytes = execFileSync('git', ['cat-file', 'blob', entry.oid], { cwd: repoRoot, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
      return { path: entry.path, bytes: bytes.length, sha256: sha256(bytes) };
    });
} else if (headMode) {
  const raw = execFileSync('git', ['ls-tree', '-r', '-z', '--full-tree', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  files = raw.split('\0').filter(Boolean).map(entry => {
    const tab = entry.indexOf('\t');
    if (tab < 0) throw new Error('invalid HEAD tree entry');
    const [mode, type, oid] = entry.slice(0, tab).split(' ');
    const path = entry.slice(tab + 1).replaceAll('\\', '/');
    return { mode, type, oid, path };
  }).filter(entry => !entry.path.startsWith('evidence/')).map(entry => {
    if (entry.type !== 'blob' || (entry.mode !== '100644' && entry.mode !== '100755')) {
      throw new Error(`source manifest accepts committed regular files only: ${entry.path}`);
    }
    const bytes = execFileSync('git', ['cat-file', 'blob', entry.oid], { cwd: repoRoot, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
    return { path: entry.path, bytes: bytes.length, sha256: sha256(bytes) };
  });
} else {
  const raw = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const paths = raw.split('\0')
    .filter(Boolean)
    .map(path => path.replaceAll('\\', '/'))
    .filter(path => !path.startsWith('evidence/'))
    .filter(path => existsSync(resolve(repoRoot, path)));
  files = paths.map(path => {
    const absolutePath = resolve(repoRoot, path);
    const stat = lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`source manifest accepts regular files only: ${path}`);
    const bytes = readFileSync(absolutePath);
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  });
}

files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
const canonical = JSON.stringify(files);
const sourceTreeSha256 = sha256(canonical);
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const manifest = {
  schema: 'cue.source-tree-manifest.v2',
  generatedAt: new Date().toISOString(),
  baseHead: head,
  mode: indexMode ? 'index' : headMode ? 'head' : 'working-tree',
  scope: indexMode
    ? 'all stage-0 regular-file blobs in the Git index except evidence/**; staged deletions and untracked files are absent; digest is SHA-256 of the compact sorted files array'
    : headMode
      ? 'all regular-file blobs in committed HEAD except evidence/**; digest is SHA-256 of the compact sorted files array'
    : 'all tracked and non-ignored untracked regular working files except evidence/**; digest is SHA-256 of the compact sorted files array',
  excludedPrefixes: ['evidence/'],
  fileCount: files.length,
  sourceTreeSha256,
  files,
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, mode: manifest.mode, fileCount: files.length, sourceTreeSha256 }, null, 2));
