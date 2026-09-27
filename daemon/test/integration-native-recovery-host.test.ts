import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { openLedger, type Ledger } from '../src/ledger.js';
import { createNativeExecutionIdentityStore } from '../src/native-execution-identity-store.js';
import { validateTaskPlan } from '../src/orchestration/plan.js';
import { createNativeRecoveryHost } from '../../app/native-recovery-host.mjs';
import { captureInstallationIdentity, type InstallationGeneration } from '../../app/installation-identity.mjs';
import { createCueCore, AppDaemon } from '../../app/core.mjs';
import { registerIpcHandlers } from '../../app/ipc.mjs';
const mocks = vi.hoisted(() => ({ query: vi.fn(), stat: vi.fn(), fetch: vi.fn() }));
// These tests perform full installed-closure hashing before/after observations;
// five seconds limits only the OS phase, not synchronous installation hashing.
vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 });
// Use the actual source observer with explicit OS fixtures. The genuine installed
// generation below is captured post-import: this test is not fresh-entry proof.
vi.mock('../../daemon/dist/src/native-recovery-observer.js', async () => {
  const { createNativeRecoveryObserver } = await import('../src/native-recovery-observer.js');
  return { createNativeRecoveryObserver: (host: any) => createNativeRecoveryObserver({ ...host, fixture: { query: mocks.query, stat: mocks.stat } }) };
});
const roots: string[] = [], dbs: Ledger[] = [];
let guard: InstallationGeneration;
beforeAll(() => { guard = captureInstallationIdentity({ root: resolve('..'), dependencyRoot: resolve('node_modules') }); });
afterEach(() => {
  for (const db of dbs.splice(0)) if (db.open) db.close();
  for (const root of roots.splice(0)) { expect(dirname(resolve(root))).toBe(resolve(tmpdir())); expect(basename(root).startsWith('cue-recovery-host-')).toBe(true); rmSync(root, { recursive: true, force: true }); }
  vi.unstubAllGlobals();
});
const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
function fixture(parentId = 'workflow') {
  const root = mkdtempSync(join(tmpdir(), 'cue-recovery-host-')); roots.push(root);
  const workspace = join(root, 'workspace'); mkdirSync(workspace); mkdirSync(join(root,'data'));
  const config = { version: 1, ledgerPath: join(root, 'data', 'ledger.sqlite'), worktreeRoot: workspace };
  let db = openLedger(config.ledgerPath); const stageId = 'attempt-1', stageTask = 'stage-task-' + sha(stageId), candidate = 'cue.local.model';
  const pe = { allowed_actions: [], autonomy_level: 'bounded', egress: [], expires_at: '2000-01-01T00:00:00.000Z', run_id: parentId, worktree_realpath: workspace };
  const se = { ...pe, run_id: stageId, worktree_realpath: join(workspace, 'removed-stage') };
  const parentHash = sha(JSON.stringify(pe)), stageHash = sha(JSON.stringify(se));
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(parentHash, workspace, '[]', 'now');
  db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(stageHash, se.worktree_realpath, '[]', 'now');
  db.exec("INSERT INTO task VALUES('task','blocked','fixture','now'); INSERT INTO task VALUES('" + stageTask + "','blocked','fixture','now')");
  db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(parentId,'task',parentHash,'now'); db.prepare('INSERT INTO run VALUES(?,?,?,0,?)').run(stageId,stageTask,stageHash,'now');
  const approval = { policyRevision: 'fixture:1', policyDigest: 'a'.repeat(64), requirementIds: ['r'], allowedCandidateIds: [candidate,'checker'], allowedScopeIds: [] };
  const plan = validateTaskPlan(approval, { revision: '1', policyRevision: approval.policyRevision, policyDigest: approval.policyDigest, tasks: [
    { id: 'produce', role: 'model-producer', ownerId: 'producer', requirementIds: ['r'], dependencyIds: [], candidateIds: [candidate], scopeIds: [] },
    { id: 'verify', role: 'verifier', ownerId: 'checker', requirementIds: ['r'], dependencyIds: ['produce'], candidateIds: ['checker'], scopeIds: [] },
  ] });
  db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run(parentId,parentHash,plan.digest,JSON.stringify(plan));
  db.prepare('INSERT INTO orchestration_step VALUES(?,?,?)').run(parentId,'produce','blocked');
  const claim = { attemptId: stageId, candidateId: candidate, observedAtMs: 1, runId: parentId, taskId: 'produce' };
  db.prepare('INSERT INTO orchestration_attempt VALUES(?,?,?,?,?,?,?,?,0)').run(stageId,parentId,'produce',candidate,'blocked',JSON.stringify(claim),workspace,null);
  db.prepare('INSERT INTO orchestration_stage_envelope VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(stageId,parentId,'produce',stageTask,stageId,parentHash,stageHash,plan.digest,approval.policyDigest,JSON.stringify(pe),JSON.stringify(se),'[]',JSON.stringify({ workflowRunId:parentId,taskId:'produce',attemptId:stageId,parent:pe,stage:se }));
  const session = { handle:'session',pid:101,start_time:'wallclock',cwd:se.worktree_realpath,task_id:stageTask,run_id:stageId };
  db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(...Object.values(session));
  const profile = 'Cue.Model.' + 'a'.repeat(32), digest = 'a'.repeat(64);
  const identity = { version:'cue-native-execution-identity-v1' as const,runId:stageId,candidateId:candidate,role:'model' as const,subjectDigest:digest,session,
    processes:{launcher:{pid:101,createdFileTime:'134000000000000001'},client:{pid:102,createdFileTime:'134000000000000002'},guardian:{pid:103,createdFileTime:'134000000000000003'}},
    boundary:{profile,sid:'S-1-15-2-1-2',taskRoot:'C:\\Temp\\'+profile,profilePath:'C:\\Local\\Packages\\'+profile+'\\AC',clientKind:'model' as const,controlBundleSha256:digest,launcherSha256:digest,clientSha256:digest,guardianSha256:digest},observedAt:'2026-09-12T00:00:00.000Z'};
  const identityRef = createNativeExecutionIdentityStore(db).record(identity); db.close(); db = openLedger(config.ledgerPath); dbs.push(db);
  const daemon = { db, status:'ready', close:async()=>{db.close();}, hasUnsettledRun:()=>false } as any;
  mocks.query.mockReset().mockImplementation(async q => ({ version:q.version,nonce:q.nonce,temp:'C:\\Temp',localAppData:'C:\\Local',processes:q.processes.map((p:any)=>({pid:p.pid,createdFileTime:null,liveness:'absent'})) }));
  mocks.stat.mockReset().mockResolvedValue('absent'); mocks.fetch.mockReset(); vi.stubGlobal('fetch',mocks.fetch);
  const input = { runId:parentId,attemptId:stageId,identityRef };
  return { db,daemon,config,workspace,input,root,identity };
}
test('reopened Core scopes historical identity, works without settings/health, omits PID/paths and changes no DB bytes', async () => {
  const f = fixture(), host = createNativeRecoveryHost({ guard,daemon:f.daemon,worktree:f.workspace });
  const core = createCueCore(f.config,f.daemon,{ nativeRecoveryFactory: ({db,worktree}) => { expect(db).toBe(f.db); expect(worktree).toBe(f.workspace); return host; } });
  const before = sha(f.db.serialize()), changes = f.db.prepare('SELECT total_changes() n').get();
  const list = core.listNativeIdentities({runId:'workflow'}); expect(list.records).toHaveLength(1); expect(list.records[0]!.identityRef).toBe(f.input.identityRef);
  const result = await core.observeNativeRecovery(f.input);
  expect(result).toMatchObject({authority:'observation-only',sourceKind:'fixture',processes:{launcher:'absent',client:'absent',guardian:'absent'},pathProvenance:'matched',journal:{state:'unavailable'}});
  expect(Object.isFrozen(result.processes)).toBe(true); expect(JSON.stringify(result)).not.toContain('C:\\'); expect(JSON.stringify(result)).not.toContain('createdFileTime');
  expect(sha(f.db.serialize())).toBe(before); expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(changes); expect(mocks.fetch).not.toHaveBeenCalled();
});

test('historical run picker reopens same ledger through Core and IPC without observing or returning private metadata', async () => {
  const f = fixture(), host = createNativeRecoveryHost({guard,daemon:f.daemon,worktree:f.workspace});
  const core = createCueCore(f.config,f.daemon,{nativeRecoveryFactory:({db})=>{expect(db).toBe(f.db);return host;}});
  const before = sha(f.db.serialize()), changes = f.db.prepare('SELECT total_changes() n').get();
  const api = registerIpcHandlers({handle:vi.fn()},core);
  const reply = await api.invoke('cue:native-recovery',{operation:'runs'});
  expect(reply).toMatchObject({available:true,operation:'runs',value:{truncated:false,scanTruncated:false,records:[{
    runId:'workflow',state:'blocked',recordedAttemptCount:1,identityRecordCount:1,missingIdentityAttemptCount:0,missingStageLinkCount:0,recordStatus:'recorded-unverified',
  }]}});
  expect(reply.value.records).toHaveLength(1); expect(Object.isFrozen(reply.value.records[0])).toBe(true);
  expect(JSON.stringify(reply)).not.toMatch(/PID|pid|workspace|taskRoot|profile|subjectDigest|candidateId|fixture/);
  expect(sha(f.db.serialize())).toBe(before); expect(f.db.prepare('SELECT total_changes() n').get()).toEqual(changes);
  expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.stat).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
});

test('run picker separates empty records and missing stage links and reports bounded workspace scans', () => {
  const f = fixture(), host = createNativeRecoveryHost({guard,daemon:f.daemon,worktree:f.workspace});
  const parent = f.db.prepare("SELECT envelope_hash FROM run WHERE id='workflow'").get() as any;
  const plan = f.db.prepare("SELECT * FROM orchestration_plan WHERE run_id='workflow'").get() as any;
  const add = (runId:string, envelope=parent.envelope_hash) => {
    f.db.prepare("INSERT INTO run VALUES(?,'task',?,0,'private-created-text')").run(runId,envelope);
    f.db.prepare('INSERT INTO orchestration_plan VALUES(?,?,?,?)').run(runId,envelope,plan.digest,plan.payload);
  };
  add('empty');
  let list = host.listRecoveryRuns({});
  expect(list.records.find(r=>r.runId==='empty')).toMatchObject({recordStatus:'no-recorded-identities',identityRecordCount:0,recordedAttemptCount:0});
  f.db.exec('DROP TRIGGER stage_envelope_no_delete; DELETE FROM orchestration_stage_envelope');
  list=host.listRecoveryRuns({}); expect(list.records.find(r=>r.runId==='workflow')).toMatchObject({recordStatus:'lineage-incomplete',missingStageLinkCount:1,identityRecordCount:1});
  f.db.transaction(()=>{for(let n=0;n<51;n++)add('recent-'+n);})();
  list=host.listRecoveryRuns({}); expect(list.records).toHaveLength(50);expect(list.truncated).toBe(true);expect(list.records[0]!.runId).toBe('recent-50');
  f.db.prepare("INSERT INTO envelope VALUES('foreign',?,'[]','now')").run(f.root);
  f.db.transaction(()=>{for(let n=0;n<1001;n++)add('foreign-'+n,'foreign');})();
  list=host.listRecoveryRuns({}); expect(list.records).toEqual([]);expect(list.scanTruncated).toBe(true);
  expect(mocks.query).not.toHaveBeenCalled();expect(mocks.stat).not.toHaveBeenCalled();
});

test('run picker rejects extra input, outer transactions and closed ledgers without OS calls', () => {
  const f=fixture(),host=createNativeRecoveryHost({guard,daemon:f.daemon,worktree:f.workspace});
  expect(()=>host.listRecoveryRuns({path:f.root} as never)).toThrow();
  expect(()=>f.db.transaction(()=>host.listRecoveryRuns({}))()).toThrow();
  f.db.close();expect(()=>host.listRecoveryRuns({})).toThrow();expect(mocks.query).not.toHaveBeenCalled();
});
test('foreign run/attempt/reference, wrong workspace and tampered stage reject without OS query', async () => {
  const f = fixture(), host = createNativeRecoveryHost({guard,daemon:f.daemon,worktree:f.workspace});
  for (const patch of [{runId:'other'},{attemptId:'other'},{identityRef:'cue-native-identity:'+'f'.repeat(64)}]) await expect(host.observeNativeRecovery({...f.input,...patch})).rejects.toThrow();
  const wrong = createNativeRecoveryHost({guard,daemon:f.daemon,worktree:f.root}); expect(()=>wrong.listNativeIdentities({runId:'workflow'})).toThrow();
  f.db.exec('DROP TRIGGER stage_envelope_no_update'); f.db.exec("UPDATE orchestration_stage_envelope SET request_json='{}'");
  await expect(host.observeNativeRecovery(f.input)).rejects.toThrow(); expect(mocks.query).not.toHaveBeenCalled();
});
test('canonical dotted parent run remains queryable without widening native session identity', async () => {
  const f=fixture('workflow.v1'),host=createNativeRecoveryHost({guard,daemon:f.daemon,worktree:f.workspace});
  expect(host.listNativeIdentities({runId:'workflow.v1'}).records).toHaveLength(1);
  expect((await host.observeNativeRecovery(f.input)).runId).toBe('workflow.v1');
});
test('fake generation, root/dependency mismatch and hostile inputs are denied', async () => {
  const f = fixture(); let touched=0;
  for (const bad of [{...guard},Object.defineProperty({},'snapshot',{get(){touched++;return guard.snapshot;}}),new Proxy(guard,{})]) expect(()=>createNativeRecoveryHost({guard:bad as any,daemon:f.daemon,worktree:f.workspace})).toThrow();
  const host=createNativeRecoveryHost({guard,daemon:f.daemon,worktree:f.workspace});
  await expect(host.observeNativeRecovery(new Proxy(f.input,{getOwnPropertyDescriptor(){touched++;throw Error('proxy');}}))).rejects.toThrow();
  expect(touched).toBe(0); expect(mocks.query).not.toHaveBeenCalled();
  const foreign=join(f.root,'foreign'),deps=join(foreign,'dependencies');
  for(const dir of ['app','daemon/src','daemon/dist/src','daemon/migrations','daemon/dist/migrations','daemon/native/change-snapshot','daemon/dist/native/change-snapshot','dependencies/better-sqlite3/lib','dependencies/better-sqlite3/build/Release']) mkdirSync(join(foreign,dir),{recursive:true});
  for(const file of ['package.json','package-lock.json','daemon/package.json','daemon/package-lock.json']) writeFileSync(join(foreign,file),'{}');
  writeFileSync(join(deps,'better-sqlite3/package.json'),JSON.stringify({name:'better-sqlite3',version:'13.0.3',main:'lib/index.js',dependencies:{'node-addon-api':'8'}}));
  writeFileSync(join(deps,'better-sqlite3/lib/index.js'),'fixture bytes never executed'); writeFileSync(join(deps,'better-sqlite3/build/Release/better_sqlite3.node'),'fixture native bytes never loaded');
  for(const relative of ['daemon/native/change-snapshot/manifest.json','daemon/native/change-snapshot/change-snapshot.exe','daemon/dist/native/change-snapshot/manifest.json','daemon/dist/native/change-snapshot/change-snapshot.exe'])copyFileSync(join(resolve('..'),relative),join(foreign,relative));
  for(const root of [foreign,resolve('..')]) {
    const foreignGuard=captureInstallationIdentity({root,dependencyRoot:deps});
    expect(()=>createNativeRecoveryHost({guard:foreignGuard,daemon:f.daemon,worktree:f.workspace})).toThrow('unavailable');
  }
});
test('authentic guard detects changed runtime metadata before publication (offline restored mutation)', async () => {
  const f=fixture(),host=createNativeRecoveryHost({guard,daemon:f.daemon,worktree:f.workspace});
  const original=Object.getOwnPropertyDescriptor(process.versions,'node')!;
  const query=mocks.query.getMockImplementation()!;
  mocks.query.mockImplementation(async q=>{const value=await query(q);Object.defineProperty(process.versions,'node',{...original,value:'0.0.fixture-drift'});return value;});
  try { await expect(host.observeNativeRecovery(f.input)).rejects.toThrow('installation_identity'); }
  finally { Object.defineProperty(process.versions,'node',original); }
  expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_receipt').get()).toEqual({n:0});
});
test('abort and changed lineage while observing discard result and do not issue receipts', async () => {
  const f=fixture(),host=createNativeRecoveryHost({guard,daemon:f.daemon,worktree:f.workspace}),controller=new AbortController(); controller.abort();
  await expect(host.observeNativeRecovery({...f.input,signal:controller.signal})).rejects.toThrow(); expect(mocks.query).not.toHaveBeenCalled();
  mocks.query.mockImplementation(async()=>{f.db.exec("UPDATE session_handle SET start_time='changed'");return null;});
  await expect(host.observeNativeRecovery(f.input)).rejects.toThrow(); expect(f.db.prepare('SELECT COUNT(*) n FROM orchestration_receipt').get()).toEqual({n:0});
});
test('Core without protected recovery service is unavailable, and main wires the captured guard', () => {
  const f=fixture(),core=createCueCore(f.config,f.daemon); expect(()=>core.listNativeIdentities({runId:'workflow'})).toThrow('unavailable');
  const main=readFileSync(new URL('../../app/main.mjs',import.meta.url),'utf8'); expect(main).toContain('createNativeRecoveryHost({ guard, daemon, worktree, handoffAuthority:createGeneratedJsonHandoffAuthority({db}) })');
});
test('owned daemon closes when the protected recovery factory fails during Core construction', async () => {
  const f=fixture(); f.db.close();
  const close=vi.spyOn(AppDaemon.prototype,'close');
  try {
    expect(()=>createCueCore(f.config,undefined,{nativeRecoveryFactory:()=>{throw Error('fixture_factory_failure');}})).toThrow('fixture_factory_failure');
    expect(close).toHaveBeenCalledTimes(1); await close.mock.results[0]!.value;
  } finally { close.mockRestore(); }
});
