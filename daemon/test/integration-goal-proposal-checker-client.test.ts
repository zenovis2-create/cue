import { describe,it,expect } from 'vitest';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync,mkdirSync,mkdtempSync,appendFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { measureModelControlBundle } from '../src/model-control-bundle.js';
const sha=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
const client=resolve('src/goal-proposal-checker-client.cjs');
const protocol='cue-goal-proposal-checker-v1',contract='cue-goal-proposal-v1';
const input=Buffer.from('{}'),output=Buffer.from('{}');
const request={protocol,type:'check',contract,requestId:'r',attemptId:'a',inputBase64:input.toString('base64'),outputBase64:output.toString('base64')};
const identity={protocol,type:'checker_request',contract,requestId:'r',attemptId:'a',inputSha256:sha(input),outputSha256:sha(output)};
describe('goal proposal checker native client',()=>{
 it('requires exact authorization and reports the structural core verdict',()=>{
  const authorized={...identity,type:'authorize_check'};
  const child=spawnSync(process.execPath,[client],{input:JSON.stringify(request)+'\n'+JSON.stringify(authorized)+'\n',encoding:'utf8',timeout:2000,windowsHide:true});
  expect(child.status).toBe(0);expect(child.stderr).toBe('');
  const frames=child.stdout.trim().split('\n').map(line=>JSON.parse(line));
  expect(frames[0]).toEqual(identity);
  expect(frames[1]).toEqual({protocol,type:'checker_result',contract,requestId:'r',attemptId:'a',verdict:{contract,status:'unknown',reason:'input_contract',inputSha256:sha(input),outputSha256:sha(output),proposalDigest:null}});
  for(const bad of [{...request,contract:'cue-json-format-v1'},{...request,code:'process.exit(0)'}]){
   const rejected=spawnSync(process.execPath,[client],{input:JSON.stringify(bad)+'\n',encoding:'utf8',timeout:2000,windowsHide:true});
   expect(JSON.parse(rejected.stdout.trim())).toEqual({protocol,type:'protocol_error'});
  }
 });
});
describe.skipIf(process.platform!=='win32')('goal proposal native launcher dispatch',()=>{
 it.each(['goal-proposal-checker-client.cjs','verification/goal-proposal-checker.cjs'])('refuses changed pinned %s before child creation',changed=>{
  const root=mkdtempSync(join(tmpdir(),'Cue.GoalControl.'));
  try{
   mkdirSync(join(root,'verification'));
   for(const file of ['model-only-launch.ps1','model-only-profile-cleanup.ps1','goal-proposal-checker-client.cjs','verification/goal-proposal-checker.cjs'])copyFileSync(resolve('src',file),join(root,file));
   const bundle=measureModelControlBundle({controlRoot:root,nodeExecutable:process.execPath,clientKind:'goal-proposal-checker'});
   appendFileSync(join(root,changed),'\n// changed fixture\n');
   const payload={controlBundle:bundle,clientKind:'goal-proposal-checker',broker:true,nodeExecutable:process.execPath,nodeSha256:bundle.nodeSha256,parentPid:process.pid,timeoutMs:5000,maxRequestBytes:1048576,maxResultBytes:1048576};
   const child=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(root,'model-only-launch.ps1'),'-PayloadBase64',Buffer.from(JSON.stringify(payload)).toString('base64')],{input:Buffer.from('{}').toString('base64')+'\n',encoding:'utf8',windowsHide:true,timeout:15000});
   expect(child.status).not.toBe(0);expect(child.stderr).toContain(changed.startsWith('verification')?'staged_checker_core_hash_mismatch':'staged_client_hash_mismatch');
   expect(child.stdout).not.toMatch(/CUE_MODEL_(?:PID|OBSERVATION|FRAME)=/);
   expect(child.stdout).toContain('"taskRootAbsent":true');
  }finally{rmSync(root,{recursive:true,force:true});}
 },20000);
});
