import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
type Snapshot = { digest: string; files: { path: string; sha256: string }[] };
type Graph = { edges: { id: string; from: string; to: string }[] };
const loadScripts = async () => {
  const extractionPath = new URL('../../scripts/reuse/cue-source-structure-report.mjs', import.meta.url).href;
  const currentPath = new URL('../../scripts/reuse/cue-current-source-report.mjs', import.meta.url).href;
  const reportPath = new URL('../dist/src/reports/ir.js', import.meta.url).href;
  const extraction = await import(extractionPath) as { captureSource(root: string): Snapshot; extractGraph(snapshot: Snapshot): Graph };
  const reports = await import(reportPath) as { sourceReport(json: string): unknown };
  const current = await import(currentPath) as {
    assertStableBasis(before: Basis, after: Basis, digest: string): void;
    publishPointer(path: string, pointer: object, validate: () => void): void;
    buildBundle(snapshot: Snapshot, graph: Graph, prior: unknown, basis: Basis): { input: { edges: Graph['edges'] }; current: { edges: readonly { id: string; from: string; to: string; provenance: string }[] }; structure: { html: string }; comparison: { html: string; artifactSha256: string } };
    reuseExistingGeneration(generation: string, stage: string, names: string[], digest: string): boolean;
    discardOwnStage(stage: string, output: string, names: string[]): void;
  };
  return { ...extraction, ...reports, ...current };
};
type Basis = { snapshotDigest: string; baseCommit: string; sourceStatusSha256: string; sourceStatusEntries: number };
test('builds current structure and comparison from bounded AST bytes without executing source', async () => {
  const { captureSource, extractGraph, sourceReport, buildBundle } = await loadScripts();
  const root = mkdtempSync(join(tmpdir(), 'cue-current-source-test-'));
  try {
    mkdirSync(join(root, 'app')); mkdirSync(join(root, 'daemon/src'), { recursive: true });
    writeFileSync(join(root, 'app/a.ts'), 'throw Error("must not execute"); import { b } from "../daemon/src/b.js";');
    writeFileSync(join(root, 'daemon/src/b.ts'), 'export const b = 1;');
    const snapshot = captureSource(root), graph = extractGraph(snapshot);
    const prior = sourceReport(JSON.stringify({ identity: 'cue-static-source-imports', revision: 'a'.repeat(64), files: [], nodes: [], edges: [] }));
    const basis = { snapshotDigest: snapshot.digest, baseCommit: 'b'.repeat(40), sourceStatusSha256: 'c'.repeat(64), sourceStatusEntries: 1 };
    const bundle = buildBundle(snapshot, graph, prior, basis);
    expect(graph.edges).toHaveLength(1); expect(bundle.structure.html).toContain('<svg');
    expect(bundle.input.edges).toEqual(graph.edges);
    expect(bundle.current.edges).toEqual(graph.edges.map(edge => ({ ...edge, provenance: 'source-declared-unverified' })));
    expect(bundle.comparison.html).toContain('현재 제한된 정적 소스 snapshot');
    expect(bundle.comparison.html).toContain(snapshot.digest);
    expect(bundle.comparison.artifactSha256).toBe(sha(bundle.comparison.html));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('removes only the exact internally named completed stage after reuse', async () => {
  const { discardOwnStage } = await loadScripts();
  const output = mkdtempSync(join(tmpdir(), 'cue-current-stage-test-'));
  const stage = join(output, '.staging-11111111-1111-4111-8111-111111111111');
  try {
    mkdirSync(stage); writeFileSync(join(stage, 'source.json'), 'source'); writeFileSync(join(stage, 'generation.json'), 'manifest');
    discardOwnStage(stage, output, ['source.json']);
    expect(() => readFileSync(join(stage, 'source.json'))).toThrow();
    const outside = join(tmpdir(), '.staging-11111111-1111-4111-8111-111111111111');
    expect(() => discardOwnStage(outside, output, ['source.json'])).toThrow('stage_path');
  } finally { rmSync(output, { recursive: true, force: true }); }
});
test('reuses only a byte-identical complete generation and rejects corruption or stale provenance', async () => {
  const { reuseExistingGeneration } = await loadScripts();
  const root = mkdtempSync(join(tmpdir(), 'cue-current-generation-test-'));
  const digest = 'a'.repeat(64), names = ['source.json', 'source-basis.json', 'result.json'];
  const make = (directory: string) => {
    mkdirSync(directory);
    const files = names.map(name => { const body = `${name}:current`; writeFileSync(join(directory, name), body); return { name, sha256: sha(body), bytes: Buffer.byteLength(body) }; });
    writeFileSync(join(directory, 'generation.json'), JSON.stringify({ schemaVersion: 1, generation: digest, snapshotDigest: digest, files }, null, 2));
  };
  try {
    const generation = join(root, 'generation'), stage = join(root, 'stage'); make(generation); make(stage);
    expect(reuseExistingGeneration(generation, stage, names, digest)).toBe(true);
    writeFileSync(join(generation, 'source.json'), 'tampered');
    expect(() => reuseExistingGeneration(generation, stage, names, digest)).toThrow('generation_mismatch');
    writeFileSync(join(generation, 'source.json'), 'source.json:current');
    writeFileSync(join(generation, 'source-basis.json'), 'stale provenance');
    expect(() => reuseExistingGeneration(generation, stage, names, digest)).toThrow('generation_mismatch');
    writeFileSync(join(generation, 'source-basis.json'), 'source-basis.json:current');
    writeFileSync(join(generation, 'unexpected'), 'x');
    expect(() => reuseExistingGeneration(generation, stage, names, digest)).toThrow('generation_entries');
    rmSync(join(generation, 'unexpected'));
    rmSync(join(generation, 'result.json'));
    expect(() => reuseExistingGeneration(generation, stage, names, digest)).toThrow('generation_entries');
    writeFileSync(join(generation, 'result.json'), 'result.json:current');
    const manifestPath = join(generation, 'generation.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); manifest.snapshotDigest = 'b'.repeat(64);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    expect(() => reuseExistingGeneration(generation, stage, names, digest)).toThrow('generation_manifest');
    expect(reuseExistingGeneration(join(root, 'missing'), stage, names, digest)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('generation pointer restores last-good and does not overwrite a competing commit', async () => {
  const { publishPointer } = await loadScripts();
  const root = mkdtempSync(join(tmpdir(), 'cue-current-pointer-test-')), path = join(root, 'current-generation.json');
  try {
    writeFileSync(path, 'previous');
    expect(() => publishPointer(path, { generation: 'next' }, () => { throw Error('late_validation'); })).toThrow('late_validation');
    expect(readFileSync(path, 'utf8')).toBe('previous');
    expect(() => publishPointer(path, { generation: 'next' }, () => { writeFileSync(path, 'competing'); throw Error('late_validation'); })).toThrow('late_validation');
    expect(readFileSync(path, 'utf8')).toBe('competing');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('source basis equality is scoped and fail-closed', async () => {
  const { assertStableBasis } = await loadScripts();
  const basis = { snapshotDigest: 'a'.repeat(64), baseCommit: 'b'.repeat(40), sourceStatusSha256: 'c'.repeat(64), sourceStatusEntries: 3 };
  expect(() => assertStableBasis(basis, { ...basis }, basis.snapshotDigest)).not.toThrow();
  for (const changed of [{ ...basis, baseCommit: 'd'.repeat(40) }, { ...basis, sourceStatusEntries: 4 }, { ...basis, sourceStatusSha256: 'e'.repeat(64) }])
    expect(() => assertStableBasis(basis, changed, basis.snapshotDigest)).toThrow('basis_changed');
});
