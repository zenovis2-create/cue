import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test, vi } from 'vitest';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import { createDeploymentStagingOrchestrationFactory } from '../../app/deployment-staging-host.mjs';
import { saveSelectionPolicy } from '../src/selection/policy-store.js';
import { createCapabilityEvidenceStore } from '../src/capability-store.js';
import { WRITE_PROBES, MODEL_PROBES } from '../src/capability-admission.js';
import { SUBJECT_FIELDS, subjectDigest } from '../src/measurement-subject.js';
import { createNativeExistingFileContract } from '../src/verification/native-existing-file-checker.js';

const fixture = vi.hoisted(() => ({ installation: null as any, subject: null as any, digest:'', now:0,
  service:null as any, readCount:0, trace:[] as any[] }));
vi.mock('../../app/provider-installation.mjs', () => ({
  identifyProviderInstallation:()=>fixture.installation,
  assertCurrentProviderInstallation:(value:unknown)=>{if(value!==fixture.installation)throw Error('fixture-installation-drift');return true;},
}));
vi.mock('../dist/src/native-provider-measurement-subject.js', () => ({
  measureNativeProviderSubject:()=>({subject:fixture.subject,subjectDigest:fixture.digest,manifest:{installationDigest:'f'.repeat(64)}}),
}));
vi.mock('../dist/src/native-account-observation.js', () => ({
  observeNativeServiceCapacity:async()=>fixture.service,
  readIssuedNativeServiceCapacity:(value:unknown,input:any)=>{fixture.readCount++;if(value!==fixture.service||input.installation!==fixture.installation
    ||input.authProfilePath!==fixture.installation.authProfiles[0].path||input.accountRef!==fixture.service.accountRef
    ||subjectDigest(input.currentSubject)!==fixture.digest)throw Error('fixture-service-drift');return{observation:value,available:true,sourceBytes:()=>new Uint8Array([1])};},
}));
import { createNativeExistingFileAuthorities, nativeRuntimeReceiptOutcome } from '../../app/native-existing-file-authorities.mjs';

const sha = (value:string) => createHash('sha256').update(value).digest('hex');

test('native success cannot override failed, cancelled, or unsettled adapter outcomes', () => {
  const settled={phase:'settled',outcome:'succeeded',cancellation:'not-requested'};
  expect(nativeRuntimeReceiptOutcome(settled,'succeeded')).toBe('succeeded');
  expect(nativeRuntimeReceiptOutcome({...settled,outcome:'failed'},'succeeded')).toBe('failed');
  expect(nativeRuntimeReceiptOutcome({...settled,cancellation:'acknowledged'},'succeeded')).toBe('failed');
  expect(nativeRuntimeReceiptOutcome(settled,'failed')).toBe('failed');
  expect(nativeRuntimeReceiptOutcome({...settled,phase:'awaiting-cleanup'},'succeeded')).toBeNull();
});

test('native authority configuration rejects caller callbacks before provider or service observation', async () => {
  let reads = 0;
  const hostile: Record<string, unknown> = {};
  Object.defineProperty(hostile, 'installation', { enumerable: true, get() { reads++; throw Error('provider touched'); } });
  await expect(createNativeExistingFileAuthorities({ db: {open:true} as any, now:()=>1, configuration: hostile as any }))
    .rejects.toThrow('native-authorities-configuration');
  expect(reads).toBe(0);
  await expect(createNativeExistingFileAuthorities({ db: {open:true} as any, now:()=>1,
    configuration: {installation:{}, authProfilePath:'x', temporaryParent:'x', workflow:{}, accounting:{}, policies:{},
      capabilityMaxAgeMs:1000, model:'gpt', authorizePublication:()=>true} as any }))
    .rejects.toThrow('native-authorities-configuration');
});

test('synthetic service, subject and probe fixtures reach real Core and Git staging but retain unknown cleanup', async () => {
  const root=mkdtempSync(join(tmpdir(),'cue-native-authorities-')),workspace=join(root,'workspace'),data=join(root,'data'),storageRoot=join(root,'staging');
  mkdirSync(workspace);mkdirSync(storageRoot);writeFileSync(join(workspace,'target.txt'),'before');
  execFileSync('git',['init'],{cwd:workspace,stdio:'ignore'});
  execFileSync('git',['add','target.txt'],{cwd:workspace,stdio:'ignore'});
  execFileSync('git',['-c','user.name=Cue Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture'],{cwd:workspace,stdio:'ignore'});
  const config=initializeConfig(data,{worktreeRoot:workspace}),daemon=new AppDaemon(config),db=daemon.db;
  try {
    fixture.now=Date.now();fixture.subject=Object.fromEntries(SUBJECT_FIELDS.map(key=>[key,key.endsWith('Sha256')?'b'.repeat(64):`fixture-${key}`]));
    fixture.digest=subjectDigest(fixture.subject);fixture.readCount=0;fixture.trace=[];
    fixture.installation={provider:'codex',executablePath:'C:/fixture/codex.exe',executable:{sha256:'b'.repeat(64)},version:{value:'fixture-v1'},
      authProfiles:[{path:'C:/fixture/auth.json'}]};
    fixture.service={accountIdentityDigest:'c'.repeat(64),accountRef:'account:'+'c'.repeat(64),observedAtMs:fixture.now};
    const evidence=createCapabilityEvidenceStore(db,()=>fixture.now);
    for(const probe of [...WRITE_PROBES,...MODEL_PROBES])evidence.record({probe,subjectDigest:fixture.digest,measuredAt:new Date(fixture.now).toISOString(),kind:'live',status:'pass',observation:new Uint8Array([1])});
    const candidateIds=['codex-native-implementation','codex-native-verifier'],policies:any={};
    for(const mode of ['efficiency','performance','value','speed'] as const){const saved=saveSelectionPolicy(db,{policyId:`native-${mode}`,expectedRevision:null,
      createdAt:new Date(fixture.now).toISOString(),sourceVersion:'fixture',policy:{version:'cue-selection-v1',mode,qualityMinimum:0,
        costBasis:1,timeBasisMs:1000,currency:'TEST',costLimit:null,remainingTimeMs:null,maxEstimateAgeMs:60000,
        allowedCandidateIds:candidateIds,pinnedCandidateId:null}});policies[mode]={policyId:saved.policyId,revision:saved.revision,digest:saved.digest};}
    const artifacts=[{targetId:'target',relativePath:'target.txt',maxBytes:1024,expectedSha256:sha('after'),expectedByteLength:5,originalSha256:sha('before')}];
    const contract=createNativeExistingFileContract(artifacts);
    const configuration:any={installation:{provider:'codex'},authProfilePath:fixture.installation.authProfiles[0].path,temporaryParent:root,
      workflow:{requirementId:'implementation-correct',requirementText:'Update target.txt to after.',checkerId:contract.checkerId,
        checkerRevision:contract.checkerRevision,parametersDigest:contract.parametersDigest,targets:[{targetId:'target',relativePath:'target.txt',maxBackupBytes:1024}],
        expectedArtifacts:artifacts,launchTimeoutMs:1000,taskTimeoutMs:5000,pollMs:5},
      accounting:{currency:'TEST',unit:'micro',limitUnits:100,unitsPerCost:1,source:'fixture-conservative-prior',observedAtMs:fixture.now,
        upperUnitsByRole:{implementation:10,verifier:10},conservativeTimeMs:1000},policies,capabilityMaxAgeMs:60000,model:'fixture-model'};
    const base=await createNativeExistingFileAuthorities({db,now:()=>fixture.now,configuration});
    const factory=await createDeploymentStagingOrchestrationFactory({configuration:JSON.stringify({version:'cue-git-staging-deployment-v1',enabled:true,storageRoot}),
      createOrchestrationFactory:()=>((ctx:any)=>{const h:any=base(ctx);return {...h,authority:{...h.authority,authorizeClaim:(c:any)=>{const allowed=h.authority.authorizeClaim(c);fixture.trace.push(['claim',allowed,c.task?.id,c.candidateId,c.worktreeRealpath]);return allowed;}},engine:{...h.engine,observeCandidates:(r:any,t:any)=>{const candidates=h.engine.observeCandidates(r,t);fixture.trace.push(['observe',candidates]);return candidates;},authorizeExecution:(c:any)=>{const allowed=h.engine.authorizeExecution(c);fixture.trace.push(['execution',allowed]);return allowed;},reservation:(c:any)=>{try{const r=h.engine.reservation(c);fixture.trace.push(['reservation',r]);return r;}catch(e){fixture.trace.push(['reservation-error',String(e)]);throw e;}}}};})});
    const core=createCueCore(config,daemon,{orchestrationFactory:factory});
    try {const prepared=core.prepareGoal('Update the approved existing target.');expect(prepared.orchestration?.stages.map(stage=>stage.role)).toEqual(['implementation','verifier']);
      core.approve(prepared.runId);expect(db.prepare('SELECT relative_path FROM change_target_contract WHERE run_id=?').all(prepared.runId)).toEqual([{relative_path:'target.txt'}]);
      expect(fixture.readCount).toBeGreaterThan(2);
      core.execute(prepared.runId);
      await expect.poll(()=>(db.prepare('SELECT COUNT(*) n FROM orchestration_attempt WHERE run_id=?').get(prepared.runId) as any).n,{timeout:5000}).toBe(1);
      expect(db.prepare('SELECT COUNT(*) n FROM attempt_staging_setup WHERE run_id=?').get(prepared.runId)).toMatchObject({n:1});
      const attempt=db.prepare('SELECT attempt_id,candidate_id FROM orchestration_attempt WHERE run_id=?').get(prepared.runId) as any;
      expect(attempt.candidate_id).toBe('codex-native-implementation');
      expect(db.prepare('SELECT attempt_id,candidate_id,expected_subject_digest FROM attempt_staging_setup WHERE attempt_id=?').get(attempt.attempt_id))
        .toMatchObject({attempt_id:attempt.attempt_id,candidate_id:attempt.candidate_id,expected_subject_digest:fixture.digest});
      expect(db.prepare('SELECT COUNT(*) n FROM native_runtime_receipt WHERE attempt_id=?').get(attempt.attempt_id)).toMatchObject({n:0});
      expect(db.prepare('SELECT COUNT(*) n FROM change_publication_intent WHERE attempt_id=?').get(attempt.attempt_id)).toMatchObject({n:0});
    } finally {await expect(core.close()).rejects.toThrow('orchestration_cleanup_unverified');}
  } finally {try{rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:50});}catch{ /* Keep the primary assertion failure visible on Windows. */ }}
});
