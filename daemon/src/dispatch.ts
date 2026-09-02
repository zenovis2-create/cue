import type { Ledger } from './ledger.js';
import { routeTask } from './routing.js';
import { WorkspaceLeases } from './workspace-lease.js';
import { closeTask } from './task-close.js';
import { listOrphanSessions, } from './orphan-sessions.js';
import type { SessionRecord } from './session-spawn.js';
import { spawnVendorCodexInAppContainer } from './codex-session.js';

export interface DispatchRequest { routingPath:string; description:string; taskId:string; runId:string; worktree:string; readOnly:boolean; binary?:string; codexHome?:string; args?:readonly string[] }

export class Dispatcher {
  private readonly queued = new Map<string,{tool:string;request:DispatchRequest}>();
  constructor(private readonly db:Ledger, private readonly leases:WorkspaceLeases) {}
  private spawnTool(tool:string, request:DispatchRequest): void {
    if (tool !== 'codex') throw new Error(`unsupported tool: ${tool}`);
    const binary=request.binary ?? process.env.CUE_VENDOR_CODEX, codexHome=request.codexHome ?? process.env.CODEX_HOME;
    if (!binary || !codexHome) throw new Error('owned Codex launch configuration required');
    spawnVendorCodexInAppContainer(this.db,{cwd:request.worktree,task_id:request.taskId,run_id:request.runId},binary,codexHome,request.args ?? []);
  }
  dispatch(request:DispatchRequest): 'ask_me'|'queued'|'running' {
    const route=routeTask(request.routingPath,request.description);
    if (route.state==='ask_me') {
      this.db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(request.taskId,request.runId,'ask_me','no routing rule',new Date().toISOString());
      return 'ask_me';
    }
    const state=this.leases.acquire({taskId:request.taskId,worktree:request.worktree,readOnly:request.readOnly});
    this.db.prepare('UPDATE task SET state=? WHERE id=?').run(state,request.taskId);
    if (state==='running') this.spawnTool(route.tool,request); else this.queued.set(request.taskId,{tool:route.tool,request});
    return state;
  }
  finish(request:DispatchRequest, close:()=>boolean): 'succeeded'|'still_unsafe' {
    const result=closeTask(this.db,request.taskId,request.runId,close);
    if (!request.readOnly) {
      const next=this.leases.release(request.worktree,request.taskId), queued=next ? this.queued.get(next) : undefined;
      if (queued) { this.queued.delete(next!); this.db.prepare('UPDATE task SET state=? WHERE id=?').run('running',next); this.spawnTool(queued.tool,queued.request); }
    }
    return result;
  }
  restart(observed:readonly SessionRecord[]):SessionRecord[] { return listOrphanSessions(this.db,observed); }
}
