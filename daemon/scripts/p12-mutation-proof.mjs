import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('P12 mutation proof requires Windows');
if (process.env.NODE_ENV !== 'test') throw new Error('P12 mutation proof requires NODE_ENV=test');

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const outputDir = resolve(process.env.CUE_MUTATION_OUTPUT_DIR || join(repo, 'evidence', 'P12'));
mkdirSync(outputDir, { recursive: true });
const outputPath = join(outputDir, 'p12_mutation_result.json');
const fixture = mkdtempSync(join(tmpdir(), 'cue-p12-mutant-'));
const fixtureDaemon = join(fixture, 'daemon');
const junction = join(fixtureDaemon, 'node_modules');
const vitest = join(repo, 'daemon', 'node_modules', 'vitest', 'vitest.mjs');
const mutations = [];

function copyCandidate() {
  cpSync(join(repo, 'app'), join(fixture, 'app'), { recursive: true });
  for (const name of ['src', 'test', 'migrations', 'dist']) {
    cpSync(join(repo, 'daemon', name), join(fixtureDaemon, name), { recursive: true });
  }
  for (const name of ['package.json', 'tsconfig.json']) cpSync(join(repo, 'daemon', name), join(fixtureDaemon, name));
  const linked = spawnSync('cmd.exe', ['/d', '/c', 'mklink', '/J', junction, join(repo, 'daemon', 'node_modules')], { encoding: 'utf8', windowsHide: true });
  if (linked.status !== 0) throw new Error(`node_modules junction failed: ${linked.stderr || linked.stdout}`);
}

function applyEdits(relativePath, edits) {
  const path = join(fixture, relativePath);
  let text = readFileSync(path, 'utf8');
  for (const [before, after] of edits) {
    const first = text.indexOf(before);
    if (first < 0 || text.indexOf(before, first + before.length) >= 0) throw new Error(`mutation anchor is not unique: ${relativePath}`);
    text = text.replace(before, after);
  }
  writeFileSync(path, text);
}

function runMutation(spec) {
  const originals = new Map();
  try {
    for (const edit of spec.files) {
      const path = join(fixture, edit.path);
      originals.set(path, readFileSync(path));
      applyEdits(edit.path, edit.edits);
    }
    const run = spawnSync(process.execPath, [vitest, 'run', spec.test, ...(spec.filter ? ['-t', spec.filter] : []), '--reporter=verbose'], {
      cwd: fixtureDaemon,
      env: { ...process.env, NODE_ENV: 'test' },
      encoding: 'utf8',
      timeout: spec.timeoutMs,
    });
    const detected = run.status !== null && run.status !== 0;
    mutations.push({ id: spec.id, test: spec.test, exitCode: run.status, signal: run.signal, detected });
    if (!detected) throw new Error(`mutation survived: ${spec.id}\n${run.stdout}\n${run.stderr}`);
  } finally {
    for (const [path, bytes] of originals) writeFileSync(path, bytes);
  }
}

let failure = null;
try {
  copyCandidate();
  runMutation({
    id: 'failfast-terminal-seal-removed',
    test: 'test/p12-enforcement-seal.test.ts',
    timeoutMs: 30_000,
    files: [{
      path: 'daemon/src/host-codex-controller.ts',
      edits: [[
        "        if (result.violation && TERMINAL_ENFORCEMENT_VIOLATIONS.has(result.violation)) {\n          this.#sealEnforcement(id, result.violation, response);\n          return;\n        }",
        "        if (result.violation && TERMINAL_ENFORCEMENT_VIOLATIONS.has(result.violation)) {\n          this.#respond(id, response); // P12 disposable mutant: no terminal seal\n          return;\n        }",
      ]],
    }],
  });
  runMutation({
    id: 'writer-stop-transaction-removed',
    test: 'test/p12-terminal-transaction.test.ts',
    filter: 'user stop',
    timeoutMs: 30_000,
    files: [{
      path: 'app/core.mjs',
      edits: [[
        "    try {\n      this.#db.transaction(() => {\n        this.#db.prepare('DELETE FROM workspace_write_lease WHERE run_id=?').run(runId);",
        "    try {\n      (() => { // P12 disposable mutant: transaction removed\n        this.#db.prepare('DELETE FROM workspace_write_lease WHERE run_id=?').run(runId);",
      ]],
    }],
  });
  runMutation({
    id: 'appcontainer-parent-death-kill-removed',
    test: 'test/p12-parent-sentinel.test.ts',
    filter: 'monitored sentinel dies',
    timeoutMs: 60_000,
    files: [{
      path: 'daemon/src/appcontainer-launch.ps1',
      edits: [[
        "      uint signaled = WaitForMultipleObjects(2, new IntPtr[] { process.hProcess, parent }, false, 0xffffffff);",
        "      uint signaled = WaitForSingleObject(process.hProcess, 0xffffffff); // P12 disposable mutant: parent death is ignored",
      ]],
    }],
  });
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  try { rmdirSync(junction); } catch {}
  rmSync(fixture, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
}

const verdict = !failure && mutations.length === 3 && mutations.every(entry => entry.detected) ? 'PASS' : 'FAIL';
writeFileSync(outputPath, `${JSON.stringify({
  schema: 'cue.p12.mutation.v1',
  generatedAt: new Date().toISOString(),
  verdict,
  scope: 'disposable-copy mutation sensitivity; candidate checkout is never edited',
  mutations,
  failure,
}, null, 2)}\n`);
console.log(JSON.stringify({ verdict, outputPath, mutations, failure }, null, 2));
if (verdict !== 'PASS') process.exitCode = 2;
