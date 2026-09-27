import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, openSync, closeSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const evidence = dirname(fileURLToPath(import.meta.url));
const root = resolve(evidence, '../../../..');
const daemon = join(root, 'daemon');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', {flag:'wx'});
function walk(directory) {
  return readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [relative(root, path).replaceAll('\\', '/')];
  });
}
function snapshot() {
  const git = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'app', 'daemon', 'scripts', 'native', 'tests', 'package.json', 'package-lock.json'], {cwd:root, encoding:'utf8'});
  if (git.status !== 0) throw Error('inventory_failed');
  const paths = [...new Set([...git.stdout.trim().split(/\r?\n/), ...walk(join(daemon, 'test')), ...walk(join(daemon, 'dist'))])].sort();
  return paths.map(path => ({path, sha256:existsSync(join(root, path)) ? sha(readFileSync(join(root, path))) : null}));
}
const tests = () => walk(join(daemon, 'test')).filter(path => path.endsWith('.test.ts')).sort();
const manifestPath = join(evidence, 'manifest.json');
function assertFrozen(manifest) {
  const current = snapshot();
  if (sha(JSON.stringify(current)) !== manifest.sourceDigest || JSON.stringify(tests()) !== JSON.stringify(manifest.tests)) throw Error('frozen_source_or_test_inventory_changed');
}
function resultForGroup(manifest, group) {
  const dir = join(evidence, `group-${String(group.id).padStart(2,'0')}`);
  if (!existsSync(join(dir, 'result.json'))) return {id:group.id, complete:false, reason:'result_missing'};
  const outcome = read(join(dir, 'result.json'));
  const reportPath = join(dir, 'report.json');
  if (!existsSync(reportPath)) return {id:group.id, complete:false, reason:'report_missing', outcome};
  const report = read(reportPath);
  const actual = report.testResults.map(file => relative(root, file.name).replaceAll('\\', '/')).sort();
  const expected = [...group.files].sort();
  const exactFiles = JSON.stringify(actual) === JSON.stringify(expected);
  const assertions = report.testResults.flatMap(file => file.assertionResults);
  const counts = Object.fromEntries([...new Set(assertions.map(test => test.status))].sort().map(status => [status, assertions.filter(test => test.status === status).length]));
  return {id:group.id, complete:outcome.code === 0 && !outcome.timedOut && outcome.sourceUnchanged && exactFiles && report.success === true,
    exactFiles, files:actual, counts, failedFiles:report.testResults.filter(file => file.status === 'failed').map(file => relative(root,file.name).replaceAll('\\','/')),
    unhandledErrors:report.numRuntimeErrorTestSuites ?? null, outcome};
}
const [command, idArg] = process.argv.slice(2);
if (command === 'init') {
  if (existsSync(manifestPath)) throw Error('manifest_already_frozen');
  const source = snapshot(), allTests = tests();
  const prior = readFileSync(join(evidence, '../20260926-current-regression/whole-suite.log'), 'utf8');
  const durations = new Map();
  for (const line of prior.split(/\r?\n/)) {
    const match = line.match(/^ [✓×] (test\/[^ ]+) > .* (\d+)ms$/u);
    if (match) durations.set(`daemon/${match[1]}`, (durations.get(`daemon/${match[1]}`) ?? 0) + Number(match[2]));
  }
  const groups = Array.from({length:12}, (_, index) => ({id:index+1, estimatedMs:0, files:[]}));
  const estimate = path => Math.max(1000, durations.get(path) ?? 5000);
  for (const path of [...allTests].sort((a,b) => estimate(b)-estimate(a) || a.localeCompare(b))) {
    const group = [...groups].sort((a,b) => a.estimatedMs-b.estimatedMs || a.id-b.id)[0];
    group.files.push(path); group.estimatedMs += estimate(path);
  }
  save(join(evidence, 'source.json'), source);
  save(manifestPath, {version:1, createdAt:new Date().toISOString(), sourceDigest:sha(JSON.stringify(source)), tests:allTests, groups,
    limits:{groupTimeoutMs:600000, concurrency:1, retries:0}, scope:'local fixtures; live opt-ins disabled; grouped coverage, not root invocation'});
  console.log(JSON.stringify({files:allTests.length, groups:groups.map(({id,estimatedMs,files})=>({id,estimatedMs,files:files.length}))},null,2));
} else if (command === 'run') {
  const manifest = read(manifestPath);
  assertFrozen(manifest);
  const group = manifest.groups.find(group => group.id === Number(idArg));
  if (!group) throw Error('unknown_group');
  const lock = join(evidence, 'running.lock');
  const lockFd = openSync(lock,'wx');
  const dir = join(evidence, `group-${String(group.id).padStart(2,'0')}`);
  // Existing groups must never be silently overwritten/retried.
  try { mkdirSync(dir); } catch(error) { closeSync(lockFd); unlinkSync(lock); throw error; }
  const log = openSync(join(dir, 'output.log'), 'wx');
  const env = {...process.env};
  for (const key of Object.keys(env)) if (/^(CUE_(LIVE.*|RUN_ORCA_READONLY|PROVIDER_INSTALLATION_LIVE_TEST|ACTUAL_.*)|ELECTRON_RUN_AS_NODE)$/i.test(key)) delete env[key];
  const args = [join(daemon, 'node_modules/vitest/vitest.mjs'), 'run', ...group.files.map(path => path.slice('daemon/'.length)), '--reporter=verbose', '--reporter=json', `--outputFile.json=${join(dir,'report.json')}`, '--fileParallelism=false', '--maxWorkers=1', '--allowOnly=false'];
  const startedAt = new Date().toISOString();
  const child = spawn(process.execPath, args, {cwd:daemon, env, stdio:['ignore',log,log], windowsHide:true});
  save(join(dir, 'invocation.json'), {startedAt,pid:child.pid,node:process.version,args,sourceDigest:manifest.sourceDigest});
  let timedOut = false, spawnError = null;
  const timer = setTimeout(() => {
    timedOut = true;
    if (child.exitCode === null && child.signalCode === null) {
      const kill = spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{encoding:'utf8',timeout:30000,windowsHide:true});
      save(join(dir,'timeout-termination.json'),{status:kill.status,stdout:kill.stdout,stderr:kill.stderr});
    }
  },manifest.limits.groupTimeoutMs);
  child.once('error',error=>{spawnError=String(error);});
  child.once('close',async(code,signal)=>{
    clearTimeout(timer); closeSync(log); closeSync(lockFd);
    // Release only this runner's exclusive lock after its child has settled.
    unlinkSync(lock);
    let sourceUnchanged = true; try {assertFrozen(manifest);} catch {sourceUnchanged=false;}
    save(join(dir,'result.json'),{startedAt,finishedAt:new Date().toISOString(),code,signal,timedOut,spawnError,sourceUnchanged});
    const summary = resultForGroup(manifest,group); save(join(dir,'summary.json'),summary);
    console.log(JSON.stringify(summary,null,2));
    console.log(readFileSync(join(dir,'output.log'),'utf8').split(/\r?\n/).slice(-16).join('\n'));
    process.exitCode=summary.complete?0:1;
  });
} else if (command === 'audit') {
  const manifest = read(manifestPath);
  assertFrozen(manifest);
  const groups = manifest.groups.map(group => resultForGroup(manifest,group));
  const observed = groups.flatMap(group=>group.files??[]);
  const missing = manifest.tests.filter(path=>!observed.includes(path));
  const duplicates = [...new Set(observed.filter((path,index)=>observed.indexOf(path)!==index))];
  const unexpected = observed.filter(path=>!manifest.tests.includes(path));
  const counts = {};
  for (const group of groups) for (const [status,count] of Object.entries(group.counts??{})) counts[status]=(counts[status]??0)+count;
  const result={sourceDigest:manifest.sourceDigest,sourceUnchanged:true,totalFiles:manifest.tests.length,reportedFiles:observed.length,missing,duplicates,unexpected,counts,groups,
    allGroupsPassed:groups.every(group=>group.complete)&&!missing.length&&!duplicates.length&&!unexpected.length,
    rootInvocationPassed:false,providerQualification:false};
  save(join(evidence,`audit-${Date.now()}.json`),result);
  console.log(JSON.stringify({...result,groups:groups.map(({id,complete,counts,failedFiles})=>({id,complete,counts,failedFiles}))},null,2));
  process.exitCode=result.allGroupsPassed?0:1;
} else throw Error('use init, run <group>, or audit');
