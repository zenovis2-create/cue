import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OPEN="Add-Type -TypeDefinition @'\n", CLOSE="\n'@";
const LAUNCH='$exitCode = [CueAppContainer]::Launch($executable,[string]$payload.commandLine,$worktree,$sid,$PID,[string[]]$environment,[uint32]$payload.timeoutMs,[string]$payload.cancelMarker)';
const INTERNAL='internal static int LaunchWithObservationLease';
const WFP_ENTRY='public static int LaunchWithWfpObservation';
function once(text,needle,label){const first=text.indexOf(needle);if(first<0||text.indexOf(needle,first+needle.length)>=0)throw new Error(`wfp_launcher_anchor:${label}`);return first;}
function splitCsharp(text){const normalized=text.replaceAll('\r\n','\n');const start=once(normalized,OPEN,'csharp-open')+OPEN.length,end=once(normalized,CLOSE,'csharp-close');if(end<=start)throw new Error('wfp_launcher_anchor:csharp-order');return {before:normalized.slice(0,start),source:normalized.slice(start,end),after:normalized.slice(end)};}
function normalizeSources(parts){const uses=[],body=[];for(const part of parts){for(const line of part.replaceAll('\r\n','\n').split('\n')){if(/^using [^;]+;$/.test(line)){if(!uses.includes(line))uses.push(line);}else body.push(line);}}return `${uses.join('\n')}\n${body.join('\n').replace(/^\n+|\n+$/g,'')}\n`;}
export function generateReadonlyWfpLauncher({launcher,collector,adapter}){const base=splitCsharp(launcher);once(base.source,INTERNAL,'internal-launch');once(base.after,LAUNCH,'launch-call');if(base.source.includes(WFP_ENTRY))throw new Error('wfp_launcher_anchor:wfp-entry');const entry='public static int LaunchWithWfpObservation(string app,string commandLine,string cwd,IntPtr sid,string packageSid,int parentPid,string[] environment,uint timeoutMs,string cancelMarker,string nonce,string rootIdentity){var request=new WfpRequest{ExecutablePath=app,PackageSid=packageSid,RemotePort=48193,DurationMs=5000};var invocation=new CueWfpDiagnosticInvocation(request);try{return LaunchWithObservationLease(app,commandLine,cwd,sid,parentPid,environment,timeoutMs,cancelMarker,invocation.Provider);}finally{invocation.Emit(nonce,rootIdentity);}}\n  ';
const merged=normalizeSources([base.source.replace(INTERNAL,entry+INTERNAL),collector,adapter]);const bridge=[
'  $exitCode = [CueAppContainer]::LaunchWithWfpObservation($executable,[string]$payload.commandLine,$worktree,$sid,$sidText,$PID,[string[]]$environment,[uint32]$payload.timeoutMs,[string]$payload.cancelMarker,[string]$payload.nonce,[string]$heldIdentity)'].join('\n');
return `${base.before}${merged}${base.after.replace(LAUNCH,bridge)}`;}
export const renderReadonlyWfpLauncher=generateReadonlyWfpLauncher;
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function buildDefault(){const here=new URL('.',import.meta.url),launcher=readFileSync(new URL('../src/readonly-verifier-launch.ps1',here),'utf8'),collector=readFileSync(new URL('../../scripts/reuse/native/readonly-wfp-collector.cs',here),'utf8'),adapter=readFileSync(new URL('../src/readonly-wfp-observation.cs',here),'utf8');return generateReadonlyWfpLauncher({launcher,collector,adapter});}
if(process.argv[1]===fileURLToPath(import.meta.url)){const output=new URL('../dist/src/readonly-verifier-wfp-launch.ps1',import.meta.url),generated=buildDefault();mkdirSync(new URL('../dist/src/',import.meta.url),{recursive:true});writeFileSync(output,generated,{encoding:'utf8'});process.stdout.write(JSON.stringify({path:fileURLToPath(output),sha256:sha256(generated),bytes:Buffer.byteLength(generated)})+'\n');}
