import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

type Mode = 'hang'|'spawn-throw'|'error'|'nonzero'|'stderr'|'empty'|'overflow'|'success-abort';
const state = vi.hoisted(() => ({ mode: 'hang' as Mode, spawns: [] as any[], terminate: vi.fn(), record: vi.fn(), cleanup: vi.fn(), afterClose: vi.fn() }));
vi.mock('../src/change-snapshot-host.js', () => ({ identifyChangeSnapshotRoot: () => ({ state: 'ok', identity: { volumeSerial: '1', fileId: '2' } }) }));
vi.mock('../src/readonly-verifier-control.js', () => ({ snapshotReadonlyVerifierControl: (v: unknown) => v, verifyReadonlyVerifierControl: () => true }));
vi.mock('../src/readonly-verifier-identity-store.js', () => ({ createReadonlyVerifierIdentityStore: () => ({ record: state.record, cleanup: state.cleanup }) }));
vi.mock('../src/process-termination.js', () => ({ terminateVerifiedTree: state.terminate, verifyProcessesDead: vi.fn() }));
vi.mock('../src/process-launch.js', () => {
  class Events { listeners=new Map<string,((v:any)=>void)[]>(); on(n:string,f:(v:any)=>void){this.listeners.set(n,[...(this.listeners.get(n)??[]),f]);return this;} once(n:string,f:(v:any)=>void){return this.on(n,f);} emit(n:string,v?:any){for(const f of this.listeners.get(n)??[])f(v);} }
  return { resolveOwnedExecutable: () => 'C:\\Windows\\powershell.exe', spawnOwned: (_db:unknown,owner:any,_command:string,args:string[]) => {
    if(state.mode==='spawn-throw')throw Error('fixture-spawn');
    const child=new Events() as any;child.stdout=new Events();child.stderr=new Events();child.stdin={end:vi.fn()};child.pid=410;child.exitCode=null;child.kill=vi.fn();state.spawns.push({child,args});
    queueMicrotask(()=>{if(state.mode==='error')child.emit('error',Error('fixture-error'));if(state.mode==='nonzero'){child.exitCode=2;child.emit('close',2);}if(state.mode==='stderr'){child.stderr.emit('data','denied');child.exitCode=0;child.emit('close',0);}if(state.mode==='empty'){child.exitCode=0;child.emit('close',0);}if(state.mode==='overflow'){child.stdout.emit('data',Buffer.alloc(65535,0x61));child.stderr.emit('data',Buffer.from('é'));}if(state.mode==='success-abort'){child.stdout.emit('data','O:BAG:BAD:(A;;FA;;;SY)');child.exitCode=0;child.emit('close',0);state.afterClose();}});
    return {child,session:{...owner,handle:'acl-session',pid:410,start_time:'fixture'}};
  }};
});

const roots:string[]=[];
beforeEach(()=>{state.mode='hang';state.spawns.length=0;state.terminate.mockReset();state.record.mockReset();state.cleanup.mockReset();state.afterClose.mockReset();});
afterEach(()=>{vi.useRealTimers();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});

async function fixture(signal=new AbortController().signal){
  const root=mkdtempSync(join(tmpdir(),'cue-readonly-acl-'));roots.push(root);const worktree=join(root,'worktree'),runtime=join(root,'runtime');mkdirSync(worktree);mkdirSync(runtime);
  const launcher=join(root,'launcher.ps1'),executable=join(root,'checker.exe');writeFileSync(launcher,'fixture');writeFileSync(executable,'fixture');
  const control={executable,launcher,executableSha256:'a'.repeat(64),launcherSha256:createHash('sha256').update(readFileSync(launcher)).digest('hex'),sha256:'c'.repeat(64)} as any;
  const argv=['--fixture'],timeoutMs=100,environmentContractDigest=createHash('sha256').update(JSON.stringify({version:'cue-readonly-env-v1',keys:['APPDATA','HOME','LOCALAPPDATA','TEMP','TMP','USERPROFILE','SystemRoot','WINDIR'],systemRoot:process.env.SystemRoot??'C:\\Windows'})).digest('hex');
  const command={argv,timeoutMs,commandDigest:createHash('sha256').update(JSON.stringify({argv,timeoutMs,control:control.sha256,environmentContractDigest})).digest('hex')};
  const stage={attemptId:'attempt',owner:{cwd:resolve(worktree),task_id:'stage-task',run_id:'attempt'},envelope:{worktree_realpath:resolve(worktree),egress:[],allowed_actions:['command']}} as any;
  const db={inTransaction:false,prepare:()=>({get:()=>({role:'verifier',candidate_id:'checker',expected_subject_digest:'d'.repeat(64)})})} as any;
  const {createReadonlyVerifierWorker}=await import('../src/readonly-verifier-worker.js');
  return createReadonlyVerifierWorker({db,control,runtimeRootBase:runtime,resolveBinding:()=>({stage,command})}).launch('attempt',signal);
}
function noAuthority(){expect(state.spawns).toHaveLength(1);expect(state.record).not.toHaveBeenCalled();expect(state.cleanup).not.toHaveBeenCalled();}

test('pre-aborted request spawns nothing',async()=>{const c=new AbortController();c.abort();await expect(fixture(c.signal)).rejects.toThrow('readonly_worker_launch_state');expect(state.spawns).toHaveLength(0);});

test('hung ACL reaches its fixed five-second trigger and settles without close',async()=>{vi.useFakeTimers();const pending=fixture(),rejected=expect(pending).rejects.toThrow('readonly_acl_observation');await vi.advanceTimersByTimeAsync(4999);expect(state.terminate).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);await rejected;expect(state.terminate).toHaveBeenCalledWith(410);noAuthority();state.spawns[0].child.exitCode=0;state.spawns[0].child.emit('close',0);noAuthority();});

test('in-flight abort terminates and settles without close',async()=>{const c=new AbortController(),pending=fixture(c.signal);await vi.waitFor(()=>expect(state.spawns).toHaveLength(1));c.abort();await expect(pending).rejects.toThrow('readonly_acl_observation');expect(state.terminate).toHaveBeenCalledWith(410);noAuthority();});

test('abort immediately after successful ACL close cannot launch verifier',async()=>{const c=new AbortController();state.mode='success-abort';state.afterClose.mockImplementation(()=>c.abort());await expect(fixture(c.signal)).rejects.toThrow('readonly_worker_launch_state');noAuthority();});

test('combined UTF8 ACL output over 64 KiB terminates before verifier launch',async()=>{state.mode='overflow';await expect(fixture()).rejects.toThrow('readonly_acl_observation');expect(state.terminate).toHaveBeenCalledWith(410);noAuthority();});

test.each(['spawn-throw','error','nonzero','stderr','empty'] as const)('%s ACL failure never launches verifier or writes authority',async mode=>{state.mode=mode;await expect(fixture()).rejects.toThrow();expect(state.spawns.length).toBe(mode==='spawn-throw'?0:1);if(mode==='error')expect(state.terminate).toHaveBeenCalledWith(410);expect(state.record).not.toHaveBeenCalled();expect(state.cleanup).not.toHaveBeenCalled();});

test('termination locks failure before a synchronous late successful close',async()=>{const c=new AbortController(),pending=fixture(c.signal);await vi.waitFor(()=>expect(state.spawns).toHaveLength(1));state.terminate.mockImplementation(()=>{const child=state.spawns[0].child;child.stdout.emit('data','O:BAG:BAD:(A;;FA;;;SY)');child.exitCode=0;child.emit('close',0);});c.abort();await expect(pending).rejects.toThrow('readonly_acl_observation');noAuthority();});

test('termination verification failure remains explicitly unverified',async()=>{const c=new AbortController();state.terminate.mockImplementation(()=>{throw Error('unverified');});const pending=fixture(c.signal);await vi.waitFor(()=>expect(state.spawns).toHaveLength(1));c.abort();await expect(pending).rejects.toThrow('readonly_acl_termination_unverified');noAuthority();});
