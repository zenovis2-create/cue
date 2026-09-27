import {describe,it,expect} from 'vitest';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer,createConnection,type Socket} from 'node:net';
import {measureModelControlBundle,matchesModelControlObservation} from '../src/model-control-bundle.js';
const root=resolve('dist/src'),launcher=join(root,'model-only-launch.ps1');
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const field=(text:string,key:string)=>text.split(/\r?\n/).find(l=>l.startsWith(key+'='))?.slice(key.length+1);
function config(kind:'model'|'json-checker'|'goal-proposal-checker',operation:string,request:unknown,controlRoot=root){return{nodeExecutable:process.execPath,nodeSha256:hash(process.execPath),parentPid:process.pid,timeoutMs:12000,clientKind:kind,controlBundle:measureModelControlBundle({controlRoot,nodeExecutable:process.execPath,clientKind:kind}),diagnosticClientSha256:hash(join(controlRoot,'model-boundary-probe.cjs')),qualificationOperation:operation,request:JSON.stringify(request)}}
async function run(payload:Record<string,unknown>,output?:(text:string)=>void,launcherPath=launcher){
 const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcherPath,'-PayloadBase64',Buffer.from(JSON.stringify(payload)).toString('base64'),'-QualificationHarness'],{windowsHide:true});
 let out='',err='';child.stdout.on('data',chunk=>{out+=chunk;output?.(out)});child.stderr.on('data',chunk=>err+=chunk);
 const code=await new Promise<number|null>((done,reject)=>{child.on('close',done);child.on('error',reject)});return{code,out,err};
}
function clean(out:string){const boundary=JSON.parse(field(out,'CUE_MODEL_BOUNDARY')!);expect(JSON.parse(field(out,'CUE_MODEL_CLEANUP')!)).toEqual({profileAbsent:true,taskRootAbsent:true});expect(existsSync(boundary.taskRoot)).toBe(false);expect(existsSync(boundary.profilePath)).toBe(false);expect(()=>process.kill(Number(field(out,'CUE_MODEL_PID')),0)).toThrow();return boundary}
describe.skipIf(process.platform!=='win32')('fixed qualification client with production pins (no eligibility)',()=>{
 it.each(['model','json-checker'] as const)('%s production recipe has actual process limit cause and distinct diagnostic identity',async kind=>{
  const payload=config(kind,'process-limit',{protocol:'cue-boundary-probe-v1',operation:'process-limit'}),r=await run(payload);
  expect(r.err).toBe('');expect(r.code,r.out).toBe(0);const boundary=clean(r.out),body=JSON.parse(Buffer.from(field(r.out,'CUE_MODEL_RESPONSE')!,'base64').toString());
  expect(body).toMatchObject({operation:'process-limit',attempts:1});expect(r.out).not.toContain('UNEXPECTED_CHILD_MARKER');
  expect(JSON.parse(field(r.out,'CUE_MODEL_PROCESS_LIMIT')!)).toMatchObject({status:'observed',messageId:3,eventCount:1,ownedWorkerPid:body.pid});
  expect(boundary).toMatchObject({controlStatus:'qualification-pinned',recipeVersion:'cue-client-recipe-v1',productionClientSha256:payload.controlBundle.clientSha256,diagnosticClientSha256:payload.diagnosticClientSha256,clientSha256:payload.diagnosticClientSha256,checkerCoreSha256:payload.controlBundle.checkerCoreSha256,preserveDependencySymlinks:kind==='json-checker'});
  expect(matchesModelControlObservation(payload.controlBundle,boundary)).toBe(false);
 },20000);
 it.each(['model','json-checker'] as const)('%s actual filesystem denial with host before/after controls and bounded listener',async kind=>{
  const temporary=mkdtempSync(join(tmpdir(),'Cue.Qualification.')),outside=join(temporary,'outside.txt');writeFileSync(outside,'outside-unchanged');
  const received:string[]=[],sockets=new Set<Socket>();const server=createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});let text='';socket.on('data',bytes=>{text+=bytes;if(text.includes('\n')){received.push(text.trim());socket.end(text)}})});
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const port=(server.address() as {port:number}).port;
  const control=(nonce:string)=>new Promise<void>((done,reject)=>{const socket=createConnection({host:'127.0.0.1',port});let data='';socket.setTimeout(2000,()=>socket.destroy(Error('control_timeout')));socket.on('connect',()=>socket.write(nonce+'\n'));socket.on('data',b=>data+=b);socket.on('error',reject);socket.on('end',()=>data.trim()===nonce?done():reject(Error('nonce_mismatch')))});
  const nonce=randomUUID();let seeded=false,inspected=false,hostError:unknown;let post:unknown;
  try{
   await control('pre');const payload={...config(kind,'filesystem-network',{protocol:'cue-boundary-probe-v1',operation:'filesystem-network',outsideFile:outside,port,nonce}),qualificationHoldAfterExit:true};
   const r=await run(payload,out=>{try{
    if(!seeded&&field(out,'CUE_MODEL_PID')){seeded=true;const b=JSON.parse(field(out,'CUE_MODEL_BOUNDARY')!);writeFileSync(join(b.profilePath,'probe-existing.txt'),'seed');writeFileSync(join(b.profilePath,'Temp','probe-existing.txt'),'seed');writeFileSync(join(b.taskRoot,'host-ready'),'ready')}
    if(!inspected&&field(out,'CUE_MODEL_PROBE_WAIT')){inspected=true;const b=JSON.parse(field(out,'CUE_MODEL_BOUNDARY')!);const paths=[join(b.taskRoot,'existing.txt'),join(b.profilePath,'probe-existing.txt'),join(b.profilePath,'Temp','probe-existing.txt'),outside];post=paths.map(p=>({text:readFileSync(p,'utf8'),noNew:!existsSync(join(resolve(p,'..'),'forbidden-new.txt'))}));writeFileSync(join(b.taskRoot,'host-inspection-complete'),'complete')}
   }catch(e){hostError=e}});
   await control('post');expect(hostError).toBeUndefined();expect(inspected).toBe(true);expect(r.err).toBe('');expect(r.code,r.out).toBe(0);clean(r.out);
   expect(post).toEqual(['unchanged','seed','seed','outside-unchanged'].map(text=>({text,noNew:true})));
   const response=JSON.parse(Buffer.from(field(r.out,'CUE_MODEL_RESPONSE')!,'base64').toString());
   for(const target of Object.values(response.files) as any[]){for(const code of Object.values(target.operations))expect(['EACCES','EPERM']).toContain(code);expect(target.after).toBe(target.before)}
   expect(response.network.connected).toBe(false);expect(response.network.sent).toBe(false);expect(received).toEqual(['pre','post']);
   expect(JSON.parse(field(r.out,'CUE_MODEL_OBSERVATION')!)).toMatchObject({appContainer:true,capabilities:[],loopbackExempt:false,pid:response.pid});
  }finally{for(const socket of sockets)socket.destroy();await new Promise<void>(done=>server.close(()=>done()));rmSync(temporary,{recursive:true,force:true})}
 },25000);
 it('rejects missing pins, arbitrary paths, bad operation and non-fixture outside target before child',async()=>{
  const good=config('model','process-limit',{protocol:'cue-boundary-probe-v1',operation:'process-limit'});
  for(const bad of [{...good,controlBundle:undefined},{...good,probePath:'untrusted'},{...good,qualificationOperation:'eval'},{...good,diagnosticClientSha256:'0'.repeat(64)}, {...good,qualificationOperation:'filesystem-network',request:JSON.stringify({protocol:'cue-boundary-probe-v1',operation:'filesystem-network',outsideFile:resolve('package.json'),port:1,nonce:'n'})}]){
   const r=await run(bad);expect(r.code).not.toBe(0);expect(field(r.out,'CUE_MODEL_PID')).toBeUndefined();
  }
 },15000);
});

describe.skipIf(process.platform!=='win32')('goal proposal diagnostic pin',()=>{
 it('runs the real pinned diagnostic client and cleans its owned child',async()=>{
  const controlRoot=resolve('src');
  const payload=config('goal-proposal-checker','process-limit',{protocol:'cue-boundary-probe-v1',operation:'process-limit'},controlRoot);
  const result=await run(payload,undefined,join(controlRoot,'model-only-launch.ps1'));
  expect(result.err).toBe('');expect(result.code,result.out).toBe(0);
  const boundary=clean(result.out);
  expect(boundary).toMatchObject({clientKind:'goal-proposal-checker',controlStatus:'qualification-pinned',
   productionClientSha256:payload.controlBundle.clientSha256,diagnosticClientSha256:payload.diagnosticClientSha256,
   checkerCoreSha256:payload.controlBundle.checkerCoreSha256,preserveDependencySymlinks:true});
  expect(JSON.parse(field(result.out,'CUE_MODEL_PROCESS_LIMIT')!)).toMatchObject({status:'observed',eventCount:1,messageId:3});
  expect(matchesModelControlObservation(payload.controlBundle,boundary)).toBe(false);
 },20000);
});
