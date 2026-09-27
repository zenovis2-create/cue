import { randomUUID } from 'node:crypto';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeSync } from 'node:fs';

const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const within=(parent,child)=>{const part=relative(parent,child);return part===''||(!isAbsolute(part)&&part.split(/[\\/]/u)[0]!=='..');};
const canonicalFuture=path=>{const suffix=[];let current=resolve(path);while(!existsSync(current)){const parent=dirname(current);if(parent===current)throw Error('project_protection_unavailable');suffix.unshift(basename(current));current=parent;}return join(realpathSync.native(current),...suffix);};
export function canonicalProjectRoot(root,protectedRoots=[]){
  if(typeof root!=='string'||root.length>4096||!isAbsolute(root))throw Error('project_root_denied');
  const path=resolve(root),stat=lstatSync(path),canonical=realpathSync.native(path);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('project_root_denied');
  for(const protectedPath of protectedRoots){
    const canonicalProtected=canonicalFuture(protectedPath);
    if(within(canonical,canonicalProtected)||within(canonicalProtected,canonical))throw Error('project_root_protected');
  }
  return canonical;
}
export function createWorkspaceManagement(db,currentRoot,protectedRoots=[]){
  const ready=()=>{if(!db.open||db.inTransaction)throw Error('workspace_management_unavailable');};
  const root=canonicalProjectRoot(currentRoot);
  if(root!==currentRoot)throw Error('project_current_not_canonical');
  db.prepare('INSERT OR IGNORE INTO cue_project(project_id,worktree_realpath,name,registered_at) VALUES(?,?,?,?)')
    .run(randomUUID(),root,basename(root)||root,new Date().toISOString());
  const project=row=>Object.freeze({projectId:row.projectId,root:row.root,name:row.name,archived:row.archivedAt!==null,current:row.root===root});
  const session=row=>Object.freeze({sessionId:row.sessionId,title:row.title,createdAt:row.createdAt,archived:row.archivedAt!==null,runCount:row.runCount,lastRunId:row.lastRunId,lastState:row.lastState});
  const loadProject=id=>db.prepare('SELECT project_id projectId,worktree_realpath root,name,archived_at archivedAt FROM cue_project WHERE project_id=?').get(id);
  const loadSession=id=>db.prepare('SELECT session_id sessionId,title,created_at createdAt,archived_at archivedAt FROM cue_user_session WHERE session_id=? AND worktree_realpath=?').get(id,root);
  const ensure=id=>{ready();if(typeof id!=='string'||!ID.test(id))throw Error('session_input_denied');const row=loadSession(id);if(!row)throw Error('session_unavailable');return row;};
  return Object.freeze({
    projects(){ready();const rows=db.prepare('SELECT project_id projectId,worktree_realpath root,name,archived_at archivedAt FROM cue_project ORDER BY registered_at DESC, rowid DESC LIMIT 101').all();
      if(rows.length>100)throw Error('project_limit');return Object.freeze({version:'cue-projects-v1',authority:'registered-roots-only-no-execution',records:Object.freeze(rows.map(project))});},
    register(chosen){ready();const path=canonicalProjectRoot(chosen,protectedRoots);
      return db.transaction(()=>{
        const rows=db.prepare('SELECT worktree_realpath root FROM cue_project').all();
        if(rows.some(row=>row.root!==path&&(within(row.root,path)||within(path,row.root))))throw Error('project_overlap_denied');
        const existing=db.prepare('SELECT project_id projectId,worktree_realpath root,name,archived_at archivedAt FROM cue_project WHERE worktree_realpath=?').get(path);
        if(existing){if(existing.archivedAt!==null)throw Error('project_archived');return project(existing);}
        if(rows.length>=100)throw Error('project_limit');
        const id=randomUUID();db.prepare('INSERT INTO cue_project(project_id,worktree_realpath,name,registered_at) VALUES(?,?,?,?)').run(id,path,basename(path)||path,new Date().toISOString());
        return project(loadProject(id));
      }).immediate();},
    target(id){ready();if(typeof id!=='string'||!ID.test(id))throw Error('project_input_denied');const row=loadProject(id);
      if(!row||row.archivedAt!==null||row.root===root)throw Error('project_unavailable');
      if(canonicalProjectRoot(row.root,protectedRoots)!==row.root)throw Error('project_root_drift');return project(row);},
    archiveProject(id){const target=this.target(id);const has=db.prepare('SELECT 1 FROM cue_user_session WHERE worktree_realpath=? LIMIT 1').get(target.root)
      ||db.prepare('SELECT 1 FROM envelope WHERE worktree_realpath=? LIMIT 1').get(target.root);
      if(has)throw Error('project_has_history'); // No hiding a project with durable work.
      db.prepare('UPDATE cue_project SET archived_at=? WHERE project_id=? AND archived_at IS NULL').run(new Date().toISOString(),id);return project(loadProject(id));},
    assertOpenSession(id){const row=ensure(id);if(row.archivedAt!==null)throw Error('session_archived');return true;},
    createSession(){ready();const id=randomUUID(),now=new Date().toISOString();
      db.prepare('INSERT INTO cue_user_session(session_id,worktree_realpath,title,created_at) VALUES(?,?,?,?)').run(id,root,'새 작업 세션',now);
      return Object.freeze({sessionId:id,title:'새 작업 세션',createdAt:now,archived:false,runCount:0,lastRunId:null,lastState:null});},
    listSessions({limit,cursor,archived=false,query=null}){ready();if(!Number.isSafeInteger(limit)||limit<1||limit>20||(cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<1))||typeof archived!=='boolean'
        ||!(query===null||typeof query==='string'&&query.length>=1&&query.length<=100&&query===query.trim()))throw Error('session_input_denied');
      const match=query===null?'':` AND (instr(lower(s.title),lower(?))>0 OR EXISTS(
        SELECT 1 FROM cue_user_session_run sr JOIN artifact a ON a.run_id=sr.run_id
        WHERE sr.session_id=s.session_id AND a.kind='goal' AND instr(lower(substr(a.content,1,4096)),lower(?))>0))`;
      const terms=query===null?[]:[query,query];
      if(cursor!==null&&!db.prepare(`SELECT 1 FROM cue_user_session s WHERE s.rowid=? AND s.worktree_realpath=? AND (s.archived_at IS NOT NULL)=? ${match}`)
        .get(cursor,root,Number(archived),...terms))throw Error('session_cursor_denied');
      const rows=db.prepare(`SELECT s.rowid position,s.session_id sessionId,s.title,s.created_at createdAt,s.archived_at archivedAt,
        (SELECT count(*) FROM cue_user_session_run WHERE session_id=s.session_id) runCount,
        (SELECT x.run_id FROM cue_user_session_run x WHERE x.session_id=s.session_id ORDER BY x.rowid DESC LIMIT 1) lastRunId,
        (SELECT t.state FROM cue_user_session_run x JOIN run r ON r.id=x.run_id JOIN task t ON t.id=r.task_id WHERE x.session_id=s.session_id ORDER BY x.rowid DESC LIMIT 1) lastState
        FROM cue_user_session s WHERE s.worktree_realpath=? AND (s.archived_at IS NOT NULL)=? ${match} ${cursor===null?'':'AND s.rowid<?'} ORDER BY s.rowid DESC LIMIT ?`)
        .all(root,Number(archived),...terms,...(cursor===null?[]:[cursor]),limit+1);
      const visible=rows.slice(0,limit),complete=rows.length<=limit;
      return Object.freeze({version:'cue-user-sessions-v1',authority:'metadata-only-no-execution',archived,records:Object.freeze(visible.map(session)),nextCursor:complete?null:visible.at(-1).position,complete});},
    searchSessions(input){if(typeof input?.query!=='string')throw Error('session_input_denied');return this.listSessions(input);},
    renameSession({sessionId,expectedTitle,title}){const row=ensure(sessionId);
      if(row.archivedAt!==null||typeof expectedTitle!=='string'||expectedTitle.length>100||row.title!==expectedTitle
        ||typeof title!=='string'||title!==title.trim()||title.length<1||title.length>100
        ||title==='새 작업 세션'||Buffer.from(title,'utf8').toString('utf8')!==title
        ||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(title))throw Error('session_rename_denied');
      return db.transaction(()=>{
        const changed=db.prepare('UPDATE cue_user_session SET title=? WHERE session_id=? AND worktree_realpath=? AND archived_at IS NULL AND title=?')
          .run(title,sessionId,root,expectedTitle);
        if(changed.changes!==1)throw Error('session_rename_conflict');
        return Object.freeze({sessionId,title,authority:'metadata-only-no-execution'});
      }).immediate();},
    readSession({sessionId,limit=20,cursor=null}){const row=ensure(sessionId);if(!Number.isSafeInteger(limit)||limit<1||limit>20||(cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<1)))throw Error('session_input_denied');
      if(cursor!==null&&!db.prepare('SELECT 1 FROM cue_user_session_run WHERE rowid=? AND session_id=?').get(cursor,sessionId))throw Error('session_cursor_denied');
      const rows=db.prepare(`SELECT x.rowid position,r.id runId,t.state,r.started_at startedAt,
        (SELECT substr(content,1,4096) FROM artifact WHERE run_id=r.id AND kind='goal' ORDER BY id LIMIT 1) goal
        FROM cue_user_session_run x JOIN run r ON r.id=x.run_id JOIN task t ON t.id=r.task_id
        WHERE x.session_id=? ${cursor===null?'':'AND x.rowid<?'} ORDER BY x.rowid DESC LIMIT ?`).all(...(cursor===null?[sessionId,limit+1]:[sessionId,cursor,limit+1]));
      const visible=rows.slice(0,limit),complete=rows.length<=limit;
      return Object.freeze({version:'cue-user-session-v1',authority:'historical-links-only-no-resume',sessionId,title:row.title,archived:row.archivedAt!==null,
        records:Object.freeze(visible.map(r=>Object.freeze({runId:r.runId,state:r.state,startedAt:r.startedAt,goal:r.goal??null}))),nextCursor:complete?null:visible.at(-1).position,complete});},
    attachRun({sessionId,runId}){const row=ensure(sessionId);if(row.archivedAt!==null||typeof runId!=='string'||!ID.test(runId))throw Error('session_attach_denied');
      const run=db.prepare(`SELECT r.id,t.state,e.worktree_realpath root FROM run r JOIN task t ON t.id=r.task_id JOIN envelope e ON e.envelope_hash=r.envelope_hash WHERE r.id=?`).get(runId);
      if(!run||run.root!==root||run.state!=='awaiting_approval')throw Error('session_attach_denied');
      db.transaction(()=>{
        db.prepare('INSERT INTO cue_user_session_run(run_id,session_id,attached_at) VALUES(?,?,?)').run(runId,sessionId,new Date().toISOString());
        if(row.title==='새 작업 세션'){
          const goal=db.prepare("SELECT substr(content,1,100) goal FROM artifact WHERE run_id=? AND kind='goal' ORDER BY id LIMIT 1").get(runId)?.goal;
          if(typeof goal==='string'&&goal.trim())db.prepare("UPDATE cue_user_session SET title=? WHERE session_id=? AND title='새 작업 세션'").run(goal.trim().slice(0,100),sessionId);
        }
      })();
      return Object.freeze({sessionId,runId,authority:'link-only-no-execution'});},
    archiveSession(id){const row=ensure(id);if(row.archivedAt!==null)return Object.freeze({sessionId:id,archived:true});
      return db.transaction(()=>{
        const active=db.prepare(`SELECT 1 FROM cue_user_session_run x JOIN run r ON r.id=x.run_id JOIN task t ON t.id=r.task_id
          WHERE x.session_id=? AND t.state IN ('awaiting_approval','queued','running') LIMIT 1`).get(id);
        if(active)throw Error('session_active');
        db.prepare('UPDATE cue_user_session SET archived_at=? WHERE session_id=? AND archived_at IS NULL').run(new Date().toISOString(),id);
        return Object.freeze({sessionId:id,archived:true});
      }).immediate();},
  });
}
export function activateProjectConfig(userDataPath,expected,targetRoot){
  const path=resolve(userDataPath,'cue-config.json'),lock=resolve(userDataPath,'cue-config-switch.lock');
  const lockFd=openSync(lock,'wx',0o600);let fd,temp;
  try{
    const raw=readFileSync(path,'utf8'),saved=JSON.parse(raw);
    if(saved.version!==1||saved.worktreeRoot!==expected.worktreeRoot||saved.ledgerPath!==expected.ledgerPath||Object.keys(saved).sort().join(',')!=='ledgerPath,version,worktreeRoot')throw Error('project_config_changed');
    const canonical=canonicalProjectRoot(targetRoot);
    temp=resolve(dirname(path),`.cue-config-${randomUUID()}.tmp`);
    fd=openSync(temp,'wx',0o600);writeSync(fd,`${JSON.stringify({...saved,worktreeRoot:canonical},null,2)}\n`);fsyncSync(fd);closeSync(fd);fd=undefined;
    if(readFileSync(path,'utf8')!==raw)throw Error('project_config_changed');renameSync(temp,path);
  }finally{if(fd!==undefined)closeSync(fd);if(temp)try{unlinkSync(temp);}catch(error){if(error.code!=='ENOENT')throw error;}
    closeSync(lockFd);unlinkSync(lock);}
}
