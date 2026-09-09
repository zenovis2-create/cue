import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, writeSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { openLedger } from '../daemon/dist/src/ledger.js';
import { ownDaemonWorktree } from '../daemon/dist/src/daemon-ownership.js';
import { envelopeHash } from '../daemon/dist/src/envelope.js';
import { renderApproval } from '../daemon/dist/src/approval-surface.js';
import { readTaskCard } from '../daemon/dist/src/ui/model.js';
import { launchHostCodexRun } from '../daemon/dist/src/host-codex-runtime.js';
import { createCleanCodexHome, safeCleanupCodexHome } from '../daemon/dist/src/tool-home.js';
import { RecoveryCoordinator } from '../daemon/dist/src/watcher.js';
import { runProcessSync } from '../daemon/dist/src/process-launch.js';
import { terminateVerifiedTree } from '../daemon/dist/src/process-termination.js';

const FORBIDDEN_CONFIG_KEYS = /credential|password|secret|token|api[_-]?key/i;
const PINNED_CODEX_SHA256 = 'cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4';

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

function validatePersistedConfig(userDataPath, value) {
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

// Upper bound on how long close() waits for ordered teardown before failing.
const CLOSE_BARRIER_TIMEOUT_MS = Number(process.env.CUE_CLOSE_BARRIER_TIMEOUT_MS ?? 15_000);

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

  constructor(config) {
    this.#db = openLedger(config.ledgerPath);
    try { this.#releaseOwnership = ownDaemonWorktree(config.worktreeRoot, config.ledgerPath, this.#db); }
    catch (error) { this.#db.close(); throw error; }
    try { this.#db.prepare(`DELETE FROM workspace_write_lease
      WHERE NOT EXISTS (
        SELECT 1 FROM run r JOIN task t ON t.id=r.task_id
        WHERE r.id=workspace_write_lease.run_id AND r.write_in_progress=1 AND t.state='running'
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
  daemon ??= new AppDaemon(config);
  const db = daemon.db;
  const prepared = new Map();
  let closing = false;

  function recordArtifact(run, kind, content) {
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)')
      .run(run.taskId, run.runId, kind, String(content), new Date().toISOString());
  }

  function prepareGoal(goal, autonomy = 3) {
    goal = String(goal).trim();
    if (!goal) throw new Error('goal required');
    if (![1, 2, 3].includes(autonomy)) throw new Error('invalid autonomy');
    const taskId = randomUUID();
    const runId = randomUUID();
    const scope = goalScope(goal);
    const envelope = {
      run_id: runId,
      worktree_realpath: config.worktreeRoot,
      egress: [],
      expires_at: new Date(Date.now() + engine.envelopeTtlMs).toISOString(),
      autonomy_level: 'bounded',
      allowed_actions: Object.freeze(['command', 'file_change', scope]),
    };
    const hash = envelopeHash(envelope);
    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare('INSERT INTO task VALUES(?,?,?,?)').run(taskId, 'awaiting_approval', null, now);
      db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(hash, envelope.worktree_realpath, '[]', now);
      db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run(runId, taskId, hash, 0, now);
      db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId, runId, 'goal', goal, now);
      db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId, runId, 'goal_scope', scope, now);
    })();
    const copy = Object.freeze({
      what: goal,
      extent: `승인된 worktree ${config.worktreeRoot} 안의 파일 변경과 명령 실행`,
      excluded: '네트워크, worktree 밖 파일, 승인 봉투 확대',
      envelopeSummary: `worktree 내부 명령·파일 변경 · 네트워크 없음 · ${scope}`,
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
    });
    prepared.set(runId, run);
    return Object.freeze({
      taskId,
      runId,
      autonomy,
      threeLines: renderApproval({ ...copy, autonomy }).split('\n'),
      envelope: Object.freeze({ ...envelope }),
    });
  }

  function approve(runId) {
    const run = prepared.get(runId);
    if (!run) throw new Error('unknown run');
    const now = new Date().toISOString();
    db.transaction(() => {
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
    launch(run);
    return completion(run.taskId);
  }

  function stopRun(runId, reason = 'cancelled') {
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
    if (closing) return daemon.settled();
    closing = true;
    for (const run of prepared.values()) stopRun(run.runId, 'app_closed');
    return daemon.close();
  }

  function completion(taskId) {
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
    return Object.freeze({
      ...card,
      approvalSummary: `자동 승인 ${card.accepted}건 · 거부 ${card.declined}건`,
      autonomySummary: `자율성: ${symbol} · 자동 복구 ${card.recoveryAttempts}회`,
      isolatedToolCalls,
      workerPids: Object.freeze(workerPids),
      resultSummary: result?.content ?? '',
    });
  }

  return Object.freeze({
    prepareGoal,
    approve,
    execute,
    stop: stopRun,
    completion,
    daemon,
    close: closeCore,
  });
}
