import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openLedger } from '../../dist/src/ledger.js';
import { normalizeEnvelope, envelopeHash } from '../../dist/src/envelope.js';
import { saveSelectionPolicy } from '../../dist/src/selection/policy-store.js';
import { createIntegrationCatalog } from '../../dist/src/integration-catalog.js';
import { SUBJECT_FIELDS, subjectDigest } from '../../dist/src/measurement-subject.js';
import { WRITE_PROBES, MODEL_PROBES } from '../../dist/src/capability-admission.js';
import { createOrchestrationDriver } from '../../../app/orchestration-driver.mjs';

const [mode, databasePath, worktree, markerPath] = process.argv.slice(2);
if (!['crash-window', 'reopen'].includes(mode) || !databasePath || !worktree || !markerPath) throw Error('fixture_arguments');
const db = openLedger(databasePath);
const clock = Date.parse('2026-09-14T00:00:00.000Z');
const ids = Object.freeze({ runId: 'restart-run', taskId: 'restart-make', requestId: 'restart-request', responseId: 'restart-response' });
let callbackCount = 0;

function sha(value) { return createHash('sha256').update(value).digest('hex'); }
function emit(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }

function hostFixture() {
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(key => [key, key.endsWith('Sha256') ? 'a'.repeat(64) : key]));
  const subjectHash = subjectDigest(subject);
  const evidence = new Map(); const references = {};
  for (const probe of [...WRITE_PROBES, ...MODEL_PROBES]) {
    const bytes = Buffer.from(JSON.stringify({ probe, subjectDigest: subjectHash, measuredAt: new Date(clock - 1).toISOString(), kind: 'live', status: 'pass' }));
    evidence.set(probe, bytes); references[probe] = { id: probe, sha256: sha(bytes) };
  }
  const catalog = createIntegrationCatalog({ now: () => clock, maxAgeMs: 1000, currentSubjectDigest: () => subjectHash }, [{ canonicalId: 'synthetic-agent', toolId: 'synthetic-fixture', kind: 'agent', aliases: [], installation: 'installed', protocol: 'verified', authReference: 'synthetic-test-account', authAvailable: true, sourceVersion: 'synthetic-fixture', observedAt: new Date(clock).toISOString(), subjectDigest: subjectHash, binding: null }]);
  let configuration;
  const host = {
    now: () => clock,
    catalog,
    wait: { authorizeWaitRequest: () => true, authorizeResponder: () => true, authorizeResponseContent: ref => ref === 'restart-content', resolveResponseContent: ref => ref === 'restart-content' ? Buffer.from('synthetic restart response') : null, authorizeCheckpoint: () => false, authorizeCheckpointContent: () => false, resolveCheckpointContent: () => null },
    deliverWaitResponse: async input => {
      callbackCount++;
      appendFileSync(markerPath, `${JSON.stringify({ pid: process.pid, dispatchId: input.dispatchId, attemptId: input.attemptId, identityId: input.identityId, requestId: input.requestId, responseId: input.responseId })}\n`);
      return await new Promise(() => {});
    },
    prepare: () => configuration,
    verifyFinalBilling: () => true,
    authority: { authorizePlan: () => true, authorizeClaim: () => true, authorizeStage: () => true, verifyReceipt: () => ({ outcomeVerified: false, cleanupVerified: false }), authorizeHandoffArtifact: () => false, resolveHandoffArtifact: () => null, retry: { now: () => clock, authorizeContract: () => false, classifyFailure: () => null } },
    runtime: {
      evidence: { now: () => clock, maxAgeMs: 1000, resolveEvidence: ref => evidence.get(ref.id) }, authorizeRun: () => true,
      resolveCandidate: (_id, _attempt, _role, binding) => ({ kind: 'agent', supportedRoles: ['model', 'implementation'], cancellation: 'supported', usage: 'unsupported', availability: 'ready', typedActivitySource: 'host-codex-controller-v1', durableExecutionRef: 'session-handle-v1', buildCurrentSubject: () => subject, evidenceReferences: () => references,
        launch: async context => {
          const handle = `synthetic-${context.runId}`;
          db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(handle, process.pid, new Date(clock).toISOString(), binding.owner.cwd, binding.owner.task_id, binding.owner.run_id);
          return { durableRef: `session:${handle}`, completion: new Promise(() => {}), cancel: async () => {} };
        } }),
      verifyCleanup: async context => ({ runId: context.runId, subjectDigest: context.subjectDigest, result: 'unknown', evidenceRef: 'synthetic-cleanup-unverified' })
    },
    engine: {
      observeCandidates: () => [{ id: 'synthetic-agent', checks: { eligible: true, authenticated: true, compatible: true, dataAllowed: true, resourceAvailable: true, quotaAvailable: true }, estimate: { scope: 'verified-completion-total', quality: 1, expectedCost: 1, conservativeMaxCost: 1, expectedTimeMs: 1, conservativeMaxTimeMs: 1, currency: 'TEST', source: 'synthetic-fixture', observedAtMs: clock } }],
      reservation: context => ({ runId: context.request.runId, attemptId: context.request.attemptId, requestId: context.request.requestId, currency: 'TEST', unit: 'micro', upperUnits: 10, source: 'synthetic-fixture', observedAtMs: clock, scope: 'verified-completion-attempt-total' }),
      verifyBudgetMapping: () => true, authorizeExecution: () => true, receipts: () => ({ billing: null, execution: null })
    },
    stage: () => ({ worktreeRealpath: worktree, allowedActions: [], egress: [], expiresAt: '2026-09-15T00:00:00.000Z', autonomyLevel: 'bounded' })
  };
  configuration = { policy: { policyId: 'restart-policy', revision: 1, digest: '' }, requirementIds: ['restart-requirement'], proposedPlan: { revision: 'restart-plan', policyRevision: 'restart-policy:1', policyDigest: '', tasks: [
    { id: ids.taskId, role: 'implementation', ownerId: 'synthetic-maker', requirementIds: ['restart-requirement'], dependencyIds: [], candidateIds: ['synthetic-agent'], scopeIds: ['restart-scope'] },
    { id: 'restart-check', role: 'verifier', ownerId: 'synthetic-checker', requirementIds: ['restart-requirement'], dependencyIds: [ids.taskId], candidateIds: ['synthetic-agent'], scopeIds: [] }
  ] }, scopes: [{ id: 'restart-scope', worktreeRealpath: worktree, allowedActions: ['file_change', 'read', 'list', 'search'], egress: [] }], budget: { runId: ids.runId, currency: 'TEST', unit: 'micro', limitUnits: 100, policyRevision: 'restart-policy:1', source: 'synthetic-fixture', observedAtMs: clock }, limits: { launchTimeoutMs: 1000, taskTimeoutMs: 10000, pollMs: 5 } };
  return { host, configuration };
}

async function run() {
  const { host, configuration } = hostFixture();
  if (mode === 'reopen') {
    const driver = createOrchestrationDriver({ db, host });
    const result = await driver.deliverWaitResponse({ requestId: ids.requestId, responseId: ids.responseId, claimedAtMs: clock });
    const persistedIdentity = db.prepare('SELECT attempt_id,identity_id,durable_ref FROM orchestration_attempt_identity WHERE attempt_id=? AND identity_id=?').get(result.attemptId, result.identityId);
    emit({ mode, pid: process.pid, result, persistedIdentity, callbackCount, claimCount: db.prepare('SELECT COUNT(*) n FROM orchestration_wait_dispatch_claim').get().n, observationCount: db.prepare('SELECT COUNT(*) n FROM orchestration_wait_delivery_observation').get().n });
    await driver.close(); db.close(); return;
  }
  db.prepare("INSERT INTO task VALUES('restart-root','awaiting_approval',NULL,'now')").run();
  const envelope = normalizeEnvelope({ run_id: ids.runId, worktree_realpath: worktree, allowed_actions: ['file_change', 'read', 'list', 'search'], egress: [], expires_at: '2026-09-15T00:00:00.000Z', autonomy_level: 'bounded' });
  const envelopeDigest = envelopeHash(envelope);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(envelopeDigest, worktree, '[]', 'now');
  db.prepare("INSERT INTO run VALUES(?,'restart-root',?,0,'now')").run(ids.runId, envelopeDigest);
  const saved = saveSelectionPolicy(db, { policyId: 'restart-policy', expectedRevision: null, createdAt: new Date(clock).toISOString(), sourceVersion: 'synthetic-fixture', policy: { version: 'cue-selection-v1', mode: 'efficiency', qualityMinimum: 0.5, costBasis: 1, timeBasisMs: 1, currency: 'TEST', costLimit: null, remainingTimeMs: null, maxEstimateAgeMs: 1000, allowedCandidateIds: ['synthetic-agent'], pinnedCandidateId: null } });
  configuration.policy.digest = saved.digest; configuration.proposedPlan.policyDigest = saved.digest;
  const runInput = { taskId: 'restart-root', runId: ids.runId, envelopeHash: envelopeDigest, envelope, autonomy: 3, copy: {}, goal: 'synthetic restart fixture', scope: 'code' };
  const driver = createOrchestrationDriver({ db, host });
  driver.prepare(runInput);
  db.prepare("INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES(?,?,'synthetic','goal','approval',0,'accept','now')").run(ids.runId, envelopeDigest);
  driver.activate(runInput); void driver.start(runInput);
  let row;
  for (let n = 0; n < 200; n++) { row = db.prepare("SELECT a.attempt_id,i.identity_id,i.durable_ref FROM orchestration_attempt a JOIN orchestration_attempt_identity i ON i.attempt_id=a.attempt_id WHERE a.task_id=?").get(ids.taskId); if (row) break; await new Promise(resolveDelay => setTimeout(resolveDelay, 5)); }
  if (!row) throw Error('fixture_attempt_not_started');
  driver.waitRequest({ requestId: ids.requestId, runId: ids.runId, taskId: ids.taskId, attemptId: row.attempt_id, identityId: row.identity_id, requestOrdinal: 1, streamId: 'restart-stream', reason: 'external-response', responseSchema: 'cue-wait-response-v1', createdAtMs: clock, deadlineAtMs: clock + 5000, expectedResponder: { id: 'synthetic-responder', revision: 'v1' } });
  driver.waitResponse({ eventId: 'restart-event', requestId: ids.requestId, responseId: ids.responseId, responseOrdinal: 1, responder: { id: 'synthetic-responder', revision: 'v1' }, contentRef: 'restart-content', observedAtMs: clock });
  emit({ mode, pid: process.pid, attemptId: row.attempt_id, identityId: row.identity_id, durableRef: row.durable_ref, databasePath: resolve(databasePath) });
  await driver.deliverWaitResponse({ requestId: ids.requestId, responseId: ids.responseId, claimedAtMs: clock });
}
run().catch(error => { process.stderr.write(`${error?.stack ?? error}\n`); try { db.close(); } catch {} process.exitCode = 1; });
