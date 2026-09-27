import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { arch, release, version } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCurrentProviderInstallation, type ProviderInstallationDescriptor } from '../../app/provider-installation.mjs';
import { measureArtifactSet } from './measurement-artifacts.js';
import { subjectDigest, type MeasurementSubject } from './measurement-subject.js';
import { runProcessSync } from './process-launch.js';

export const NATIVE_PROVIDER_SUBJECT_VERSION='cue-native-provider-subject-v1';
const ADAPTER=['daemon/src/native-provider-measurement-subject.ts','daemon/dist/src/native-provider-measurement-subject.js','daemon/src/adapters/integration-executors.ts','daemon/dist/src/adapters/integration-executors.js','daemon/src/ledger.ts','daemon/dist/src/ledger.js','daemon/scripts/copy-assets.mjs','app/native-implementation-host.mjs','app/native-existing-file-authorities.mjs','app/staged-existing-file-publication-host.mjs','app/staged-publication-contract.mjs','app/protected-installation.mjs','app/default-goal-planning-bootstrap.mjs','app/main.mjs','app/core.mjs','app/deployment-staging-host.mjs','app/provider-installation.mjs','app/provider-installation-binding.mjs'];
const ENFORCEMENT=['daemon/src/host-codex-runtime.ts','daemon/dist/src/host-codex-runtime.js','daemon/src/host-codex-controller.ts','daemon/dist/src/host-codex-controller.js','daemon/src/worker-enforcement.ts','daemon/dist/src/worker-enforcement.js','daemon/src/process-launch.ts','daemon/dist/src/process-launch.js','daemon/src/process-termination.ts','daemon/dist/src/process-termination.js','daemon/src/host-runtime-native-identity.ts','daemon/dist/src/host-runtime-native-identity.js','daemon/src/change-snapshot-host.ts','daemon/dist/src/change-snapshot-host.js','daemon/src/tool-home.ts','daemon/dist/src/tool-home.js','daemon/src/job-object-launch.ps1','daemon/dist/src/job-object-launch.ps1','daemon/src/appcontainer-launch.ps1','daemon/dist/src/appcontainer-launch.ps1','daemon/src/native-process-observation.ps1','daemon/dist/src/native-process-observation.ps1','daemon/native/change-snapshot/manifest.json','daemon/native/change-snapshot/change-snapshot.exe','daemon/dist/native/change-snapshot/manifest.json','daemon/dist/native/change-snapshot/change-snapshot.exe'];
// Completion authority is exercised through these fixed runtime modules and their
// ledger schemas. Both source and compiled bytes must match the evidence subject.
const COMPLETION_MODULES=['native-process-cleanup','cleanup-observation-store','orchestration/stage-envelope','orchestration/staging-authority','orchestration/git-staging-factory','verification/acceptance','verification/native-existing-file-acceptance-host','verification/native-existing-file-checker','verification/evidence-policy','verification/requirements','verification/generated-output','orchestration/store','change-records','final-publication'];
const COMPLETION_MIGRATIONS=['012_stage_envelope','014_requirement_acceptance','018_cleanup_observation','046_change_publication','047_attempt_staging_authority','051_attempt_staging_task_authority'];
const COMPLETION=[...COMPLETION_MODULES.flatMap(name=>[`daemon/src/${name}.ts`,`daemon/dist/src/${name}.js`]),...COMPLETION_MIGRATIONS.flatMap(name=>[`daemon/migrations/${name}.sql`,`daemon/dist/migrations/${name}.sql`])];
// The native entry/driver consumes these planning authorities before a proposed
// goal can become an accepted executable instruction.
const PLANNING_MODULES=['orchestration/plan','selection/policy-store','selection/policy-promotion','selection/policy','selection/local-policy-store','selection/local-host-settings','integration-catalog','model-control-bundle','verification/goal-proposal-acceptance-host','adapters/isolated-goal-proposal-checker'];
const PLANNING=['app/goal-proposal.mjs','app/goal-planning-contract.mjs','app/goal-planning-handoff-authority.mjs','app/goal-planning-host.mjs','app/accepted-goal-planning-output.mjs',
  ...PLANNING_MODULES.flatMap(name=>[`daemon/src/${name}.ts`,`daemon/dist/src/${name}.js`]),
  'daemon/src/goal-proposal-checker-client.cjs','daemon/dist/src/goal-proposal-checker-client.cjs',
  'daemon/src/verification/goal-proposal-checker.cjs','daemon/dist/src/verification/goal-proposal-checker.cjs'];
const POLICY=['daemon/src/envelope.ts','daemon/dist/src/envelope.js','daemon/src/capability-admission.ts','daemon/dist/src/capability-admission.js','daemon/src/integration-runtime.ts','daemon/dist/src/integration-runtime.js','daemon/src/orchestration/native-runtime-receipts.ts','daemon/dist/src/orchestration/native-runtime-receipts.js','daemon/migrations/050_native_runtime_receipt.sql','daemon/dist/migrations/050_native_runtime_receipt.sql','app/orchestration-driver.mjs',...PLANNING,...COMPLETION];
const PROBES=['daemon/test/integration-native-existing-file-runtime.test.ts','daemon/test/integration-native-verifier.test.ts','daemon/test/host-runtime-native-identity.test.ts','daemon/test/integration-native-runtime-receipts.test.ts','daemon/test/p10c-runtime.test.ts','daemon/test/p10c-host-controller.test.ts','daemon/test/host-codex-controller.test.ts'];
export const NATIVE_PROVIDER_SUBJECT_PATHS=Object.freeze([...ADAPTER,...ENFORCEMENT,...POLICY,...PROBES]);
export interface NativeProviderSubjectMeasurement{readonly subject:MeasurementSubject;readonly subjectDigest:string;readonly manifest:Readonly<{version:typeof NATIVE_PROVIDER_SUBJECT_VERSION;provider:'codex';installationDigest:string;artifacts:readonly Readonly<{id:string;sha256:string}>[]}>;readonly limitations:readonly string[]}
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
function root(){let cursor=dirname(fileURLToPath(import.meta.url));for(let i=0;i<5;i++){const candidate=resolve(cursor);if(lstatSafe(join(candidate,'package.json'))&&lstatSafe(join(candidate,'daemon','src'))&&lstatSafe(join(candidate,'app')))return candidate;cursor=dirname(cursor);}throw Error('native_provider_subject_root');}
function lstatSafe(path:string){try{return lstatSync(path);}catch{return null;}}
function exactFile(base:string,path:string){const value=resolve(base,path),rel=relative(base,value);if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep))throw Error('native_provider_subject_path');const stat=lstatSync(value),actual=realpathSync(value);if(!stat.isFile()||stat.isSymbolicLink()||(process.platform==='win32'?actual.toLowerCase()!==value.toLowerCase():actual!==value))throw Error('native_provider_subject_artifact');return value;}
function group(version:string,ids:readonly string[],artifacts:readonly Readonly<{id:string;sha256:string}>[]){const selected=artifacts.filter(a=>ids.includes(a.id));if(selected.length!==ids.length)throw Error('native_provider_subject_group');return sha(JSON.stringify({version,artifacts:selected}));}
function canonicalInstallation(value:ProviderInstallationDescriptor){return JSON.stringify({provider:value.provider,executablePath:value.executablePath,executable:value.executable,version:value.version});}
/** Fixed current native provider fingerprint only. It issues no authentication,
 * qualification, entitlement, capability, or launch authority. */
export function measureNativeProviderSubject(installation:ProviderInstallationDescriptor):NativeProviderSubjectMeasurement{
  assertCurrentProviderInstallation(installation);if(installation.provider!=='codex')throw Error('native_provider_subject_provider');
  const base=root(),entries=[{id:'binary/provider',path:exactFile(dirname(installation.executablePath),installation.executablePath)},...NATIVE_PROVIDER_SUBJECT_PATHS.map(id=>({id,path:exactFile(base,id) }))];
  // This fixed direct authority list exceeds one artifact-set call's 128-entry
  // safety bound. Keep the overall list bounded and each read independently bounded.
  if(entries.length!==132||new Set(entries.map(entry=>entry.id)).size!==entries.length)throw Error('native_provider_subject_inventory');
  const artifacts=Object.freeze([...
    measureArtifactSet(entries.slice(0,128)).artifacts,
    ...measureArtifactSet(entries.slice(128)).artifacts,
  ].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));
  const measuredExecutable=artifacts.find(a=>a.id==='binary/provider');if(!measuredExecutable||measuredExecutable.sha256!==installation.executable.sha256.toLowerCase())throw Error('native_provider_subject_executable_drift');
  assertCurrentProviderInstallation(installation);
  const powershell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',os=runProcessSync(powershell,['-NoLogo','-NoProfile','-NonInteractive','-Command',"$v=Get-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion';[Console]::Write(($v.CurrentBuildNumber.ToString())+'.'+($v.UBR.ToString()))"],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:4096});
  if(process.platform!=='win32'||os.status!==0||os.error||os.stderr||!/^\d{4,6}\.\d{1,8}$/u.test(os.stdout))throw Error('native_provider_subject_os');
  const ids=(paths:readonly string[])=>paths,subject:MeasurementSubject=Object.freeze({toolBinarySha256:artifacts.find(a=>a.id==='binary/provider')!.sha256,adapterSha256:group(NATIVE_PROVIDER_SUBJECT_VERSION,ids(ADAPTER),artifacts),enforcementSha256:group(NATIVE_PROVIDER_SUBJECT_VERSION,ids(ENFORCEMENT),artifacts),boundaryProviderId:`native-provider/${installation.provider}`,boundaryPolicySha256:group(NATIVE_PROVIDER_SUBJECT_VERSION,ids(POLICY),artifacts),boundaryContractVersion:`${NATIVE_PROVIDER_SUBJECT_VERSION}/${installation.provider}`,probeSuiteSha256:group(NATIVE_PROVIDER_SUBJECT_VERSION,ids(PROBES),artifacts),runtimeArtifactSha256:group(NATIVE_PROVIDER_SUBJECT_VERSION,[...ADAPTER,...ENFORCEMENT,...POLICY],artifacts),osBuild:JSON.stringify({platform:process.platform,release:release(),version:version(),buildRevision:os.stdout,arch:arch()})});
  const frozenArtifacts=Object.freeze(artifacts.map(a=>Object.freeze({...a}))),manifest=Object.freeze({version:NATIVE_PROVIDER_SUBJECT_VERSION,provider:installation.provider,installationDigest:sha(canonicalInstallation(installation)),artifacts:frozenArtifacts});
  return Object.freeze({subject,subjectDigest:subjectDigest(subject),manifest,limitations:Object.freeze(['measurement-only-no-qualification','authentication-and-account-evidence-excluded','provider-service-outside-client-boundary','probe-suite-fingerprint-not-probe-pass','source-and-probe-closure-required-packaged-absence-unavailable'])});
}
