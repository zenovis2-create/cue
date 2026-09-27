import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,expect,test,vi} from 'vitest';
import {openLedger} from '../src/ledger.js';
import {claudeConfigurationFixture} from './fixtures/claude-configuration.js';

const mocks=vi.hoisted(()=>({spawn:vi.fn(),assert:vi.fn()}));
vi.mock('node:child_process',async importOriginal=>({...await importOriginal<typeof import('node:child_process')>(),spawn:mocks.spawn}));
vi.mock('../../app/provider-installation.mjs',()=>({assertCurrentProviderInstallation:mocks.assert}));
import {createClaudeCliExecutor} from '../src/adapters/claude-cli-executor.js';

const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0)) rmSync(root,{recursive:true,force:true});});
test('real spawnOwned writes a SQLite session handle for the fake process',async()=>{
  const worktree=realpathSync.native(mkdtempSync(join(tmpdir(),'cue-claude-owned-'))); roots.push(worktree);
  const fixture=claudeConfigurationFixture();roots.push(fixture.root);
  const db=openLedger();
  const now='2026-09-19T00:00:00Z';
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task','running',null,now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('env-owned',worktree,'[]',now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('attempt-owned','task','env-owned',0,now);
  const child=Object.assign(new EventEmitter(),{pid:4747,stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough()});
  mocks.spawn.mockReturnValue(child);
  const context={runId:'attempt-owned',candidateId:'candidate',role:'implementation' as const,subjectDigest:'a'.repeat(64),accountIdentity:{reference:'subscription',digest:'b'.repeat(64)},signal:new AbortController().signal};
  const binding={owner:{run_id:context.runId,task_id:'task',cwd:worktree},envelope:{run_id:context.runId,worktree_realpath:worktree,egress:[],expires_at:'2099-01-01T00:00:00Z',autonomy_level:'bounded' as const,allowed_actions:['file_change']},candidateId:'candidate',subjectDigest:context.subjectDigest,accountIdentity:context.accountIdentity,model:'claude-sonnet-5',prompt:'edit'};
  const stop=vi.fn(async()=>{});
  const execution=await createClaudeCliExecutor({db,installation:fixture.installation,resolveLaunch:()=>binding,resolveAuthorizedConfig:fixture.resolver(),
    captureOwnedIdentity:session=>({pid:session.pid,createdAt:'native-created-at'}),stopOwnedTree:stop})(context);
  const row=db.prepare('SELECT handle,pid,task_id,run_id FROM session_handle WHERE handle=?').get(execution.session.handle);
  expect(row).toEqual({handle:execution.session.handle,pid:4747,task_id:'task',run_id:'attempt-owned'});
  expect(mocks.spawn).toHaveBeenCalledTimes(1);
  child.stdout.write(JSON.stringify({type:'system',subtype:'init',session_id:'session',uuid:'init',claude_code_version:'2.1.274',model:'claude-sonnet-5',cwd:worktree,tools:['Read','Edit'],mcp_servers:[]})+'\n');
  child.emit('close',1);
  expect(await execution.completion).toBe('failed');
  db.close();
});
