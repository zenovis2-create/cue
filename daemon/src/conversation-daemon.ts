import type { Ledger } from './ledger.js';
import type { HealthVector } from './health.js';
import { failedComponents } from './health.js';
import type { AutonomyLevel } from './approval-surface.js';
import type { BuzzMessage, CueBuzzAdapter } from './buzz-adapter.js';

export interface AcceptedConversationRun {
  readonly taskId: string;
  readonly runId: string;
  readonly envelopeHash: string;
  readonly channelId: string;
  readonly threadRoot: string;
  readonly autonomy?: AutonomyLevel;
  readonly retryCap: number;
}

export class ConversationDaemonApi {
  private serial: Promise<void> = Promise.resolve();
  constructor(private readonly db: Ledger, private readonly outbound: CueBuzzAdapter) {}

  accept(request: AcceptedConversationRun, health: HealthVector, now = new Date()): {accepted:true; autonomy:AutonomyLevel}|{accepted:false; message:string} {
    const dead = failedComponents(health);
    if (dead.length) return {accepted:false, message:`작업을 수락하지 않았습니다. 죽은 구성요소: ${dead.join(', ')}`};
    const run = this.db.prepare('SELECT task_id,envelope_hash FROM run WHERE id=?').get(request.runId) as {task_id:string;envelope_hash:string}|undefined;
    if (!run || run.task_id !== request.taskId || run.envelope_hash !== request.envelopeHash) return {accepted:false, message:'작업을 수락하지 않았습니다. 실행 봉투가 원장과 일치하지 않습니다.'};
    const level = request.autonomy ?? 3;
    this.db.transaction(() => {
      this.db.prepare('INSERT INTO conversation_route(run_id,channel_id,thread_root,approved_at) VALUES(?,?,?,?)').run(request.runId, request.channelId, request.threadRoot, now.toISOString());
      this.db.prepare('INSERT INTO run_autonomy(run_id,level,retry_cap,recorded_at) VALUES(?,?,?,?)').run(request.runId, level, request.retryCap, now.toISOString());
      this.db.prepare("UPDATE task SET state='running' WHERE id=?").run(request.taskId);
    })();
    return {accepted:true, autonomy:level};
  }

  sendResult(runId: string, text: string): Promise<'sent'|'identity_unconfigured'> {
    const route = this.db.prepare('SELECT channel_id,thread_root FROM conversation_route WHERE run_id=?').get(runId) as {channel_id:string;thread_root:string}|undefined;
    if (!route) return Promise.resolve('identity_unconfigured');
    const message: BuzzMessage = {...route, text};
    const operation = this.serial.then(() => this.outbound.send(message));
    this.serial = operation.then(() => undefined, () => undefined);
    return operation;
  }

  enqueue<T>(channelId:string, work:()=>Promise<T>):Promise<{channelId:string;value:T}> {
    const operation=this.serial.then(async()=>({channelId,value:await work()}));
    this.serial=operation.then(()=>undefined,()=>undefined);
    return operation;
  }
}
