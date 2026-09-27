// Fixed historical archive comparison, not an app/worker capability or live scan.
import { readFileSync, lstatSync, mkdirSync, openSync, closeSync, writeFileSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { restoreArchivedSource, renderSourceComparison } from '../../daemon/dist/src/reports/comparison.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = join(root, 'evidence/integrations/S7');
const pins = [
  { folder: '20260911-source-structure', sourceSha256: '033b0cdd461a26b94bbb2b17c2bf3ab42eac27c4828453dfe9b2859b7fdf94d7', resultSha256: '3d7b0d288538b5a5c7c696550811a74f948035c29a1c9869fc7212b8605b3497' },
  { folder: '20260911-source-matrix', sourceSha256: '195e00c12012ec9455de770fda024d3e2a17c89ebcb7ea295ea56bf989c54e3d', resultSha256: 'b9cddea81f8c58a06b55abe4587797c4aa18839b04726d52713ee0f5760bcb7d' },
];
function read(path, max) {
  const stat = lstatSync(path); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > max) throw Error('archive file denied');
  const bytes = readFileSync(path); if (bytes.length !== stat.size) throw Error('archive changed');
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}
if (process.argv.length !== 2) throw Error('no arguments accepted');
const reports = pins.map(pin => restoreArchivedSource(read(join(evidence, pin.folder, 'source.json'), 1048576),
  read(join(evidence, pin.folder, 'result.json'), 4194304), read(join(evidence, pin.folder, 'cue-source-structure.html'), 33554432), pin.sourceSha256, pin.resultSha256));
const artifact = renderSourceComparison(reports[0], reports[1]);
const output = join(evidence, '20260911-source-comparison'); mkdirSync(output, { recursive: true });
if (lstatSync(output).isSymbolicLink()) throw Error('output link denied');
const target = join(output, 'cue-source-comparison.html'), temporary = join(output, `.comparison-${randomUUID()}.tmp`);
try {
  const fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, artifact.html, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
  if (createHash('sha256').update(readFileSync(temporary)).digest('hex') !== artifact.artifactSha256) throw Error('write mismatch');
  renameSync(temporary, target);
} finally { try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
const { html, ...receipt } = artifact;
writeFileSync(join(output, 'result.json'), JSON.stringify({ pins, ...receipt, archiveValidation: 'pinned-byte-and-original-receipt-consistency-only', directorySynced: false,
  scope: 'Two historical declared source snapshots, not current source, clean Git, runtime influence or safety.' }, null, 2));
console.log(JSON.stringify({ artifactSha256: artifact.artifactSha256, artifactBytes: artifact.artifactBytes,
  nodes: artifact.comparison.nodes.length, edges: artifact.comparison.edges.length, files: artifact.comparison.files.length }));
