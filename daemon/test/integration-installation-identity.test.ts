import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync, symlinkSync, truncateSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { captureInstallationIdentity, isInstallationGeneration } from '../../app/installation-identity.mjs';
const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0)){const absolute=resolve(root);expect(dirname(absolute)).toBe(resolve(tmpdir()));expect(basename(absolute).startsWith('cue-installation-fixture-')).toBe(true);rmSync(absolute,{recursive:true,force:true});}});
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'cue-installation-fixture-'));roots.push(root);const dependencyRoot=join(root,'dependencies');
  for(const dir of ['app','daemon/src','daemon/dist/src','daemon/migrations','daemon/dist/migrations','daemon/native/change-snapshot','daemon/dist/native/change-snapshot','dependencies/better-sqlite3/lib','dependencies/better-sqlite3/build/Release','dependencies/better-sqlite3/prebuilds/win32-x64'])mkdirSync(join(root,...dir.split('/')),{recursive:true});
  for(const file of ['package.json','package-lock.json','daemon/package.json','daemon/package-lock.json'])writeFileSync(join(root,file),'{}');
  for(const file of ['app/main.mjs','app/core.mjs','app/installation-identity.mjs','daemon/src/ledger.ts','daemon/dist/src/ledger.js'])writeFileSync(join(root,file),'throw Error("must not execute fixture");');
  writeFileSync(join(root,'daemon/migrations/001.sql'),'CREATE TABLE fixture(id);');writeFileSync(join(root,'daemon/dist/migrations/001.sql'),'CREATE TABLE fixture(id);');
  for(const base of ['daemon/native/change-snapshot','daemon/dist/native/change-snapshot']){writeFileSync(join(root,base,'manifest.json'),'{"fixture":true}');writeFileSync(join(root,base,'change-snapshot.exe'),'reviewed fixture helper');}
  const sqlite=join(dependencyRoot,'better-sqlite3');writeFileSync(join(sqlite,'package.json'),JSON.stringify({name:'better-sqlite3',version:'13.0.3',main:'lib/index.js',dependencies:{'node-addon-api':'^8.2.0'}}));
  writeFileSync(join(sqlite,'lib/index.js'),'throw Error("loader must never execute");');writeFileSync(join(sqlite,'lib/database.js'),'throw Error("database must never execute");');
  writeFileSync(join(sqlite,'build/Release/better_sqlite3.node'),'fake native bytes');writeFileSync(join(sqlite,'prebuilds/win32-x64/addon.node'),'other fake native bytes');
  return {root,dependencyRoot,sqlite};
}
test('builtin capture never executes loader/native bytes, records runtime ABI and self TCB, freezes and rechecks exact generation',()=>{
  const f=fixture(),guard=captureInstallationIdentity({root:f.root,dependencyRoot:f.dependencyRoot});
  expect(isInstallationGeneration(guard)).toBe(true);
  let invoked=false;
  const forged=Object.defineProperty({...guard},'assertCurrent',{get(){invoked=true;return()=>true;}});
  for(const value of [undefined,null,1,{},Object.freeze({...guard}),new Proxy(guard,{}),forged]) expect(isInstallationGeneration(value)).toBe(false);
  expect(invoked).toBe(false);
  expect(guard.assertCurrent()).toBe(true);expect(guard.digest).toMatch(/^[a-f0-9]{64}$/);expect(Object.isFrozen(guard.snapshot.files)).toBe(true);expect(Object.isFrozen(guard.snapshot.runtime)).toBe(true);
  expect(guard.snapshot.runtime).toMatchObject({node:process.versions.node,electron:process.versions.electron??null,abi:process.versions.modules,platform:process.platform,arch:process.arch});
  expect(guard.snapshot.runtime.sha256).toMatch(/^[a-f0-9]{64}$/);expect(guard.snapshot.runtime.size).toBeGreaterThan(0);
  expect(guard.snapshot.helper.sha256).toBe(createHash('sha256').update(readFileSync(new URL('../../app/installation-identity.mjs',import.meta.url))).digest('hex'));
  expect(guard.snapshot.files.filter(file=>file.label.endsWith('.node'))).toHaveLength(2);
  expect(captureInstallationIdentity({root:f.root,dependencyRoot:f.dependencyRoot}).digest).toBe(guard.digest);
});
test.each(['app/main.mjs','app/core.mjs','daemon/src/ledger.ts','daemon/dist/src/ledger.js','daemon/migrations/001.sql','daemon/dist/migrations/001.sql','daemon/native/change-snapshot/manifest.json','daemon/native/change-snapshot/change-snapshot.exe','daemon/dist/native/change-snapshot/manifest.json','daemon/dist/native/change-snapshot/change-snapshot.exe','package-lock.json','dependencies/better-sqlite3/lib/database.js','dependencies/better-sqlite3/build/Release/better_sqlite3.node'])('changed entry/source/compiled/migration/lock/loader/native bytes reject: %s',file=>{
  const f=fixture(),guard=captureInstallationIdentity({root:f.root,dependencyRoot:f.dependencyRoot});writeFileSync(join(f.root,file),'different bytes');expect(()=>guard.assertCurrent()).toThrow('installation_identity');
});
test.each(['add','delete'])('directory inventory rejects %s even when all remaining original bytes match',operation=>{
  const f=fixture(),guard=captureInstallationIdentity({root:f.root,dependencyRoot:f.dependencyRoot});
  if(operation==='add')writeFileSync(join(f.root,'daemon/dist/src/new-loader.js'),'new file');else unlinkSync(join(f.root,'daemon/dist/src/ledger.js'));
  expect(()=>guard.assertCurrent()).toThrow('installation_identity');
});
test('unsupported package dependencies/version, missing native and oversized file fail closed',()=>{
  for(const change of ['version','dependency','native','oversize']){
    const f=fixture();
    if(change==='version'||change==='dependency')writeFileSync(join(f.sqlite,'package.json'),JSON.stringify({name:'better-sqlite3',version:change==='version'?'13.0.4':'13.0.3',main:'lib/index.js',dependencies:{...(change==='dependency'?{bindings:'1'}:{'node-addon-api':'8'})}}));
    if(change==='native'){unlinkSync(join(f.sqlite,'build/Release/better_sqlite3.node'));unlinkSync(join(f.sqlite,'prebuilds/win32-x64/addon.node'));}
    if(change==='oversize')truncateSync(join(f.sqlite,'build/Release/better_sqlite3.node'),268435457);
    expect(()=>captureInstallationIdentity({root:f.root,dependencyRoot:f.dependencyRoot})).toThrow('installation_identity');
  }
});
test('actual junction/symlink package escape and hostile input accessor are rejected',()=>{
  const f=fixture(),outside=fixture(),lib=resolve(f.sqlite,'lib');expect(lib.startsWith(resolve(f.root)+sep)).toBe(true);rmSync(lib,{recursive:true});symlinkSync(join(outside.sqlite,'lib'),lib,process.platform==='win32'?'junction':'dir');
  expect(()=>captureInstallationIdentity({root:f.root,dependencyRoot:f.dependencyRoot})).toThrow('installation_identity');
  let accessed=false;const input=Object.defineProperty({dependencyRoot:f.dependencyRoot},'root',{enumerable:true,get(){accessed=true;return f.root;}});
  expect(()=>captureInstallationIdentity(input as {root:string;dependencyRoot:string})).toThrow('installation_identity');expect(accessed).toBe(false);
});
