import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';

const roots:string[]=[],connections:Ledger[]=[];
afterEach(()=>{for(const db of connections.splice(0))if(db.open)db.close();for(const root of roots.splice(0)){if(dirname(resolve(root))!==resolve(tmpdir())||!basename(root).startsWith('cue-staging-schema-'))throw Error('unsafe_cleanup');rmSync(root,{recursive:true,force:true});}});
function fixture(){const root=mkdtempSync(join(tmpdir(),'cue-staging-schema-'));roots.push(root);const path=join(root,'ledger.db'),db=openLedger(path);connections.push(db);return{path,db};}

test('unchanged attempt staging definitions reopen',()=>{
  const{path,db}=fixture();
  expect(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND (name GLOB 'attempt_staging_*' OR name='run_staging_authority')").get()).toEqual({n:8});
  db.close();const reopened=openLedger(path);connections.push(reopened);
  expect(reopened.prepare("SELECT version FROM attempt_staging_migration WHERE singleton=1").get()).toEqual({version:'cue-attempt-staging-authority-v1'});
  expect(reopened.prepare("SELECT version FROM attempt_staging_discard_migration WHERE singleton=1").get()).toEqual({version:'cue-attempt-staging-discard-v1'});
});

test('an exact 047 ledger upgrades to discard authority once and reopens',()=>{
  const{path,db}=fixture(),legacy=readFileSync(resolve('migrations/047_attempt_staging_authority.sql'),'utf8');
  for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name GLOB 'attempt_staging_discard*'").all() as {name:string}[])db.exec(`DROP TRIGGER ${name}`);
  db.exec('DROP TRIGGER attempt_staging_lease_no_unsafe_delete; DROP TRIGGER attempt_staging_lease_no_unsafe_update; DROP TRIGGER attempt_staging_lease_no_unsafe_replace; DROP TABLE attempt_staging_discard; DROP TABLE attempt_staging_discard_authorization; DROP TABLE attempt_staging_discard_migration;');
  db.exec(legacy.slice(legacy.indexOf('CREATE TRIGGER attempt_staging_lease_no_unsafe_delete'),legacy.indexOf('INSERT INTO attempt_staging_migration')));
  db.close();const upgraded=openLedger(path);connections.push(upgraded);expect(upgraded.prepare("SELECT version FROM attempt_staging_discard_migration WHERE singleton=1").get()).toEqual({version:'cue-attempt-staging-discard-v1'});upgraded.close();const reopened=openLedger(path);connections.push(reopened);expect(reopened.prepare('SELECT count(*) n FROM attempt_staging_discard').get()).toEqual({n:0});
});

test('partial or weakened discard authority refuses startup',()=>{
  const partial=fixture();partial.db.exec('DROP TABLE attempt_staging_discard');partial.db.close();expect(()=>openLedger(partial.path)).toThrow('attempt_staging_discard_migration_partial');
  const weakened=fixture();weakened.db.exec('DROP TRIGGER attempt_staging_discard_insert_guard; CREATE TRIGGER attempt_staging_discard_insert_guard BEFORE INSERT ON attempt_staging_discard BEGIN SELECT 1; END');weakened.db.close();expect(()=>openLedger(weakened.path)).toThrow('attempt_staging_discard_migration_definition');
});

test('partial attempt staging install refuses startup',()=>{
  const{path,db}=fixture();db.exec('DROP TABLE attempt_staging_cleanup');db.close();
  expect(()=>openLedger(path)).toThrow('attempt_staging_migration_partial');
});

test('same-name weakened staging trigger refuses startup',()=>{
  const{path,db}=fixture();db.exec("DROP TRIGGER attempt_staging_setup_insert_guard; CREATE TRIGGER attempt_staging_setup_insert_guard BEFORE INSERT ON attempt_staging_setup BEGIN SELECT 1; END");db.close();
  expect(()=>openLedger(path)).toThrow('attempt_staging_migration_definition');
});

test('altered staging table definition refuses startup',()=>{
  const{path,db}=fixture();db.exec('ALTER TABLE attempt_staging_authority ADD COLUMN unreviewed TEXT');db.close();
  expect(()=>openLedger(path)).toThrow('attempt_staging_migration_definition');
});

test('all staging tables and lease guards are immutable definitions',()=>{
  const{db}=fixture();
  const names=(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name GLOB 'attempt_staging_*' ORDER BY name").all() as Array<{name:string}>).map(row=>row.name);
  expect(names).toEqual(expect.arrayContaining(['attempt_staging_setup_no_update','attempt_staging_setup_no_delete','attempt_staging_setup_no_replace','attempt_staging_authority_no_update','attempt_staging_authority_no_delete','attempt_staging_authority_no_replace','attempt_staging_cleanup_no_update','attempt_staging_cleanup_no_delete','attempt_staging_cleanup_no_replace','attempt_staging_lease_no_unsafe_delete','attempt_staging_lease_no_unsafe_update','attempt_staging_lease_no_unsafe_replace']));
});

test('compiled package carries the exact staging migrations and opens them on fresh and reopened ledgers',()=>{
  for(const name of ['047_attempt_staging_authority.sql','048_attempt_staging_discard.sql']){const source=readFileSync(resolve('migrations',name)),packaged=readFileSync(resolve('dist/migrations',name));expect(createHash('sha256').update(packaged).digest('hex')).toBe(createHash('sha256').update(source).digest('hex'));}
  const root=mkdtempSync(join(tmpdir(),'cue-staging-schema-'));roots.push(root);const path=join(root,'compiled.db');
  const script=`import{openLedger}from${JSON.stringify(new URL('../dist/src/ledger.js',import.meta.url).href)};const p=process.argv[1];let d=openLedger(p);if(d.prepare("SELECT version FROM attempt_staging_migration WHERE singleton=1").get().version!=="cue-attempt-staging-authority-v1"||d.prepare("SELECT version FROM attempt_staging_discard_migration WHERE singleton=1").get().version!=="cue-attempt-staging-discard-v1")process.exit(2);d.close();d=openLedger(p);if(d.prepare("SELECT count(*) n FROM attempt_staging_setup").get().n!==0)process.exit(3);d.close();`;
  expect(()=>execFileSync(process.execPath,['--input-type=module','-e',script,path],{stdio:'pipe'})).not.toThrow();
});
