import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createCueCore, initializeConfig } from '../../app/core.mjs';

const evidence = resolve('evidence/P11');
const root = join(evidence, 'stop-canary-state');
const worktree = join(evidence, 'stop-canary-worktree');
mkdirSync(worktree, { recursive: true });
const marker = join(worktree, `stop-marker-${Date.now()}.txt`);
const markerName = marker.slice(worktree.length + 1);
const binary = process.env.CUE_VENDOR_CODEX ?? join(process.env.APPDATA ?? '', 'npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe');
const codexHome = process.env.CODEX_HOME ?? join(process.env.USERPROFILE ?? '', '.codex');
const alive = pid => {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw new Error('FAIL: process liveness could not be observed');
  }
};
const sleep = ms => new Promise(done => setTimeout(done, ms));
async function waitFor(check, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) { if (check()) return; await sleep(100); }
  throw new Error('FAIL: stop canary timeout');
}
let core;
let prepared;
let failure = null;
let sessions = [];
let card;
let stopAccepted = false;
let leaseReleased = false;
let markerSha256 = null;
try {
  core = createCueCore(initializeConfig(root, { worktreeRoot: worktree }), undefined, { binary, codexHome, model: process.env.CUE_P10C_MODEL || 'gpt-5.5', requestTimeoutMs: 120_000, runTimeoutMs: 300_000 });
  prepared = core.prepareGoal(`Create ${markerName} with text stop-ready. Use one cue_workspace PowerShell command to write the file and then Start-Sleep -Seconds 90 in that same command, with timeoutMs 120000. This is a user-requested stop test; the wait is required.`, 1);
  core.approve(prepared.runId);
  core.execute(prepared.runId);
  await waitFor(() => {
    const current = core.completion(prepared.taskId);
    if (current.state !== 'running') throw new Error(`stop canary terminated before live worker observation: ${current.blockedReason ?? current.state}`);
    const rows = core.daemon.db.prepare(`SELECT s.pid,r.role,r.boundary FROM session_handle s JOIN session_runtime r ON r.handle=s.handle WHERE s.run_id=? ORDER BY s.rowid`).all(prepared.runId);
    const observed = rows.map(row => ({ ...row, aliveBeforeStop: alive(row.pid) }));
    if (!observed.some(row => row.role === 'controller' && row.aliveBeforeStop) || !observed.some(row => row.role === 'tool_worker' && row.boundary === 'appcontainer-capability-zero' && row.aliveBeforeStop)) return false;
    sessions = observed;
    return true;
  }, 240_000);
  markerSha256 = existsSync(marker) ? createHash('sha256').update(readFileSync(marker)).digest('hex') : null;
  stopAccepted = core.stop(prepared.runId);
  await waitFor(() => sessions.every(row => !alive(row.pid)), 30_000);
  sessions = sessions.map(row => ({ ...row, aliveAfterStop: alive(row.pid) }));
  card = core.completion(prepared.taskId);
  leaseReleased = !core.daemon.db.prepare('SELECT 1 FROM workspace_write_lease WHERE run_id=?').get(prepared.runId);
} catch (error) { failure = error instanceof Error ? error.message : 'stop canary failed'; }
finally {
  try { core?.close(); }
  catch { failure = failure ?? 'FAIL: stop canary cleanup could not verify process death'; }
}
const checks = {
  controllerAliveBeforeStop: sessions.some(row => row.role === 'controller' && row.aliveBeforeStop),
  appContainerWorkerAliveBeforeStop: sessions.some(row => row.role === 'tool_worker' && row.boundary === 'appcontainer-capability-zero' && row.aliveBeforeStop),
  allObservedProcessesDeadAfterStop: sessions.length > 0 && sessions.every(row => row.aliveAfterStop === false),
  stopAccepted,
  ledgerBlockedCancelled: card?.state === 'blocked' && card?.blockedReason === 'cancelled',
  leaseReleased,
};
const result = { schema: 'cue.p11.stop.v1', generatedAt: new Date().toISOString(), verdict: !failure && Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', scope: 'real vendor Codex host controller and real capability-zero AppContainer worker; stop at first observed live worker, including goal preparation; marker is diagnostic only', taskId: prepared?.taskId, runId: prepared?.runId, markerSha256, sessions, card: card ? { state: card.state, blockedReason: card.blockedReason } : null, checks, failure };
writeFileSync(join(evidence, 'p11_stop_result.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ verdict: result.verdict, checks, failure }));
if (result.verdict !== 'PASS') process.exitCode = 2;
