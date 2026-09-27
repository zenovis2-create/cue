import { afterEach, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createCueCore, initializeConfig, type CueCore } from '../../app/core.mjs';

const roots: string[] = [], cores: CueCore[] = [];
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
afterEach(async () => {
  for (const core of cores.splice(0)) if (core.daemon.db.open) await core.close();
  for (const root of roots.splice(0)) {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.startsWith(join(tmpdir(), 'cue-resource-core-'))) throw Error('unsafe-test-cleanup');
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-resource-core-')); roots.push(root);
  const work = join(root, 'work'), pack = join(root, 'package'); mkdirSync(work); mkdirSync(pack);
  const config = initializeConfig(join(root, 'data'), { worktreeRoot: work });
  const open = () => { const core = createCueCore(config); cores.push(core); return core; };
  function resource(version = '1.0.0', text = '앞부분 한글 reference 자료입니다.') {
    const bytes = Buffer.from(text); writeFileSync(join(pack, 'guide.md'), bytes);
    const manifest = JSON.stringify({ schemaVersion: 1, id: 'demo', version, source: 'https://example.com/resources', revision: 'a'.repeat(40),
      resources: [{ id: 'guide', kind: 'knowledge', path: 'guide.md', sha256: hash(bytes), byteLength: bytes.length }] });
    writeFileSync(join(pack, 'manifest.json'), manifest); return { root: pack, manifestSha256: hash(manifest) };
  }
  return { open, resource, pack };
}

test('empty pin is fixed before approval and import exposes metadata only', () => {
  const f = fixture(), core = f.open(), empty = core.prepareGoal('empty resources');
  expect(empty).not.toHaveProperty('resourcePin');
  expect(core.readResourcePin(empty.runId).packages).toEqual([]);
  const metadata = core.importResourcePackage(f.resource());
  expect(Object.keys(metadata).sort()).toEqual(['authority', 'id', 'manifestSha256', 'resourceCount', 'totalBytes', 'version']);
  expect(Object.isFrozen(metadata)).toBe(true); expect(metadata.authority).toBe('reference-only');
  expect(core.listResourcePackages()).toEqual([metadata]);
  expect(core.searchResources({ runId: empty.runId, query: 'reference', limit: 5 })).toEqual([]);
  const prepared = core.prepareGoal('use references');
  expect(prepared.resourcePin?.packages).toEqual([metadata]);
  expect(core.daemon.db.prepare('SELECT count(*) n FROM approval_event').get()).toEqual({ n: 0 });
});

test('update, removal and reopen preserve exact pinned bytes without reading package paths', async () => {
  const f = fixture(); let core = f.open(); const text = '\ufeff앞부분 한글 reference 자료입니다.';
  core.importResourcePackage(f.resource('1.0.0', text)); const first = core.prepareGoal('reference lookup');
  const search = () => core.searchResources({ runId: first.runId, query: 'reference', limit: 5 });
  const hits = search(); expect(hits).toHaveLength(1);
  const hit = hits[0]!; expect(hit.sha256).toBe(hash(Buffer.from(text)));
  expect(Buffer.from(text).subarray(hit.byteStart, hit.byteEnd).toString('utf8')).toBe(hit.excerpt);
  expect(hit.authority).toBe('reference-only'); expect(hit.sourceVerification).toBe('declared-not-remote-verified');
  core.importResourcePackage(f.resource('2.0.0', 'changed contents'));
  expect(core.prepareGoal('later').resourcePin?.packages[0]?.version).toBe('2.0.0');
  expect(core.removeResourcePackage('demo')).toBe(true); expect(core.removeResourcePackage('demo')).toBe(false);
  expect(search()).toEqual(hits); expect(core.listResourcePackages()).toEqual([]);
  rmSync(join(f.pack, 'manifest.json')); rmSync(join(f.pack, 'guide.md'));
  await core.close(); core = f.open();
  expect(core.readResourcePin(first.runId)).toEqual(first.resourcePin); expect(search()).toEqual(hits);
});

test('failed preparation rolls back task, run and resource pin together', () => {
  const f = fixture(), core = f.open(); core.importResourcePackage(f.resource());
  core.daemon.db.exec("CREATE TRIGGER test_pin_abort AFTER INSERT ON resource_run_pin BEGIN SELECT RAISE(ABORT,'fixture_after_pin'); END");
  expect(() => core.prepareGoal('rollback')).toThrow('fixture_after_pin');
  for (const table of ['task', 'run', 'resource_run_pin', 'approval_event']) expect(core.daemon.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
  core.daemon.db.exec('DROP TRIGGER test_pin_abort');
  expect(core.prepareGoal('retry preparation').resourcePin?.packages).toHaveLength(1);
});

test('unknown and unpinned runs never search active packages; strict inputs execute no getters', () => {
  const f = fixture(), core = f.open(); core.importResourcePackage(f.resource());
  const run = core.prepareGoal('seed'), db = core.daemon.db;
  const row = db.prepare('SELECT task_id,envelope_hash FROM run WHERE id=?').get(run.runId);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('unpinned', row.task_id, row.envelope_hash, 0, 'now');
  expect(() => core.readResourcePin('missing')).toThrow('resource_unknown_run');
  expect(() => core.readResourcePin('unpinned')).toThrow('resource_unpinned_run');
  for (const runId of ['missing', 'unpinned']) expect(() => core.searchResources({ runId, query: 'reference', limit: 1 })).toThrow();
  let calls = 0; const approved = f.resource();
  for (const input of [Object.create(approved), { ...approved, url: 'http://other' },
    new Proxy(approved, { ownKeys() { calls++; return []; } }),
    { get root() { calls++; return approved.root; }, manifestSha256: approved.manifestSha256 },
  ]) expect(() => core.importResourcePackage(input)).toThrow('resource_input');
  expect(() => core.searchResources({ runId: run.runId, get query() { calls++; return 'reference'; }, limit: 1 })).toThrow('resource_input');
  expect(() => core.searchResources({ runId: run.runId, query: 'reference', limit: 11 })).toThrow('resource_query');
  expect(calls).toBe(0);
});
