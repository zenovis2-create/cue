import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) {
  expect(dirname(resolve(root))).toBe(resolve(tmpdir()));
  expect(basename(root).startsWith('cue-guarded-entry-')).toBe(true);
  rmSync(root, { recursive: true, force: true });
} });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-guarded-entry-')); roots.push(root);
  for (const dir of ['app', 'daemon/src', 'daemon/dist/src', 'daemon/migrations', 'daemon/dist/migrations', 'daemon/native/change-snapshot', 'daemon/dist/native/change-snapshot', 'daemon/node_modules/better-sqlite3/lib', 'daemon/node_modules/better-sqlite3/build/Release']) mkdirSync(join(root, dir), { recursive: true });
  for (const file of ['package.json', 'package-lock.json', 'daemon/package.json', 'daemon/package-lock.json']) writeFileSync(join(root, file), '{}');
  for (const name of ['guarded-entry.mjs', 'installation-identity.mjs']) writeFileSync(join(root, 'app', name), readFileSync(new URL('../../app/' + name, import.meta.url)));
  for (const relativePath of ['daemon/native/change-snapshot/manifest.json','daemon/native/change-snapshot/change-snapshot.exe','daemon/dist/native/change-snapshot/manifest.json','daemon/dist/native/change-snapshot/change-snapshot.exe']) writeFileSync(join(root,relativePath),readFileSync(new URL('../../'+relativePath,import.meta.url)));
  const digest=(relativePath:string)=>createHash('sha256').update(readFileSync(join(root,relativePath))).digest('hex');
  expect(digest('daemon/native/change-snapshot/manifest.json')).toBe(digest('daemon/dist/native/change-snapshot/manifest.json'));
  expect(digest('daemon/native/change-snapshot/change-snapshot.exe')).toBe(digest('daemon/dist/native/change-snapshot/change-snapshot.exe'));
  writeFileSync(join(root, 'app', 'fixture.mjs'), 'if (!globalThis.captured) throw Error("import_before_capture"); export const value = 17;');
  writeFileSync(join(root, 'daemon/node_modules/better-sqlite3/package.json'), JSON.stringify({ name: 'better-sqlite3', version: '13.0.3', main: 'lib/index.js', dependencies: { 'node-addon-api': '^8.2.0' } }));
  writeFileSync(join(root, 'daemon/node_modules/better-sqlite3/lib/index.js'), 'throw Error("sqlite_must_not_load");');
  writeFileSync(join(root, 'daemon/node_modules/better-sqlite3/build/Release/better_sqlite3.node'), 'fixture native bytes');
  return root;
}
function execute(mode: string, electron = false) {
  const root = fixture();
  const script = `import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {runGuardedEntry} from './app/guarded-entry.mjs';
const mode=${JSON.stringify(mode)};
let called=0;
const operation=runGuardedEntry(async guard=>{
  called++; assert.equal(guard.assertCurrent(),true); globalThis.captured=true;
  if(mode==='failure')throw Error('fixture_loader_failure');
  const loaded=await import('./app/fixture.mjs');
  if(mode==='drift')writeFileSync(new URL('./app/fixture.mjs',import.meta.url),'changed');
  await Promise.resolve(); return loaded;
});
await assert.rejects(runGuardedEntry(()=>{throw Error('second_loader_called');}),/already_attempted/);
if(mode==='failure')await assert.rejects(operation,/fixture_loader_failure/);
else if(mode==='drift')await assert.rejects(operation,/installation_identity/);
else {const result=await operation; assert.equal(result.loaded.value,17); assert.equal(result.guard.assertCurrent(),true); assert.equal(Object.isFrozen(result),true); console.log(JSON.stringify({kind:'fixture-installation-ordering',runtime:result.guard.snapshot.runtime,digest:result.guard.digest,files:result.guard.snapshot.files.map(f=>({label:f.label,sha256:f.sha256})),helper:result.guard.snapshot.helper.sha256}));}
assert.equal(called,1);
await assert.rejects(runGuardedEntry(()=>{}),/already_attempted/);
${electron ? "const {app}=await import('electron'); app.exit(0);" : ''}
`;
  writeFileSync(join(root, 'runner.mjs'), script);
  // Electron binary resolution executes its installed package locator only in the
  // test parent. The child entry imports no application/SQLite loader beforehand.
  const executable: string = electron ? createRequire(new URL('../../package.json', import.meta.url))('electron') : process.execPath;
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(executable, [join(root, 'runner.mjs')], { windowsHide: true, encoding: 'utf8', timeout: 60000, env });
  expect(result.error).toBeUndefined(); expect(result.status, result.stderr).toBe(0);
  if (mode === 'success') {
    const record = JSON.parse(result.stdout.split(/\r?\n/).find(line => line.startsWith('{'))!);
    expect(record.runtime.electron !== null).toBe(electron);
    expect(record.helper).toMatch(/^[a-f0-9]{64}$/);
    expect(record.files.some((f: { label: string }) => f.label.endsWith('app/guarded-entry.mjs'))).toBe(true);
    console.log(JSON.stringify(record));
  }
}
test.each(['success', 'failure', 'drift'])('fresh Node canonical entry %s rejects concurrent/repeated attempts', mode => execute(mode), 60000);
test('actual Electron runtime loads only synthetic fixture after capture (not actual project installation proof)', () => execute('success', true), 60000);
