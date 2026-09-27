import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {openLedger,type Ledger} from '../src/ledger.js';
import {createResourceStore} from '../src/resources/store.js';
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
function setup(){const root=mkdtempSync(join(tmpdir(),'Cue.Resources.'));const file=join(root,'db.sqlite');const open=()=>{const db=openLedger(file);db.exec(readFileSync(resolve('migrations/019_resource_store.sql'),'utf8'));return db};return{root,open,close:()=>rmSync(root,{recursive:true,force:true})}}
function resource(root:string,version='1.0.0',text='reference text'){
 const bytes=Buffer.from(text);writeFileSync(join(root,'guide.md'),bytes);
 const data={schemaVersion:1,id:'demo',version,source:'https://example.com/resources',revision:'a'.repeat(40),resources:[{id:'guide',kind:'knowledge',path:'guide.md',sha256:sha(bytes),byteLength:bytes.length}]};
 const manifest=JSON.stringify(data);writeFileSync(join(root,'manifest.json'),manifest);return{root,manifestSha256:sha(manifest)};
}
function seed(db:Ledger,id:string,state='awaiting_approval'){
 db.prepare('INSERT INTO task VALUES(?,?,NULL,?)').run('task_'+id,state,'now');db.prepare('INSERT OR IGNORE INTO envelope VALUES(?,?,?,?)').run('env',process.cwd(),'[]','now');
 db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(id,'task_'+id,'env','now');
}
describe('durable host-approved resources',()=>{
 it('reopens original frozen text after package deletion; active changes/removal only affect future runs',()=>{
  const f=setup();let db=f.open();try{
   const store=createResourceStore(db);store.importApproved(resource(f.root));seed(db,'r1');const pinned=store.pinRun('r1');expect(Object.isFrozen(pinned[0]!.resources[0])).toBe(true);
   store.importApproved(resource(f.root,'2.0.0','new text'));seed(db,'r2');expect(store.pinRun('r2')[0]!.version).toBe('2.0.0');expect(store.readRun('r1')).toEqual(pinned);
   expect(store.remove('demo')).toBe(true);expect(store.remove('demo')).toBe(false);expect(existsSync(join(f.root,'guide.md'))).toBe(true);seed(db,'r3');expect(store.pinRun('r3')).toEqual([]);
   rmSync(join(f.root,'manifest.json'));rmSync(join(f.root,'guide.md'));db.close();db=f.open();const reopened=createResourceStore(db);
   expect(reopened.listActive()).toEqual([]);expect(reopened.readRun('r1')).toEqual(pinned);expect(reopened.read('demo','2.0.0')!.resources[0]!.text).toBe('new text');
   reopened.activate('demo','1.0.0');expect(reopened.listActive()[0]!.version).toBe('1.0.0');expect(reopened.readRun('r2')![0]!.version).toBe('2.0.0');
  }finally{db.close();f.close()}
 });
 it('rejects id/version conflicts after restart and keeps loader guards, BOM bytes and caller rollback',()=>{
  const f=setup();let db=f.open();try{
   const approved=resource(f.root,'1.0.0','\ufeffreference');const store=createResourceStore(db);store.importApproved(approved);db.close();db=f.open();
   expect(()=>createResourceStore(db).importApproved(resource(f.root,'1.0.0','changed'))).toThrow('resource_version_conflict');
   expect(()=>createResourceStore(db).importApproved({...approved,manifestSha256:'0'.repeat(64)})).toThrow('resource_manifest_hash');
   seed(db,'r');const next=resource(f.root,'2.0.0','rolled back');expect(()=>db.transaction(()=>{const s=createResourceStore(db);s.importApproved(next);s.pinRun('r');throw Error('rollback')})()).toThrow('rollback');
   const s=createResourceStore(db);expect(s.read('demo','2.0.0')).toBeNull();expect(s.readRun('r')).toBeNull();expect(s.listActive()[0]!.resources[0]!.text).toBe('reference');expect(s.pinRun('r')[0]!.version).toBe('1.0.0');
  }finally{db.close();f.close()}
 });
 it('requires a real unapproved/unattempted run; replay cannot adopt a later active version',()=>{
  const f=setup(),db=f.open();try{const s=createResourceStore(db);s.importApproved(resource(f.root));expect(()=>s.pinRun('missing')).toThrow('missing_run');
   seed(db,'running','running');expect(()=>s.pinRun('running')).toThrow('too_late');seed(db,'approved');db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,request_ordinal,decision,created_at) VALUES('approved','env','t','i',0,'accept','now')").run();expect(()=>s.pinRun('approved')).toThrow('too_late');
   seed(db,'session');db.prepare("INSERT INTO session_handle VALUES('h',1,'now',?,'task_session','session')").run(process.cwd());expect(()=>s.pinRun('session')).toThrow('too_late');
   seed(db,'attempted');db.prepare("INSERT INTO orchestration_plan VALUES('attempted','env','digest','{}')").run();db.prepare("INSERT INTO orchestration_step VALUES('attempted','step','running')").run();db.prepare("INSERT INTO orchestration_attempt VALUES('attempt','attempted','step','candidate','running','{}',?,NULL,0)").run(process.cwd());expect(()=>s.pinRun('attempted')).toThrow('too_late');
   seed(db,'good');s.pinRun('good');db.prepare("UPDATE task SET state='running' WHERE id='task_good'").run();s.importApproved(resource(f.root,'2.0.0'));expect(s.pinRun('good')[0]!.version).toBe('1.0.0');
  }finally{db.close();f.close()}
 });
 it('SQL UPDATE/DELETE/REPLACE/UPSERT cannot mutate snapshots, activation history or run pins',()=>{
  const f=setup(),db=f.open();try{const s=createResourceStore(db);s.importApproved(resource(f.root));seed(db,'r');s.pinRun('r');
   for(const table of ['resource_snapshot','resource_active','resource_run_pin']){
    const row=db.prepare('SELECT * FROM '+table).get() as Record<string,unknown>;const keys=Object.keys(row),values=Object.values(row);
    expect(()=>db.prepare('INSERT OR REPLACE INTO '+table+' VALUES('+keys.map(()=>'?').join(',')+')').run(...values)).toThrow('immutable_resource');
    expect(()=>db.prepare('UPDATE '+table+' SET '+keys[0]+'='+keys[0]).run()).toThrow('immutable_resource');expect(()=>db.prepare('DELETE FROM '+table).run()).toThrow('immutable_resource');
    expect(()=>db.prepare('INSERT INTO '+table+' VALUES('+keys.map(()=>'?').join(',')+') ON CONFLICT DO UPDATE SET '+keys[0]+'=excluded.'+keys[0]).run(...values)).toThrow('immutable_resource');
   }
   expect(s.readRun('r')![0]!.version).toBe('1.0.0');
  }finally{db.close();f.close()}
 });
 it.each(['resource_snapshot','resource_active','resource_run_pin'])('detects corrupt %s if external actor bypasses immutability triggers',table=>{
  const f=setup(),db=f.open();try{const s=createResourceStore(db);s.importApproved(resource(f.root));seed(db,'r');s.pinRun('r');
   db.exec('DROP TRIGGER '+table+'_no_update');const column=table==='resource_snapshot'?'payload_json':table==='resource_active'?'event_sha256':'pin_sha256';db.prepare('UPDATE '+table+' SET '+column+'=?').run(table==='resource_snapshot'?'{}':'0'.repeat(64));
   expect(()=>table==='resource_active'?s.listActive():s.readRun('r')).toThrow('resource_store_corrupt');
  }finally{db.close();f.close()}
 });
});
