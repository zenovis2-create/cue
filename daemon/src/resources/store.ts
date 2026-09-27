import { createHash } from 'node:crypto';
import type { Ledger } from '../ledger.js';
import { createResourcePackages, type ResourceSnapshot } from './packages.js';
const MAX_SNAPSHOT=8_388_608,MAX_PIN=16_384,MAX_PACKAGES=32,MAX_IDS=1024,MAX_RUN_BYTES=8_388_608;
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
function fail():never{throw Error('resource_store_corrupt')}
function id(value:unknown):asserts value is string{if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value))throw Error('resource_store_id')}
function version(value:unknown):asserts value is string{if(typeof value!=='string'||!/^\d{1,5}\.\d{1,5}\.\d{1,5}(?:-[A-Za-z0-9.-]{1,32})?$/.test(value))fail()}
function digest(value:unknown):asserts value is string{if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))fail()}
function keys(value:any,expected:string[]){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==expected.sort().join(','))fail()}
function text(value:unknown,max:number):asserts value is string{if(typeof value!=='string'||value.length>max)fail()}
function parse(payload:unknown,max:number){text(payload,max);if(Buffer.byteLength(payload)>max)fail();return JSON.parse(payload)}
function freezeSnapshot(value:any):ResourceSnapshot{
 keys(value,['id','version','source','revision','manifestSha256','resources']);id(value.id);version(value.version);digest(value.manifestSha256);text(value.source,512);text(value.revision,64);
 if(!Array.isArray(value.resources)||value.resources.length<1||value.resources.length>32)fail();let total=0;const ids=new Set<string>();
 const resources=value.resources.map((entry:any)=>{
  keys(entry,['id','kind','path','sha256','byteLength','text']);id(entry.id);digest(entry.sha256);text(entry.path,240);text(entry.text,65536);
  if(ids.has(entry.id)||!['skill','rule','knowledge'].includes(entry.kind)||!Number.isSafeInteger(entry.byteLength)||entry.byteLength<1||entry.byteLength>65536)fail();ids.add(entry.id);total+=entry.byteLength;
  // Loader TextDecoder strips one UTF-8 BOM. Recover only that exact, hash-proven
  // encoding when checking persisted text bytes; never reread a package path.
  const encoded=Buffer.from(entry.text),original=encoded.length===entry.byteLength?encoded:Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),encoded]);
  if(original.length!==entry.byteLength||hash(original)!==entry.sha256)fail();return Object.freeze({...entry});
 });
 if(total>1_048_576)fail();return Object.freeze({...value,resources:Object.freeze(resources)});
}
interface Stored{snapshot:ResourceSnapshot;digest:string}
interface ActiveRow{package_id:string;revision:number;snapshot_version:string|null;snapshot_sha256:string|null;previous_sha256:string|null;event_sha256:string}
const activeHash=(row:Omit<ActiveRow,'event_sha256'>)=>hash(JSON.stringify([row.package_id,row.revision,row.snapshot_version,row.snapshot_sha256,row.previous_sha256]));
/** Protected host API only: declarative data, never policy/execution authority.
 * Register exclusively reuses the approved package loader. Reads use persisted
 * canonical snapshots, never stored path/root reopening. No cache survives rollback. */
export function createResourceStore(db:Ledger){
 function stored(packageId:string,resourceVersion:string):Stored|null{
  id(packageId);version(resourceVersion);
  const row=db.prepare('SELECT manifest_sha256,snapshot_sha256,length(CAST(payload_json AS BLOB)) bytes,substr(payload_json,1,?) payload FROM resource_snapshot WHERE package_id=? AND version=?').get(MAX_SNAPSHOT+1,packageId,resourceVersion) as any;
  if(!row)return null;if(row.bytes>MAX_SNAPSHOT)fail();digest(row.snapshot_sha256);digest(row.manifest_sha256);
  if(hash(row.payload)!==row.snapshot_sha256)fail();const snapshot=freezeSnapshot(parse(row.payload,MAX_SNAPSHOT));
  if(JSON.stringify(snapshot)!==row.payload||snapshot.id!==packageId||snapshot.version!==resourceVersion||snapshot.manifestSha256!==row.manifest_sha256)fail();return{snapshot,digest:row.snapshot_sha256};
 }
 function latest(packageId:string):ActiveRow|null{
  id(packageId);const row=db.prepare('SELECT * FROM resource_active WHERE package_id=? ORDER BY revision DESC LIMIT 1').get(packageId) as ActiveRow|undefined;
  if(!row)return null;digest(row.event_sha256);if(row.package_id!==packageId||!Number.isSafeInteger(row.revision)||row.revision<1)fail();
  if(row.previous_sha256!==null)digest(row.previous_sha256);
  const previous=row.revision===1?null:db.prepare('SELECT event_sha256 FROM resource_active WHERE package_id=? AND revision=?').get(packageId,row.revision-1) as {event_sha256:string}|undefined;
  if((row.revision===1&&row.previous_sha256!==null)||(row.revision>1&&(!previous||previous.event_sha256!==row.previous_sha256)))fail();
  if(activeHash(row)!==row.event_sha256)fail();
  if(row.snapshot_version===null){if(row.snapshot_sha256!==null)fail();}else{version(row.snapshot_version);digest(row.snapshot_sha256);const value=stored(packageId,row.snapshot_version);if(!value||value.digest!==row.snapshot_sha256)fail()}
  return row;
 }
 function change(packageId:string,value:Stored|null):boolean{
  const previous=latest(packageId);if((previous?.snapshot_sha256??null)===(value?.digest??null))return false;
  const row={package_id:packageId,revision:(previous?.revision??0)+1,snapshot_version:value?.snapshot.version??null,snapshot_sha256:value?.digest??null,previous_sha256:previous?.event_sha256??null};
  if(!Number.isSafeInteger(row.revision))fail();db.prepare('INSERT INTO resource_active VALUES(?,?,?,?,?,?)').run(row.package_id,row.revision,row.snapshot_version,row.snapshot_sha256,row.previous_sha256,activeHash(row));return true;
 }
 function active():readonly ResourceSnapshot[]{
  const rows=db.prepare('SELECT a.package_id FROM resource_active a WHERE a.revision=(SELECT MAX(b.revision) FROM resource_active b WHERE b.package_id=a.package_id) ORDER BY a.package_id LIMIT ?').all(MAX_IDS+1) as {package_id:string}[];
  if(rows.length>MAX_IDS)throw Error('resource_store_limit');const values:ResourceSnapshot[]=[];
  for(const row of rows){const current=latest(row.package_id)!;if(current.snapshot_version!==null)values.push(stored(row.package_id,current.snapshot_version)!.snapshot)}
  if(values.length>MAX_PACKAGES)throw Error('resource_store_limit');return Object.freeze(values.sort((a,b)=>compare(a.id,b.id)));
 }
 function readRun(runId:string):readonly ResourceSnapshot[]|null{
  id(runId);const row=db.prepare('SELECT pin_sha256,length(CAST(payload_json AS BLOB)) bytes,substr(payload_json,1,?) payload FROM resource_run_pin WHERE run_id=?').get(MAX_PIN+1,runId) as any;
  if(!row)return null;if(row.bytes>MAX_PIN)fail();digest(row.pin_sha256);if(hash(row.payload)!==row.pin_sha256)fail();const data=parse(row.payload,MAX_PIN);
  keys(data,['schemaVersion','runId','packages']);if(data.schemaVersion!==1||data.runId!==runId||!Array.isArray(data.packages)||data.packages.length>MAX_PACKAGES||JSON.stringify(data)!==row.payload)fail();
  let previous='',total=0;const result=data.packages.map((ref:any)=>{keys(ref,['id','version','digest']);id(ref.id);version(ref.version);digest(ref.digest);if(compare(previous,ref.id)>=0)fail();previous=ref.id;
   const item=stored(ref.id,ref.version);if(!item||item.digest!==ref.digest)fail();total+=item.snapshot.resources.reduce((n,e)=>n+e.byteLength,0);if(total>MAX_RUN_BYTES)throw Error('resource_store_limit');return item.snapshot});return Object.freeze(result);
 }
 return Object.freeze({
  importApproved(input:{root:string;manifestSha256:string}):ResourceSnapshot{
   const snapshot=createResourcePackages().register(input);const payload=JSON.stringify(snapshot),snapshotDigest=hash(payload);if(Buffer.byteLength(payload)>MAX_SNAPSHOT)throw Error('resource_store_limit');freezeSnapshot(JSON.parse(payload));
   return db.transaction(()=>{const previous=stored(snapshot.id,snapshot.version);if(previous){if(previous.snapshot.manifestSha256!==snapshot.manifestSha256||previous.digest!==snapshotDigest)throw Error('resource_version_conflict');change(snapshot.id,previous);return previous.snapshot}
    db.prepare('INSERT INTO resource_snapshot VALUES(?,?,?,?,?)').run(snapshot.id,snapshot.version,snapshot.manifestSha256,snapshotDigest,payload);change(snapshot.id,{snapshot,digest:snapshotDigest});return snapshot})();
  },
  read(packageId:string,resourceVersion:string){return stored(packageId,resourceVersion)?.snapshot??null},
  activate(packageId:string,resourceVersion:string){return db.transaction(()=>{const value=stored(packageId,resourceVersion);if(!value)throw Error('resource_store_missing');change(packageId,value);return value.snapshot})()},
  remove(packageId:string){id(packageId);return db.transaction(()=>change(packageId,null))()},
  listActive:active,readRun,
  pinRun(runId:string):readonly ResourceSnapshot[]{id(runId);return db.transaction(()=>{
   const existing=readRun(runId);if(existing)return existing;
   const run=db.prepare('SELECT t.state,r.write_in_progress FROM run r JOIN task t ON t.id=r.task_id WHERE r.id=?').get(runId) as any;
   if(!run||!['queued','awaiting_approval'].includes(run.state)||run.write_in_progress!==0)throw Error('resource_pin_too_late_or_missing_run');
   for(const table of ['approval_event','execution_event','session_handle','orchestration_attempt'])if(db.prepare('SELECT 1 FROM '+table+' WHERE run_id=? LIMIT 1').get(runId))throw Error('resource_pin_too_late_or_missing_run');
   const snapshots=active();let total=0;const packages=snapshots.map(snapshot=>{total+=snapshot.resources.reduce((n,e)=>n+e.byteLength,0);if(total>MAX_RUN_BYTES)throw Error('resource_store_limit');return{id:snapshot.id,version:snapshot.version,digest:stored(snapshot.id,snapshot.version)!.digest}});
   const payload=JSON.stringify({schemaVersion:1,runId,packages});if(Buffer.byteLength(payload)>MAX_PIN)throw Error('resource_store_limit');db.prepare('INSERT INTO resource_run_pin VALUES(?,?,?)').run(runId,payload,hash(payload));return readRun(runId)!;
  })()},
 });
}
