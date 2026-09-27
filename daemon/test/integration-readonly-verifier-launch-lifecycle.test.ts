import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createReadonlyVerifierWorker } from '../src/readonly-verifier-worker.js';

type Mode='no-close'|'error'|'stdin-missing'|'stdin-error'|'abort'|'late-close'|'termination-fails'|'overflow'|'worker-live';
const state=vi.hoisted(()=>({mode:'no-close' as Mode,spawns:[] as any[],terminate:vi.fn(),dead:vi.fn(),record:vi.fn(),cleanup:vi.fn(),removeRuntime:vi.fn(),runtime:''}));
vi.mock('../src/change-snapshot-host.js',()=>({identifyChangeSnapshotRoot:()=>({state:'ok',identity:{volumeSerial:'1',fileId:'2'}})}));
vi.mock('../src/readonly-verifier-control.js',()=>({snapshotReadonlyVerifierControl:(v:unknown)=>v,verifyReadonlyVerifierControl:()=>true}));
vi.mock('../src/readonly-verifier-identity-store.js',()=>({createReadonlyVerifierIdentityStore:()=>({record:state.record,cleanup:state.cleanup})}));
vi.mock('../src/process-termination.js',()=>({terminateVerifiedTree:state.terminate,verifyProcessesDead:state.dead}));
vi.mock('../src/process-launch.js',()=>{
 class Events{listeners=new Map<string,((v:any)=>void)[]>();on(n:string,f:(v:any)=>void){this.listeners.set(n,[...(this.listeners.get(n)??[]),f]);return this;}once(n:string,f:(v:any)=>void){return this.on(n,f);}emit(n:string,v?:any){for(const f of this.listeners.get(n)??[])f(v);}}
 return{resolveOwnedExecutable:()=> 'C:\\Windows\\powershell.exe',spawnOwned:(_db:unknown,owner:any,_command:string,args:string[])=>{const index=state.spawns.length,child=new Events() as any;child.stdout=new Events();child.stderr=new Events();child.pid=500+index;child.exitCode=null;child.kill=vi.fn();
   if(index===0)queueMicrotask(()=>{child.stdout.emit('data','O:BAG:BAD:(A;;FA;;;SY)');child.exitCode=0;child.emit('close',0);});
   else if(state.mode!=='stdin-missing'){child.stdin=new Events() as any;child.stdin.end=(value:string)=>{const encoded=/-PayloadBase64 '([^']+)'/u.exec(value)?.[1],payload=encoded?JSON.parse(Buffer.from(encoded,'base64').toString()):null;if(payload)state.runtime=payload.runtimeRoot;if(state.mode==='stdin-error')queueMicrotask(()=>child.stdin.emit('error',Error('stdin')));if(state.mode==='error')queueMicrotask(()=>child.emit('error',Error('launcher')));if(state.mode==='overflow')queueMicrotask(()=>child.stdout.emit('data',Buffer.alloc(1_048_577,0x61)));if(state.mode==='worker-live')queueMicrotask(()=>{child.stdout.emit('data',`CUE_READONLY_PID=321;CREATED_FILE_TIME=12345678901\r\nCUE_READONLY_CLEANUP=${JSON.stringify({nonce:payload.nonce,rootIdentity:'1:2',aclRestored:true,profileAbsent:true})}\r\n`);state.removeRuntime();child.exitCode=0;child.emit('close',0);});};}
   state.spawns.push({child,args});return{child,session:{...owner,handle:`session-${index}`,pid:child.pid,start_time:'fixture'}};}};
});

const roots:string[]=[];
beforeEach(()=>{state.mode='no-close';state.runtime='';state.spawns.length=0;for(const fn of [state.terminate,state.dead,state.record,state.cleanup,state.removeRuntime])fn.mockReset();});
afterEach(()=>{vi.useRealTimers();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});

async function fixture(signal=new AbortController().signal){const root=mkdtempSync(join(tmpdir(),'cue-readonly-launch-'));roots.push(root);const worktree=join(root,'worktree'),runtime=join(root,'runtime');mkdirSync(worktree);mkdirSync(runtime);const launcher=join(root,'launcher.ps1'),executable=join(root,'checker.exe');writeFileSync(launcher,'fixture');writeFileSync(executable,'fixture');
 const control={executable,launcher,executableSha256:'a'.repeat(64),launcherSha256:createHash('sha256').update(readFileSync(launcher)).digest('hex'),sha256:'c'.repeat(64)} as any,argv=['--fixture'],timeoutMs=100,environmentContractDigest=createHash('sha256').update(JSON.stringify({version:'cue-readonly-env-v1',keys:['APPDATA','HOME','LOCALAPPDATA','TEMP','TMP','USERPROFILE','SystemRoot','WINDIR'],systemRoot:process.env.SystemRoot??'C:\\Windows'})).digest('hex'),command={argv,timeoutMs,commandDigest:''};command.commandDigest=createHash('sha256').update(JSON.stringify({argv,timeoutMs,control:control.sha256,environmentContractDigest})).digest('hex');
 const stage={attemptId:'attempt',owner:{cwd:resolve(worktree),task_id:'stage-task',run_id:'attempt'},envelope:{worktree_realpath:resolve(worktree),egress:[],allowed_actions:['command']}} as any,db={inTransaction:false,prepare:()=>({get:()=>({role:'verifier',candidate_id:'checker',expected_subject_digest:'d'.repeat(64)})})} as any;
 return createReadonlyVerifierWorker({db,control,runtimeRootBase:runtime,resolveBinding:()=>({stage,command})}).launch('attempt',signal);}
const noAuthority=()=>{expect(state.spawns).toHaveLength(2);expect(state.record).not.toHaveBeenCalled();expect(state.cleanup).not.toHaveBeenCalled();};

test('launcher deadline settles failed without a close event',async()=>{vi.useFakeTimers();const pending=fixture();for(let n=0;n<20&&state.spawns.length<2;n++)await Promise.resolve();expect(state.spawns).toHaveLength(2);const rejected=expect(pending).resolves.toMatchObject({outcome:'failed',identityRef:null,cleanupRef:null});await vi.advanceTimersByTimeAsync(15099);expect(state.terminate).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(state.terminate).toHaveBeenCalledWith(501);await rejected;noAuthority();});

test.each(['error','stdin-error','overflow'] as const)('%s settles without close and cannot write authority',async mode=>{state.mode=mode;await expect(fixture()).resolves.toMatchObject({outcome:'failed',identityRef:null,cleanupRef:null});expect(state.terminate).toHaveBeenCalledWith(501);noAuthority();});

test('missing stdin terminates the owned launcher and settles failed',async()=>{state.mode='stdin-missing';await expect(fixture()).resolves.toMatchObject({outcome:'failed',identityRef:null,cleanupRef:null});expect(state.terminate).toHaveBeenCalledWith(501);noAuthority();});

test('in-flight abort terminates and settles without close',async()=>{const c=new AbortController(),pending=fixture(c.signal);await vi.waitFor(()=>expect(state.spawns).toHaveLength(2));c.abort();await expect(pending).resolves.toMatchObject({outcome:'failed',identityRef:null,cleanupRef:null});expect(state.terminate).toHaveBeenCalledWith(501);noAuthority();});

test('failure is locked before verified termination can emit late success',async()=>{const c=new AbortController(),pending=fixture(c.signal);await vi.waitFor(()=>expect(state.spawns).toHaveLength(2));state.terminate.mockImplementation(()=>{const child=state.spawns[1].child;child.stdout.emit('data','CUE_READONLY_PID=321;CREATED_FILE_TIME=12345678901\r\n');child.exitCode=0;child.emit('close',0);});c.abort();await expect(pending).resolves.toMatchObject({outcome:'failed',identityRef:null,cleanupRef:null});noAuthority();});

test('unverified launcher termination rejects and retains the owned runtime',async()=>{const c=new AbortController(),pending=fixture(c.signal);await vi.waitFor(()=>expect(state.spawns).toHaveLength(2));state.terminate.mockImplementation(()=>{throw Error('unknown');});c.abort();await expect(pending).rejects.toThrow('readonly_launcher_termination_unverified');expect(existsSync(state.runtime)).toBe(true);noAuthority();state.spawns[1].child.emit('close',0);expect(existsSync(state.runtime)).toBe(true);noAuthority();});

test('normal exit retains runtime when worker death is unverified',async()=>{state.mode='worker-live';state.dead.mockImplementation(()=>{throw Error('alive');});await expect(fixture()).resolves.toMatchObject({outcome:'failed',identityRef:null,cleanupRef:null});expect(state.dead).toHaveBeenCalledWith([321]);expect(existsSync(state.runtime)).toBe(true);noAuthority();});

test('unverified worker death cannot mint authority when runtime is externally absent',async()=>{state.mode='worker-live';state.removeRuntime.mockImplementation(()=>rmSync(state.runtime,{recursive:true,force:true}));state.dead.mockImplementation(()=>{throw Error('unknown');});await expect(fixture()).resolves.toMatchObject({outcome:'failed',identityRef:null,cleanupRef:null});expect(existsSync(state.runtime)).toBe(false);noAuthority();});
