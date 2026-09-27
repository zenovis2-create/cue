import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, writeSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { types } from 'node:util';
import { openLedger } from '../daemon/dist/src/ledger.js';
import { ownDaemonWorktree } from '../daemon/dist/src/daemon-ownership.js';
import { envelopeHash } from '../daemon/dist/src/envelope.js';
import { renderApproval } from '../daemon/dist/src/approval-surface.js';
import { readTaskCard } from '../daemon/dist/src/ui/model.js';
import { readOrchestrationSnapshot } from '../daemon/dist/src/ui/orchestration.js';
import { appendRunMeasuredEvidence, readRunOutcomeReport } from '../daemon/dist/src/reports/ir.js';
import { readRunMeasuredEvidenceSummary } from '../daemon/dist/src/reports/measured-evidence.js';
import { renderReportHtml } from '../daemon/dist/src/reports/html.js';
import { createReportDelivery } from '../daemon/dist/src/reports/delivery.js';
import { readSelectionPreference, saveSelectionPreference, validateSelectionMode } from '../daemon/dist/src/selection/preferences.js';
import { configureLocalJsonSettings, configureLocalGoalPlanningSettings, readLatestLocalHostSettings, LOCAL_JSON_SETTINGS_ID, LOCAL_GOAL_PLANNING_SETTINGS_ID } from '../daemon/dist/src/selection/local-host-settings.js';
import { readLocalSelectionPolicy } from '../daemon/dist/src/selection/local-policy-store.js';
import { createLayaShadowAdapter } from '../daemon/dist/src/selection/laya-shadow.js';
import { evaluateLayaShadowCohort } from '../daemon/dist/src/selection/laya-shadow-cohort.js';
import { createOrchestrationDriver } from './orchestration-driver.mjs';
import { captureGoalProposal } from './goal-proposal.mjs';
import { readAcceptedGoalPlanningOutput } from './accepted-goal-planning-output.mjs';
import { createResourceStore } from '../daemon/dist/src/resources/store.js';
import { createRetrospectiveStore } from '../daemon/dist/src/resources/retrospective.js';
import { createEvaluationEnrollmentStore } from '../daemon/dist/src/evaluation/enrollment.js';
import { createEvaluationBaselineStore } from '../daemon/dist/src/evaluation/baseline.js';
import { createManualBaselineConfirmation } from '../daemon/dist/src/evaluation/baseline-confirmation.js';
import { createEvaluationObservationStore } from '../daemon/dist/src/evaluation/observations.js';
import { createEvaluationTrialProjectionStore } from '../daemon/dist/src/evaluation/trials.js';
import { createEvaluationComparisonStore } from '../daemon/dist/src/evaluation/comparisons.js';
import { createMeasurementContractStore } from '../daemon/dist/src/evaluation/measurement-contracts.js';
import { captureLocalEvaluationContracts } from '../daemon/dist/src/evaluation/local-contracts.js';
import { createEvaluationMeasuredFactStore } from '../daemon/dist/src/evaluation/measured-facts.js';
import { createEvaluationMeasuredFactEvidenceStore } from '../daemon/dist/src/evaluation/measured-fact-evidence.js';
import { createMeasuredTrialConverter } from '../daemon/dist/src/evaluation/measured-trial.js';
import { createMeasuredComparisonStore } from '../daemon/dist/src/evaluation/measured-comparisons.js';
import { createWorkspaceSessionReader } from './workspace-sessions.mjs';
import { createKnowledgeIndex } from '../daemon/dist/src/knowledge/lexical.js';
import { launchHostCodexRun, HOST_RUNTIME_TEARDOWN_BUDGET_MS } from '../daemon/dist/src/host-codex-runtime.js';
import { createCleanCodexHome, safeCleanupCodexHome } from '../daemon/dist/src/tool-home.js';
import { RecoveryCoordinator } from '../daemon/dist/src/watcher.js';
import { runProcessSync } from '../daemon/dist/src/process-launch.js';
import { terminateVerifiedTree } from '../daemon/dist/src/process-termination.js';

const FORBIDDEN_CONFIG_KEYS = /credential|password|secret|token|api[_-]?key/i;
// Codex CLI 0.154.0 (win32-x64). Provenance chain, verified 2026-09-17:
//   npm @openai/codex@0.154.0-win32-x64
//     dist.integrity sha512-Stg2KEJPIKVqPPR1wCverGOR4ey3RR3cvakR07w7FNKQUMzmHaOZomRsP2bR1qOT/67yHsks9rB+MCMfIWXcRA==
//     dist.shasum    236f93e72691e01ee67a1879110986ab00fce04a
//   SLSA provenance v1 + npm publish v0.1 attestations carry that same tarball digest,
//     built by github.com/actions/runner/github-hosted from github.com/openai/codex
//     via .github/workflows/rust-release.yml
//   tarball member package/vendor/x86_64-pc-windows-msvc/bin/codex.exe (298,169,136 bytes)
//     hashes to the value below and is byte-identical to the installed binary
//   the binary carries a valid Authenticode signature: CN="OpenAI OpCo, LLC"
// The previous pin cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4 was
// retired because it matched no published npm artifact (see docs/INTEGRATION_PROGRESS.md).
const PINNED_CODEX_SHA256 = 'be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde';

function sha256File(path) {
  const hash = createHash('sha256');
  const fd = openSync(path, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const count = readSync(fd, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest('hex');
}

function writeNew(path, content) {
  const fd = openSync(path, 'wx', 0o600);
  try { writeSync(fd, content); } finally { closeSync(fd); }
}

function goalScope(goal) {
  return `goal:${createHash('sha256').update(goal).digest('hex').slice(0, 16)}`;
}

function redactDiagnostic(value) {
  return String(value ?? '')
    .replace(/(?:token|secret|password|api[_-]?key)[^\r\n]{0,200}/giu, '[REDACTED]')
    .slice(-2_000);
}

export function validatePersistedConfig(userDataPath, value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
    const keys = Object.keys(value).sort();
    if (keys.join(',') !== 'ledgerPath,version,worktreeRoot') throw new Error('keys');
    if (value.version !== 1 || typeof value.ledgerPath !== 'string' || typeof value.worktreeRoot !== 'string') throw new Error('types');
    if (Object.keys(value).some(key => FORBIDDEN_CONFIG_KEYS.test(key))) throw new Error('credential field');
    const ledgerPath = resolve(value.ledgerPath);
    if (ledgerPath !== resolve(userDataPath, 'cue-ledger.sqlite')) throw new Error('ledger path');
    const worktreeRoot = realpathSync.native(resolve(value.worktreeRoot));
    if (worktreeRoot !== value.worktreeRoot) throw new Error('non-canonical worktree');
    return Object.freeze({ version: 1, ledgerPath, worktreeRoot });
  } catch {
    throw new Error('invalid persisted config');
  }
}

export function initializeConfig(userDataPath, defaults = {}) {
  mkdirSync(userDataPath, { recursive: true });
  const configPath = join(userDataPath, 'cue-config.json');
  try { return validatePersistedConfig(userDataPath, JSON.parse(readFileSync(configPath, 'utf8'))); }
  catch (error) {
    if (error?.code !== 'ENOENT') {
      if (error instanceof SyntaxError) throw new Error('invalid persisted config');
      throw error;
    }
  }
  const config = Object.freeze({
    version: 1,
    ledgerPath: resolve(defaults.ledgerPath ?? join(userDataPath, 'cue-ledger.sqlite')),
    worktreeRoot: realpathSync.native(resolve(defaults.worktreeRoot ?? process.cwd())),
  });
  if (Object.keys(config).some(key => FORBIDDEN_CONFIG_KEYS.test(key))) {
    throw new Error('credential fields are forbidden');
  }
  writeNew(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

// Upper bound on how long close() waits for ordered teardown before failing. Derived from
// the teardown path's own published budget rather than restated: a real AppContainer worker
// teardown performs verified terminations whose powershell tree observation alone is allowed
// 15s, so the previous flat 15s bound could expire while teardown was still healthy and
// report a termination failure that never happened (observed as close timed out after
// 15000ms plus an EPERM on the still-held run root). The bound is still finite, so a runtime
// that genuinely never settles cannot hang quit forever, and a deadline hit is still a
// FAILED close that keeps the ledger open.
const CLOSE_BARRIER_TIMEOUT_MS = Number(process.env.CUE_CLOSE_BARRIER_TIMEOUT_MS ?? HOST_RUNTIME_TEARDOWN_BUDGET_MS);

export class AppDaemon {
  #db;
  #status = 'ready';
  #workers = new Map();
  #releaseOwnership;
  #failedStops = new Set();
  // Runtime handles whose termination was signalled but whose ordered teardown
  // (worker completion -> controller close -> credential home cleanup) is still
  // running. The handle is retained here so close() has something to await;
  // dropping it at stop() time would make close() return before cleanup ends.
  #settling = new Map();
  #closing;
  sessionEpoch = randomUUID();

  constructor(config) {
    this.#db = openLedger(config.ledgerPath);
    try { this.#releaseOwnership = ownDaemonWorktree(config.worktreeRoot, config.ledgerPath, this.#db); }
    catch (error) { this.#db.close(); throw error; }
    try { this.#db.prepare(`DELETE FROM workspace_write_lease
      WHERE NOT EXISTS (
        SELECT 1 FROM run r JOIN task t ON t.id=r.task_id
        WHERE r.id=workspace_write_lease.run_id AND r.write_in_progress=1 AND t.state='running'
      ) AND NOT EXISTS (
        SELECT 1 FROM orchestration_attempt a
        WHERE a.run_id=workspace_write_lease.run_id
          AND a.worktree_realpath=workspace_write_lease.worktree_realpath
          AND a.lease_acquired_at=workspace_write_lease.acquired_at AND a.cleanup_verified=0
      )`).run(); }
    catch (error) { this.#db.close(); this.#releaseOwnership(); throw error; }
  }
  get db() { return this.#db; }
  get status() { return this.#status; }
  own(runId, launched) { this.#workers.set(runId, launched); }
  release(runId) { if (!this.#failedStops.has(runId)) this.#workers.delete(runId); }
  writerReleaseAllowed(runId) { return !this.#failedStops.has(runId); }
  quarantine(runId, error) {
    this.#failedStops.add(runId);
    this.#status = 'blocked/crash';
    try {
      this.#db.transaction(() => {
        const now = new Date().toISOString();
        this.#db.prepare("UPDATE task SET state='blocked',blocked_reason='crash' WHERE id=(SELECT task_id FROM run WHERE id=?)").run(runId);
        this.#db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) SELECT r.task_id,r.id,'worker_stopped','crash:queued',? FROM run r JOIN task t ON t.id=r.task_id WHERE t.state='queued'")
          .run(now);
        this.#db.prepare("UPDATE task SET state='blocked',blocked_reason='crash' WHERE state='queued'").run();
        this.#db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) SELECT task_id,?,'termination_failed',?,? FROM run WHERE id=?")
          .run(runId, redactDiagnostic(error instanceof Error ? error.message : error), now, runId);
      })();
    } catch {
      // The in-memory quarantine, runtime handle, writer lease, and daemon ownership stay retained.
    }
  }

  stop(runId, reason = 'cancelled') {
    const launched = this.#workers.get(runId);
    if (!launched) return false;
    const pid = launched.session.pid;
    try {
      if (typeof launched.stop === 'function') launched.stop(reason);
      else terminateVerifiedTree(launched.child?.pid ?? pid);
    } catch (error) { this.quarantine(runId, error); return false; }
    try {
      this.#db.transaction(() => {
        this.#db.prepare('DELETE FROM workspace_write_lease WHERE run_id=?').run(runId);
        this.#db.prepare('UPDATE run SET write_in_progress=0 WHERE id=?').run(runId);
        this.#db.prepare("UPDATE task SET state='blocked',blocked_reason=? WHERE id=(SELECT task_id FROM run WHERE id=?) AND state='running'").run(reason, runId);
        this.#db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) SELECT task_id,?,'worker_stopped',?,? FROM run WHERE id=?")
          .run(runId, `${reason}:pid=${pid}`, new Date().toISOString(), runId);
      })();
    } catch (error) {
      this.quarantine(runId, error);
      return false;
    }
    this.#failedStops.delete(runId);
    this.#workers.delete(runId);
    this.#retainUntilSettled(runId, launched);
    return true;
  }

  #retainUntilSettled(runId, launched) {
    const done = launched?.done;
    if (!done || typeof done.then !== 'function') return;
    const settled = Promise.resolve(done).then(() => {}, () => {}).finally(() => {
      if (this.#settling.get(runId) === settled) this.#settling.delete(runId);
    });
    this.#settling.set(runId, settled);
  }

  get settlingRunIds() { return Object.freeze([...this.#settling.keys()]); }
  hasUnsettledRun(runId) { return this.#workers.has(runId) || this.#settling.has(runId) || this.#failedStops.has(runId); }

  async settled() {
    while (this.#settling.size) await Promise.all([...this.#settling.values()]);
  }

  crash(reason = 'crash') {
    this.#status = 'blocked/crash';
    for (const id of [...this.#workers.keys()]) this.stop(id, reason);
    if (this.#failedStops.size) return;
    try {
      this.#db.transaction(() => {
        const now = new Date().toISOString();
        this.#db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) SELECT r.task_id,r.id,'worker_stopped',?,? FROM run r JOIN task t ON t.id=r.task_id WHERE t.state='queued'")
          .run(`${reason}:queued`, now);
        this.#db.prepare("DELETE FROM workspace_write_lease WHERE run_id IN (SELECT id FROM run WHERE task_id IN (SELECT id FROM task WHERE state='running'))").run();
        this.#db.prepare("UPDATE run SET write_in_progress=0 WHERE task_id IN (SELECT id FROM task WHERE state IN ('running','queued'))").run();
        this.#db.prepare("UPDATE task SET state='blocked',blocked_reason=? WHERE state IN ('running','queued')").run(reason);
      })();
    } catch {
      this.#failedStops.add('__daemon_persistence__');
      return false;
    }
    this.#releaseOwnership?.();
    return true;
  }

  // Lifecycle barrier: signal termination for every owned runtime, then wait for
  // each ordered teardown to finish before the ledger handle is released. A
  // close() that returned early would let callers delete a home directory whose
  // SQLite handles are still open.
  close() {
    if (this.#status === 'closed') return Promise.resolve();
    if (this.#closing) return this.#closing;
    for (const id of [...this.#workers.keys()]) this.stop(id, 'app_closed');
    // Fast path is only legal when there is provably nothing left to tear down.
    // A failed stop leaves the handle owned and the ledger open, so reporting a
    // successful close there would manufacture the evidence that it worked.
    if (this.#teardownBlocked()) return this.#rejectClose();
    if (this.#settling.size === 0) { this.#finishClose(); return Promise.resolve(); }
    // The wait is bounded so a runtime that never settles cannot hang the quit
    // path forever. A deadline hit is a FAILED close, never a silent success:
    // the ledger stays open and the caller sees the unsettled run ids.
    this.#closing = this.#settledWithin(CLOSE_BARRIER_TIMEOUT_MS)
      .then(() => {
        if (this.#teardownBlocked()) throw this.#teardownError();
        this.#finishClose();
      })
      .finally(() => { this.#closing = undefined; });
    return this.#handled(this.#closing);
  }

  #settledWithin(ms) {
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(
        `close timed out after ${ms}ms: runtimes still settling (${JSON.stringify([...this.#settling.keys()])})`,
      )), ms);
      timer.unref?.();
    });
    return Promise.race([this.settled(), deadline]).finally(() => clearTimeout(timer));
  }

  #teardownBlocked() { return this.#workers.size > 0 || this.#failedStops.size > 0; }

  #teardownError() {
    const owned = [...this.#workers.keys()];
    const failed = [...this.#failedStops];
    return new Error(`close blocked: runtimes not torn down (owned=${JSON.stringify(owned)} failedStops=${JSON.stringify(failed)})`);
  }

  #rejectClose() { return this.#handled(Promise.reject(this.#teardownError())); }

  // Legacy call sites invoke close() without awaiting. Attaching a terminal
  // handler keeps a genuine rejection from becoming an unhandled rejection,
  // while the returned promise still rejects for callers that do await.
  #handled(promise) { promise.catch(() => {}); return promise; }

  #finishClose() {
    if (this.#status === 'closed' || this.#failedStops.size) return;
    this.#db.close();
    this.#releaseOwnership?.();
    this.#status = 'closed';
  }
}

export function createCueCore(config, daemon, runtime = {}) {
  const worktree = realpathSync.native(config.worktreeRoot);
  const contains = (parent, child) => { const path = relative(parent, child); return path === '' || (path.split(/[\\/]/u)[0] !== '..' && !isAbsolute(path)); };
  const appRoot = dirname(fileURLToPath(import.meta.url));
  for (const trusted of [appRoot, join(appRoot, '..', 'daemon', 'src'), join(appRoot, '..', 'daemon', 'dist')]) {
    if (!existsSync(trusted)) continue;
    const canonical = realpathSync.native(trusted);
    if (contains(worktree, canonical) || contains(canonical, worktree)) throw new Error('worktree overlaps trusted Cue runtime');
  }
  const defaultBinary = process.env.APPDATA
    ? join(process.env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe')
    : undefined;
  const defaultHome = process.env.USERPROFILE ? join(process.env.USERPROFILE, '.codex') : undefined;
  const modelAt = runtime.extraArgs?.indexOf('--model') ?? -1;
  const engine = {
    binary: runtime.binary ?? process.env.CUE_VENDOR_CODEX ?? defaultBinary,
    binarySha256: runtime.binarySha256 ?? process.env.CUE_VENDOR_CODEX_SHA256
      ?? ((runtime.binary ?? process.env.CUE_VENDOR_CODEX ?? defaultBinary) === defaultBinary ? PINNED_CODEX_SHA256 : undefined),
    sourceHome: runtime.codexHome ?? process.env.CODEX_HOME ?? defaultHome,
    homeRoot: runtime.homeRoot ?? join(dirname(config.ledgerPath), 'worker-homes'),
    model: runtime.model ?? process.env.CUE_MODEL ?? (modelAt >= 0 ? runtime.extraArgs?.[modelAt + 1] : 'gpt-5.5'),
    prompt: runtime.prompt,
    controllerArgs: runtime.controllerArgs,
    requestTimeoutMs: runtime.requestTimeoutMs,
    runTimeoutMs: runtime.runTimeoutMs,
    envelopeTtlMs: runtime.envelopeTtlMs ?? 3 * 60 * 60 * 1_000,
    launchHost: runtime.launchHost ?? launchHostCodexRun,
    cleanupHome: runtime.cleanupHome ?? safeCleanupCodexHome,
  };
  const canonicalFuturePath = value => {
    const suffix = []; let path = resolve(value);
    while (!existsSync(path)) { const parent = dirname(path); if (parent === path) throw new Error('protected path has no existing ancestor'); suffix.unshift(basename(path)); path = parent; }
    return join(realpathSync.native(path), ...suffix);
  };
  for (const protectedPath of [dirname(config.ledgerPath), engine.sourceHome, engine.homeRoot]) {
    if (!protectedPath) continue;
    const canonical = canonicalFuturePath(protectedPath);
    if (contains(worktree, canonical) || contains(canonical, worktree)) throw new Error('worktree overlaps protected state or credential home');
  }
  const ownsDaemon = !daemon;
  daemon ??= new AppDaemon(config);
  const db = daemon.db;
  const sessionEpoch = daemon.sessionEpoch ?? randomUUID();
  const claimApproval = (run, from, to) => {
    const changed = db.prepare(`UPDATE run_session_epoch SET approval_state=?
      WHERE run_id=? AND session_epoch=? AND approval_state=?
        AND EXISTS (SELECT 1 FROM run r JOIN task t ON t.id=r.task_id
          JOIN envelope e ON e.envelope_hash=r.envelope_hash
          WHERE r.id=run_session_epoch.run_id AND r.task_id=? AND r.envelope_hash=?
            AND e.worktree_realpath=? AND t.state='awaiting_approval')`)
      .run(to, run.runId, sessionEpoch, from, run.taskId, run.envelopeHash, worktree);
    if (changed.changes !== 1 || closing || daemon.status !== 'ready') throw Error('approval_session_unavailable');
  };
  const workspaceSessions=createWorkspaceSessionReader(db,worktree);
  let nativeRecovery;
  const resources = createResourceStore(db);
  const evaluationEnrollments = createEvaluationEnrollmentStore(db);
  const evaluationBaselines = createEvaluationBaselineStore(db, runtime.verifyExplicitUserBaselineAuthority);
  const evaluationObservations = createEvaluationObservationStore(db);
  const evaluationProjections = createEvaluationTrialProjectionStore(db);
  const evaluationComparisons = createEvaluationComparisonStore(db);
  const measurementContracts = runtime.measuredFactHost ? createMeasurementContractStore(db, runtime.measuredFactHost) : null;
  const evaluationMeasuredFacts = runtime.measuredFactHost ? createEvaluationMeasuredFactStore(db, runtime.measuredFactHost) : null;
  const evaluationMeasuredFactEvidence = runtime.measuredFactHost ? createEvaluationMeasuredFactEvidenceStore(db, runtime.measuredFactHost) : null;
  const measuredTrialConverter = runtime.measuredFactHost ? createMeasuredTrialConverter(db, runtime.measuredFactHost) : null;
  const evaluationRunInWorkspace = runId => db.prepare(`SELECT 1 FROM run r JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE r.id=? AND e.worktree_realpath=?`).get(runId, worktree) !== undefined;
  const measuredComparisons=createMeasuredComparisonStore(db,runtime.measuredFactHost,evaluationRunInWorkspace);
  const baselineConfirmation=createManualBaselineConfirmation(db,{now:()=>Date.now(),isCurrent:runId=>!closing&&evaluationRunInWorkspace(runId)});
  const requireEvaluationEnrollment = enrollmentId => {
    const saved = evaluationEnrollments.read(enrollmentId);
    if (!saved || !evaluationRunInWorkspace(saved.runId)) throw Error('evaluation_unavailable');
    return saved;
  };
  const requireEvaluationComparison = snapshotId => {
    const saved = evaluationComparisons.read(snapshotId);
    if (!saved || [...saved.membership.baseline,...saved.membership.candidate].some(item => !evaluationRunInWorkspace(item.runId))) throw Error('evaluation_unavailable');
    return saved;
  };
  const requireEvaluationProjection = projectionId => {
    const saved = evaluationProjections.read(projectionId);
    if (!saved || !evaluationRunInWorkspace(saved.runId)) throw Error('evaluation_unavailable');
    return saved;
  };
  const projectEvaluationMeasuredFactEvidence = input => {
    if (!evaluationMeasuredFactEvidence || !db.open) throw Error('evaluation_measured_fact_evidence_unavailable');
    if (db.inTransaction) throw Error('evaluation_measured_fact_evidence_outer_transaction');
    const value = resourceInput(input, ['factId']);
    const id = evaluationIdentifier(value.factId);
    const row = db.prepare(`SELECT 1 FROM evaluation_measured_fact f JOIN run r ON r.id=f.run_id JOIN envelope e ON e.envelope_hash=r.envelope_hash
      WHERE f.fact_id=? AND e.worktree_realpath=?`).get(id, worktree);
    if (!row) throw Error('evaluation_measured_fact_evidence_unavailable');
    return evaluationMeasuredFactEvidence.project(value);
  };
  const evaluationIdentifier = value => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value)) throw Error('resource_input');
    return value;
  };
  const evaluationProjectionIds = value => {
    if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < 1 || value.length > 4096 || Reflect.ownKeys(value).length !== value.length + 1) throw Error('resource_input');
    return Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') throw Error('resource_input');
      return descriptor.value;
    });
  };
  const retrospectives = createRetrospectiveStore(db);
  function resourceInput(value, keys) {
    if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('resource_input');
    const fields = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(fields).length !== keys.length) throw Error('resource_input');
    const copy = {};
    for (const key of keys) {
      const field = fields[key];
      if (!field?.enumerable || !Object.hasOwn(field, 'value')) throw Error('resource_input');
      copy[key] = field.value;
    }
    return copy;
  }
  function resourceMetadata(snapshot) {
    return Object.freeze({ id: snapshot.id, version: snapshot.version, manifestSha256: snapshot.manifestSha256,
      resourceCount: snapshot.resources.length, totalBytes: snapshot.resources.reduce((n, item) => n + item.byteLength, 0), authority: 'reference-only' });
  }
  function pinnedResources(runId) {
    if (typeof runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(runId)
      || !db.prepare('SELECT 1 FROM run WHERE id=?').get(runId)) throw Error('resource_unknown_run');
    const snapshots = resources.readRun(runId);
    if (!snapshots) throw Error('resource_unpinned_run');
    return snapshots;
  }
  function readResourcePin(runId) {
    const snapshots = pinnedResources(runId);
    const row = db.prepare('SELECT pin_sha256 FROM resource_run_pin WHERE run_id=?').get(runId);
    return Object.freeze({ runId, pinSha256: row.pin_sha256, packages: Object.freeze(snapshots.map(resourceMetadata)), authority: 'reference-only' });
  }
  let orchestrationHost, orchestration, planningHost, planningOrchestration, planningUnavailableReasons, generatedParent, unavailableReasons;
  let setupRestartRequired = false;
  try {
    nativeRecovery = runtime.nativeRecoveryFactory?.(Object.freeze({ db, config, worktree }));
    if (runtime.orchestration && runtime.orchestrationFactory) throw Error('ambiguous_orchestration_host');
    orchestrationHost = runtime.orchestrationFactory
      ? runtime.orchestrationFactory(Object.freeze({ db, config, worktree })) : runtime.orchestration;
    if (runtime.orchestrationFactory && !orchestrationHost) throw Error('orchestration_host_unavailable');
    if (runtime.orchestrationFactory) {
      if (typeof orchestrationHost !== 'object' || types.isProxy(orchestrationHost) || ![Object.prototype, null].includes(Object.getPrototypeOf(orchestrationHost))) throw Error('invalid_orchestration_readiness');
      const fields = Object.getOwnPropertyDescriptors(orchestrationHost);
      if (fields.available) {
        if (Reflect.ownKeys(fields).length !== 2 || !fields.available.enumerable || !Object.hasOwn(fields.available, 'value') || fields.available.value !== false
          || !fields.reasons?.enumerable || !Object.hasOwn(fields.reasons, 'value')) throw Error('invalid_orchestration_readiness');
        const reasons = fields.reasons.value;
        if (!Array.isArray(reasons) || types.isProxy(reasons) || Object.getPrototypeOf(reasons) !== Array.prototype || reasons.length < 1 || reasons.length > 32
          || Reflect.ownKeys(reasons).length !== reasons.length + 1) throw Error('invalid_orchestration_readiness');
        const copy = [];
        for (let i = 0; i < reasons.length; i++) {
          const field = Object.getOwnPropertyDescriptor(reasons, String(i));
          if (!field?.enumerable || !Object.hasOwn(field, 'value') || typeof field.value !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(field.value)) throw Error('invalid_orchestration_readiness');
          copy.push(field.value);
        }
        unavailableReasons = Object.freeze(copy);
        orchestrationHost = null;
      }
    }
    if (orchestrationHost?.parentTemplate !== undefined && orchestrationHost.parentTemplate !== 'generated-json-v1') throw Error('unsupported_parent_template');
    generatedParent = orchestrationHost?.parentTemplate === 'generated-json-v1';
    orchestration = orchestrationHost ? createOrchestrationDriver({ db, host: orchestrationHost,
      assertRunSource(runId){assertPlanningSource(runId);} }) : null;
    if(runtime.planningOrchestrationFactory){
      const planningReady=runtime.planningOrchestrationFactory(Object.freeze({db,config,worktree}));
      if(planningReady?.available===false){planningUnavailableReasons=Object.freeze([...planningReady.reasons]);planningHost=null;}
      else {
        planningHost=planningReady?.available===true?planningReady.host:planningReady;
        if(!planningHost||planningHost.parentTemplate!=='goal-planning-v1'||typeof planningHost.capturePlanningInput!=='function'
          ||!Array.isArray(planningHost.planningEgress)||planningHost.planningEgress.length!==1
          ||typeof planningHost.planningEgress[0]!=='string')throw Error('planning_host_invalid');
        planningOrchestration=createOrchestrationDriver({db,host:planningHost});
      }
    }
  } catch (error) {
    // No execution is owned during construction; close takes its synchronous
    // empty-worker path and releases this constructor's database/ownership.
    if (ownsDaemon) void daemon.close();
    throw error;
  }
  const prepared = new Map();
  const preparedPhases = new Map(),planningSources=new Map();
  const explorationPrepared = new Set();
  function phaseFor(runId){
    const rows=db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='run_phase'").all(runId);
    if(!rows.length)return 'execution';
    if(rows.length!==1||!['planning','execution'].includes(rows[0].content))throw Error('run_phase_unavailable');
    return rows[0].content;
  }
  function driverFor(runId,strict=true){
    const original=preparedPhases.get(runId),persisted=phaseFor(runId);
    if(strict&&original&&original!==persisted)throw Error('run_phase_mismatch');
    return (original??persisted)==='planning'?planningOrchestration:orchestration;
  }
  function assertPlanningSource(runId){
    const rows=db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='planning_source_v1'").all(runId);
    if(!rows.length){if(planningSources.has(runId))throw Error('planning_source_mismatch');return null;}
    if(rows.length!==1)throw Error('planning_source_mismatch');
    if(planningSources.get(runId)!==rows[0].content)throw Error('planning_source_mismatch');
    const saved=JSON.parse(rows[0].content),current=readAcceptedGoalPlanningOutput(db,saved.planningRunId);
    if(JSON.stringify(current.source)!==JSON.stringify(saved.source)||current.ref!==saved.proposalRef)throw Error('planning_source_mismatch');
    const proposal=db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='goal_proposal_v1'").get(runId);
    if(!proposal||`goal-proposal:${createHash('sha256').update(proposal.content).digest('hex')}`!==current.ref)throw Error('planning_source_mismatch');
    return saved;
  }
  let closing = false;
  let orchestrationClose;

  function recordArtifact(run, kind, content) {
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
      .run(run.taskId, run.runId, kind, String(content), new Date().toISOString());
  }

  function selectionPreferences() {
    const reasons = setupRestartRequired ? Object.freeze(['local-json-restart-required']) : unavailableReasons;
    return Object.freeze({ available: Boolean(orchestration) && !setupRestartRequired, ...readSelectionPreference(db), ...(reasons ? { unavailableReasons: reasons } : {}) });
  }

  function localJsonSetup() {
    const saved = readLatestLocalHostSettings(db, LOCAL_JSON_SETTINGS_ID);
    const supported = saved?.settings.version === 'cue-local-host-settings-v2';
    return Object.freeze({ templateId: 'generated-json-v1', accountingKind: 'local-invocation', revision: saved?.revision ?? null,
      configured: Boolean(supported), enabled: supported ? saved.settings.enabled : false,
      limits: supported ? saved.settings.limits : null, restartRequired: setupRestartRequired,
      available: Boolean(supported && saved.settings.enabled && generatedParent && orchestration
        && orchestrationHost?.accountingKind === 'local-invocation') && !setupRestartRequired,
      modelId: 'qwen38-27b-unc', endpoint: 'http://127.0.0.1:8085/v1', ranking: 'not-performed' });
  }

  function localPlanningSetup() {
    const saved = readLatestLocalHostSettings(db, LOCAL_GOAL_PLANNING_SETTINGS_ID);
    const supported = saved?.settings.version === 'cue-local-host-settings-v2'
      && saved.settings.templateId === 'goal-planning-v1';
    return Object.freeze({ templateId: 'goal-planning-v1', settingsId: LOCAL_GOAL_PLANNING_SETTINGS_ID,
      accountingKind: 'local-invocation', revision: saved?.revision ?? null,
      configured: Boolean(supported), enabled: supported ? saved.settings.enabled : false,
      limits: supported ? saved.settings.limits : null, restartRequired: setupRestartRequired,
      available: Boolean(supported && saved.settings.enabled && planningAvailability().available) && !setupRestartRequired,
      modelId: 'qwen38-27b-unc', endpoint: 'http://127.0.0.1:8085/v1', ranking: 'not-performed' });
  }

  function configureLocalPlanning(input) {
    const value = resourceInput(input, ['expectedRevision', 'enabled', 'limits']);
    configureLocalGoalPlanningSettings(db, { ...value, createdAt: new Date().toISOString() });
    setupRestartRequired = true;
    return localPlanningSetup();
  }

  function candidateInventory() {
    const selection = selectionPreferences();
    const saved = readLatestLocalHostSettings(db, LOCAL_JSON_SETTINGS_ID);
    const local = saved?.settings.version === 'cue-local-host-settings-v2';
    const snapshot = orchestrationHost?.catalog.snapshot();
    const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value) && !value.includes('://') ? value : 'redacted-identity';
    const rows = snapshot?.records ?? [];
    if (!Array.isArray(rows) || rows.length > 1024) throw Error('candidate_inventory_limit');
    const records = rows.map(({ available, reasons, record }) => Object.freeze({
      canonicalId: safeId(record.canonicalId), toolId: safeId(record.toolId), kind: record.kind,
      installation: record.installation, protocol: record.protocol, observedAt: record.observedAt,
      catalogAvailable: available, reasons: Object.freeze([...reasons]),
      authentication: 'unknown', capabilityEligibility: 'unknown', executionAuthority: 'not-granted-by-inventory',
    }));
    const policies = local ? Object.entries(saved.settings.policies).map(([mode, ref]) => Object.freeze({
      mode, policyId: safeId(ref.policyId), revision: ref.revision, digest: ref.digest,
    })) : [];
    const pairs = local ? Object.values(saved.settings.policies).map(ref => {
      const stored = readLocalSelectionPolicy(db, ref.policyId, ref.revision);
      if (!stored || stored.digest !== ref.digest) throw Error('candidate_inventory_policy_reference');
      return JSON.stringify([stored.policy.producerCandidateId, stored.policy.checkerCandidateId]);
    }) : [];
    const samePair = pairs.length === 4 && pairs.every(pair => pair === pairs[0]);
    return Object.freeze({ version: 'cue-candidate-inventory-v1', readAt: new Date().toISOString(),
      available: Boolean(snapshot), unavailableReasons: Object.freeze([...(unavailableReasons ?? (!snapshot ? ['catalog-unavailable'] : []))]),
      records: Object.freeze(records), selection: Object.freeze({ ...selection }),
      configuration: Object.freeze({ settingsRevision: saved?.revision ?? null, policies: Object.freeze(policies),
        modeComparison: samePair ? 'fixed-pair-unmeasured' : 'unknown', restartRequired: setupRestartRequired }),
      authority: 'read-only-observation',
    });
  }

  function configureLocalJson(input) {
    const value = resourceInput(input, ['expectedRevision', 'enabled', 'limits']);
    configureLocalJsonSettings(db, { ...value, createdAt: new Date().toISOString() });
    // Existing prepared runs retain their approved immutable snapshots. A new
    // host is assembled only by a deliberate restart, never while it owns work.
    setupRestartRequired = true;
    return localJsonSetup();
  }

  function setSelectionPreference(input) {
    if (!orchestration || setupRestartRequired) throw Error('selection_preferences_unavailable');
    if (!input || typeof input !== 'object' || types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) throw Error('invalid_selection_preference_input');
    const fields = Object.getOwnPropertyDescriptors(input);
    if (Reflect.ownKeys(input).length !== 2 || ['mode', 'expectedRevision'].some(key => !fields[key]?.enumerable || !Object.hasOwn(fields[key], 'value'))) throw Error('invalid_selection_preference_input');
    return Object.freeze({ available: true, ...saveSelectionPreference(db, { mode: fields.mode.value, expectedRevision: fields.expectedRevision.value }) });
  }

  function prepareGoal(goal, autonomy = 3, requestedMode) {
    return prepareGoalInput(goal, autonomy, requestedMode);
  }
  function prepareGoalFromProposal(input) {
    const value=resourceInput(input,['goal','proposalRef','autonomy','selectionMode']);
    if(typeof value.goal!=='string'||!value.goal.trim()||typeof value.proposalRef!=='string'
      ||typeof runtime.resolveGoalProposal!=='function')throw Error('goal_proposal_unavailable');
    const goal=value.goal.trim();
    const captured=captureGoalProposal(goal,value.proposalRef,runtime.resolveGoalProposal(value.proposalRef));
    return prepareGoalInput(goal,value.autonomy,value.selectionMode,undefined,captured);
  }

  function planningAvailability(){return Object.freeze(!setupRestartRequired&&planningOrchestration&&orchestration&&orchestrationHost?.supportsGoalProposals===true
    ?{available:true,reasons:Object.freeze([])}:{available:false,reasons:planningUnavailableReasons??Object.freeze(['planning-host-unavailable'])});}

  function preparePlanningGoal(input){
    const value=resourceInput(input,['goal','autonomy','selectionMode']);
    if(!planningAvailability().available||typeof value.goal!=='string'||!value.goal.trim())throw Error('planning_host_unavailable');
    validateSelectionMode(value.selectionMode);
    if(![1,2,3].includes(value.autonomy))throw Error('invalid autonomy');
    const goal=value.goal.trim(),inputText=planningHost.capturePlanningInput(Object.freeze({goal,selectionMode:value.selectionMode}));
    if(typeof inputText!=='string'||Buffer.byteLength(inputText,'utf8')>1_048_576||Buffer.from(inputText,'utf8').toString('utf8')!==inputText)throw Error('planning_input_invalid');
    const contract=JSON.parse(inputText);
    if(contract?.version!=='cue-planning-input-v1'||contract.goalSha256!==createHash('sha256').update(goal).digest('hex')
      ||contract.executionPolicy?.mode!==value.selectionMode||JSON.stringify(contract)!==inputText)throw Error('planning_input_invalid');
    return prepareGoalInput(goal,value.autonomy,value.selectionMode,Object.freeze({id:'goal-planning-v1',inputText}),undefined,'planning');
  }

  function prepareGoalFromPlanningRun(input){
    const value=resourceInput(input,['planningRunId','autonomy','selectionMode']);
    if(!planningAvailability().available)throw Error('planning_host_unavailable');
    validateSelectionMode(value.selectionMode);
    if(![1,2,3].includes(value.autonomy))throw Error('invalid autonomy');
    const accepted=readAcceptedGoalPlanningOutput(db,value.planningRunId);
    if(accepted.mode!==value.selectionMode)throw Error('planning_policy_mode_mismatch');
    const captured=captureGoalProposal(accepted.goal,accepted.ref,accepted.body);
    return prepareGoalInput(accepted.goal,value.autonomy,value.selectionMode,undefined,captured,'execution',accepted.source);
  }

  function prepareJsonTemplate(input) {
    const value = resourceInput(input, ['templateId', 'inputText', 'autonomy', 'selectionMode']);
    if (value.templateId !== 'generated-json-v1' || typeof value.inputText !== 'string'
      || Buffer.byteLength(value.inputText, 'utf8') > 1_048_576
      || Buffer.from(value.inputText, 'utf8').toString('utf8') !== value.inputText) throw Error('json_template_input');
    JSON.parse(value.inputText);
    if (!generatedParent) throw Error('json_template_unavailable');
    validateSelectionMode(value.selectionMode);
    if (![1, 2, 3].includes(value.autonomy)) throw Error('invalid autonomy');
    const template = Object.freeze({ id: 'generated-json-v1', inputText: value.inputText });
    return prepareGoalInput('Format the supplied JSON with two-space indentation and preserve its values exactly.', value.autonomy, value.selectionMode, template);
  }

  function prepareGoalInput(goal, autonomy, requestedMode, template, goalProposal, phase='execution',planningSource) {
    if (setupRestartRequired) throw Error('local_json_restart_required');
    if (unavailableReasons) throw Error('도구의 실행 준비가 완료되지 않았습니다. 설정과 자격 검증을 확인하세요.');
    if (phase!=='planning'&&orchestrationHost?.requiresExplicitTemplate === true && !template) throw Error('json_template_required');
    if (requestedMode !== undefined) {
      validateSelectionMode(requestedMode);
      if (!(phase==='planning'?planningOrchestration:orchestration)) throw Error('selection_preferences_unavailable');
    }
    const preparedGoal = db.transaction(() => {
      const selectionMode = (phase==='planning'?planningOrchestration:orchestration) ? requestedMode ?? readSelectionPreference(db).mode : undefined;
      return prepareGoalRecord(goal, autonomy, selectionMode, template, goalProposal, phase, planningSource);
    })();
    prepared.set(preparedGoal.run.runId, preparedGoal.run);
    preparedPhases.set(preparedGoal.run.runId,preparedGoal.result.phase);
    if(planningSource){const row=db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='planning_source_v1'").get(preparedGoal.run.runId);planningSources.set(preparedGoal.run.runId,row.content);}
    if (preparedGoal.explorationConfigured) explorationPrepared.add(preparedGoal.run.runId);
    return preparedGoal.result;
  }

  function prepareGoalRecord(goal, autonomy, selectionMode, template, goalProposal, phase, planningSource) {
    goal = String(goal).trim();
    if (!goal) throw new Error('goal required');
    if (![1, 2, 3].includes(autonomy)) throw new Error('invalid autonomy');
    const taskId = randomUUID();
    const runId = randomUUID();
    const scope = goalScope(goal);
    const planning=phase==='planning',driver=planning?planningOrchestration:orchestration;
    const envelope = {
      run_id: runId,
      worktree_realpath: config.worktreeRoot,
      egress: Object.freeze(planning?[...planningHost.planningEgress]:generatedParent ? ['http://127.0.0.1:8085/v1'] : []),
      expires_at: new Date(Date.now() + engine.envelopeTtlMs).toISOString(),
      autonomy_level: 'bounded',
      allowed_actions: Object.freeze(planning?[]:generatedParent ? ['command', scope] : ['command', 'file_change', scope]),
    };
    const hash = envelopeHash(envelope);
    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare('INSERT INTO task VALUES(?,?,?,?)').run(taskId, 'awaiting_approval', null, now);
      db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(hash, envelope.worktree_realpath, JSON.stringify(envelope.egress), now);
      db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run(runId, taskId, hash, 0, now);
      db.prepare('INSERT INTO run_session_epoch(run_id,session_epoch,approval_state) VALUES(?,?,?)').run(runId,sessionEpoch,'prepared');
      db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId, runId, 'goal', goal, now);
      db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId, runId, 'goal_scope', scope, now);
      db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId, runId, 'run_phase', phase, now);
      if(planning)db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId,runId,'planning_input_v1',template.inputText,now);
    })();
    resources.pinRun(runId);
    const copy = Object.freeze({
      what: goal,
      extent: planning?'승인된 목표의 계획 제안 생성과 독립 구조 검증':generatedParent ? '승인된 JSON 입력을 로컬 모델로 변환하고 고정 검사기로 검증' : `승인된 worktree ${config.worktreeRoot} 안의 파일 변경과 명령 실행`,
      excluded: planning||generatedParent ? '파일 변경, 명시 주소 외 네트워크, 승인 봉투 확대' : '네트워크, worktree 밖 파일, 승인 봉투 확대',
      envelopeSummary: planning?`파일 변경 없음 · 승인된 계획 모델 종단점 · ${scope}`:generatedParent ? `파일 변경 없음 · 로컬 모델 http://127.0.0.1:8085/v1 · ${scope}` : `worktree 내부 명령·파일 변경 · 네트워크 없음 · ${scope}`,
    });
    const run = Object.freeze({
      taskId,
      runId,
      envelopeHash: hash,
      autonomy,
      envelope: Object.freeze(envelope),
      copy,
      goal,
      scope,
      ...(selectionMode === undefined ? {} : { selectionMode }),
      ...(template ? { template } : {}),
    });
    if(goalProposal&&!driver)throw Error('goal_proposal_orchestration_unavailable');
    const selection = driver?.prepare(run,goalProposal) ?? null;
    if (template?.id==='generated-json-v1'||template?.id==='goal-planning-v1') {
      const targets = selection?.generatedOutputs;
      const inputSha256 = createHash('sha256').update(template.inputText, 'utf8').digest('hex');
      if (!Array.isArray(targets) || targets.length !== 1 || targets[0].targetId !== (planning?'goal-proposal':'formatted-json')
        || targets[0].inputSha256 !== inputSha256 || targets[0].inputByteLength !== Buffer.byteLength(template.inputText, 'utf8')) throw Error('json_template_capture_mismatch');
    }
    if(planningSource){const content=JSON.stringify({planningRunId:planningSource.planningRunId,proposalRef:goalProposal.ref,source:planningSource});db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId,runId,'planning_source_v1',content,now);}
    const explorationCopy = selection?.exploration
      ? ` · 유료 탐색 후보 ${selection.exploration.candidateId} · 대상 작업 ${selection.exploration.taskIds.length}개 · 탐색 상한 ${selection.exploration.limitUnits} ${selection.exploration.currency}/${selection.exploration.unit} (전체 예산 상한에 포함)`
      : '';
    const approvalCopy = selection ? Object.freeze({ ...copy,
      extent: `${copy.extent} · ${selection.mode} · 정책 ${selection.policyRevision} · ${selection.accountingKind === 'local-invocation'
        ? `실행 지시 상한 ${selection.limitInvocations}회 · 제한 시간 ${selection.timeoutMs}ms · 고정 조합 · 금전 비용 미측정`
        : `예산 상한 ${selection.limitUnits} ${selection.currency}/${selection.unit}`} · ${selection.stageCount}단계 · 계획 ${selection.planDigest}${selection.initialDefault
          ? ` · 통계가 없을 때 기본 후보 ${selection.initialDefault.candidateId} · 보수적 상한 ${selection.initialDefault.conservativeMaxCost} ${selection.initialDefault.currency}, ${selection.initialDefault.conservativeMaxTimeMs}ms`
          : ''}${explorationCopy}${selection.goalProposal?` · 제안 ${selection.goalProposal.ref} · 작업 지시 ${selection.goalProposal.instructions.length}개 · 인수 기준 ${selection.requirements.length}개`:''}${planningSource?` · 승인된 계획 실행 ${planningSource.planningRunId}`:''}`,
      excluded: `${copy.excluded} · 독립 인수 증거 없는 전체 완료`,
    }) : copy;
    return Object.freeze({ run, explorationConfigured: selection?.exploration !== undefined, result: Object.freeze({
      taskId,
      runId,
      phase,
      ...(planningSource?{sourcePlanningRunId:planningSource.planningRunId}:{}),
      autonomy,
      threeLines: renderApproval({ ...approvalCopy, autonomy }).split('\n'),
      orchestration: selection,
      ...(pinnedResources(runId).length ? { resourcePin: readResourcePin(runId) } : {}),
      ...(selectionMode === undefined ? {} : { selectionMode }),
      envelope: Object.freeze({ ...envelope }),
    }) });
  }

  function approve(runId, options) {
    const run = prepared.get(runId);
    if (!run) throw new Error('unknown run');
    const owner=driverFor(runId);
    let allowExploration = false;
    if (options !== undefined) {
      if (!options || typeof options !== 'object' || types.isProxy(options) || Object.getPrototypeOf(options) !== Object.prototype) throw Error('invalid approval options');
      const fields = Object.getOwnPropertyDescriptors(options);
      if (Reflect.ownKeys(fields).length !== 1 || !fields.allowExploration?.enumerable || !Object.hasOwn(fields.allowExploration, 'value') || fields.allowExploration.value !== true) throw Error('invalid approval options');
      allowExploration = true;
    }
    const explorationConfigured = explorationPrepared.has(runId);
    if (explorationConfigured !== allowExploration) throw Error(explorationConfigured ? 'exploration consent required' : 'exploration unavailable');
    const now = new Date().toISOString();
    db.transaction(() => {
      claimApproval(run, 'prepared', 'approved');
      owner?.assertGoalProposal(runId);
      assertPlanningSource(runId);
      if (allowExploration) owner.approveExploration(runId);
      db.prepare('INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(runId, run.envelopeHash, 'desktop', `goal:${run.taskId}`, `approval:${runId}`, 0, 'accept', now);
      db.prepare('INSERT INTO run_autonomy(run_id,level,retry_cap,recorded_at) VALUES(?,?,?,?)')
        .run(runId, run.autonomy, 3, now);
    })();
    return Object.freeze({ approved: true, runId });
  }

  function validateEngine() {
    if (!engine.binary || !engine.sourceHome) throw new Error('owned Codex launch configuration required');
    if (!existsSync(engine.binary)) throw new Error('vendor Codex binary not found');
    if (!existsSync(join(engine.sourceHome, 'auth.json'))) throw new Error('Codex authentication is not configured');
    if (!engine.binarySha256) {
      if (process.env.NODE_ENV === 'test') return false;
      throw new Error('vendor Codex SHA-256 pin required');
    }
    if (!/^[0-9a-f]{64}$/iu.test(engine.binarySha256) || sha256File(engine.binary) !== engine.binarySha256.toLowerCase()) {
      throw new Error('vendor Codex integrity check failed');
    }
    return true;
  }

  async function runWithRecovery(run) {
    const contract = {
      goal: run.goal,
      constraints: ['approved envelope only', 'no worker network', 'worktree only'],
      done_when: ['agent turn completed', 'at least one isolated tool call succeeded'],
      deliverable: 'goal-defined workspace result',
    };
    const recovery = new RecoveryCoordinator(db, run.runId, 3, contract, run.autonomy);
    let attempt = 0;

    while (daemon.status === 'ready') {
      const task = db.prepare('SELECT state FROM task WHERE id=?').get(run.taskId);
      if (task?.state !== 'running') return;
      if (Date.parse(run.envelope.expires_at) <= Date.now()) {
        commitTerminal(run, () => {
          recordArtifact(run, 'worker_failure', 'approved envelope expired during execution');
          db.prepare("UPDATE task SET state='blocked',blocked_reason='approval_expired' WHERE id=? AND state='running'").run(run.taskId);
        });
        return;
      }
      attempt += 1;
      let result;
      let launched;
      let cleanHome;
      try {
        cleanHome = createCleanCodexHome(engine.homeRoot, join(engine.sourceHome, 'auth.json'));
        launched = engine.launchHost(
          db,
          { cwd: config.worktreeRoot, task_id: run.taskId, run_id: run.runId },
          run.envelope,
          {
            binary: engine.binary,
            codexHome: cleanHome,
            goal: engine.prompt?.(run) ?? run.goal,
            model: engine.model,
            controllerArgs: engine.controllerArgs,
            requestTimeoutMs: engine.requestTimeoutMs,
            runTimeoutMs: engine.runTimeoutMs,
          },
        );
        daemon.own(run.runId, launched);
        result = await launched.done;
        if (result.failureKind === 'termination') { daemon.quarantine(run.runId, result.error || 'tree termination could not be verified'); return; }
      } catch (error) {
        if (error?.code === 'CUE_TERMINATION_UNVERIFIED') { daemon.quarantine(run.runId, error); return; }
        if (!daemon.writerReleaseAllowed(run.runId)) return;
        let diagnostic = error instanceof Error ? error.message : String(error);
        let failureKind = 'crash';
        if (cleanHome) {
          try { engine.cleanupHome(cleanHome); }
          catch (cleanupError) {
            diagnostic = `credential cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`;
            failureKind = 'cleanup';
          }
        }
        result = {
          status: 'failed',
          successfulToolCalls: 0,
          controllerPid: 0,
          workerPids: [],
          controllerStderr: '',
          error: redactDiagnostic(diagnostic),
          failureKind,
        };
      }

      if (!daemon.writerReleaseAllowed(run.runId)) return;
      if (result.failureKind === 'cleanup') {
        const diagnostic = redactDiagnostic(result.error || 'credential cleanup failed');
        commitTerminal(run, () => {
          recordArtifact(run, 'credential_cleanup_failed', diagnostic);
          db.prepare("UPDATE task SET state='blocked',blocked_reason='credential_cleanup' WHERE id=?").run(run.taskId);
        });
        return;
      }

      if (daemon.status !== 'ready') return;
      const current = db.prepare('SELECT state FROM task WHERE id=?').get(run.taskId);
      if (current?.state !== 'running') {
        commitTerminal(run, () => {});
        return;
      }

      const violations = Number(db.prepare("SELECT count(*) AS n FROM artifact WHERE run_id=? AND kind='enforcement_violation'").get(run.runId)?.n ?? 0);
      if (result.failureKind === 'enforcement' || violations > 0) {
        const diagnostic = redactDiagnostic(result.error || result.controllerStderr || 'approved envelope enforcement violation');
        commitTerminal(run, () => {
          recordArtifact(run, 'worker_failure', `attempt=${attempt}; kind=enforcement; violations=${violations}; output=${diagnostic}`);
          db.prepare("UPDATE task SET state='blocked',blocked_reason='enforcement_violation' WHERE id=? AND state='running'").run(run.taskId);
        });
        return;
      }

      if (result.failureKind === 'crash') {
        const diagnostic = redactDiagnostic(result.error || result.controllerStderr || 'controller crashed');
        commitTerminal(run, () => {
          recordArtifact(run, 'worker_failure', `attempt=${attempt}; kind=crash; output=${diagnostic}`);
          db.prepare("UPDATE task SET state='blocked',blocked_reason='crash' WHERE id=?").run(run.taskId);
        });
        return;
      }

      const executionPassed = result.status === 'completed' && result.successfulToolCalls > 0 && violations === 0;
      if (executionPassed && result.goalVerification?.passed !== true) {
        const at = new Date().toISOString();
        const evidence = JSON.stringify(result.goalVerification ?? { passed: false, reason: 'verification_missing', changedPaths: [] });
        commitTerminal(run, () => {
          db.prepare("UPDATE task SET state='blocked',blocked_reason='verification_failed' WHERE id=?").run(run.taskId);
          db.prepare('INSERT INTO verification(run_id,check_name,verdict,evidence,created_at) VALUES(?,?,?,?,?)')
            .run(run.runId, 'goal_relevant_verification', 'FAIL', evidence, at);
          recordArtifact(run, 'goal_verification_failed', evidence);
        });
        return;
      }
      const verified = executionPassed && result.goalVerification?.passed === true;
      if (verified) {
        const at = new Date().toISOString();
        commitTerminal(run, () => {
          db.prepare("UPDATE task SET state='completed',blocked_reason=NULL WHERE id=?").run(run.taskId);
          db.prepare('INSERT INTO verification(run_id,check_name,verdict,evidence,created_at) VALUES(?,?,?,?,?)')
            .run(run.runId, 'isolated_agent_execution', 'PASS', JSON.stringify({
              controllerPid: result.controllerPid,
              workerPids: result.workerPids,
              successfulToolCalls: result.successfulToolCalls,
              threadId: result.threadId,
              turnId: result.turnId,
              boundary: 'host-model-only -> appcontainer-capability-zero',
            }), at);
          db.prepare('INSERT INTO verification(run_id,check_name,verdict,evidence,created_at) VALUES(?,?,?,?,?)')
            .run(run.runId, 'goal_relevant_verification', 'PASS', JSON.stringify(result.goalVerification), at);
          db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
            .run(run.taskId, run.runId, 'agent_result', redactDiagnostic(result.finalMessage), at);
        });
        return;
      }

      const diagnostic = redactDiagnostic(result.error || result.controllerStderr || `status=${result.status}`);
      const failureEvidence = `attempt=${attempt}; status=${result.status}; successful_tools=${result.successfulToolCalls}; output=${diagnostic}`;
      const decision = recovery.recover(
        {
          runId: run.runId,
          failure: `attempt=${attempt}; status=${result.status}; successful_tools=${result.successfulToolCalls}; violations=${violations}`,
          contract,
          actionAllowed: true,
        },
        `attempt ${attempt}: ${diagnostic || result.status}`,
      );
      if (decision.action !== 'human' && decision.action !== 'stop') {
        recordArtifact(run, 'worker_failure', failureEvidence);
        continue;
      }
      const reason = decision.action === 'human' ? 'human_required' : 'worker_failed';
      commitTerminal(run, () => {
        recordArtifact(run, 'worker_failure', failureEvidence);
        db.prepare("UPDATE task SET state='blocked',blocked_reason=? WHERE id=?").run(reason, run.taskId);
      });
      return;
    }
  }

  function releaseWriter(run) {
    if (!daemon.writerReleaseAllowed(run.runId)) return;
    db.prepare('DELETE FROM workspace_write_lease WHERE worktree_realpath=? AND run_id=?')
      .run(run.envelope.worktree_realpath, run.runId);
    db.prepare('UPDATE run SET write_in_progress=0 WHERE id=?').run(run.runId);
  }

  function commitTerminal(run, transition) {
    try {
      db.transaction(() => {
        transition();
        releaseWriter(run);
      })();
    } catch (error) {
      daemon.quarantine(run.runId, error);
      return false;
    }
    daemon.release(run.runId);
    return true;
  }

  function acquireWriter(run, acquiredAt) {
    const inserted = db.prepare('INSERT OR IGNORE INTO workspace_write_lease(worktree_realpath,run_id,acquired_at) VALUES(?,?,?)')
      .run(run.envelope.worktree_realpath, run.runId, acquiredAt);
    if (inserted.changes === 1) return true;
    return db.prepare('SELECT run_id FROM workspace_write_lease WHERE worktree_realpath=? AND run_id=?')
      .get(run.envelope.worktree_realpath, run.runId)?.run_id === run.runId;
  }

  function activateRun(run, expectedState) {
    const now = new Date().toISOString();
    let outcome = 'running';
    db.transaction(() => {
      const task = db.prepare('SELECT state FROM task WHERE id=?').get(run.taskId);
      if (task?.state !== expectedState) {
        if (expectedState === 'awaiting_approval') throw new Error('approved run already consumed');
        outcome = task?.state ?? 'missing';
        return;
      }
      if (!db.prepare("SELECT id FROM approval_event WHERE run_id=? AND envelope_hash=? AND decision='accept'").get(run.runId, run.envelopeHash)) {
        throw new Error('approval required');
      }
      const expiresAt = Date.parse(run.envelope.expires_at);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        db.prepare("UPDATE task SET state='blocked',blocked_reason='approval_expired' WHERE id=? AND state=?").run(run.taskId, expectedState);
        recordArtifact(run, 'worker_failure', 'approved envelope expired before execution');
        outcome = 'expired';
        return;
      }
      if (!acquireWriter(run, now)) {
        if (expectedState === 'awaiting_approval') {
          const queued = db.prepare("UPDATE task SET state='queued',blocked_reason=NULL WHERE id=? AND state='awaiting_approval'").run(run.taskId);
          if (queued.changes !== 1) throw new Error('approved run already consumed');
        }
        outcome = 'queued';
        return;
      }
      const transition = db.prepare('UPDATE task SET state=\'running\',blocked_reason=NULL WHERE id=? AND state=?').run(run.taskId, expectedState);
      if (transition.changes !== 1) throw new Error('approved run already consumed');
      db.prepare('UPDATE run SET write_in_progress=1 WHERE id=?').run(run.runId);
      db.prepare('INSERT INTO execution_event(run_id,thread_id,item_id,approval_id,execution_id,execution_ordinal,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(run.runId, 'desktop', `goal:${run.taskId}`, `approval:${run.runId}`, `exec:${run.runId}`, 0, now);
    })();
    return outcome;
  }

  function promoteNext() {
    if (closing || daemon.status !== 'ready') return;
    while (true) {
      const queued = db.prepare(`SELECT r.id AS run_id
        FROM run r
        JOIN task t ON t.id=r.task_id
        JOIN envelope e ON e.envelope_hash=r.envelope_hash
        WHERE t.state='queued' AND e.worktree_realpath=?
        ORDER BY t.created_at,r.started_at,r.id
        LIMIT 1`).get(config.worktreeRoot);
      if (!queued) return;
      const run = prepared.get(queued.run_id);
      if (!run) {
        db.transaction(() => {
          db.prepare("UPDATE task SET state='blocked',blocked_reason='crash' WHERE id=(SELECT task_id FROM run WHERE id=?) AND state='queued'").run(queued.run_id);
          db.prepare('UPDATE run SET write_in_progress=0 WHERE id=?').run(queued.run_id);
        })();
        continue;
      }
      const outcome = activateRun(run, 'queued');
      if (outcome === 'expired') continue;
      if (outcome === 'running') startController(run);
      return;
    }
  }

  function startController(run) {
    let integrityVerified;
    try {
      integrityVerified = validateEngine();
    } catch (error) {
      const message = redactDiagnostic(error instanceof Error ? error.message : error);
      const committed = commitTerminal(run, () => {
        recordArtifact(run, 'worker_failure', message);
        db.prepare("UPDATE task SET state='blocked',blocked_reason='launch_configuration' WHERE id=? AND state='running'").run(run.taskId);
      });
      if (committed) promoteNext();
      return;
    }
    if (integrityVerified) recordArtifact(run, 'binary_integrity', 'sha256:PASS');
    void runWithRecovery(run).catch(error => {
      if (daemon.status !== 'ready') return;
      commitTerminal(run, () => {
        recordArtifact(run, 'worker_failure', redactDiagnostic(error instanceof Error ? error.message : error));
        db.prepare("UPDATE task SET state='blocked',blocked_reason='human_required' WHERE id=? AND state='running'").run(run.taskId);
      });
    }).finally(() => {
      if (daemon.status === 'ready') promoteNext();
    });
  }

  function launch(run) {
    const outcome = activateRun(run, 'awaiting_approval');
    if (outcome === 'running') startController(run);
  }

  function execute(runId) {
    const run = prepared.get(runId);
    if (!run) throw new Error('unknown run');
    if (daemon.status !== 'ready') throw new Error('daemon blocked/crash');
    const owner=driverFor(runId);
    db.transaction(() => {
      claimApproval(run, 'approved', 'executing');
      owner?.assertGoalProposal(runId);
      assertPlanningSource(runId);
    }).immediate();
    if (owner) {
      const activation = owner.activate(run);
      if (activation.state === 'running') {
        void owner.start(run).catch(() => {
          // Driver retains ownership; never apply the legacy lease release path.
          db.prepare("UPDATE task SET state='blocked',blocked_reason='orchestration_failure' WHERE id=? AND state='running'").run(run.taskId);
        });
      }
    } else launch(run);
    return completion(run.taskId);
  }

  function stopRun(runId, reason = 'cancelled') {
    const owner=driverFor(runId,false);
    if (owner) return owner.stop(runId);
    if (daemon.stop(runId, reason)) return true;
    const run = prepared.get(runId);
    if (!run || daemon.status !== 'ready') return false;
    let stopped = false;
    try {
      db.transaction(() => {
        const transition = db.prepare("UPDATE task SET state='blocked',blocked_reason=? WHERE id=? AND state='queued'").run(reason, run.taskId);
        if (transition.changes !== 1) return;
        releaseWriter(run);
        recordArtifact(run, 'worker_stopped', `${reason}:queued`);
        stopped = true;
      })();
    } catch (error) {
      daemon.quarantine(runId, error);
      return false;
    }
    if (stopped) promoteNext();
    return stopped;
  }

  function closeCore() {
    if (orchestration||planningOrchestration) {
      if (!orchestrationClose) {
        closing = true;
        // A rejected cleanup keeps the daemon/ledger owned for reconciliation.
        orchestrationClose = Promise.allSettled([orchestration?.close(),planningOrchestration?.close()].filter(Boolean)).then(results=>{
          const rejected=results.find(result=>result.status==='rejected');
          if(rejected)throw rejected.reason;
          return daemon.close();
        });
      }
      return orchestrationClose;
    }
    if (closing) return daemon.settled();
    closing = true;
    for (const run of prepared.values()) stopRun(run.runId, 'app_closed');
    return daemon.close();
  }

  function completion(taskId) {
    return db.transaction(() => {
    const card = readTaskCard(db, taskId);
    const symbol = card.autonomyLevel === null ? null : '①②③'[card.autonomyLevel - 1];
    const isolatedToolCalls = card.runId
      ? Number(db.prepare("SELECT count(*) AS n FROM artifact WHERE run_id=? AND kind='tool_execution'").get(card.runId)?.n ?? 0)
      : 0;
    const workerPids = card.runId
      ? db.prepare("SELECT s.pid FROM session_handle s JOIN session_runtime r ON r.handle=s.handle WHERE s.run_id=? AND r.role='tool_worker' ORDER BY s.rowid").all(card.runId).map(row => row.pid)
      : [];
    const result = card.runId
      ? db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind IN ('agent_result','worker_failure','worker_stopped') ORDER BY rowid DESC LIMIT 1").get(card.runId)
      : undefined;
    const ownershipRow = card.runId ? db.prepare(`SELECT r.write_in_progress,
      (SELECT count(*) FROM orchestration_attempt a WHERE a.run_id=r.id AND a.cleanup_verified=0) unresolved
      FROM run r WHERE r.id=?`).get(card.runId) : undefined;
    const hostRetained = Boolean(card.runId && daemon.hasUnsettledRun(card.runId));
    const executionOwnership = Object.freeze({
      status: !ownershipRow ? 'unknown' : hostRetained || ownershipRow.write_in_progress !== 0 || ownershipRow.unresolved > 0 ? 'unresolved' : 'released',
      hostRetained, unresolvedAttempts: ownershipRow?.unresolved ?? null,
    });
    const phase=card.runId?(preparedPhases.get(card.runId)??phaseFor(card.runId)):null;
    let planning,sourcePlanningRunId;
    if(phase==='planning'){
      if(card.state!=='completed')planning=Object.freeze({readyForExecution:false,reason:'planning-incomplete'});
      else if(executionOwnership.status!=='released')planning=Object.freeze({readyForExecution:false,reason:'ownership-unresolved'});
      else try{const accepted=readAcceptedGoalPlanningOutput(db,card.runId);planning=Object.freeze({readyForExecution:true,proposalRef:accepted.ref});}
        catch{planning=Object.freeze({readyForExecution:false,reason:'planning-output-unavailable'});}
    }else if(phase==='execution'&&card.runId){
      const source=db.prepare("SELECT content FROM artifact WHERE run_id=? AND kind='planning_source_v1'").get(card.runId);
      if(source)try{sourcePlanningRunId=JSON.parse(source.content).planningRunId;}catch{}
    }
    return Object.freeze({
      ...card,
      ...(phase?{phase}:{}),
      ...(planning?{planning}:{}),
      ...(sourcePlanningRunId?{sourcePlanningRunId}:{}),
      executionOwnership,
      orchestration: card.runId ? readOrchestrationSnapshot(db, card.runId, driverFor(card.runId,false) ? id => driverFor(card.runId,false).readTerminalIntegrity(id) : undefined, Date.now()) : null,
      approvalSummary: `자동 승인 ${card.accepted}건 · 거부 ${card.declined}건`,
      autonomySummary: `자율성: ${symbol} · 자동 복구 ${card.recoveryAttempts}회`,
      isolatedToolCalls,
      workerPids: Object.freeze(workerPids),
      resultSummary: result?.content ?? '',
    });
    })();
  }

  function projectSwitchReadiness(targetRoot) {
    if(closing||daemon.status!=='ready'||daemon.settlingRunIds.length) return Object.freeze({ready:false,reason:'runtime-unsettled'});
    for(const root of targetRoot === undefined ? [worktree] : [worktree,targetRoot]){
      if(typeof root!=='string'||root.length>4096||!isAbsolute(root)||realpathSync.native(root)!==root)
        return Object.freeze({ready:false,reason:'project-root-unavailable'});
      const active=db.prepare(`SELECT 1 FROM run r JOIN task t ON t.id=r.task_id JOIN envelope e ON e.envelope_hash=r.envelope_hash
        WHERE e.worktree_realpath=? AND t.state IN ('awaiting_approval','queued','running') LIMIT 1`).get(root);
      if(active)return Object.freeze({ready:false,reason:'current-run-or-approval'});
      const held=db.prepare(`SELECT 1 FROM workspace_write_lease WHERE worktree_realpath=? LIMIT 1`).get(root)
        ||db.prepare(`SELECT 1 FROM run r JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE e.worktree_realpath=? AND r.write_in_progress=1 LIMIT 1`).get(root)
        ||db.prepare(`SELECT 1 FROM orchestration_attempt WHERE worktree_realpath=? AND cleanup_verified=0 LIMIT 1`).get(root);
      if(held)return Object.freeze({ready:false,reason:'ownership-unresolved'});
    }
    return Object.freeze({ready:true,reason:null});
  }
  function shadowInput(input) {
    if (!db.open || db.inTransaction) throw Error('laya_shadow_unavailable');
    const value = resourceInput(input, ['attemptId','taskSummary','options']);
    if (typeof value.attemptId !== 'string' || value.attemptId.length > 256) throw Error('laya_shadow_unavailable');
    const row = db.prepare(`SELECT 1 FROM orchestration_attempt a JOIN run r ON r.id=a.run_id
      JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE a.attempt_id=? AND e.worktree_realpath=?`).get(value.attemptId, worktree);
    if (!row) throw Error('laya_shadow_unavailable');
    return value;
  }
  return Object.freeze({
    projectSwitchReadiness,
    prepareLayaShadowSelection(input) { return createLayaShadowAdapter(db).prepare(shadowInput(input)); },
    compareLayaShadowSelection(input, response) { return createLayaShadowAdapter(db).compare(shadowInput(input), response); },
    evaluateLayaShadowCohort(input) {
      if (!db.open || db.inTransaction) throw Error('laya_shadow_unavailable');
      const adapter = createLayaShadowAdapter(db);
      return evaluateLayaShadowCohort(input, {
        prepare: value => adapter.prepare(shadowInput(value)),
        compare: (value, response) => adapter.compare(shadowInput(value), response),
      });
    },
    listWorkspaceSessions(input){return workspaceSessions.list(input);},
    readWorkspaceSession(input){return workspaceSessions.read(input);},
    prepareGoal,
    prepareGoalFromProposal,
    planningAvailability,
    preparePlanningGoal,
    prepareGoalFromPlanningRun,
    enrollEvaluation(input) {
      const value = resourceInput(input, ['enrollmentId','runId','dataset','caseId','arm','policy','metric','environment','accountLimits','enrolledAtMs']);
      if (typeof value.runId !== 'string' || !evaluationRunInWorkspace(value.runId)) throw Error('evaluation_unavailable');
      return evaluationEnrollments.enroll(value);
    },
    requestManualEvaluationBaseline(input,confirm) {
      return baselineConfirmation.request(input,confirm);
    },
    declareManualEvaluationBaseline(input) {
      const value = resourceInput(input, ['baselineId','enrollmentId','runId','dataset','caseId','policy','candidate','metric','environment','accountLimits','enrolledAtMs','authorityRef']);
      if (typeof value.runId !== 'string' || !evaluationRunInWorkspace(value.runId)) throw Error('evaluation_unavailable');
      return evaluationBaselines.declare(value);
    },
    readManualEvaluationBaseline(baselineId) {
      const saved = evaluationBaselines.read(baselineId);
      if (!saved || !evaluationRunInWorkspace(saved.runId)) throw Error('evaluation_unavailable');
      return saved;
    },
    readEvaluationEnrollment(enrollmentId) { return requireEvaluationEnrollment(enrollmentId); },
    observeEvaluation(input) {
      const value = resourceInput(input, ['enrollmentId','observationId','expectedPriorRevision']);
      requireEvaluationEnrollment(value.enrollmentId);
      return evaluationObservations.observe(value, Date.now());
    },
    evaluationCoverage(input) {
      const value = resourceInput(input, ['datasetDigest','arm','policyDigest','cutoffId']);
      const coverage = evaluationObservations.coverage(value);
      if (coverage.slots.some(slot => !evaluationRunInWorkspace(slot.runId))) throw Error('evaluation_unavailable');
      return coverage;
    },
    projectEvaluationObservation(input) {
      if (!db.open || db.inTransaction) throw Error('evaluation_unavailable');
      const value = resourceInput(input, ['enrollmentId','observationId']);
      evaluationIdentifier(value.enrollmentId); evaluationIdentifier(value.observationId);
      const enrollment = requireEvaluationEnrollment(value.enrollmentId);
      if (!db.prepare(`SELECT 1 FROM evaluation_observation o JOIN evaluation_enrollment e ON e.enrollment_id=o.enrollment_id
        WHERE o.observation_id=? AND o.enrollment_id=? AND e.run_id=?`).get(value.observationId,value.enrollmentId,enrollment.runId)) throw Error('evaluation_unavailable');
      const projectionId = `evaluation-projection:${createHash('sha256').update(JSON.stringify([value.enrollmentId,value.observationId])).digest('hex')}`;
      return evaluationProjections.project({projectionId,enrollmentId:value.enrollmentId,observationId:value.observationId});
    },
    createEvaluationComparison(input) {
      const value = resourceInput(input, ['snapshotId','baselineProjectionIds','candidateProjectionIds','constraints']);
      const projectionIds = [...evaluationProjectionIds(value.baselineProjectionIds),...evaluationProjectionIds(value.candidateProjectionIds)];
      for (const projectionId of projectionIds) {
        const projection = evaluationProjections.read(projectionId);
        if (!projection || !evaluationRunInWorkspace(projection.runId)) throw Error('evaluation_unavailable');
      }
      return evaluationComparisons.create(value, Date.now());
    },
    createEvaluationComparisonFromRecords(input) {
      if (!db.open || db.inTransaction) throw Error('evaluation_unavailable');
      const inputFields = input && typeof input === 'object' && !types.isProxy(input) && Object.getPrototypeOf(input) === Object.prototype ? Object.getOwnPropertyDescriptors(input) : {};
      const hasCriteria = Object.hasOwn(inputFields, 'criteria');
      const value = resourceInput(input, ['snapshotId','baselineProjectionIds','candidateProjectionIds','mode',...(hasCriteria?['criteria']:[])]);
      evaluationIdentifier(value.snapshotId);
      if (!['efficiency','performance','value','speed'].includes(value.mode)) throw Error('resource_input');
      const defaults={maxPriceAgeMs:86400000,minPairsPerSplit:2,qualityFloor:.5,minSuccessRate:.5,maxUnknownRate:.5,costLimitUnits:null,costBasisUnits:1,timeBasisMs:1,minImprovement:0};
      const criteria=hasCriteria?resourceInput(value.criteria,Object.keys(defaults)):defaults;
      const integer=number=>Number.isSafeInteger(number)&&number>=0;
      const fraction=number=>typeof number==='number'&&Number.isFinite(number)&&number>=0&&number<=1;
      if(!integer(criteria.maxPriceAgeMs)||!integer(criteria.minPairsPerSplit)||criteria.minPairsPerSplit<2||![criteria.qualityFloor,criteria.minSuccessRate,criteria.maxUnknownRate].every(fraction)
        ||!(criteria.costLimitUnits===null||integer(criteria.costLimitUnits))||!integer(criteria.costBasisUnits)||criteria.costBasisUnits<1||!integer(criteria.timeBasisMs)||criteria.timeBasisMs<1
        ||typeof criteria.minImprovement!=='number'||!Number.isFinite(criteria.minImprovement)||criteria.minImprovement<0||(value.mode==='performance'&&criteria.costLimitUnits===null))throw Error('resource_input');
      const baselineProjectionIds = evaluationProjectionIds(value.baselineProjectionIds);
      const candidateProjectionIds = evaluationProjectionIds(value.candidateProjectionIds);
      if (baselineProjectionIds.length > 64 || candidateProjectionIds.length > 64 || baselineProjectionIds.length + candidateProjectionIds.length > 128
        || new Set([...baselineProjectionIds,...candidateProjectionIds]).size !== baselineProjectionIds.length + candidateProjectionIds.length) throw Error('resource_input');
      const read = projectionId => {
        evaluationIdentifier(projectionId);
        return requireEvaluationProjection(projectionId);
      };
      const baseline = baselineProjectionIds.map(read), candidate = candidateProjectionIds.map(read);
      if (baseline.some(item => item.arm !== 'manual-baseline') || candidate.some(item => item.arm !== value.mode)) throw Error('evaluation_unavailable');
      const baselinePolicyDigests = new Set(baseline.map(item => item.policy.digest));
      const candidatePolicyDigests = new Set(candidate.map(item => item.policy.digest));
      if (baselinePolicyDigests.size !== 1 || candidatePolicyDigests.size !== 1) throw Error('evaluation_unavailable');
      return evaluationComparisons.create({snapshotId:value.snapshotId,baselineProjectionIds,candidateProjectionIds,constraints:{
        mode:value.mode,baselinePolicyDigest:[...baselinePolicyDigests][0],candidatePolicyDigest:[...candidatePolicyDigests][0],maxPriceAgeMs:86400000,
        ...criteria
      }}, Date.now());
    },
    listEvaluationProjections(input) {
      const value = resourceInput(input, ['limit','cursor']);
      if (!Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 20 || (value.cursor !== null && (!Number.isSafeInteger(value.cursor) || value.cursor < 1))) throw Error('resource_input');
      if (!db.open || db.inTransaction) throw Error('evaluation_unavailable');
      if (value.cursor !== null && !db.prepare('SELECT 1 FROM evaluation_trial_projection WHERE rowid=?').get(value.cursor)) throw Error('evaluation_unavailable');
      const candidates = db.prepare(`SELECT rowid,projection_id FROM evaluation_trial_projection ${value.cursor === null ? '' : 'WHERE rowid<?'} ORDER BY rowid DESC LIMIT 64`).all(...(value.cursor === null ? [] : [value.cursor]));
      const records = []; let scanned = null;
      for (const candidate of candidates) {
        if (!Number.isSafeInteger(candidate.rowid) || candidate.rowid < 1) throw Error('evaluation_unavailable');
        scanned = candidate.rowid;
        try {
          const saved = requireEvaluationProjection(candidate.projection_id);
          records.push(Object.freeze({projectionId:saved.projectionId,dataset:Object.freeze({id:saved.dataset.id,revision:saved.dataset.revision}),caseId:saved.caseId,split:saved.split,arm:saved.arm,observedAtMs:saved.observedAtMs,outcomeAvailability:saved.outcomeAvailability,outcome:saved.outcome,trialReady:false,promotionEligible:false}));
        } catch {}
        if (records.length === value.limit) break;
      }
      const complete = records.length < value.limit && candidates.length < 64;
      return Object.freeze({version:'cue-evaluation-projection-list-v1',authority:'bounded-workspace-descriptive-index',order:'sqlite-insertion-desc',records:Object.freeze(records),nextCursor:complete?null:scanned,complete});
    },
    readEvaluationComparison(snapshotId) {
      return requireEvaluationComparison(snapshotId);
    },
    listEvaluationComparisons(input) {
      const value = resourceInput(input, ['limit','cursor']);
      if (!Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 20 || (value.cursor !== null && (!Number.isSafeInteger(value.cursor) || value.cursor < 1))) throw Error('resource_input');
      if (!db.open || db.inTransaction) throw Error('evaluation_unavailable');
      if (value.cursor !== null && !db.prepare('SELECT 1 FROM evaluation_comparison_snapshot WHERE rowid=?').get(value.cursor)) throw Error('evaluation_unavailable');
      const candidates = db.prepare(`SELECT rowid,snapshot_id FROM evaluation_comparison_snapshot ${value.cursor === null ? '' : 'WHERE rowid<?'} ORDER BY rowid DESC LIMIT 64`).all(...(value.cursor === null ? [] : [value.cursor]));
      const records = [];
      let scanned = null;
      for (const candidate of candidates) {
        if (!Number.isSafeInteger(candidate.rowid) || candidate.rowid < 1) throw Error('evaluation_unavailable');
        scanned = candidate.rowid;
        try {
          const saved = requireEvaluationComparison(candidate.snapshot_id);
          records.push(Object.freeze({snapshotId:saved.snapshotId,recordedAtMs:saved.recordedAtMs,dataset:Object.freeze({id:saved.dataset.id,revision:saved.dataset.revision}),mode:saved.comparison.mode,status:saved.comparison.status,promotionEligible:false}));
        } catch {}
        if (records.length === value.limit) break;
      }
      const complete = records.length < value.limit && candidates.length < 64;
      return Object.freeze({version:'cue-evaluation-comparison-list-v1',authority:'bounded-workspace-descriptive-index',order:'sqlite-insertion-desc',records:Object.freeze(records),nextCursor:complete?null:scanned,complete});
    },
    captureLocalEvaluationContracts(...args) {
      if(args.length)throw Error('evaluation_local_contract_input');
      return captureLocalEvaluationContracts(db);
    },
    registerEvaluationMetric(input) {
      if (!measurementContracts) throw Error('evaluation_measured_fact_unavailable');
      return measurementContracts.registerMetric(input);
    },
    registerEvaluationEnvironment(input) {
      if (!measurementContracts) throw Error('evaluation_measured_fact_unavailable');
      return measurementContracts.registerEnvironment(input);
    },
    registerEvaluationAccountLimits(input) {
      if (!measurementContracts) throw Error('evaluation_measured_fact_unavailable');
      return measurementContracts.registerAccountLimits(input);
    },
    registerEvaluationPrice(input) {
      if (!measurementContracts) throw Error('evaluation_measured_fact_unavailable');
      return measurementContracts.registerPrice(input);
    },
    captureEvaluationMeasuredFact(input) {
      const value = resourceInput(input, ['factId','enrollmentId','observationId']);
      evaluationIdentifier(value.factId);evaluationIdentifier(value.enrollmentId);evaluationIdentifier(value.observationId);
      const enrollment = requireEvaluationEnrollment(value.enrollmentId);
      if (!db.prepare(`SELECT 1 FROM evaluation_observation o JOIN evaluation_enrollment e ON e.enrollment_id=o.enrollment_id
        WHERE o.observation_id=? AND o.enrollment_id=? AND e.run_id=?`).get(value.observationId,value.enrollmentId,enrollment.runId)) throw Error('evaluation_unavailable');
      const prior = db.prepare(`SELECT f.enrollment_id,f.observation_id,f.run_id,e.worktree_realpath FROM evaluation_measured_fact f
        JOIN run r ON r.id=f.run_id JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE f.fact_id=?`).get(value.factId);
      if (prior && prior.worktree_realpath !== worktree) throw Error('evaluation_measured_fact_unavailable');
      if (prior && (prior.enrollment_id !== value.enrollmentId || prior.observation_id !== value.observationId || prior.run_id !== enrollment.runId)) throw Error('evaluation_replay_conflict');
      if (!evaluationMeasuredFacts) throw Error('evaluation_measured_fact_unavailable');
      return evaluationMeasuredFacts.capture(value);
    },
    readEvaluationMeasuredFact(factId) {
      const id = evaluationIdentifier(factId);
      const row = db.prepare(`SELECT 1 FROM evaluation_measured_fact f JOIN run r ON r.id=f.run_id JOIN envelope e ON e.envelope_hash=r.envelope_hash
        WHERE f.fact_id=? AND e.worktree_realpath=?`).get(id, worktree);
      if (!row || !evaluationMeasuredFacts) throw Error('evaluation_measured_fact_unavailable');
      const saved = evaluationMeasuredFacts.read(id);
      if (!saved) throw Error('evaluation_measured_fact_unavailable');
      return saved;
    },
    projectEvaluationMeasuredFactEvidence(input) {
      return projectEvaluationMeasuredFactEvidence(input);
    },
    listEvaluationMeasuredComparisons(input) {
      return measuredComparisons.list(input);
    },
    createEvaluationMeasuredComparison(input) {
      return measuredComparisons.create(input,Date.now());
    },
    readEvaluationMeasuredComparison(snapshotId) {
      return measuredComparisons.read(snapshotId);
    },
    inspectEvaluationMeasuredComparison(snapshotId) {
      return measuredComparisons.inspect(snapshotId);
    },
    convertEvaluationMeasuredTrial(input) {
      if(!measuredTrialConverter||!db.open||db.inTransaction)throw Error('evaluation_measured_trial_unavailable');
      const value=resourceInput(input,['factId']),id=evaluationIdentifier(value.factId);
      const row=db.prepare(`SELECT 1 FROM evaluation_measured_fact f JOIN run r ON r.id=f.run_id JOIN envelope e ON e.envelope_hash=r.envelope_hash
        WHERE f.fact_id=? AND e.worktree_realpath=?`).get(id,worktree);
      if(!row)throw Error('evaluation_measured_trial_unavailable');
      return measuredTrialConverter.convert(value);
    },
    listEvaluationMeasuredFacts(input) {
      const value = resourceInput(input, ['limit','cursor']);
      if (!Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 20 || (value.cursor !== null && (!Number.isSafeInteger(value.cursor) || value.cursor < 1))) throw Error('resource_input');
      if (!evaluationMeasuredFactEvidence || !db.open) throw Error('evaluation_measured_fact_evidence_unavailable');
      if (db.inTransaction) throw Error('evaluation_measured_fact_evidence_outer_transaction');
      if (value.cursor !== null && !db.prepare('SELECT 1 FROM evaluation_measured_fact WHERE rowid=?').get(value.cursor)) throw Error('evaluation_measured_fact_evidence_unavailable');
      const candidates = db.prepare(`SELECT rowid,fact_id FROM evaluation_measured_fact ${value.cursor === null ? '' : 'WHERE rowid<?'} ORDER BY rowid DESC LIMIT 64`).all(...(value.cursor === null ? [] : [value.cursor]));
      const records=[];let scanned=null;
      for(const candidate of candidates){
        if(!Number.isSafeInteger(candidate.rowid)||candidate.rowid<1)throw Error('evaluation_measured_fact_evidence_unavailable');
        scanned=candidate.rowid;
        try{const saved=projectEvaluationMeasuredFactEvidence({factId:candidate.fact_id});records.push(Object.freeze({factId:saved.factId,producer:Object.freeze({class:saved.producer.class,revision:saved.producer.revision,recordedAtMs:saved.producer.recordedAtMs}),trialReady:false,promotionEligible:false}));}catch{}
        if(records.length===value.limit)break;
      }
      const complete=records.length<value.limit&&candidates.length<64;
      return Object.freeze({version:'cue-evaluation-measured-fact-list-v1',authority:'bounded-workspace-descriptive-index',order:'sqlite-insertion-desc',records:Object.freeze(records),nextCursor:complete?null:scanned,complete});
    },
    listRecoveryRuns(input) {
      if (!nativeRecovery) throw Error('native_recovery_host_unavailable');
      return nativeRecovery.listRecoveryRuns(input);
    },
    listNativeIdentities(input) {
      if (!nativeRecovery) throw Error('native_recovery_host_unavailable');
      return nativeRecovery.listNativeIdentities(input);
    },
    observeNativeRecovery(input) {
      if (!nativeRecovery) throw Error('native_recovery_host_unavailable');
      return nativeRecovery.observeNativeRecovery(input);
    },
    prepareJsonTemplate,
    localJsonSetup,
    localPlanningSetup,
    candidateInventory,
    configureLocalJson,
    configureLocalPlanning,
    createRetrospective(input) {
      return retrospectives.create(input);
    },
    readRetrospective(draftId) {
      return retrospectives.read(draftId);
    },
    importResourcePackage(input) {
      const value = resourceInput(input, ['root', 'manifestSha256']);
      if (typeof value.root !== 'string' || value.root.length > 4096 || !isAbsolute(value.root)
        || typeof value.manifestSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.manifestSha256)) throw Error('resource_input');
      return resourceMetadata(resources.importApproved(value));
    },
    removeResourcePackage(id) { return resources.remove(id); },
    listResourcePackages() { return Object.freeze(resources.listActive().map(resourceMetadata)); },
    readResourcePin,
    searchResources(input) {
      const value = resourceInput(input, ['runId', 'query', 'limit']);
      if (typeof value.query !== 'string' || value.query.length > 256 || !Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 10) throw Error('resource_query');
      return createKnowledgeIndex(pinnedResources(value.runId)).search(value.query, value.limit);
    },
    exportRunReport(runId) {
      if (!db.open || db.inTransaction) throw Error('outcome_report_boundary');
      if (typeof runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(runId)
        || !evaluationRunInWorkspace(runId)) throw Error('report unavailable');
      let baseReport;
      try { baseReport = readRunOutcomeReport(db, runId, driverFor(runId,false) ? id => driverFor(runId,false).readTerminalIntegrity(id) : undefined); }
      catch { throw Error('report unavailable'); }
      if (!baseReport) throw Error('report unavailable');
      const measuredEvidence = readRunMeasuredEvidenceSummary(db, runId, evaluationMeasuredFactEvidence);
      const report = appendRunMeasuredEvidence(baseReport, measuredEvidence);
      const parent = resolve(dirname(config.ledgerPath));
      // Validate every existing ancestor before creating any output directory.
      let current = parent;
      for (;;) {
        const info = lstatSync(current);
        if (!info.isDirectory() || info.isSymbolicLink()) throw Error('report root denied');
        const next = dirname(current); if (next === current) break; current = next;
      }
      if (contains(worktree, parent) || contains(parent, worktree)) throw Error('report root denied');
      const root = join(parent, 'reports');
      try { mkdirSync(root, { mode: 0o700 }); } catch (error) { if (error?.code !== 'EEXIST') throw error; }
      const reportId = `run-${createHash('sha256').update(runId).digest('hex')}`;
      const receipt = createReportDelivery(root).deliver(reportId, report, renderReportHtml(report));
      return Object.freeze({ path: join(root, `${reportId}.html`), receipt });
    },
    selectionPreferences,
    setSelectionPreference,
    approve,
    execute,
    stop: stopRun,
    completion,
    daemon,
    close: closeCore,
  });
}
