import { expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
const url = new URL('../../scripts/reuse/local-json-electron-gate.mjs', import.meta.url).href;
const { CONTRACT, parseExecutionArgs, cleanChildEnvironment, observerSource, auditLedgerRows, backupClosedLedger, assertOwnedProfile } = await import(url);
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
test('gate cannot execute without exact frozen authority; no resume/retry or budget expansion', () => {
  expect(CONTRACT).toMatchObject({ qualificationProcesses: 1, workflowProcesses: 1, maxQwenRequests: 2, maxWorkflowInvocations: 2 });
  for (const args of [[], ['--execute-approved-electron-gate'], ['--resume'], ['--execute-approved-electron-gate','--script-sha256','a'.repeat(64),'--installation-digest','b'.repeat(64),'extra']]) expect(() => parseExecutionArgs(args)).toThrow();
  expect(parseExecutionArgs(['--execute-approved-electron-gate','--script-sha256','a'.repeat(64),'--installation-digest','b'.repeat(64)])).toEqual({ scriptSha256: 'a'.repeat(64), installationDigest: 'b'.repeat(64) });
});
test('qualification environment removes inherited preload/live flags; workflow adds only owned observer', () => {
  const inherited = { NODE_OPTIONS: '--require bad', node_options: '--import bad', ELECTRON_RUN_AS_NODE: '1', CUE_LIVE_RUN: '1', CUE_WORKTREE_ROOT: 'old', CUE_USER_DATA: 'old', SystemRoot: 'C:\\Windows' };
  expect(cleanChildEnvironment(inherited,'owned')).toEqual({ CUE_USER_DATA: 'owned', SystemRoot: 'C:\\Windows' });
  expect(cleanChildEnvironment(inherited,'owned','C:\\owned\\observer.cjs').NODE_OPTIONS).toBe('--require "C:\\\\owned\\\\observer.cjs"');
  expect(inherited.CUE_LIVE_RUN).toBe('1');
});
test('both Electron phases must prove exact owned user and session paths', () => {
  const data = join(tmpdir(), 'owned-profile-fixture');
  expect(() => assertOwnedProfile({ userData: data, sessionData: join(data,'electron-session') },data)).not.toThrow();
  for (const profile of [undefined, {}, { userData:data, sessionData:'default-global' }, { userData:'other', sessionData:join(data,'electron-session') }]) expect(() => assertOwnedProfile(profile,data)).toThrow('owned_profile');
});
test('observer compiles without execution and uses existing form/approve, no alternate host seam', () => {
  const source = observerSource('C:\\owned\\evidence'); expect(() => new Script(source)).not.toThrow();
  expect(source).toContain("#task-template"); expect(source).toContain("#goal-form"); expect(source).toContain("#approve");
  expect(source).toContain("setImmediate"); expect(source).toContain("Page.captureScreenshot"); expect(source).toContain('finally{'); expect(source).toContain('app.quit()');
  expect(source).not.toMatch(/createCueCore|createGeneratedJsonHost|ipcMain|show:false|hide\(/);
});
function qualificationRows() {
  const capabilities = ['a','b'].flatMap(subject => ['M1','M2','M3'].map(probe => {
    const payload = Buffer.from(JSON.stringify({ kind: 'live', status: 'pass', probe })), observation = Buffer.from('synthetic offline observation');
    return { subject_digest: subject, payload, payload_sha256: hash(payload), observation, observation_sha256: hash(observation) };
  }));
  return { artifact: [{ kind: 'model-qualification-raw', content: JSON.stringify({ stage: 'production-model', value: { result: { outcome: 'succeeded' } } }) }], capability_evidence: capabilities, orchestration_attempt: [] };
}
test('offline synthetic audit requires actual-style production journal and all six matching live evidence hashes', () => {
  const rows = qualificationRows(); expect(auditLedgerRows(rows,'qualification').qualificationRequests).toBe(1);
  rows.capability_evidence[0]!.observation = Buffer.from('tampered'); expect(() => auditLedgerRows(rows,'qualification')).toThrow('hash');
  const missing = qualificationRows(); missing.capability_evidence.pop(); expect(() => auditLedgerRows(missing,'qualification')).toThrow('count');
  const repeated = qualificationRows(); repeated.artifact.push(repeated.artifact[0]!); expect(() => auditLedgerRows(repeated,'qualification')).toThrow('count');
});
test('real SQLite backup includes uncheckpointed WAL and passes independent integrity check', async () => {
  const owned = mkdtempSync(join(tmpdir(), 'cue-gate-backup-')), source = join(owned,'source.sqlite'), target = join(owned,'backup.sqlite');
  const writer = new DatabaseSync(source);
  try {
    writer.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE fixture(value TEXT); INSERT INTO fixture VALUES(\'wal-only-value\')');
    expect(await backupClosedLedger(source,target)).toMatch(/^[a-f0-9]{64}$/);
    const copied = new DatabaseSync(target,{readOnly:true});
    try { expect(copied.prepare('SELECT value FROM fixture').get()!.value).toBe('wal-only-value'); expect(copied.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok'); } finally { copied.close(); }
  } finally { writer.close(); expect(dirname(resolve(owned))).toBe(resolve(tmpdir())); expect(basename(owned).startsWith('cue-gate-backup-')).toBe(true); rmSync(owned,{recursive:true,force:true}); }
});
test('offline workflow row audit requires both attempts, target/output linkage, acceptance and clean durable receipts', () => {
  const base = qualificationRows();
  const observation = Buffer.from(JSON.stringify({ runId: 'producer', result: 'verified-clean' })), checkerObservation = Buffer.from(JSON.stringify({ runId: 'checker', result: 'verified-clean' }));
  const final = JSON.stringify({ status:'accepted' }), evaluation = JSON.stringify({ verdict:'pass' });
  const rows: any = { ...base, orchestration_attempt: [{ attempt_id:'producer',run_id:'run',task_id:'produce-json',state:'completed',cleanup_verified:1 },{ attempt_id:'checker',run_id:'run',task_id:'verify-json',state:'completed',cleanup_verified:1 }],
    generated_output_observation:[{ attempt_id:'producer',run_id:'run',target_id:'formatted-json',bytes:Buffer.from(CONTRACT.expectedOutput) }], generated_output_target:[{run_id:'run',target_id:'formatted-json',input_bytes:Buffer.from(CONTRACT.input)}],
    acceptance_final:[{run_id:'run',evaluation_id:'evaluation',payload:final,payload_sha256:hash(final)}], acceptance_evaluation:[{id:'evaluation',run_id:'run',payload:evaluation,payload_sha256:hash(evaluation)}],
    orchestration_receipt:[{attempt_id:'producer',payload:JSON.stringify({evidenceRef:'cue-cleanup:'+hash(observation)})},{attempt_id:'checker',payload:JSON.stringify({evidenceRef:'cue-cleanup:'+hash(checkerObservation)})}], cleanup_observation:[{sha256:hash(observation),payload:observation},{sha256:hash(checkerObservation),payload:checkerObservation}],
    local_invocation_reservation:[{run_id:'run'},{run_id:'run'}],local_invocation_budget:[{limit_count:2}],integration_budget_reservation:[],integration_budget_receipt:[],workspace_write_lease:[] };
  expect(auditLedgerRows(rows,'workflow').accepted).toBe(true); // Row layer only; production additionally runs strict historical readers.
  rows.generated_output_observation[0].target_id='other'; expect(()=>auditLedgerRows(rows,'workflow')).toThrow('lineage');
  rows.generated_output_observation[0].target_id='formatted-json'; rows.acceptance_final[0].evaluation_id='other'; expect(()=>auditLedgerRows(rows,'workflow')).toThrow('acceptance');
});
