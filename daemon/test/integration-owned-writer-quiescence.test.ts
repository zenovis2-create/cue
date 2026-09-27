import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { isAbsolute, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { createStagedExistingFilePublicationHost } from '../../app/staged-existing-file-publication-host.mjs';
import { observeProcessTree } from '../src/process-termination.js';
import { fixture } from './fixtures/git-staging-driver-fixture.js';

type Identity = Readonly<{pid:number;createdAt:string;cwd:string}>;
const childPath=resolve('test/fixtures/integration-owned-writer-quiescence-child.mjs');
const waitFor=async(predicate:()=>boolean,diagnostic:()=>unknown,timeoutMs=10_000)=>{const deadline=Date.now()+timeoutMs;while(!predicate()){if(Date.now()>deadline)throw Error(`owned_writer_wait_timeout:${JSON.stringify(diagnostic())}`);await new Promise(resolve=>setTimeout(resolve,5));}};

describe.runIf(process.platform==='win32')('owned staging writer quiescence',()=>{
 test('withholds publication and lease release until the exact real writer exits',async()=>{
  let child:ChildProcessWithoutNullStreams|undefined,identity:Identity|undefined,forcedUnknown=true,exitObserved=false,launchEntered=false,childStderr='',writerAttempt='';
  const observations:string[]=[],order:string[]=[];
  const f=fixture('unchanged',({host,db})=>{
   const production=createStagedExistingFilePublicationHost({db,authorizePublication:()=>true});
   host.finalPublication={
    authorize:production.authorize,
    openStagedAttempt:production.openStagedAttempt,
    readStagedReplacement:production.readStagedReplacement,
    execute:(input:any)=>{order.push('publication-commit');return production.execute!(input);},
   };
   const originalResolve=host.runtime.resolveCandidate;
   const originalVerifyCleanup=host.runtime.verifyCleanup;
   const originalReceipts=host.engine.receipts;
   host.engine.receipts=(context:any,snapshot:any)=>snapshot.cleanup==='verified-clean'?originalReceipts(context,snapshot):{billing:null,execution:null};
   host.runtime.resolveCandidate=(candidateId:string,attemptId:string,role:string,binding:any)=>{
    const candidate=originalResolve(candidateId,attemptId,role,binding);
    return {...candidate,launch:async(context:any)=>{
     if(!context.stagedPublication)return candidate.launch(context);
     writerAttempt=attemptId;
     launchEntered=true;const cwd=realpathSync.native(binding.owner.cwd);
     child=spawn(process.execPath,[childPath,cwd,'target.txt'],{cwd,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
     child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>{childStderr=(childStderr+chunk).slice(-4096);});
     const lines=createInterface({input:child.stdout});
     let readyTimer:ReturnType<typeof setTimeout>|undefined;
     const [line]=await Promise.race([once(lines,'line'),once(child,'exit').then(()=>{throw Error('owned_writer_early_exit');}),new Promise<never>((_,reject)=>{readyTimer=setTimeout(()=>reject(Error('owned_writer_ready_timeout')),10_000);})]).finally(()=>{if(readyTimer)clearTimeout(readyTimer);});
     identity=JSON.parse(String(line));lines.close();
     expect(identity).toMatchObject({kind:'ready',pid:child.pid,cwd});
     const observed=observeProcessTree(identity!.pid).descendants.find(value=>value.pid===identity!.pid);
     expect(observed?.createdAt).toBe(identity!.createdAt);
     const handle=`owned-writer-${attemptId.slice(-32)}`;
     db.prepare('INSERT INTO session_handle VALUES(?,?,?,?,?,?)').run(handle,identity!.pid,identity!.createdAt,cwd,binding.owner.task_id,binding.owner.run_id);
     void once(child,'exit').then(()=>{exitObserved=true;});
     return{durableRef:`session:${handle}`,completion:Promise.resolve('succeeded'),cancel:async()=>{if(child?.exitCode===null)child.stdin.write('release\n');}};
    }};
   };
   host.runtime.verifyCleanup=async(context:any)=>{
    if(context.runId!==writerAttempt)return originalVerifyCleanup(context);
    if(!identity||!child)return{runId:context.runId,subjectDigest:context.subjectDigest,result:'unknown',evidenceRef:'owned-writer-not-started'};
    if(forcedUnknown){forcedUnknown=false;observations.push('unknown');return{runId:context.runId,subjectDigest:context.subjectDigest,result:'unknown',evidenceRef:'owned-writer-observation-unknown'};}
    const observed=observeProcessTree(identity.pid).descendants.find(value=>value.pid===identity!.pid);
    if(observed?.createdAt===identity.createdAt){observations.push('matching-alive');return{runId:context.runId,subjectDigest:context.subjectDigest,result:'unknown',evidenceRef:`owned-writer-live:${identity.pid}:${identity.createdAt}`};}
    if(!exitObserved){observations.push(observed?'pid-reused':'unknown');return{runId:context.runId,subjectDigest:context.subjectDigest,result:'unknown',evidenceRef:'owned-writer-exit-unverified'};}
    observations.push(observed?'pid-reused':'matching-exited');order.push('writer-exited');
    return{runId:context.runId,subjectDigest:context.subjectDigest,result:'verified-clean',evidenceRef:`owned-writer-exited:${identity.pid}:${identity.createdAt}`};
   };
  });
  const running=f.driver.start(f.run);
  try{
   await waitFor(()=>!!identity&&observations.includes('matching-alive'),()=>({launchEntered,identity,childPid:child?.pid,exitCode:child?.exitCode,signalCode:child?.signalCode,childStderr,snapshot:f.driver.snapshot('workflow'),observations}));
   expect(readFileSync(join(f.publication,'target.txt'),'utf8')).toBe('base\n');
   expect(f.db.prepare('SELECT count(*) n FROM change_publication_result').get()).toEqual({n:0});
   expect(f.db.prepare('SELECT count(*) n FROM attempt_staging_cleanup').get()).toEqual({n:0});
   expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({n:1});
   expect(f.db.prepare('SELECT count(*) n FROM orchestration_receipt').get()).toEqual({n:0});
   child!.stdin.write('release\n');
   await running;
   expect(observations).toContain('unknown');expect(observations).toContain('matching-alive');expect(observations.at(-1)).toBe('matching-exited');
   expect(order).toEqual(['writer-exited','publication-commit']);
   expect(readFileSync(join(f.publication,'target.txt'),'utf8')).toBe('replacement\n');
   expect(f.db.prepare('SELECT result FROM attempt_staging_cleanup').get()).toEqual({result:'active_cleanup_verified'});
   expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({n:0});
   expect(f.db.prepare('SELECT count(*) n FROM orchestration_receipt').get()).toEqual({n:1});
   const receiptPath=process.env.CUE_OWNED_WRITER_RECEIPT;
   if(receiptPath){if(!isAbsolute(receiptPath))throw Error('owned_writer_receipt_path_not_absolute');writeFileSync(receiptPath,JSON.stringify({
    identity,observations,order,executionRoot:identity!.cwd,executionRootAbsent:!existsSync(identity!.cwd),publicationBytes:readFileSync(join(f.publication,'target.txt'),'utf8'),
    cleanup:f.db.prepare('SELECT result,evidence_sha256 FROM attempt_staging_cleanup').get(),leaseCount:(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get() as any).n,
    receiptCount:(f.db.prepare('SELECT count(*) n FROM orchestration_receipt').get() as any).n,snapshot:f.driver.snapshot('workflow'),
   },null,2),{encoding:'utf8',flag:'wx'});}
  }finally{if(child?.exitCode===null){child.stdin.write('release\n');await Promise.race([once(child,'exit'),new Promise((_,reject)=>setTimeout(()=>reject(Error('owned_writer_final_exit_timeout')),5000))]);}}
 },60_000);
});
