import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { openLedger } from '../src/ledger.js';
import { createBearerFile, createIpcServer, IPC_HOST, listenLoopback } from '../src/ipc.js';
import { applyTokenLimit, taskStates, tokenUsageFromAppServer, tokenUsageFromExec } from '../src/state-machine.js';
import { failedComponents, healthVector } from '../src/health.js';
import { heartbeatAgeMs, readHeartbeat } from '../src/heartbeat.js';
import { evaluateSentinel, SENTINEL_ALERT } from '../src/sentinel.js';
import { reconcileInterruptedWrites } from '../src/recovery.js';
import { assertVendorBinary, CLEAN_CONFIG, createCleanCodexHome, vendorCodexLaunchSpec } from '../src/tool-home.js';
import { spawnVendorCodexInAppContainer } from '../src/codex-session.js';

const temporary: string[] = [];
const testStateRoot = resolve('.test-state');
const temp = (): string => { mkdirSync(testStateRoot,{recursive:true}); const path = mkdtempSync(join(testStateRoot, 'cue-p2-')); temporary.push(path); return path; };
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path,{recursive:true,force:true}); });
const now = '2026-09-02T00:00:00.000Z';

function seed(db: ReturnType<typeof openLedger>, worktree = 'C:/work'): void {
  db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('t1','running',null,now);
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run('eh1',worktree,'[]',now);
  db.prepare('INSERT INTO run VALUES(?,?,?,?,?)').run('r1','t1','eh1',0,now);
}

describe('P2-1 SQLite ledger', () => {
  it('migrates an empty database and inserts and reads every table', () => {
    const db = openLedger(); seed(db);
    db.prepare('INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES(?,?,?,?,?,?,?,?)').run('r1','eh1','th1','it1',null,1,'decline',now);
    db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run('h1',123,now,'C:/work','t1','r1');
    db.prepare('INSERT INTO artifact(task_id,run_id,kind,content,created_at) VALUES(?,?,?,?,?)').run('t1','r1','log','x',now);
    db.prepare('INSERT INTO annotation(task_id,body,created_at) VALUES(?,?,?)').run('t1','note',now);
    db.prepare('INSERT INTO recovery_attempt(run_id,outcome,created_at) VALUES(?,?,?)').run('r1','none',now);
    db.prepare('INSERT INTO verification(run_id,check_name,verdict,evidence,created_at) VALUES(?,?,?,?,?)').run('r1','check','PASS','ok',now);
    for (const table of ['task','run','envelope','approval_event','session_handle','artifact','annotation','recovery_attempt','verification']) {
      expect((db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as {n:number}).n).toBe(1);
    }
    db.close();
  });
  it('rejects every envelope update', () => {
    const db = openLedger(); seed(db);
    expect(() => db.prepare("UPDATE envelope SET egress_json='[1]' WHERE envelope_hash='eh1'").run()).toThrow(/immutable/);
    db.close();
  });
  it('prevents replay even when approval id is null', () => {
    const db = openLedger(); seed(db);
    const insert = db.prepare('INSERT INTO approval_event(run_id,envelope_hash,thread_id,item_id,approval_id,request_ordinal,decision,created_at) VALUES(?,?,?,?,?,?,?,?)');
    insert.run('r1','eh1','th1','it1',null,1,'decline',now);
    expect(() => insert.run('r1','eh1','th1','it1',null,1,'decline',now)).toThrow(/UNIQUE/);
    expect(() => insert.run('r1','eh1','th1','it1',null,2,'decline',now)).not.toThrow();
    db.close();
  });
});

async function call(port: number, token: string | undefined, method: string, path: string, body?: string): Promise<{status:number; body:string}> {
  return await new Promise((resolvePromise, reject) => {
    const req = request({ host: IPC_HOST, port, method, path, headers: token ? { authorization: `Bearer ${token}` } : {} }, res => {
      let data=''; res.on('data', c => data += String(c)); res.on('end', () => resolvePromise({status:res.statusCode ?? 0, body:data}));
    }); req.on('error', reject); if (body) req.write(body); req.end();
  });
}

describe('P2-2 IPC', () => {
  it('uses a protected 256-bit token, rejects missing auth and bad schemas, and binds loopback', async () => {
    const tokenPath = join(temp(),'state','ipc.token'); const token = createBearerFile(tokenPath);
    expect(Buffer.from(token,'hex')).toHaveLength(32);
    if (process.platform !== 'win32') expect(statSync(tokenPath).mode & 0o777).toBe(0o600);
    else expect(execFileSync('icacls',[tokenPath],{encoding:'utf8'})).not.toContain('(I)');
    const server = createIpcServer(token, () => ({orca:true,codex_app_server:false,daemon:true,sentinel:true}));
    const port = await listenLoopback(server); const address = server.address();
    expect(typeof address === 'object' && address?.address).toBe(IPC_HOST);
    expect((await call(port,undefined,'GET','/health')).status).toBe(401);
    expect((await call(port,token,'POST','/echo','{}')).status).toBe(400);
    const health=await call(port,token,'GET','/health'); expect(health.status).toBe(200);
    expect(failedComponents(JSON.parse(health.body))).toEqual(['codex_app_server']);
    server.close(); await once(server,'close');
  });
});

describe('P2-3 state and token accounting', () => {
  it('has six states and blocks budget only at a token threshold from the two allowed event shapes', () => {
    expect(taskStates).toHaveLength(6);
    const app = tokenUsageFromAppServer({method:'thread/tokenUsage/updated',params:{tokenUsage:{last:{inputTokens:6,outputTokens:4,totalTokens:10}}}});
    const cli = tokenUsageFromExec({type:'turn.completed',usage:{input_tokens:3,output_tokens:2,total_tokens:5}});
    expect(applyTokenLimit({state:'running'},app,10)).toEqual({state:'blocked',reason:'budget'});
    expect(applyTokenLimit({state:'running'},cli,10)).toEqual({state:'running'});
    expect(() => tokenUsageFromExec({type:'orca',usage:{total_tokens:99}})).toThrow(/unsupported/);
  });
  it('contains no monetary conversion or display path in source', () => {
    const result = spawnSync('grep',['-riE',String.raw`usd|dollar|price|\$[0-9]`,'src'],{cwd:resolve('.'),encoding:'utf8'});
    expect(result.status).toBe(1); expect(result.stdout).toBe('');
  });
});

describe('P2-4 process identity and heartbeat', () => {
  it('stops refreshing after the identified process is killed so age grows', async () => {
    const path=join(temp(),'state','heartbeat.json'); const start=new Date().toISOString();
    const child=spawn(process.execPath,[resolve('dist/src/heartbeat-worker.js'),path,start],{stdio:'ignore'});
    for(let i=0;i<50&&!existsSync(path);i++) await new Promise(r=>setTimeout(r,10));
    expect(readHeartbeat(path)).toMatchObject({pid:child.pid,start_time:start});
    child.kill(); await once(child,'exit'); const age1=heartbeatAgeMs(path); await new Promise(r=>setTimeout(r,80)); const age2=heartbeatAgeMs(path);
    expect(age2).toBeGreaterThan(age1+50);
  });
});

describe('P2-5 named health vector', () => {
  it('names the failed component', () => {
    const vector=healthVector({orca:true,codex_app_server:false,daemon:true,sentinel:true});
    expect(failedComponents(vector)).toEqual(['codex_app_server']); expect(vector.codex_app_server.name).toBe('codex_app_server');
  });
});

describe('P2-6 sentinel', () => {
  it('is silent when only heartbeat is expired', () => expect(evaluateSentinel({heartbeatExpired:true,connectionFailed:false,relayAvailable:true,deadMarkerPath:join(temp(),'cue.dead')})).toBeUndefined());
  it('is silent when only connection fails', () => expect(evaluateSentinel({heartbeatExpired:false,connectionFailed:true,relayAvailable:true,deadMarkerPath:join(temp(),'cue.dead')})).toBeUndefined());
  it('emits the exact fixture from a separate process and creates a marker when relay is blocked', () => {
    const marker=join(temp(),'cue.dead'); const result=evaluateSentinel({heartbeatExpired:true,connectionFailed:true,relayAvailable:false,deadMarkerPath:marker});
    expect(result).toBe(SENTINEL_ALERT); expect(readFileSync(marker,'utf8')).toBe('cue.dead\n');
    const input={heartbeatExpired:true,connectionFailed:true,relayAvailable:true,deadMarkerPath:marker};
    const child=spawnSync(process.execPath,[resolve('dist/src/sentinel.js'),JSON.stringify(input)],{encoding:'utf8'});
    const fixture=readFileSync(resolve('test/fixtures/sentinel-alert.txt'),'utf8');
    expect(child.status).toBe(0); expect(child.stdout).toBe(fixture); expect(child.stderr).toBe('');
  });
});

describe('P2-8 crash reconciliation', () => {
  it('blocks an interrupted task, captures actual git status, and records no automatic resume', () => {
    const worktree=temp(); execFileSync('git',['init','--quiet'],{cwd:worktree}); writeFileSync(join(worktree,'file.ts'),'changed');
    const db=openLedger(); seed(db,worktree); db.prepare('UPDATE run SET write_in_progress=1 WHERE id=?').run('r1');
    expect(reconcileInterruptedWrites(db,worktree)).toBe(1);
    expect(db.prepare('SELECT state,blocked_reason FROM task').get()).toEqual({state:'blocked',blocked_reason:'crash'});
    expect((db.prepare("SELECT content FROM artifact WHERE kind='git_status'").get() as {content:string}).content).toContain('file.ts');
    expect(db.prepare('SELECT outcome FROM recovery_attempt').get()).toEqual({outcome:'blocked_no_auto_resume'}); db.close();
  });
});

describe('P2-9 clean tool home', () => {
  it('creates only copied auth and Cue config with all extension surfaces disabled', () => {
    const root=temp(), auth=join(root,'source-auth.json'); writeFileSync(auth,'credential-placeholder');
    const home=createCleanCodexHome(join(root,'homes'),auth);
    expect(readFileSync(join(home,'auth.json'),'utf8')).toBe('credential-placeholder');
    expect(readFileSync(join(home,'config.toml'),'utf8')).toBe(CLEAN_CONFIG);
    expect(existsSync(join(home,'hooks.json'))).toBe(false);
  });
  it('disables parent-side browser, app, plugin, update, and web-search capabilities explicitly', () => {
    expect(CLEAN_CONFIG).toContain('web_search = "disabled"');
    for(const feature of [
      'apps','auth_elicitation','browser_use','browser_use_external','browser_use_full_cdp_access',
      'code_mode_host','computer_use','image_generation','in_app_browser','in_app_local_automation',
      'in_app_updates','multi_agent','plugin_sharing','plugins','remote_plugin',
      'skill_mcp_dependency_install','skill_search','tool_call_mcp_elicitation','tool_suggest',
    ]) expect(CLEAN_CONFIG).toContain(`${feature} = false`);
  });
  it('accepts only an absolute vendor binary path, never an npm shim', () => {
    const vendor=process.platform==='win32'?'C:\\Program Files\\Codex\\vendor\\codex.exe':'/opt/codex/vendor/codex';
    expect(assertVendorBinary(vendor)).toBe(vendor); expect(()=>assertVendorBinary('codex')).toThrow(); expect(()=>assertVendorBinary(resolve('node_modules/.bin/codex'))).toThrow();
  });
  it('redirects every writable profile and temp variable into the isolated home', () => {
    const root=temp(), home=join(root,'home'), vendor=process.platform==='win32'?'C:\\Program Files\\Codex\\vendor\\codex.exe':'/opt/codex/vendor/codex';
    mkdirSync(home);
    const spec=vendorCodexLaunchSpec(vendor,['--version'],home);
    expect(spec.env).toMatchObject({
      CODEX_HOME:home,
      HOME:home,
      USERPROFILE:home,
      APPDATA:join(home,'appdata'),
      LOCALAPPDATA:join(home,'localappdata'),
      TEMP:join(home,'tmp'),
      TMP:join(home,'tmp'),
    });
    for(const path of [spec.env.APPDATA,spec.env.LOCALAPPDATA,spec.env.TEMP,spec.env.TMP]) expect(existsSync(path!)).toBe(true);
  });
  it('launches the absolute vendor binary with the isolated tool home', async () => {
    const root=temp(), vendorDir=join(temp(),'vendor'); mkdirSync(vendorDir); const binary=join(vendorDir,process.platform==='win32'?'codex.exe':'codex'); copyFileSync(process.execPath,binary);
    const auth=join(root,'source-auth.json'); writeFileSync(auth,'credential-placeholder'); const cleanHome=createCleanCodexHome(join(root,'homes'),auth);
    const db=openLedger(); seed(db); const marker=join(root,'home-marker.txt'); const {child}=spawnVendorCodexInAppContainer(db,{cwd:root,task_id:'t1',run_id:'r1'},binary,cleanHome,['-e',`const f=require('fs'),h=process.env.CODEX_HOME||'';f.writeFileSync(${JSON.stringify(marker)},h+${JSON.stringify('\n')}+f.readdirSync(h).sort().join(','))`]);
    const [exitCode]=await once(child,'exit'); expect(exitCode).toBe(0); expect(readFileSync(marker,'utf8')).toBe(`${cleanHome}\nappdata,auth.json,config.toml,localappdata,tmp`);
    db.close();
  });
  it('closes the launcher stdin for non-interactive vendor execution', async () => {
    const root=temp(), vendorDir=join(temp(),'vendor'); mkdirSync(vendorDir); const binary=join(vendorDir,process.platform==='win32'?'codex.exe':'codex'); copyFileSync(process.execPath,binary);
    const auth=join(root,'source-auth.json'); writeFileSync(auth,'credential-placeholder'); const cleanHome=createCleanCodexHome(join(root,'homes'),auth);
    const db=openLedger(); seed(db); const {child}=spawnVendorCodexInAppContainer(db,{cwd:root,task_id:'t1',run_id:'r1'},binary,cleanHome,['-e','process.exit(0)']);
    const stdinEnded=child.stdin?.writableEnded; const [exitCode]=await once(child,'exit'); db.close();
    expect(exitCode).toBe(0); expect(stdinEnded).toBe(true);
  });
  it('removes the isolated tool home after the vendor worker exits', async () => {
    const root=temp(), vendorDir=join(temp(),'vendor'); mkdirSync(vendorDir); const binary=join(vendorDir,process.platform==='win32'?'codex.exe':'codex'); copyFileSync(process.execPath,binary);
    const auth=join(root,'source-auth.json'); writeFileSync(auth,'credential-placeholder'); const cleanHome=createCleanCodexHome(join(root,'homes'),auth);
    const db=openLedger(); seed(db); const {child}=spawnVendorCodexInAppContainer(db,{cwd:root,task_id:'t1',run_id:'r1'},binary,cleanHome,['-e','process.exit(0)']);
    const [exitCode]=await once(child,'exit'); expect(exitCode).toBe(0); expect(existsSync(cleanHome)).toBe(false); db.close();
  });
});

describe('P2-7 scope', () => { it('documents design without creating a scheduled task', () => expect(existsSync(resolve('docs/P2-7_WINDOWS_TASK_DESIGN.md'))).toBe(true)); });
