import { afterEach,describe,expect,it,vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openLedger,type Ledger } from '../src/ledger.js';
import { createNativeProcessCleanup } from '../src/native-process-cleanup.js';
const mocks=vi.hoisted(()=>({run:vi.fn()}));
vi.mock('../src/process-launch.js',()=>({runProcessSync:mocks.run}));
const dbs:Ledger[]=[];afterEach(()=>dbs.splice(0).forEach(db=>db.close()));
function fixture(){const db=openLedger();dbs.push(db);const h='a'.repeat(64);db.prepare('INSERT INTO task VALUES(?,?,?,?)').run('task','running',null,new Date(0).toISOString());db.prepare('INSERT INTO envelope VALUES(?,?,?,?)').run(h,'C:\\work','[]',new Date(0).toISOString());db.prepare('INSERT INTO run(id,task_id,envelope_hash,started_at) VALUES(?,?,?,?)').run('attempt','task',h,new Date(0).toISOString());db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run('session',10,'time','C:\\work','task','attempt');const receipt:any={attemptId:'attempt',candidateId:'candidate',taskId:'implement',subjectDigest:'b'.repeat(64),sessionHandle:'session',observedAtMs:0,controller:{pid:10,createdFileTime:'100'},workers:[{pid:11,createdFileTime:'101'}],resources:[{path:'C:\\owned',ownership:'ephemeral-owned',cleanup:'absent'},{path:'C:\\profile',ownership:'retained-authorized',cleanup:'retained'}]};return{db,receipt};}
describe('native process cleanup observation',()=>{
 it('requires exact owned identities absent and never deletes retained profile',()=>{const f=fixture(),paths:string[]=[];const host=createNativeProcessCleanup(f.db,{query:p=>p.map(x=>({pid:x.pid,createdFileTime:null,liveness:'absent'})),pathAbsent:path=>(paths.push(path),true)});expect(host.observe(f.receipt).result).toBe('verified-clean');expect(paths).toEqual(['C:\\owned']);});
 it('reports residual, permits PID reuse, and keeps query failures unknown',()=>{const f=fixture();const make=(query:any,pathAbsent=()=>true)=>createNativeProcessCleanup(f.db,{query,pathAbsent});expect(make((p:any[])=>p.map(x=>({pid:x.pid,createdFileTime:x.pid===10?'100':'101',liveness:x.pid===10?'alive':'exited'}))).observe(f.receipt).result).toBe('residual');expect(make((p:any[])=>p.map(x=>({pid:x.pid,createdFileTime:'999',liveness:'alive'}))).observe(f.receipt).result).toBe('verified-clean');expect(make(()=>{throw Error('query')}).observe(f.receipt).result).toBe('unknown');expect(make((p:any[])=>p.map(x=>({pid:x.pid,createdFileTime:null,liveness:'absent'})),()=>false).observe(f.receipt).result).toBe('residual');});
});

describe('native cleanup query boundary',()=>{
 afterEach(()=>mocks.run.mockReset());
 for(const count of [1,2,3,4])it(`sends distinct three-PID requests for ${count} owned processes and keeps original order`,()=>{
  const f=fixture(),owned=[1,2,3,4].slice(0,count).map(pid=>pid+10);
  f.receipt.controller={pid:owned[0],createdFileTime:'100'};
  f.receipt.workers=owned.slice(1).map(pid=>({pid,createdFileTime:'100'}));
  f.receipt.resources=[];
  const requests:any[]=[];
  mocks.run.mockImplementation((_command:string,args:string[])=>{
   const request=JSON.parse(Buffer.from(args[args.indexOf('-PayloadBase64')+1]!, 'base64').toString());
   requests.push(request);
   expect(request.processes).toHaveLength(3);
   expect(new Set(request.processes.map((entry:any)=>entry.pid)).size).toBe(3);
   expect(request.processes.every((entry:any)=>Number.isSafeInteger(entry.pid)&&entry.pid>0&&entry.pid<=2147483647)).toBe(true);
   return {status:0,error:undefined,stderr:'',stdout:JSON.stringify({version:request.version,nonce:request.nonce,processes:request.processes.map((entry:any)=>({pid:entry.pid,createdFileTime:null,liveness:owned.includes(entry.pid)?'absent':'alive'}))})};
  });
  expect(createNativeProcessCleanup(f.db).observe(f.receipt).result).toBe('verified-clean');
  expect(requests.flatMap(request=>request.processes.map((entry:any)=>entry.pid)).filter(pid=>owned.includes(pid))).toEqual(owned);
  expect(requests).toHaveLength(Math.ceil(count/3));
 });
 for(const failure of ['cardinality','order'])it(`rejects a helper response with wrong ${failure}`,()=>{
  const f=fixture();f.receipt.resources=[];
  mocks.run.mockImplementation((_command:string,args:string[])=>{
   const request=JSON.parse(Buffer.from(args[args.indexOf('-PayloadBase64')+1]!, 'base64').toString());
   const processes=request.processes.map((entry:any)=>({pid:entry.pid,createdFileTime:null,liveness:'absent'}));
   if(failure==='cardinality')processes.pop();else [processes[0],processes[1]]=[processes[1],processes[0]];
   return {status:0,error:undefined,stderr:'',stdout:JSON.stringify({version:request.version,nonce:request.nonce,processes})};
  });
  expect(createNativeProcessCleanup(f.db).observe(f.receipt).result).toBe('unknown');
 });
 it.skipIf(process.platform!=='win32')('accepts a real self-process observation through the Windows helper',()=>{
  const helper=fileURLToPath(new URL('../src/native-process-observation.ps1',import.meta.url));
  const pids=[process.pid];for(let candidate=1;pids.length<3;candidate++)if(!pids.includes(candidate))pids.push(candidate);
  const request={version:'cue-native-query-v1',nonce:'12345678-1234-1234-1234-123456789abc',processes:pids.map(pid=>({pid}))};
  const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-PayloadBase64',Buffer.from(JSON.stringify(request)).toString('base64')],{encoding:'utf8',timeout:10000,windowsHide:true});
  expect(result.status,result.stderr).toBe(0);
  const response=JSON.parse(result.stdout);
  expect(response.processes.map((entry:any)=>entry.pid)).toEqual(pids);
  expect(response.processes[0].liveness).toBe('alive');
 });
});
