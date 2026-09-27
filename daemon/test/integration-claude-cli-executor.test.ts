import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {realpathSync} from 'node:fs';
import {afterEach,describe,expect,test,vi} from 'vitest';
import {claudeConfigurationFixture} from './fixtures/claude-configuration.js';
import type {RuntimeContext} from '../src/integration-runtime.js';
import type {ClaudeAuthorizedLaunch} from '../src/adapters/claude-cli-executor.js';

const mocks=vi.hoisted(()=>({spawn:vi.fn(),assert:vi.fn()}));
vi.mock('../src/process-launch.js',()=>({spawnOwned:mocks.spawn}));
vi.mock('../../app/provider-installation.mjs',()=>({assertCurrentProviderInstallation:mocks.assert}));
import {createClaudeCliExecutor} from '../src/adapters/claude-cli-executor.js';

const sid='2b9e1035-62b5-4dd1-a56e-b1f862537311', cwd=realpathSync.native(process.cwd());
const ctrl=()=>new AbortController();
const context=(signal=ctrl().signal):RuntimeContext=>({runId:'attempt',candidateId:'candidate',role:'implementation',subjectDigest:'a'.repeat(64),accountIdentity:{reference:'subscription',digest:'b'.repeat(64)},signal});
const binding=():ClaudeAuthorizedLaunch=>({owner:{run_id:'attempt',task_id:'task',cwd},envelope:{run_id:'attempt',worktree_realpath:cwd,allowed_actions:['file_change'],egress:[],expires_at:'2099-09-19T00:00:00Z',autonomy_level:'bounded'},candidateId:'candidate',subjectDigest:'a'.repeat(64),accountIdentity:{reference:'subscription',digest:'b'.repeat(64)},model:'claude-sonnet-5',prompt:'edit the file'});
const init={type:'system',subtype:'init',session_id:sid,uuid:'init-1',claude_code_version:'2.1.274',model:'claude-sonnet-5',cwd,tools:['Read','Edit'],mcp_servers:[]};
const result={type:'result',subtype:'success',session_id:sid,uuid:'result-1',is_error:false,result:'done',stop_reason:'end_turn',duration_ms:1,duration_api_ms:1,num_turns:1,total_cost_usd:0.01,usage:{},modelUsage:{'claude-sonnet-5':{inputTokens:1,outputTokens:1,costUSD:0.01}},permission_denials:[]};
const wire=(...events:unknown[])=>events.map(event=>JSON.stringify(event)+'\n').join('');
function fakeChild(){
  const child=Object.assign(new EventEmitter(),{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough(),pid:42});
  const session={run_id:'attempt',task_id:'task',cwd,pid:42,start_time:'2026-09-19T00:00:00Z',handle:'handle-1'};
  mocks.spawn.mockReturnValue({child,session});
  return child;
}
const configurationFixtures:ReturnType<typeof claudeConfigurationFixture>[]=[];
afterEach(()=>{for(const fixture of configurationFixtures.splice(0))fixture.cleanup();mocks.assert.mockReset();});
function host(overrides:Record<string,unknown>={}){
  const fixture=claudeConfigurationFixture('C:\\vendor\\claude.exe');configurationFixtures.push(fixture);
  const stop=vi.fn(async()=>{});
  const capture=vi.fn((session:{pid:number})=>({pid:session.pid,createdAt:'2026-09-19T00:00:00.123Z'}));
  return {value:{db:{} as any,installation:fixture.installation,resolveLaunch:()=>binding(),resolveAuthorizedConfig:fixture.resolver(),captureOwnedIdentity:capture,stopOwnedTree:stop,...overrides},stop,capture,fixture};
}
describe('inactive Claude CLI executor',()=>{
  test('rejects missing config and mismatched binding before spawn',async()=>{
    mocks.spawn.mockClear(); mocks.assert.mockClear();
    await expect(createClaudeCliExecutor(host({resolveLaunch:()=>null}).value)(context())).rejects.toThrow('unavailable');
    await expect(createClaudeCliExecutor(host({resolveLaunch:()=>({...binding(),accountIdentity:{reference:'other',digest:'bad'}})}).value)(context())).rejects.toThrow('binding');
    await expect(createClaudeCliExecutor(host({resolveLaunch:()=>({...binding(),envelope:{...binding().envelope,expires_at:'2020-01-01T00:00:00Z'}})}).value)(context())).rejects.toThrow('envelope');
    expect(()=>createClaudeCliExecutor(host({runTimeoutMs:Number.NaN}).value)).toThrow('timeout');
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  test('missing/null/forged configuration and launch-supplied env cannot spawn',async()=>{
    mocks.spawn.mockClear();
    for(const resolveAuthorizedConfig of [undefined,async()=>null,async()=>({version:'cue-claude-configuration-v1' as const})]){
      await expect(createClaudeCliExecutor(host({resolveAuthorizedConfig}).value)(context())).rejects.toThrow(/configuration/);
    }
    await expect(createClaudeCliExecutor(host({resolveLaunch:()=>({...binding(),env:{USERPROFILE:'ambient'}})}).value)(context())).rejects.toThrow('env_from_launch');
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  test('abort during configuration lookup refuses before spawn',async()=>{
    mocks.spawn.mockClear();const controller=ctrl(),{value,fixture}=host();
    let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    value.resolveAuthorizedConfig=fixture.resolver(async request=>{await gate;return fixture.session(request);});
    const launching=createClaudeCliExecutor(value)(context(controller.signal));
    await new Promise(resolve=>setImmediate(resolve));controller.abort();release();
    await expect(launching).rejects.toThrow();expect(mocks.spawn).not.toHaveBeenCalled();
  });
  test('expiry after configuration lookup refuses before spawn',async()=>{
    mocks.spawn.mockClear();const {value,fixture}=host(),resolve=fixture.resolver();
    value.resolveAuthorizedConfig=async request=>{const binding=await resolve(request);fixture.setNow(200);return binding;};
    await expect(createClaudeCliExecutor(value)(context())).rejects.toThrow('configuration');
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  test.each(['expiry','abort'] as const)('pre-spawn installation recheck cannot cross %s boundary',async mode=>{
    vi.useFakeTimers();
    try {
      mocks.assert.mockClear();const controller=ctrl(),source=binding(),child=fakeChild(),{value}=host({resolveLaunch:()=>source});
      mocks.spawn.mockClear();
      const expires=Date.now()+10000;source.envelope.expires_at=new Date(expires).toISOString();
      mocks.assert.mockImplementation(()=>{
        if(mocks.assert.mock.calls.length===4){if(mode==='expiry')vi.setSystemTime(expires+1);else controller.abort();}
      });
      let error:unknown,execution;
      try{execution=await createClaudeCliExecutor(value)(context(controller.signal));}catch(caught){error=caught;}
      // Clean any incorrectly returned execution before asserting the refusal.
      child.emit('close',1);if(execution)await execution.completion;
      expect(error).toBeInstanceOf(Error);
      expect(mocks.spawn).not.toHaveBeenCalled();
    } finally {vi.useRealTimers();}
  });
  test('async configuration lookup cannot mutate approved launch fields',async()=>{
    const child=fakeChild(),source=binding(),{value,fixture}=host({resolveLaunch:()=>source});
    value.resolveAuthorizedConfig=fixture.resolver(async request=>{
      (source as any).prompt='unapproved prompt';(source as any).model='other';(source.owner as any).cwd='other';
      source.envelope.allowed_actions[0]='command';
      return fixture.session(request);
    });
    const execution=await createClaudeCliExecutor(value)(context());
    expect(child.stdin.read().toString()).toBe('edit the file');
    expect(mocks.spawn.mock.calls.at(-1)?.[1].cwd).toBe(cwd);
    expect(mocks.spawn.mock.calls.at(-1)?.[3].at(-1)).toBe('claude-sonnet-5');
    child.stdout.write(wire(init,result));child.emit('close',0);
    expect(await execution.completion).toBe('succeeded');
  });
  test('fixed invocation, owned session, terminal plus EOF and exit0',async()=>{
    const child=fakeChild(), {value,fixture}=host();
    const execution=await createClaudeCliExecutor(value)(context());
    expect(mocks.spawn.mock.calls.at(-1)?.[2]).toBe('C:\\vendor\\claude.exe');
    const args=mocks.spawn.mock.calls.at(-1)?.[3] as string[];
    expect(args).toContain('--restricted'); expect(args).toContain('--permission-prompts'); expect(args).not.toContain('edit the file');
    expect(mocks.spawn.mock.calls.at(-1)?.[4].env).toEqual(fixture.environment);
    expect(mocks.spawn.mock.calls.at(-1)?.[4].env).not.toHaveProperty('PATH');
    child.stdout.write(wire(init,result)); child.emit('close',0);
    expect(await execution.completion).toBe('succeeded');
    expect(await execution.providerTerminal).toMatchObject({outcome:'success',estimatedCostUsd:0.01});
    expect(execution.durableRef).toBe('session:handle-1');
  });
  test('wrong init, truncated output, and nonzero exit fail',async()=>{
    for(const mode of ['wrong','truncated','exit']){
      const child=fakeChild(), execution=await createClaudeCliExecutor(host().value)(context());
      child.stdout.write(mode==='wrong'?wire({...init,model:'other'},result):mode==='truncated'?wire(init)+JSON.stringify(result):wire(init,result));
      child.emit('close',mode==='exit'?1:0);
      expect(await execution.completion).toBe('failed');
    }
  });
  test('cancel is idempotent, fences late output and does not prove cleanup',async()=>{
    const child=fakeChild(), controller=ctrl(), {value,stop}=host();
    const execution=await createClaudeCliExecutor(value)(context(controller.signal));
    controller.abort(); await Promise.all([execution.cancel(),execution.cancel()]);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith({pid:42,createdAt:'2026-09-19T00:00:00.123Z'},expect.objectContaining({pid:42,handle:'handle-1'}));
    child.stdout.write(wire(init,result)); child.emit('close',0);
    expect(await execution.completion).toBe('failed');
  });
  test('async activity rejection fences success',async()=>{
    const child=fakeChild(), {value,stop}=host({onActivity:async()=>{throw Error('sink');}});
    const execution=await createClaudeCliExecutor(value)(context());
    child.stdout.write(wire(init,result));
    await new Promise(resolve=>setImmediate(resolve)); child.emit('close',0);
    expect(await execution.completion).toBe('failed'); expect(stop).toHaveBeenCalledTimes(1);
  });
  test('abort while authorization is pending refuses before spawn',async()=>{
    mocks.spawn.mockClear(); const controller=ctrl();
    let release!: (value:ClaudeAuthorizedLaunch)=>void;
    const deferred=new Promise<ClaudeAuthorizedLaunch>(resolve=>{release=resolve;});
    const launching=createClaudeCliExecutor(host({resolveLaunch:()=>deferred}).value)(context(controller.signal));
    controller.abort(); release(binding());
    await expect(launching).rejects.toThrow(); expect(mocks.spawn).not.toHaveBeenCalled();
  });
  test('deadline requests owned stop and cannot produce success',async()=>{
    const child=fakeChild(), {value,stop}=host({runTimeoutMs:10});
    const execution=await createClaudeCliExecutor(value)(context());
    await new Promise(resolve=>setTimeout(resolve,30));
    expect(stop).toHaveBeenCalledTimes(1);
    child.stdout.write(wire(init,result)); child.emit('close',0);
    expect(await execution.completion).toBe('failed');
  });
  test('identity capture failure returns retained durable handle with unknown outcome',async()=>{
    const child=fakeChild(), {value,stop}=host({captureOwnedIdentity:()=>{throw Error('native observation failed');}});
    const execution=await createClaudeCliExecutor(value)(context());
    expect(execution.durableRef).toBe('session:handle-1');
    expect(await execution.completion).toBe('unknown');
    expect(stop).not.toHaveBeenCalled();
    child.emit('close',0);
  });
  test('async pipe error and rejected stop settle unknown without close',async()=>{
    const child=fakeChild(), {value,stop}=host({stopOwnedTree:async()=>{throw Error('stop unverified');}});
    const execution=await createClaudeCliExecutor(value)(context());
    child.stdin.emit('error',Error('EPIPE'));
    expect(await execution.completion).toBe('unknown');
    expect(stop).not.toHaveBeenCalled();
    expect(execution.durableRef).toBe('session:handle-1');
  });
  test('stop resolves but child never closes: bounded unknown',async()=>{
    fakeChild(); const {value,stop}=host({runTimeoutMs:5});
    const execution=await createClaudeCliExecutor(value)(context());
    expect(await execution.completion).toBe('unknown');
    expect(stop).toHaveBeenCalledTimes(1);
  });
  test('public cancel rejects within grace when trusted stop never settles',async()=>{
    fakeChild();
    const {value}=host({stopOwnedTree:()=>new Promise<void>(()=>{})});
    const execution=await createClaudeCliExecutor(value)(context());
    await expect(execution.cancel()).rejects.toThrow('stop_timeout');
    expect(await execution.completion).toBe('unknown');
    expect(execution.durableRef).toBe('session:handle-1');
  });
  test.each(['acknowledged','rejected','timeout'] as const)('close before owned stop is %s waits for its bounded outcome',async mode=>{
    vi.useFakeTimers();
    try {
      let acknowledge!:()=>void, reject!:(error:Error)=>void;
      const stopped=new Promise<void>((resolve,rejectStop)=>{acknowledge=resolve;reject=rejectStop;});
      const child=fakeChild(), {value}=host({stopOwnedTree:()=>stopped});
      const execution=await createClaudeCliExecutor(value)(context());
      const cancellation=execution.cancel();
      // Observe rejection immediately, including the timeout branch.
      const cancelResult=cancellation.then(()=> 'acknowledged',()=> 'rejected');
      let completed=false;
      void execution.completion.then(()=>{completed=true;});
      child.emit('close',0);
      await vi.advanceTimersByTimeAsync(1);
      const completedBeforeStop=completed;
      if(mode==='acknowledged') acknowledge();
      else if(mode==='rejected') reject(Error('owned tree still unverified'));
      else await vi.advanceTimersByTimeAsync(1000);
      expect(await cancelResult).toBe(mode==='acknowledged'?'acknowledged':'rejected');
      expect(await execution.completion).toBe(mode==='acknowledged'?'failed':'unknown');
      expect(completedBeforeStop).toBe(false);
      expect(await execution.providerTerminal).toBeNull();
      expect(execution.durableRef).toBe('session:handle-1');
    } finally {vi.useRealTimers();}
  });
  test('init with unauthorized tools or MCP cannot succeed',async()=>{
    for(const observed of [{...init,tools:['Read','Edit','Bash']},{...init,mcp_servers:[{name:'external',status:'connected'}]}]){
      const child=fakeChild(), execution=await createClaudeCliExecutor(host().value)(context());
      child.stdout.write(wire(observed,result)); child.emit('close',0);
      expect(await execution.completion).toBe('failed');
    }
  });
});
