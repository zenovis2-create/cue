import {afterEach,expect,test} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {openLedger,type Ledger} from '../src/ledger.js';

const roots:string[]=[],connections:Ledger[]=[];
afterEach(()=>{for(const db of connections.splice(0))if(db.open)db.close();for(const root of roots.splice(0)){
  if(dirname(resolve(root))!==resolve(tmpdir())||!basename(root).startsWith('cue-staging-task-schema-'))throw Error('unsafe_fixture_cleanup');
  rmSync(root,{recursive:true,force:true});
}});
const fixture=()=>{const root=mkdtempSync(join(tmpdir(),'cue-staging-task-schema-'));roots.push(root);const path=join(root,'ledger.sqlite'),db=openLedger(path);connections.push(db);return{path,db};};

test('task-specific staging root authority installs, reopens, and has immutable guards',()=>{
  const {path,db}=fixture();
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='run_staging_task_authority'").get()).toEqual({name:'run_staging_task_authority'});
  const guard=db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='attempt_staging_setup_insert_guard'").get() as {sql:string};
  expect(guard.sql).toContain('run_staging_task_authority sta');
  expect(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'run_staging_task_authority_*'").get()).toEqual({n:4});
  db.close();const reopened=openLedger(path);connections.push(reopened);
  expect(reopened.prepare('SELECT count(*) n FROM run_staging_task_authority').get()).toEqual({n:0});
});

test('weakened task authority or setup trigger fails reopening',()=>{
  const first=fixture();first.db.exec("DROP TRIGGER run_staging_task_authority_insert_guard; CREATE TRIGGER run_staging_task_authority_insert_guard BEFORE INSERT ON run_staging_task_authority BEGIN SELECT 1; END");first.db.close();
  expect(()=>openLedger(first.path)).toThrow();
  const second=fixture();second.db.exec("DROP TRIGGER attempt_staging_setup_insert_guard; CREATE TRIGGER attempt_staging_setup_insert_guard BEFORE INSERT ON attempt_staging_setup BEGIN SELECT 1; END");second.db.close();
  expect(()=>openLedger(second.path)).toThrow();
});

test('packaged migration 051 exactly matches source',()=>{
  const source=readFileSync(resolve('migrations/051_attempt_staging_task_authority.sql'));
  const packaged=readFileSync(resolve('dist/migrations/051_attempt_staging_task_authority.sql'));
  expect(createHash('sha256').update(packaged).digest('hex')).toBe(createHash('sha256').update(source).digest('hex'));
});
