import { afterEach, expect, test } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const REVIEWED = '82ff0f80ecb63293de0eed39296bf66ad51b4cfdeee2d8d7aaea062fae80d07e';
const roots: string[] = [];
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
afterEach(() => { for (const root of roots.splice(0)) { const full=resolve(root); expect(dirname(full)).toBe(resolve(tmpdir())); expect(basename(full).startsWith('cue-journal-package-')).toBe(true); rmSync(full,{recursive:true,force:true}); } });

function isolatedCompiledHost() {
  const root=mkdtempSync(join(tmpdir(),'cue-journal-package-')); roots.push(root);
  const source=resolve('dist/src/change-snapshot-host.js'), src=join(root,'dist/src'), native=join(root,'dist/native/change-snapshot');
  mkdirSync(src,{recursive:true}); mkdirSync(native,{recursive:true});
  copyFileSync(source,join(src,'change-snapshot-host.js'));
  copyFileSync(resolve('dist/src/process-launch.js'),join(src,'process-launch.js'));
  copyFileSync(resolve('dist/native/change-snapshot/change-snapshot.exe'),join(native,'change-snapshot.exe'));
  copyFileSync(resolve('dist/native/change-snapshot/manifest.json'),join(native,'manifest.json'));
  return {root,module:join(src,'change-snapshot-host.js'),native};
}
async function importFresh(path: string) { return import(pathToFileURL(path).href+`?fixture=${randomUUID()}`); }

test('checked manifest binds reviewed binary and exact source provenance',()=>{
  const root=resolve('native/change-snapshot'), manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
  expect(manifest).toMatchObject({schema:'cue-native-helper-manifest-v1',protocol:'cue-change-snapshot-v1',artifact:{path:'change-snapshot.exe',sha256:REVIEWED,platform:'win32',arch:'x64'}});
  expect(manifest.provenance).toMatchObject({review:'evidence/integrations/S3/20260915-existing-file-publication/native/review.md',buildPolicy:'prebuilt-reviewed-no-download-no-startup-compilation'});
  for(const entry of [manifest.artifact,...manifest.sources]) expect(digest(join(root,entry.path))).toBe(entry.sha256);
});

test('compiled host resolves only its copied reviewed asset and publishes frozen metadata',async()=>{
  const fixture=isolatedCompiledHost(), host=await importFresh(fixture.module), metadata=host.getChangeSnapshotHelperMetadata();
  expect(metadata).toEqual({protocol:'cue-change-snapshot-v1',helperSha256:REVIEWED,helperPath:resolve(fixture.native,'change-snapshot.exe')});
  expect(Object.isFrozen(metadata)).toBe(true);
  expect(host.changeSnapshotHelper.path).toBe(resolve(fixture.native,'change-snapshot.exe'));
  expect(host.changeSnapshotHelper.path).not.toContain(resolve('native/change-snapshot'));
});

test.each(['missing','mismatch'])('compiled host fails closed when copied helper is %s',async condition=>{
  const fixture=isolatedCompiledHost(), helper=join(fixture.native,'change-snapshot.exe');
  if(condition==='missing') unlinkSync(helper); else writeFileSync(helper,'not the reviewed helper');
  const host=await importFresh(fixture.module);
  expect(host.getChangeSnapshotHelperMetadata()).toBeNull();
  expect(host.changeSnapshotHelper.sha256).toBeNull();
  const result=host.identifyChangeSnapshotRoot(fixture.root);
  expect(result.state).not.toBe('ok');
});

test('compiled host fails closed when copied manifest digest binding is changed',async()=>{
  const fixture=isolatedCompiledHost(), path=join(fixture.native,'manifest.json'), manifest=JSON.parse(readFileSync(path,'utf8'));
  manifest.artifact.sha256='0'.repeat(64); writeFileSync(path,JSON.stringify(manifest));
  const host=await importFresh(fixture.module);
  expect(host.getChangeSnapshotHelperMetadata()).toBeNull(); expect(host.changeSnapshotHelper.sha256).toBeNull();
});
