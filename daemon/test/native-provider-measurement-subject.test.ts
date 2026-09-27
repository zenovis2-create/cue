import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test, vi } from 'vitest';
const state=vi.hoisted(()=>({issued:new WeakSet<object>(),missing:'',changed:''}));
vi.mock('../src/measurement-artifacts.js',async original=>{const actual=await original<typeof import('../src/measurement-artifacts.js')>(),crypto=await vi.importActual<typeof import('node:crypto')>('node:crypto');return{...actual,measureArtifactSet(input:readonly {id:string;path:string}[]){const result=actual.measureArtifactSet(input);if(!state.changed)return result;return{...result,artifacts:result.artifacts.map(item=>item.id===state.changed?{...item,sha256:crypto.createHash('sha256').update(item.sha256+'simulated-byte-change').digest('hex')}:item)};}};});
vi.mock('../../app/provider-installation.mjs',async()=>{const fs=await vi.importActual<typeof import('node:fs')>('node:fs'),crypto=await vi.importActual<typeof import('node:crypto')>('node:crypto');return{assertCurrentProviderInstallation(value:any){if(!state.issued.has(value))throw Error('provider_installation_unavailable_or_drifted');const bytes=fs.readFileSync(value.executablePath);if(crypto.createHash('sha256').update(bytes).digest('hex')!==value.executable.sha256)throw Error('provider_installation_unavailable_or_drifted');return true;}};});
vi.mock('../src/process-launch.js',()=>({runProcessSync:()=>({status:0,error:undefined,stderr:'',stdout:'26100.1'})}));
vi.mock('node:fs',async original=>{const actual=await original<typeof import('node:fs')>();return{...actual,lstatSync(path:any,...args:any[]){if(state.missing&&String(path).endsWith(state.missing)){const error:any=Error('missing');error.code='ENOENT';throw error;}return (actual.lstatSync as any)(path,...args);}};});
import { measureNativeProviderSubject, NATIVE_PROVIDER_SUBJECT_PATHS } from '../src/native-provider-measurement-subject.js';
import { createCapabilityAdmission } from '../src/capability-admission.js';
const roots:string[]=[];afterEach(()=>{state.missing='';state.changed='';for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture(auth='auth-a'){const root=mkdtempSync(join(tmpdir(),'cue-native-subject-'));roots.push(root);const executablePath=join(root,'codex.exe');writeFileSync(executablePath,'pinned-provider');const executable={sha256:createHash('sha256').update('pinned-provider').digest('hex'),size:15,dev:'1',ino:'2',mtimeMs:1,ctimeMs:1,signerSubject:'fixture',signerThumbprint:'A'.repeat(40)};const value:any=Object.freeze({provider:'codex',executablePath,executable:Object.freeze(executable),version:Object.freeze({kind:'pe-file',value:'1'}),authProfiles:Object.freeze([Object.freeze({path:join(root,auth),size:1,dev:'1',ino:'3',mtimeMs:1,ctimeMs:1})]),status:'unqualified',authenticated:false,entitled:false,qualified:false});state.issued.add(value);return{root,executablePath,value};}
test.skipIf(process.platform!=='win32')('deterministically measures fixed current native provider artifacts without auth qualification',()=>{const first=fixture('secret-a'),second=fixture('secret-b');const a=measureNativeProviderSubject(first.value),again=measureNativeProviderSubject(first.value),b=measureNativeProviderSubject(second.value);expect(again).toEqual(a);expect(a.subjectDigest).toBe(b.subjectDigest);expect(a.subject.boundaryProviderId).toBe('native-provider/codex');expect(new Set(a.manifest.artifacts.map(x=>x.id))).toEqual(new Set(['binary/provider',...NATIVE_PROVIDER_SUBJECT_PATHS]));expect(JSON.stringify(a)).not.toContain('secret-a');expect(a.limitations).toContain('measurement-only-no-qualification');});
test.skipIf(process.platform!=='win32')('fails closed on executable drift, missing fixed artifact and unissued descriptor',()=>{const f=fixture();writeFileSync(f.executablePath,'drift');expect(()=>measureNativeProviderSubject(f.value)).toThrow('provider_installation');const next=fixture();state.missing='host-codex-runtime.ts';expect(()=>measureNativeProviderSubject(next.value)).toThrow();state.missing='';expect(()=>measureNativeProviderSubject({...next.value})).toThrow('provider_installation');});

test.skipIf(process.platform!=='win32').each(['app/native-existing-file-authorities.mjs','app/protected-installation.mjs','app/main.mjs','app/deployment-staging-host.mjs'])('authority closure requires %s',path=>{
 expect(NATIVE_PROVIDER_SUBJECT_PATHS).toContain(path);
 const f=fixture();state.missing=path.split('/').at(-1)!;
 expect(()=>measureNativeProviderSubject(f.value)).toThrow();
});
const completionModules=['native-process-cleanup','cleanup-observation-store','orchestration/stage-envelope','orchestration/staging-authority','orchestration/git-staging-factory','verification/acceptance','verification/native-existing-file-acceptance-host','verification/native-existing-file-checker','verification/evidence-policy','verification/requirements','verification/generated-output','orchestration/store','change-records','final-publication'];
const completionMigrations=['012_stage_envelope','014_requirement_acceptance','018_cleanup_observation','046_change_publication','047_attempt_staging_authority','051_attempt_staging_task_authority'];
const completionPaths=[...completionModules.flatMap(name=>[`daemon/src/${name}.ts`,`daemon/dist/src/${name}.js`]),...completionMigrations.flatMap(name=>[`daemon/migrations/${name}.sql`,`daemon/dist/migrations/${name}.sql`]),'app/staged-existing-file-publication-host.mjs','app/staged-publication-contract.mjs','daemon/src/ledger.ts','daemon/dist/src/ledger.js','daemon/scripts/copy-assets.mjs'];
test('native fixed artifact inventory stays unique and bounded at 132 including provider',()=>{
  expect(NATIVE_PROVIDER_SUBJECT_PATHS.length+1).toBe(132);
  expect(new Set(NATIVE_PROVIDER_SUBJECT_PATHS).size).toBe(NATIVE_PROVIDER_SUBJECT_PATHS.length);
});
const planningModules=['orchestration/plan','selection/policy-store','selection/policy-promotion','selection/policy','selection/local-policy-store','selection/local-host-settings','integration-catalog','model-control-bundle','verification/goal-proposal-acceptance-host','adapters/isolated-goal-proposal-checker'];
const planningPaths=['app/core.mjs','app/default-goal-planning-bootstrap.mjs','app/goal-proposal.mjs','app/goal-planning-contract.mjs','app/goal-planning-handoff-authority.mjs','app/goal-planning-host.mjs','app/accepted-goal-planning-output.mjs',
  ...planningModules.flatMap(name=>[`daemon/src/${name}.ts`,`daemon/dist/src/${name}.js`]),
  'daemon/src/goal-proposal-checker-client.cjs','daemon/dist/src/goal-proposal-checker-client.cjs','daemon/src/verification/goal-proposal-checker.cjs','daemon/dist/src/verification/goal-proposal-checker.cjs'];
test.skipIf(process.platform!=='win32').each(completionPaths)('missing completion artifact %s rejects measurement',path=>{
  expect(NATIVE_PROVIDER_SUBJECT_PATHS).toContain(path);
  state.missing=path.replaceAll('/','\\');
  expect(()=>measureNativeProviderSubject(fixture().value)).toThrow();
});
test.skipIf(process.platform!=='win32').each(planningPaths)('missing planning authority %s rejects native measurement',path=>{
  expect(NATIVE_PROVIDER_SUBJECT_PATHS).toContain(path);
  state.missing=path.replaceAll('/','\\');
  expect(()=>measureNativeProviderSubject(fixture().value)).toThrow();
});
test.skipIf(process.platform!=='win32').each([
  'daemon/src/native-process-cleanup.ts','daemon/dist/src/orchestration/stage-envelope.js',
  'daemon/src/verification/acceptance.ts','daemon/dist/src/verification/native-existing-file-checker.js',
  'daemon/src/final-publication.ts','daemon/migrations/046_change_publication.sql','daemon/migrations/051_attempt_staging_task_authority.sql','daemon/dist/migrations/051_attempt_staging_task_authority.sql','daemon/src/ledger.ts','daemon/scripts/copy-assets.mjs','app/goal-proposal.mjs','app/accepted-goal-planning-output.mjs','app/default-goal-planning-bootstrap.mjs','daemon/dist/src/orchestration/git-staging-factory.js','daemon/test/host-codex-controller.test.ts',
])('simulated artifact digest change in %s rejects prior capability evidence',path=>{
  const f=fixture();const before=measureNativeProviderSubject(f.value);
  state.changed=path;
  const after=measureNativeProviderSubject(f.value);
  expect(after.subjectDigest).not.toBe(before.subjectDigest);
  expect(after.manifest.artifacts.find(item=>item.id===path)?.sha256).not.toBe(before.manifest.artifacts.find(item=>item.id===path)?.sha256);
  const bytes=Buffer.from(JSON.stringify({probe:'P1',subjectDigest:before.subjectDigest,measuredAt:'2026-09-19T00:00:00.000Z',kind:'live',status:'pass'}));
  const ref={id:'prior-P1',sha256:createHash('sha256').update(bytes).digest('hex')};
  const admit=createCapabilityAdmission({resolveEvidence:()=>bytes,now:()=>Date.parse('2026-09-19T00:00:01.000Z'),maxAgeMs:60_000});
  expect(admit(after.subject,{P1:ref}).reasons).toContainEqual({probe:'P1',code:'subject-drift'});
});
