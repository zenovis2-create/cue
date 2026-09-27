import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from './ledger.js';
import { captureChangeSet } from './change-records.js';
import { compareWriteExistingNative, type CompareWriteExistingResult } from './change-snapshot-host.js';

const MAX_BYTES=16*1024*1024, digestPattern=/^[0-9a-f]{64}$/, volumePattern=/^[0-9a-f]{16}$/, filePattern=/^[0-9a-f]{32}$/;
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex'), canonical=(value:unknown)=>JSON.stringify(value);
type Identity=Readonly<{volumeSerial:string;fileId:string}>;
type Receipt=Readonly<{identity:Identity;byteLength:number;sha256:string}>;
export type FinalPublicationState='pending'|'committed'|'contention'|'unknown';
export type FinalPublicationResult=Readonly<{publicationId:string;state:FinalPublicationState;reason?:'native-contention'|'native-unknown';rootIdentity?:Identity;before?:Receipt;after?:Receipt}>;
export type FinalPublicationAuthority=Readonly<{
 schemaVersion:'cue-final-publication-authority-v1';publicationId:string;changeSetId:string;
 lineage:Readonly<{runId:string;taskId:string;attemptId:string;stageEnvelopeHash:string;parentEnvelopeHash:string;planDigest:string}>;
 root:Readonly<{worktreeRealpath:string;identity:Identity;snapshotProtocol:string;snapshotHelperSha256:string}>;
 target:Readonly<{ordinal:number;relativePath:string;maxBytes:number;preimage:Receipt}>;
 replacement:Readonly<{byteLength:number;sha256:string}>;leaseAcquiredAt:string;
}>;
export interface FinalPublicationOptions {
 authorize:(context:FinalPublicationAuthority)=>boolean;
 nowMs?:number;
 execute?:(input:{root:string;expectedRoot:Identity;target:string;expected:Receipt;replacement:Buffer;maxBytes:number})=>CompareWriteExistingResult;
}
export interface FinalPublicationRequest {publicationId:string;changeSetId:string;relativePath:string;replacement:Buffer}

function record(value:unknown):Record<string,unknown>|null{
 if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)return null;
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.some(key=>typeof key!=='string'||!descriptors[key]?.enumerable||!Object.hasOwn(descriptors[key]!,'value')))return null;
 return Object.fromEntries(Object.entries(descriptors).map(([key,d])=>[key,d.value]));
}
function exact(value:Record<string,unknown>,keys:readonly string[]){const actual=Reflect.ownKeys(value);return actual.length===keys.length&&keys.every(key=>Object.hasOwn(value,key));}
function safeId(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=256&&!/[\0\r\n]/.test(value);}
function frozen<T>(value:T):T{if(value&&typeof value==='object'&&!ArrayBuffer.isView(value)){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
function parseIdentity(value:string):Identity{const split=value.split(':');if(split.length!==2||!volumePattern.test(split[0]!)||!filePattern.test(split[1]!))throw Error('change_publication_journal_invalid');return frozen({volumeSerial:split[0]!,fileId:split[1]!});}
function parsed(row:any){if(!row||!Buffer.isBuffer(row.payload)||sha(row.payload)!==row.payload_sha256)throw Error('change_publication_corrupt');try{return JSON.parse(row.payload.toString('utf8'));}catch{throw Error('change_publication_corrupt');}}
function validIdentity(value:any):value is Identity{return value&&typeof value==='object'&&!types.isProxy(value)&&volumePattern.test(value.volumeSerial)&&filePattern.test(value.fileId);}
function validReceipt(value:any,maxBytes:number):value is Receipt{return value&&typeof value==='object'&&!types.isProxy(value)&&validIdentity(value.identity)&&Number.isSafeInteger(value.byteLength)&&value.byteLength>=0&&value.byteLength<=maxBytes&&typeof value.sha256==='string'&&digestPattern.test(value.sha256);}

function readStored(db:Ledger,publicationId:string):{intent:any;result:FinalPublicationResult}{
 const intent=db.prepare('SELECT * FROM change_publication_intent WHERE publication_id=?').get(publicationId) as any;
 if(!intent)throw Error('change_publication_missing');
 const ip=parsed(intent);
 if(ip.schemaVersion!=='cue-change-publication-intent-v1'||ip.publicationId!==intent.publication_id||ip.changeSetId!==intent.change_set_id||ip.runId!==intent.run_id||ip.taskId!==intent.task_id||ip.attemptId!==intent.attempt_id||ip.stageEnvelopeHash!==intent.stage_envelope_hash||ip.parentEnvelopeHash!==intent.parent_envelope_hash||ip.planDigest!==intent.plan_digest||ip.worktreeRealpath!==intent.worktree_realpath||ip.rootIdentity?.volumeSerial!==intent.root_volume_serial||ip.rootIdentity?.fileId!==intent.root_file_id||ip.snapshotProtocol!==intent.snapshot_protocol||ip.snapshotHelperSha256!==intent.snapshot_helper_sha256||ip.targetOrdinal!==intent.target_ordinal||ip.relativePath!==intent.relative_path||ip.maxBytes!==intent.max_bytes||ip.preimage?.identity?.volumeSerial!==intent.preimage_volume_serial||ip.preimage?.identity?.fileId!==intent.preimage_file_id||ip.preimage?.byteLength!==intent.preimage_byte_length||ip.preimage?.sha256!==intent.preimage_sha256||ip.replacement?.byteLength!==intent.replacement_byte_length||ip.replacement?.sha256!==intent.replacement_sha256||ip.leaseAcquiredAt!==intent.lease_acquired_at||ip.createdAtMs!==intent.created_at_ms)throw Error('change_publication_corrupt');
 const row=db.prepare('SELECT * FROM change_publication_result WHERE publication_id=?').get(publicationId) as any;
 if(!row)return{intent,result:frozen({publicationId,state:'pending'})};
 const p=parsed(row),nullable=(object:any,key:string,column:string)=>((object?.[key]??null)===(row[column]??null));
 if(p.schemaVersion!=='cue-change-publication-result-v1'||p.publicationId!==row.publication_id||p.state!==row.state||(p.reason??null)!==(row.reason??null)||!nullable(p.rootIdentity,'volumeSerial','root_volume_serial')||!nullable(p.rootIdentity,'fileId','root_file_id')||!nullable(p.before?.identity,'volumeSerial','before_volume_serial')||!nullable(p.before?.identity,'fileId','before_file_id')||!nullable(p.before,'byteLength','before_byte_length')||!nullable(p.before,'sha256','before_sha256')||!nullable(p.after?.identity,'volumeSerial','after_volume_serial')||!nullable(p.after?.identity,'fileId','after_file_id')||!nullable(p.after,'byteLength','after_byte_length')||!nullable(p.after,'sha256','after_sha256')||p.recordedAtMs!==row.recorded_at_ms)throw Error('change_publication_corrupt');
 if(row.state==='committed')return{intent,result:frozen({publicationId,state:'committed',rootIdentity:p.rootIdentity,before:p.before,after:p.after})};
 if((row.state==='contention'&&row.reason!=='native-contention')||(row.state==='unknown'&&row.reason!=='native-unknown')||(row.state!=='contention'&&row.state!=='unknown'))throw Error('change_publication_corrupt');
 return{intent,result:frozen({publicationId,state:row.state,reason:row.reason})};
}

function derive(db:Ledger,input:{publicationId:string;changeSetId:string;relativePath:string;replacement:Buffer;replacementSha256:string}):{authority:FinalPublicationAuthority;intent:any;encoded:Buffer}{
 const set=db.prepare('SELECT * FROM change_set WHERE change_set_id=?').get(input.changeSetId) as any;if(!set)throw Error('change_publication_journal_invalid');
 let targets:unknown,limits:any;try{targets=JSON.parse(set.approved_targets_json);limits=JSON.parse(set.scan_limits_json);}catch{throw Error('change_publication_journal_invalid');}
 if(!Array.isArray(targets)||!limits||typeof limits!=='object')throw Error('change_publication_journal_invalid');
 captureChangeSet(db,{changeSetId:set.change_set_id,runId:set.run_id,taskId:set.task_id,attemptId:set.attempt_id,stageEnvelopeHash:set.stage_envelope_hash,launchIntentId:set.launch_intent_id,worktree:set.worktree_realpath,targets,limits});
 const row=db.prepare(`SELECT cs.*,ce.ordinal,ce.relative_path,ce.object_kind,ce.file_identity,ce.byte_length,ce.sha256,ce.preimage,
  nb.volume_serial,nb.file_id,nb.snapshot_protocol,nb.snapshot_helper_sha256,se.parent_envelope_hash,se.plan_digest,
  a.lease_acquired_at,tc.max_backup_bytes
  FROM change_set cs JOIN change_entry ce ON ce.change_set_id=cs.change_set_id
  JOIN change_native_binding nb ON nb.change_set_id=cs.change_set_id
  JOIN orchestration_stage_envelope se ON se.attempt_id=cs.attempt_id
  JOIN orchestration_attempt a ON a.attempt_id=cs.attempt_id
  JOIN change_target_contract tc ON tc.run_id=cs.run_id AND tc.task_id=cs.task_id AND tc.relative_path=ce.relative_path
  WHERE cs.change_set_id=? AND ce.relative_path=?`).get(input.changeSetId,input.relativePath) as any;
 if(!row||row.object_kind!=='file'||!Buffer.isBuffer(row.preimage)||!safeId(row.lease_acquired_at)||!Number.isSafeInteger(row.max_backup_bytes)||row.max_backup_bytes<1||row.max_backup_bytes>MAX_BYTES||!Number.isSafeInteger(row.byte_length)||row.byte_length<0||row.byte_length>row.max_backup_bytes||row.preimage.length!==row.byte_length||sha(row.preimage)!==row.sha256||input.replacement.length>row.max_backup_bytes||!volumePattern.test(row.volume_serial)||!filePattern.test(row.file_id)||!digestPattern.test(row.snapshot_helper_sha256)||!digestPattern.test(row.plan_digest))throw Error('change_publication_journal_invalid');
 const preimage=({identity:parseIdentity(row.file_identity),byteLength:row.byte_length,sha256:row.sha256}) as Receipt;
 const authority=frozen({schemaVersion:'cue-final-publication-authority-v1' as const,publicationId:input.publicationId,changeSetId:input.changeSetId,lineage:{runId:row.run_id,taskId:row.task_id,attemptId:row.attempt_id,stageEnvelopeHash:row.stage_envelope_hash,parentEnvelopeHash:row.parent_envelope_hash,planDigest:row.plan_digest},root:{worktreeRealpath:row.worktree_realpath,identity:{volumeSerial:row.volume_serial,fileId:row.file_id},snapshotProtocol:row.snapshot_protocol,snapshotHelperSha256:row.snapshot_helper_sha256},target:{ordinal:row.ordinal,relativePath:row.relative_path,maxBytes:row.max_backup_bytes,preimage},replacement:{byteLength:input.replacement.length,sha256:input.replacementSha256},leaseAcquiredAt:row.lease_acquired_at});
 const createdAtMs=0,body={schemaVersion:'cue-change-publication-intent-v1',publicationId:input.publicationId,changeSetId:input.changeSetId,runId:row.run_id,taskId:row.task_id,attemptId:row.attempt_id,stageEnvelopeHash:row.stage_envelope_hash,parentEnvelopeHash:row.parent_envelope_hash,planDigest:row.plan_digest,worktreeRealpath:row.worktree_realpath,rootIdentity:authority.root.identity,snapshotProtocol:row.snapshot_protocol,snapshotHelperSha256:row.snapshot_helper_sha256,targetOrdinal:row.ordinal,relativePath:row.relative_path,maxBytes:row.max_backup_bytes,preimage,replacement:authority.replacement,leaseAcquiredAt:row.lease_acquired_at,createdAtMs};
 return{authority,intent:body,encoded:Buffer.from(canonical(body))};
}

export function createFinalPublicationStore(db:Ledger,options:FinalPublicationOptions){
 const o=record(options);if(!o||!exact(o,['authorize',...(Object.hasOwn(o,'nowMs')?['nowMs']:[]),...(Object.hasOwn(o,'execute')?['execute']:[])])||typeof o.authorize!=='function'||(o.execute!==undefined&&typeof o.execute!=='function')||(o.nowMs!==undefined&&(!Number.isSafeInteger(o.nowMs)||(o.nowMs as number)<0)))throw Error('change_publication_options_invalid');
 const authorize=o.authorize as FinalPublicationOptions['authorize'],execute=(o.execute??compareWriteExistingNative) as NonNullable<FinalPublicationOptions['execute']>,nowMs=(o.nowMs as number|undefined)??Date.now();
 function read(publicationId:string):FinalPublicationResult{if(!safeId(publicationId))throw Error('change_publication_request_invalid');return readStored(db,publicationId).result;}
 function publish(request:FinalPublicationRequest):FinalPublicationResult{
  if(db.inTransaction)throw Error('change_publication_outer_transaction');
  const r=record(request);if(!r||!exact(r,['publicationId','changeSetId','relativePath','replacement'])||!safeId(r.publicationId)||!safeId(r.changeSetId)||!safeId(r.relativePath)||types.isProxy(r.replacement)||!Buffer.isBuffer(r.replacement)||(r.replacement as Buffer).length>MAX_BYTES)throw Error('change_publication_request_invalid');
  const replacement=Buffer.from(r.replacement as Buffer),replacementSha256=sha(replacement),input={publicationId:r.publicationId as string,changeSetId:r.changeSetId as string,relativePath:r.relativePath as string,replacement,replacementSha256};
  const existing=db.prepare('SELECT 1 FROM change_publication_intent WHERE publication_id=?').get(input.publicationId);
  if(existing){const stored=readStored(db,input.publicationId);if(stored.intent.change_set_id!==input.changeSetId||stored.intent.relative_path!==input.relativePath||stored.intent.replacement_byte_length!==replacement.length||stored.intent.replacement_sha256!==replacementSha256)throw Error('change_publication_conflict');return stored.result;}
  const first=derive(db,input);if(authorize(first.authority)!==true)throw Error('change_publication_authority_denied');
  const checked=derive(db,input);if(canonical(first.authority)!==canonical(checked.authority))throw Error('change_publication_authority_expired');
  const intent={...checked.intent,createdAtMs:nowMs},encoded=Buffer.from(canonical({...checked.intent,createdAtMs:nowMs}));
  db.transaction(()=>db.prepare('INSERT INTO change_publication_intent VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(intent.publicationId,intent.changeSetId,intent.runId,intent.taskId,intent.attemptId,intent.stageEnvelopeHash,intent.parentEnvelopeHash,intent.planDigest,intent.worktreeRealpath,intent.rootIdentity.volumeSerial,intent.rootIdentity.fileId,intent.snapshotProtocol,intent.snapshotHelperSha256,intent.targetOrdinal,intent.relativePath,intent.maxBytes,intent.preimage.identity.volumeSerial,intent.preimage.identity.fileId,intent.preimage.byteLength,intent.preimage.sha256,intent.replacement.byteLength,intent.replacement.sha256,intent.leaseAcquiredAt,intent.createdAtMs,sha(encoded),encoded)).immediate();
  const outcome:unknown=execute({root:intent.worktreeRealpath,expectedRoot:intent.rootIdentity,target:intent.relativePath,expected:intent.preimage,replacement:Buffer.from(replacement),maxBytes:intent.maxBytes});
  let state:'committed'|'contention'|'unknown',reason:string|null=null,root:Identity|null=null,before:Receipt|null=null,after:Receipt|null=null;
  try{const value=record(outcome);if(value?.state==='committed'&&exact(value,['state','rootIdentity','before','after'])&&validIdentity(value.rootIdentity)&&validReceipt(value.before,intent.maxBytes)&&validReceipt(value.after,intent.maxBytes)&&value.rootIdentity.volumeSerial===intent.rootIdentity.volumeSerial&&value.rootIdentity.fileId===intent.rootIdentity.fileId&&canonical(value.before)===canonical(intent.preimage)&&value.after.identity.volumeSerial===intent.preimage.identity.volumeSerial&&value.after.identity.fileId===intent.preimage.identity.fileId&&value.after.byteLength===intent.replacement.byteLength&&value.after.sha256===intent.replacement.sha256){state='committed';root=value.rootIdentity;before=value.before;after=value.after;}
  else if(value?.state==='contention'&&exact(value,['state','reason'])&&typeof value.reason==='string'&&value.reason.length>0){state='contention';reason='native-contention';}
  else{state='unknown';reason='native-unknown';}}catch{state='unknown';reason='native-unknown';}
  const body={schemaVersion:'cue-change-publication-result-v1',publicationId:intent.publicationId,state,reason,rootIdentity:root,before,after,recordedAtMs:nowMs},encodedResult=Buffer.from(canonical(body));
  db.transaction(()=>db.prepare('INSERT INTO change_publication_result VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(intent.publicationId,state,reason,root?.volumeSerial??null,root?.fileId??null,before?.identity.volumeSerial??null,before?.identity.fileId??null,before?.byteLength??null,before?.sha256??null,after?.identity.volumeSerial??null,after?.identity.fileId??null,after?.byteLength??null,after?.sha256??null,nowMs,sha(encodedResult),encodedResult)).immediate();
  return readStored(db,intent.publicationId).result;
 }
 return Object.freeze({publish,read});
}
