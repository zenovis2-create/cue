import { createHash, timingSafeEqual } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA = /^[a-f0-9]{64}$/u;
const EVENT_KINDS = ['cancel-requested','client-cancel-acknowledged','provider-terminal','local-controller-observed','local-tree-observed','cleanup-observed','billing-finalized','lifecycle-sealed'] as const;
const REF_TYPES = ['thread','turn','subtask'] as const;
export type ProviderLifecycleKind = typeof EVENT_KINDS[number];
export type ProviderReferenceType = typeof REF_TYPES[number];

export interface ProviderLifecycleEventInput {
  readonly runId: string;
  readonly taskId: string;
  readonly attemptId: string;
  readonly candidateId: string;
  readonly eventId: string;
  readonly ordinal: number;
  readonly kind: ProviderLifecycleKind;
  readonly data: Readonly<Record<string, unknown>>;
}
export interface ProviderReferenceInput {
  readonly bindingId: string;
  readonly runId: string;
  readonly taskId: string;
  readonly attemptId: string;
  readonly candidateId: string;
  readonly eventId: string;
  readonly refType: ProviderReferenceType;
  readonly label: string;
  readonly reference: string;
}
export interface ProviderLifecycleScope {
  readonly runId: string;
  readonly taskId: string;
  readonly attemptId: string;
  readonly candidateId: string;
}

type EventRow = {
  event_id:string; run_id:string; task_id:string; attempt_id:string; candidate_id:string; ordinal:number; kind:ProviderLifecycleKind;
  observed_at_ms:number; status:string|null; evidence_digest:string|null; provider_receipt_digest:string|null; payload_sha256:string; payload:Buffer;
};
type BindingRow = {
  binding_id:string; run_id:string; task_id:string; attempt_id:string; candidate_id:string; event_id:string; ref_type:ProviderReferenceType;
  label:string; reference_digest:string; payload_sha256:string; payload:Buffer;
};

const AUTHORITY = Object.freeze({ processKill: 0 as const, budgetRelease: 0 as const, acceptance: 0 as const });

function own(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error(`invalid_${label}`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length) throw Error(`invalid_${label}_fields`);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw Error(`invalid_${label}_fields`);
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, maximum = 128): string {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > maximum || value.includes('\0') || /[\uD800-\uDFFF]/u.test(value) || Buffer.from(value, 'utf8').toString('utf8') !== value) throw Error(`invalid_${label}`);
  return value;
}
function identifier(value: unknown, label: string): string {
  const result = text(value, label);
  if (!ID.test(result) || result.includes('..') || result.includes('/') || result.includes('\\')) throw Error(`invalid_${label}`);
  return result;
}
function sha(value: unknown, label: string): string {
  const result = text(value, label, 64);
  if (!SHA.test(result)) throw Error(`invalid_${label}`);
  return result;
}
function integer(value: unknown, label: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) throw Error(`invalid_${label}`);
  return value as number;
}
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw Error('invalid_canonical_number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 64) throw Error('invalid_canonical_array');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== value.length + 1) throw Error('invalid_canonical_array');
    return `[${value.map((_, index) => {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw Error('invalid_canonical_array');
      return canonical(descriptor.value);
    }).join(',')}]`;
  }
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('invalid_canonical_object');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length > 64 || keys.some(key => typeof key !== 'string')) throw Error('invalid_canonical_object');
  return `{${(keys as string[]).sort().map(key => {
    const descriptor = descriptors[key]!;
    if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw Error('invalid_canonical_descriptor');
    return `${JSON.stringify(key)}:${canonical(descriptor.value)}`;
  }).join(',')}}`;
}
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function sameHash(left: string, right: string): boolean {
  return SHA.test(left) && SHA.test(right) && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
function exactStatus(value: unknown, allowed: readonly string[], label: string): string {
  const result = identifier(value, label);
  if (!allowed.includes(result)) throw Error(`invalid_${label}`);
  return result;
}

function lifecycleData(kind: ProviderLifecycleKind, input: unknown) {
  let row: Record<string, unknown>;
  let data: Readonly<Record<string, unknown>>;
  let status: string|null = null, evidenceDigest: string|null = null, providerReceiptDigest: string|null = null;
  switch (kind) {
    case 'cancel-requested':
      row=own(input,['reasonDigest'],'lifecycle_data'); evidenceDigest=sha(row.reasonDigest,'reason_digest'); data=Object.freeze({reasonDigest:evidenceDigest}); break;
    case 'client-cancel-acknowledged':
      row=own(input,['status'],'lifecycle_data'); status=exactStatus(row.status,['acknowledged'],'client_ack_status'); data=Object.freeze({status}); break;
    case 'provider-terminal':
      row=own(input,['status','receiptDigest'],'lifecycle_data'); status=exactStatus(row.status,['succeeded','failed','cancelled'],'provider_terminal_status'); providerReceiptDigest=sha(row.receiptDigest,'provider_receipt_digest'); data=Object.freeze({status,receiptDigest:providerReceiptDigest}); break;
    case 'local-controller-observed':
      row=own(input,['status','observationDigest'],'lifecycle_data'); status=exactStatus(row.status,['running','stopped','unknown'],'local_controller_status'); evidenceDigest=sha(row.observationDigest,'controller_observation_digest'); data=Object.freeze({status,observationDigest:evidenceDigest}); break;
    case 'local-tree-observed':
      row=own(input,['status','observationDigest'],'lifecycle_data'); status=exactStatus(row.status,['alive','dead','unknown'],'local_tree_status'); evidenceDigest=sha(row.observationDigest,'tree_observation_digest'); data=Object.freeze({status,observationDigest:evidenceDigest}); break;
    case 'cleanup-observed':
      row=own(input,['status','receiptDigest'],'lifecycle_data'); status=exactStatus(row.status,['clean','dirty','unknown'],'cleanup_status'); evidenceDigest=sha(row.receiptDigest,'cleanup_receipt_digest'); data=Object.freeze({status,receiptDigest:evidenceDigest}); break;
    case 'billing-finalized':
      row=own(input,['status','providerReceiptDigest'],'lifecycle_data'); status=exactStatus(row.status,['final'],'billing_status'); providerReceiptDigest=sha(row.providerReceiptDigest,'provider_receipt_digest'); data=Object.freeze({status,providerReceiptDigest}); break;
    case 'lifecycle-sealed':
      own(input,[],'lifecycle_data'); data=Object.freeze({}); break;
  }
  return Object.freeze({data,status,evidenceDigest,providerReceiptDigest});
}

function scope(input: unknown): Readonly<ProviderLifecycleScope> {
  const row=own(input,['runId','taskId','attemptId','candidateId'],'provider_lifecycle_scope');
  return Object.freeze({runId:identifier(row.runId,'run_id'),taskId:identifier(row.taskId,'task_id'),attemptId:identifier(row.attemptId,'attempt_id'),candidateId:identifier(row.candidateId,'candidate_id')});
}

export function createProviderLifecycleStore(db: Ledger, hostInput: { readonly nowMs: () => number }) {
  const host=own(hostInput,['nowMs'],'provider_lifecycle_host');
  if (typeof host.nowMs !== 'function') throw Error('invalid_provider_lifecycle_clock');
  const nowMs=host.nowMs as () => number;

  function verifyEventRow(row: EventRow) {
    const encoded=Buffer.from(row.payload).toString('utf8');
    if (!sameHash(hash(encoded),row.payload_sha256)) throw Error('provider_lifecycle_payload_integrity');
    let parsed: Record<string,unknown>;
    try { parsed=own(JSON.parse(encoded),['schemaVersion','runId','taskId','attemptId','candidateId','eventId','ordinal','kind','observedAtMs','data'],'stored_lifecycle_event'); }
    catch { throw Error('provider_lifecycle_payload_integrity'); }
    const kind=identifier(parsed.kind,'stored_lifecycle_kind') as ProviderLifecycleKind;
    if (!EVENT_KINDS.includes(kind)) throw Error('provider_lifecycle_payload_integrity');
    const normalized=lifecycleData(kind,parsed.data);
    const value=Object.freeze({schemaVersion:'cue-provider-lifecycle-event-v1' as const,runId:identifier(parsed.runId,'stored_run_id'),taskId:identifier(parsed.taskId,'stored_task_id'),attemptId:identifier(parsed.attemptId,'stored_attempt_id'),candidateId:identifier(parsed.candidateId,'stored_candidate_id'),eventId:identifier(parsed.eventId,'stored_event_id'),ordinal:integer(parsed.ordinal,'stored_ordinal',1_000_000),kind,observedAtMs:integer(parsed.observedAtMs,'stored_observed_at',8_640_000_000_000_000),data:normalized.data});
    if (canonical(value)!==encoded || value.runId!==row.run_id || value.taskId!==row.task_id || value.attemptId!==row.attempt_id || value.candidateId!==row.candidate_id || value.eventId!==row.event_id || value.ordinal!==row.ordinal || value.kind!==row.kind || value.observedAtMs!==row.observed_at_ms || normalized.status!==row.status || normalized.evidenceDigest!==row.evidence_digest || normalized.providerReceiptDigest!==row.provider_receipt_digest) throw Error('provider_lifecycle_payload_integrity');
    return Object.freeze({...value,payloadSha256:row.payload_sha256});
  }

  function trustedEventRow(row: EventRow) {
    try { return verifyEventRow(row); }
    catch { throw Error('provider_lifecycle_payload_integrity'); }
  }

  function verifyBindingRow(row: BindingRow) {
    const encoded=Buffer.from(row.payload).toString('utf8');
    if (!sameHash(hash(encoded),row.payload_sha256)) throw Error('provider_reference_payload_integrity');
    let parsed: Record<string,unknown>;
    try { parsed=own(JSON.parse(encoded),['schemaVersion','bindingId','runId','taskId','attemptId','candidateId','eventId','refType','label','referenceDigest'],'stored_provider_reference'); }
    catch { throw Error('provider_reference_payload_integrity'); }
    const refType=identifier(parsed.refType,'stored_reference_type') as ProviderReferenceType;
    if (!REF_TYPES.includes(refType)) throw Error('provider_reference_payload_integrity');
    const value=Object.freeze({schemaVersion:'cue-provider-reference-v1' as const,bindingId:identifier(parsed.bindingId,'stored_binding_id'),runId:identifier(parsed.runId,'stored_run_id'),taskId:identifier(parsed.taskId,'stored_task_id'),attemptId:identifier(parsed.attemptId,'stored_attempt_id'),candidateId:identifier(parsed.candidateId,'stored_candidate_id'),eventId:identifier(parsed.eventId,'stored_event_id'),refType,label:identifier(parsed.label,'stored_reference_label'),referenceDigest:sha(parsed.referenceDigest,'stored_reference_digest')});
    if (canonical(value)!==encoded || value.bindingId!==row.binding_id || value.runId!==row.run_id || value.taskId!==row.task_id || value.attemptId!==row.attempt_id || value.candidateId!==row.candidate_id || value.eventId!==row.event_id || value.refType!==row.ref_type || value.label!==row.label || value.referenceDigest!==row.reference_digest) throw Error('provider_reference_payload_integrity');
    return Object.freeze({...value,payloadSha256:row.payload_sha256});
  }

  function assertLineage(value: ProviderLifecycleScope) {
    const lineage=db.prepare('SELECT run_id,task_id,candidate_id FROM orchestration_attempt WHERE attempt_id=?').get(value.attemptId) as {run_id:string;task_id:string;candidate_id:string}|undefined;
    if (!lineage || lineage.run_id!==value.runId || lineage.task_id!==value.taskId || lineage.candidate_id!==value.candidateId) throw Error('provider_lifecycle_lineage_mismatch');
  }

  function verifiedEvents(value: ProviderLifecycleScope) {
    assertLineage(value);
    const rows=db.prepare('SELECT * FROM provider_lifecycle_event WHERE attempt_id=? ORDER BY ordinal').all(value.attemptId) as EventRow[];
    const events=rows.map(trustedEventRow);
    let cancelRequested=false, terminalReceipt:string|null=null, terminal=false, billing=false, sealed=false;
    events.forEach((event,index)=>{
      if(event.runId!==value.runId||event.taskId!==value.taskId||event.attemptId!==value.attemptId||event.candidateId!==value.candidateId)throw Error('provider_lifecycle_payload_integrity');
      if(event.ordinal!==index+1||sealed)throw Error('provider_lifecycle_sequence_integrity');
      switch(event.kind){
        case 'cancel-requested': cancelRequested=true; break;
        case 'client-cancel-acknowledged': if(!cancelRequested)throw Error('provider_lifecycle_sequence_integrity');break;
        case 'provider-terminal': if(terminal)throw Error('provider_lifecycle_terminal_conflict');terminal=true;terminalReceipt=event.data.receiptDigest as string;break;
        case 'billing-finalized': if(billing||!terminalReceipt||terminalReceipt!==event.data.providerReceiptDigest)throw Error('provider_lifecycle_billing_integrity');billing=true;break;
        case 'lifecycle-sealed': sealed=true;break;
      }
    });
    return Object.freeze(events);
  }

  function project(input: ProviderLifecycleScope) {
    const value=scope(input); assertLineage(value);
    if (db.prepare('SELECT 1 FROM provider_lifecycle_legacy WHERE attempt_id=?').get(value.attemptId)) return Object.freeze({availability:'legacy-not-recorded' as const,...value,cancelRequest:'unknown' as const,clientAcknowledgement:'unknown' as const,providerTerminal:'unknown' as const,providerDeath:'unknown' as const,localController:'unknown' as const,localTree:'unknown' as const,cleanup:'unknown' as const,billing:'unknown' as const,sealed:false,authority:AUTHORITY,events:Object.freeze([]),references:Object.freeze([])});
    const events=verifiedEvents(value);
    let cancelRequest:'unknown'|'requested'='unknown', clientAcknowledgement:'unknown'|'acknowledged'='unknown';
    let providerTerminal:'unknown'|'succeeded'|'failed'|'cancelled'='unknown', localController:'unknown'|'running'|'stopped'='unknown';
    let localTree:'unknown'|'alive'|'dead'='unknown', cleanup:'unknown'|'clean'|'dirty'='unknown', billing:'unknown'|'final'='unknown', sealed=false;
    let providerReceiptDigest:string|null=null;
    events.forEach((event,index)=>{
      if(event.ordinal!==index+1||sealed)throw Error('provider_lifecycle_sequence_integrity');
      switch(event.kind){
        case 'cancel-requested': cancelRequest='requested'; break;
        case 'client-cancel-acknowledged': if(cancelRequest!=='requested')throw Error('provider_lifecycle_sequence_integrity');clientAcknowledgement='acknowledged';break;
        case 'provider-terminal': if(providerTerminal!=='unknown')throw Error('provider_lifecycle_terminal_conflict');providerTerminal=event.data.status as typeof providerTerminal;providerReceiptDigest=event.data.receiptDigest as string;break;
        case 'local-controller-observed': localController=event.data.status as typeof localController;break;
        case 'local-tree-observed': localTree=event.data.status as typeof localTree;break;
        case 'cleanup-observed': cleanup=event.data.status as typeof cleanup;break;
        case 'billing-finalized': if(!providerReceiptDigest||providerReceiptDigest!==event.data.providerReceiptDigest||billing!=='unknown')throw Error('provider_lifecycle_billing_integrity');billing='final';break;
        case 'lifecycle-sealed': sealed=true;break;
      }
    });
    const referenceRows=db.prepare('SELECT * FROM provider_subtask_binding WHERE attempt_id=? ORDER BY binding_id COLLATE BINARY').all(value.attemptId) as BindingRow[];
    const references=referenceRows.map(row=>{const reference=verifyBindingRow(row);if(reference.runId!==value.runId||reference.taskId!==value.taskId||reference.candidateId!==value.candidateId||!events.some(event=>event.eventId===reference.eventId))throw Error('provider_reference_lineage_integrity');return reference;});
    return Object.freeze({availability:'recorded' as const,...value,cancelRequest,clientAcknowledgement,providerTerminal,providerDeath:'unknown' as const,localController,localTree,cleanup,billing,sealed,authority:AUTHORITY,events:Object.freeze(events),references:Object.freeze(references)});
  }

  return Object.freeze({
    authority: AUTHORITY,
    append(input: ProviderLifecycleEventInput) {
      const row=own(input,['runId','taskId','attemptId','candidateId','eventId','ordinal','kind','data'],'provider_lifecycle_event');
      const kind=identifier(row.kind,'lifecycle_kind') as ProviderLifecycleKind;
      if(!EVENT_KINDS.includes(kind))throw Error('invalid_lifecycle_kind');
      const base={runId:identifier(row.runId,'run_id'),taskId:identifier(row.taskId,'task_id'),attemptId:identifier(row.attemptId,'attempt_id'),candidateId:identifier(row.candidateId,'candidate_id'),eventId:identifier(row.eventId,'event_id'),ordinal:integer(row.ordinal,'ordinal',1_000_000),kind,data:lifecycleData(kind,row.data).data};
      return db.transaction(()=>{
        verifiedEvents(base);
        const prior=db.prepare('SELECT * FROM provider_lifecycle_event WHERE event_id=?').get(base.eventId) as EventRow|undefined;
        if(prior){const verified=trustedEventRow(prior);const replay={runId:verified.runId,taskId:verified.taskId,attemptId:verified.attemptId,candidateId:verified.candidateId,eventId:verified.eventId,ordinal:verified.ordinal,kind:verified.kind,data:verified.data};if(canonical(replay)!==canonical(base))throw Error('provider_lifecycle_replay_mismatch');return verified;}
        const normalized=lifecycleData(kind,base.data), observedAtMs=integer(nowMs(),'host_observed_at',8_640_000_000_000_000);
        const value=Object.freeze({schemaVersion:'cue-provider-lifecycle-event-v1' as const,...base,observedAtMs,data:normalized.data});
        const encoded=canonical(value);if(Buffer.byteLength(encoded)>16384)throw Error('provider_lifecycle_payload_limit');
        const payloadSha256=hash(encoded);
        db.prepare('INSERT INTO provider_lifecycle_event VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(value.eventId,value.runId,value.taskId,value.attemptId,value.candidateId,value.ordinal,value.kind,value.observedAtMs,normalized.status,normalized.evidenceDigest,normalized.providerReceiptDigest,payloadSha256,Buffer.from(encoded));
        return Object.freeze({...value,payloadSha256});
      }).immediate();
    },
    bindReference(input: ProviderReferenceInput) {
      const row=own(input,['bindingId','runId','taskId','attemptId','candidateId','eventId','refType','label','reference'],'provider_reference');
      const refType=identifier(row.refType,'reference_type') as ProviderReferenceType;if(!REF_TYPES.includes(refType))throw Error('invalid_reference_type');
      const referenceDigest=hash(text(row.reference,'opaque_reference',1024));
      const value=Object.freeze({schemaVersion:'cue-provider-reference-v1' as const,bindingId:identifier(row.bindingId,'binding_id'),runId:identifier(row.runId,'run_id'),taskId:identifier(row.taskId,'task_id'),attemptId:identifier(row.attemptId,'attempt_id'),candidateId:identifier(row.candidateId,'candidate_id'),eventId:identifier(row.eventId,'event_id'),refType,label:identifier(row.label,'reference_label'),referenceDigest});
      const encoded=canonical(value);if(Buffer.byteLength(encoded)>8192)throw Error('provider_reference_payload_limit');const payloadSha256=hash(encoded);
      return db.transaction(()=>{
        const events=verifiedEvents(value);
        const byId=db.prepare('SELECT * FROM provider_subtask_binding WHERE binding_id=?').get(value.bindingId) as BindingRow|undefined;
        const byReference=db.prepare('SELECT * FROM provider_subtask_binding WHERE reference_digest=?').get(value.referenceDigest) as BindingRow|undefined;
        if(byId||byReference){if(byId&&byReference&&byId.binding_id!==byReference.binding_id)throw Error('provider_reference_replay_mismatch');const prior=verifyBindingRow((byId??byReference)!);if(prior.payloadSha256!==payloadSha256)throw Error('provider_reference_replay_mismatch');return prior;}
        const event=events.find(item=>item.eventId===value.eventId);
        if(!event)throw Error('provider_reference_event_mismatch');
        db.prepare('INSERT INTO provider_subtask_binding VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(value.bindingId,value.runId,value.taskId,value.attemptId,value.candidateId,value.eventId,value.refType,value.label,value.referenceDigest,payloadSha256,Buffer.from(encoded));
        return Object.freeze({...value,payloadSha256});
      }).immediate();
    },
    project,
  });
}
