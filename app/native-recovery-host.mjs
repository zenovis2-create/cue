import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { dirname, join, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';
import { isInstallationGeneration } from './installation-identity.mjs';
import { createNativeRecoveryObserver } from '../daemon/dist/src/native-recovery-observer.js';
import { createNativeExecutionIdentityStore } from '../daemon/dist/src/native-execution-identity-store.js';
import { createCleanupObservationStore } from '../daemon/dist/src/cleanup-observation-store.js';
import { observeChangeSet } from '../daemon/dist/src/change-records.js';
import { readHeldRecovery, reconcileHeldRecovery } from '../daemon/dist/src/held-recovery.js';
import { validateTaskPlan } from '../daemon/dist/src/orchestration/plan.js';
import { createHandoffActivityStore } from '../daemon/dist/src/orchestration/handoff-activity.js';

const root = dirname(dirname(fileURLToPath(import.meta.url))), dependencies = join(root, 'daemon', 'node_modules');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && win32.normalize(a).toLowerCase() === win32.normalize(b).toLowerCase();
const fail = () => { throw Error('native_recovery_host_unavailable'); };
const hash = value => createHash('sha256').update(value).digest('hex');
function record(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const d = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !d[k]?.enumerable || !Object.hasOwn(d[k], 'value'))) fail();
  return Object.fromEntries(keys.map(k => [k, d[k].value]));
}
function id(value) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value)) fail(); return value; }
function json(value) { if (typeof value !== 'string' || Buffer.byteLength(value) > 1048576) fail(); return JSON.parse(value); }
function freeze(value) { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
// Historical normalization deliberately performs no realpath/FS access: the old
// stage workspace may no longer exist. Compare the original canonical bytes.
function envelope(text) {
  const e = record(json(text), ['allowed_actions','autonomy_level','egress','expires_at','run_id','worktree_realpath']);
  for (const key of ['allowed_actions','egress']) {
    if (!Array.isArray(e[key]) || e[key].length > 256 || e[key].some(v => typeof v !== 'string' || v.length > 2048)) fail();
    if (JSON.stringify([...new Set(e[key])].sort()) !== JSON.stringify(e[key])) fail();
  }
  if (!['supervised','bounded'].includes(e.autonomy_level) || typeof e.expires_at !== 'string' || new Date(e.expires_at).toISOString() !== e.expires_at
    || typeof e.worktree_realpath !== 'string' || e.worktree_realpath.length > 2048 || !/^[A-Za-z]:[\\/]/.test(e.worktree_realpath)) fail();
  id(e.run_id);
  const canonical = { allowed_actions: e.allowed_actions, autonomy_level: e.autonomy_level, egress: e.egress, expires_at: e.expires_at, run_id: e.run_id, worktree_realpath: e.worktree_realpath };
  if (JSON.stringify(canonical) !== text) fail();
  return canonical;
}

/** Protected read-only service, independent of settings, provider health or
 * current execution qualification. Does not release ownership or repair state. */
export function createNativeRecoveryHost({ guard, daemon, worktree, handoffAuthority, externalEffectObservers=new Map(), externalEffectVerifier }) {
  if (!isInstallationGeneration(guard) || !same(guard.snapshot.root, root) || !same(guard.snapshot.dependencyRoot, dependencies)) fail();
  const db = daemon.db, workspace = realpathSync.native(worktree), store = createNativeExecutionIdentityStore(db), cleanupStore=createCleanupObservationStore(db);
  const handoffs=createHandoffActivityStore(db,{authorizeArtifact:(ref,attempt)=>handoffAuthority?.authorizeHandoffArtifact?.(ref,attempt)===true,
    resolveArtifact:(ref,attempt)=>handoffAuthority?.resolveHandoffArtifact?.(ref,attempt)??null});
  function current() {
    if (!db.open || db.inTransaction || !isInstallationGeneration(guard)) fail();
    if (guard.assertCurrent() !== true) fail();
    if (!db.open || db.inTransaction) fail();
    return true;
  }
  const observer = createNativeRecoveryObserver({ db, assertInstallationCurrent: current });
  function cleanupVerified(attemptId, identity) {
    const attempt=db.prepare('SELECT run_id,task_id,state,cleanup_verified FROM orchestration_attempt WHERE attempt_id=?').get(attemptId);
    if(identity.runId!==attemptId||!attempt||attempt.cleanup_verified!==1||!['completed','failed','blocked'].includes(attempt.state))return false;
    const receipt=db.prepare('SELECT receipt_id,revision,payload FROM orchestration_receipt WHERE attempt_id=? ORDER BY revision DESC LIMIT 1').get(attemptId);if(!receipt)return false;
    try{const value=record(JSON.parse(receipt.payload),['runId','taskId','attemptId','receiptId','revision','outcome','cleanup','evidenceRef','observedAtMs']);
      if(value.runId!==attempt.run_id||value.taskId!==attempt.task_id||value.attemptId!==attemptId||value.receiptId!==receipt.receipt_id||value.revision!==receipt.revision||value.cleanup!=='clean'||!['succeeded','failed'].includes(value.outcome))return false;
      const bytes=cleanupStore.read(value.evidenceRef);if(!bytes)return false;const cleanup=record(JSON.parse(Buffer.from(bytes).toString('utf8')),['billing','candidateId','measuredAt','providerStopped','reason','result','role','runId','session','subjectDigest']);
      const session=record(cleanup.session,['cwd','handle','pid','run_id','start_time','task_id']);
      return cleanup.runId===identity.runId&&cleanup.candidateId===identity.candidateId&&cleanup.role==='model'&&cleanup.subjectDigest===identity.subjectDigest&&cleanup.result==='verified-clean'&&cleanup.providerStopped==='unknown'&&cleanup.billing==='unknown'&&Object.entries(identity.session).every(([key,field])=>session[key]===field);
    }catch{return false;}
  }
  async function journalRecovery(attemptId,identity,value){
    let held;try{held=readHeldRecovery(db,attemptId);}catch{return {state:'unavailable'};}
    if(!held)return {state:'unavailable'};if(held.state!=='held')return held;
    const nativeDead=value.sourceKind==='native'&&value.pathProvenance==='matched'&&Object.values(value.processes).every(p=>['matching-exited','absent','pid-reused'].includes(p.state))&&Object.values(value.paths).every(p=>p==='absent');
    const authority=()=>cleanupVerified(attemptId,identity)&&db.prepare('SELECT 1 FROM native_execution_identity WHERE run_id=? AND session_handle=? AND subject_digest=?').get(identity.runId,identity.session.handle,identity.subjectDigest)!==undefined;
    if(!nativeDead||!authority())return {...held,reasonCode:'cleanup-or-death-unverified'};
    if(!held.changeSetId||db.prepare('SELECT 1 FROM native_change_journal_legacy WHERE attempt_id=?').get(attemptId))return {...held,reason:held.changeSetId?'legacy-native-journal-unavailable':held.reason};
    try{observeChangeSet(db,held.changeSetId);}catch{return {...held,reasonCode:'native-journal-observation-unavailable'};}
    if(typeof handoffAuthority?.authorizeHandoffArtifact!=='function'||typeof handoffAuthority?.resolveHandoffArtifact!=='function')return {...held,reasonCode:'handoff-unavailable'};
    const handoffValid=()=>handoffs.readTerminalIntegrity(attemptId).status==='verified';
    if(!handoffValid())return {...held,reasonCode:'handoff-integrity-unavailable'};
    try{const result=await reconcileHeldRecovery(db,held.caseId,externalEffectObservers,Date.now(),authority,handoffValid,externalEffectVerifier);if(result.state==='held')return {...held,reasonCode:'external-effect-authority-unavailable'};return readHeldRecovery(db,attemptId)??{state:'unavailable'};}catch{return held;}
  }
  function parent(runId) {
    id(runId); if (!db.open || db.inTransaction) fail();
    const row = db.prepare('SELECT r.id,r.task_id,r.envelope_hash,e.worktree_realpath,e.egress_json FROM run r JOIN task t ON t.id=r.task_id JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE r.id=?').get(runId);
    if (!row || !same(row.worktree_realpath, workspace)) fail();
    return row;
  }
  function resolve(input) {
    const p = parent(input.runId); id(input.attemptId);
    if (typeof input.identityRef !== 'string' || !/^cue-native-identity:[a-f0-9]{64}$/.test(input.identityRef)) fail();
    const identity = store.read(input.identityRef);
    if (!identity || db.prepare('SELECT COUNT(*) n FROM native_execution_identity WHERE run_id=?').get(identity.runId).n !== 1) fail();
    const a = db.prepare('SELECT * FROM orchestration_attempt WHERE attempt_id=? AND run_id=?').get(input.attemptId, input.runId);
    const s = db.prepare('SELECT * FROM orchestration_stage_envelope WHERE attempt_id=? AND workflow_run_id=?').get(input.attemptId, input.runId);
    const planRow = db.prepare('SELECT * FROM orchestration_plan WHERE run_id=?').get(input.runId);
    if (!identity || !a || !s || !planRow || !same(a.worktree_realpath, workspace) || a.task_id !== s.plan_task_id || s.stage_run_id !== input.attemptId
      || identity.runId !== s.stage_run_id || identity.session.task_id !== s.stage_task_id || identity.candidateId !== a.candidate_id
      || s.stage_task_id !== 'stage-task-' + hash(input.attemptId) || s.parent_envelope_hash !== p.envelope_hash || planRow.envelope_hash !== p.envelope_hash
      || s.plan_digest !== planRow.digest) fail();
    const saved = json(planRow.payload), plan = validateTaskPlan(saved.approval, { revision: saved.revision, policyRevision: saved.approval.policyRevision, policyDigest: saved.approval.policyDigest, tasks: saved.tasks });
    const task = plan.tasks.find(t => t.id === a.task_id);
    if (plan.digest !== planRow.digest || plan.approval.policyDigest !== s.policy_digest
      || !task || !task.candidateIds.includes(a.candidate_id) || !['model-producer','verifier'].includes(task.role)
      || identity.role !== 'model' || identity.boundary.clientKind !== (task.role === 'model-producer' ? 'model' : 'json-checker')) fail();
    const pe = envelope(s.parent_json), se = envelope(s.stage_json);
    const relativeStage = win32.relative(workspace, se.worktree_realpath);
    if (win32.isAbsolute(relativeStage) || relativeStage === '..' || relativeStage.startsWith('..\\')) fail();
    const child = db.prepare('SELECT r.task_id,r.envelope_hash,e.worktree_realpath,e.egress_json FROM run r JOIN task t ON t.id=r.task_id JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE r.id=?').get(s.stage_run_id);
    if (pe.run_id !== input.runId || se.run_id !== s.stage_run_id || !same(pe.worktree_realpath, workspace) || !child || child.task_id !== s.stage_task_id
      || hash(s.parent_json) !== s.parent_envelope_hash || hash(s.stage_json) !== s.stage_envelope_hash || child.envelope_hash !== s.stage_envelope_hash
      || child.worktree_realpath !== se.worktree_realpath || identity.session.cwd !== se.worktree_realpath
      || child.egress_json !== JSON.stringify(se.egress) || p.egress_json !== JSON.stringify(pe.egress)
      || s.request_json !== JSON.stringify({ workflowRunId: input.runId, taskId: a.task_id, attemptId: input.attemptId, parent: pe, stage: se })) fail();
    const claim = json(a.claim_payload);
    if (claim.runId !== input.runId || claim.taskId !== a.task_id || claim.attemptId !== input.attemptId || claim.candidateId !== a.candidate_id) fail();
    return { identity, snapshot: JSON.stringify({ p, a, s, planRow, child, identity }) };
  }
  return Object.freeze({
    listRecoveryRuns(input) {
      record(input, []); current();
      // Bound the host-side workspace scan as well as the public list. A scan
      // cutoff is explicit: an empty result then does not establish absence.
      const candidates = db.prepare(`SELECT CASE WHEN length(r.id)<=128 THEN r.id ELSE NULL END id,
        CASE WHEN length(t.state)<=32 THEN t.state ELSE NULL END state,
        CASE WHEN length(e.worktree_realpath)<=2048 THEN e.worktree_realpath ELSE NULL END worktree_realpath FROM run r
        JOIN orchestration_plan p ON p.run_id=r.id JOIN envelope e ON e.envelope_hash=r.envelope_hash
        LEFT JOIN task t ON t.id=r.task_id
        WHERE NOT EXISTS(SELECT 1 FROM orchestration_stage_envelope s WHERE s.stage_run_id=r.id)
        ORDER BY r.rowid DESC LIMIT 1001`).all();
      const matched = candidates.slice(0,1000).filter(row => same(row.worktree_realpath, workspace));
      const records = matched.slice(0,50).map(row => {
        if (typeof row.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(row.id)) fail();
        const counts = db.prepare(`SELECT COUNT(*) recordedAttemptCount,
          COALESCE(SUM((SELECT COUNT(*) FROM native_execution_identity n WHERE n.run_id=a.attempt_id)),0) identityRecordCount,
          COALESCE(SUM(NOT EXISTS(SELECT 1 FROM native_execution_identity n WHERE n.run_id=a.attempt_id)),0) missingIdentityAttemptCount,
          COALESCE(SUM(NOT EXISTS(SELECT 1 FROM orchestration_stage_envelope s WHERE s.attempt_id=a.attempt_id AND s.workflow_run_id=a.run_id AND s.stage_run_id=a.attempt_id AND s.plan_task_id=a.task_id)),0) missingStageLinkCount
          FROM orchestration_attempt a WHERE a.run_id=?`).get(row.id);
        if (Object.values(counts).some(n => !Number.isSafeInteger(n) || n < 0)) fail();
        return { runId: row.id, state: ['awaiting_approval','running','completed','failed','blocked','cancelled'].includes(row.state) ? row.state : 'unknown', ...counts,
          recordStatus: counts.missingStageLinkCount > 0 ? 'lineage-incomplete' : counts.identityRecordCount > 0 ? 'recorded-unverified' : 'no-recorded-identities' };
      });
      current();
      return freeze({ version: 'cue-native-recovery-runs-v1', authority: 'observation-only', records, truncated: matched.length > 50, scanTruncated: candidates.length > 1000 });
    },
    listNativeIdentities(input) {
      const { runId } = record(input, ['runId']); current(); parent(runId);
      const rows = db.prepare('SELECT n.sha256,a.attempt_id FROM native_execution_identity n JOIN orchestration_stage_envelope s ON s.stage_run_id=n.run_id JOIN orchestration_attempt a ON a.attempt_id=s.attempt_id AND a.run_id=s.workflow_run_id WHERE a.run_id=? ORDER BY a.attempt_id,n.sha256 LIMIT 65').all(runId);
      const records = rows.slice(0,64).map(row => { const identityRef = 'cue-native-identity:' + row.sha256, resolved = resolve({ runId, attemptId: row.attempt_id, identityRef });
        return { attemptId: row.attempt_id, identityRef, candidateId: resolved.identity.candidateId, subjectDigest: resolved.identity.subjectDigest }; });
      current(); return freeze({ version: 'cue-native-recovery-list-v1', authority: 'observation-only', runId, records, truncated: rows.length > 64 });
    },
    async observeNativeRecovery(input) {
      if (!input || typeof input !== 'object' || types.isProxy(input)) fail();
      const fields = record(input, Object.hasOwn(input ?? {}, 'signal') ? ['runId','attemptId','identityRef','signal'] : ['runId','attemptId','identityRef']);
      const before = resolve(fields);
      const value = await observer.observe({ identityRef: fields.identityRef, runId: before.identity.runId, candidateId: before.identity.candidateId,
        subjectDigest: before.identity.subjectDigest, ...(fields.signal === undefined ? {} : { signal: fields.signal }) });
      const journal = await journalRecovery(fields.attemptId,before.identity,value);
      if (resolve(fields).snapshot !== before.snapshot) fail();
      return freeze({ version: value.version, authority: value.authority, sourceKind: value.sourceKind, runId: fields.runId, attemptId: fields.attemptId,
        identityRef: value.identityRef, candidateId: value.candidateId, subjectDigest: value.subjectDigest, observedAt: value.observedAt,
        processes: Object.fromEntries(Object.entries(value.processes).map(([key, process]) => [key, process.state])), paths: value.paths, pathProvenance: value.pathProvenance, timing: value.timing,
        journal: { state: journal.state, ...(journal.reasonCode ? { reasonCode:journal.reasonCode } : {}), ...(journal.caseId ? { caseId: journal.caseId } : {}),
          ...(journal.state!=='unavailable'&&Number.isSafeInteger(journal.revision) ? { revision: journal.revision } : {}) } });
    },
  });
}
