import { expect, test } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
const url = new URL('../../scripts/reuse/local-json-electron-gate-v2.mjs', import.meta.url).href;
const { CONTRACT, parseExecutionArgs, cleanChildEnvironment, observerSource, auditLedgerRows, backupClosedLedger, assertOwnedProfile, zeroInferencePreflight } = await import(url);
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
test('gate cannot execute without exact frozen authority; no resume/retry or budget expansion', () => {
  expect(CONTRACT).toMatchObject({ qualificationProcesses: 1, workflowProcesses: 1, maxQwenRequests: 2, maxWorkflowInvocations: 2 });
  for (const args of [[], ['--execute-approved-electron-gate'], ['--resume'], ['--execute-approved-electron-gate','--script-sha256','a'.repeat(64),'--installation-digest','b'.repeat(64),'extra']]) expect(() => parseExecutionArgs(args)).toThrow();
  expect(parseExecutionArgs(['--execute-approved-electron-gate','--script-sha256','a'.repeat(64),'--installation-digest','b'.repeat(64)])).toEqual({ scriptSha256: 'a'.repeat(64), installationDigest: 'b'.repeat(64) });
  expect(typeof zeroInferencePreflight).toBe('function');
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
  return { artifact: [{ kind: 'model-qualification-raw', content: JSON.stringify({ stage: 'production-model', value: { result: { outcome: 'succeeded' } } }) },
    {kind:'model-qualification-raw',content:JSON.stringify({stage:'production-pass',value:{result:{outcome:'succeeded',observations:{CUE_MODEL_BOUNDARY:{clientKind:'json-checker',checkerCoreSha256:'b'.repeat(64)}}}}})}], capability_evidence: capabilities, orchestration_attempt: [] };
}
const expectedCheckerRevision='v1:'+'b'.repeat(64);
test('offline synthetic audit requires actual-style production journal and all six matching live evidence hashes', () => {
  const rows = qualificationRows(); expect(auditLedgerRows(rows,'qualification',expectedCheckerRevision).qualificationArtifacts).toBe(1);
  rows.capability_evidence[0]!.observation = Buffer.from('tampered'); expect(() => auditLedgerRows(rows,'qualification',expectedCheckerRevision)).toThrow('hash');
  const missing = qualificationRows(); missing.capability_evidence.pop(); expect(() => auditLedgerRows(missing,'qualification',expectedCheckerRevision)).toThrow('count');
  const repeated = qualificationRows(); repeated.artifact.push(repeated.artifact[0]!); expect(() => auditLedgerRows(repeated,'qualification',expectedCheckerRevision)).toThrow('count');
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
  const sessions=[{handle:'producer-session',pid:101,start_time:'producer-start',cwd:'C:\\owned',task_id:'producer-task',run_id:'producer'},
    {handle:'checker-session',pid:102,start_time:'checker-start',cwd:'C:\\owned',task_id:'checker-task',run_id:'checker'}];
  const cleanup=(runId:string,candidateId:string,session:any)=>Buffer.from(JSON.stringify({runId,candidateId,result:'verified-clean',session}));
  const observation=cleanup('producer','cue.local.qwen38-27b-unc',sessions[0]),checkerObservation=cleanup('checker','cue.checker.json-format',sessions[1]);
  const final = JSON.stringify({ status:'accepted' }), evaluation = JSON.stringify({ verdict:'pass' });
  const inputSha256=hash(CONTRACT.input),parametersDigest='a'.repeat(64),checkerRevision=expectedCheckerRevision,sourceRevision='generated-json:'+hash(JSON.stringify({inputSha256,targetId:'formatted-json',producerTaskId:'produce-json',checkerRevision,parametersDigest}));
  const policy={requirementId:'json-format',kind:'document',producerTaskIds:['produce-json'],sourceRevision,targetIds:['formatted-json'],checkerId:'cue-json-format',checkerRevision,parametersDigest,hostileCheckIds:[],requiredSectionIds:['json-document'],claimIds:[],requiresRender:false};
  const targetPayload={runId:'run',targetId:'formatted-json',requirementId:'json-format',producerTaskId:'produce-json',checkerId:'cue-json-format',checkerRevision,inputSha256,inputByteLength:Buffer.byteLength(CONTRACT.input),parametersDigest};
  const requirementPayload={contracts:[{id:'json-format',kind:'document',required:true,checks:[{checkerId:'cue-json-format',revision:checkerRevision,parametersDigest,targetIds:['formatted-json']}]}],checkers:[{id:'cue-json-format',revision:checkerRevision,evidencePolicies:[policy]}],evidencePolicies:[policy]};
  const identities=[...sessions.map((session,index)=>{const attemptId=index?'checker':'producer',candidateId=index?'cue.checker.json-format':'cue.local.qwen38-27b-unc';return{run_id:attemptId,sha256:String(index+1).repeat(64),payload:Buffer.from(JSON.stringify({runId:attemptId,candidateId,session}))};}),
    ...[3,4,5].map(index=>({run_id:`qualification-${index}`,sha256:String(index).repeat(64),payload:Buffer.from('{}')}))];
  const rows: any = { ...base, orchestration_attempt: [{ attempt_id:'producer',run_id:'run',task_id:'produce-json',candidate_id:'cue.local.qwen38-27b-unc',state:'completed',cleanup_verified:1 },{ attempt_id:'checker',run_id:'run',task_id:'verify-json',candidate_id:'cue.checker.json-format',state:'completed',cleanup_verified:1 }],
    requirement_contract_binding:[{run_id:'run',payload:JSON.stringify(requirementPayload)}],native_execution_identity:identities,session_handle:sessions,
    generated_output_observation:[{ attempt_id:'producer',run_id:'run',target_id:'formatted-json',bytes:Buffer.from(CONTRACT.expectedOutput) }], generated_output_target:[{run_id:'run',target_id:'formatted-json',input_bytes:Buffer.from(CONTRACT.input),payload:JSON.stringify(targetPayload),digest:hash(JSON.stringify(targetPayload))}],
    acceptance_final:[{run_id:'run',evaluation_id:'evaluation',payload:final,payload_sha256:hash(final)}], acceptance_evaluation:[{id:'evaluation',run_id:'run',payload:evaluation,payload_sha256:hash(evaluation)}],
    orchestration_receipt:[{attempt_id:'producer',payload:JSON.stringify({evidenceRef:'cue-cleanup:'+hash(observation)})},{attempt_id:'checker',payload:JSON.stringify({evidenceRef:'cue-cleanup:'+hash(checkerObservation)})}], cleanup_observation:[{sha256:hash(observation),payload:observation},{sha256:hash(checkerObservation),payload:checkerObservation}],
    local_invocation_reservation:[{run_id:'run'},{run_id:'run'}],local_invocation_budget:[{limit_count:2}],integration_budget_reservation:[],integration_budget_receipt:[],workspace_write_lease:[] };
  const syncRequirements=()=>{rows.requirement_contract_binding[0].payload=JSON.stringify(requirementPayload);};
  const syncTarget=()=>{rows.generated_output_target[0].payload=JSON.stringify(targetPayload);rows.generated_output_target[0].digest=hash(rows.generated_output_target[0].payload);};
  const audit=()=>auditLedgerRows(rows,'workflow',expectedCheckerRevision);
  expect(audit().accepted).toBe(true); // Row layer only; production additionally runs strict historical readers.
  rows.generated_output_observation[0].target_id='other'; expect(audit).toThrow('lineage');
  rows.generated_output_observation[0].target_id='formatted-json'; rows.acceptance_final[0].evaluation_id='other'; expect(audit).toThrow('acceptance'); rows.acceptance_final[0].evaluation_id='evaluation';
  targetPayload.inputSha256='f'.repeat(64);syncTarget(); expect(audit).toThrow('lineage'); targetPayload.inputSha256=inputSha256;syncTarget();
  targetPayload.checkerRevision='v1:'+'c'.repeat(64);syncTarget();expect(audit).toThrow('qualification');targetPayload.checkerRevision=checkerRevision;syncTarget();
  requirementPayload.evidencePolicies[0].sourceRevision='mutated';syncRequirements(); expect(audit).toThrow('source'); requirementPayload.evidencePolicies[0].sourceRevision=sourceRevision;
  requirementPayload.evidencePolicies[0].checkerId='wrong-checker';syncRequirements(); expect(audit).toThrow('target'); requirementPayload.evidencePolicies[0].checkerId='cue-json-format';
  requirementPayload.evidencePolicies[0].targetIds=['other'];syncRequirements(); expect(audit).toThrow('target');requirementPayload.evidencePolicies[0].targetIds=['formatted-json'];
  const wrongRevision='v1:'+'c'.repeat(64);targetPayload.checkerRevision=wrongRevision;syncTarget();policy.checkerRevision=wrongRevision;requirementPayload.checkers[0].revision=wrongRevision;
  requirementPayload.contracts[0].checks[0].revision=wrongRevision;policy.sourceRevision='generated-json:'+hash(JSON.stringify({inputSha256,targetId:'formatted-json',producerTaskId:'produce-json',checkerRevision:wrongRevision,parametersDigest}));
  const checkerArtifact=JSON.parse(rows.artifact[1].content);checkerArtifact.value.result.observations.CUE_MODEL_BOUNDARY.checkerCoreSha256='c'.repeat(64);rows.artifact[1].content=JSON.stringify(checkerArtifact);syncRequirements();
  expect(audit).toThrow('checker_qualification_pins');
});

test('v2 auditor rejects mutated policy input target and checker lineage',()=>{
  const source=readFileSync(new URL('../../scripts/reuse/local-json-electron-gate-v2.mjs',import.meta.url),'utf8');
  expect(source).toContain('evidence_policy_source_binding'); expect(source).toContain('strict_requirement_lineage'); expect(source).toContain('strict_identity_cleanup_lineage');
  expect(source).toContain("requirement_contract_binding"); expect(source).toContain("native_execution_identity");
  for(const field of ['inputSha256:target.inputSha256','targetId:target.targetId','checkerRevision:target.checkerRevision','parametersDigest:target.parametersDigest'])expect(source).toContain(field);
});
