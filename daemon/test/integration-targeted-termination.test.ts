import { describe,expect,it } from 'vitest';
import { spawn,type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync,lstatSync,mkdtempSync,readFileSync,rmSync,statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { basename,dirname,join,resolve } from 'node:path';
import { observeProcessTree,terminateVerifiedTree,verifyProcessesDead } from '../src/process-termination.js';

const win32=process.platform==='win32';
const childProgram=String.raw`
const {spawn}=require('node:child_process');
const heartbeat=process.argv[1];
const grandchildProgram="const {appendFileSync}=require('node:fs');const p=process.argv[1];let n=0;setInterval(()=>appendFileSync(p,String(++n)+'\\\\n'),40)";
const grandchild=spawn(process.execPath,['-e',grandchildProgram,heartbeat],{stdio:'ignore',windowsHide:true});
console.log(JSON.stringify({controllerPid:process.pid,grandchildPid:grandchild.pid}));process.stdout.write('');
const close=()=>{try{grandchild.kill('SIGKILL')}catch{};process.exit(0)};
process.on('SIGTERM',close);process.on('SIGINT',close);setInterval(()=>{},1000);
`;

function alive(pid:number):boolean{try{process.kill(pid,0);return true}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return false;throw error}}
async function firstJson(child:ChildProcess):Promise<{controllerPid:number;grandchildPid:number}>{
  const lines=createInterface({input:child.stdout!});
  for await(const line of lines){lines.close();return JSON.parse(line)}
  throw Error('child_closed_before_identity');
}
async function eventually<T>(read:()=>T,accept:(value:T)=>boolean):Promise<T>{
  for(let attempt=0;attempt<200;attempt++){const value=read();if(accept(value))return value;await new Promise(resolveDelay=>setTimeout(resolveDelay,25))}
  throw Error('condition_timeout');
}
function heartbeatCount(path:string):number{return existsSync(path)?statSync(path).size:0}

describe.skipIf(!win32)('S4/A03 real targeted process termination',()=>{
  it('terminates only the selected observed identity tree while its sibling keeps working',async()=>{
    const root=mkdtempSync(join(tmpdir(),'cue-targeted-termination-')),audit=join(root,'closure.jsonl'),priorAudit=process.env.CUE_TERMINATION_AUDIT;
    const children=new Set<ChildProcess>();
    const launch=(heartbeat:string)=>{const child=spawn(process.execPath,['-e',childProgram,heartbeat],{stdio:['ignore','pipe','pipe'],windowsHide:true});children.add(child);child.once('close',()=>children.delete(child));return child};
    let target:ChildProcess|undefined,sibling:ChildProcess|undefined,targetIdentity:{controllerPid:number;grandchildPid:number}|undefined,siblingIdentity:{controllerPid:number;grandchildPid:number}|undefined;
    try{
      target=launch(join(root,'target-heartbeat.txt'));sibling=launch(join(root,'sibling-heartbeat.txt'));
      [targetIdentity,siblingIdentity]=await Promise.all([firstJson(target),firstJson(sibling)]);
      const targetObserved=await eventually(()=>observeProcessTree(targetIdentity!.controllerPid),value=>value.descendants.some(row=>row.pid===targetIdentity!.grandchildPid));
      const siblingObserved=await eventually(()=>observeProcessTree(siblingIdentity!.controllerPid),value=>value.descendants.some(row=>row.pid===siblingIdentity!.grandchildPid));
      for(const identity of [targetIdentity.controllerPid,targetIdentity.grandchildPid])expect(targetObserved.descendants.find(row=>row.pid===identity)?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
      for(const identity of [siblingIdentity.controllerPid,siblingIdentity.grandchildPid])expect(siblingObserved.descendants.find(row=>row.pid===identity)?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
      expect(targetObserved.descendants.some(targetRow=>siblingObserved.descendants.some(siblingRow=>siblingRow.pid===targetRow.pid))).toBe(false);
      const siblingHeartbeat=join(root,'sibling-heartbeat.txt');const before=await eventually(()=>heartbeatCount(siblingHeartbeat),count=>count>0);
      process.env.CUE_TERMINATION_AUDIT=audit;const targetClosed=once(target,'close');terminateVerifiedTree(targetIdentity.controllerPid);await targetClosed;
      verifyProcessesDead([targetIdentity.controllerPid,targetIdentity.grandchildPid]);expect(alive(siblingIdentity.controllerPid)).toBe(true);expect(alive(siblingIdentity.grandchildPid)).toBe(true);
      const after=await eventually(()=>heartbeatCount(siblingHeartbeat),count=>count>before);expect(after).toBeGreaterThan(before);
      const closure=JSON.parse(readFileSync(audit,'utf8').trim().split(/\r?\n/u).at(-1)!);expect(closure.target).toBe(targetIdentity.controllerPid);
      const closurePids=closure.descendants.map((row:{pid:number})=>row.pid);expect(closurePids).toEqual(expect.arrayContaining([targetIdentity.controllerPid,targetIdentity.grandchildPid]));expect(new Set(closurePids).size).toBe(closurePids.length);verifyProcessesDead(closurePids);
      expect(closure.descendants.some((row:{pid:number})=>row.pid===siblingIdentity!.controllerPid||row.pid===siblingIdentity!.grandchildPid)).toBe(false);
      const siblingClosed=once(sibling,'close');terminateVerifiedTree(siblingIdentity.controllerPid);await siblingClosed;verifyProcessesDead([siblingIdentity.controllerPid,siblingIdentity.grandchildPid]);
    }finally{
      if(priorAudit===undefined)delete process.env.CUE_TERMINATION_AUDIT;else process.env.CUE_TERMINATION_AUDIT=priorAudit;
      for(const [child,identity] of [[target,targetIdentity],[sibling,siblingIdentity]] as const)if(child&&child.exitCode===null&&child.signalCode===null){try{if(identity)terminateVerifiedTree(identity.controllerPid);else child.kill('SIGKILL')}catch{child.kill('SIGKILL')}try{await once(child,'close')}catch{}}
      const targetPath=resolve(root),base=resolve(tmpdir());expect(dirname(targetPath)).toBe(base);expect(basename(targetPath).startsWith('cue-targeted-termination-')).toBe(true);expect(lstatSync(targetPath).isSymbolicLink()).toBe(false);rmSync(targetPath,{recursive:true,force:true});expect(existsSync(targetPath)).toBe(false);
    }
  },120_000);
});
