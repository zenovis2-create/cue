import { createHash, timingSafeEqual } from 'node:crypto';
import { types } from 'node:util';
import type { Ledger } from '../ledger.js';
import { isHostFailureDiagnosticCode } from './failure-diagnostic.js';

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA = /^[a-f0-9]{64}$/u;
const REVISION = /^(?:unknown|[A-Za-z0-9][A-Za-z0-9._:+-]{0,127})$/u;
const KINDS = ['heartbeat', 'progress', 'output', 'tool', 'artifact', 'usage', 'cancel', 'terminal'] as const;
export type ActivityKind = typeof KINDS[number];
export interface CanonicalRevision { readonly id: string; readonly revision: string }
export interface LaunchIntentInput {
  readonly runId: string; readonly taskId: string; readonly attemptId: string; readonly candidateId: string;
  readonly selectionDigest: string; readonly expectedSubjectDigest: string;
  readonly tool: CanonicalRevision; readonly model: CanonicalRevision | null;
  readonly parentEnvelopeHash: string; readonly stageEnvelopeHash: string; readonly planDigest: string; readonly policyDigest: string;
}
export interface AttemptIdentityInput {
  readonly identityId: string; readonly attemptId: string; readonly subjectDigest: string;
  readonly durableRef: string; readonly observedAtMs: number;
}
export interface ArtifactClaim { readonly kind: string; readonly sourceRef: string }
export interface VerifiedArtifact extends ArtifactClaim { readonly sha256: string; readonly byteLength: number }
export interface ActivityFact {
  readonly runId: string; readonly taskId: string; readonly attemptId: string; readonly eventId: string;
  readonly ordinal: number; readonly kind: ActivityKind; readonly observedAtMs: number;
  readonly data: Readonly<Record<string, unknown>>;
}
export interface TerminalHandoffInput {
  readonly handoffId: string; readonly attemptId: string; readonly receiptId: string; readonly receiptRevision: number; readonly identityId: string;
  readonly outcome: 'succeeded' | 'failed'; readonly cleanup: 'clean'; readonly artifacts: readonly ArtifactClaim[];
}
export type TerminalIntegrityResult = Readonly<{
  status: 'verified' | 'legacy-handoff-unavailable' | 'integrity-unavailable';
  attemptId: string;
  handoffPayloadSha256?: string;
}>;

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
function string(value: unknown, label: string, maximum = 128): string {
  if (typeof value !== 'string' || !value || Buffer.byteLength(value, 'utf8') > maximum || value.includes('\0') || Buffer.from(value, 'utf8').toString('utf8') !== value || /[\uD800-\uDFFF]/u.test(value)) throw Error(`invalid_${label}`);
  return value;
}
function identifier(value: unknown, label: string): string {
  const result = string(value, label);
  if (!ID.test(result) || result.includes('..') || result.includes('/') || result.includes('\\')) throw Error(`invalid_${label}`);
  return result;
}
function sha(value: unknown, label: string): string { const result = string(value, label, 64); if (!SHA.test(result)) throw Error(`invalid_${label}`); return result; }
function integer(value: unknown, label: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) throw Error(`invalid_${label}`);
  return value as number;
}
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) throw Error('invalid_canonical_number'); return JSON.stringify(value); }
  if (Array.isArray(value)) { if (value.length > 128) throw Error('canonical_array_limit'); return `[${value.map(canonical).join(',')}]`; }
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('invalid_canonical_object');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length > 64 || keys.some(key => typeof key !== 'string')) throw Error('canonical_object_limit');
  return `{${(keys as string[]).sort().map(key => {
    const descriptor = descriptors[key]!;
    if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw Error('invalid_canonical_descriptor');
    return `${JSON.stringify(key)}:${canonical(descriptor.value)}`;
  }).join(',')}}`;
}
const digest = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const blob = (encoded: string) => Buffer.from(encoded, 'utf8');
const terminalCommits = new WeakSet<Ledger>();
function revision(value: unknown, label: string): CanonicalRevision {
  const row = own(value, ['id', 'revision'], label);
  const id = identifier(row.id, `${label}_id`), rev = string(row.revision, `${label}_revision`);
  if (!REVISION.test(rev)) throw Error(`invalid_${label}_revision`);
  return Object.freeze({ id, revision: rev });
}
function sameHash(a: string, b: string): boolean { return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); }

function terminalActivityKeys(value: unknown): readonly string[] {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) return ['status', 'handoffRef'];
  const descriptor = Object.getOwnPropertyDescriptor(value, 'diagnosticCode');
  return descriptor ? ['status', 'handoffRef', 'diagnosticCode'] : ['status', 'handoffRef'];
}

function activityData(kind: ActivityKind, value: unknown): Readonly<Record<string, unknown>> {
  const allowed: Record<ActivityKind, readonly string[]> = {
    heartbeat: ['status'], progress: ['summary', 'progress'], output: ['contentRef', 'sha256', 'byteLength', 'truncated'],
    tool: ['toolId', 'toolRevision', 'callRef', 'status'], artifact: ['kind', 'sourceRef', 'sha256', 'byteLength'],
    usage: ['unit', 'quantity', 'status'], cancel: ['status'], terminal: terminalActivityKeys(value),
  };
  const row = own(value, allowed[kind], 'activity_data');
  const copy: Record<string, unknown> = {};
  for (const key of allowed[kind]) copy[key] = row[key];
  if ('summary' in copy) copy.summary = string(copy.summary, 'activity_summary', 1024);
  if ('status' in copy) copy.status = identifier(copy.status, 'activity_status');
  if ('progress' in copy) copy.progress = integer(copy.progress, 'activity_progress', 10_000);
  if ('quantity' in copy) copy.quantity = integer(copy.quantity, 'activity_quantity');
  if ('byteLength' in copy) copy.byteLength = integer(copy.byteLength, 'activity_bytes', 1_099_511_627_776);
  if ('sha256' in copy) copy.sha256 = sha(copy.sha256, 'activity_sha256');
  for (const key of ['contentRef', 'toolId', 'toolRevision', 'callRef', 'kind', 'sourceRef', 'unit', 'handoffRef']) if (key in copy) copy[key] = identifier(copy[key], `activity_${key}`);
  if ('truncated' in copy && typeof copy.truncated !== 'boolean') throw Error('invalid_activity_truncated');
  if ('diagnosticCode' in copy && (!isHostFailureDiagnosticCode(copy.diagnosticCode) || copy.status !== 'failed')) throw Error('invalid_activity_diagnostic');
  return Object.freeze(copy);
}

export function createHandoffActivityStore(db: Ledger, host: {
  resolveArtifact(sourceRef: string, attemptId: string): Uint8Array | null;
  authorizeArtifact(sourceRef: string, attemptId: string): boolean;
}) {
  const preparedHandoffs = new WeakSet<object>();
  function launchIntent(input: LaunchIntentInput) {
    const row = own(input, ['runId','taskId','attemptId','candidateId','selectionDigest','expectedSubjectDigest','tool','model','parentEnvelopeHash','stageEnvelopeHash','planDigest','policyDigest'], 'launch_intent');
    const tool = revision(row.tool, 'tool');
    const model = row.model === null ? null : revision(row.model, 'model');
    const value = Object.freeze({ runId: identifier(row.runId,'run_id'), taskId: identifier(row.taskId,'task_id'), attemptId: identifier(row.attemptId,'attempt_id'), candidateId: identifier(row.candidateId,'candidate_id'),
      selectionDigest: sha(row.selectionDigest,'selection_digest'), expectedSubjectDigest: sha(row.expectedSubjectDigest,'subject_digest'), tool, model,
      parentEnvelopeHash: sha(row.parentEnvelopeHash,'parent_envelope_hash'), stageEnvelopeHash: sha(row.stageEnvelopeHash,'stage_envelope_hash'), planDigest: sha(row.planDigest,'plan_digest'), policyDigest: sha(row.policyDigest,'policy_digest') });
    const encoded = canonical(value), payloadSha256 = digest(encoded);
    return Object.freeze({ ...value, payloadSha256, encoded });
  }
  function readIntent(attemptId: string) {
    identifier(attemptId,'attempt_id');
    const row = db.prepare('SELECT payload,payload_sha256 FROM orchestration_launch_intent WHERE attempt_id=?').get(attemptId) as { payload: Buffer; payload_sha256: string } | undefined;
    if (!row) return null;
    const encoded = Buffer.from(row.payload).toString('utf8');
    if (!sameHash(digest(encoded), row.payload_sha256)) throw Error('launch_intent_integrity');
    return Object.freeze({ ...JSON.parse(encoded), payloadSha256: row.payload_sha256 });
  }
  function validateTerminalOrThrow(attemptIdInput: string): TerminalIntegrityResult {
    const attemptId=identifier(attemptIdInput,'attempt_id');
    if(db.prepare('SELECT 1 FROM orchestration_handoff_legacy WHERE attempt_id=?').get(attemptId)
      ||db.prepare('SELECT 1 FROM orchestration_handoff_integrity_legacy WHERE attempt_id=?').get(attemptId))
      return Object.freeze({status:'legacy-handoff-unavailable',attemptId});
    const row=db.prepare(`SELECT h.handoff_id,h.identity_id,h.receipt_id,h.receipt_revision,h.outcome,h.cleanup,h.payload,h.payload_sha256,
      r.attempt_id receipt_attempt_id,r.revision receipt_revision_row,r.payload receipt_payload,
      i.attempt_id identity_attempt_id,i.subject_digest,i.durable_ref,i.observed_at_ms,i.payload identity_payload,i.payload_sha256 identity_sha256,
      l.run_id,l.task_id,l.candidate_id,l.selection_digest,l.expected_subject_digest,l.tool_id,l.tool_revision,l.model_id,l.model_revision,
      l.parent_envelope_hash,l.stage_envelope_hash,l.plan_digest,l.policy_digest,l.payload intent_payload,l.payload_sha256 intent_sha256
      FROM orchestration_handoff h JOIN orchestration_receipt r ON r.receipt_id=h.receipt_id
      JOIN orchestration_attempt_identity i ON i.identity_id=h.identity_id
      JOIN orchestration_launch_intent l ON l.attempt_id=h.attempt_id WHERE h.attempt_id=?`).get(attemptId) as any;
    if(!row)throw Error('terminal_handoff_missing');
    const handoffEncoded=Buffer.from(row.payload).toString('utf8'),identityEncoded=Buffer.from(row.identity_payload).toString('utf8'),intentEncoded=Buffer.from(row.intent_payload).toString('utf8');
    if(Buffer.byteLength(handoffEncoded)>1048576||Buffer.byteLength(identityEncoded)>16384||Buffer.byteLength(intentEncoded)>32768
      ||digest(handoffEncoded)!==row.payload_sha256||digest(identityEncoded)!==row.identity_sha256||digest(intentEncoded)!==row.intent_sha256)throw Error('terminal_payload_integrity');
    const handoffValue=JSON.parse(handoffEncoded),identityValue=JSON.parse(identityEncoded),intentValue=JSON.parse(intentEncoded),receiptValue=JSON.parse(row.receipt_payload);
    if(canonical(handoffValue)!==handoffEncoded||handoffValue.schemaVersion!=='cue-handoff-v1'||handoffValue.handoffId!==row.handoff_id||handoffValue.attemptId!==attemptId
      ||handoffValue.receiptId!==row.receipt_id||handoffValue.receiptRevision!==row.receipt_revision||handoffValue.identityId!==row.identity_id||handoffValue.outcome!==row.outcome||handoffValue.cleanup!==row.cleanup)throw Error('handoff_integrity');
    if(row.receipt_attempt_id!==attemptId||row.receipt_revision_row!==row.receipt_revision||receiptValue.attemptId!==attemptId||receiptValue.receiptId!==row.receipt_id
      ||receiptValue.revision!==row.receipt_revision||receiptValue.outcome!==row.outcome||receiptValue.cleanup!=='clean'
      ||row.receipt_revision!==(db.prepare('SELECT MAX(revision) n FROM orchestration_receipt WHERE attempt_id=?').get(attemptId) as {n:number}).n)throw Error('terminal_receipt_integrity');
    if(canonical(identityValue)!==identityEncoded||row.identity_attempt_id!==attemptId||identityValue.identityId!==row.identity_id||identityValue.attemptId!==attemptId
      ||identityValue.subjectDigest!==row.subject_digest||identityValue.durableRef!==row.durable_ref||identityValue.observedAtMs!==row.observed_at_ms)throw Error('terminal_identity_integrity');
    if(!row.durable_ref.startsWith('session:')||!db.prepare('SELECT 1 FROM session_handle WHERE handle=? AND run_id=?').get(row.durable_ref.slice(8),attemptId))throw Error('terminal_durable_identity');
    if(canonical(intentValue)!==intentEncoded||intentValue.runId!==row.run_id||intentValue.taskId!==row.task_id||intentValue.attemptId!==attemptId||intentValue.candidateId!==row.candidate_id
      ||intentValue.selectionDigest!==row.selection_digest||intentValue.expectedSubjectDigest!==row.expected_subject_digest||intentValue.tool?.id!==row.tool_id||intentValue.tool?.revision!==row.tool_revision
      ||(intentValue.model?.id??null)!==row.model_id||(intentValue.model?.revision??null)!==row.model_revision||intentValue.parentEnvelopeHash!==row.parent_envelope_hash
      ||intentValue.stageEnvelopeHash!==row.stage_envelope_hash||intentValue.planDigest!==row.plan_digest||intentValue.policyDigest!==row.policy_digest||row.expected_subject_digest!==row.subject_digest)throw Error('terminal_launch_integrity');
    if(!Array.isArray(handoffValue.artifacts)||handoffValue.artifacts.length<1||handoffValue.artifacts.length>128)throw Error('terminal_artifacts_missing');
    const members=db.prepare('SELECT ordinal,attempt_id,kind,source_ref,sha256,byte_length FROM orchestration_handoff_artifact WHERE handoff_id=? ORDER BY ordinal').all(row.handoff_id) as Array<{ordinal:number;attempt_id:string;kind:string;source_ref:string;sha256:string;byte_length:number}>;
    if(members.length!==handoffValue.artifacts.length)throw Error('terminal_artifact_manifest');
    for(let ordinal=0;ordinal<handoffValue.artifacts.length;ordinal++){const artifact=handoffValue.artifacts[ordinal],member=members[ordinal];
      if(!member||member.ordinal!==ordinal||member.attempt_id!==attemptId||member.kind!==artifact.kind||member.source_ref!==artifact.sourceRef||member.sha256!==artifact.sha256||member.byte_length!==artifact.byteLength)throw Error('terminal_artifact_manifest');
      if(host.authorizeArtifact(artifact.sourceRef,attemptId)!==true)throw Error('artifact_source_denied');const bytes=host.resolveArtifact(artifact.sourceRef,attemptId);if(!bytes||types.isProxy(bytes)||!(bytes instanceof Uint8Array)||digest(bytes)!==artifact.sha256||bytes.byteLength!==artifact.byteLength)throw Error('artifact_changed');}
    return Object.freeze({status:'verified',attemptId,handoffPayloadSha256:row.payload_sha256});
  }
  return Object.freeze({
    recordLaunchIntent(input: LaunchIntentInput) {
      const value = launchIntent(input);
      return db.transaction(() => {
        const existing = readIntent(value.attemptId);
        if (existing) { if (existing.payloadSha256 !== value.payloadSha256) throw Error('launch_intent_replay_mismatch'); return existing; }
        const revisions=Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='orchestration_attempt_revision'").get());
        const binding = db.prepare(revisions?`SELECT a.run_id,a.task_id,a.candidate_id,CASE WHEN ar.attempt_id IS NULL THEN p.digest ELSE pr.plan_digest END plan_digest,s.parent_envelope_hash,s.stage_envelope_hash,s.policy_digest,
          x.digest selection_digest FROM orchestration_attempt a JOIN orchestration_plan p ON p.run_id=a.run_id
          LEFT JOIN orchestration_attempt_revision ar ON ar.attempt_id=a.attempt_id LEFT JOIN orchestration_plan_revision pr ON pr.run_id=ar.run_id AND pr.revision=ar.revision
          JOIN orchestration_stage_envelope s ON s.attempt_id=a.attempt_id JOIN attempt_selection x ON x.attempt_id=a.attempt_id WHERE a.attempt_id=?`
          :`SELECT a.run_id,a.task_id,a.candidate_id,p.digest plan_digest,s.parent_envelope_hash,s.stage_envelope_hash,s.policy_digest,
          x.digest selection_digest FROM orchestration_attempt a JOIN orchestration_plan p ON p.run_id=a.run_id
          JOIN orchestration_stage_envelope s ON s.attempt_id=a.attempt_id JOIN attempt_selection x ON x.attempt_id=a.attempt_id WHERE a.attempt_id=?`).get(value.attemptId) as any;
        if (!binding || binding.run_id!==value.runId || binding.task_id!==value.taskId || binding.candidate_id!==value.candidateId || binding.plan_digest!==value.planDigest || binding.policy_digest!==value.policyDigest || binding.parent_envelope_hash!==value.parentEnvelopeHash || binding.stage_envelope_hash!==value.stageEnvelopeHash || binding.selection_digest!==value.selectionDigest) throw Error('launch_intent_binding_mismatch');
        db.prepare(`INSERT INTO orchestration_launch_intent VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(value.attemptId,value.runId,value.taskId,value.candidateId,value.selectionDigest,value.expectedSubjectDigest,value.tool.id,value.tool.revision,value.model?.id??null,value.model?.revision??null,value.parentEnvelopeHash,value.stageEnvelopeHash,value.planDigest,value.policyDigest,value.payloadSha256,blob(value.encoded));
        return Object.freeze({ ...value, encoded: undefined });
      }).immediate();
    },
    readLaunchIntent: readIntent,
    recordAttemptIdentity(input: AttemptIdentityInput) {
      const row = own(input,['identityId','attemptId','subjectDigest','durableRef','observedAtMs'],'attempt_identity');
      const value = Object.freeze({ identityId:identifier(row.identityId,'identity_id'),attemptId:identifier(row.attemptId,'attempt_id'),subjectDigest:sha(row.subjectDigest,'subject_digest'),durableRef:identifier(row.durableRef,'durable_ref'),observedAtMs:integer(row.observedAtMs,'observed_at') });
      const encoded=canonical(value), payloadSha256=digest(encoded);
      return db.transaction(()=>{
        const prior=db.prepare('SELECT payload_sha256 FROM orchestration_attempt_identity WHERE attempt_id=? OR identity_id=?').get(value.attemptId,value.identityId) as {payload_sha256:string}|undefined;
        if(prior){if(prior.payload_sha256!==payloadSha256)throw Error('attempt_identity_replay_mismatch');return Object.freeze({...value,payloadSha256});}
        const intent=readIntent(value.attemptId); if(!intent || intent.expectedSubjectDigest!==value.subjectDigest)throw Error('attempt_identity_subject_mismatch');
        db.prepare('INSERT INTO orchestration_attempt_identity VALUES(?,?,?,?,?,?,?)').run(value.identityId,value.attemptId,value.subjectDigest,value.durableRef,value.observedAtMs,payloadSha256,blob(encoded));
        return Object.freeze({...value,payloadSha256});
      }).immediate();
    },
    activity(input: ActivityFact) {
      const row=own(input,['runId','taskId','attemptId','eventId','ordinal','kind','observedAtMs','data'],'activity');
      const kind=string(row.kind,'activity_kind') as ActivityKind; if(!KINDS.includes(kind))throw Error('invalid_activity_kind');
      const value=Object.freeze({runId:identifier(row.runId,'run_id'),taskId:identifier(row.taskId,'task_id'),attemptId:identifier(row.attemptId,'attempt_id'),eventId:identifier(row.eventId,'event_id'),ordinal:integer(row.ordinal,'ordinal',1_000_000),kind,observedAtMs:integer(row.observedAtMs,'observed_at'),data:activityData(kind,row.data)});
      const encoded=canonical(value); if(Buffer.byteLength(encoded)>8192)throw Error('activity_payload_limit');
      db.transaction(()=>{
        const lineage=db.prepare('SELECT run_id,task_id,state FROM orchestration_attempt WHERE attempt_id=?').get(value.attemptId) as any;
        if(!lineage||lineage.run_id!==value.runId||lineage.task_id!==value.taskId)throw Error('activity_lineage_mismatch');
        const prior=db.prepare('SELECT attempt_id,ordinal,payload FROM orchestration_activity WHERE event_id=?').get(value.eventId) as any;
        if(prior){if(prior.attempt_id!==value.attemptId||prior.ordinal!==value.ordinal||prior.payload!==encoded)throw Error('activity_replay_mismatch');return;}
        if(!['running','blocked'].includes(lineage.state))throw Error('attempt_terminal');
        const latest=db.prepare('SELECT MAX(ordinal) n FROM orchestration_activity WHERE attempt_id=?').get(value.attemptId) as {n:number|null};
        if(value.ordinal!==(latest.n??0)+1)throw Error('activity_out_of_order');
        db.prepare('INSERT INTO orchestration_activity VALUES(?,?,?,?)').run(value.eventId,value.attemptId,value.ordinal,encoded);
      }).immediate();
    },
    prepareHandoff(input: TerminalHandoffInput) {
      const row=own(input,['handoffId','attemptId','receiptId','receiptRevision','identityId','outcome','cleanup','artifacts'],'handoff');
      const handoffId=identifier(row.handoffId,'handoff_id'), attemptId=identifier(row.attemptId,'attempt_id'), receiptId=identifier(row.receiptId,'receipt_id'), receiptRevision=integer(row.receiptRevision,'receipt_revision'), identityId=identifier(row.identityId,'identity_id');
      if(!Array.isArray(row.artifacts)||types.isProxy(row.artifacts)||Object.getPrototypeOf(row.artifacts)!==Array.prototype||row.artifacts.length>128)throw Error('invalid_handoff_artifacts');
      const artifactDescriptors=Object.getOwnPropertyDescriptors(row.artifacts);
      if(Reflect.ownKeys(artifactDescriptors).length!==row.artifacts.length+1)throw Error('invalid_handoff_artifacts');
      const artifactValues:unknown[]=[];
      for(let index=0;index<row.artifacts.length;index++){const descriptor=artifactDescriptors[String(index)];if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)throw Error('invalid_handoff_artifacts');artifactValues.push(descriptor.value);}
      const seen=new Set<string>();
      if(artifactValues.length<1)throw Error('handoff_artifact_required');
      const artifacts=artifactValues.map(item=>{const a=own(item,['kind','sourceRef'],'artifact');const kind=identifier(a.kind,'artifact_kind'),sourceRef=identifier(a.sourceRef,'artifact_source');if(seen.has(sourceRef))throw Error('duplicate_artifact_target');seen.add(sourceRef);if(host.authorizeArtifact(sourceRef,attemptId)!==true)throw Error('artifact_source_denied');const bytes=host.resolveArtifact(sourceRef,attemptId);if(!bytes||types.isProxy(bytes)||!(bytes instanceof Uint8Array))throw Error('artifact_missing');const copy=Buffer.from(bytes);return Object.freeze({kind,sourceRef,sha256:digest(copy),byteLength:copy.byteLength});});
      if(!['succeeded','failed'].includes(row.outcome as string)||row.cleanup!=='clean')throw Error('invalid_handoff_outcome');
      const value=Object.freeze({schemaVersion:'cue-handoff-v1' as const,handoffId,attemptId,receiptId,receiptRevision,identityId,outcome:row.outcome as 'succeeded'|'failed',cleanup:'clean' as const,artifacts:Object.freeze(artifacts)});
      const encoded=canonical(value),payloadSha256=digest(encoded), prepared=Object.freeze({...value,payloadSha256,encoded});preparedHandoffs.add(prepared);return prepared;
    },
    commitHandoff(prepared: Readonly<{ schemaVersion:'cue-handoff-v1'; handoffId:string; attemptId:string; receiptId:string; receiptRevision:number; identityId:string;
      outcome:'succeeded'|'failed'; cleanup:'clean'; artifacts:readonly VerifiedArtifact[]; payloadSha256:string; encoded:string }>) {
      if(!prepared || typeof prepared!=='object' || !preparedHandoffs.has(prepared))throw Error('untrusted_prepared_handoff');
      return db.transaction(()=>{
        const receipt=db.prepare('SELECT attempt_id,revision,payload FROM orchestration_receipt WHERE receipt_id=?').get(prepared.receiptId) as {attempt_id:string;revision:number;payload:string}|undefined;
        const identity=db.prepare('SELECT attempt_id,subject_digest,durable_ref,payload,payload_sha256 FROM orchestration_attempt_identity WHERE identity_id=?').get(prepared.identityId) as {attempt_id:string;subject_digest:string;durable_ref:string;payload:Buffer;payload_sha256:string}|undefined;
        const intent=readIntent(prepared.attemptId);
        if(!receipt||receipt.attempt_id!==prepared.attemptId||receipt.revision!==prepared.receiptRevision||!identity||identity.attempt_id!==prepared.attemptId||!intent||intent.expectedSubjectDigest!==identity.subject_digest)throw Error('handoff_lineage_mismatch');
        if(!identity.durable_ref.startsWith('session:')||!db.prepare('SELECT 1 FROM session_handle WHERE handle=? AND run_id=?').get(identity.durable_ref.slice(8),prepared.attemptId))throw Error('handoff_durable_identity');
        const receiptValue=JSON.parse(receipt.payload);
        if(receiptValue.attemptId!==prepared.attemptId||receiptValue.receiptId!==prepared.receiptId||receiptValue.revision!==prepared.receiptRevision||receiptValue.outcome!==prepared.outcome||receiptValue.cleanup!=='clean')throw Error('handoff_receipt_mismatch');
        if(digest(Buffer.from(identity.payload).toString('utf8'))!==identity.payload_sha256)throw Error('attempt_identity_integrity');
        for(const artifact of prepared.artifacts){if(host.authorizeArtifact(artifact.sourceRef,prepared.attemptId)!==true)throw Error('artifact_source_denied');const bytes=host.resolveArtifact(artifact.sourceRef,prepared.attemptId);if(!bytes||!(bytes instanceof Uint8Array)||digest(bytes)!==artifact.sha256||bytes.byteLength!==artifact.byteLength)throw Error('artifact_changed');}
        db.prepare('INSERT INTO orchestration_handoff VALUES(?,?,?,?,?,?,?,?,?)').run(prepared.handoffId,prepared.attemptId,prepared.receiptId,prepared.receiptRevision,prepared.identityId,prepared.outcome,prepared.cleanup,prepared.payloadSha256,blob(prepared.encoded));
        const member=db.prepare('INSERT INTO orchestration_handoff_artifact VALUES(?,?,?,?,?,?,?)');
        prepared.artifacts.forEach((artifact,ordinal)=>member.run(prepared.handoffId,ordinal,prepared.attemptId,artifact.kind,artifact.sourceRef,artifact.sha256,artifact.byteLength));
        return prepared;
      }).immediate();
    },
    readTerminalIntegrity(attemptIdInput:string): TerminalIntegrityResult {
      try{return validateTerminalOrThrow(attemptIdInput);}catch{return Object.freeze({status:'integrity-unavailable',attemptId:String(attemptIdInput)});}
    },
    validateTerminal(attemptIdInput:string, receiptIdInput?:string, revisionInput?:number, outcomeInput?:'succeeded'|'failed', receiptPayload?:string) {
      const result=validateTerminalOrThrow(attemptIdInput);if(result.status!=='verified')throw Error(result.status);
      if(receiptIdInput!==undefined){const row=db.prepare('SELECT receipt_id,receipt_revision,outcome FROM orchestration_handoff WHERE attempt_id=?').get(attemptIdInput) as any;
        const receipt=db.prepare('SELECT payload FROM orchestration_receipt WHERE receipt_id=?').get(receiptIdInput) as any;
        if(!row||row.receipt_id!==receiptIdInput||row.receipt_revision!==revisionInput||row.outcome!==outcomeInput||receipt?.payload!==receiptPayload)throw Error('terminal_receipt_integrity');}
      return true;
    },
    commitTerminalState(attemptIdInput:string,state:'completed'|'failed') {
      if(!db.open||!db.inTransaction)throw Error('terminal_transaction_required');
      if(terminalCommits.has(db))throw Error('terminal_commit_nested');terminalCommits.add(db);
      try{
        const attemptId=identifier(attemptIdInput,'attempt_id'),integrity=validateTerminalOrThrow(attemptId);
        if(integrity.status!=='verified'||!integrity.handoffPayloadSha256)throw Error('terminal_integrity_unavailable');
        const outcome=state==='completed'?'succeeded':'failed';
        const handoff=db.prepare('SELECT outcome FROM orchestration_handoff WHERE attempt_id=?').get(attemptId) as {outcome:string}|undefined;
        if(handoff?.outcome!==outcome)throw Error('terminal_outcome_mismatch');
        let consumed=false;
        db.function('cue_handoff_terminal_authorized',(candidateAttempt:unknown,candidateHash:unknown)=>{
          if(consumed||candidateAttempt!==attemptId||candidateHash!==integrity.handoffPayloadSha256)return 0;consumed=true;return 1;
        });
        try{const result=db.prepare('UPDATE orchestration_attempt SET state=?,cleanup_verified=1 WHERE attempt_id=?').run(state,attemptId);
          if(!consumed)throw Error('handoff_terminal_authorization_unused');return result;
        }finally{db.function('cue_handoff_terminal_authorized',(_attemptId:unknown,_payloadSha256:unknown)=>0);}
      }finally{terminalCommits.delete(db);}
    },
  });
}
