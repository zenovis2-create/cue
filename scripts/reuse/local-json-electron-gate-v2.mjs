// PREPARED ONLY: execution requires root-approved frozen identities. No retries,
// resume, installation, build, alternate DB, or standalone qualification launch.
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(import.meta.url), root = resolve(dirname(script), '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const CONTRACT = Object.freeze({ version: 'cue-local-json-electron-gate-v2', qualificationProcesses: 1, workflowProcesses: 1,
  maxQwenRequests: 2, maxWorkflowInvocations: 2, timeoutMs: 120000, maxOutputBytes: 65536, maxOutputTokens: 2048,
  qualificationDeadlineMs: 480000, workflowDeadlineMs: 210000, input: '{"cue":"electron-gate","value":1}',
  expectedOutput: '{\n  "cue": "electron-gate",\n  "value": 1\n}' });
export function parseExecutionArgs(args) {
  if (args.length !== 5 || args[0] !== '--execute-approved-electron-gate' || args[1] !== '--script-sha256' || args[3] !== '--installation-digest'
    || !/^[a-f0-9]{64}$/.test(args[2]) || !/^[a-f0-9]{64}$/.test(args[4])) throw Error('electron_gate_explicit_frozen_authority_required');
  return { scriptSha256: args[2], installationDigest: args[4] };
}
/** Read-only readiness observation. It never starts Electron, native helpers, or inference. */
export async function zeroInferencePreflight() {
  const { captureInstallationIdentity } = await import('../../app/installation-identity.mjs');
  const generation = captureInstallationIdentity({ root: realpathSync(root), dependencyRoot: realpathSync(join(root, 'daemon/node_modules')) });
  const response=await fetch('http://127.0.0.1:8085/v1/models',{method:'GET',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('electron_gate_model_inventory_unavailable');
  const value=await response.json(),ids=Array.isArray(value?.data)?value.data.map(item=>item?.id):[];
  assert(ids.includes('qwen38-27b-unc'),'electron_gate_model_inventory_mismatch');
  generation.assertCurrent();
  return Object.freeze({version:CONTRACT.version,scriptSha256:hash(readFileSync(script)),installationDigest:generation.digest,modelId:'qwen38-27b-unc',inferenceRequests:0,nativeProcesses:0});
}
export function cleanChildEnvironment(source, data, observer) {
  const env = { ...source };
  for (const key of Object.keys(env)) if (['node_options', 'electron_run_as_node', 'cue_live_run', 'cue_user_data', 'cue_worktree_root'].includes(key.toLowerCase())) delete env[key];
  env.CUE_USER_DATA = data;
  if (observer) env.NODE_OPTIONS = '--require ' + JSON.stringify(observer);
  return env;
}
export function assertOwnedProfile(profile, data) {
  if (!profile || profile.userData !== data || profile.sessionData !== join(data, 'electron-session')) throw Error('electron_owned_profile_unverified');
}
export function observerSource(output) {
  return `// Owned QA observer is EXTRA TRUSTED TCB, outside production capture.
// No app/core/admission/executor imports or replacements; actual DOM/preload only.
const fs=require('node:fs');
setImmediate(()=>{if(process.type!=='browser')return;const {app,BrowserWindow}=require('electron');
void(async()=>{const record={kind:'actual-default-electron-dom',passed:false,runtime:{electron:process.versions.electron??null,node:process.versions.node,abi:process.versions.modules}};let win;
const until=Date.now()+180000;const pause=()=>new Promise(r=>setTimeout(r,100));
try{if(!record.runtime.electron)throw Error('actual_electron_required');await app.whenReady();record.profile={userData:app.getPath('userData'),sessionData:app.getPath('sessionData')};while(!win&&Date.now()<until){win=BrowserWindow.getAllWindows().find(w=>!w.isDestroyed());if(!win)await pause();}
if(!win)throw Error('main_window_missing');while(win.webContents.isLoading()&&Date.now()<until)await pause();
const evaluate=s=>win.webContents.executeJavaScript(s);
while(Date.now()<until&&!await evaluate("typeof window.cue?.prepareJson==='function'&&!document.querySelector('#selection-mode').disabled"))await pause();
await evaluate(${JSON.stringify(`document.querySelector('#task-template').value='generated-json-v1';document.querySelector('#task-template').dispatchEvent(new Event('change'));document.querySelector('#json-input').value=${JSON.stringify(CONTRACT.input)};document.querySelector('#selection-mode').value='efficiency';document.querySelector('#goal-form').requestSubmit();true`)});
while(Date.now()<until&&await evaluate("document.querySelector('#approve').disabled"))await pause();
if(Date.now()>=until)throw Error('prepare_timeout');
record.approval=await evaluate("({scope:document.querySelector('#envelope').textContent,plan:document.querySelector('#approval-plan').textContent,generated:document.querySelector('#approval-generated').textContent})");
await evaluate("document.querySelector('#approve').click();true");
while(Date.now()<until){const state=await evaluate("document.querySelector('#result').dataset.state");if(['completed','blocked','failed'].includes(state)){record.state=state;break;}await pause();}
if(!record.state)throw Error('workflow_timeout');
record.dom=await evaluate("({title:document.querySelector('#state-title').textContent,acceptance:document.querySelector('#orchestration-acceptance').textContent,body:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth})");
record.passed=record.state==='completed';
}catch(e){record.error=String(e).slice(0,1000);try{if(win)await win.webContents.executeJavaScript("document.querySelector('#stop').click();true");}catch{}}
finally{if(win&&!win.isDestroyed()){try{await win.webContents.executeJavaScript("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");win.webContents.debugger.attach('1.3');const shot=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png'});fs.writeFileSync(${JSON.stringify(join(output, 'workflow.png'))},Buffer.from(shot.data,'base64'));win.webContents.debugger.detach();record.screenshot=true;}catch(e){record.screenshotError=String(e).slice(0,200);}}
fs.writeFileSync(${JSON.stringify(join(output, 'observer.json'))},JSON.stringify(record,null,2));app.quit();}
})();});\n`;
}
function executeChild(executable, args, env, deadline, output, name) {
  return new Promise(resolveResult => {
    const child = spawn(executable, args, { cwd: root, env, windowsHide: name !== 'workflow', stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false, termination = null, closed = false;
    const add = (which, chunk) => { if (which === 'out') stdout = (stdout + chunk).slice(-1048576); else stderr = (stderr + chunk).slice(-1048576); };
    child.stdout.on('data', chunk => add('out', chunk)); child.stderr.on('data', chunk => add('err', chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid && !closed) {
        const taskkill = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe');
        const killed = spawnSync(taskkill, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 10000, encoding: 'utf8' });
        termination = { status: killed.status, error: killed.error ? 'termination_unknown' : null };
      }
    }, deadline);
    child.once('error', error => { stderr += '\n' + String(error); });
    const hardDeadline = setTimeout(() => {
      if (closed) return; closed = true; child.stdout.destroy(); child.stderr.destroy(); child.unref();
      writeFileSync(join(output, name + '.stdout.log'), stdout); writeFileSync(join(output, name + '.stderr.log'), stderr);
      resolveResult({ pid: child.pid ?? null, code: null, closed: false, timedOut: true, termination, stdout });
    }, deadline + 15000);
    child.once('close', (code, signal) => { if (closed) return; closed = true; clearTimeout(timer); clearTimeout(hardDeadline);
      writeFileSync(join(output, name + '.stdout.log'), stdout); writeFileSync(join(output, name + '.stderr.log'), stderr);
      resolveResult({ pid: child.pid ?? null, code, signal, closed: true, timedOut, termination, stdout });
    });
  });
}
const assert = (condition, code) => { if (!condition) throw Error(code); };
export async function backupClosedLedger(source, destination) {
  const { DatabaseSync, backup } = await import('node:sqlite');
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    assert(db.prepare('PRAGMA integrity_check').all().every(row => row.integrity_check === 'ok'), 'source_ledger_integrity');
    await backup(db, destination);
  } finally { db.close(); }
  const copied = new DatabaseSync(destination, { readOnly: true });
  try { assert(copied.prepare('PRAGMA integrity_check').all().every(row => row.integrity_check === 'ok'), 'backup_ledger_integrity'); }
  finally { copied.close(); }
  return hash(readFileSync(destination));
}
function readRows(db) {
  const tables = ['task','run','artifact','capability_evidence','orchestration_attempt','orchestration_receipt','requirement_contract_binding','generated_output_target','generated_output_observation','acceptance_evaluation','acceptance_final','cleanup_observation','native_execution_identity','session_handle','local_invocation_budget','local_invocation_reservation','integration_budget_reservation','integration_budget_receipt','workspace_write_lease'];
  return Object.fromEntries(tables.map(table => [table, db.prepare('SELECT * FROM ' + table).all()]));
}
export function auditLedgerRows(rows, phase, expectedCheckerRevision) {
  assert(/^v1:[a-f0-9]{64}$/.test(expectedCheckerRevision),'expected_checker_revision_required');
  const qualificationRequests = rows.artifact.filter(row => row.kind === 'model-qualification-raw').map(row => ({ row, data: JSON.parse(row.content) })).filter(x => x.data.stage === 'production-model');
  assert(qualificationRequests.length === 1 && qualificationRequests[0].data.value.result.outcome === 'succeeded', 'qualification_request_count_or_outcome');
  const checkerQualifications=rows.artifact.filter(row=>row.kind==='model-qualification-raw').map(row=>JSON.parse(row.content)).filter(data=>data.stage==='production-pass'
    &&data.value?.result?.outcome==='succeeded'&&data.value.result.observations?.CUE_MODEL_BOUNDARY?.clientKind==='json-checker');
  assert(checkerQualifications.length===1&&/^[a-f0-9]{64}$/.test(checkerQualifications[0].value.result.observations.CUE_MODEL_BOUNDARY.checkerCoreSha256),'checker_qualification_pins');
  assert('v1:'+checkerQualifications[0].value.result.observations.CUE_MODEL_BOUNDARY.checkerCoreSha256===expectedCheckerRevision,'checker_qualification_pins');
  assert(rows.capability_evidence.length === 6 && new Set(rows.capability_evidence.map(row => row.subject_digest)).size === 2, 'qualification_evidence_count');
  for (const item of rows.capability_evidence) {
    assert(hash(item.payload) === item.payload_sha256 && hash(item.observation) === item.observation_sha256, 'qualification_evidence_hash');
    const payload = JSON.parse(Buffer.from(item.payload).toString());
    assert(payload.kind === 'live' && payload.status === 'pass', 'fixture_or_nonpass_evidence_forbidden');
  }
  if (phase === 'qualification') { assert(rows.orchestration_attempt.length === 0, 'unexpected_preworkflow_attempt'); return { rows, qualificationArtifacts: 1, expectedCheckerRevision }; }
  const attempts = rows.orchestration_attempt;
  assert(attempts.length === 2 && attempts.filter(a => a.task_id === 'produce-json').length === 1 && attempts.filter(a => a.task_id === 'verify-json').length === 1, 'workflow_attempt_count');
  assert(attempts.find(a=>a.task_id==='produce-json')?.candidate_id==='cue.local.qwen38-27b-unc'
    &&attempts.find(a=>a.task_id==='verify-json')?.candidate_id==='cue.checker.json-format','workflow_candidate_identity');
  assert(attempts.every(a => a.state === 'completed' && a.cleanup_verified === 1), 'workflow_execution_or_cleanup');
  const producer = attempts.find(a => a.task_id === 'produce-json'), runId = producer.run_id;
  assert(attempts.every(a => a.run_id === runId), 'workflow_run_mismatch');
  const output = rows.generated_output_observation;
  assert(output.length === 1 && output[0].attempt_id === producer.attempt_id && Buffer.from(output[0].bytes).toString() === CONTRACT.expectedOutput, 'generated_output_bytes');
  assert(rows.generated_output_target.length === 1 && Buffer.from(rows.generated_output_target[0].input_bytes).toString() === CONTRACT.input, 'approved_input_bytes');
  const targetRow = rows.generated_output_target[0],target=targetRow&&JSON.parse(Buffer.from(targetRow.payload).toString());
  assert(targetRow?.run_id === runId && output[0].run_id === runId && targetRow.target_id === 'formatted-json' && output[0].target_id === targetRow.target_id
    &&target.runId===targetRow.run_id&&target.targetId===targetRow.target_id&&hash(Buffer.from(targetRow.payload))===targetRow.digest
    &&target.inputSha256===hash(targetRow.input_bytes)&&target.inputByteLength===Buffer.from(targetRow.input_bytes).byteLength,'target_observation_lineage');
  assert(rows.requirement_contract_binding.length===1&&rows.requirement_contract_binding[0].run_id===runId,'requirements_binding_count');
  const binding=JSON.parse(Buffer.from(rows.requirement_contract_binding[0].payload).toString()),policy=binding.evidencePolicies?.[0],contract=binding.contracts?.[0],check=contract?.checks?.[0];
  assert(binding.evidencePolicies?.length===1&&binding.checkers?.length===1&&binding.checkers[0].evidencePolicies?.length===1,'evidence_policy_count');
  assert(contract?.id==='json-format'&&contract.kind==='document'&&contract.required===true&&contract.checks?.length===1,'requirement_contract_lineage');
  assert(target.checkerRevision===expectedCheckerRevision,'checker_revision_qualification_mismatch');
  assert(policy?.requirementId===contract.id&&policy.kind===contract.kind&&JSON.stringify(policy.producerTaskIds)===JSON.stringify(['produce-json'])
    &&JSON.stringify(policy.targetIds)===JSON.stringify([target.targetId])&&policy.checkerId===target.checkerId&&policy.checkerRevision===target.checkerRevision
    &&policy.parametersDigest===target.parametersDigest&&check.checkerId===policy.checkerId&&check.revision===policy.checkerRevision&&check.parametersDigest===policy.parametersDigest
    &&JSON.stringify(check.targetIds)===JSON.stringify(policy.targetIds)&&JSON.stringify(policy.requiredSectionIds)===JSON.stringify(['json-document'])&&policy.requiresRender===false,'evidence_policy_target_binding');
  const expectedSource='generated-json:'+hash(JSON.stringify({inputSha256:target.inputSha256,targetId:target.targetId,producerTaskId:target.producerTaskId,checkerRevision:target.checkerRevision,parametersDigest:target.parametersDigest}));
  assert(policy.sourceRevision===expectedSource&&binding.checkers[0].id===policy.checkerId&&binding.checkers[0].revision===policy.checkerRevision
    &&JSON.stringify(binding.checkers[0].evidencePolicies)===JSON.stringify([policy]),'evidence_policy_source_binding');
  assert(rows.acceptance_final.length === 1 && rows.acceptance_final[0].run_id === runId && JSON.parse(rows.acceptance_final[0].payload).status === 'accepted'
    && rows.acceptance_evaluation.some(e => e.id === rows.acceptance_final[0].evaluation_id && e.run_id === runId), 'acceptance_missing');
  for (const row of [...rows.acceptance_final, ...rows.acceptance_evaluation]) assert(hash(row.payload) === row.payload_sha256, 'acceptance_hash');
  assert(rows.orchestration_receipt.length === 2, 'cleanup_receipt_count');
  const workflowAttemptIds=new Set(attempts.map(attempt=>attempt.attempt_id)),workflowIdentities=rows.native_execution_identity.filter(identity=>workflowAttemptIds.has(identity.run_id));
  assert(workflowIdentities.length===2&&new Set(workflowIdentities.map(identity=>identity.run_id)).size===2&&rows.session_handle.length>=2,'native_identity_count');
  for (const row of rows.orchestration_receipt) {
    const receipt = JSON.parse(row.payload), digest = receipt.evidenceRef?.replace(/^cue-cleanup:/, ''), observation = rows.cleanup_observation.find(x => x.sha256 === digest);
    assert(observation && hash(observation.payload) === digest, 'cleanup_observation_hash');
    const data = JSON.parse(Buffer.from(observation.payload).toString()),attempt=attempts.find(a=>a.attempt_id===row.attempt_id);
    const identity=workflowIdentities.find(x=>x.run_id===row.attempt_id),native=identity&&JSON.parse(Buffer.from(identity.payload).toString()),session=rows.session_handle.find(x=>x.handle===data.session?.handle);
    assert(data.runId === row.attempt_id && data.result === 'verified-clean'&&attempt&&identity&&native?.runId===row.attempt_id
      &&native.candidateId===attempt.candidate_id&&data.candidateId===attempt.candidate_id&&session
      &&['handle','pid','start_time','cwd','task_id','run_id'].every(key=>data.session?.[key]===session[key]&&native.session?.[key]===session[key]), 'cleanup_observation_identity');
  }
  assert(rows.local_invocation_reservation.length === 2 && rows.local_invocation_reservation.every(r => r.run_id === runId), 'local_count_reservation');
  assert(rows.local_invocation_budget.length === 1 && rows.local_invocation_budget[0].limit_count === 2, 'local_count_limit');
  assert(rows.integration_budget_reservation.length === 0 && rows.integration_budget_receipt.length === 0, 'invented_monetary_accounting');
  assert(rows.workspace_write_lease.length === 0, 'unexpected_writer');
  return { rows, runId, qualificationArtifacts: 1, observedWorkflowProducerAttempts: 1, localInvocations: 2, providerHttpRequestCount: null, outputSha256: hash(output[0].bytes), accepted: true };
}
/** Offline-only replay of a closed ledger. No executor, cleanup, or process API is reachable. */
export async function reauditClosedLedger(ledger,expectedCheckerRevision){
  const {DatabaseSync}=await import('node:sqlite'),raw=new DatabaseSync(ledger,{readOnly:true});let rows,audited;
  try{assert(raw.prepare('PRAGMA integrity_check').all().every(row=>row.integrity_check==='ok'),'source_ledger_integrity');rows=readRows(raw);audited=auditLedgerRows(rows,'workflow',expectedCheckerRevision);}finally{raw.close();}
  const SQLite=createRequire(join(root,'daemon/package.json'))('better-sqlite3'),strict=new SQLite(ledger,{readonly:true,fileMustExist:true});
  try{
    const {readAcceptanceHistory}=await import('../../daemon/dist/src/verification/acceptance.js'),{createGeneratedOutputStore}=await import('../../daemon/dist/src/verification/generated-output.js');
    const {createRequirementContractStore}=await import('../../daemon/dist/src/verification/requirements.js'),{createNativeExecutionIdentityStore}=await import('../../daemon/dist/src/native-execution-identity-store.js');
    const {createCleanupObservationStore}=await import('../../daemon/dist/src/cleanup-observation-store.js'),acceptance=readAcceptanceHistory(strict,audited.runId);
    assert(acceptance?.receipt?.status==='accepted'&&acceptance.verdict==='pass'&&acceptance.outcomes.every(outcome=>!outcome.required||outcome.verdict==='pass'),'strict_acceptance_lineage');
    const producer=rows.orchestration_attempt.find(a=>a.task_id==='produce-json'),captured=createGeneratedOutputStore(strict,{now:Date.now,authorizeObservation:()=>false}).read(audited.runId,'formatted-json',producer.attempt_id);
    assert(captured&&Buffer.from(captured.bytes).toString()===CONTRACT.expectedOutput,'strict_generated_lineage');
    assert(createRequirementContractStore(strict,{now:Date.now,resolveChecker:()=>undefined}).read(audited.runId)?.requirements.evidencePolicies.length===1,'strict_requirement_lineage');
    const identities=createNativeExecutionIdentityStore(strict),cleanups=createCleanupObservationStore(strict);
    for(const receipt of rows.orchestration_receipt){const payload=JSON.parse(receipt.payload),identityRow=rows.native_execution_identity.find(i=>i.run_id===receipt.attempt_id);
      assert(identityRow&&identities.read('cue-native-identity:'+identityRow.sha256)&&payload.evidenceRef&&cleanups.read(payload.evidenceRef),'strict_identity_cleanup_lineage');}
    return Object.freeze({...audited,rows:undefined,strictReaders:true,ledgerSha256:hash(readFileSync(ledger))});
  }finally{strict.close();}
}
async function main() {
  const approval = parseExecutionArgs(process.argv.slice(2));
  assert(hash(readFileSync(script)) === approval.scriptSha256, 'gate_script_drift');
  const { captureInstallationIdentity } = await import('../../app/installation-identity.mjs');
  const generation = captureInstallationIdentity({ root: realpathSync(root), dependencyRoot: realpathSync(join(root, 'daemon/node_modules')) });
  assert(generation.digest === approval.installationDigest, 'installation_manifest_drift');
  const owned = mkdtempSync(join(tmpdir(), 'Cue.ElectronGateV2.')), data = join(owned, 'data'), workspace = join(owned, 'workspace'), output = join(owned, 'evidence');
  [data, workspace, output].forEach(path => mkdirSync(path));
  const record = { ...CONTRACT, passed: false, owned, approval, parentGeneration: generation.snapshot,
    limits: ['Parent Node generation differs from child Electron runtime; compare file stability only.', 'Workflow observer is extra trusted QA code, not qualification loaded-closure proof.', 'Visible actual application; no host/admission replacement.', 'Counts use fixed no-retry source contracts plus actual production journals/output observations; no provider-side HTTP request counter is available.', 'No comparative mode, price, provider stop or capacity claim.'] };
  const json = value => JSON.stringify(value, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n';
  const write = (name, value) => writeFileSync(join(output, name), json(value));
  const require = createRequire(join(root, 'package.json')), electron = require('electron');
  const ledger = join(data, 'cue-ledger.sqlite'); let setup;
  async function closedAudit(phase) {
    const { DatabaseSync } = await import('node:sqlite'), db = new DatabaseSync(ledger, { readOnly: true });
    try {
      assert(db.prepare('PRAGMA integrity_check').all().every(row => row.integrity_check === 'ok'), 'source_ledger_integrity');
      const rows = readRows(db); write(phase + '-raw-ledger.json', rows); const audited = auditLedgerRows(rows, phase,record.expectedCheckerRevision);
      if (phase === 'workflow') {
        // Existing strict historical readers require Ledger.transaction and Buffer
        // rows. Use the already measured daemon loader, readonly; no mock shim.
        const SQLite = createRequire(join(root, 'daemon/package.json'))('better-sqlite3');
        const strict = new SQLite(ledger, { readonly: true, fileMustExist: true });
        try {
          const { readAcceptanceHistory } = await import('../../daemon/dist/src/verification/acceptance.js');
          const { createGeneratedOutputStore } = await import('../../daemon/dist/src/verification/generated-output.js');
          const { createRequirementContractStore } = await import('../../daemon/dist/src/verification/requirements.js');
          const { createNativeExecutionIdentityStore } = await import('../../daemon/dist/src/native-execution-identity-store.js');
          const { createCleanupObservationStore } = await import('../../daemon/dist/src/cleanup-observation-store.js');
          const acceptance = readAcceptanceHistory(strict, audited.runId);
          assert(acceptance?.receipt?.status === 'accepted' && acceptance.verdict === 'pass' && acceptance.outcomes.every(outcome => !outcome.required || outcome.verdict === 'pass'), 'strict_acceptance_lineage');
          const producer = rows.orchestration_attempt.find(a => a.task_id === 'produce-json');
          const captured = createGeneratedOutputStore(strict, { now: Date.now, authorizeObservation: () => false }).read(audited.runId, 'formatted-json', producer.attempt_id);
          assert(captured && Buffer.from(captured.bytes).toString() === CONTRACT.expectedOutput, 'strict_generated_lineage');
          const requirements=createRequirementContractStore(strict,{now:Date.now,resolveChecker:()=>undefined}).read(audited.runId);
          assert(requirements?.requirements.evidencePolicies.length===1,'strict_requirement_lineage');
          const identities=createNativeExecutionIdentityStore(strict),cleanups=createCleanupObservationStore(strict);
          for(const receipt of rows.orchestration_receipt){const payload=JSON.parse(receipt.payload),attempt=rows.orchestration_attempt.find(a=>a.attempt_id===receipt.attempt_id);
            const identityRow=rows.native_execution_identity.find(i=>i.run_id===receipt.attempt_id),identity=identityRow&&identities.read('cue-native-identity:'+identityRow.sha256);
            const cleanup=payload.evidenceRef&&cleanups.read(payload.evidenceRef);assert(attempt&&identity&&cleanup,'strict_identity_cleanup_lineage');}
          audited.strictAcceptance = acceptance; audited.generatedCapture = captured.record;
        } finally { strict.close(); }
      }
      return audited;
    }
    finally { db.close(); }
  }
  try {
    const { openLedger } = await import('../../daemon/dist/src/ledger.js');
    const { configureLocalJsonSettings } = await import('../../daemon/dist/src/selection/local-host-settings.js');
    writeFileSync(join(data, 'cue-config.json'), json({ version: 1, ledgerPath: ledger, worktreeRoot: realpathSync(workspace) }));
    setup = openLedger(ledger);
    configureLocalJsonSettings(setup, { expectedRevision: null, enabled: true, limits: { maxInvocations: 2, timeoutMs: 120000, maxOutputBytes: 65536, maxOutputTokens: 2048 }, createdAt: new Date().toISOString() });
    setup.close(); setup = null; generation.assertCurrent();
    record.expectedCheckerRevision='v1:'+hash(readFileSync(join(root,'daemon','dist','src','verification','json-format-checker.cjs'))); generation.assertCurrent();
    record.qualification = await executeChild(electron, [join(root, 'app/qualification-start.mjs'), '--generated-json-qualify'], cleanChildEnvironment(process.env, data), CONTRACT.qualificationDeadlineMs, output, 'qualification');
    assert(record.qualification.closed, 'qualification_process_cleanup_unresolved');
    record.qualificationAudit = await closedAudit('qualification');
    assert(record.qualification.code === 0 && !record.qualification.timedOut, 'qualification_process_failed');
    const summary = record.qualification.stdout.split(/\r?\n/).filter(line => line.startsWith('{')).map(line => { try { return JSON.parse(line); } catch { return null; } }).find(x => x?.version === 'cue-qualification-exit-v1');
    assert(summary?.eligible && summary.cleanup === 'confirmed' && typeof summary.runtime?.electron === 'string', 'qualification_summary_or_electron_unverified');
    assertOwnedProfile(summary.profile, data); record.qualificationProfile = summary.profile;
    record.qualificationRuntime = summary.runtime; generation.assertCurrent();
    const observer = join(output, 'observer.cjs'); writeFileSync(observer, observerSource(output)); record.observerSha256 = hash(readFileSync(observer));
    assert(hash(readFileSync(observer)) === record.observerSha256, 'observer_drift');
    record.workflow = await executeChild(electron, ['.'], cleanChildEnvironment(process.env, data, observer), CONTRACT.workflowDeadlineMs, output, 'workflow');
    assert(record.workflow.closed, 'workflow_process_cleanup_unresolved');
    const audited = await closedAudit('workflow'); write('workflow-ledger.json', audited); record.audit = { ...audited, rows: undefined };
    generation.assertCurrent();
    assert(record.workflow.code === 0 && !record.workflow.timedOut, 'workflow_process_failed');
    assert(hash(readFileSync(observer)) === record.observerSha256, 'observer_drift');
    record.observer = JSON.parse(readFileSync(join(output, 'observer.json'), 'utf8')); assert(record.observer.passed && record.observer.runtime?.electron, 'workflow_dom_or_actual_electron_unverified');
    assertOwnedProfile(record.observer.profile, data);
    assert(JSON.stringify(record.observer.runtime) === JSON.stringify(record.qualificationRuntime), 'electron_runtime_between_phases_drift');
    record.passed = true;
  } catch (error) { record.error = String(error).slice(0,2000); }
  finally {
    setup?.close();
    try { generation.assertCurrent(); record.finalGenerationDigest = generation.digest; } catch { record.passed = false; record.sourceDrift = true; }
    if ((record.workflow ?? record.qualification)?.closed) {
      try { record.ledgerSha256 = await backupClosedLedger(ledger, join(output, 'ledger.sqlite')); } catch { record.ledgerBackupFailed = true; record.passed = false; }
    }
    record.retainedOwnedPaths = true; // Keep failed native/DB evidence; no blind delete.
    write('result.json', record); console.log(json({ passed: record.passed, evidence: output, error: record.error ?? null }));
  }
  process.exitCode = record.passed ? 0 : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === script) void main().catch(error => { console.error(String(error)); process.exitCode = 1; });
