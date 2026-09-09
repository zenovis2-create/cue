import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import { createCleanCodexHome, safeCleanupCodexHome } from '../src/tool-home.js';

const roots: string[] = [];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function controllerScript(exitCode: number): string {
  const command = exitCode === 0
    ? "$p=[IO.Path]::Combine([Environment]::CurrentDirectory,'source-home-result.txt');[IO.File]::WriteAllText($p,'source-home-ok')"
    : `exit ${exitCode}`;
  const status = exitCode === 0 ? 'completed' : 'failed';
  const finalMessage = exitCode === 0
    ? "send({method:'item/completed',params:{threadId:'thread-source-home',turnId:'turn-source-home',item:{type:'agentMessage',text:'Created source-home-result.txt'}}});"
    : '';
  return String.raw`
const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);
if(m.method==='initialize')send({id:m.id,result:{}});
else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'thread-source-home'}}});
else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn-source-home'}}});send({id:300,method:'item/tool/call',params:{threadId:'thread-source-home',turnId:'turn-source-home',namespace:null,tool:'cue_workspace',arguments:{program:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command',${JSON.stringify(command)}],timeoutMs:30000},callId:'call-source-home'}});}
else if(m.id===300){${finalMessage}send({method:'turn/completed',params:{threadId:'thread-source-home',turn:{id:'turn-source-home',status:${JSON.stringify(status)}}}});setTimeout(()=>process.exit(0),10);}});`;
}

async function waitForTerminal(core: ReturnType<typeof createCueCore>, taskId: string) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const card = core.completion(taskId);
    if (card.state === 'blocked' || card.state === 'completed') return card;
    await delay(100);
  }
  throw new Error('terminal state timeout');
}

afterEach(async () => {
  await delay(200);
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

describe.skipIf(process.platform !== 'win32')('Phase 10-B source-home lifecycle', () => {
  it('rolls back a partially created home when credential staging fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p10b-home-rollback-')); roots.push(root);
    const homes = join(root, 'homes'); const invalidAuth = join(root, 'auth-directory');
    mkdirSync(homes); mkdirSync(invalidAuth);
    expect(() => createCleanCodexHome(homes, invalidAuth)).toThrow();
    expect(readdirSync(homes)).toEqual([]);
  });

  it('removes only disposable codex-home directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p10b-home-cleanup-')); roots.push(root);
    const disposable = join(root, 'codex-home-disposable'); const source = join(root, 'source-home');
    mkdirSync(disposable); mkdirSync(source);
    expect(() => safeCleanupCodexHome(source)).toThrow(/unsafe controller home cleanup refused/u);
    expect(existsSync(source)).toBe(true);
    safeCleanupCodexHome(disposable);
    expect(existsSync(disposable)).toBe(false);
  });

  it('stages a disposable controller home without granting or deleting the source Codex home', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p10b-source-home-')); roots.push(root);
    const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor);
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    writeFileSync(join(sourceHome, 'config.toml'), 'source-config-must-not-be-used');
    const server = join(worktree, 'source-home-controller.cjs'); writeFileSync(server, controllerScript(0));
    const config = initializeConfig(join(root, 'data'), { worktreeRoot: worktree });
    const daemon = new AppDaemon(config);
    const core = createCueCore(config, daemon, { binary, codexHome: sourceHome, controllerArgs: [server] });
    const prepared = core.prepareGoal('Create source-home-result.txt while exercising the split controller and worker boundary'); core.approve(prepared.runId); core.execute(prepared.runId);
    const card = await waitForTerminal(core, prepared.taskId);
    const roles = daemon.db.prepare('SELECT role,boundary FROM session_runtime ORDER BY rowid').all() as Array<{ role: string; boundary: string }>;
    const diagnostics = daemon.db.prepare('SELECT kind,content FROM artifact WHERE run_id=? ORDER BY rowid').all(prepared.runId);
    core.close();
    expect(card.state, JSON.stringify({ card, roles, diagnostics })).toBe('completed');
    expect(roles).toEqual([
      { role: 'controller', boundary: 'host-model-only' },
      { role: 'tool_worker', boundary: 'appcontainer-capability-zero' },
      { role: 'tool_worker', boundary: 'appcontainer-capability-zero' },
      { role: 'tool_worker', boundary: 'appcontainer-capability-zero' },
    ]);
    expect(readFileSync(join(worktree, 'source-home-result.txt'), 'utf8')).toBe('source-home-ok');
    expect(readFileSync(join(sourceHome, 'auth.json'), 'utf8')).toBe('credential-placeholder');
    expect(readFileSync(join(sourceHome, 'config.toml'), 'utf8')).toBe('source-config-must-not-be-used');
  }, 90_000);

  it('starts three real replacement controller/worker pairs before autonomy 3 escalates', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p10b-recovery-')); roots.push(root);
    const worktree = join(root, 'worktree'); const sourceHome = join(root, 'source-home'); const vendor = join(root, 'vendor');
    mkdirSync(worktree); mkdirSync(sourceHome); mkdirSync(vendor); writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
    const binary = join(vendor, 'codex.exe'); copyFileSync(process.execPath, binary);
    const server = join(worktree, 'recovery-controller.cjs'); writeFileSync(server, controllerScript(9));
    const config = initializeConfig(join(root, 'data'), { worktreeRoot: worktree });
    const daemon = new AppDaemon(config);
    const core = createCueCore(config, daemon, { binary, codexHome: sourceHome, controllerArgs: [server] });
    const prepared = core.prepareGoal('always fail so the recovery ladder runs', 3); core.approve(prepared.runId); core.execute(prepared.runId);
    const card = await waitForTerminal(core, prepared.taskId);
    const sessions = daemon.db.prepare('SELECT s.pid,s.start_time,r.role FROM session_handle s JOIN session_runtime r ON r.handle=s.handle WHERE s.run_id=? ORDER BY s.rowid').all(prepared.runId) as Array<{ pid:number; start_time:string; role:string }>;
    const automated = (daemon.db.prepare('SELECT count(*) AS n FROM recovery_attempt_v2 WHERE run_id=? AND rung<4').get(prepared.runId) as {n:number}).n;
    const escalations = (daemon.db.prepare('SELECT count(*) AS n FROM recovery_attempt_v2 WHERE run_id=? AND rung=4').get(prepared.runId) as {n:number}).n;
    core.close();
    expect(card.blockedReason).toBe('human_required');
    expect(sessions.filter(row => row.role === 'controller')).toHaveLength(4);
    expect(sessions.filter(row => row.role === 'tool_worker')).toHaveLength(8);
    expect(new Set(sessions.map(row => `${row.pid}:${row.start_time}`)).size).toBe(12);
    expect(automated).toBe(3);
    expect(escalations).toBe(1);
  }, 120_000);
});
