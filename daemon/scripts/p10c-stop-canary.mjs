import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'win32') throw new Error('P10-C stop canary requires Windows');
if (process.env.NODE_ENV !== 'test') throw new Error('P10-C stop canary requires NODE_ENV=test for the deterministic controller fixture');

const { createCueCore, initializeConfig } = await import('../../app/core.mjs');
const evidenceDir = resolve('evidence/P10C');
const root = join(evidenceDir, 'stop-canary-state');
const worktree = join(evidenceDir, 'stop-canary-worktree');
const sourceHome = join(root, 'source-home');
const vendor = join(root, 'vendor');
const outputPath = join(evidenceDir, 'p10c_stop_result.json');
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));

function processAlive(pid) {
  const result = spawnSync('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
  return result.status === 0 && String(result.stdout).includes(`\"${pid}\"`);
}

async function waitUntil(check, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(50);
  }
  throw new Error('stop canary condition timeout');
}

function controllerSource() {
  return String.raw`
const readline=require('node:readline');
const rl=readline.createInterface({input:process.stdin});
const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
rl.on('line',line=>{const m=JSON.parse(line);
 if(m.method==='initialize')send({id:m.id,result:{}});
 else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'stop-thread'}}});
 else if(m.method==='turn/start'){
  const script="$p=[IO.Path]::Combine([Environment]::CurrentDirectory,'started.txt');[IO.File]::WriteAllText($p,'started');Start-Sleep -Seconds 120";
  send({id:m.id,result:{turn:{id:'stop-turn'}}});
  send({method:'item/tool/call',id:7,params:{threadId:'stop-thread',turnId:'stop-turn',callId:'stop-call',namespace:null,tool:'cue_workspace',arguments:{program:'powershell.exe',args:['-NoProfile','-NonInteractive','-Command',script],timeoutMs:120000}}});
 }
});
`;
}

rmSync(root, { recursive: true, force: true });
rmSync(worktree, { recursive: true, force: true });
mkdirSync(sourceHome, { recursive: true });
mkdirSync(vendor, { recursive: true });
mkdirSync(worktree, { recursive: true });
writeFileSync(join(sourceHome, 'auth.json'), 'credential-placeholder');
const binary = join(vendor, 'codex.exe');
copyFileSync(process.execPath, binary);
const server = join(worktree, 'stop-controller.cjs');
writeFileSync(server, controllerSource());

let core;
let sessions = [];
let stopAccepted = false;
let card;
let startedContent = null;
let failure = null;
try {
  core = createCueCore(initializeConfig(root, { worktreeRoot: worktree }), undefined, {
    binary,
    codexHome: sourceHome,
    controllerArgs: [server],
    requestTimeoutMs: 5_000,
  });
  const prepared = core.prepareGoal('Stop an active capability-zero worker', 1);
  core.approve(prepared.runId);
  core.execute(prepared.runId);
  await waitUntil(() => {
    try { return readFileSync(join(worktree, 'started.txt'), 'utf8') === 'started'; } catch { return false; }
  });
  sessions = core.daemon.db.prepare(`SELECT s.pid,r.role,r.boundary
    FROM session_handle s JOIN session_runtime r ON r.handle=s.handle
    WHERE s.run_id=? ORDER BY s.rowid`).all(prepared.runId);
  sessions = sessions.map(row => ({ ...row, aliveBeforeStop: processAlive(row.pid) }));
  startedContent = readFileSync(join(worktree, 'started.txt'), 'utf8');
  stopAccepted = core.stop(prepared.runId);
  await waitUntil(() => sessions.every(row => !processAlive(row.pid)));
  card = core.completion(prepared.taskId);
  sessions = sessions.map(row => ({ ...row, aliveAfterStop: processAlive(row.pid) }));
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  core?.close();
  for (const session of sessions) {
    if (processAlive(session.pid)) spawnSync('taskkill.exe', ['/PID', String(session.pid), '/T', '/F']);
  }
}

try {
  rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  rmSync(worktree, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
} catch (error) {
  failure = failure || `fixture cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
}

const controller = sessions.find(row => row.role === 'controller');
const workers = sessions.filter(row => row.role === 'tool_worker');
const checks = {
  startedMarkerWritten: startedContent === 'started',
  controllerAliveBeforeStop: Boolean(controller?.aliveBeforeStop),
  liveAppContainerWorkerBeforeStop: workers.some(row => row.aliveBeforeStop),
  stopAccepted,
  ledgerBlockedCancelled: card?.state === 'blocked' && card?.blockedReason === 'cancelled',
  controllerAndWorkersStopped: sessions.length >= 3 && sessions.every(row => row.aliveAfterStop === false),
  fixturePathsRemoved: !existsSync(root) && !existsSync(worktree),
};
const verdict = !failure && Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
const result = {
  schema: 'cue.p10c.stop.v1',
  generatedAt: new Date().toISOString(),
  verdict,
  scope: 'deterministic host-controller fixture plus real capability-zero AppContainer worker; actual vendor model is covered separately by p10c_live_result.json',
  worktree,
  startedMarkerSha256: startedContent === null ? null : createHash('sha256').update(startedContent).digest('hex'),
  sessions,
  card: card ? { state: card.state, blockedReason: card.blockedReason, status: card.status, stage: card.stage } : null,
  checks,
  failure,
};
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ verdict, outputPath, checks }, null, 2));
if (verdict !== 'PASS') process.exitCode = 2;
