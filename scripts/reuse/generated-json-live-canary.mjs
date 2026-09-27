// PREPARED ONLY. Root must explicitly authorize invocation after collector review
// and a frozen measured subject. No fixture seams, retries, downloads or installs.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir, freemem, totalmem } from 'node:os';
import { basename, dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppDaemon, createCueCore } from '../../app/core.mjs';
import { createGeneratedJsonHost } from '../../app/generated-json-host.mjs';
import { createModelMeasurementSubject } from '../../daemon/dist/src/model-measurement-subject.js';
import { createModelQualification, measureModelDiagnosticBundle } from '../../daemon/dist/src/model-qualification.js';
import { measureModelControlBundle } from '../../daemon/dist/src/model-control-bundle.js';
import { createCapabilityEvidenceStore } from '../../daemon/dist/src/capability-store.js';
import { createCapabilityAdmission } from '../../daemon/dist/src/capability-admission.js';
import { createCleanupObservationStore } from '../../daemon/dist/src/cleanup-observation-store.js';
import { createGeneratedOutputStore } from '../../daemon/dist/src/verification/generated-output.js';
import { readAcceptanceHistory } from '../../daemon/dist/src/verification/acceptance.js';
import { createBudgetManager } from '../../daemon/dist/src/budget.js';
import { readLatestSelectionPolicy, saveSelectionPolicy } from '../../daemon/dist/src/selection/policy-store.js';
import { ISOLATED_LOCAL_ENDPOINT, ISOLATED_LOCAL_MODEL } from '../../daemon/dist/src/adapters/isolated-local-model.js';

const sha = value => createHash('sha256').update(value).digest('hex');
const scriptPath = fileURLToPath(import.meta.url), installRoot = realpathSync(resolve(dirname(scriptPath), '../..'));
const json = value => JSON.stringify(value, (_key, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n';
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (args.has(key)) throw Error('duplicate_canary_argument');
  if (key === '--execute-approved-canary' || key === '--validate-resume-only') args.set(key, true);
  else if (['--resume-qualification-root', '--script-sha256', '--model-subject-sha256', '--checker-subject-sha256', '--collector-review', '--collector-review-sha256'].includes(key)) args.set(key, process.argv[++i]);
  else throw Error('unknown_canary_argument');
}
if (args.get('--execute-approved-canary') !== true && !args.has('--validate-resume-only')) throw Error('canary_not_authorized_for_execution');
for (const key of ['--script-sha256', '--model-subject-sha256', '--checker-subject-sha256', '--collector-review-sha256']) {
  if (!/^[a-f0-9]{64}$/.test(args.get(key) ?? '')) throw Error('missing_frozen_canary_identity');
}
if (sha(readFileSync(scriptPath)) !== args.get('--script-sha256')) throw Error('canary_script_drift');

const resumeRoot = args.has('--resume-qualification-root') ? realpathSync(args.get('--resume-qualification-root')) : null;
if (args.has('--validate-resume-only') && !resumeRoot) throw Error('validation_requires_resume');
if (resumeRoot && (dirname(resumeRoot) !== realpathSync(tmpdir()) || !/^Cue\.GeneratedCanary\.[a-zA-Z0-9]+$/.test(basename(resumeRoot)))) throw Error('resume_root_not_owned_layout');
const previous = resumeRoot ? JSON.parse(readFileSync(join(resumeRoot, 'result.json'), 'utf8')) : null;
if (previous && (previous.version !== 'cue-generated-json-live-canary-v1' || previous.evidenceRoot !== resumeRoot || previous.passed !== false || previous.workflowApproval || previous.error !== 'Error: worktree overlaps protected state or credential home' || previous.modelQualificationRequestId !== '43a8c064-e97d-4676-9d88-3293b5db034c')) throw Error('resume_previous_result_mismatch');
const evidenceRoot = mkdtempSync(join(tmpdir(), resumeRoot ? 'Cue.GeneratedResume.' : 'Cue.GeneratedCanary.'));
const rel = relative(installRoot, evidenceRoot);
if (!rel.startsWith('..') && !isAbsolute(rel)) throw Error('canary_root_inside_project');
const worktree = mkdtempSync(join(tmpdir(), 'Cue.GeneratedWorkspace.'));
const result = {
  version: 'cue-generated-json-live-canary-v1', startedAt: new Date().toISOString(), passed: false,
  status: 'setup-unavailable', evidenceRoot, scriptSha256: args.get('--script-sha256'),
  endpoint: ISOLATED_LOCAL_ENDPOINT, model: ISOLATED_LOCAL_MODEL,
  accounting: { currency: 'LOCAL_CALL', unit: 'minor', meaning: 'NONMONETARY local executor invocation quota, not money or resource price',
    workflowInvocationLimit: 2, workflowModelRequestLimit: 1, modelQualificationRequestLimit: 1, totalQwenRequestLimit: 2,
    quality: 0, qualityFloor: 0, timingSource: 'configured upper bound, not measured performance', configuredVerifiedCompletionBoundMs: 180000 },
  limitations: ['controlled canonical JSON template only', 'one efficiency workflow, no comparative mode or cost improvement claim',
    'unknown billing reservations retained', 'provider outside client boundary', 'M qualification scope only, not implementation/P/B3'],
  qualifications: {}, snapshots: {},
  resumeRoot, worktree, previousResultSha256: resumeRoot ? sha(readFileSync(join(resumeRoot, 'result.json'))) : null,
};
const write = (name, value) => writeFileSync(join(evidenceRoot, name), json(value));
let daemon, core, workflow, db;
const controller = new AbortController();
const timeout = setTimeout(() => { controller.abort(); if (workflow && core) core.stop(workflow.runId); }, 600000);
const wait = ms => new Promise(done => setTimeout(done, ms));
function assert(condition, code) { if (!condition) throw Error(code); }
try {
  assert(process.platform === 'win32', 'canary_requires_windows');
  const reviewPath = resolve(installRoot, String(args.get('--collector-review') ?? ''));
  const reviewRelative = relative(join(installRoot, 'evidence', 'integrations', 'S1'), reviewPath);
  assert(!reviewRelative.startsWith('..') && !isAbsolute(reviewRelative) && reviewRelative.endsWith('review.md'), 'collector_review_path');
  const review = readFileSync(reviewPath);
  assert(sha(review) === args.get('--collector-review-sha256'), 'collector_review_drift');
  // The supplied reviewed hash is an explicit root decision, not a status inferred
  // from a model-generated report. A harness-only review is insufficient.
  result.collectorReview = { path: reviewPath, sha256: sha(review) };
  const require = createRequire(join(installRoot, 'daemon', 'package.json'));
  const sqlitePackageRoot = realpathSync(dirname(require.resolve('better-sqlite3/package.json')));
  const SQLite = require('better-sqlite3'); const probe = new SQLite(':memory:'); probe.close();
  const sqliteNativePaths = [...new Set(Object.keys(require.cache).filter(path => path.endsWith('.node')).map(path => realpathSync(path)).filter(path => {
    const rel = relative(sqlitePackageRoot, path); return rel && !rel.startsWith('..') && !isAbsolute(rel);
  }))];
  assert(sqliteNativePaths.length === 1, 'sqlite_native_identity_ambiguous');
  const common = { installRoot, nodeExecutable: realpathSync(process.execPath),
    powershellExecutable: join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    sqliteNativePath: sqliteNativePaths[0], dependencyRoot: dirname(sqlitePackageRoot) };
  const controlRoot = join(installRoot, 'daemon', 'dist', 'src');
  const measurement = {}, frozen = {}, controls = {}, diagnostics = {};
  for (const kind of ['json-checker', 'model']) {
    measurement[kind] = { ...common, kind };
    frozen[kind] = createModelMeasurementSubject(measurement[kind]);
    const expected = args.get(kind === 'model' ? '--model-subject-sha256' : '--checker-subject-sha256');
    assert(frozen[kind].subjectDigest === expected, 'frozen_' + kind + '_subject_drift');
    controls[kind] = measureModelControlBundle({ controlRoot, nodeExecutable: common.nodeExecutable, clientKind: kind });
    diagnostics[kind] = measureModelDiagnosticBundle(controlRoot, controls[kind]);
    write('subject-' + kind + '-before.json', frozen[kind]);
  }
  const config = { version: 1, ledgerPath: join(resumeRoot ?? evidenceRoot, 'ledger.sqlite'), worktreeRoot: worktree };
  daemon = new AppDaemon(config); db = daemon.db;
  assert(daemon.status === 'ready', 'private_daemon_unavailable');
  if (resumeRoot) assert(db.prepare('SELECT count(*) n FROM orchestration_attempt').get().n === 0, 'resume_has_existing_workflow_attempts');
  result.status = 'qualifying';
  const capability = createCapabilityEvidenceStore(db, Date.now);
  const evidencePolicy = { now: Date.now, maxAgeMs: 600000, resolveEvidence: ref => capability.resolveEvidence(ref) };
  const admit = createCapabilityAdmission(evidencePolicy);
  // Exactly one model production leg exists in the pinned collector recipe;
  // diagnostic legs use controlled native operations, never the provider.
  for (const kind of ['json-checker', 'model']) {
    controller.signal.throwIfAborted();
    const started = Date.now();
    const qualification = resumeRoot ? previous.qualifications[kind] : await createModelQualification({ db, measurement: measurement[kind], controlBundle: controls[kind], diagnosticBundle: diagnostics[kind] }).collect({ signal: controller.signal });
    result.qualifications[kind] = { ...qualification, ...(resumeRoot ? { resumeValidationMs: Date.now() - started } : { wallClockMs: Date.now() - started }) };
    write('qualification-' + kind + '.json', result.qualifications[kind]);
    for (const row of db.prepare("SELECT id,content FROM artifact WHERE task_id=? AND kind='model-qualification-raw' ORDER BY id").all(qualification.taskId)) {
      writeFileSync(join(evidenceRoot, 'qualification-raw-' + row.id + '.json'), row.content + '\n');
    }
    assert(qualification.kind === 'live' && qualification.eligible === true && qualification.allClean === true
      && qualification.failure === null && ['M1', 'M2', 'M3'].every(p => qualification.statuses[p] === 'pass'), 'qualification_' + kind + '_unavailable');
    assert(qualification.subjectDigest === frozen[kind].subjectDigest && admit(frozen[kind].subject, qualification.references).modelOnlyEligible, 'qualification_admission_mismatch');
    const after = createModelMeasurementSubject(measurement[kind]);
    assert(after.subjectDigest === frozen[kind].subjectDigest, 'qualification_source_drift');
    const legs = db.prepare("SELECT content FROM artifact WHERE task_id=? AND kind='model-qualification-raw' ORDER BY id").all(qualification.taskId)
      .map(row => JSON.parse(row.content)).filter(v => /^production-/.test(v.stage));
    assert(legs.length === (kind === 'model' ? 1 : 3), 'qualification_production_invocation_count');
    if (kind === 'model') {
      assert(legs[0].value.result.text?.trim() === 'OK', 'qualification_OK_mismatch');
      result.modelQualificationRequestId = legs[0].value.result.requestId;
    }
  }
  const observedAtMs = Date.now(), policies = {};
  const clientMemoryFloorBytes = 268435456;
  result.resources = { measuredAt: new Date().toISOString(), freeBytes: freemem(), totalBytes: totalmem(),
    configuredClientMemoryFloorBytes: clientMemoryFloorBytes, providerMemoryAccounting: 'outside-client-boundary; not priced' };
  assert(result.resources.freeBytes >= clientMemoryFloorBytes, 'configured_client_memory_floor_unavailable');
  for (const mode of ['efficiency', 'performance', 'value', 'speed']) {
    const saved = resumeRoot ? readLatestSelectionPolicy(db, 'canary-' + mode) : saveSelectionPolicy(db, { policyId: 'canary-' + mode, expectedRevision: null, createdAt: new Date(observedAtMs).toISOString(),
      sourceVersion: 'controlled-canary-nonmonetary-invocation-cap-v1', policy: { version: 'cue-selection-v1', mode, qualityMinimum: 0,
        costBasis: 1, timeBasisMs: 180000, currency: 'LOCAL_CALL', costLimit: 2, remainingTimeMs: 180000, maxEstimateAgeMs: 600000,
        allowedCandidateIds: ['canary-qwen', 'canary-native-json'], pinnedCandidateId: null } });
    assert(saved && saved.policy.mode === mode && saved.policy.currency === 'LOCAL_CALL' && saved.policy.costLimit === 2, 'resume_policy_mismatch');
    policies[mode] = { policyId: saved.policyId, revision: saved.revision, digest: saved.digest };
  }
  const candidates = Object.fromEntries([['model', 'model', 'canary-qwen'], ['checker', 'json-checker', 'canary-native-json']].map(([catalogKind, kind, canonicalId]) => [catalogKind, {
    record: { canonicalId, toolId: kind === 'model' ? 'cue-isolated-local-model' : 'cue-isolated-json-checker', kind: catalogKind, aliases: [],
      installation: 'installed', protocol: 'verified', authReference: null, authAvailable: true,
      sourceVersion: controls[kind].sha256, observedAt: new Date(observedAtMs).toISOString(), subjectDigest: frozen[kind].subjectDigest,
      binding: kind === 'model' ? { endpointId: 'fixed-localhost-8085', modelId: ISOLATED_LOCAL_MODEL } : null },
    currentSubject: () => {
      const current = createModelMeasurementSubject(measurement[kind]);
      assert(current.subjectDigest === frozen[kind].subjectDigest, 'launch_subject_drift'); return current.subject;
    },
    evidenceReferences: () => capability.referencesFor(frozen[kind].subjectDigest),
    observeCandidate: () => {
      const qualified = admit(frozen[kind].subject, capability.referencesFor(frozen[kind].subjectDigest)).modelOnlyEligible;
      const ownTask = kind === 'model' ? 'produce-json' : 'verify-json';
      const attempts = db.prepare('SELECT count(*) n FROM orchestration_attempt WHERE task_id=?').get(ownTask).n;
      return { id: canonicalId, checks: { eligible: qualified,
      authenticated: result.qualifications[kind].eligible === true, compatible: qualified,
      dataAllowed: ISOLATED_LOCAL_ENDPOINT === 'http://127.0.0.1:8085/v1', resourceAvailable: freemem() >= clientMemoryFloorBytes, quotaAvailable: attempts < 1 },
      estimate: { scope: 'verified-completion-total', quality: 0, expectedCost: 1, conservativeMaxCost: 1,
        expectedTimeMs: 180000, conservativeMaxTimeMs: 180000, currency: 'LOCAL_CALL', observedAtMs,
        source: 'configured-invocation-and-time-caps-not-money-or-performance-estimate' } };
    },
  }]));
  core = createCueCore(config, daemon, { envelopeTtlMs: 180000, orchestrationFactory({ db: actualDb }) {
    assert(actualDb === db, 'canary_ledger_not_shared');
    const assembled = createGeneratedJsonHost({ db, now: Date.now, inputForRun: run => run.goal,
      installation: { nodeExecutable: common.nodeExecutable, nodeSha256: controls.model.nodeSha256,
        modelControlBundle: controls.model, checkerControlBundle: controls['json-checker'], taskRootBase: tmpdir(), profileRootBase: join(process.env.LOCALAPPDATA, 'Packages') },
      candidates, evidence: evidencePolicy, policies, maxOutputBytes: 4096, maxOutputTokens: 256,
      accounting: { currency: 'LOCAL_CALL', unit: 'minor', limitUnits: 2, unitsPerCost: 1, source: 'nonmonetary-controlled-workflow-invocations', observedAtMs,
        upperUnitsByKind: { model: 1, checker: 1 } } });
    if (!assembled.available) result.setupUnavailableReasons = assembled.reasons;
    return assembled.available ? assembled.host : assembled;
  } });
  assert(core.selectionPreferences().available, 'assembled_host_unavailable');
  if (args.has('--validate-resume-only')) throw Error('resume_offline_setup_validated');
  result.status = 'workflow';
  workflow = core.prepareGoal('{"cue":"canary","value":1}', 3, 'efficiency');
  result.workflowApproval = workflow; core.approve(workflow.runId); core.execute(workflow.runId);
  const until = Date.now() + 180000;
  while (Date.now() < until && !controller.signal.aborted) {
    const row = db.prepare('SELECT state FROM task WHERE id=?').get(workflow.taskId);
    if (['completed', 'blocked', 'failed'].includes(row?.state)) break;
    await wait(100);
  }
  if (controller.signal.aborted || Date.now() >= until) { core.stop(workflow.runId); throw Error('workflow_timeout'); }
  const attempts = db.prepare('SELECT attempt_id,task_id,state,cleanup_verified FROM orchestration_attempt WHERE run_id=? ORDER BY rowid').all(workflow.runId);
  assert(attempts.length === 2 && attempts.filter(a => a.task_id === 'produce-json').length === 1 && attempts.filter(a => a.task_id === 'verify-json').length === 1,
    'workflow_invocation_count');
  assert(attempts.every(a => a.state === 'completed' && a.cleanup_verified === 1), 'workflow_cleanup_or_execution_unverified');
  const producer = attempts.find(a => a.task_id === 'produce-json'), checker = attempts.find(a => a.task_id === 'verify-json');
  const output = createGeneratedOutputStore(db, { now: Date.now, authorizeObservation: () => false }).read(workflow.runId, 'formatted-json', producer.attempt_id);
  assert(output && Buffer.from(output.bytes).toString() === '{\n  "cue": "canary",\n  "value": 1\n}', 'generated_bytes_mismatch');
  result.generated = { record: output.record, utf8: Buffer.from(output.bytes).toString() };
  const history = readAcceptanceHistory(db, workflow.runId); assert(history.receipt?.status === 'accepted', 'acceptance_unverified');
  result.acceptance = history;
  result.workflowAttempts = attempts;
  const receiptRows = db.prepare('SELECT r.payload FROM orchestration_receipt r JOIN orchestration_attempt a ON a.attempt_id=r.attempt_id WHERE a.run_id=?').all(workflow.runId);
  const cleanupStore = createCleanupObservationStore(db);
  result.workflowCleanup = receiptRows.map(row => {
    const receipt = JSON.parse(row.payload), bytes = cleanupStore.read(receipt.evidenceRef);
    assert(bytes, 'durable_cleanup_missing'); const observed = JSON.parse(Buffer.from(bytes).toString());
    assert(observed.runId === receipt.attemptId && observed.result === 'verified-clean', 'durable_cleanup_mismatch'); return { receipt, observed };
  });
  assert(result.workflowCleanup.length === 2, 'cleanup_receipt_count');
  const funds = createBudgetManager(db, { verifyFinalReceipt: () => false }).summary(workflow.runId);
  assert(funds.currency === 'LOCAL_CALL' && funds.committedUnits === 2n && funds.actualUnits === 0n && funds.remainingUnits === 0n, 'unknown_billing_reservation_mismatch');
  result.budget = funds;
  assert(db.prepare('SELECT count(*) n FROM integration_budget_receipt WHERE run_id=?').get(workflow.runId).n === 0, 'invented_final_billing');
  assert(db.prepare('SELECT count(*) n FROM workspace_write_lease').get().n === 0, 'unexpected_writer_authority');
  result.nativeCheckerAttemptId = checker.attempt_id;
  for (const kind of ['model', 'json-checker']) {
    const after = createModelMeasurementSubject(measurement[kind]); write('subject-' + kind + '-after.json', after);
    assert(after.subjectDigest === frozen[kind].subjectDigest, 'final_source_drift');
  }
  result.status = 'passed-controlled-canary'; result.passed = true;
} catch (error) {
  result.error = String(error); result.status = args.has('--validate-resume-only') && String(error) === 'Error: resume_offline_setup_validated' ? 'resume-offline-setup-validated' : 'unavailable-or-failed';
  if (workflow && core) { try { core.stop(workflow.runId); } catch (stopError) { result.stopError = String(stopError); } }
} finally {
  clearTimeout(timeout);
  if (db?.open) {
    const tables = ['task', 'run', 'artifact', 'capability_evidence', 'orchestration_attempt', 'orchestration_receipt', 'generated_output_target', 'generated_output_observation',
      'acceptance_evaluation', 'acceptance_final', 'integration_budget', 'integration_budget_reservation', 'integration_budget_receipt', 'cleanup_observation', 'session_handle'];
    for (const table of tables) {
      try { write('ledger-' + table + '.json', db.prepare('SELECT * FROM ' + table).all()); }
      catch (error) { result.snapshots[table] = String(error); result.passed = false; result.status = 'evidence-export-unresolved'; }
    }
    try {
      for (const row of db.prepare('SELECT sha256,bytes FROM acceptance_blob').all()) writeFileSync(join(evidenceRoot, 'acceptance-blob-' + row.sha256), row.bytes);
    } catch (error) { result.snapshots.acceptance_blob = String(error); result.passed = false; result.status = 'evidence-export-unresolved'; }
  }
  try { if (core) await core.close(); else if (daemon) await daemon.close(); }
  catch (error) { result.closeError = String(error); result.passed = false; result.status = 'cleanup-unresolved'; }
  result.finishedAt = new Date().toISOString(); write('result.json', result);
  process.stdout.write(json({ passed: result.passed, status: result.status, evidenceRoot, resultPath: join(evidenceRoot, 'result.json') }));
  process.exitCode = result.passed || result.status === 'resume-offline-setup-validated' ? 0 : 1;
}
