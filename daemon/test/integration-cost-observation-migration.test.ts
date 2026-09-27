import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';
const roots: string[] = [], connections: Ledger[] = [];
afterEach(() => {
  for (const db of connections.splice(0)) if (db.open) db.close();
  for (const root of roots.splice(0)) {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('cue-cost-schema-')) throw Error('unsafe_cleanup');
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-cost-schema-')); roots.push(root);
  const path = join(root, 'ledger.db'), db = openLedger(path); connections.push(db); return {path, db};
}
const marker = (db: Ledger) => db.prepare('SELECT version FROM cost_observation_migration WHERE singleton=1').get();
test('fresh and reopened ledger installs exact immutable cost observation definitions', () => {
  const {path,db} = fixture();
  expect(marker(db)).toEqual({version:'cue-persisted-cost-observation-v1'});
  expect(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'cost_observation_*'").get()).toEqual({n:4});
  db.close(); const reopened = openLedger(path); connections.push(reopened); expect(marker(reopened)).toEqual({version:'cue-persisted-cost-observation-v1'});
});
test('048 database upgrades without changing staging or preexisting application rows', () => {
  const {path,db}=fixture();
  db.prepare("INSERT INTO task VALUES('preserve','queued',NULL,'now')").run();
  db.exec('DROP TABLE orchestration_cost_observation; DROP TABLE cost_observation_migration');
  expect(db.prepare("SELECT version FROM attempt_staging_discard_migration WHERE singleton=1").get()).toEqual({version:'cue-attempt-staging-discard-v1'});
  db.close(); const upgraded=openLedger(path);connections.push(upgraded);
  expect(marker(upgraded)).toEqual({version:'cue-persisted-cost-observation-v1'});
  expect(upgraded.prepare("SELECT id,state FROM task WHERE id='preserve'").get()).toEqual({id:'preserve',state:'queued'});
});
test('partial, weakened-trigger and altered-table cost schemas refuse reopening', () => {
  for(const sql of ['DROP TABLE orchestration_cost_observation',
    "DROP TRIGGER cost_observation_insert_guard; CREATE TRIGGER cost_observation_insert_guard BEFORE INSERT ON orchestration_cost_observation BEGIN SELECT 1; END",
    'ALTER TABLE orchestration_cost_observation ADD COLUMN unreviewed TEXT']) {
    const {path,db}=fixture();db.exec(sql);db.close();expect(()=>openLedger(path)).toThrow(/cost_observation_migration_(partial|definition)/);
  }
});
test('packaged049 matches source and compiled startup supports fresh and reopened cost schema', () => {
  expect(readFileSync(resolve('dist/migrations/049_cost_observation.sql'))).toEqual(readFileSync(resolve('migrations/049_cost_observation.sql')));
  const root=mkdtempSync(join(tmpdir(),'cue-cost-schema-'));roots.push(root);const path=join(root,'compiled.db');
  const script=`import{openLedger}from${JSON.stringify(new URL('../dist/src/ledger.js',import.meta.url).href)};for(let n=0;n<2;n++){let db=openLedger(process.argv[1]);if(db.prepare("SELECT version FROM cost_observation_migration WHERE singleton=1").get().version!=='cue-persisted-cost-observation-v1')process.exit(2);db.close();}`;
  expect(()=>execFileSync(process.execPath,['--input-type=module','-e',script,path],{stdio:'pipe'})).not.toThrow();
});
