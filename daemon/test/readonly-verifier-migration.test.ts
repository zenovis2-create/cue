import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLedger } from '../src/ledger.js';
import Database from 'better-sqlite3';

const roots:string[]=[];afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const ledgerPath=(name:string)=>{const root=mkdtempSync(join(tmpdir(),`cue-readonly-migration-${name}-`));roots.push(root);return join(root,'ledger.sqlite');};

test.each(['comment', 'changed-body'])('039 refuses a %s legacy impersonation without rewriting it',(kind)=>{
 const path=ledgerPath(kind),db=openLedger(path);
 const current=(db.prepare("SELECT sql FROM sqlite_master WHERE name='readonly_verifier_identity_lineage'").get() as {sql:string}).sql;
 const tampered=kind==='comment'
  ? "CREATE TRIGGER readonly_verifier_identity_lineage BEFORE INSERT ON readonly_verifier_identity BEGIN SELECT 1; /* h.task_id=a.task_id */ END"
  : current.replace('JOIN orchestration_stage_envelope e ON e.attempt_id=a.attempt_id\n ','').replace('h.run_id=e.attempt_id AND h.task_id=e.stage_task_id','h.run_id=a.attempt_id AND h.task_id=a.task_id').replace('WHEN NOT EXISTS(', 'WHEN 0 AND NOT EXISTS(');
 db.exec('DROP TRIGGER readonly_verifier_identity_lineage;');db.exec(tampered);db.close();
 expect(()=>openLedger(path).close()).toThrow('readonly_verifier_migration_definition');
 const raw=new Database(path);try{expect((raw.prepare("SELECT sql FROM sqlite_master WHERE name='readonly_verifier_identity_lineage'").get() as {sql:string}).sql).toBe(tampered);}finally{raw.close();}
});

test('migration 039 installs on fresh ledger and reopens idempotently',()=>{
 const root=mkdtempSync(join(tmpdir(),'cue-readonly-migration-'));roots.push(root);const path=join(root,'ledger.sqlite');
 const first=openLedger(path);expect(first.prepare("SELECT version FROM readonly_verifier_migration WHERE singleton=1").get()).toEqual({version:'cue-readonly-verifier-v1'});first.close();
 const second=openLedger(path);expect(second.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name LIKE 'readonly_verifier_%'").get()).toEqual({n:13});second.close();
});

// An independent review proved these three cases were undetectable before migration 039 gained
// the guard-count and reference-definition checks that 050 already had: a rewritten or deleted
// lineage trigger survived reopen. They are regression tests for that asymmetry.
test('a rewritten 039 lineage trigger refuses the ledger instead of surviving reopen',()=>{
 const path=ledgerPath('tampered');const db=openLedger(path);
 db.exec("DROP TRIGGER readonly_verifier_identity_lineage; CREATE TRIGGER readonly_verifier_identity_lineage BEFORE INSERT ON readonly_verifier_identity WHEN 0 BEGIN SELECT RAISE(ABORT,'never'); END;");
 db.close();
 expect(()=>openLedger(path)).toThrow('readonly_verifier_migration_definition');
});

test('a deleted 039 lineage trigger refuses the ledger',()=>{
 const path=ledgerPath('deleted');const db=openLedger(path);
 db.exec('DROP TRIGGER readonly_verifier_identity_lineage;');
 db.close();
 expect(()=>openLedger(path)).toThrow('readonly_verifier_migration_partial');
});

test('a legacy 039 lineage trigger is upgraded in place and then reopens',()=>{
 const path=ledgerPath('legacy');const first=openLedger(path);
 const current=(first.prepare("SELECT sql FROM sqlite_master WHERE name='readonly_verifier_identity_lineage'").get() as {sql:string}).sql;
 expect(current).toContain('h.task_id=e.stage_task_id');
 first.exec('DROP TRIGGER readonly_verifier_identity_lineage;');
 first.exec(current.replace('JOIN orchestration_stage_envelope e ON e.attempt_id=a.attempt_id\n ','').replace('h.run_id=e.attempt_id AND h.task_id=e.stage_task_id','h.run_id=a.attempt_id AND h.task_id=a.task_id'));
 expect((first.prepare("SELECT sql FROM sqlite_master WHERE name='readonly_verifier_identity_lineage'").get() as {sql:string}).sql).toContain('h.task_id=a.task_id');
 first.close();
 const upgraded=openLedger(path);
 expect((upgraded.prepare("SELECT sql FROM sqlite_master WHERE name='readonly_verifier_identity_lineage'").get() as {sql:string}).sql).toContain('h.task_id=e.stage_task_id');
 upgraded.close();
 const reopened=openLedger(path);
 expect(reopened.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name LIKE 'readonly_verifier_%'").get()).toEqual({n:13});
 reopened.close();
});
