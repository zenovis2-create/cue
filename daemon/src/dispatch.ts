import type { ChildProcess } from 'node:child_process';
import type { Ledger } from './ledger.js';
import { routeTask } from './routing.js';
import { WorkspaceLeases } from './workspace-lease.js';
import { closeTask } from './task-close.js';
import { listOrphanSessions, } from './orphan-sessions.js';
import type { SessionRecord } from './session-spawn.js';

export interface DispatchRequest { routingPath:string; description:string; taskId:string; runId:string; worktree:string; readOnly:boolean }
export type ToolSpawner = (tool:string, request:DispatchRequest) => ChildProcess;

export class Dispatcher {
  constructor(private readonly db:Ledger, private readonly leases:WorkspaceLeases, private readonly spawnTool:ToolSpawner) {}
  dispatch(request:DispatchRequest): 'ask_me'|'queued'|'running' {
    const route=routeTask(request.routingPath,request.description);
    if (route.state==='ask_me') {
      this.db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(request.taskId,request.runId,'ask_me','no routing rule',new Date().toISOString());
      return 'ask_me';
    }
    const state=this.leases.acquire({taskId:request.taskId,worktree:request.worktree,readOnly:request.readOnly});
    this.db.prepare('UPDATE task SET state=? WHERE id=?').run(state,request.taskId);
    if (state==='running') this.spawnTool(route.tool,request);
    return state;
  }
  finish(request:DispatchRequest, close:()=>boolean): 'succeeded'|'still_unsafe' {
    const result=closeTask(this.db,request.taskId,request.runId,close);
    if (!request.readOnly) this.leases.release(request.worktree,request.taskId);
    return result;
  }
  restart(observed:readonly SessionRecord[]):SessionRecord[] { return listOrphanSessions(this.db,observed); }
}
