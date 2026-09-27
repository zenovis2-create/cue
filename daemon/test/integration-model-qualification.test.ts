import { afterEach, expect, test } from 'vitest';
import { resolve, join } from 'node:path';
import { openLedger, type Ledger } from '../src/ledger.js';
import { SUBJECT_FIELDS, subjectDigest, type MeasurementSubject } from '../src/measurement-subject.js';
import { measureModelControlBundle } from '../src/model-control-bundle.js';
import { createModelQualification, measureModelDiagnosticBundle } from '../src/model-qualification.js';
import { createCapabilityEvidenceStore } from '../src/capability-store.js';

const ledgers: Ledger[] = [];
afterEach(() => { for (const db of ledgers.splice(0)) db.close(); });
function fixture(kind: 'model'|'json-checker'|'goal-proposal-checker' = 'model') {
  const db = openLedger(); ledgers.push(db);
  const controlBundle = measureModelControlBundle({controlRoot: resolve('src'), nodeExecutable: process.execPath, clientKind: kind});
  const subject = Object.fromEntries(SUBJECT_FIELDS.map(k=>[k,'a'.repeat(64)])) as MeasurementSubject;
  return { db, controlBundle, diagnosticBundle: measureModelDiagnosticBundle(resolve('src'),controlBundle),
    measurement: {installRoot:resolve('..'),kind,nodeExecutable:process.execPath,
      powershellExecutable:join(process.env.SystemRoot!,'System32','WindowsPowerShell','v1.0','powershell.exe'),
      sqliteNativePath:'fixture-unused',dependencyRoot:'fixture-unused'},
    fixture: {measureSubject:()=>({subject,subjectDigest:subjectDigest(subject),manifest:{fixture:true}}),
      transport: async function* () { yield {type:'text' as const,text:'OK'}; yield {type:'terminal' as const,status:'completed' as const,reason:'stop' as const,providerStopped:'unknown' as const}; }} };
}
test('outer transaction and pre-abort refuse before owned launch or evidence', async () => {
  const host=fixture(), collector=createModelQualification(host);
  host.db.exec('BEGIN'); await expect(collector.collect()).rejects.toThrow('qualification_outer_transaction'); host.db.exec('ROLLBACK');
  await expect(collector.collect({signal:AbortSignal.abort()})).rejects.toThrow();
  expect(host.db.prepare('SELECT COUNT(*) n FROM session_handle').get()).toEqual({n:0});
  expect(host.db.prepare('SELECT COUNT(*) n FROM capability_evidence').get()).toEqual({n:0});
});

test('protected installation guard refuses false and thenable before owned launch', async () => {
  const host = fixture();
  for (const guard of [() => false, () => Promise.resolve(true), () => { throw Error('generation-drift'); }]) {
    await expect(createModelQualification({ ...host, assertInstallationCurrent: guard as any }).collect()).rejects.toThrow();
  }
  expect(host.db.prepare('SELECT COUNT(*) n FROM task').get()).toEqual({ n: 0 });
  expect(host.db.prepare('SELECT COUNT(*) n FROM capability_evidence').get()).toEqual({ n: 0 });
});

test.skipIf(process.platform !== 'win32')('protected source drift immediately before issuance retains raw evidence but issues no capability', async () => {
  const host = fixture('json-checker'); let checks = 0;
  await expect(createModelQualification({ ...host, assertInstallationCurrent() {
    if (++checks === 2) throw Error('generation-drift-before-issuance'); return true;
  } }).collect()).rejects.toThrow('generation-drift-before-issuance');
  expect(checks).toBe(2);
  expect((host.db.prepare('SELECT COUNT(*) n FROM artifact').get() as { n: number }).n).toBeGreaterThan(0);
  expect(host.db.prepare('SELECT COUNT(*) n FROM capability_evidence').get()).toEqual({ n: 0 });
}, 60000);
test.skipIf(process.platform!=='win32').each(['model','json-checker','goal-proposal-checker'] as const)('%s fresh fixed production plus pinned diagnostics persist owned raw bytes, cleanup and fixture-only references', async kind => {
  const host=fixture(kind), result=await createModelQualification(host).collect();
  const journal=kind==='goal-proposal-checker' ? host.db.prepare("SELECT content FROM artifact WHERE task_id=? AND kind='model-qualification-raw'").all(result.taskId) : null;
  expect(result.failure,JSON.stringify(journal)).toBeNull(); expect(result.allClean).toBe(true);
  expect(result.statuses).toEqual({M1:'pass',M2:'pass',M3:'pass'}); expect(result.eligible).toBe(false); expect(result.kind).toBe('fixture');
  const store=createCapabilityEvidenceStore(host.db,Date.now);
  for(const ref of Object.values(result.references)) expect(JSON.parse(Buffer.from(store.resolveEvidence(ref)!).toString())).toMatchObject({kind:'fixture',status:'pass'});
  expect((host.db.prepare('SELECT COUNT(*) n FROM artifact WHERE task_id=?').get(result.taskId) as {n:number}).n).toBeGreaterThan(4);
  expect((host.db.prepare('SELECT COUNT(*) n FROM session_handle WHERE task_id=?').get(result.taskId) as {n:number}).n).toBeGreaterThanOrEqual(5);
  if(kind==='goal-proposal-checker') {
    const rows=host.db.prepare("SELECT content FROM artifact WHERE task_id=? AND kind='model-qualification-raw'").all(result.taskId) as {content:string}[];
    for(const [stage,status,reason] of [['production-pass','pass','structural_match'],['production-fail','fail','checker_registry'],['production-unknown','unknown','input_contract']]) {
      const observed=rows.map(row=>JSON.parse(row.content)).find(row=>row.stage===stage)?.value;
      expect(observed?.result?.checkerVerdict).toMatchObject({contract:'cue-goal-proposal-v1',status,reason});
      expect(observed?.result?.providerStopped).toBe('unknown');
      expect(observed?.cleanup?.result).toBe('verified-clean');
    }
  }
},60000);
test('fixture model refuses missing transport and changed pin before creating a task', async () => {
  const host=fixture();
  expect(()=>createModelQualification({...host,fixture:{measureSubject:host.fixture.measureSubject}})).toThrow('qualification_fixture_transport_required');
  await expect(createModelQualification({...host,diagnosticBundle:{...host.diagnosticBundle,clientSha256:'0'.repeat(64)}}).collect()).rejects.toThrow('qualification_pin_drift');
  expect(host.db.prepare('SELECT COUNT(*) n FROM task').get()).toEqual({n:0});
});
test.skipIf(process.platform!=='win32')('subject drift after owned measurements cannot issue any pass',async()=>{
  const host=fixture(); let changed=false;
  const result=await createModelQualification({...host,fixture:{...host.fixture,beforePublish:()=>{changed=true;},measureSubject:()=>{
    const original=host.fixture.measureSubject(); return {...original,manifest:{fixture:true,changed}};
  }}}).collect();
  expect(result.failure).toContain('qualification_subject_drift');expect(result.eligible).toBe(false);
  expect(Object.values(result.statuses)).toEqual(['unknown','unknown','unknown']);
},60000);
test.skipIf(process.platform!=='win32')('raw journal tampering rolls back all capability issuance', async () => {
  const host=fixture();
  const collector=createModelQualification({...host,fixture:{...host.fixture,beforePublish:()=>{host.db.prepare("UPDATE artifact SET content='tampered' WHERE kind='model-qualification-raw'").run();}}});
  await expect(collector.collect()).rejects.toThrow('qualification_journal_drift');
  expect(host.db.prepare('SELECT COUNT(*) n FROM capability_evidence').get()).toEqual({n:0});
},60000);

test('goal control pins cannot be mislabeled as JSON production qualification',()=>{
  const host=fixture('json-checker');
  const controlBundle=measureModelControlBundle({controlRoot:resolve('src'),nodeExecutable:process.execPath,clientKind:'goal-proposal-checker'});
  const diagnosticBundle=measureModelDiagnosticBundle(resolve('src'),controlBundle);
  expect(()=>createModelQualification({...host,controlBundle,diagnosticBundle})).toThrow('control_bundle_invalid');
  expect(host.db.prepare('SELECT COUNT(*) n FROM task').get()).toEqual({n:0});
  expect(host.db.prepare('SELECT COUNT(*) n FROM capability_evidence').get()).toEqual({n:0});
});
