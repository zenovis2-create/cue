import { createHash } from 'node:crypto';
import { isAbsolute, relative } from 'node:path';
import type { Ledger } from '../ledger.js';

export const ATTEMPT_STAGING_FACTORY_PROTOCOL = 'cue-attempt-staging-factory-v1' as const;

export interface StagingRootIdentity { readonly volumeSerial: string; readonly fileId: string }
export interface CleanRootInspection {
  readonly worktreeRealpath: string; readonly rootIdentity: StagingRootIdentity;
  readonly baseCommitId: string; readonly trackedModified: readonly string[];
  readonly staged: readonly string[]; readonly untracked: readonly string[]; readonly conflicted: readonly string[];
  readonly detached: boolean; readonly unborn: boolean; readonly reparseFree: boolean;
}
export interface StagingRootObservation {
  readonly worktreeRealpath: string; readonly rootIdentity: StagingRootIdentity; readonly reparseFree: boolean;
}
export interface StagingInheritedPublication {
  readonly relativePath: string; readonly maxBytes: number; readonly publishedSha256: string;
  readonly bytes: Buffer; readonly original: Buffer;
}
export interface StagingFactory {
  readonly protocol: typeof ATTEMPT_STAGING_FACTORY_PROTOCOL; readonly sha256: string;
  create(input: Readonly<{ attemptId: string; publicationWorktreeRealpath: string; baseCommitId: string; cleanSnapshotSha256: string; inherited?: readonly StagingInheritedPublication[] }>): StagingRootObservation;
  inspectRoot(input: StagingRootObservation): StagingRootObservation;
  inspectPublicationSeeds?(root: StagingRootObservation, inherited: readonly StagingInheritedPublication[]): void;
  readPublicationSeed?(root: StagingRootObservation, relativePath:string, maxBytes:number, publishedSha256:string, byteLength:number): Buffer;
  reconcilePublished?(input: StagingRootObservation, targets: readonly Readonly<{ relativePath: string; maxBytes: number; publishedSha256: string; original: Buffer }>[], inherited?: readonly StagingInheritedPublication[]): void;
  cleanup(input: StagingRootObservation): Readonly<{ rootAbsent: boolean; metadataAbsent: boolean; evidenceSha256: string; reason?: string }>;
  inspectCleanup(input: StagingRootObservation): Readonly<{ rootAbsent: boolean; metadataAbsent: boolean; evidenceSha256: string; reason?: string }>;
}
export interface PreparedStaging {
  readonly publicationWorktreeRealpath: string; readonly publicationRootIdentity: StagingRootIdentity;
  readonly baseCommitId: string; readonly cleanSnapshotSha256: string;
}

const hex = (value: string, length: number, code: string): string => {
  if (!new RegExp(`^[a-f0-9]{${length}}$`, 'u').test(value)) throw Error(code);
  return value;
};
const canonical = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) throw Error('staging_canonical_number'); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw Error('staging_canonical_object');
  return `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
};
const hash = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const bytes = (value: unknown): Buffer => Buffer.from(canonical(value));
const sameIdentity = (a: StagingRootIdentity, b: StagingRootIdentity): boolean => a.volumeSerial === b.volumeSerial && a.fileId === b.fileId;
const contains = (root: string, candidate: string): boolean => { const part = relative(root, candidate); return part === '' || (!isAbsolute(part) && part.split(/[\\/]/u)[0] !== '..'); };

function validateIdentity(value: StagingRootIdentity): StagingRootIdentity {
  return Object.freeze({ volumeSerial: hex(value.volumeSerial, 16, 'staging_volume_serial'), fileId: hex(value.fileId, 32, 'staging_file_id') });
}
function validateClean(value: CleanRootInspection): PreparedStaging {
  if (!value.reparseFree || value.detached || value.unborn || value.trackedModified.length || value.staged.length || value.untracked.length || value.conflicted.length) throw Error('staging_publication_root_not_clean');
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value.baseCommitId)) throw Error('staging_base_commit_invalid');
  const rootIdentity = validateIdentity(value.rootIdentity);
  const snapshot = { schemaVersion: 'cue-clean-root-inspection-v1', worktreeRealpath: value.worktreeRealpath, rootIdentity, baseCommitId: value.baseCommitId,
    trackedModified: [], staged: [], untracked: [], conflicted: [], detached: false, unborn: false, reparseFree: true };
  return Object.freeze({ publicationWorktreeRealpath: value.worktreeRealpath, publicationRootIdentity: rootIdentity, baseCommitId: value.baseCommitId, cleanSnapshotSha256: hash(canonical(snapshot)) });
}

export function createAttemptStagingAuthorityCoordinator(db: Ledger, host: Readonly<{
  now(): number; inspectCleanRoot(publicationWorktreeRealpath: string): CleanRootInspection; factory: StagingFactory;
}>) {
  const freshSetups=new Set<string>();
  function inheritedFor(runId:string,taskId:string): readonly StagingInheritedPublication[] {
    const rsa=db.prepare('SELECT publication_worktree_realpath,publication_volume_serial,publication_file_id FROM run_staging_authority WHERE run_id=? AND enabled=1').get(runId) as {publication_worktree_realpath:string;publication_volume_serial:string;publication_file_id:string}|undefined;
    if(!rsa)throw Error('staging_inherited_lineage_unavailable');
    const publicationRoot={worktreeRealpath:rsa.publication_worktree_realpath,rootIdentity:{volumeSerial:rsa.publication_volume_serial,fileId:rsa.publication_file_id},reparseFree:true};
    const contracts=db.prepare(`SELECT tc.task_id,tc.relative_path,tc.max_backup_bytes FROM change_target_contract tc
      JOIN orchestration_step os ON os.run_id=tc.run_id AND os.task_id=tc.task_id AND os.state='completed'
      WHERE tc.run_id=? AND tc.task_id<>? ORDER BY lower(tc.relative_path),tc.task_id`).all(runId,taskId) as {task_id:string;relative_path:string;max_backup_bytes:number}[];
    const inherited:StagingInheritedPublication[]=[]; const seen=new Set<string>();
    for(const contract of contracts){
      const rows=db.prepare(`SELECT i.max_bytes,r.after_sha256,r.after_byte_length,ce.preimage,ce.sha256 original_sha256
        FROM orchestration_attempt a JOIN attempt_staging_cleanup ac ON ac.attempt_id=a.attempt_id AND ac.result='active_cleanup_verified'
        JOIN change_set cs ON cs.attempt_id=a.attempt_id JOIN change_entry ce ON ce.change_set_id=cs.change_set_id AND ce.relative_path=?
        JOIN change_publication_intent i ON i.change_set_id=cs.change_set_id AND i.target_ordinal=ce.ordinal AND i.relative_path=ce.relative_path
        JOIN change_publication_result r ON r.publication_id=i.publication_id AND r.state='committed'
        WHERE a.run_id=? AND a.task_id=? AND a.state='completed' AND a.cleanup_verified=1`).all(contract.relative_path,runId,contract.task_id) as {max_bytes:number;after_sha256:string;after_byte_length:number;preimage:Buffer;original_sha256:string}[];
      const key=contract.relative_path.toLocaleLowerCase('en-US');
      if(rows.length!==1||seen.has(key))throw Error('staging_inherited_lineage_unavailable'); seen.add(key);
      const row=rows[0];
      if(!Buffer.isBuffer(row.preimage)||row.max_bytes!==contract.max_backup_bytes||row.preimage.length>row.max_bytes
        ||hash(row.preimage)!==row.original_sha256||!Number.isSafeInteger(row.after_byte_length)||row.after_byte_length<0||row.after_byte_length>row.max_bytes
        ||!/^[a-f0-9]{64}$/u.test(row.after_sha256)||!host.factory.readPublicationSeed)throw Error('staging_inherited_lineage_unavailable');
      const published=host.factory.readPublicationSeed(publicationRoot,contract.relative_path,row.max_bytes,row.after_sha256,row.after_byte_length);
      inherited.push(Object.freeze({relativePath:contract.relative_path,maxBytes:row.max_bytes,publishedSha256:row.after_sha256,bytes:Buffer.from(published),original:Buffer.from(row.preimage)}));
    }
    return Object.freeze(inherited);
  }
  function verifyPublication(prepared:PreparedStaging,runId:string,taskId:string):readonly StagingInheritedPublication[]{
    const inherited=inheritedFor(runId,taskId), observation=host.inspectCleanRoot(prepared.publicationWorktreeRealpath);
    const baseline=validateClean({...observation,trackedModified:[]});
    if(canonical(baseline)!==canonical(prepared)||observation.staged.length||observation.untracked.length||observation.conflicted.length)throw Error('staging_publication_snapshot_changed');
    const dirty=observation.trackedModified.map(path=>path.toLocaleLowerCase('en-US')).sort();
    const owned=inherited.filter(seed=>hash(seed.original)!==seed.publishedSha256).map(seed=>seed.relativePath.toLocaleLowerCase('en-US')).sort();
    if(canonical(dirty)!==canonical(owned))throw Error('staging_publication_unowned_drift');
    if(inherited.length){if(!host.factory.inspectPublicationSeeds)throw Error('staging_inherited_factory_unsupported');
      host.factory.inspectPublicationSeeds({worktreeRealpath:prepared.publicationWorktreeRealpath,rootIdentity:prepared.publicationRootIdentity,reparseFree:true},inherited);}
    return inherited;
  }
  hex(host.factory.sha256, 64, 'staging_factory_sha256');
  if (host.factory.protocol !== ATTEMPT_STAGING_FACTORY_PROTOCOL) throw Error('staging_factory_protocol');
  const recordCleanup = (attemptId: string, result: 'create_failed_verified'|'create_unknown'|'active_cleanup_verified'|'active_cleanup_unknown', root:StagingRootObservation|null, observation: Readonly<{ rootAbsent?: boolean; metadataAbsent?: boolean; evidenceSha256: string; reason?: string }>) => {
    const observedAtMs = host.now();
    const setup=db.prepare('SELECT setup_id,factory_protocol,factory_sha256 FROM attempt_staging_setup WHERE attempt_id=?').get(attemptId) as {setup_id:string;factory_protocol:string;factory_sha256:string}|undefined;
    if(!setup||setup.factory_protocol!==host.factory.protocol||setup.factory_sha256!==host.factory.sha256)throw Error('staging_factory_changed');
    const payload = { schemaVersion: 'cue-attempt-staging-cleanup-v1', attemptId, setupId:setup.setup_id, result, observedAtMs, evidenceSha256: hex(observation.evidenceSha256,64,'staging_cleanup_evidence'), factoryProtocol: host.factory.protocol, factorySha256: host.factory.sha256,
      root:root?{kind:'execution',worktreeRealpath:root.worktreeRealpath,identity:validateIdentity(root.rootIdentity)}:{kind:'unknown-execution',worktreeRealpath:null,identity:null},
      ...(result.endsWith('_verified') ? { rootAbsent: observation.rootAbsent, metadataAbsent: observation.metadataAbsent } : { reason: observation.reason }) };
    const encoded = bytes(payload);
    db.prepare('INSERT INTO attempt_staging_cleanup VALUES(?,?,?,?,?,?)').run(attemptId,result,observedAtMs,payload.evidenceSha256,hash(encoded),encoded);
  };
  const recordDiscard = (execution:Readonly<{runId:string;taskId:string;attemptId:string;receiptId:string;revision:number;outcome:string;cleanup:string;evidenceRef:string;observedAtMs:number}>, result:'discard_verified'|'discard_unknown', root:StagingRootObservation, observation:Readonly<{rootAbsent?:boolean;metadataAbsent?:boolean;evidenceSha256:string;reason?:string}>) => {
    const observedAtMs=host.now();
    const setup=db.prepare('SELECT setup_id,factory_protocol,factory_sha256 FROM attempt_staging_setup WHERE attempt_id=?').get(execution.attemptId) as {setup_id:string;factory_protocol:string;factory_sha256:string}|undefined;
    if(!setup||setup.factory_protocol!==host.factory.protocol||setup.factory_sha256!==host.factory.sha256)throw Error('staging_factory_changed');
    const receiptSha256=hash(canonical(execution));
    const payload={schemaVersion:'cue-attempt-staging-discard-v1',attemptId:execution.attemptId,setupId:setup.setup_id,runId:execution.runId,taskId:execution.taskId,receiptId:execution.receiptId,receiptRevision:execution.revision,receiptObservedAtMs:execution.observedAtMs,receiptSha256,outcome:execution.outcome,cleanup:execution.cleanup,receiptEvidenceRef:execution.evidenceRef,result,observedAtMs,evidenceSha256:hex(observation.evidenceSha256,64,'staging_discard_evidence'),factoryProtocol:host.factory.protocol,factorySha256:host.factory.sha256,root:{kind:'execution',worktreeRealpath:root.worktreeRealpath,identity:validateIdentity(root.rootIdentity)},...(result==='discard_verified'?{rootAbsent:observation.rootAbsent,metadataAbsent:observation.metadataAbsent}:{reason:observation.reason})};
    const encoded=bytes(payload);
    db.prepare('INSERT INTO attempt_staging_discard VALUES(?,?,?,?,?,?)').run(execution.attemptId,result,observedAtMs,payload.evidenceSha256,hash(encoded),encoded);
  };
  return Object.freeze({
    prepare(publicationWorktreeRealpath: string): PreparedStaging {
      const prepared=validateClean(host.inspectCleanRoot(publicationWorktreeRealpath));
      if(prepared.publicationWorktreeRealpath!==publicationWorktreeRealpath)throw Error('staging_publication_root_mismatch');
      return prepared;
    },
    persistSetup(input:Readonly<{runId:string;taskId:string;attemptId:string;candidateId:string;expectedSubjectDigest:string;prepared:PreparedStaging}>):void{
      if(db.prepare('SELECT 1 FROM attempt_staging_setup WHERE attempt_id=?').get(input.attemptId))return;
      const inherited=verifyPublication(input.prepared,input.runId,input.taskId);
      const recheck=input.prepared;
      if(inherited.some(seed=>db.prepare('SELECT 1 FROM change_target_contract WHERE run_id=? AND task_id=? AND lower(relative_path)=lower(?)').get(input.runId,input.taskId,seed.relativePath)))throw Error('staging_inherited_target_overlap');
      const setupId=`staging-${hash(input.attemptId)}`,createdAtMs=host.now();
      const setup={schemaVersion:'cue-attempt-staging-setup-v1',setupId,attemptId:input.attemptId,runId:input.runId,taskId:input.taskId,candidateId:input.candidateId,publicationWorktreeRealpath:recheck.publicationWorktreeRealpath,publicationRootIdentity:recheck.publicationRootIdentity,baseCommitId:recheck.baseCommitId,cleanSnapshotSha256:recheck.cleanSnapshotSha256,expectedSubjectDigest:hex(input.expectedSubjectDigest,64,'staging_subject_digest'),factoryProtocol:host.factory.protocol,factorySha256:host.factory.sha256,createdAtMs};
      const encoded=bytes(setup);db.prepare('INSERT INTO attempt_staging_setup VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(setupId,input.attemptId,input.runId,input.taskId,input.candidateId,recheck.publicationWorktreeRealpath,recheck.publicationRootIdentity.volumeSerial,recheck.publicationRootIdentity.fileId,recheck.baseCommitId,recheck.cleanSnapshotSha256,setup.expectedSubjectDigest,host.factory.protocol,host.factory.sha256,createdAtMs,hash(encoded),encoded);freshSetups.add(input.attemptId);
    },
    prepareExecution(input: Readonly<{ runId:string; taskId:string; attemptId:string; candidateId:string; expectedSubjectDigest:string; prepared:PreparedStaging; bind(request: Readonly<Record<string,unknown>>): unknown; stageRequest:Readonly<Record<string,unknown>> }>): unknown {
      const existing = db.prepare(`SELECT s.publication_worktree_realpath,s.publication_volume_serial,s.publication_file_id,s.base_commit_id,s.clean_snapshot_sha256,s.expected_subject_digest,s.setup_id,s.factory_protocol,s.factory_sha256,
        a.execution_worktree_realpath,a.execution_volume_serial,a.execution_file_id FROM attempt_staging_setup s LEFT JOIN attempt_staging_authority a USING(attempt_id) WHERE s.attempt_id=?`).get(input.attemptId) as any;
      if (existing) {
        if (db.prepare('SELECT 1 FROM attempt_staging_cleanup WHERE attempt_id=?').get(input.attemptId)) throw Error('staging_attempt_terminal');
        if (!existing.execution_worktree_realpath&&!freshSetups.delete(input.attemptId)) throw Error('staging_create_unresolved');
        if(existing.factory_protocol!==host.factory.protocol||existing.factory_sha256!==host.factory.sha256)throw Error('staging_factory_changed');
        if(existing.expected_subject_digest!==input.expectedSubjectDigest)throw Error('staging_subject_changed');
        verifyPublication(input.prepared,input.runId,input.taskId);
        const clean=input.prepared;
        if(clean.baseCommitId!==existing.base_commit_id||clean.cleanSnapshotSha256!==existing.clean_snapshot_sha256||clean.publicationRootIdentity.volumeSerial!==existing.publication_volume_serial||clean.publicationRootIdentity.fileId!==existing.publication_file_id)throw Error('staging_publication_snapshot_changed');
        if(existing.execution_worktree_realpath){const execution={worktreeRealpath:existing.execution_worktree_realpath,rootIdentity:{volumeSerial:existing.execution_volume_serial,fileId:existing.execution_file_id},reparseFree:true};
        const observed=host.factory.inspectRoot(execution);
        if(observed.worktreeRealpath!==execution.worktreeRealpath||!observed.reparseFree||!sameIdentity(observed.rootIdentity,execution.rootIdentity))throw Error('staging_execution_identity_changed');
        const requestedStage=input.stageRequest.stage as Readonly<Record<string,unknown>>;
        return input.bind(Object.freeze({...input.stageRequest,stage:Object.freeze({...requestedStage,worktreeRealpath:execution.worktreeRealpath}),stagingSetupId:existing.setup_id,stagingRootIdentity:execution.rootIdentity}));}
      }
      const inherited=verifyPublication(input.prepared,input.runId,input.taskId);
      const recheck=input.prepared;
      if(inherited.some(seed=>db.prepare('SELECT 1 FROM change_target_contract WHERE run_id=? AND task_id=? AND lower(relative_path)=lower(?)').get(input.runId,input.taskId,seed.relativePath)))throw Error('staging_inherited_target_overlap');
      const setupId = existing?.setup_id??`staging-${hash(input.attemptId)}`;
      const createdAtMs = host.now();
      const setup = { schemaVersion:'cue-attempt-staging-setup-v1', setupId, attemptId:input.attemptId, runId:input.runId, taskId:input.taskId, candidateId:input.candidateId,
        publicationWorktreeRealpath:recheck.publicationWorktreeRealpath, publicationRootIdentity:recheck.publicationRootIdentity, baseCommitId:recheck.baseCommitId,
        cleanSnapshotSha256:recheck.cleanSnapshotSha256, expectedSubjectDigest:hex(input.expectedSubjectDigest,64,'staging_subject_digest'), factoryProtocol:host.factory.protocol, factorySha256:host.factory.sha256, createdAtMs };
      const setupBytes=bytes(setup);
      if(!existing)db.prepare('INSERT INTO attempt_staging_setup VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(setupId,input.attemptId,input.runId,input.taskId,input.candidateId,recheck.publicationWorktreeRealpath,recheck.publicationRootIdentity.volumeSerial,recheck.publicationRootIdentity.fileId,recheck.baseCommitId,recheck.cleanSnapshotSha256,setup.expectedSubjectDigest,host.factory.protocol,host.factory.sha256,createdAtMs,hash(setupBytes),setupBytes);
      let created: StagingRootObservation | undefined;
      try {
        const returned=host.factory.create({attemptId:input.attemptId,publicationWorktreeRealpath:recheck.publicationWorktreeRealpath,baseCommitId:recheck.baseCommitId,cleanSnapshotSha256:recheck.cleanSnapshotSha256,inherited});
        if(!returned||typeof returned.worktreeRealpath!=='string'||!returned.worktreeRealpath||returned.reparseFree!==true)throw Error('staging_factory_result_invalid');
        validateIdentity(returned.rootIdentity);created=returned;
        const observed=host.factory.inspectRoot(created), identity=validateIdentity(observed.rootIdentity);
        if (!observed.reparseFree || observed.worktreeRealpath!==created.worktreeRealpath || !sameIdentity(identity,created.rootIdentity)
          || observed.worktreeRealpath.toLocaleLowerCase('en-US')===recheck.publicationWorktreeRealpath.toLocaleLowerCase('en-US')
          || contains(recheck.publicationWorktreeRealpath,observed.worktreeRealpath) || contains(observed.worktreeRealpath,recheck.publicationWorktreeRealpath)
          || sameIdentity(identity,recheck.publicationRootIdentity)) throw Error('staging_execution_root_invalid');
        const requestedStage=input.stageRequest.stage as Readonly<Record<string,unknown>>;
        return input.bind(Object.freeze({...input.stageRequest,stage:Object.freeze({...requestedStage,worktreeRealpath:observed.worktreeRealpath}),stagingSetupId:setupId,stagingRootIdentity:identity}));
      } catch (error) {
        if (!created) {
          recordCleanup(input.attemptId,'create_unknown',null,{evidenceSha256:hash(String(error)),reason:'factory-create-threw-without-execution-identity'}); throw error;
        }
        let proof:ReturnType<StagingFactory['inspectCleanup']>;
        try { host.factory.cleanup(created); proof=host.factory.inspectCleanup(created); }
        catch(cleanupError){proof={rootAbsent:false,metadataAbsent:false,evidenceSha256:hash(String(cleanupError)),reason:'cleanup-inspection-threw'};}
        const verified=proof.rootAbsent===true&&proof.metadataAbsent===true;
        recordCleanup(input.attemptId,verified?'create_failed_verified':'create_unknown',created,{...proof,reason:proof.reason??'cleanup-unproved'});
        throw error;
      }
    },
    cleanupActive(execution: Readonly<{runId:string;taskId:string;attemptId:string;cleanup:string;evidenceRef:string}>): void {
      const attemptId=execution.attemptId;
      const active=db.prepare('SELECT run_id,task_id,state FROM orchestration_attempt WHERE attempt_id=?').get(attemptId) as {run_id:string;task_id:string;state:string}|undefined;
      if(!active||active.run_id!==execution.runId||active.task_id!==execution.taskId||active.state!=='running'||execution.cleanup!=='clean'||typeof execution.evidenceRef!=='string'||!execution.evidenceRef)throw Error('staging_cleanup_quiescence_unverified');
      const row=db.prepare(`SELECT a.execution_worktree_realpath,a.execution_volume_serial,a.execution_file_id,s.factory_protocol,s.factory_sha256 FROM attempt_staging_authority a JOIN attempt_staging_setup s USING(attempt_id) WHERE a.attempt_id=?`).get(attemptId) as {execution_worktree_realpath:string;execution_volume_serial:string;execution_file_id:string;factory_protocol:string;factory_sha256:string}|undefined;
      if(!row)throw Error('staging_authority_missing');
      if(row.factory_protocol!==host.factory.protocol||row.factory_sha256!==host.factory.sha256)throw Error('staging_factory_changed');
      const root={worktreeRealpath:row.execution_worktree_realpath,rootIdentity:{volumeSerial:row.execution_volume_serial,fileId:row.execution_file_id},reparseFree:true};
      let proof:ReturnType<StagingFactory['inspectCleanup']>;
      try {
        const targets=db.prepare(`SELECT i.relative_path,i.max_bytes,r.after_sha256 published_sha256,ce.preimage,ce.sha256 original_sha256,ce.byte_length
          FROM change_set cs JOIN change_entry ce ON ce.change_set_id=cs.change_set_id
          JOIN change_publication_intent i ON i.change_set_id=cs.change_set_id AND i.relative_path=ce.relative_path AND i.target_ordinal=ce.ordinal
          JOIN change_publication_result r USING(publication_id) WHERE cs.attempt_id=? AND i.attempt_id=? AND r.state='committed' ORDER BY i.target_ordinal`).all(attemptId,attemptId) as {relative_path:string;max_bytes:number;published_sha256:string;preimage:Buffer;original_sha256:string;byte_length:number}[];
        const expected=db.prepare(`SELECT count(*) n FROM change_set cs,json_each(cs.approved_targets_json) WHERE cs.attempt_id=?`).get(attemptId) as {n:number}|undefined;
        if(!expected||targets.length!==expected.n||targets.length===0)throw Error('staging_publication_reconciliation_incomplete');
        if(targets.some(target=>!Buffer.isBuffer(target.preimage)||target.preimage.length!==target.byte_length||target.byte_length>target.max_bytes||hash(target.preimage)!==target.original_sha256))throw Error('staging_publication_preimage_corrupt');
        if(host.factory.reconcilePublished)host.factory.reconcilePublished(root,targets.map(target=>Object.freeze({relativePath:target.relative_path,maxBytes:target.max_bytes,publishedSha256:target.published_sha256,original:Buffer.from(target.preimage)})),inheritedFor(execution.runId,execution.taskId));
        host.factory.cleanup(root); proof=host.factory.inspectCleanup(root);
      }
      catch(error){proof={rootAbsent:false,metadataAbsent:false,evidenceSha256:hash(String(error)),reason:'cleanup-inspection-threw'};}
      const verified=proof.rootAbsent===true&&proof.metadataAbsent===true;
      recordCleanup(attemptId,verified?'active_cleanup_verified':'active_cleanup_unknown',root,{...proof,reason:proof.reason??'cleanup-unproved'});
      if(!verified)throw Error('staging_cleanup_unknown');
    },
    cleanupDiscarded(execution:Readonly<{runId:string;taskId:string;attemptId:string;receiptId:string;revision:number;outcome:string;cleanup:string;evidenceRef:string;observedAtMs:number}>):void{
      if(execution.outcome!=='failed'||execution.cleanup!=='clean'||typeof execution.receiptId!=='string'||!execution.receiptId||!Number.isSafeInteger(execution.revision)||execution.revision<1||!Number.isSafeInteger(execution.observedAtMs)||execution.observedAtMs<0||typeof execution.evidenceRef!=='string'||!execution.evidenceRef)throw Error('staging_discard_unverified');
      const authorization=db.prepare('SELECT receipt_id,receipt_revision,receipt_sha256 FROM attempt_staging_discard_authorization WHERE attempt_id=?').get(execution.attemptId) as {receipt_id:string;receipt_revision:number;receipt_sha256:string}|undefined;
      if(!authorization||authorization.receipt_id!==execution.receiptId||authorization.receipt_revision!==execution.revision||authorization.receipt_sha256!==hash(canonical(execution)))throw Error('staging_discard_unverified');
      const prior=db.prepare('SELECT result FROM attempt_staging_discard WHERE attempt_id=?').get(execution.attemptId) as {result:string}|undefined;
      if(prior){if(prior.result==='discard_verified')return;throw Error('staging_discard_unknown');}
      const row=db.prepare(`SELECT a.execution_worktree_realpath,a.execution_volume_serial,a.execution_file_id,s.factory_protocol,s.factory_sha256 FROM attempt_staging_authority a JOIN attempt_staging_setup s USING(attempt_id) WHERE a.attempt_id=?`).get(execution.attemptId) as {execution_worktree_realpath:string;execution_volume_serial:string;execution_file_id:string;factory_protocol:string;factory_sha256:string}|undefined;
      if(!row)throw Error('staging_authority_missing');
      if(row.factory_protocol!==host.factory.protocol||row.factory_sha256!==host.factory.sha256)throw Error('staging_factory_changed');
      const root={worktreeRealpath:row.execution_worktree_realpath,rootIdentity:{volumeSerial:row.execution_volume_serial,fileId:row.execution_file_id},reparseFree:true};
      let proof:ReturnType<StagingFactory['inspectCleanup']>;
      try{
        const observed=host.factory.inspectRoot(root);
        if(observed.worktreeRealpath!==root.worktreeRealpath||!observed.reparseFree||!sameIdentity(observed.rootIdentity,root.rootIdentity))throw Error('staging_execution_identity_changed');
        host.factory.cleanup(root);proof=host.factory.inspectCleanup(root);
      }catch(error){proof={rootAbsent:false,metadataAbsent:false,evidenceSha256:hash(String(error)),reason:'discard-cleanup-inspection-threw'};}
      const verified=proof.rootAbsent===true&&proof.metadataAbsent===true;
      recordDiscard(execution,verified?'discard_verified':'discard_unknown',root,{...proof,reason:proof.reason??'discard-cleanup-unproved'});
      if(!verified)throw Error('staging_discard_unknown');
    },
  });
}
