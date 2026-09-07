import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const evidence = resolve(root, 'evidence/P11');
const read = name => JSON.parse(readFileSync(resolve(evidence, name), 'utf8').replace(/^\uFEFF/u, ''));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const limitations = [
  'P3-16 network is detection-only',
  'P4-2 `Win32_Process` does not supply cwd',
  'P6-3 real Buzz delivery unverified',
  'goal verification is oriented toward file-changing goals',
];
const gates = {};
const failures = [];
function gate(name, check) {
  try { gates[name] = Boolean(check()); }
  catch { gates[name] = false; }
  if (!gates[name]) failures.push(name);
}
let counts = null;
let manifest = null;
let commitHash = null;
gate('R0_baselineRecorded', () => {
  const baseline = read('p11_baseline.json');
  return baseline.exitCode === 0 && existsSync(resolve(evidence, baseline.rawLog.split('/').at(-1)));
});
for (const [name, file] of [
  ['R1_writerLifecycle', 'p11_writer_lifecycle.json'],
  ['R2_executableSealing', 'p11_exec_sealing.json'],
  ['R3_electron', 'p11_electron.json'],
  ['R4_credentialHygiene', 'p11_credential_hygiene.json'],
]) gate(name, () => { const result = read(file); return result.passed === true || result.verdict === 'PASS'; });
gate('R1_everyExitRedFirst', () => read('p11_writer_lifecycle.json').redFirstComplete === true);
gate('R5_canonicalRegression', () => {
  counts = read('p11_full_regression.json');
  const raw = readFileSync(resolve(evidence, 'p11_full_regression.log'), 'utf8').replace(/\x1b\[[0-9;]*m/gu, '');
  return counts.exitCode === 0 && counts.testsFailed === 0 && raw.includes(`${counts.testsPassed} passed`) && raw.includes(`${counts.testsSkipped} skipped`) && !/\b[1-9]\d* failed/u.test(raw);
});
gate('R5_liveAB', () => {
  const live = read('p11_live_result.json');
  return live.verdict === 'PASS' && live.runs.length === 2 && live.runs.every(run => run.contentVerified && run.card.state === 'completed') && Object.values(live.invariants).every(value => value === true);
});
gate('R5_manifest', () => {
  const proof = read('p11_manifest_proof.json');
  return proof.verdict === 'PASS' && JSON.stringify(proof.toolNames) === '["cue_workspace"]' && proof.hostExecutionTools.length === 0;
});
gate('R5_stop', () => {
  const stop = read('p11_stop_result.json');
  return stop.verdict === 'PASS' && stop.checks.leaseReleased === true && Object.values(stop.checks).every(value => value === true);
});
gate('R5_sourceTreeMatches', () => {
  manifest = read('source_tree_manifest.json');
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).map(path => path.replaceAll('\\', '/')).filter(path => !path.startsWith('evidence/') && existsSync(resolve(root, path))).sort();
  const files = paths.map(path => { const bytes = readFileSync(resolve(root, path)); return { path, bytes: bytes.length, sha256: sha(bytes) }; });
  return sha(JSON.stringify(files)) === manifest.sourceTreeSha256;
});
for (const role of ['security', 'release']) gate(`R6_${role}Review`, () => {
  const review = read(`p11_review_${role}.json`);
  return review.passed === true && review.valid !== false && review.sourceTreeSha256 === manifest?.sourceTreeSha256;
});
gate('R7_committedClean', () => {
  commitHash = git(['rev-parse', 'HEAD']);
  const author = git(['show', '-s', '--format=%an <%ae>', 'HEAD']);
  const message = git(['show', '-s', '--format=%B', 'HEAD']);
  return git(['status', '--porcelain']) === '' && author === 'Cue <cue@local>' && message.includes(`${counts?.testsPassed} passed`) && message.includes(`${counts?.testsSkipped} skipped`) && message.includes(`${counts?.testsFailed} failed`) && message.includes('detection-only');
});
const result = {
  schema: 'cue.p11.v01-verdict.v1', generatedAt: new Date().toISOString(),
  verdict: failures.length ? 'NO-GO' : 'GO', blockingReasons: failures,
  finalCounts: counts, sourceTreeSha256: manifest?.sourceTreeSha256 ?? null, commitHash,
  limitations,
  additionalLimitations: ['AppContainer workers cannot create child processes; each executable requires a separately sealed cue_workspace call.'],
  gates,
  revisionBinding: 'Ignored post-commit attestation; source and pre-commit verification/reviews are committed together. Source digest is recomputed from actual source files.',
};
writeFileSync(resolve(evidence, 'v01_verdict.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ verdict: result.verdict, commitHash, blockingReasons: failures }));
if (failures.length) process.exitCode = 1;
