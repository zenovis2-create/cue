import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import type { Ledger } from '../ledger.js';
import { envelopeHash, normalizeEnvelope, type Envelope, type AutonomyLevel } from '../envelope.js';
import type { SessionOwner } from '../session-spawn.js';
import { readRunPolicyIdentity } from '../selection/run-policy-identity.js';
import { readAccountIdentities } from './account-binding.js';
import { validateTaskPlan, type ValidatedPlan, type PlanTask } from './plan.js';

export interface StageScopeGrant { id: string; worktreeRealpath: string; allowedActions: readonly string[]; egress: readonly string[] }
export interface StageEnvelopeRequest {
  workflowRunId: string; taskId: string; attemptId: string; parentEnvelope: Envelope;
  revision?: number; planDigest?: string;
  stage: { worktreeRealpath: string; allowedActions: readonly string[]; egress: readonly string[]; expiresAt: string; autonomyLevel: AutonomyLevel };
  stagingSetupId?: string; stagingRootIdentity?: Readonly<{volumeSerial:string;fileId:string}>;
}
export interface StageEnvelopeBinding {
  readonly workflowRunId: string; readonly taskId: string; readonly attemptId: string;
  readonly envelope: Envelope; readonly envelopeHash: string; readonly owner: Readonly<SessionOwner>;
  readonly parentEnvelopeHash: string; readonly planDigest: string; readonly policyDigest: string;
  readonly revision: number;
  readonly publicationWorktreeRealpath: string;
  readonly replayed: boolean;
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('invalid_stage_record');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length) throw Error('invalid_stage_fields');
  const copy: Record<string, unknown> = {};
  for (const key of keys) { const d = descriptors[key]; if (!d || !Object.hasOwn(d, 'value') || !d.enumerable) throw Error('invalid_stage_fields'); copy[key] = d.value; }
  return copy;
}
function text(value: unknown): string { if (typeof value !== 'string' || !value.trim() || value.length > 4096 || /[\u0000-\u001f\u007f]/u.test(value)) throw Error('invalid_stage_text'); return value; }
function id(value: unknown): string { const s = text(value); if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/u.test(s)) throw Error('invalid_stage_id'); return s; }
function list(value: unknown): string[] {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 256 || Reflect.ownKeys(value).length !== value.length + 1) throw Error('invalid_stage_list');
  const output: string[] = [];
  for (let i = 0; i < value.length; i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !Object.hasOwn(d, 'value')) throw Error('invalid_stage_list'); output.push(text(d.value)); }
  if (new Set(output).size !== output.length) throw Error('duplicate_stage_list'); return output.sort();
}
function timestamp(value: unknown): string { const s = text(value); if (!Number.isFinite(Date.parse(s)) || new Date(s).toISOString() !== s) throw Error('invalid_stage_time'); return s; }
function autonomy(value: unknown): AutonomyLevel { if (value !== 'bounded' && value !== 'supervised') throw Error('invalid_stage_autonomy'); return value; }
function freezeEnvelope(e: Envelope): Envelope { Object.freeze(e.allowed_actions); Object.freeze(e.egress); return Object.freeze(e); }
function parentSnapshot(value: unknown): Envelope {
  const p = record(value, ['run_id', 'worktree_realpath', 'egress', 'expires_at', 'autonomy_level', 'allowed_actions']);
  return freezeEnvelope(normalizeEnvelope({ run_id: id(p.run_id), worktree_realpath: text(p.worktree_realpath), egress: list(p.egress), expires_at: timestamp(p.expires_at), autonomy_level: autonomy(p.autonomy_level), allowed_actions: list(p.allowed_actions) }));
}
// Persisted canonical envelopes can outlive an execution worktree. The live
// normalizer deliberately requires that path to exist; history hashes the
// already validated canonical snapshot without resolving it again.
function archivedSnapshot(value: unknown): Envelope {
  const p = record(value, ['run_id', 'worktree_realpath', 'egress', 'expires_at', 'autonomy_level', 'allowed_actions']);
  const path = text(p.worktree_realpath);
  if (!isAbsolute(path)) throw Error('stage_archived_path_invalid');
  return freezeEnvelope({ allowed_actions: list(p.allowed_actions), autonomy_level: autonomy(p.autonomy_level), egress: list(p.egress), expires_at: timestamp(p.expires_at), run_id: id(p.run_id), worktree_realpath: path });
}
function archivedHash(value: Envelope): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function contained(root: string, candidate: string): boolean { const rel = relative(root, candidate); return rel === '' || (!isAbsolute(rel) && rel.split(/[\\/]/u)[0] !== '..'); }
function subset(values: readonly string[], allowed: readonly string[]): boolean { return values.every(v => allowed.includes(v)); }
export function normalizeStageEnvelope(attemptIdValue: string, stageValue: StageEnvelopeRequest['stage']): Readonly<{envelope:Envelope;envelopeHash:string}> {
  const attemptId=id(attemptIdValue),s=record(stageValue,['worktreeRealpath','allowedActions','egress','expiresAt','autonomyLevel']);
  const envelope=freezeEnvelope(normalizeEnvelope({run_id:attemptId,worktree_realpath:text(s.worktreeRealpath),allowed_actions:list(s.allowedActions),egress:list(s.egress),expires_at:timestamp(s.expiresAt),autonomy_level:autonomy(s.autonomyLevel)}));
  return Object.freeze({envelope,envelopeHash:envelopeHash(envelope)});
}
const canonical=(value:unknown):string=>{if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);if(typeof value==='number')return JSON.stringify(value);if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;const object=value as Record<string,unknown>;return`{${Object.keys(object).sort().map(key=>`${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;};

/** Binds a previously claimed step; it never starts a process or invents a PID/session.
 * SessionOwner refers to real task/run rows; spawnOwned records session_handle later.
 * EngineHost.prepareExecution(context) calls bind after claim/reservation inside the
 * engine transaction. Host candidate resolution for context.request.attemptId then
 * supplies binding.owner and binding.envelope to launchHostCodexRun. Replayed bindings
 * are historical facts, not permission to relaunch; engine owns that decision. */
export function createStageEnvelopeBinder(db: Ledger, host: {
  now(): number;
  resolveScope(scopeId: string, plan: ValidatedPlan): StageScopeGrant;
  authorizeStage(context: Readonly<{ plan: ValidatedPlan; task: PlanTask; parent: Envelope; stage: Envelope; candidateId: string }>): boolean;
}) {
  const readHistorical = (attemptId: string): StageEnvelopeBinding | null => {
    id(attemptId);
    return db.transaction(() => {
      const saved = db.prepare('SELECT * FROM orchestration_stage_envelope WHERE attempt_id=?').get(attemptId) as any;
      if (!saved) return null;
      const setup = db.prepare('SELECT * FROM attempt_staging_setup WHERE attempt_id=?').get(attemptId) as any;
      if (!setup) return binder.read(attemptId);
      const authority = db.prepare('SELECT * FROM attempt_staging_authority WHERE attempt_id=?').get(attemptId) as any;
      const cleanup = db.prepare('SELECT * FROM attempt_staging_cleanup WHERE attempt_id=?').get(attemptId) as any;
      const attempt = db.prepare('SELECT * FROM orchestration_attempt WHERE attempt_id=?').get(attemptId) as any;
      if (!authority || !cleanup || cleanup.result !== 'active_cleanup_verified' || !attempt || attempt.cleanup_verified !== 1 || !['completed','failed'].includes(attempt.state)) throw Error('stage_historical_cleanup_unverified');
      const parent = parentSnapshot(JSON.parse(saved.parent_json));
      const stage = archivedSnapshot(JSON.parse(saved.stage_json));
      const parentHash = envelopeHash(parent), stageHash = archivedHash(stage);
      const revision = db.prepare('SELECT revision FROM orchestration_attempt_revision WHERE attempt_id=?').get(attemptId) as {revision:number}|undefined;
      const request = JSON.parse(saved.request_json);
      if (parent.run_id !== saved.workflow_run_id || stage.run_id !== attemptId || saved.stage_run_id !== attemptId
        || parentHash !== saved.parent_envelope_hash || stageHash !== saved.stage_envelope_hash
        || request?.workflowRunId !== saved.workflow_run_id || request?.taskId !== saved.plan_task_id || request?.attemptId !== attemptId
        || JSON.stringify(request.parent) !== JSON.stringify(parent) || JSON.stringify(request.stage) !== JSON.stringify(stage)
        || (revision ? request.revision !== revision.revision || request.planDigest !== saved.plan_digest : Object.hasOwn(request,'revision') || Object.hasOwn(request,'planDigest'))) throw Error('stage_persisted_hash_mismatch');
      const child = db.prepare('SELECT r.task_id,r.envelope_hash,e.worktree_realpath,e.egress_json FROM run r JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE r.id=?').get(attemptId) as any;
      const parentRun = db.prepare('SELECT r.envelope_hash,e.worktree_realpath,e.egress_json FROM run r JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE r.id=?').get(saved.workflow_run_id) as any;
      if (!child || child.task_id !== saved.stage_task_id || child.envelope_hash !== stageHash || child.worktree_realpath !== stage.worktree_realpath
        || JSON.stringify(list(JSON.parse(child.egress_json))) !== JSON.stringify(stage.egress)
        || !parentRun || parentRun.envelope_hash !== parentHash || realpathSync.native(parentRun.worktree_realpath) !== parent.worktree_realpath
        || JSON.stringify(list(JSON.parse(parentRun.egress_json))) !== JSON.stringify(parent.egress)) throw Error('stage_persisted_owner_mismatch');
      const policy = readRunPolicyIdentity(db, saved.workflow_run_id);
      const stored = revision?.revision ? db.prepare('SELECT plan_digest digest,payload FROM orchestration_plan_revision WHERE run_id=? AND revision=? AND plan_digest=?').get(saved.workflow_run_id,revision.revision,saved.plan_digest) as any
        : db.prepare('SELECT digest,payload FROM orchestration_plan WHERE run_id=?').get(saved.workflow_run_id) as any;
      if (!policy || !stored) throw Error('stage_historical_plan_missing');
      const raw = JSON.parse(Buffer.isBuffer(stored.payload)?stored.payload.toString():stored.payload) as ValidatedPlan;
      const plan = validateTaskPlan(raw.approval,{revision:raw.revision,policyRevision:raw.approval.policyRevision,policyDigest:raw.approval.policyDigest,tasks:raw.tasks});
      const task = plan.tasks.find(t=>t.id===saved.plan_task_id);
      const candidateAllowed = task && (policy.kind === 'monetary'
        ? policy.snapshot.policy.allowedCandidateIds.includes(attempt.candidate_id)
        : (task.role === 'model-producer' && attempt.candidate_id === policy.snapshot.policy.producerCandidateId)
          || (task.role === 'verifier' && attempt.candidate_id === policy.snapshot.policy.checkerCandidateId));
      if (!task || plan.digest !== saved.plan_digest || stored.digest !== plan.digest || policy.digest !== saved.policy_digest
        || raw.approval.policyDigest !== policy.digest || raw.approval.policyRevision !== `${policy.policyId}:${policy.revision}`
        || attempt.run_id !== saved.workflow_run_id || attempt.task_id !== task.id || !task.candidateIds.includes(attempt.candidate_id) || !candidateAllowed
        || !db.prepare("SELECT 1 FROM approval_event WHERE run_id=? AND envelope_hash=? AND decision='accept'").get(saved.workflow_run_id,parentHash)) throw Error('stage_historical_plan_mismatch');
      const grants = JSON.parse(saved.scope_json) as StageScopeGrant[];
      if (!Array.isArray(grants) || grants.length !== task.scopeIds.length || grants.some((g,i)=>g.id!==task.scopeIds[i] || !isAbsolute(g.worktreeRealpath)
        || !contained(parent.worktree_realpath,g.worktreeRealpath) || !subset(list(g.allowedActions),parent.allowed_actions) || !subset(list(g.egress),parent.egress))) throw Error('stage_persisted_scope_mismatch');
      const applicable = grants.filter(g=>contained(g.worktreeRealpath,setup.publication_worktree_realpath));
      if (!contained(parent.worktree_realpath,setup.publication_worktree_realpath) || !subset(stage.allowed_actions,parent.allowed_actions)
        || !subset(stage.egress,parent.egress) || stage.allowed_actions.some(a=>!applicable.some(g=>g.allowedActions.includes(a)))
        || stage.egress.some(a=>!applicable.some(g=>g.egress.includes(a))) || Date.parse(stage.expires_at)>Date.parse(parent.expires_at)
        || (parent.autonomy_level==='supervised'&&stage.autonomy_level!=='supervised')
        || (task.role!=='implementation'&&stage.allowed_actions.some(a=>!['read','list','search'].includes(a)))) throw Error('stage_historical_scope_mismatch');
      const digest = (payload: Buffer) => createHash('sha256').update(payload).digest('hex');
      const proof = (row:any) => Buffer.isBuffer(row.payload) && digest(row.payload)===row.payload_sha256 && canonical(JSON.parse(row.payload.toString()))===row.payload.toString();
      if (!proof(setup) || !proof(authority) || !proof(cleanup)) throw Error('stage_historical_proof_corrupt');
      const s=JSON.parse(setup.payload.toString()),a=JSON.parse(authority.payload.toString()),c=JSON.parse(cleanup.payload.toString());
      const runStaging=db.prepare('SELECT * FROM run_staging_authority WHERE run_id=?').get(saved.workflow_run_id) as any;
      const rootContract=db.prepare('SELECT * FROM change_root_contract WHERE run_id=? AND task_id=?').get(saved.workflow_run_id,task.id) as any;
      const account=readAccountIdentities(db,saved.workflow_run_id).find(i=>i.candidateId===attempt.candidate_id);
      if (setup.attempt_id!==attemptId || setup.run_id!==saved.workflow_run_id || setup.task_id!==task.id || setup.candidate_id!==attempt.candidate_id
        || s.schemaVersion!=='cue-attempt-staging-setup-v1' || s.setupId!==setup.setup_id || s.attemptId!==attemptId || s.runId!==saved.workflow_run_id || s.taskId!==task.id || s.candidateId!==attempt.candidate_id
        || s.expectedSubjectDigest!==setup.expected_subject_digest || s.publicationWorktreeRealpath!==setup.publication_worktree_realpath
        || s.publicationRootIdentity?.volumeSerial!==setup.publication_volume_serial || s.publicationRootIdentity?.fileId!==setup.publication_file_id
        || s.baseCommitId!==setup.base_commit_id || s.cleanSnapshotSha256!==setup.clean_snapshot_sha256
        || s.factoryProtocol!==setup.factory_protocol || s.factorySha256!==setup.factory_sha256 || s.createdAtMs!==setup.created_at_ms
        || setup.publication_worktree_realpath!==parent.worktree_realpath
        || !runStaging || runStaging.enabled!==1 || runStaging.envelope_hash!==parentHash || runStaging.plan_digest!==plan.digest || runStaging.policy_digest!==policy.digest
        || runStaging.publication_worktree_realpath!==setup.publication_worktree_realpath || runStaging.publication_volume_serial!==setup.publication_volume_serial || runStaging.publication_file_id!==setup.publication_file_id
        || runStaging.factory_protocol!==setup.factory_protocol || runStaging.factory_sha256!==setup.factory_sha256 || runStaging.base_commit_id!==setup.base_commit_id || runStaging.clean_snapshot_sha256!==setup.clean_snapshot_sha256
        || !rootContract || rootContract.worktree_realpath!==setup.publication_worktree_realpath || rootContract.volume_serial!==setup.publication_volume_serial || rootContract.file_id!==setup.publication_file_id
        || authority.stage_envelope_hash!==stageHash || authority.parent_envelope_hash!==parentHash || authority.plan_digest!==plan.digest || authority.policy_digest!==policy.digest
        || authority.execution_worktree_realpath!==stage.worktree_realpath || a.schemaVersion!=='cue-attempt-staging-authority-v1' || a.attemptId!==attemptId || a.stageEnvelopeHash!==stageHash || a.parentEnvelopeHash!==parentHash
        || a.planDigest!==plan.digest || a.policyDigest!==policy.digest || a.executionWorktreeRealpath!==stage.worktree_realpath
        || a.executionRootIdentity?.volumeSerial!==authority.execution_volume_serial || a.executionRootIdentity?.fileId!==authority.execution_file_id || a.activatedAtMs!==authority.activated_at_ms
        || c.schemaVersion!=='cue-attempt-staging-cleanup-v1' || cleanup.evidence_sha256!==c.evidenceSha256 || cleanup.observed_at_ms!==c.observedAtMs || c.attemptId!==attemptId || c.setupId!==setup.setup_id
        || c.result!=='active_cleanup_verified' || c.rootAbsent!==true || c.metadataAbsent!==true || c.factoryProtocol!==setup.factory_protocol || c.factorySha256!==setup.factory_sha256
        || c.root?.kind!=='execution' || c.root.worktreeRealpath!==stage.worktree_realpath || c.root.identity?.volumeSerial!==authority.execution_volume_serial || c.root.identity?.fileId!==authority.execution_file_id
        || account?.subjectDigest!==setup.expected_subject_digest || account?.planDigest!==plan.digest || account?.policyDigest!==policy.digest || account?.envelopeHash!==parentHash) throw Error('stage_historical_lineage_mismatch');
      return Object.freeze({workflowRunId:saved.workflow_run_id,taskId:task.id,attemptId,envelope:stage,envelopeHash:stageHash,
        owner:Object.freeze({cwd:stage.worktree_realpath,task_id:saved.stage_task_id,run_id:attemptId}),parentEnvelopeHash:parentHash,
        planDigest:plan.digest,policyDigest:policy.digest,revision:revision?.revision??0,publicationWorktreeRealpath:setup.publication_worktree_realpath,replayed:true});
    })();
  };
  const binder = Object.freeze({
    readHistorical,
    /** Read persisted provenance, never a fresh launch authorization or renewal. */
    read(attemptId: string): StageEnvelopeBinding | null {
      id(attemptId);
      return db.transaction(() => {
        const saved = db.prepare('SELECT * FROM orchestration_stage_envelope WHERE attempt_id=?').get(attemptId) as {
          workflow_run_id: string; plan_task_id: string; stage_task_id: string; stage_run_id: string;
          parent_envelope_hash: string; stage_envelope_hash: string; parent_json: string; stage_json: string; scope_json: string; request_json: string;
        } | undefined;
        if (!saved) return null;
        const parent = parentSnapshot(JSON.parse(saved.parent_json)), stage = parentSnapshot(JSON.parse(saved.stage_json));
        const stagingSetup=db.prepare('SELECT * FROM attempt_staging_setup WHERE attempt_id=?').get(attemptId) as any;
        const isolated=stagingSetup?db.prepare(`SELECT a.*,s.setup_id,s.publication_worktree_realpath,s.expected_subject_digest FROM attempt_staging_authority a JOIN attempt_staging_setup s USING(attempt_id) WHERE a.attempt_id=?`).get(attemptId) as any:null;
        if(stagingSetup&&!isolated)throw Error('staging_create_unresolved');
        if(isolated&&db.prepare('SELECT 1 FROM attempt_staging_cleanup WHERE attempt_id=?').get(attemptId))throw Error('stage_staging_cleaned');
        if(isolated&&(isolated.stage_envelope_hash!==saved.stage_envelope_hash||isolated.parent_envelope_hash!==saved.parent_envelope_hash||isolated.plan_digest!==(saved as any).plan_digest||isolated.policy_digest!==(saved as any).policy_digest||isolated.execution_worktree_realpath!==stage.worktree_realpath))throw Error('stage_staging_authority_mismatch');
        if(isolated&&!db.prepare(`SELECT 1 FROM orchestration_attempt a JOIN orchestration_account_identity i ON i.run_id=a.run_id AND i.candidate_id=a.candidate_id WHERE a.attempt_id=? AND i.payload->>'subjectDigest'=?`).get(attemptId,isolated.expected_subject_digest))throw Error('stage_staging_subject_mismatch');
        const revisionRef=db.prepare('SELECT revision FROM orchestration_attempt_revision WHERE attempt_id=?').get(attemptId) as {revision:number}|undefined;
        const request=JSON.parse(saved.request_json);
        const requestMatches=request?.workflowRunId===saved.workflow_run_id&&request?.taskId===saved.plan_task_id&&request?.attemptId===attemptId
          &&JSON.stringify(request.parent)===JSON.stringify(parent)&&JSON.stringify(request.stage)===JSON.stringify(stage)
          &&(revisionRef?request.revision===revisionRef.revision&&request.planDigest===(saved as any).plan_digest:!Object.hasOwn(request,'revision')&&!Object.hasOwn(request,'planDigest'));
        if (parent.run_id !== saved.workflow_run_id || stage.run_id !== attemptId || saved.stage_run_id !== attemptId
            || envelopeHash(parent) !== saved.parent_envelope_hash || envelopeHash(stage) !== saved.stage_envelope_hash
            || !requestMatches) throw Error('stage_persisted_hash_mismatch');
        const child = db.prepare('SELECT r.task_id,r.envelope_hash,e.worktree_realpath,e.egress_json FROM run r JOIN task t ON t.id=r.task_id JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE r.id=?').get(attemptId) as { task_id: string; envelope_hash: string; worktree_realpath: string; egress_json: string } | undefined;
        if (!child || child.task_id !== saved.stage_task_id || child.envelope_hash !== saved.stage_envelope_hash
            || realpathSync.native(child.worktree_realpath) !== stage.worktree_realpath || JSON.stringify(list(JSON.parse(child.egress_json))) !== JSON.stringify(stage.egress)) throw Error('stage_persisted_owner_mismatch');
        const grants = JSON.parse(saved.scope_json) as StageScopeGrant[];
        if (!Array.isArray(grants) || grants.length > 256) throw Error('stage_persisted_scope_mismatch');
        // Reuse binding checks against the persisted scope snapshot; changed host
        // grants must not silently rewrite a historical stage after restart.
        const reader = createStageEnvelopeBinder(db, { now: host.now, authorizeStage: () => false,
          resolveScope: scopeId => { const grant = grants.find(g => g.id === scopeId); if (!grant) throw Error('stage_persisted_scope_mismatch'); return grant; } });
        return reader.bind({ workflowRunId: saved.workflow_run_id, taskId: saved.plan_task_id, attemptId, ...(revisionRef?{revision:revisionRef.revision,planDigest:(saved as any).plan_digest}:{}), parentEnvelope: parent,
          stage: { worktreeRealpath: stage.worktree_realpath, allowedActions: stage.allowed_actions, egress: stage.egress, expiresAt: stage.expires_at, autonomyLevel: stage.autonomy_level },...(isolated?{stagingSetupId:isolated.setup_id,stagingRootIdentity:{volumeSerial:isolated.execution_volume_serial,fileId:isolated.execution_file_id}}:{}) });
      })();
    },
    bind(input: StageEnvelopeRequest): StageEnvelopeBinding {
      const revisionInput=Object.hasOwn(input,'revision')||Object.hasOwn(input,'planDigest'),stagingInput=Object.hasOwn(input,'stagingSetupId')||Object.hasOwn(input,'stagingRootIdentity');
      const r = record(input, revisionInput?['workflowRunId','taskId','attemptId','parentEnvelope','revision','planDigest','stage',...(stagingInput?['stagingSetupId','stagingRootIdentity']:[])]:['workflowRunId','taskId','attemptId','parentEnvelope','stage',...(stagingInput?['stagingSetupId','stagingRootIdentity']:[])]);
      const workflowRunId = id(r.workflowRunId), taskId = id(r.taskId), attemptId = id(r.attemptId);
      if (workflowRunId === attemptId) throw Error('stage_requires_child_run');
      const parent = parentSnapshot(r.parentEnvelope);
      if (parent.run_id !== workflowRunId) throw Error('stage_parent_run_mismatch');
      const normalized=normalizeStageEnvelope(attemptId,r.stage as StageEnvelopeRequest['stage']),stage=normalized.envelope,stageHash=normalized.envelopeHash;
      const parentHash = envelopeHash(parent);
      const requestedRevision=revisionInput?r.revision as number:0,requestedDigest=revisionInput?text(r.planDigest):null;
      if(!Number.isSafeInteger(requestedRevision)||requestedRevision<0||revisionInput&&!/^[a-f0-9]{64}$/.test(requestedDigest!))throw Error('stage_revision_invalid');
      return db.transaction(() => {
        const row = db.prepare(`SELECT r.envelope_hash,e.worktree_realpath,e.egress_json,t.state
          FROM run r JOIN task t ON t.id=r.task_id JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE r.id=?`).get(workflowRunId) as { envelope_hash: string; worktree_realpath: string; egress_json: string; state: string } | undefined;
        if (!row || row.envelope_hash !== parentHash || realpathSync.native(row.worktree_realpath) !== parent.worktree_realpath || JSON.stringify(list(JSON.parse(row.egress_json))) !== JSON.stringify(parent.egress)) throw Error('stage_parent_binding_mismatch');
        if (!db.prepare("SELECT 1 FROM approval_event WHERE run_id=? AND envelope_hash=? AND decision='accept'").get(workflowRunId, parentHash)) throw Error('stage_parent_not_approved');
        const recovery=Boolean(db.prepare('SELECT 1 FROM orchestration_recovery_scope WHERE run_id=?').get(workflowRunId));
        if(recovery&&!revisionInput)throw Error('stage_explicit_revision_required');
        const stored = requestedRevision===0&&!recovery
          ? db.prepare('SELECT envelope_hash,digest,payload FROM orchestration_plan WHERE run_id=?').get(workflowRunId) as { envelope_hash: string; digest: string; payload: string } | undefined
          : db.prepare('SELECT envelope_hash,plan_digest digest,payload FROM orchestration_plan_revision WHERE run_id=? AND revision=? AND plan_digest=?').get(workflowRunId,requestedRevision,requestedDigest) as { envelope_hash: string; digest: string; payload: Buffer } | undefined;
        if (!stored || stored.envelope_hash !== parentHash) throw Error('stage_plan_missing');
        const p = JSON.parse(Buffer.isBuffer(stored.payload)?stored.payload.toString():stored.payload) as ValidatedPlan;
        const plan = validateTaskPlan(p.approval, { revision: p.revision, policyRevision: p.approval.policyRevision, policyDigest: p.approval.policyDigest, tasks: p.tasks });
        const policy = readRunPolicyIdentity(db, workflowRunId);
        if (!policy || plan.digest !== stored.digest || plan.approval.policyDigest !== policy.digest || plan.approval.policyRevision !== `${policy.policyId}:${policy.revision}`) throw Error('stage_policy_plan_mismatch');
        const task = plan.tasks.find(t => t.id === taskId);
        const attempt = db.prepare('SELECT run_id,task_id,candidate_id,state FROM orchestration_attempt WHERE attempt_id=?').get(attemptId) as { run_id: string; task_id: string; candidate_id: string; state: string } | undefined;
        const attemptRevision=db.prepare('SELECT revision FROM orchestration_attempt_revision WHERE attempt_id=? AND run_id=? AND task_id=?').get(attemptId,workflowRunId,taskId) as {revision:number}|undefined;
        if(recovery&&attemptRevision?.revision!==requestedRevision)throw Error('stage_attempt_revision_mismatch');
        const candidateAllowed = task && attempt && (policy.kind === 'monetary'
          ? policy.snapshot.policy.allowedCandidateIds.includes(attempt.candidate_id)
          : (task.role === 'model-producer' && attempt.candidate_id === policy.snapshot.policy.producerCandidateId)
            || (task.role === 'verifier' && attempt.candidate_id === policy.snapshot.policy.checkerCandidateId));
        if (!task || !attempt || attempt.run_id !== workflowRunId || attempt.task_id !== taskId || !task.candidateIds.includes(attempt.candidate_id) || !candidateAllowed) throw Error('stage_attempt_lineage');
        const durableSetup=db.prepare('SELECT * FROM attempt_staging_setup WHERE attempt_id=?').get(attemptId) as any;
        if(Boolean(durableSetup)!==stagingInput)throw Error('stage_staging_setup_required');
        const setup=stagingInput?db.prepare(`SELECT * FROM attempt_staging_setup WHERE setup_id=? AND attempt_id=? AND run_id=? AND task_id=? AND candidate_id=?`).get(id(r.stagingSetupId),attemptId,workflowRunId,taskId,attempt.candidate_id) as any:null;
        const stagingIdentity=stagingInput?record(r.stagingRootIdentity,['volumeSerial','fileId']):null;
        if(stagingInput&&(!setup||db.prepare('SELECT 1 FROM attempt_staging_cleanup WHERE attempt_id=?').get(attemptId)||!stagingIdentity||!/^[a-f0-9]{16}$/.test(text(stagingIdentity.volumeSerial))||!/^[a-f0-9]{32}$/.test(text(stagingIdentity.fileId))))throw Error('stage_staging_setup_mismatch');
        const scopes = task.scopeIds.map(scopeId => {
          const grant = record(host.resolveScope(scopeId, plan), ['id', 'worktreeRealpath', 'allowedActions', 'egress']);
          if (grant.id !== scopeId) throw Error('stage_scope_identity');
          return Object.freeze({ id: scopeId, worktreeRealpath: realpathSync.native(text(grant.worktreeRealpath)), allowedActions: Object.freeze(list(grant.allowedActions)), egress: Object.freeze(list(grant.egress)) });
        });
        // A scope grant cannot elevate its parent; permissions must be supplied by a
        // grant that actually contains this stage worktree, not another scope's root.
        if (scopes.some(g => !contained(parent.worktree_realpath, g.worktreeRealpath) || !subset(g.allowedActions, parent.allowed_actions) || !subset(g.egress, parent.egress))) throw Error('stage_scope_expansion');
        const permissionRoot=setup?.publication_worktree_realpath??stage.worktree_realpath;
        const applicable = scopes.filter(g => contained(g.worktreeRealpath, permissionRoot));
        const modelOnly = task.role !== 'implementation' && scopes.length === 0 && stage.allowed_actions.length === 0 && stage.egress.length === 0;
        if ((!setup&&!contained(parent.worktree_realpath, stage.worktree_realpath)) || (!applicable.length && !modelOnly)
            || !subset(stage.allowed_actions, parent.allowed_actions) || !subset(stage.egress, parent.egress)
            || stage.allowed_actions.some(a => !applicable.some(g => g.allowedActions.includes(a)))
            || stage.egress.some(a => !applicable.some(g => g.egress.includes(a)))) throw Error('stage_permission_expansion');
        if (parent.autonomy_level === 'supervised' && stage.autonomy_level !== 'supervised') throw Error('stage_autonomy_expansion');
        if (Date.parse(stage.expires_at) > Date.parse(parent.expires_at)) throw Error('stage_expiry_expansion');
        if (task.role !== 'implementation' && stage.allowed_actions.some(a => !['read', 'list', 'search'].includes(a))) throw Error('stage_readonly_role');
        const scopeJson = JSON.stringify(scopes);
        const existing = db.prepare('SELECT * FROM orchestration_stage_envelope WHERE attempt_id=?').get(attemptId) as { request_json: string; scope_json: string; stage_task_id: string; stage_run_id: string; stage_envelope_hash: string; plan_digest: string; policy_digest: string } | undefined;
        const stageTaskId = `stage-task-${createHash('sha256').update(attemptId).digest('hex')}`;
        const requestJson = JSON.stringify(revisionInput?{ workflowRunId, taskId, attemptId, revision:requestedRevision, planDigest:stored.digest, parent, stage }:{ workflowRunId, taskId, attemptId, parent, stage });
        const output = (replayed: boolean): StageEnvelopeBinding => Object.freeze({ workflowRunId, taskId, attemptId, envelope: stage, envelopeHash: stageHash,
          owner: Object.freeze({ cwd: stage.worktree_realpath, task_id: stageTaskId, run_id: attemptId }), parentEnvelopeHash: parentHash, planDigest: plan.digest, policyDigest: policy.digest, revision:requestedRevision,publicationWorktreeRealpath:setup?.publication_worktree_realpath??stage.worktree_realpath,replayed });
        if (existing) {
          if(setup){const authority=db.prepare('SELECT execution_worktree_realpath,execution_volume_serial,execution_file_id FROM attempt_staging_authority WHERE attempt_id=?').get(attemptId) as any;if(!authority||authority.execution_worktree_realpath!==stage.worktree_realpath||authority.execution_volume_serial!==stagingIdentity!.volumeSerial||authority.execution_file_id!==stagingIdentity!.fileId)throw Error('stage_staging_replay_mismatch');}
          if (existing.request_json !== requestJson || existing.scope_json !== scopeJson || existing.stage_task_id !== stageTaskId || existing.stage_run_id !== attemptId || existing.stage_envelope_hash !== stageHash || existing.plan_digest !== plan.digest || existing.policy_digest !== policy.digest) throw Error('stage_replay_mismatch');
          return output(true);
        }
        const now = host.now();
        if (!Number.isSafeInteger(now) || now < 0 || Date.parse(stage.expires_at) <= now || Date.parse(parent.expires_at) <= now) throw Error('stage_expired');
        if (row.state !== 'running' || attempt.state !== 'running') throw Error('stage_attempt_inactive');
        if (host.authorizeStage(Object.freeze({ plan, task, parent, stage, candidateId: attempt.candidate_id })) !== true) throw Error('stage_not_authorized');
        const createdAt = new Date(now).toISOString();
        db.prepare("INSERT INTO task VALUES(?,'running',NULL,?)").run(stageTaskId, createdAt);
        db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(stageHash, stage.worktree_realpath, JSON.stringify(stage.egress), createdAt);
        db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(attemptId, stageTaskId, stageHash, createdAt);
        db.prepare('INSERT INTO orchestration_stage_envelope VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(attemptId, workflowRunId, taskId, stageTaskId, attemptId, parentHash, stageHash, plan.digest, policy.digest, JSON.stringify(parent), JSON.stringify(stage), scopeJson, requestJson);
        if(setup){const activatedAtMs=now,value={schemaVersion:'cue-attempt-staging-authority-v1',attemptId,stageEnvelopeHash:stageHash,parentEnvelopeHash:parentHash,planDigest:plan.digest,policyDigest:policy.digest,executionWorktreeRealpath:stage.worktree_realpath,executionRootIdentity:{volumeSerial:text(stagingIdentity!.volumeSerial),fileId:text(stagingIdentity!.fileId)},activatedAtMs},encoded=Buffer.from(canonical(value));db.prepare('INSERT INTO attempt_staging_authority VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(attemptId,stageHash,parentHash,plan.digest,policy.digest,stage.worktree_realpath,value.executionRootIdentity.volumeSerial,value.executionRootIdentity.fileId,activatedAtMs,createHash('sha256').update(encoded).digest('hex'),encoded);}
        return output(false);
      }).immediate();
    },
  });
  return binder;
}
