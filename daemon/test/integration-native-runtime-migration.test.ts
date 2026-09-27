import { readFileSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach,expect,it } from 'vitest';
import { openLedger,type Ledger } from '../src/ledger.js';
const files:string[]=[],dbs:Ledger[]=[];afterEach(()=>{for(const db of dbs.splice(0))try{db.close();}catch{}for(const file of files.splice(0))rmSync(file,{force:true});});
const path=()=>{const value=join(process.cwd(),`.native-runtime-migration-${process.pid}-${Date.now()}-${files.length}.db`);files.push(value);return value;};
it('packages 050 exactly and opens the immutable schema fresh and reopened',()=>{expect(readFileSync('dist/migrations/050_native_runtime_receipt.sql')).toEqual(readFileSync('migrations/050_native_runtime_receipt.sql'));const file=path(),first=openLedger(file);expect(first.prepare("SELECT version FROM native_runtime_receipt_migration WHERE singleton=1").get()).toEqual({version:'cue-native-runtime-receipt-v1'});first.close();const reopened=openLedger(file);dbs.push(reopened);expect(reopened.prepare("SELECT count(*) n FROM sqlite_master WHERE name GLOB 'native_runtime_receipt*' AND type IN('table','trigger')").get()).toEqual({n:9});});
it('refuses partial and weakened 050 installations on reopen',()=>{const partialPath=path(),partial=new Database(partialPath);partial.exec('CREATE TABLE native_runtime_receipt_migration(singleton INTEGER PRIMARY KEY,version TEXT)');partial.close();expect(()=>openLedger(partialPath)).toThrow('native_runtime_receipt_migration_partial');const weakPath=path(),db=openLedger(weakPath);db.exec('DROP TRIGGER native_runtime_receipt_no_delete; CREATE TRIGGER native_runtime_receipt_no_delete BEFORE DELETE ON native_runtime_receipt BEGIN SELECT 1; END;');db.close();expect(()=>openLedger(weakPath)).toThrow('native_runtime_receipt_migration_definition');});

// The original lineage clause required the receipt's session handle to carry the PLAN task id,
// but the stage binder only ever emits the stage task id, so no launcher-produced receipt could
// satisfy it. Existing ledgers carry that text and must be upgraded in place, not refused.
const LEGACY_INSERT_GUARD=`CREATE TRIGGER native_runtime_receipt_insert_guard BEFORE INSERT ON native_runtime_receipt BEGIN
  SELECT CASE WHEN cue_sha256(NEW.payload)<>NEW.payload_digest THEN RAISE(ABORT,'native_runtime_receipt_digest') END;
  SELECT CASE WHEN cue_canonical_json(NEW.payload)<>CAST(NEW.payload AS TEXT) THEN RAISE(ABORT,'native_runtime_receipt_canonical') END;
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM orchestration_attempt a JOIN orchestration_step s ON s.run_id=a.run_id AND s.task_id=a.task_id
    JOIN session_handle h ON h.handle=NEW.session_handle AND h.run_id=a.attempt_id AND h.task_id=a.task_id
    WHERE a.attempt_id=NEW.attempt_id AND a.run_id=NEW.run_id AND a.task_id=NEW.task_id AND a.candidate_id=NEW.candidate_id
  ) THEN RAISE(ABORT,'native_runtime_receipt_lineage') END;
END;`;

it.each(['comment', 'changed-body'])('050 refuses a %s legacy impersonation without rewriting it',(kind)=>{
 const file=path(),db=openLedger(file);
 const tampered=kind==='comment'
  ? "CREATE TRIGGER native_runtime_receipt_insert_guard BEFORE INSERT ON native_runtime_receipt BEGIN SELECT 1; /* h.task_id=a.task_id */ END"
  : LEGACY_INSERT_GUARD.replace('SELECT CASE WHEN NOT EXISTS(', 'SELECT CASE WHEN 0 AND NOT EXISTS(').slice(0,-1);
 db.exec('DROP TRIGGER native_runtime_receipt_insert_guard;');db.exec(tampered);db.close();
 expect(()=>openLedger(file).close()).toThrow('native_runtime_receipt_migration_definition');
 const raw=new Database(file);try{expect((raw.prepare("SELECT sql FROM sqlite_master WHERE name='native_runtime_receipt_insert_guard'").get() as {sql:string}).sql).toBe(tampered);}finally{raw.close();}
});

it('upgrades a legacy 050 lineage trigger in place and then reopens',()=>{
  const file=path(),first=openLedger(file);
  first.exec('DROP TRIGGER native_runtime_receipt_insert_guard;');
  first.exec(LEGACY_INSERT_GUARD);
  expect((first.prepare("SELECT sql FROM sqlite_master WHERE name='native_runtime_receipt_insert_guard'").get() as {sql:string}).sql).toContain('h.task_id=a.task_id');
  first.close();
  const upgraded=openLedger(file);dbs.push(upgraded);
  const sql=(upgraded.prepare("SELECT sql FROM sqlite_master WHERE name='native_runtime_receipt_insert_guard'").get() as {sql:string}).sql;
  expect(sql).not.toContain('h.task_id=a.task_id');
  expect(sql).toContain('h.task_id=e.stage_task_id');
  expect(upgraded.prepare("SELECT count(*) n FROM sqlite_master WHERE name GLOB 'native_runtime_receipt*' AND type IN('table','trigger')").get()).toEqual({n:9});
  upgraded.close();
  const reopened=openLedger(file);dbs.push(reopened);
  expect(reopened.prepare("SELECT version FROM native_runtime_receipt_migration WHERE singleton=1").get()).toEqual({version:'cue-native-runtime-receipt-v1'});
});

it('still refuses a same-name weakened lineage trigger rather than upgrading it',()=>{
  const file=path(),db=openLedger(file);
  db.exec("DROP TRIGGER native_runtime_receipt_insert_guard; CREATE TRIGGER native_runtime_receipt_insert_guard BEFORE INSERT ON native_runtime_receipt BEGIN SELECT 1; END;");
  db.close();
  expect(()=>openLedger(file)).toThrow('native_runtime_receipt_migration_definition');
});

it('upgrades a legacy 039 verifier lineage trigger in place',()=>{
  const file=path(),first=openLedger(file);
  const original=(first.prepare("SELECT sql FROM sqlite_master WHERE name='readonly_verifier_identity_lineage'").get() as {sql:string}).sql;
  expect(original).toContain('h.task_id=e.stage_task_id');
  first.exec('DROP TRIGGER readonly_verifier_identity_lineage;');
  first.exec(original.replace('JOIN orchestration_stage_envelope e ON e.attempt_id=a.attempt_id\n ','').replace('h.run_id=e.attempt_id AND h.task_id=e.stage_task_id','h.run_id=a.attempt_id AND h.task_id=a.task_id'));
  first.close();
  const upgraded=openLedger(file);dbs.push(upgraded);
  expect((upgraded.prepare("SELECT sql FROM sqlite_master WHERE name='readonly_verifier_identity_lineage'").get() as {sql:string}).sql).toContain('h.task_id=e.stage_task_id');
});
