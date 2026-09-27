import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect,test} from 'vitest';
import {createOrchestrationDriver} from '../../app/orchestration-driver.mjs';
import {compareWriteExistingNative,snapshotRelativeNative} from '../src/change-snapshot-host.js';
import {openLedger} from '../src/ledger.js';
import {fixture} from './fixtures/git-staging-driver-fixture.js';

test.runIf(process.platform==='win32')('partial native restoration is quarantined and reopen never republishes or retries cleanup',async()=>{
  const calls={read:0,publish:0,reconcile:0,cleanup:0},restorations:string[]=[];
  let executionRoot='';
  const f=fixture('unchanged',({host,configuration,db,publication,git})=>{
    writeFileSync(join(publication,'zz-second.txt'),'base\n');
    git('add','zz-second.txt');git('commit','-m','fixture second approved target');
    configuration.changeTargets.push({taskId:'make',targetId:'second',relativePath:'zz-second.txt',maxBackupBytes:1024});
    const resolveCandidate=host.runtime.resolveCandidate;
    host.runtime.resolveCandidate=(...args:any[])=>{
      const candidate=resolveCandidate(...args);
      return {...candidate,launch:async(context:any)=>{
        const launched=await candidate.launch(context);
        if(context.stagedPublication)writeFileSync(join(args[3].owner.cwd,'zz-second.txt'),'replacement\n');
        return launched;
      }};
    };
    host.finalPublication.openStagedAttempt=(contract:any)=>{expect(contract.targets).toHaveLength(2);return {contractId:contract.contractId};};
    host.finalPublication.readStagedReplacement=(input:any)=>{
      calls.read++;
      executionRoot=(db.prepare('SELECT execution_worktree_realpath FROM attempt_staging_authority WHERE attempt_id=?').get(input.attemptId) as any).execution_worktree_realpath;
      return readFileSync(join(executionRoot,input.relativePath));
    };
    host.finalPublication.execute=(input:any)=>{calls.publish++;return compareWriteExistingNative(input);};
    const original=host.executionStaging;
    host.executionStaging={...original,factory:{...original.factory,sha256:'f'.repeat(64),
      // Deliberate injected factory: native primitives are real; the contention schedule is synthetic.
      reconcilePublished:(root:any,targets:any[])=>{
        calls.reconcile++;expect(targets).toHaveLength(2);
        const snapshots=targets.map(target=>{
          const snapshot=snapshotRelativeNative({root:root.worktreeRealpath,expectedRoot:root.rootIdentity,targets:[target.relativePath],maxBytes:target.maxBytes});
          if(snapshot.state!=='ok'||snapshot.results[0]?.state!=='ok')throw Error('fixture_snapshot_failed');
          return snapshot.results[0];
        });
        for(let index=0;index<targets.length;index++){
          const target=targets[index],before=snapshots[index]!;
          expect(before.sha256).toBe(target.publishedSha256);
          if(index===1)writeFileSync(join(root.worktreeRealpath,target.relativePath),'new-divergence\n');
          const result=compareWriteExistingNative({root:root.worktreeRealpath,expectedRoot:root.rootIdentity,target:target.relativePath,
            expected:{identity:before.identity!,sha256:before.sha256!,byteLength:before.byteLength!},replacement:target.original,maxBytes:target.maxBytes});
          if(index===0){expect(result.state).toBe('committed');restorations.push(target.relativePath);}
          else {expect(result.state).toBe('contention');throw Error('fixture_second_native_contention');}
        }
      },
      cleanup:(root:any)=>{calls.cleanup++;return original.factory.cleanup(root);},
    }};
  });
  await f.driver.start(f.run);
  expect(calls).toEqual({read:2,publish:2,reconcile:1,cleanup:0});
  expect(restorations).toEqual(['target.txt']);
  expect(readFileSync(join(executionRoot,'target.txt'),'utf8')).toBe('base\n');
  expect(readFileSync(join(executionRoot,'zz-second.txt'),'utf8')).toBe('new-divergence\n');
  expect(f.db.prepare('SELECT result FROM attempt_staging_cleanup').get()).toEqual({result:'active_cleanup_unknown'});
  expect(f.db.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({n:1});
  expect(f.db.prepare('SELECT count(*) n FROM orchestration_receipt').get()).toEqual({n:0});
  expect(f.db.prepare("SELECT count(*) n FROM change_publication_result WHERE state='committed'").get()).toEqual({n:2});
  expect(f.driver.snapshot('workflow')).toMatchObject({state:'blocked',reason:'change_publication_unresolved'});
  const ledgerPath=f.db.name;
  f.db.close();
  const reopened=openLedger(ledgerPath);
  try{
    const restarted=createOrchestrationDriver({db:reopened,host:f.host});
    expect(()=>restarted.start(f.run)).toThrow('driver_prepare_missing');
    expect(()=>restarted.snapshot('workflow')).toThrow();
    expect(calls).toEqual({read:2,publish:2,reconcile:1,cleanup:0});
    expect(reopened.prepare('SELECT result FROM attempt_staging_cleanup').get()).toEqual({result:'active_cleanup_unknown'});
    expect(reopened.prepare('SELECT count(*) n FROM workspace_write_lease').get()).toEqual({n:1});
    expect(reopened.prepare("SELECT count(*) n FROM change_publication_result WHERE state='committed'").get()).toEqual({n:2});
    expect(readFileSync(join(executionRoot,'target.txt'),'utf8')).toBe('base\n');
    expect(readFileSync(join(executionRoot,'zz-second.txt'),'utf8')).toBe('new-divergence\n');
  }finally{reopened.close();}
},90_000);
