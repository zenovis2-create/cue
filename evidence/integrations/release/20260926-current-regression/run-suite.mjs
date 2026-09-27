import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, openSync, closeSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const evidence = dirname(fileURLToPath(import.meta.url));
const root = resolve(evidence, '../../../..');
function snapshot() {
  const listed = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'app', 'daemon', 'scripts', 'native', 'tests', 'package.json', 'package-lock.json'], {cwd: root, encoding: 'utf8'});
  if (listed.status !== 0) throw Error('source inventory failed');
  return [...new Set(listed.stdout.trim().split(/\r?\n/))].sort().map(path => ({path, sha256: existsSync(join(root, path)) ? createHash('sha256').update(readFileSync(join(root, path))).digest('hex') : null}));
}
const before = snapshot();
writeFileSync(join(evidence, 'source-before.json'), JSON.stringify(before, null, 2));
const env = {...process.env};
for (const key of Object.keys(env)) {
  if (/^(CUE_(LIVE.*|RUN_ORCA_READONLY|PROVIDER_INSTALLATION_LIVE_TEST|ACTUAL_.*)|ELECTRON_RUN_AS_NODE)$/i.test(key)) delete env[key];
}
const log = openSync(join(evidence, 'whole-suite.log'), 'wx');
const startedAt = new Date().toISOString();
const child = spawn(process.execPath, [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), 'test'], {cwd: root, env, stdio: ['ignore', log, log], windowsHide: true});
writeFileSync(join(evidence, 'invocation.json'), JSON.stringify({startedAt, pid:child.pid, command:'npm test', node:process.version, platform:process.platform, arch:process.arch, timeoutMs:1_800_000, clearedLiveOptIns:true}, null, 2));
let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  if (child.exitCode === null && child.signalCode === null) {
    const kill = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {encoding:'utf8', windowsHide:true, timeout:30_000});
    writeFileSync(join(evidence, 'timeout-termination.json'), JSON.stringify({status:kill.status, stdout:kill.stdout, stderr:kill.stderr}, null, 2));
  }
}, 1_800_000);
child.once('error', error => { writeFileSync(join(evidence, 'spawn-error.txt'), String(error)); });
child.once('close', (code, signal) => {
  clearTimeout(timer);
  closeSync(log);
  const after = snapshot();
  writeFileSync(join(evidence, 'source-after.json'), JSON.stringify(after, null, 2));
  const result = {startedAt, finishedAt:new Date().toISOString(), exitCode:code, signal, timedOut, sourceUnchanged:JSON.stringify(before) === JSON.stringify(after)};
  writeFileSync(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  console.log(readFileSync(join(evidence, 'whole-suite.log'), 'utf8').split(/\r?\n/).slice(-65).join('\n'));
  process.exitCode = timedOut ? 124 : code ?? 1;
});
