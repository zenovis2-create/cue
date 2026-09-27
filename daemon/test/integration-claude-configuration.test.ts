import {mkdirSync,readFileSync,realpathSync,renameSync,symlinkSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {afterEach,expect,test,vi} from 'vitest';
import {claudeConfigurationFixture} from './fixtures/claude-configuration.js';
import type {ClaudeConfigurationRequest} from '../../app/claude-configuration.mjs';
const mocks=vi.hoisted(()=>({assert:vi.fn()}));
vi.mock('../../app/provider-installation.mjs',()=>({assertCurrentProviderInstallation:mocks.assert}));
import {consumeClaudeConfiguration,createClaudeConfigurationResolver} from '../../app/claude-configuration.mjs';

const fixtures:ReturnType<typeof claudeConfigurationFixture>[]=[];
afterEach(()=>{for(const f of fixtures.splice(0))f.cleanup();mocks.assert.mockReset();});
function fixture(){const f=claudeConfigurationFixture();fixtures.push(f);return f;}
const request=():ClaudeConfigurationRequest=>({attemptId:'attempt-1',candidateId:'claude-inactive',subjectDigest:'a'.repeat(64),
  accountIdentity:{reference:'approved-account',digest:'b'.repeat(64)},model:'claude-sonnet-5',worktreePath:realpathSync.native(process.cwd())});

test('explicit host session produces opaque one-use environment without modifying profile contents',async()=>{
  const f=fixture(),input=request(),before=readFileSync(f.authProfilePath);
  const resolver=f.resolver(),binding=await resolver(input);
  expect(binding).toEqual({version:'cue-claude-configuration-v1'});
  expect(JSON.stringify(binding)).not.toContain(f.root);
  const environment=consumeClaudeConfiguration(binding!,input,f.installation);
  expect(environment).toEqual(f.environment);expect(Object.isFrozen(environment)).toBe(true);
  expect(()=>consumeClaudeConfiguration(binding!,input,f.installation)).toThrow('unavailable');
  await expect(resolver(input)).rejects.toThrow('unavailable');
  expect(readFileSync(f.authProfilePath)).toEqual(before);
  // Initial lookup, post-callback issuance, consumption and duplicate lookup.
  expect(mocks.assert).toHaveBeenCalledTimes(4);
});
test('null session has no ambient fallback; missing resolver and wrong provider/version refuse',async()=>{
  const f=fixture();expect(await f.resolver(()=>null)(request())).toBeNull();
  expect(()=>createClaudeConfigurationResolver({installation:f.installation,now:()=>100,maxAgeMs:100} as any)).toThrow('unavailable');
  for(const installation of [{...f.installation,provider:'codex'},{...f.installation,version:{value:'unreviewed'}}]){
    const resolveAuthorizedSession=vi.fn();
    const resolve=createClaudeConfigurationResolver({installation:installation as any,now:()=>100,maxAgeMs:100,resolveAuthorizedSession});
    await expect(resolve(request())).rejects.toThrow('unavailable');expect(resolveAuthorizedSession).not.toHaveBeenCalled();
  }
});
test.each(['attemptId','candidateId','subjectDigest','accountIdentity','model','worktreePath'] as const)('crossed %s cannot consume an issued binding',async key=>{
  const f=fixture(),input=request(),binding=await f.resolver()(input);
  const changed={...input,[key]:key==='accountIdentity'?{reference:'other',digest:'c'.repeat(64)}:key==='subjectDigest'?'c'.repeat(64):'other'};
  expect(()=>consumeClaudeConfiguration(binding!,changed,f.installation)).toThrow('unavailable');
  expect(()=>consumeClaudeConfiguration(binding!,input,f.installation)).toThrow('unavailable');
});
test('forged/cloned/foreign-installation bindings fail',async()=>{
  const f=fixture(),input=request(),binding=await f.resolver()(input);
  expect(()=>consumeClaudeConfiguration({...binding!},input,f.installation)).toThrow('unavailable');
  expect(()=>consumeClaudeConfiguration(binding!,input,{...f.installation})).toThrow('unavailable');
});
test('resolver cannot change account/model or select an unidentified profile',async()=>{
  const f=fixture();
  for(const mutate of [
    (s:any)=>({...s,request:{...s.request,accountIdentity:{reference:'other',digest:'b'.repeat(64)}}}),
    (s:any)=>({...s,request:{...s.request,model:'other'}}),
    (s:any)=>({...s,authProfilePath:join(f.environment.USERPROFILE,'unidentified.json')}),
  ])await expect(f.resolver(r=>mutate(f.session(r)))(request())).rejects.toThrow('unavailable');
});
test.each(['missing','extra','ambient','worktree','outside-home','mismatched-home','relative'] as const)('refuses %s environment',async mode=>{
  const f=fixture();
  await expect(f.resolver(r=>{
    const environment:any={...f.environment};
    if(mode==='missing')delete environment.CLAUDE_CONFIG_DIR;
    if(mode==='extra')environment.ANTHROPIC_API_KEY='not-a-secret';
    if(mode==='ambient'){environment.USERPROFILE=realpathSync.native(homedir());environment.HOME=environment.USERPROFILE;}
    if(mode==='worktree'){environment.USERPROFILE=r.worktreePath;environment.HOME=r.worktreePath;}
    if(mode==='outside-home')environment.CLAUDE_CONFIG_DIR=r.worktreePath;
    if(mode==='mismatched-home')environment.HOME=r.worktreePath;
    if(mode==='relative')environment.TEMP='relative';
    return {...f.session(r),environment};
  })(request())).rejects.toThrow('unavailable');
});
test.each(['future','expired','overlong'] as const)('refuses %s session window',async mode=>{
  const f=fixture();
  await expect(f.resolver(r=>({...f.session(r),observedAtMs:mode==='future'?101:mode==='expired'?0:100,
    validUntilMs:mode==='expired'?100:mode==='overlong'?201:200}))(request())).rejects.toThrow('unavailable');
});
test('rechecks expiry, installation and profile/layout drift immediately before consumption',async()=>{
  const f=fixture(),input=request();
  let binding=await f.resolver()(input);f.setNow(200);
  expect(()=>consumeClaudeConfiguration(binding!,input,f.installation)).toThrow('unavailable');
  f.setNow(100);binding=await f.resolver()(input);mocks.assert.mockImplementationOnce(()=>{throw Error('drift');});
  expect(()=>consumeClaudeConfiguration(binding!,input,f.installation)).toThrow('unavailable');
  binding=await f.resolver()(input);writeFileSync(f.authProfilePath,'changed-fixture-profile');
  expect(()=>consumeClaudeConfiguration(binding!,input,f.installation)).toThrow('unavailable');
  binding=await f.resolver()(input);
  renameSync(f.environment.CLAUDE_CONFIG_DIR,f.environment.CLAUDE_CONFIG_DIR+'-old');mkdirSync(f.environment.CLAUDE_CONFIG_DIR);
  expect(()=>consumeClaudeConfiguration(binding!,input,f.installation)).toThrow('unavailable');
});
test('junction config roots cannot be issued even when they point inside the explicit home',async()=>{
  const f=fixture();
  const link=join(f.environment.USERPROFILE,'linked');symlinkSync(f.environment.CLAUDE_CONFIG_DIR,link,'junction');
  await expect(f.resolver(r=>({...f.session(r),environment:{...f.environment,CLAUDE_CONFIG_DIR:link}}))(request())).rejects.toThrow('unavailable');
});
test('hostile request/session/environment getters and proxies execute no traps',async()=>{
  const f=fixture();let traps=0;
  const resolve=vi.fn();
  const resolver=f.resolver(resolve);
  const proxy=new Proxy(request(),{getPrototypeOf(){traps++;throw Error('trap');}});
  await expect(resolver(proxy)).rejects.toThrow('unavailable');expect(resolve).not.toHaveBeenCalled();
  const hostile=Object.defineProperty({...request()},'model',{enumerable:true,get(){traps++;return 'model';}});
  await expect(resolver(hostile)).rejects.toThrow('unavailable');expect(resolve).not.toHaveBeenCalled();
  await expect(f.resolver(r=>({...f.session(r),environment:Object.defineProperty({...f.environment},'HOME',{
    enumerable:true,get(){traps++;return f.environment.HOME;}})}))(request())).rejects.toThrow('unavailable');
  expect(traps).toBe(0);
});
test('direct session then-getters and proxies are rejected without Promise assimilation',async()=>{
  const f=fixture();let traps=0;
  await expect(f.resolver(r=>Object.defineProperty({...f.session(r)},'then',{
    enumerable:true,get(){traps++;throw Error('unexpected getter');}}))(request())).rejects.toThrow('unavailable');
  await expect(f.resolver(r=>new Proxy(f.session(r),{get(){traps++;throw Error('unexpected proxy');}}))(request())).rejects.toThrow('unavailable');
  expect(traps).toBe(0);
});
test('snapshots caller/session data and refuses concurrent duplicate attempt resolution',async()=>{
  const f=fixture(),input=request();let release!:(value:any)=>void,observed:ClaudeConfigurationRequest|undefined;
  const resolve=f.resolver(r=>{observed=r;return new Promise(done=>{release=done;});});
  const pending=resolve(input);
  (input as any).model='mutated';(input.accountIdentity as any).reference='mutated';
  await expect(resolve(request())).rejects.toThrow('unavailable');
  expect(observed).toEqual(request());expect(Object.isFrozen(observed?.accountIdentity)).toBe(true);
  const session=f.session(observed!);release(session);const binding=await pending;
  (session.environment as any).HOME='mutated';
  expect(consumeClaudeConfiguration(binding!,request(),f.installation).HOME).not.toBe('mutated');
});
