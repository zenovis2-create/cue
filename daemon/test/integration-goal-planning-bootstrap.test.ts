import {afterEach,expect,test,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,win32} from 'node:path';
import {openLedger} from '../src/ledger.js';
import {SUBJECT_FIELDS,subjectDigest} from '../src/measurement-subject.js';
import {MODEL_PROBES} from '../src/capability-admission.js';
import {createCapabilityEvidenceStore} from '../src/capability-store.js';
import {configureLocalGoalPlanningSettings} from '../src/selection/local-host-settings.js';
const m=vi.hoisted(()=>({measure:vi.fn(),bundle:vi.fn()}));
vi.mock('../dist/src/model-measurement-subject.js',()=>({createModelMeasurementSubject:m.measure}));
vi.mock('../dist/src/model-control-bundle.js',async importOriginal=>({...(await importOriginal() as object),measureModelControlBundle:m.bundle}));
import {createDefaultGoalPlanningBootstrap} from '../../app/default-goal-planning-bootstrap.mjs';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const root=mkdtempSync(join(tmpdir(),'cue-planning-bootstrap-'));
const db=openLedger();
afterEach(()=>{if(db.open)db.close();rmSync(root,{recursive:true,force:true});});
function bundle(clientKind:'model'|'goal-proposal-checker'){
  const value={version:'cue-model-control-v1' as const,clientKind,nodeSha256:'1'.repeat(64),launcherSha256:'2'.repeat(64),guardianSha256:'3'.repeat(64),clientSha256:'4'.repeat(64),checkerCoreSha256:clientKind==='model'?null:'5'.repeat(64)};
  return {...value,sha256:sha(JSON.stringify(Object.values(value)))};
}
test('real saved planning settings and fixture evidence assemble a bounded host without network',()=>{
  const now=Date.now(),subject=Object.fromEntries(SUBJECT_FIELDS.map(key=>[key,key.endsWith('Sha256')?'a'.repeat(64):key]));
  const digest=subjectDigest(subject as any),store=createCapabilityEvidenceStore(db,()=>now);
  // Synthetic test-issued "live" rows exercise admission mechanics; they are not model qualification.
  for(const probe of MODEL_PROBES)store.record({probe,subjectDigest:digest,measuredAt:new Date(now-1).toISOString(),kind:'live',status:'pass',observation:Buffer.from(`offline-${probe}`)});
  configureLocalGoalPlanningSettings(db,{expectedRevision:null,enabled:true,limits:{maxInvocations:4,timeoutMs:30000,maxOutputBytes:65536,maxOutputTokens:2048},createdAt:new Date(now).toISOString()});
  m.measure.mockImplementation(()=>({subject,subjectDigest:digest}));
  m.bundle.mockImplementation(({clientKind}:any)=>bundle(clientKind));
  const install={measurement:{installRoot:root,nodeExecutable:process.execPath,powershellExecutable:process.execPath,sqliteNativePath:process.execPath,dependencyRoot:root},controlRoot:root,
    taskRootBase:win32.join(root,'tasks'),profileRootBase:win32.join(root,'profiles'),loadedHost:{executable:process.execPath,runtime:process.versions.electron?'electron':'node',version:process.versions.electron??process.versions.node}};
  const executionContract={executionPolicies:Object.fromEntries(['efficiency','performance','value','speed'].map(mode=>[mode,{policyRevision:'approved:1',policyDigest:'b'.repeat(64)}])),
    approvedExecution:{allowedCandidateIds:['native-maker','native-checker'],allowedScopeIds:['approved-existing-files'],checkerRegistry:[{checkerId:'trusted-code',revision:'v1',kinds:['code'],parametersDigest:'c'.repeat(64),targetIds:['target']}],maxChangeTargets:1}};
  const bootstrap=createDefaultGoalPlanningBootstrap({now:()=>now,maxEvidenceAgeMs:60000,discoverInstallation:()=>install as any,validateLoadedInstallation:()=>true,
    observeReadiness:()=>({authenticated:true,dataAllowed:true,resourceAvailable:true,quotaAvailable:true}),readExecutionContract:()=>executionContract as any});
  const ready=bootstrap({db,config:{},worktree:root}) as any;
  expect(ready.parentTemplate,JSON.stringify(ready)).toBe('goal-planning-v1');
  expect(JSON.parse(ready.capturePlanningInput({goal:'Improve parser',selectionMode:'efficiency'}))).toMatchObject({goalSha256:sha('Improve parser'),executionPolicy:{policyRevision:'approved:1'},checkerRegistry:[{parametersDigest:'c'.repeat(64)}]});
  expect(m.measure.mock.calls.length).toBeGreaterThanOrEqual(4);
  expect(m.bundle).toHaveBeenCalledTimes(2);
});
