import {afterEach,expect,test,vi} from 'vitest';
import {mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {JSDOM} from 'jsdom';
import {openLedger} from '../src/ledger.js';
import {createWorkspaceSessionReader} from '../../app/workspace-sessions.mjs';
import {registerIpcHandlers} from '../../app/ipc.mjs';
import {createCueCore,initializeConfig} from '../../app/core.mjs';
import {createWorkspaceManagement} from '../../app/workspace-management.mjs';
const ledgers:ReturnType<typeof openLedger>[]=[],windows:JSDOM[]=[];
afterEach(()=>{for(const w of windows.splice(0))w.window.close();for(const d of ledgers.splice(0))d.close();vi.restoreAllMocks();});
function fixture(){
 const db=openLedger(':memory:');ledgers.push(db);const root='C:\\Cue\\alpha',other='C:\\Cue\\beta';
 for(const [id,path,goal,state] of [['one',root,'첫 작업 <script>','completed'],['two',root,'두 번째 목표','blocked'],['foreign',other,'다른 프로젝트의 비밀','running']] as const){
   db.prepare('INSERT INTO task(id,state,created_at) VALUES(?,?,?)').run(`task-${id}`,state,'2026-09-23T00:00:00Z');
   db.prepare("INSERT INTO envelope VALUES(?,?,'[]',?)").run(`envelope-${id}`,path,'2026-09-23T00:00:00Z');
   db.prepare('INSERT INTO run(id,task_id,envelope_hash,started_at) VALUES(?,?,?,?)').run(`run-${id}`,`task-${id}`,`envelope-${id}`,'2026-09-23T00:00:00Z');
   db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run(`task-${id}`,`run-${id}`,'goal',goal,'2026-09-23T00:00:00Z');
 }
 return {db,reader:createWorkspaceSessionReader(db,root)};
}
test('read-only workspace list and detail stay scoped, bounded and do not grant execution',()=>{
 const {db,reader}=fixture(),first=reader.list({limit:1,cursor:null});
 expect(first).toMatchObject({authority:'historical-ledger-index-only',complete:false,records:[{runId:'run-two',state:'blocked'}]});
 const second=reader.list({limit:1,cursor:first.nextCursor});expect(second.records.map(r=>r.runId)).toEqual(['run-one']);expect(second.complete).toBe(true);
 expect(reader.read({runId:'run-one'})).toMatchObject({authority:'historical-ledger-read-only',session:{goal:'첫 작업 <script>',state:'completed'},limitation:'stored-run-only-no-reconnect-or-execution-authority'});
 expect(()=>reader.read({runId:'run-foreign'})).toThrow('unavailable');
 expect(()=>reader.list({limit:1,cursor:(db.prepare("SELECT rowid FROM run WHERE id='run-foreign'").get() as {rowid:number}).rowid})).toThrow('cursor');
 expect(db.prepare('SELECT count(*) n FROM approval_event').get()).toEqual({n:0});
});
test('actual Core and IPC retain current-project history after SQLite reopen without execution',async()=>{
 const root=mkdtempSync(join(tmpdir(),'cue-workspace-shell-')),work=join(root,'work');mkdirSync(work);
 const config=initializeConfig(join(root,'data'),{worktreeRoot:work});
 let core=createCueCore(config);
 try{
   const db=core.daemon.db;
   db.prepare("INSERT INTO task VALUES('task-history','completed',NULL,'2026-09-23T00:00:00Z')").run();
   db.prepare("INSERT INTO envelope VALUES('envelope-history',?,'[]','2026-09-23T00:00:00Z')").run(config.worktreeRoot);
   db.prepare("INSERT INTO run VALUES('run-history','task-history','envelope-history',0,'2026-09-23T00:00:00Z')").run();
   db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES('task-history','run-history','goal','저장된 목표','2026-09-23T00:00:00Z')").run();
   const ipc=registerIpcHandlers({handle(){}},core);
   expect(ipc.invoke('cue:workspace-sessions',{operation:'list',limit:20,cursor:null}).records[0].runId).toBe('run-history');
   await core.close();core=createCueCore(config);
   expect(registerIpcHandlers({handle(){}},core).invoke('cue:workspace-sessions',{operation:'read',runId:'run-history'}).session.goal).toBe('저장된 목표');
 }finally{await core.close();rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
});
test('workspace IPC rejects hostile commands and foreign runs and projects bounded history only',()=>{
 const {reader}=fixture();const handlers=registerIpcHandlers({handle(){}},{listWorkspaceSessions:reader.list,readWorkspaceSession:reader.read} as any);
 const list=handlers.invoke('cue:workspace-sessions',{operation:'list',limit:20,cursor:null});expect(list.records).toHaveLength(2);
 expect(handlers.invoke('cue:workspace-sessions',{operation:'read',runId:'run-one'}).session.goal).toBe('첫 작업 <script>');
 for(const input of [{operation:'list',limit:21,cursor:null},{operation:'read',runId:'run-foreign'},{operation:'list',limit:20,cursor:null,execute:true},Object.defineProperty({operation:'read'},'runId',{get(){throw Error('getter called')},enumerable:true})])expect(()=>handlers.invoke('cue:workspace-sessions',input)).toThrow();
 const forged=registerIpcHandlers({handle(){}},{listWorkspaceSessions:()=>({...list,authority:'execution-authorized'})} as any);
 expect(()=>forged.invoke('cue:workspace-sessions',{operation:'list',limit:20,cursor:null})).toThrow();
});
test('Cue session UI opens durable multi-run history and starts a new scoped goal without resuming a provider',async()=>{
 const root=mkdtempSync(join(tmpdir(),'cue-session-ui-')),work=join(root,'work'),other=join(root,'other');mkdirSync(work);mkdirSync(other);
 const db=openLedger(':memory:');ledgers.push(db);
 try{
   const manager=createWorkspaceManagement(db,work),session=manager.createSession();
   db.prepare("INSERT INTO task(id,state,created_at) VALUES('task-old','completed','2026-09-23T00:00:00Z')").run();
   db.prepare("INSERT INTO envelope VALUES('env-old',?,'[]','2026-09-23T00:00:00Z')").run(work);
   db.prepare("INSERT INTO run(id,task_id,envelope_hash,started_at) VALUES('run-old','task-old','env-old','2026-09-23T00:00:00Z')").run();
   db.prepare("INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES('task-old','run-old','goal','기존 목표','2026-09-23T00:00:00Z')").run();
   db.prepare("UPDATE task SET state='awaiting_approval' WHERE id='task-old'").run();manager.attachRun({sessionId:session.sessionId,runId:'run-old'});db.prepare("UPDATE task SET state='completed' WHERE id='task-old'").run();
   const reader=createWorkspaceSessionReader(db,work),dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'});windows.push(dom);
   let prep=0,executions=0,switches=0;
   Object.assign(dom.window,{cue:{workspaceSessions:({operation,limit,cursor,runId}:any)=>operation==='list'?reader.list({limit,cursor}):reader.read({runId}),
     userSessions:({operation,limit,cursor,archived,sessionId,query,expectedTitle,title}:any)=>operation==='list'?manager.listSessions({limit,cursor,archived}):operation==='search'?manager.searchSessions({limit,cursor,archived,query}):operation==='read'?manager.readSession({sessionId,limit,cursor}):operation==='create'?manager.createSession():operation==='rename'?manager.renameSession({sessionId,expectedTitle,title}):manager.archiveSession(sessionId),
     projects:({operation,projectId}:any)=>operation==='list'?manager.projects():operation==='switch'?(switches++,{status:'restarting'}):manager.register(other),
     prepare:(input:any)=>{prep++;expect(input.sessionId).toBe(session.sessionId);return{runId:'run-new',taskId:'task-new',threeLines:['무엇을: 새 목표','어디까지: 승인 폴더','안 건드릴 것: 밖'],envelope:{expires_at:'2026-09-24T00:00:00Z',egress:[],allowed_actions:['file_change'],worktree_realpath:work},orchestration:null}},
     execute:()=>{executions++;throw Error('no execution')}}});
   dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));const doc=dom.window.document;
   await vi.waitFor(()=>expect(doc.querySelectorAll('#workspace-conversation-list button')).toHaveLength(1));
   const search=doc.querySelector('#workspace-conversation-query') as HTMLInputElement;search.value='없는 목표';
   doc.querySelector('#workspace-conversation-search-form')?.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
   await vi.waitFor(()=>expect(doc.querySelectorAll('#workspace-conversation-list button')).toHaveLength(0));
   search.value='기존 목표';doc.querySelector('#workspace-conversation-search-form')?.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
   await vi.waitFor(()=>expect(doc.querySelectorAll('#workspace-conversation-list button')).toHaveLength(1));
   (doc.querySelector('#workspace-conversation-list button') as HTMLButtonElement).click();
   await vi.waitFor(()=>expect(doc.querySelector('#workspace-conversation-runs')?.textContent).toContain('기존 목표'));
   expect(doc.activeElement?.id).toBe('workspace-conversation-title');
   const name=doc.querySelector('#workspace-conversation-name') as HTMLInputElement;
   expect(name.labels?.[0].textContent).toContain('세션 이름');name.value='<script>새 이름</script>';
   doc.querySelector('#workspace-conversation-rename-form')?.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
   await vi.waitFor(()=>expect(doc.querySelector('#workspace-conversation-title')?.textContent).toBe('<script>새 이름</script>'));
   expect(doc.querySelector('#workspace-conversation-detail script')).toBeNull();
   expect(manager.readSession({sessionId:session.sessionId}).title).toBe('<script>새 이름</script>');
   expect(doc.querySelector('#workspace-skip')?.getAttribute('href')).toBe('#workspace-history');
   expect([...doc.querySelectorAll('main')].filter(node=>!(node as HTMLElement).hidden)).toHaveLength(1);
   expect((doc.querySelector('#goal') as HTMLTextAreaElement).labels?.[0].textContent).toContain('작업 목표');
   expect([...doc.querySelectorAll('input[name="autonomy"]')].map(node=>node.getAttribute('aria-label'))).toEqual(['자율성 1','자율성 2','자율성 3']);
   expect(prep).toBe(0);expect(executions).toBe(0);
   (doc.querySelector('#workspace-conversation-continue') as HTMLButtonElement).click();
   expect((doc.querySelector('#workspace-work') as HTMLElement).hidden).toBe(false);
   expect(doc.activeElement?.id).toBe('goal');
   expect([...doc.querySelectorAll('main')].filter(node=>!(node as HTMLElement).hidden)).toHaveLength(1);
   const goal=doc.querySelector('#goal') as HTMLTextAreaElement;goal.value='새 목표';doc.querySelector('#goal-form')?.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
   await vi.waitFor(()=>expect(prep).toBe(1));expect(executions).toBe(0);
   await vi.waitFor(()=>expect((doc.querySelector('#approve') as HTMLButtonElement).disabled).toBe(false));
   expect(doc.querySelector('#workspace-active-session')?.textContent).toContain('<script>새 이름</script>');
 }finally{rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
});
test('desktop navigation opens a historical session without executing, and advanced panels are separate',async()=>{
 const {reader}=fixture();let executionCalls=0;
 const dom=new JSDOM(readFileSync(resolve('../app/renderer/index.html'),'utf8'),{runScripts:'outside-only'});windows.push(dom);
 Object.assign(dom.window,{cue:{workspaceSessions:({operation,limit,cursor,runId}:any)=>operation==='list'?reader.list({limit,cursor}):reader.read({runId}),execute:()=>{executionCalls++;throw Error('no execution');},
   prepare:()=>({runId:'run-pending',taskId:'task-pending',threeLines:['무엇을: 새 목표','어디까지: 승인 폴더','안 건드릴 것: 밖'],
     envelope:{expires_at:'2026-09-24T00:00:00Z',egress:[],allowed_actions:['file_change'],worktree_realpath:'C:\\Cue\\alpha'},orchestration:null})}});
 dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'),'utf8'));
 const doc=dom.window.document;
 await vi.waitFor(()=>expect(doc.querySelectorAll('#workspace-session-list button')).toHaveLength(2));
 expect(doc.querySelector('#workspace-project')?.textContent).toContain('alpha');
 expect(doc.querySelector('#native-recovery')?.parentElement?.id).toBe('workspace-tools');
 expect(doc.querySelector('#evaluation-panel')?.parentElement?.id).toBe('workspace-evaluation');
 (doc.querySelector('#workspace-session-list button') as HTMLButtonElement).click();
 await vi.waitFor(()=>expect(doc.querySelector('#workspace-session-detail')?.textContent).toContain('두 번째 목표'));
 expect(doc.querySelector('#workspace-work')?.hasAttribute('hidden')).toBe(true);
 expect(doc.querySelector('#workspace-skip')?.getAttribute('href')).toBe('#workspace-history');
 expect(executionCalls).toBe(0);
 (doc.querySelectorAll('#workspace-session-list button')[1] as HTMLButtonElement).click();
 await vi.waitFor(()=>expect(doc.querySelector('#workspace-session-detail')?.textContent).toContain('첫 작업 <script>'));
 expect(doc.querySelector('#workspace-session-detail')?.querySelector('script')).toBeNull();
 (doc.querySelector('#workspace-new-session') as HTMLButtonElement).click();
 expect(doc.querySelector('#workspace-work')?.hasAttribute('hidden')).toBe(false);
 const goal=doc.querySelector('#goal') as HTMLTextAreaElement;expect(goal.value).toBe('');
 goal.value='새 목표';doc.querySelector('#goal-form')?.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
 await vi.waitFor(()=>expect((doc.querySelector('#approve') as HTMLButtonElement).disabled).toBe(false));
 (doc.querySelector('#workspace-new-session') as HTMLButtonElement).click();
 expect(goal.value).toBe('새 목표');expect((doc.querySelector('#approve') as HTMLButtonElement).disabled).toBe(false);
 expect(executionCalls).toBe(0);
});
