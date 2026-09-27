import { mkdirSync, openSync, closeSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProcessSync } from '../../daemon/dist/src/process-launch.js';

const MAX_OUTPUT=65536;
export function classifyAclObservation(observed){
  const stdout=typeof observed.stdout==='string'?observed.stdout:'';
  const stderr=typeof observed.stderr==='string'?observed.stderr:'';
  if(observed.error)return {ok:false,reason:'spawn-error'};
  if(observed.signal)return {ok:false,reason:'terminated-by-signal'};
  if(observed.status!==0)return {ok:false,reason:'nonzero-status'};
  if(stderr.length>0)return {ok:false,reason:'stderr-diagnostic'};
  const sddl=stdout.trim();
  if(sddl.length===0)return {ok:false,reason:'empty-sddl'};
  if(sddl.length>MAX_OUTPUT||sddl.includes('\0')||/[\r\n]/.test(sddl)||!(/^(?:O:|G:|D:|S:)/.test(sddl)))return {ok:false,reason:'malformed-sddl'};
  return {ok:true,reason:'valid-sddl',sddl};
}

function bounded(value){return typeof value==='string'?value.slice(0,MAX_OUTPUT):'';}
function errorRecord(error){if(!error)return null;return {name:String(error.name??''),message:String(error.message??'').slice(0,4096),code:error.code===undefined?null:String(error.code),errno:error.errno===undefined?null:String(error.errno),syscall:error.syscall===undefined?null:String(error.syscall),path:error.path===undefined?null:String(error.path)};}

const here=dirname(fileURLToPath(import.meta.url));
if(process.argv[1]===fileURLToPath(import.meta.url)&&process.argv[2]==='--run'){
  const repo=resolve(here,'../..'),evidence=join(repo,'evidence','integrations','S1','20260913-readonly-acl-diagnostic'),owned=join(tmpdir(),'Cue.ReadonlyAclDiagnostic.Attempt1'),fixture=join(owned,'fixture');
  const marker=join(evidence,'intent.json'),resultPath=join(evidence,'result.json');
  mkdirSync(evidence,{recursive:true});
  const markerFd=openSync(marker,'wx');writeFileSync(markerFd,JSON.stringify({version:'cue-readonly-acl-diagnostic-v1',attempt:'attempt1',owned,fixture,maxAttempts:1,aclMutation:false,appContainerLaunches:0,nativeHelperCalls:0,networkCalls:0,modelProviderCalls:0,startedAt:new Date().toISOString()},null,2)+'\n');closeSync(markerFd);
  mkdirSync(fixture,{recursive:true});
  const powershell=join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const argv=['-NoProfile','-NonInteractive','-Command',`(Get-Acl -LiteralPath '${fixture.replaceAll("'","''")}').Sddl`];
  const observed=runProcessSync(powershell,argv,{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:MAX_OUTPUT});
  const raw={status:observed.status,signal:observed.signal,error:errorRecord(observed.error),stdout:bounded(observed.stdout),stderr:bounded(observed.stderr)};
  const verdict=classifyAclObservation(raw);
  writeFileSync(resultPath,JSON.stringify({version:'cue-readonly-acl-diagnostic-v1',attempt:'attempt1',powershell,argv,options:{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:MAX_OUTPUT},raw,verdict,finishedAt:new Date().toISOString()},null,2)+'\n');
  if(!verdict.ok)process.exitCode=1;
}
