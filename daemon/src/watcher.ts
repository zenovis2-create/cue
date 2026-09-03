import { createHash } from 'node:crypto';
import type { Ledger } from './ledger.js';

export type SignalGrade = 'conclusive' | 'candidate';
export type SignalSource = 'gate-list' | 'exit-code' | 'terminal-wait' | 'worker-read' | 'task-list';
export interface WatchSignal { source: SignalSource; grade: SignalGrade; value: unknown }

const signalGrades: Readonly<Record<SignalSource, SignalGrade>> = Object.freeze({
  'gate-list': 'conclusive',
  'exit-code': 'conclusive',
  'terminal-wait': 'candidate',
  'worker-read': 'candidate',
  'task-list': 'conclusive',
});

export function collectSignals(observations: Partial<Record<SignalSource, unknown>>): WatchSignal[] {
  return (Object.keys(signalGrades) as SignalSource[])
    .filter(source => Object.prototype.hasOwnProperty.call(observations, source))
    .map(source => ({ source, grade: signalGrades[source], value: observations[source] }));
}

export function diagnoseCandidates(signals: readonly WatchSignal[], diagnose: (signals: readonly WatchSignal[]) => unknown): unknown | undefined {
  const candidates = signals.filter(signal => signal.grade === 'candidate');
  return candidates.length >= 2 ? diagnose(candidates) : undefined;
}

export type TaskType = 'interactive' | 'coding' | 'research' | 'verification';
export const idleThresholdSpec: Readonly<Record<TaskType, number>> = Object.freeze({
  interactive: 30_000,
  coding: 180_000,
  research: 300_000,
  verification: 120_000,
});

export interface IdleObservation { emptyPage: boolean; elapsedMs: number; workerAlive: boolean; taskType: TaskType }
export function classifyIdle(observation: IdleObservation): 'blocked/idle' | 'observing' {
  return observation.emptyPage && observation.workerAlive && observation.elapsedMs >= idleThresholdSpec[observation.taskType]
    ? 'blocked/idle'
    : 'observing';
}

export interface HandoffPackage {
  version: 1;
  run_id: string;
  reason: string;
  evidence_refs: string[];
  requested_human_action: string;
}
export function validateHandoffPackage(value: unknown): value is HandoffPackage {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return item.version === 1 && typeof item.run_id === 'string' && item.run_id.length > 0
    && typeof item.reason === 'string' && item.reason.length > 0
    && Array.isArray(item.evidence_refs) && item.evidence_refs.every(ref => typeof ref === 'string')
    && typeof item.requested_human_action === 'string' && item.requested_human_action.length > 0;
}

export function decisionGate(_autonomy: AutonomyLevel): { action: 'human_required' } { return { action: 'human_required' }; }

export type AutonomyLevel = 1 | 2 | 3;
export interface TaskContract {
  readonly goal: string;
  readonly constraints: readonly string[];
  readonly done_when: readonly string[];
  readonly deliverable: string;
}
export interface RecoveryRequest {
  readonly runId: string;
  readonly failure: string;
  readonly contract: TaskContract;
  readonly actionAllowed: boolean;
  readonly decisionGateOpen?: boolean;
}
export interface RecoveryDecision { action: 'stop' | 'mechanical_retry' | 'hypothesis_retry' | 'change_approach' | 'redecompose' | 'human'; attemptId?: number }

function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }

export class RecoveryCoordinator {
  private readonly contractHash: string;
  constructor(private readonly db: Ledger, readonly runId: string, readonly retryCap: number, contract: TaskContract, initialLevel: AutonomyLevel = 1, now = new Date()) {
    if (!Number.isInteger(retryCap) || retryCap < 0) throw new Error('invalid retry cap');
    const row = db.prepare('SELECT level,retry_cap FROM run_autonomy WHERE run_id=?').get(runId) as {level:number;retry_cap:number}|undefined;
    if (row && row.retry_cap !== retryCap) throw new Error('retry cap is immutable');
    if (!row) db.prepare('INSERT INTO run_autonomy(run_id,level,retry_cap,recorded_at) VALUES(?,?,?,?)').run(runId,initialLevel,retryCap,now.toISOString());
    this.contractHash=hash(JSON.stringify(contract));
  }

  autonomy(): AutonomyLevel {
    return (this.db.prepare('SELECT level FROM run_autonomy WHERE run_id=?').get(this.runId) as {level:AutonomyLevel}).level;
  }

  changeAutonomy(requested: AutonomyLevel, now = new Date()): 'lowered' | 'unchanged' | 'stop_new_run' {
    const current=this.autonomy();
    if (requested === current) return 'unchanged';
    const outcome=requested < current ? 'lowered' : 'stop_new_run';
    this.db.prepare('INSERT INTO autonomy_change(run_id,from_level,requested_level,outcome,created_at) VALUES(?,?,?,?,?)').run(this.runId,current,requested,outcome,now.toISOString());
    if (outcome === 'lowered') this.db.prepare('UPDATE run_autonomy SET level=? WHERE run_id=?').run(requested,this.runId);
    return outcome;
  }

  private append(rung: number, hypothesis: string, outcome: string, now: Date): number {
    const previous=this.db.prepare('SELECT id,ordinal FROM recovery_attempt_v2 WHERE run_id=? ORDER BY ordinal DESC LIMIT 1').get(this.runId) as {id:number;ordinal:number}|undefined;
    const info=this.db.prepare('INSERT INTO recovery_attempt_v2(run_id,parent_attempt_id,ordinal,rung,hypothesis,outcome,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(this.runId,previous?.id ?? null,(previous?.ordinal ?? 0)+1,rung,hypothesis,outcome,now.toISOString());
    return Number(info.lastInsertRowid);
  }

  recover(request: RecoveryRequest, hypothesis: string, now = new Date()): RecoveryDecision {
    if (request.runId !== this.runId) throw new Error('run mismatch');
    if (hash(JSON.stringify(request.contract)) !== this.contractHash) return { action:'human' };
    if (request.decisionGateOpen) return { action:'human' };
    if (!request.actionAllowed) return { action:'human' };
    const level=this.autonomy();
    if (level === 1) return { action:'stop' };
    const automated=(this.db.prepare('SELECT count(*) AS n FROM recovery_attempt_v2 WHERE run_id=? AND rung<4').get(this.runId) as {n:number}).n;
    if (automated >= this.retryCap) return { action:'human', attemptId:this.append(4,`cap reached: ${request.failure}`,'human_escalation',now) };
    if (level === 2) {
      if (automated > 0) return { action:'human', attemptId:this.append(4,`mechanical recovery exhausted: ${request.failure}`,'human_escalation',now) };
      return { action:'mechanical_retry', attemptId:this.append(1,`mechanical: ${request.failure}`,'retry',now) };
    }
    const prior=this.db.prepare('SELECT hypothesis FROM recovery_attempt_v2 WHERE run_id=? AND rung<4').all(this.runId) as Array<{hypothesis:string}>;
    if (!hypothesis.trim() || prior.some(row=>row.hypothesis===hypothesis)) throw new Error('new hypothesis required');
    const actions = ['hypothesis_retry','change_approach','redecompose'] as const;
    const rung=Math.min(automated+1,3);
    return { action:actions[rung-1], attemptId:this.append(rung,hypothesis,'retry',now) };
  }

  fenceBeforeRestart(taskId: string, baseSha: string, diff: string, restart: () => void, now = new Date()): void {
    const values:[string,string][]=[['recovery_base_sha',baseSha],['recovery_diff_hash',hash(diff)],['restart_fence','fenced']];
    const tx=this.db.transaction(()=>{ for(const [kind,content] of values) this.db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(taskId,this.runId,kind,content,now.toISOString()); });
    tx();
    restart();
  }

  recordRecoveryArtifacts(taskId: string, certain: readonly [string,string][], borderline: readonly [string,string][], writeBorderline: (write: () => void) => void = write => write(), now = new Date()): void {
    const insert = this.db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)');
    this.db.transaction(() => { for (const [kind,content] of certain) insert.run(taskId,this.runId,kind,content,now.toISOString()); })();
    writeBorderline(() => { this.db.transaction(() => { for (const [kind,content] of borderline) insert.run(taskId,this.runId,kind,content,now.toISOString()); })(); });
  }
}
