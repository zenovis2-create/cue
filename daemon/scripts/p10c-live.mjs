import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCueCore, initializeConfig } from '../../app/core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const phases = ['P10C', 'P11', 'P12'];
const phase = phases.includes(process.env.CUE_EVIDENCE_PHASE) ? process.env.CUE_EVIDENCE_PHASE : 'P10C';
const evidence = join(repo, 'evidence', phase);
const configuredWorktree = process.env.CUE_LIVE_WORKTREE;
const worktree = resolve(configuredWorktree || join(evidence, 'live-worktree'));
const state = join(evidence, 'live-state');
if (configuredWorktree && existsSync(worktree) && readdirSync(worktree).length > 0) {
  throw new Error('CUE_LIVE_WORKTREE must name a fresh empty directory');
}
if (!configuredWorktree) rmSync(worktree, { recursive: true, force: true });
rmSync(state, { recursive: true, force: true });
mkdirSync(worktree, { recursive: true });
mkdirSync(state, { recursive: true });

const binary = process.env.CUE_VENDOR_CODEX
  ?? join(process.env.APPDATA ?? '', 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
const codexHome = process.env.CODEX_HOME ?? join(process.env.USERPROFILE ?? '', '.codex');
const model = process.env.CUE_P10C_MODEL || 'gpt-5.5';
const optionalBytes = path => {
  try { return readFileSync(path); } catch { return null; }
};
const sourceAuthBefore = optionalBytes(join(codexHome, 'auth.json'));
const sourceConfigBefore = optionalBytes(join(codexHome, 'config.toml'));
const core = createCueCore(initializeConfig(state, { worktreeRoot: worktree }), undefined, {
  binary,
  codexHome,
  model,
  requestTimeoutMs: 120_000,
  runTimeoutMs: 600_000,
});

const goals = [
  {
    name: 'A',
    file: 'alpha-live.txt',
    goal: 'Create alpha-live.txt in the approved workspace with exactly this UTF-8 text and no extra characters: alpha-from-cue',
    verify: value => value === 'alpha-from-cue',
  },
  {
    name: 'B',
    file: 'beta-live.txt',
    goal: 'Create beta-live.txt in the approved workspace with exactly this UTF-8 text and no extra characters: beta-from-cue-different',
    verify: value => value === 'beta-from-cue-different',
  },
];

const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms));
async function waitForTask(taskId) {
  const deadline = Date.now() + 660_000;
  while (Date.now() < deadline) {
    const card = core.completion(taskId);
    if (card.state !== 'running') return card;
    await sleep(250);
  }
  throw new Error(`live task ${taskId} timed out`);
}

const runs = [];
let exitCode = 0;
try {
  for (const goal of goals) {
    const prepared = core.prepareGoal(goal.goal, 1);
    core.approve(prepared.runId);
    core.execute(prepared.runId);
    const card = await waitForTask(prepared.taskId);
    let content = '';
    let contentVerified = false;
    try {
      content = readFileSync(join(worktree, goal.file), 'utf8');
      contentVerified = goal.verify(content);
    } catch { /* captured in result */ }
    runs.push({
      name: goal.name,
      taskId: prepared.taskId,
      runId: prepared.runId,
      allowedActions: prepared.envelope.allowed_actions,
      card,
      file: goal.file,
      content,
      sha256: content ? createHash('sha256').update(content).digest('hex') : null,
      contentVerified,
    });
    if (card.state !== 'completed' || !contentVerified) exitCode = 2;
  }

  const sessions = core.daemon.db.prepare(`SELECT s.task_id AS taskId,s.run_id AS runId,s.pid,s.cwd,r.role,r.boundary,r.parent_handle AS parentHandle
    FROM session_handle s JOIN session_runtime r ON r.handle=s.handle ORDER BY s.rowid`).all();
  const verifications = core.daemon.db.prepare('SELECT run_id AS runId,check_name AS checkName,verdict,evidence FROM verification ORDER BY rowid').all();
  const binaryIntegrity = core.daemon.db.prepare("SELECT run_id AS runId,content FROM artifact WHERE kind='binary_integrity' ORDER BY rowid").all();
  const violations = core.daemon.db.prepare("SELECT run_id AS runId,content FROM artifact WHERE kind='enforcement_violation' ORDER BY rowid").all();
  const toolExecutions = core.daemon.db.prepare("SELECT run_id AS runId,content FROM artifact WHERE kind='tool_execution' ORDER BY rowid").all()
    .map(row => ({ runId: row.runId, ...JSON.parse(row.content) }));
  const sameOptionalBytes = (before, after) => before === null ? after === null : after !== null && before.equals(after);
  const sourceCredentialHomeUnchanged = sameOptionalBytes(sourceAuthBefore, optionalBytes(join(codexHome, 'auth.json')))
    && sameOptionalBytes(sourceConfigBefore, optionalBytes(join(codexHome, 'config.toml')));
  const actionKeys = runs.map(run => JSON.stringify(run.allowedActions));
  const controllerPids = sessions.filter(session => session.role === 'controller').map(session => session.pid);
  const workerPidSets = runs.map(run => new Set(run.card.workerPids));
  const perRunToolExecutions = runs.map(run => toolExecutions.filter(call => call.runId === run.runId));
  const invariants = {
    differentAllowedActions: actionKeys.length === 2 && actionKeys[0] !== actionKeys[1],
    differentArtifactHashes: runs.length === 2 && runs[0].sha256 !== runs[1].sha256,
    realWorkerPidPerRun: runs.every(run => run.card.workerPids.length > 0),
    differentControllerPids: controllerPids.length === 2 && controllerPids[0] !== controllerPids[1],
    disjointWorkerPids: workerPidSets.length === 2 && [...workerPidSets[0]].every(pid => !workerPidSets[1].has(pid)),
    sourceCredentialHomeUnchanged,
    binaryIntegrityPinned: binaryIntegrity.length === runs.length && binaryIntegrity.every(row => row.content === 'sha256:PASS'),
    zeroEnforcementViolations: violations.length === 0,
    orderedToolProvenance: perRunToolExecutions.every(calls => calls.length > 0 && calls.every((call, index) =>
      call.ordinal === index + 1
      && typeof call.callId === 'string'
      && typeof call.program === 'string'
      && Number.isInteger(call.argumentCount)
      && typeof call.startedAt === 'string'
      && typeof call.finishedAt === 'string'
      && !Object.hasOwn(call, 'args'))),
    noPostViolationExecution: perRunToolExecutions.every(calls => {
      const firstViolation = calls.findIndex(call => ['filesystem', 'network_gate', 'executable_sealing'].includes(call.violation));
      return firstViolation < 0 || firstViolation === calls.length - 1;
    }),
  };
  if (Object.values(invariants).some(value => value !== true)) exitCode = 2;
  const result = {
    schema: `cue.${phase.toLowerCase()}.live.v1`,
    generatedAt: new Date().toISOString(),
    verdict: exitCode === 0 ? 'PASS' : 'FAIL',
    model,
    productBoundary: 'standalone-electron-core',
    controllerBoundary: 'host-model-only; isolated controller cwd; environments=[]; cue_workspace dynamic tool only',
    workerBoundary: 'Windows AppContainer capability-zero; approved worktree ACL only',
    networkClaim: 'Tool-worker outbound networking is OS-denied by capability-zero AppContainer. Legacy P3-16 detection remains detection-only and is not relabeled.',
    runs,
    sessions,
    verifications,
    binaryIntegrity,
    violations,
    toolExecutions,
    invariants,
  };
  const resultPath = join(evidence, phase === 'P12' ? 'p12_live_result.json' : phase === 'P11' ? 'p11_live_result.json' : 'p10c_live_result.json');
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ verdict: result.verdict, resultPath, runs: runs.map(run => ({ name: run.name, state: run.card.state, file: run.file, sha256: run.sha256 })) }, null, 2));
} catch (error) {
  exitCode = 2;
  const resultPath = join(evidence, phase === 'P12' ? 'p12_live_result.json' : phase === 'P11' ? 'p11_live_result.json' : 'p10c_live_result.json');
  writeFileSync(resultPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), verdict: 'FAIL', failure: error instanceof Error ? error.message : 'live run failed', runs }, null, 2)}\n`);
} finally {
  try { core.close(); }
  catch {
    exitCode = 2;
    const resultPath = join(evidence, phase === 'P12' ? 'p12_live_result.json' : phase === 'P11' ? 'p11_live_result.json' : 'p10c_live_result.json');
    writeFileSync(resultPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), verdict: 'FAIL', failure: 'live cleanup could not verify process death', runs }, null, 2)}\n`);
  }
}
process.exitCode = exitCode;
