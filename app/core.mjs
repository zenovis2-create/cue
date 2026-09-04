import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openLedger } from '../daemon/dist/src/ledger.js';
import { envelopeHash } from '../daemon/dist/src/envelope.js';
import { renderApproval } from '../daemon/dist/src/approval-surface.js';
import { readTaskCard } from '../daemon/dist/src/ui/model.js';

const FORBIDDEN_CONFIG_KEYS = /credential|password|secret|token|api[_-]?key/i;

export function initializeConfig(userDataPath, defaults = {}) {
  mkdirSync(userDataPath, { recursive: true });
  const configPath = join(userDataPath, 'cue-config.json');
  try {
    return Object.freeze(JSON.parse(readFileSync(configPath, 'utf8')));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const worktreeRoot = realpathSync.native(resolve(defaults.worktreeRoot ?? process.cwd()));
  const config = Object.freeze({
    version: 1,
    ledgerPath: resolve(defaults.ledgerPath ?? join(userDataPath, 'cue-ledger.sqlite')),
    worktreeRoot,
  });
  if (Object.keys(config).some(key => FORBIDDEN_CONFIG_KEYS.test(key))) throw new Error('credential fields are forbidden');
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
  return config;
}

export class AppDaemon {
  #db;
  #status = 'ready';
  constructor(config) { this.#db = openLedger(config.ledgerPath); }
  get db() { return this.#db; }
  get status() { return this.#status; }
  crash(reason = 'daemon_crash') {
    this.#status = 'blocked/crash';
    this.#db.prepare("UPDATE task SET state='blocked',blocked_reason=? WHERE state='running'").run(reason);
  }
  close() { if (this.#status !== 'closed') this.#db.close(); this.#status = 'closed'; }
}

export function createCueCore(config, daemon = new AppDaemon(config)) {
  const db = daemon.db;
  const prepared = new Map();

  function prepareGoal(goal, autonomy = 3) {
    if (![1, 2, 3].includes(autonomy)) throw new Error('invalid autonomy');
    const taskId = randomUUID();
    const runId = randomUUID();
    const envelope = {
      run_id: runId,
      worktree_realpath: config.worktreeRoot,
      egress: [],
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      autonomy_level: 'bounded',
      allowed_actions: ['write:cue-p9-live.txt'],
    };
    const hash = envelopeHash(envelope);
    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare('INSERT INTO task VALUES(?,?,?,?)').run(taskId, 'awaiting_approval', null, now);
      db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(hash, envelope.worktree_realpath, '[]', now);
      db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run(runId, taskId, hash, 0, now);
    })();
    const copy = Object.freeze({
      what: goal.trim(),
      extent: 'worktree의 cue-p9-live.txt 한 파일',
      excluded: '네트워크, 외부 시스템, 그 밖의 파일',
      envelopeSummary: 'worktree 한 파일 쓰기 · 네트워크 없음',
    });
    prepared.set(runId, Object.freeze({ taskId, runId, envelopeHash: hash, autonomy, envelope, copy }));
    return Object.freeze({ taskId, runId, autonomy, threeLines: renderApproval({ ...copy, autonomy }).split('\n'), envelope: Object.freeze({ ...envelope }) });
  }

  function approve(runId) {
    const run = prepared.get(runId);
    if (!run) throw new Error('unknown run');
    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare('INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(runId, run.envelopeHash, 'desktop', `goal:${run.taskId}`, `approval:${runId}`, 0, 'accept', now);
      db.prepare('INSERT INTO run_autonomy(run_id,level,retry_cap,recorded_at) VALUES(?,?,?,?)').run(runId, run.autonomy, 3, now);
    })();
    return Object.freeze({ approved: true, runId });
  }

  function execute(runId) {
    const run = prepared.get(runId);
    if (!run) throw new Error('unknown run');
    const approval = db.prepare("SELECT id FROM approval_event WHERE run_id=? AND envelope_hash=? AND decision='accept'").get(runId, run.envelopeHash);
    if (!approval) throw new Error('approval required');
    if (daemon.status !== 'ready') throw new Error('daemon blocked/crash');
    const target = resolve(config.worktreeRoot, 'cue-p9-live.txt');
    if (dirname(target) !== resolve(config.worktreeRoot)) throw new Error('envelope denied');
    db.prepare("UPDATE task SET state='running' WHERE id=?").run(run.taskId);
    writeFileSync(target, 'Cue Phase 9 live run completed.\n', { flag: 'w' });
    db.prepare("UPDATE task SET state='completed' WHERE id=?").run(run.taskId);
    return completion(run.taskId);
  }

  function completion(taskId) {
    const card = readTaskCard(db, taskId);
    const symbol = card.autonomyLevel === null ? null : '①②③'[card.autonomyLevel - 1];
    return Object.freeze({
      ...card,
      approvalSummary: `자동 승인 ${card.accepted}건 · 거부 ${card.declined}건`,
      autonomySummary: `자율성: ${symbol} · 자동 복구 ${card.recoveryAttempts}회`,
    });
  }

  return Object.freeze({ prepareGoal, approve, execute, completion, daemon, close: () => daemon.close() });
}
