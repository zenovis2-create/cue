export type LeaseRequest = { taskId: string; worktree: string; readOnly: boolean; heartbeatPath?: string };
export type LeaseState = 'running' | 'queued';

export class WorkspaceLeases {
  private readonly holders = new Map<string, string>();
  private readonly queues = new Map<string, string[]>();
  acquire(request: LeaseRequest): LeaseState {
    if (request.readOnly) return 'running';
    if (!this.holders.has(request.worktree)) { this.holders.set(request.worktree, request.taskId); return 'running'; }
    const queue = this.queues.get(request.worktree) ?? []; queue.push(request.taskId); this.queues.set(request.worktree, queue); return 'queued';
  }
  release(worktree: string, taskId: string): string | undefined {
    if (this.holders.get(worktree) !== taskId) return undefined;
    const next = this.queues.get(worktree)?.shift();
    if (next) this.holders.set(worktree, next); else this.holders.delete(worktree);
    return next;
  }
  reapExpired(worktree: string, expired: boolean): string | undefined { return expired ? this.release(worktree, this.holders.get(worktree) ?? '') : undefined; }
  reapStaleHeartbeat(worktree: string, heartbeatPath: string, maxAgeMs: number, nowMs = Date.now()): string | undefined {
    return this.reapExpired(worktree, heartbeatExpired(heartbeatPath,maxAgeMs,nowMs));
  }
  holder(worktree: string): string | undefined { return this.holders.get(worktree); }
}
import { heartbeatExpired } from './heartbeat.js';
