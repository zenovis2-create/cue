import { describe,it,expect } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync,mkdirSync,copyFileSync,appendFileSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { measureModelControlBundle,snapshotModelControlBundle,matchesModelControlObservation } from '../src/model-control-bundle.js';
const files=['model-only-launch.ps1','model-only-profile-cleanup.ps1','model-only-client.cjs','json-checker-client.cjs','verification/json-format-checker.cjs'];
describe.skipIf(process.platform!=='win32')('immutable host control bundle',()=>{
 it('snapshot is strict, frozen and does not invoke hostile field getters',()=>{
  const bundle=measureModelControlBundle({controlRoot:resolve('src'),nodeExecutable:process.execPath,clientKind:'model'});
  expect(Object.isFrozen(snapshotModelControlBundle(bundle,'model',bundle.nodeSha256))).toBe(true);
  let calls=0;const bad={...bundle};Object.defineProperty(bad,'clientSha256',{get(){calls++;throw Error('getter')}});
  expect(()=>snapshotModelControlBundle(bad,'model',bundle.nodeSha256)).toThrow('control_bundle_invalid');expect(calls).toBe(0);
  expect(()=>snapshotModelControlBundle({...bundle,clientSha256:'0'.repeat(64)},'model',bundle.nodeSha256)).toThrow();
 });
 it('success metadata must match every approved control pin and static flag',()=>{
  const bundle=measureModelControlBundle({controlRoot:resolve('src'),nodeExecutable:process.execPath,clientKind:'json-checker'});
  const observed={controlStatus:'pinned',controlBundleSha256:bundle.sha256,clientKind:bundle.clientKind,clientSha256:bundle.clientSha256,checkerCoreSha256:bundle.checkerCoreSha256,guardianSha256:bundle.guardianSha256,preserveDependencySymlinks:true};
  expect(matchesModelControlObservation(bundle,observed)).toBe(true);
  for(const key of Object.keys(observed)) {expect(matchesModelControlObservation(bundle,{...observed,[key]:'changed'})).toBe(false);const missing={...observed};delete missing[key as keyof typeof missing];expect(matchesModelControlObservation(bundle,missing)).toBe(false);}
  let calls=0;Object.defineProperty(observed,'clientSha256',{get(){calls++;throw Error('getter')}});expect(matchesModelControlObservation(bundle,observed)).toBe(false);expect(calls).toBe(0);
 });
 it.each(['client','core','guardian'] as const)('refuses changed %s before isolated child creation/resume',changed=>{
  const root=mkdtempSync(join(tmpdir(),'Cue.ControlFixture.'));
  try{
   mkdirSync(join(root,'verification'));for(const file of files)copyFileSync(resolve('src',file),join(root,file));
   const bundle=measureModelControlBundle({controlRoot:root,nodeExecutable:process.execPath,clientKind:'json-checker'});
   const file=changed==='client'?'json-checker-client.cjs':changed==='core'?'verification/json-format-checker.cjs':'model-only-profile-cleanup.ps1';
   appendFileSync(join(root,file),changed==='guardian'?'\n# changed fixture\n':'\n// changed fixture\n');
   const payload={controlBundle:bundle,clientKind:'json-checker',broker:true,nodeExecutable:process.execPath,nodeSha256:bundle.nodeSha256,parentPid:process.pid,timeoutMs:5000,maxRequestBytes:1048576,maxResultBytes:1048576};
   const child=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(root,'model-only-launch.ps1'),'-PayloadBase64',Buffer.from(JSON.stringify(payload)).toString('base64')],{input:Buffer.from('{}').toString('base64')+'\n',encoding:'utf8',windowsHide:true,timeout:15000});
   expect(child.status).not.toBe(0);expect(child.stderr).toContain(changed==='guardian'?'control_guardian_hash_mismatch':changed==='client'?'staged_client_hash_mismatch':'staged_checker_core_hash_mismatch');
   expect(child.stdout).not.toMatch(/CUE_MODEL_(?:PID|OBSERVATION|FRAME)=/);
   if(changed!=='guardian')expect(child.stdout).toContain('"taskRootAbsent":true');
  }finally{rmSync(root,{recursive:true,force:true});}
 },20000);
 it('native production refuses missing pins before guardian/child startup',()=>{
  const payload={nodeExecutable:process.execPath,nodeSha256:'0'.repeat(64),parentPid:process.pid,timeoutMs:1000,request:'{"type":"ping"}'};
  const child=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('src/model-only-launch.ps1'),'-PayloadBase64',Buffer.from(JSON.stringify(payload)).toString('base64')],{encoding:'utf8',windowsHide:true,timeout:5000});
  expect(child.status).not.toBe(0);expect(child.stderr).toContain('control_bundle_required');expect(child.stdout).toBe('');
 });
});

describe.skipIf(process.platform!=='win32')('goal proposal control bundle',()=>{
 it('pins the distinct client and structural core while preserving old bundle kinds',()=>{
  for(const kind of ['model','json-checker','goal-proposal-checker'] as const){
   const bundle=measureModelControlBundle({controlRoot:resolve('src'),nodeExecutable:process.execPath,clientKind:kind});
   expect(snapshotModelControlBundle(bundle,kind,bundle.nodeSha256)).toEqual(bundle);
   expect(bundle.checkerCoreSha256).toBe(kind==='model'?null:createHash('sha256').update(readFileSync(resolve('src/verification',kind==='json-checker'?'json-format-checker.cjs':'goal-proposal-checker.cjs'))).digest('hex'));
   const observed={controlStatus:'pinned',controlBundleSha256:bundle.sha256,clientKind:kind,clientSha256:bundle.clientSha256,checkerCoreSha256:bundle.checkerCoreSha256,guardianSha256:bundle.guardianSha256,preserveDependencySymlinks:kind!=='model'};
   expect(matchesModelControlObservation(bundle,observed)).toBe(true);
  }
  const goal=measureModelControlBundle({controlRoot:resolve('src'),nodeExecutable:process.execPath,clientKind:'goal-proposal-checker'});
  expect(goal.clientSha256).toBe(createHash('sha256').update(readFileSync(resolve('src/goal-proposal-checker-client.cjs'))).digest('hex'));
  expect(()=>snapshotModelControlBundle(goal,'json-checker',goal.nodeSha256)).toThrow('control_bundle_invalid');
 });
 it('rejects unknown native client kinds before starting guardian or child',()=>{
  const payload={nodeExecutable:process.execPath,nodeSha256:'0'.repeat(64),parentPid:process.pid,timeoutMs:1000,clientKind:'unregistered',request:'{}'};
  const child=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('src/model-only-launch.ps1'),'-PayloadBase64',Buffer.from(JSON.stringify(payload)).toString('base64')],{encoding:'utf8',windowsHide:true,timeout:5000});
  expect(child.status).not.toBe(0);expect(child.stderr).toContain('invalid_static_client');expect(child.stdout).toBe('');
 });
});
