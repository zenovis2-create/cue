import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputPath = resolve(repoRoot, process.argv[2] || 'evidence/P10C/source_tree_manifest.json');
const raw = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
const paths = raw.split('\0')
  .filter(Boolean)
  .map(path => path.replaceAll('\\', '/'))
  .filter(path => !path.startsWith('evidence/'))
  .filter(path => existsSync(resolve(repoRoot, path)))
  .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);

const files = paths.map(path => {
  const absolutePath = resolve(repoRoot, path);
  const stat = lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`source manifest accepts regular files only: ${path}`);
  const bytes = readFileSync(absolutePath);
  return {
    path,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
});
const canonical = JSON.stringify(files);
const sourceTreeSha256 = createHash('sha256').update(canonical).digest('hex');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const manifest = {
  schema: 'cue.source-tree-manifest.v1',
  generatedAt: new Date().toISOString(),
  baseHead: head,
  scope: 'all tracked and non-ignored untracked regular files except evidence/**; paths sorted by Unicode code point; digest is SHA-256 of compact JSON files array',
  excludedPrefixes: ['evidence/'],
  fileCount: files.length,
  sourceTreeSha256,
  files,
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, fileCount: files.length, sourceTreeSha256 }, null, 2));
