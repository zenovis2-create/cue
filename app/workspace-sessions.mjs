import { basename } from 'node:path';

const RUN_ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const STATES=new Set(['queued','running','awaiting_approval','blocked','completed','failed']);

// A work session is one stored Cue run. It is not a provider session handle,
// a reconnect token, or permission to resume/replay historical work.
export function createWorkspaceSessionReader(db,worktree){
  const project=Object.freeze({name:basename(worktree),root:worktree});
  const ready=()=>{if(!db.open||db.inTransaction)throw Error('workspace_sessions_unavailable');};
  const safe=row=>{
    if(!row||!RUN_ID.test(row.runId)||!RUN_ID.test(row.taskId)||!STATES.has(row.state)||typeof row.startedAt!=='string'||row.startedAt.length>128)throw Error('workspace_sessions_integrity');
    return Object.freeze({runId:row.runId,taskId:row.taskId,state:row.state,startedAt:row.startedAt,title:(typeof row.goal==='string'&&row.goal.trim()?row.goal.trim().slice(0,120):'목표 기록 없음')});
  };
  const columns=`r.id runId,r.task_id taskId,t.state,r.started_at startedAt,
    (SELECT substr(content,1,4097) FROM artifact WHERE run_id=r.id AND kind='goal' ORDER BY id LIMIT 1) goal`;
  return Object.freeze({
    list({limit,cursor}){
      ready();if(!Number.isSafeInteger(limit)||limit<1||limit>20||(cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<1)))throw Error('workspace_sessions_input');
      if(cursor!==null&&!db.prepare('SELECT 1 FROM run r JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE r.rowid=? AND e.worktree_realpath=?').get(cursor,worktree))throw Error('workspace_sessions_cursor');
      const rows=db.prepare(`SELECT r.rowid position,${columns} FROM run r JOIN task t ON t.id=r.task_id JOIN envelope e ON e.envelope_hash=r.envelope_hash
        WHERE e.worktree_realpath=? ${cursor===null?'':'AND r.rowid<?'} ORDER BY r.rowid DESC LIMIT ?`).all(...(cursor===null?[worktree,limit+1]:[worktree,cursor,limit+1]));
      const visible=rows.slice(0,limit),complete=rows.length<=limit;
      return Object.freeze({version:'cue-workspace-sessions-v1',authority:'historical-ledger-index-only',project,
        records:Object.freeze(visible.map(safe)),nextCursor:complete?null:visible.at(-1).position,complete});
    },
    read({runId}){
      ready();if(typeof runId!=='string'||!RUN_ID.test(runId))throw Error('workspace_sessions_input');
      const row=db.prepare(`SELECT ${columns} FROM run r JOIN task t ON t.id=r.task_id JOIN envelope e ON e.envelope_hash=r.envelope_hash
        WHERE r.id=? AND e.worktree_realpath=?`).get(runId,worktree);
      if(!row)throw Error('workspace_sessions_unavailable');
      const session=safe(row);
      return Object.freeze({version:'cue-workspace-session-v1',authority:'historical-ledger-read-only',project,
        session:Object.freeze({...session,goal:typeof row.goal==='string'?row.goal.slice(0,4096):null}),
        limitation:'stored-run-only-no-reconnect-or-execution-authority'});
    },
  });
}
