import { describe, expect, it, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { createInterface } from 'node:readline';
import { buildHostThreadStartParams, HostCodexRpcSession } from '../src/host-codex-controller.js';
import { settleHostRuntimeTeardown, type HostCodexRuntimeOptions, type HostCodexRuntimeResult, type RunningHostCodexRun } from '../src/host-codex-runtime.js';
import { createCodexExecutor, createDefaultCodexCandidate } from '../src/adapters/integration-executors.js';
import type { RuntimeContext } from '../src/integration-runtime.js';
import type { Ledger } from '../src/ledger.js';

const answer = (passed=true): HostCodexRuntimeResult => ({
  threadId:'thread',turnId:'turn',status:'completed',finalMessage:'done',controllerPid:1,workerPids:[2],successfulToolCalls:1,
  controllerStderr:'token=private stderr C:\\Users\\private',goalVerification:{passed,reason:passed?'workspace_changed':'workspace_unchanged',changedPaths:passed?['result.txt']:[]},
});
const context = (controller=new AbortController(), emitActivity?: RuntimeContext['emitActivity']): RuntimeContext => ({
  runId:'attempt',candidateId:'canonical-codex',role:'implementation',subjectDigest:'a'.repeat(64),signal:controller.signal,...(emitActivity?{emitActivity}:{}),
});
const binding = () => ({
  owner:{run_id:'attempt',task_id:'step',cwd:'C:/fixture'},
  envelope:{run_id:'attempt',worktree_realpath:'C:/fixture',egress:[] as string[],expires_at:'2026-09-13T00:00:00.000Z',autonomy_level:'bounded' as const,allowed_actions:['write'] as string[]},
  options:{codexHome:'C:/isolated-codex-home',goal:'write result.txt',controllerArgs:['fixture-server'],requestTimeoutMs:3000},
});

describe('S1 Codex common adapter preservation',()=>{
  it('golden-compares default composition, immutable launch inputs and typed activity without starting Codex',async()=>{
    const source=binding(),tool={id:'codex-host',revision:'host-v1'},activity:Array<{kind:string;data:Record<string,unknown>}>=[],raw:any[]=[];
    let launchArgs:unknown[]=[];let resolveDone!:(value:HostCodexRuntimeResult)=>void;
    const done=new Promise<HostCodexRuntimeResult>(resolve=>{resolveDone=resolve;});
    const backend={session:{handle:'session-attempt'},done,stop:vi.fn()} as unknown as RunningHostCodexRun;
    const candidate=createDefaultCodexCandidate({db:{} as Ledger,binary:'C:/vendor/codex.exe',model:'host-model',tool,availability:'ready',
      buildCurrentSubject:()=>({} as any),evidenceReferences:()=>({}),resolveBinding:()=>source,onActivity:event=>{raw.push(event);},
      launch:(...args)=>{launchArgs=args;queueMicrotask(()=>{
        const options=args[3] as HostCodexRuntimeOptions;
        options.onEvent?.({kind:'tool',callRef:`call:${'b'.repeat(64)}`,status:'started'});
        options.onEvent?.({kind:'output',contentRef:'unknown',sha256:'c'.repeat(64),byteLength:4,truncated:false});
        options.onEvent?.({kind:'terminal',status:'completed'});
        options.onEvent?.({kind:'artifact',artifactKind:'workspace-change-set',sourceRef:'workspace-snapshot',sha256:'d'.repeat(64),byteLength:80});
        resolveDone(answer());
      });return backend;},
    });
    tool.id='mutated';source.owner.task_id='mutated';source.envelope.egress.push('network');source.options.controllerArgs.push('mutated');
    const execution=await candidate.launch(context(undefined,(kind,data)=>{activity.push({kind,data:{...data}});}));
    expect(candidate).toMatchObject({kind:'agent',supportedRoles:['implementation'],cancellation:'supported',usage:'supported',typedActivitySource:'host-codex-controller-v1',durableExecutionRef:'session-handle-v1'});
    expect(launchArgs).toEqual([{}, {run_id:'attempt',task_id:'mutated',cwd:'C:/fixture'}, expect.objectContaining({run_id:'attempt',egress:['network']}), expect.objectContaining({binary:'C:/vendor/codex.exe',model:'host-model',codexHome:'C:/isolated-codex-home',goal:'write result.txt',controllerArgs:['fixture-server','mutated']})]);
    expect(Object.isFrozen(launchArgs[1])).toBe(true);expect(Object.isFrozen((launchArgs[3] as HostCodexRuntimeOptions).controllerArgs)).toBe(true);
    source.owner.task_id='after-launch';source.envelope.egress.push('after-launch');source.options.controllerArgs.push('after-launch');
    expect(launchArgs[1]).toEqual({run_id:'attempt',task_id:'mutated',cwd:'C:/fixture'});
    expect((launchArgs[2] as any).egress).toEqual(['network']);expect((launchArgs[3] as any).controllerArgs).toEqual(['fixture-server','mutated']);
    expect(await execution.result).toBe(await done);expect(await execution.completion).toBe('succeeded');expect(execution.durableRef).toBe('session:session-attempt');
    expect(raw.map(row=>row.ordinal)).toEqual([2,3,4,5]);
    expect(activity.map(row=>row.kind)).toEqual(['heartbeat','tool','output','terminal','artifact','usage']);
    expect(activity.find(row=>row.kind==='tool')?.data).toMatchObject({toolId:'codex-host',toolRevision:'host-v1'});
    expect(JSON.stringify(activity)).not.toMatch(/private stderr|token=|C:\\\\Users|write result\.txt|host-model/iu);
    expect(buildHostThreadStartParams('C:/isolated-codex-home/controller-workspace','goal').dynamicTools.map(tool=>tool.name)).toEqual(['cue_workspace']);
  });

  it('rejects accessor and proxy inputs before launch and snapshots returned option bytes',async()=>{
    const base={db:{} as Ledger,binary:'C:/vendor/codex.exe',model:'host-model',tool:{id:'codex',revision:'host-v1'},resolveBinding:()=>binding(),launch:vi.fn()};
    expect(()=>createCodexExecutor(new Proxy(base,{}))).toThrow(/invalid_executor_host/u);
    const getterTool=Object.defineProperty({},'id',{enumerable:true,get:()=> 'secret'});Object.defineProperty(getterTool,'revision',{enumerable:true,value:'host-v1'});
    expect(()=>createCodexExecutor({...base,tool:getterTool as any})).toThrow(/invalid_executor_tool/u);
    const launch=vi.fn();
    const execute=createCodexExecutor({...base,launch,resolveBinding:()=>new Proxy(binding(),{})});
    await expect(execute(context())).rejects.toThrow(/invalid_executor_binding/u);expect(launch).not.toHaveBeenCalled();
    const options=Object.defineProperty({codexHome:'C:/isolated'},'goal',{enumerable:true,get:()=> 'secret prompt'});
    const getterExecute=createCodexExecutor({...base,launch,resolveBinding:()=>({...binding(),options:options as any})});
    await expect(getterExecute(context())).rejects.toThrow(/invalid_executor_options/u);expect(launch).not.toHaveBeenCalled();
  });

  it('rejects hostile arrays without invoking getters, traps, iterators or launch',async()=>{
    const fields=['controllerArgs','egress','allowed_actions'] as const;
    for(const field of fields){
      let hits=0;const accessor:string[]=[];
      Object.defineProperty(accessor,'0',{enumerable:true,get(){hits++;return 'secret';}});Object.defineProperty(accessor,'length',{value:1});
      const launch=vi.fn(),source=binding();
      if(field==='controllerArgs')source.options.controllerArgs=accessor;
      else source.envelope[field]=accessor;
      const execute=createCodexExecutor({db:{} as Ledger,binary:'C:/vendor/codex.exe',model:'host-model',tool:{id:'codex',revision:'host-v1'},resolveBinding:()=>source,launch});
      await expect(execute(context())).rejects.toThrow();expect(hits).toBe(0);expect(launch).not.toHaveBeenCalled();
    }

    const hostile:unknown[]=[];
    hostile.push(new Array(1),Object.setPrototypeOf([],{}),new Array(257));
    const symbolArray:string[]=[];Object.defineProperty(symbolArray,Symbol('extra'),{value:'x'});hostile.push(symbolArray);
    const extraArray:string[]=[];Object.defineProperty(extraArray,'extra',{value:'x',enumerable:true});hostile.push(extraArray);
    let traps=0;hostile.push(new Proxy([],{get(){traps++;return undefined;},getPrototypeOf(){traps++;return Array.prototype;},ownKeys(){traps++;return [];}}));
    const revoked=Proxy.revocable([],{});revoked.revoke();hostile.push(revoked.proxy);
    for(const controllerArgs of hostile){
      const launch=vi.fn(),source=binding();source.options.controllerArgs=controllerArgs as string[];
      await expect(createCodexExecutor({db:{} as Ledger,binary:'C:/vendor/codex.exe',model:'host-model',tool:{id:'codex',revision:'host-v1'},resolveBinding:()=>source,launch})(context())).rejects.toThrow();
      expect(launch).not.toHaveBeenCalled();
    }
    expect(traps).toBe(0);
  });

  it('keeps pre/during/repeated cancel and stop failure non-success without inventing provider terminal or cleanup',async()=>{
    const pre=new AbortController();pre.abort();const preLaunch=vi.fn();
    const base={db:{} as Ledger,binary:'C:/vendor/codex.exe',model:'host-model',tool:{id:'codex',revision:'host-v1'},resolveBinding:()=>binding()};
    await expect(createCodexExecutor({...base,launch:preLaunch})(context(pre))).rejects.toThrow();expect(preLaunch).not.toHaveBeenCalled();

    for(const stopThrows of [false,true]){
      const controller=new AbortController(),events:string[]=[];let resolveDone!:(value:HostCodexRuntimeResult)=>void;let stops=0;
      const done=new Promise<HostCodexRuntimeResult>(resolve=>{resolveDone=resolve;});
      const execute=createCodexExecutor({...base,launch:()=>{controller.abort();return {session:{handle:'session-attempt'},done,stop(){stops++;if(stopThrows)throw Error('stop private');}} as RunningHostCodexRun;}});
      const execution=await execute(context(controller,(kind)=>{events.push(kind);}));
      const first=execution.cancel(),second=execution.cancel();
      if(stopThrows){await expect(first).rejects.toThrow('stop_failed');await expect(second).rejects.toThrow('stop_failed');}
      else{await first;await second;}
      resolveDone(answer());expect(await execution.completion).toBe('failed');expect(stops).toBe(1);
      expect(events.filter(kind=>kind==='cancel')).toHaveLength(stopThrows?0:1);expect(events).not.toContain('terminal');
    }
  });

  it('fails completion on goal-verification or activity sink failure while preserving the raw backend receipt',async()=>{
    const unhandled:unknown[]=[];const onUnhandled=(reason:unknown)=>unhandled.push(reason);process.on('unhandledRejection',onUnhandled);
    for(const mode of ['goal','sync-sink','async-context-sink','async-raw-sink','timeout-raw-sink'] as const){
      const backendAnswer=answer(mode!=='goal');let options!:HostCodexRuntimeOptions,resolveDone!:(value:HostCodexRuntimeResult)=>void,stops=0;
      const done=new Promise<HostCodexRuntimeResult>(resolve=>{resolveDone=resolve;});
      const execute=createCodexExecutor({db:{} as Ledger,binary:'C:/vendor/codex.exe',model:'host-model',tool:{id:'codex',revision:'host-v1'},resolveBinding:()=>binding(),
        ...(mode==='sync-sink'?{onActivity:()=>{throw Error('sink secret');}}:{}),
        ...(mode==='async-raw-sink'?{onActivity:async()=>{throw Error('async sink failed');}}:{}),
        ...(mode==='timeout-raw-sink'?{onActivity:()=>new Promise<void>(()=>{}),activityTimeoutMs:10}:{}),
        launch:(_db,_owner,_envelope,value)=>{options=value;return {session:{handle:'session-attempt'},done,stop(){stops++;}} as RunningHostCodexRun;}});
      const execution=await execute(context(undefined,mode==='async-context-sink'?async kind=>{if(kind==='output')throw Error('sink secret');}:undefined));
      if(mode!=='goal')options.onEvent?.({kind:'output',contentRef:'unknown',sha256:'e'.repeat(64),byteLength:1,truncated:false});
      resolveDone(backendAnswer);
      expect(await execution.result).toBe(backendAnswer);expect(await execution.completion).toBe('failed');expect(stops).toBe(mode==='goal'?0:1);
    }
    await new Promise(resolve=>setImmediate(resolve));process.off('unhandledRejection',onUnhandled);expect(unhandled).toEqual([]);
  });

  it('drains controller events through the default candidate before allowing completion',async()=>{
    const fromServer=new PassThrough(),toServer=new PassThrough();const activities:any[]=[],projected:any[]=[];let rpc!:HostCodexRpcSession;
    const lines=createInterface({input:toServer});
    lines.on('line',line=>{const message=JSON.parse(line);
      if(message.method==='initialize')fromServer.write(JSON.stringify({id:message.id,result:{}})+'\n');
      else if(message.method==='thread/start')fromServer.write(JSON.stringify({id:message.id,result:{thread:{id:'thread-product'}}})+'\n');
      else if(message.method==='turn/start'){fromServer.write(JSON.stringify({id:message.id,result:{turn:{id:'turn-product'}}})+'\n');
        fromServer.write(JSON.stringify({method:'item/completed',params:{threadId:'thread-product',turnId:'turn-product',item:{type:'agentMessage',text:'safe product output'}}})+'\n');
        fromServer.write(JSON.stringify({method:'turn/completed',params:{threadId:'thread-product',turn:{id:'turn-product',status:'completed'}}})+'\n');}}
    );
    const candidate=createDefaultCodexCandidate({db:{} as Ledger,binary:'C:/vendor/codex.exe',model:'host-model',tool:{id:'canonical-tool',revision:'host-v1'},availability:'ready',buildCurrentSubject:()=>({} as any),evidenceReferences:()=>({}),resolveBinding:()=>binding(),
      onActivity:async event=>{await Promise.resolve();activities.push(event);},
      launch:(_db,_owner,_envelope,options)=>{rpc=new HostCodexRpcSession({readable:fromServer,writable:toServer},async()=>({exitCode:0,stdout:'',stderr:'',enforcement:'appcontainer'}),{onEvent:options.onEvent});
        const done=rpc.run({cwd:'C:/isolated/controller-workspace',workspaceCwd:'C:/fixture',goal:'write result.txt',model:options.model}).then(result=>({...answer(),...result}));
        return {session:{handle:'session-attempt'},done,stop(){rpc.close();}} as RunningHostCodexRun;},
    });
    const execution=await candidate.launch(context(undefined,(kind,data)=>{projected.push({kind,data});}));expect(await execution.completion).toBe('succeeded');
    expect(activities.map(row=>row.event.kind)).toEqual(['input','input','output','terminal']);expect(activities.map(row=>row.ordinal)).toEqual([2,3,4,5]);
    expect(activities.slice(0,2).map(row=>row.event.executedInputVerified)).toEqual([false,false]);
    expect(projected.filter(row=>row.kind==='progress').map(row=>row.data.summary)).toEqual([
      expect.stringMatching(/^host-rpc-ack-only:thread\/start:[a-f0-9]{64}:[1-9][0-9]*$/u),
      expect.stringMatching(/^host-rpc-ack-only:turn\/start:[a-f0-9]{64}:[1-9][0-9]*$/u),
    ]);
    expect(JSON.stringify(activities)).not.toContain('safe product output');expect(JSON.stringify(projected)).not.toContain('write result.txt');rpc.close();lines.close();
  });

  it('preserves ordered runtime teardown and reports each stage failure',async()=>{
    const order:string[]=[];
    const errors=await settleHostRuntimeTeardown({closeRpc(){order.push('rpc');throw Error('rpc');},workers:[{stop(){order.push('stop-1');},completion:Promise.resolve({})},{stop(){order.push('stop-2');throw Error('stop');},completion:Promise.reject(Error('worker'))}],closeController(){order.push('controller');},cleanup(){order.push('cleanup');}});
    expect(order).toEqual(['rpc','stop-1','stop-2','controller','cleanup']);expect(errors.map(error=>error.stage)).toEqual(['rpc','worker_stop','worker_completion']);
  });
});
