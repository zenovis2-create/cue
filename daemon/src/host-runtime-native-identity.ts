import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runProcessSync } from './process-launch.js';
import { observeProcessTree } from './process-termination.js';

export type HostNativeProcessIdentity=Readonly<{pid:number;createdFileTime:string}>;
const helper=fileURLToPath(new URL('./native-process-observation.ps1',import.meta.url));
function native(pid:number):HostNativeProcessIdentity{
  const padding=[process.pid,process.ppid,1].filter((value,index,list)=>Number.isSafeInteger(value)&&value>0&&value!==pid&&list.indexOf(value)===index).slice(0,2);
  if(padding.length!==2)throw Error('host_runtime_native_identity_unavailable');
  const nonce=randomUUID(),payload=Buffer.from(JSON.stringify({version:'cue-native-query-v1',nonce,processes:[pid,...padding].map(value=>({pid:value}))})).toString('base64');
  const result=runProcessSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-PayloadBase64',payload],{encoding:'utf8',timeout:15000,windowsHide:true});
  if(result.status!==0||result.error||result.stderr.trim())throw Error('host_runtime_native_identity_unavailable');
  const value=JSON.parse(result.stdout) as {version?:unknown;nonce?:unknown;processes?:unknown};
  if(value.version!=='cue-native-query-v1'||value.nonce!==nonce||!Array.isArray(value.processes)||value.processes.length!==3)throw Error('host_runtime_native_identity_unavailable');
  const observed=value.processes[0] as {pid?:unknown;createdFileTime?:unknown;liveness?:unknown};
  if(observed.pid!==pid||observed.liveness!=='alive'||typeof observed.createdFileTime!=='string'||!/^[1-9]\d{0,19}$/u.test(observed.createdFileTime))throw Error('host_runtime_native_identity_unavailable');
  return Object.freeze({pid,createdFileTime:observed.createdFileTime});
}
export function verifyStableOwnedNativeObservation(input:Readonly<{rootBefore:HostNativeProcessIdentity;targetBefore:HostNativeProcessIdentity;treePids:readonly number[];rootAfter:HostNativeProcessIdentity;targetAfter:HostNativeProcessIdentity}>):HostNativeProcessIdentity{
  const same=(left:HostNativeProcessIdentity,right:HostNativeProcessIdentity)=>left.pid===right.pid&&left.createdFileTime===right.createdFileTime;
  if(!same(input.rootBefore,input.rootAfter)||!same(input.targetBefore,input.targetAfter)||!input.treePids.includes(input.rootBefore.pid)||!input.treePids.includes(input.targetBefore.pid))throw Error('host_runtime_native_identity_foreign');
  return input.targetAfter;
}
export function observeOwnedNativeProcess(rootPid:number,targetPid:number):HostNativeProcessIdentity{
  if(!Number.isSafeInteger(rootPid)||rootPid<1||!Number.isSafeInteger(targetPid)||targetPid<1)throw Error('host_runtime_native_identity_unavailable');
  const rootBefore=native(rootPid),targetBefore=targetPid===rootPid?rootBefore:native(targetPid);
  const tree=observeProcessTree(rootPid).descendants;
  const targetAfter=native(targetPid),rootAfter=targetPid===rootPid?targetAfter:native(rootPid);
  return verifyStableOwnedNativeObservation({rootBefore,targetBefore,treePids:tree.map(process=>process.pid),rootAfter,targetAfter});
}
export const hostRuntimeNativeIdentityHelper=Object.freeze({path:helper,sha256:createHash('sha256').update(readFileSync(helper)).digest('hex')});
