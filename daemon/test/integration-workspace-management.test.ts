import {afterEach,expect,test,vi} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openLedger} from '../src/ledger.js';
import {createWorkspaceManagement,activateProjectConfig} from '../../app/workspace-management.mjs';
import {createCueCore,initializeConfig} from '../../app/core.mjs';
import {registerIpcHandlers} from '../../app/ipc.mjs';
import {createProjectSwitchCoordinator} from '../../app/project-switch.mjs';
const roots:string[]=[],ledgers:ReturnType<typeof openLedger>[]=[];
afterEach(()=>{for(const db of ledgers.splice(0))if(db.open)db.close();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:50});vi.restoreAllMocks();});
function fixture(){const base=mkdtempSync(join(tmpdir(),'cue-project-session-'));roots.push(base);const a=join(base,'a'),b=join(base,'b'),protectedRoot=join(base,'protected');for(const dir of [a,b,protectedRoot])mkdirSync(dir);const db=openLedger(join(base,'ledger.sqlite'));ledgers.push(db);return{base,a:realpathSync.native(a),b:realpathSync.native(b),protectedRoot:realpathSync.native(protectedRoot),db};}
function run(db:ReturnType<typeof openLedger>,id:string,root:string,goal:string){db.prepare('INSERT INTO task(id,state,created_at) VALUES(?,?,?)').run('task-'+id,'awaiting_approval','2026-09-23T00:00:00Z');db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('env-'+id,root,'[]','2026-09-23T00:00:00Z');db.prepare('INSERT INTO run(id,task_id,envelope_hash,started_at) VALUES(?,?,?,?)').run('run-'+id,'task-'+id,'env-'+id,'2026-09-23T00:00:00Z');db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run('task-'+id,'run-'+id,'goal',goal,'2026-09-23T00:00:00Z');}
test('project registration is canonical, bounded, guarded against overlaps and protects durable history',()=>{
 const f=fixture(),m=createWorkspaceManagement(f.db,f.a,[f.protectedRoot]);
 expect(m.projects().records).toMatchObject([{root:f.a,current:true,archived:false}]);
 const added=m.register(f.b);expect(added).toMatchObject({root:f.b,current:false,archived:false});expect(m.register(f.b).projectId).toBe(added.projectId);
 expect(()=>m.register(f.protectedRoot)).toThrow('project_root_protected');
 const nested=join(f.a,'nested');mkdirSync(nested);expect(()=>m.register(realpathSync.native(nested))).toThrow('project_overlap_denied');
 expect(()=>m.target(m.projects().records.find(p=>p.current)!.projectId)).toThrow('project_unavailable');
 run(f.db,'foreign',f.b,'private');expect(()=>m.archiveProject(added.projectId)).toThrow('project_has_history');
 expect(m.target(added.projectId).root).toBe(f.b);
});
test('Cue sessions link distinct runs, enforce scope in code and SQLite, and survive reopen without resume',()=>{
 const f=fixture(),a=createWorkspaceManagement(f.db,f.a),b=createWorkspaceManagement(f.db,f.b);
 const s=a.createSession();run(f.db,'one',f.a,'첫 목표');run(f.db,'two',f.a,'두 번째 목표');run(f.db,'foreign',f.b,'foreign secret');
 expect(()=>a.attachRun({sessionId:s.sessionId,runId:'run-foreign'})).toThrow('session_attach_denied');
 expect(()=>b.readSession({sessionId:s.sessionId})).toThrow('session_unavailable');
 expect(()=>f.db.prepare('INSERT INTO cue_user_session_run VALUES(?,?,?)').run('run-foreign',s.sessionId,'now')).toThrow('cue session scope denied');
 a.attachRun({sessionId:s.sessionId,runId:'run-one'});a.attachRun({sessionId:s.sessionId,runId:'run-two'});
 expect(()=>a.attachRun({sessionId:s.sessionId,runId:'run-two'})).toThrow();
 expect(()=>f.db.prepare("UPDATE cue_user_session_run SET session_id=? WHERE run_id='run-one'").run(b.createSession().sessionId)).toThrow('immutable');
 const first=a.readSession({sessionId:s.sessionId,limit:1,cursor:null});expect(first).toMatchObject({authority:'historical-links-only-no-resume',records:[{runId:'run-two',goal:'두 번째 목표'}],complete:false});
 const second=a.readSession({sessionId:s.sessionId,limit:1,cursor:first.nextCursor});expect(second.records[0].runId).toBe('run-one');
 expect(()=>a.readSession({sessionId:s.sessionId,limit:1,cursor:9999})).toThrow('cursor');
 expect(a.listSessions({limit:20,cursor:null,archived:false}).records.find(x=>x.sessionId===s.sessionId)).toMatchObject({runCount:2,title:'첫 목표',lastRunId:'run-two'});
 expect(a.searchSessions({limit:20,cursor:null,archived:false,query:'두 번째'}).records.map(x=>x.sessionId)).toEqual([s.sessionId]);
 expect(a.searchSessions({limit:20,cursor:null,archived:false,query:'foreign secret'}).records).toEqual([]);
 expect(a.searchSessions({limit:20,cursor:null,archived:false,query:'%'}).records).toEqual([]);
 const foreignCursor=f.db.prepare('SELECT rowid position FROM cue_user_session WHERE session_id=?').get(b.createSession().sessionId) as {position:number};
 expect(()=>a.searchSessions({limit:20,cursor:foreignCursor.position,archived:false,query:'첫'})).toThrow('cursor');
 expect(()=>a.archiveSession(s.sessionId)).toThrow('session_active');
 f.db.prepare("UPDATE task SET state='completed' WHERE id IN ('task-one','task-two')").run();expect(a.archiveSession(s.sessionId).archived).toBe(true);
 expect(()=>a.attachRun({sessionId:s.sessionId,runId:'run-foreign'})).toThrow();
 expect(createWorkspaceManagement(f.db,f.a).readSession({sessionId:s.sessionId}).records).toHaveLength(2);
 f.db.close();ledgers.pop();const reopened=openLedger(join(f.base,'ledger.sqlite'));ledgers.push(reopened);
 expect(createWorkspaceManagement(reopened,f.a).readSession({sessionId:s.sessionId}).records).toHaveLength(2);
 expect(createWorkspaceManagement(reopened,f.b).listSessions({limit:20,cursor:null,archived:false}).records.every(x=>x.sessionId!==s.sessionId)).toBe(true);
});
test('session rename is workspace-scoped metadata with stale-name and archive refusal',()=>{
 const f=fixture(),a=createWorkspaceManagement(f.db,f.a),b=createWorkspaceManagement(f.db,f.b),s=a.createSession();
 run(f.db,'one',f.a,'첫 목표');a.attachRun({sessionId:s.sessionId,runId:'run-one'});
 expect(()=>b.renameSession({sessionId:s.sessionId,expectedTitle:'첫 목표',title:'다른 이름'})).toThrow('session_unavailable');
 expect(a.renameSession({sessionId:s.sessionId,expectedTitle:'첫 목표',title:'정리 작업'})).toEqual({sessionId:s.sessionId,title:'정리 작업',authority:'metadata-only-no-execution'});
 expect(()=>a.renameSession({sessionId:s.sessionId,expectedTitle:'첫 목표',title:'오래된 요청'})).toThrow('session_rename_denied');
 for(const title of ['',' 앞뒤 공백 ','새 작업 세션','줄\n바꿈','\ud800','x'.repeat(101)])expect(()=>a.renameSession({sessionId:s.sessionId,expectedTitle:'정리 작업',title})).toThrow('session_rename_denied');
 expect(a.readSession({sessionId:s.sessionId}).title).toBe('정리 작업');
 expect(a.searchSessions({limit:20,cursor:null,archived:false,query:'정리 작업'}).records[0].sessionId).toBe(s.sessionId);
 f.db.prepare("UPDATE task SET state='completed' WHERE id='task-one'").run();a.archiveSession(s.sessionId);
 expect(()=>a.renameSession({sessionId:s.sessionId,expectedTitle:'정리 작업',title:'보관 변경'})).toThrow('session_rename_denied');
 f.db.close();ledgers.pop();const reopened=openLedger(join(f.base,'ledger.sqlite'));ledgers.push(reopened);
 expect(createWorkspaceManagement(reopened,f.a).readSession({sessionId:s.sessionId}).title).toBe('정리 작업');
});
test('strict IPC refuses forged project/session commands and links prepared run without execution authority',async()=>{
 const f=fixture(),m=createWorkspaceManagement(f.db,f.a),session=m.createSession();run(f.db,'one',f.a,'Goal <script>');
 const core={prepareGoal:vi.fn(()=>({runId:'run-one'})),projectSwitchReadiness:()=>({ready:true,reason:null})};
 const host={projectManagement:m,sessionManagement:m,chooseProjectDirectory:async()=>f.b,switchProject:vi.fn(async()=>{})};
 const ipc=registerIpcHandlers({handle(){}},core as any,host);
 expect((await ipc.invoke('cue:projects',{operation:'list'})).records).toHaveLength(1);
 await expect(ipc.invoke('cue:projects',{operation:'add'}) as Promise<any>).resolves.toMatchObject({root:f.b});
 expect(ipc.invoke('cue:user-sessions',{operation:'list',limit:20,cursor:null,archived:false}).records).toHaveLength(1);
 expect(ipc.invoke('cue:user-sessions',{operation:'search',limit:20,cursor:null,archived:false,query:'Goal'}).records).toHaveLength(0);
 const prepared=ipc.invoke('cue:prepare',{goal:'Goal',autonomy:3,sessionId:session.sessionId});expect(prepared.runId).toBe('run-one');
 expect(m.readSession({sessionId:session.sessionId}).records[0].runId).toBe('run-one');
 expect(ipc.invoke('cue:user-sessions',{operation:'search',limit:20,cursor:null,archived:false,query:'Goal'}).records).toHaveLength(1);
 expect(ipc.invoke('cue:user-sessions',{operation:'rename',sessionId:session.sessionId,expectedTitle:'Goal <script>',title:'새 제목'})).toEqual({sessionId:session.sessionId,title:'새 제목',authority:'metadata-only-no-execution'});
 expect(m.readSession({sessionId:session.sessionId}).title).toBe('새 제목');
 expect(()=>ipc.invoke('cue:user-sessions',{operation:'rename',sessionId:session.sessionId,expectedTitle:'Goal <script>',title:'경합'})).toThrow('session_rename_denied');
 expect(()=>ipc.invoke('cue:user-sessions',{operation:'rename',sessionId:session.sessionId,expectedTitle:'새 제목',title:'새 작업 세션'})).toThrow('session IPC denied');
 let accessed=false;const hostile=Object.defineProperty({operation:'rename',sessionId:session.sessionId,expectedTitle:'새 제목'},'title',{enumerable:true,get(){accessed=true;return '위조';}});
 expect(()=>ipc.invoke('cue:user-sessions',hostile)).toThrow('workspace IPC denied');expect(accessed).toBe(false);
 expect(()=>ipc.invoke('cue:prepare',{goal:'Goal',autonomy:3,sessionId:'missing'})).toThrow('session_unavailable');
 expect(core.prepareGoal).toHaveBeenCalledTimes(1);
 for(const command of [{operation:'list',root:f.b},{operation:'switch',projectId:'missing',force:true},Object.defineProperty({operation:'switch'},'projectId',{get(){throw Error('getter')},enumerable:true})])await expect(ipc.invoke('cue:projects',command)).rejects.toThrow();
 expect(()=>ipc.invoke('cue:user-sessions',{operation:'read',sessionId:session.sessionId,limit:21,cursor:null})).toThrow();
 for(const query of ['',' '+ 'Goal','x'.repeat(101),{toString(){throw Error('getter')}}])expect(()=>ipc.invoke('cue:user-sessions',{operation:'search',limit:20,cursor:null,archived:false,query})).toThrow();
 const forged=registerIpcHandlers({handle(){}},core as any,{sessionManagement:{listSessions:()=>({...m.listSessions({limit:20,cursor:null,archived:false}),authority:'execution'})} as any});
 expect(()=>forged.invoke('cue:user-sessions',{operation:'list',limit:20,cursor:null,archived:false})).toThrow('response');
 const forgedRename=registerIpcHandlers({handle(){}},core as any,{sessionManagement:{...m,renameSession:()=>({sessionId:session.sessionId,title:'새 제목',authority:'execution'})} as any});
 expect(()=>forgedRename.invoke('cue:user-sessions',{operation:'rename',sessionId:session.sessionId,expectedTitle:'새 제목',title:'다른 제목'})).toThrow('response');
});
test('atomic config activation requires expected version and keeps previous bytes on denial',()=>{
 const f=fixture(),data=join(f.base,'data'),config=initializeConfig(data,{worktreeRoot:f.a}),path=join(data,'cue-config.json'),prior=readFileSync(path,'utf8');
 expect(()=>activateProjectConfig(data,{...config,worktreeRoot:f.b},f.b)).toThrow('project_config_changed');expect(readFileSync(path,'utf8')).toBe(prior);
 activateProjectConfig(data,config,f.b);expect(JSON.parse(readFileSync(path,'utf8')).worktreeRoot).toBe(f.b);
 expect(()=>activateProjectConfig(data,config,f.a)).toThrow('project_config_changed');
 expect(JSON.parse(readFileSync(path,'utf8')).worktreeRoot).toBe(f.b);
});
test('switch coordinator denies active work, checks again after confirmation, and never writes config after failed close',async()=>{
 const f=fixture(),events:string[]=[],ready=vi.fn<()=>{ready:boolean;reason:string|null}>(()=>({ready:false,reason:'current-run-or-approval'}));
 const core={projectSwitchReadiness:ready,close:vi.fn(async()=>{events.push('close')})},catalog={target:()=>({root:f.b})};
 const coordinator=createProjectSwitchCoordinator({core,catalog,confirm:async()=>{events.push('confirm');return true},assertCurrent:()=>{},pendingRequests:()=>1,
   persist:()=>events.push('persist'),restart:()=>events.push('restart'),onFatal:()=>events.push('fatal')});
 await expect(coordinator.switchProject('target')).rejects.toThrow('current-run-or-approval');expect(events).toEqual([]);expect(coordinator.state).toBe('idle');
 ready.mockReturnValueOnce({ready:true,reason:null}).mockReturnValueOnce({ready:false,reason:'ownership-unresolved'});
 await expect(coordinator.switchProject('target')).rejects.toThrow('ownership-unresolved');expect(events).toEqual(['confirm']);
 ready.mockReturnValue({ready:true,reason:null});core.close.mockRejectedValueOnce(Error('cleanup unknown'));
 await expect(coordinator.switchProject('target')).rejects.toThrow('cleanup unknown');expect(events).toEqual(['confirm','confirm','fatal']);expect(coordinator.state).toBe('failed');
 await expect(coordinator.switchProject('target')).rejects.toThrow('busy');
});
test('switch coordinator denies another in-flight IPC operation without touching Core',async()=>{
 const events:string[]=[],coordinator=createProjectSwitchCoordinator({core:{projectSwitchReadiness:()=>({ready:true,reason:null}),close:async()=>{events.push('close')}},catalog:{target:()=>({root:'target'})},
   confirm:async()=>{events.push('confirm');return true},assertCurrent:()=>{},pendingRequests:()=>2,persist:()=>events.push('persist'),restart:()=>events.push('restart'),onFatal:()=>events.push('fatal')});
 await expect(coordinator.switchProject('target')).rejects.toThrow('pending-request');expect(coordinator.state).toBe('idle');expect(events).toEqual([]);
});
test('switch coordinator orders close, config persistence and relaunch and blocks concurrent requests',async()=>{
 const events:string[]=[],core={projectSwitchReadiness:()=>({ready:true,reason:null}),close:async()=>{events.push('close')}};
 const coordinator=createProjectSwitchCoordinator({core,catalog:{target:()=>({root:'target'})},confirm:async()=>{events.push('confirm');return true},assertCurrent:()=>{},pendingRequests:()=>1,
   persist:()=>events.push('persist'),restart:()=>events.push('restart'),onFatal:()=>events.push('fatal')});
 await coordinator.switchProject('target');expect(events).toEqual(['confirm','close','persist','restart']);expect(coordinator.state).toBe('restarting');
 await expect(coordinator.switchProject('target')).rejects.toThrow('busy');
});
test('post-close project reentry scopes Core and session reads to the newly active root',async()=>{
 const f=fixture(),data=join(f.base,'state'),config=initializeConfig(data,{worktreeRoot:f.a});let core=createCueCore(config);
 try{
   const m=createWorkspaceManagement(core.daemon.db,f.a),s=m.createSession();
   run(core.daemon.db,'a',f.a,'A only');m.attachRun({sessionId:s.sessionId,runId:'run-a'});
   m.register(f.b);await core.close();activateProjectConfig(data,config,f.b);
   const next=initializeConfig(data);expect(next.worktreeRoot).toBe(f.b);
   core=createCueCore(next);
   expect(()=>core.readWorkspaceSession({runId:'run-a'})).toThrow('unavailable');
   const second=createWorkspaceManagement(core.daemon.db,f.b);
   expect(()=>second.readSession({sessionId:s.sessionId})).toThrow('unavailable');
   expect(second.projects().records.find(p=>p.root===f.b)?.current).toBe(true);
 }finally{await core.close();}
});
test('Core refuses project switching while approval is prepared or ownership is held',async()=>{
 const f=fixture(),data=join(f.base,'state'),config=initializeConfig(data,{worktreeRoot:f.a}),core=createCueCore(config);
 try{
   expect(core.projectSwitchReadiness()).toEqual({ready:true,reason:null});
   core.prepareGoal('작업 목표',3);expect(core.projectSwitchReadiness()).toEqual({ready:false,reason:'current-run-or-approval'});
 }finally{await core.close();}
});
test('switch coordinator denies a target with a persisted approval before confirmation',async()=>{
 const f=fixture(),data=join(f.base,'state'),config=initializeConfig(data,{worktreeRoot:f.a}),core=createCueCore(config);
 try{
   run(core.daemon.db,'target-pending',f.b,'대상 승인 대기');
   const confirm=vi.fn(async()=>true),coordinator=createProjectSwitchCoordinator({core,catalog:{target:()=>({root:f.b})},confirm,
     assertCurrent:()=>{},pendingRequests:()=>1,persist:vi.fn(),restart:vi.fn(),onFatal:vi.fn()});
   await expect(coordinator.switchProject('target')).rejects.toThrow('project_switch_denied:current-run-or-approval');
   expect(confirm).not.toHaveBeenCalled();
 }finally{await core.close();}
});
test('switch confirmation race rejects newly prepared work without close or persistence',async()=>{
 const f=fixture(),data=join(f.base,'state'),config=initializeConfig(data,{worktreeRoot:f.a}),core=createCueCore(config);
 try{
   const persist=vi.fn(),restart=vi.fn();
   const coordinator=createProjectSwitchCoordinator({core,catalog:{target:()=>({root:f.b})},
     confirm:async()=>{run(core.daemon.db,'raced',f.b,'확인 중 생성');return true;},
     assertCurrent:()=>{},pendingRequests:()=>1,persist,restart,onFatal:vi.fn()});
   const prior=readFileSync(join(data,'cue-config.json'),'utf8');
   await expect(coordinator.switchProject('target')).rejects.toThrow('current-run-or-approval');
   expect(readFileSync(join(data,'cue-config.json'),'utf8')).toBe(prior);
   expect(core.daemon.db.prepare("SELECT state FROM task WHERE id='task-raced'").get()).toEqual({state:'awaiting_approval'});
   expect(core.daemon.status).toBe('ready');expect(persist).not.toHaveBeenCalled();expect(restart).not.toHaveBeenCalled();
 }finally{await core.close();}
});

test('reopened Core reconciles prior approvals in every project without circular switch lock',async()=>{
 const f=fixture(),data=join(f.base,'state'),config=initializeConfig(data,{worktreeRoot:f.a});
 const first=createCueCore(config);
 run(first.daemon.db,'persisted',f.a,'승인 대기');run(first.daemon.db,'target',f.b,'대상 승인 대기');
 await first.close();
 const reopened=createCueCore(config);
 try{
   expect(reopened.daemon.db.prepare("SELECT id,state,blocked_reason FROM task WHERE id IN ('task-persisted','task-target') ORDER BY id").all())
     .toEqual([{id:'task-persisted',state:'blocked',blocked_reason:'needs_reapproval'},{id:'task-target',state:'blocked',blocked_reason:'needs_reapproval'}]);
   expect(reopened.projectSwitchReadiness(f.b)).toEqual({ready:true,reason:null});
   expect(()=>reopened.approve('run-persisted')).toThrow('unknown run');
 }finally{await reopened.close();}
});
test('approval and execution atomically reject duplicate, stale epoch and foreign project without events',async()=>{
 const f=fixture(),data=join(f.base,'state'),config=initializeConfig(data,{worktreeRoot:f.a}),launchHost=vi.fn(),core=createCueCore(config,undefined,{launchHost});
 try{
   const prepared=core.prepareGoal('새 작업',3);const db=core.daemon.db;
   db.prepare("UPDATE run_session_epoch SET session_epoch='old' WHERE run_id=?").run(prepared.runId);
   expect(()=>core.approve(prepared.runId)).toThrow('approval_session_unavailable');
   expect(db.prepare('SELECT count(*) n FROM approval_event WHERE run_id=?').get(prepared.runId)).toEqual({n:0});
   db.prepare('UPDATE run_session_epoch SET session_epoch=? WHERE run_id=?').run(core.daemon.sessionEpoch,prepared.runId);
   expect(core.approve(prepared.runId).approved).toBe(true);
   expect(()=>core.approve(prepared.runId)).toThrow('approval_session_unavailable');
   expect(db.prepare('SELECT count(*) n FROM approval_event WHERE run_id=?').get(prepared.runId)).toEqual({n:1});
   db.prepare("UPDATE run_session_epoch SET session_epoch='old' WHERE run_id=?").run(prepared.runId);
   expect(()=>core.execute(prepared.runId)).toThrow('approval_session_unavailable');
   expect(db.prepare('SELECT count(*) n FROM execution_event WHERE run_id=?').get(prepared.runId)).toEqual({n:0});
   db.prepare('UPDATE run_session_epoch SET session_epoch=? WHERE run_id=?').run(core.daemon.sessionEpoch,prepared.runId);
   db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('foreign-envelope',f.b,'[]',new Date().toISOString());
   db.prepare('UPDATE run SET envelope_hash=? WHERE id=?').run('foreign-envelope',prepared.runId);
   expect(()=>core.execute(prepared.runId)).toThrow('approval_session_unavailable');
   expect(db.prepare('SELECT count(*) n FROM execution_event WHERE run_id=?').get(prepared.runId)).toEqual({n:0});
   expect(launchHost).not.toHaveBeenCalled();
 }finally{await core.close();}
});

