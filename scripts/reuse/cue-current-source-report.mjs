// Fixed offline current-source capture. It parses source bytes but never imports them.
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureSource, extractionMetadata, extractGraph, verifySource } from './cue-source-structure-report.mjs';
import { sourceReport } from '../../daemon/dist/src/reports/ir.js';
import { renderReportHtml } from '../../daemon/dist/src/reports/html.js';
import { createReportDelivery } from '../../daemon/dist/src/reports/delivery.js';
import { bindCurrentSourceBasis, renderCurrentSourceComparison, restoreArchivedSource } from '../../daemon/dist/src/reports/comparison.js';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = join(repo, 'evidence/integrations/S7/20260912-current-source');
const archive = join(repo, 'evidence/integrations/S7/20260911-source-matrix');
const archivePins = Object.freeze({ source: '195e00c12012ec9455de770fda024d3e2a17c89ebcb7ea295ea56bf989c54e3d', result: 'b9cddea81f8c58a06b55abe4587797c4aa18839b04726d52713ee0f5760bcb7d' });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = reason => { throw Error(`current_source_report:${reason}`); };

export function sourceInput(snapshot, graph) {
  return { identity: 'cue-static-source-imports', revision: snapshot.digest,
    files: snapshot.files.map(({ path, sha256 }) => ({ path, sha256 })),
    nodes: snapshot.files.map(file => ({ id: file.path, label: `${file.path} · 정적 문법 추출, 실행/영향 미검증` })), edges: graph.edges };
}

export function assertStableBasis(before, after, snapshotDigest) {
  if (before.baseCommit !== after.baseCommit || before.sourceStatusSha256 !== after.sourceStatusSha256 ||
    before.sourceStatusEntries !== after.sourceStatusEntries || before.snapshotDigest !== snapshotDigest || after.snapshotDigest !== snapshotDigest) fail('basis_changed');
}

function git(args) { return execFileSync('git', args, { cwd: repo, encoding: null, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4194304 }); }
function sourceBasis(snapshotDigest) {
  const baseCommit = git(['rev-parse', '--verify', 'HEAD']).toString('utf8').trim();
  if (!/^[a-f0-9]{40}$/.test(baseCommit)) fail('git_head');
  const status = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', 'app', 'daemon/src']);
  return Object.freeze({ snapshotDigest, baseCommit, sourceStatusSha256: sha(status), sourceStatusEntries: status.length ? status.toString('utf8').split('\0').filter(Boolean).length : 0 });
}
function boundedRead(path, max) { const info = lstatSync(path); if (!info.isFile() || info.isSymbolicLink() || info.size > max) fail('archive'); const bytes = readFileSync(path); if (bytes.length !== info.size) fail('archive_changed'); return bytes; }
function atomic(path, bytes) {
  const temporary = join(dirname(path), `.current-source-${randomUUID()}.tmp`); let fd;
  try { fd = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR, 0o600); writeFileSync(fd, bytes); fsyncSync(fd); closeSync(fd); fd = undefined;
    if (sha(readFileSync(temporary)) !== sha(bytes)) fail('write'); renameSync(temporary, path);
  } finally { if (fd !== undefined) closeSync(fd); try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
}

function existingFile(path, max) {
  try { return boundedRead(path, max); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export function publishPointer(path, pointer, validate) {
  const previous = existingFile(path, 1048576), bytes = Buffer.from(JSON.stringify(pointer, null, 2)), own = sha(bytes);
  atomic(path, bytes);
  try { validate(); }
  catch (error) {
    const current = existingFile(path, 1048576);
    if (current && sha(current) === own) {
      if (previous) atomic(path, previous); else unlinkSync(path);
    }
    throw error;
  }
}

export function reuseExistingGeneration(generation, stage, names, snapshotDigest) {
  let info;
  try { info = lstatSync(generation); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  if (!info.isDirectory() || info.isSymbolicLink()) fail('generation_invalid');
  const expectedNames = [...names, 'generation.json'].sort();
  const actualNames = readdirSync(generation).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) fail('generation_entries');
  const manifestBytes = boundedRead(join(generation, 'generation.json'), 1048576);
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch { fail('generation_manifest'); }
  if (manifest.schemaVersion !== 1 || manifest.generation !== snapshotDigest || manifest.snapshotDigest !== snapshotDigest
    || !Array.isArray(manifest.files) || manifest.files.length !== names.length) fail('generation_manifest');
  for (const name of expectedNames) {
    const existing = boundedRead(join(generation, name), 33554432);
    const proposed = boundedRead(join(stage, name), 33554432);
    if (existing.length !== proposed.length || sha(existing) !== sha(proposed)) fail('generation_mismatch');
  }
  return true;
}

export function discardOwnStage(stage, output, names) {
  if (dirname(stage) !== resolve(output) || !/^\.staging-[0-9a-f-]{36}$/.test(relative(output, stage))) fail('stage_path');
  const info = lstatSync(stage);
  if (!info.isDirectory() || info.isSymbolicLink()) fail('stage_path');
  for (const name of [...names, 'generation.json']) unlinkSync(join(stage, name));
  rmdirSync(stage);
}

export function buildBundle(snapshot, graph, prior, basis) {
  const input = sourceInput(snapshot, graph), current = sourceReport(JSON.stringify(input));
  const bound = bindCurrentSourceBasis(current, basis, () => snapshot.digest);
  return Object.freeze({ input, current, structure: renderReportHtml(current), comparison: renderCurrentSourceComparison(prior, current, bound) });
}

function main() {
  if (process.argv.length !== 2) fail('arguments');
  const first = captureSource(repo), graph = extractGraph(first), before = sourceBasis(first.digest);
  const priorSource = boundedRead(join(archive, 'source.json'), 1048576), priorResult = boundedRead(join(archive, 'result.json'), 4194304), priorHtml = boundedRead(join(archive, 'cue-source-structure.html'), 33554432);
  const prior = restoreArchivedSource(priorSource.toString('utf8'), priorResult.toString('utf8'), priorHtml.toString('utf8'), archivePins.source, archivePins.result);
  const bundle = buildBundle(first, graph, prior, before), metadata = extractionMetadata();
  mkdirSync(output, { recursive: true });
  const generations = join(output, 'generations'); mkdirSync(generations, { recursive: true });
  const generationName = first.digest, generation = join(generations, generationName);
  const stage = join(output, `.staging-${randomUUID()}`); mkdirSync(stage);
  const receipt = createReportDelivery(stage).deliver('cue-current-source', bundle.current, bundle.structure);
  atomic(join(stage, 'cue-current-comparison.html'), Buffer.from(bundle.comparison.html));
  atomic(join(stage, 'source.json'), Buffer.from(JSON.stringify(bundle.input, null, 2)));
  verifySource(first); const after = sourceBasis(captureSource(repo).digest); assertStableBasis(before, after, first.digest);
  atomic(join(stage, 'source-basis.json'), Buffer.from(JSON.stringify({ before, after, scope: 'Git status is fixed to app and daemon/src; evidence, scripts, tests, and output writes are excluded.' }, null, 2)));
  atomic(join(stage, 'result.json'), Buffer.from(JSON.stringify({ snapshotDigest: first.digest, ...metadata, fileCount: first.files.length, edgeCount: graph.edges.length, inventory: first.inventory, imports: graph.imports, edges: graph.edges, archivePins, receipt,
    comparison: { ...bundle.comparison, html: undefined }, scope: 'Current bounded static source bytes and declared imports only; no runtime, influence, safety, clean-Git, model, or completion claim.' }, null, 2)));
  const names = ['cue-current-source.html', 'cue-current-comparison.html', 'source.json', 'source-basis.json', 'result.json'];
  const files = names.map(name => { const bytes = boundedRead(join(stage, name), 33554432); return Object.freeze({ name, sha256: sha(bytes), bytes: bytes.length }); });
  const manifest = Buffer.from(JSON.stringify({ schemaVersion: 1, generation: generationName, snapshotDigest: first.digest, files }, null, 2));
  atomic(join(stage, 'generation.json'), manifest);
  verifySource(first); assertStableBasis(before, sourceBasis(captureSource(repo).digest), first.digest);
  const reused = reuseExistingGeneration(generation, stage, names, first.digest);
  if (reused) discardOwnStage(stage, output, names); else renameSync(stage, generation);
  const pointer = { schemaVersion: 1, generation: `generations/${generationName}`, snapshotDigest: first.digest, manifestSha256: sha(manifest) };
  publishPointer(join(output, 'current-generation.json'), pointer, () => {
    verifySource(first); assertStableBasis(before, sourceBasis(captureSource(repo).digest), first.digest);
    if (sha(boundedRead(join(generation, 'generation.json'), 1048576)) !== pointer.manifestSha256) fail('generation_changed');
  });
  console.log(JSON.stringify({ ready: true, reused, generation: pointer.generation, snapshotDigest: first.digest, files: first.files.length, edges: graph.edges.length, structureSha256: receipt.artifactSha256, comparisonSha256: bundle.comparison.artifactSha256 }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
