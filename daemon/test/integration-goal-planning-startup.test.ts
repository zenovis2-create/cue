import {beforeEach,expect,test,vi} from 'vitest';
import {resolve} from 'node:path';
const m=vi.hoisted(()=>({settings:vi.fn(),process:vi.fn(),bootstrap:vi.fn(),catalog:vi.fn(),fetch:vi.fn(),cache:{} as Record<string,unknown>}));
vi.mock('node:fs',()=>({lstatSync:()=>({isSymbolicLink:()=>false,isDirectory:()=>true,isFile:()=>true}),realpathSync:(p:string)=>p}));
vi.mock('node:module',()=>({createRequire:()=>({resolve:()=>resolve('node_modules/better-sqlite3/package.json'),cache:m.cache})}));
vi.mock('../../app/installation-identity.mjs',()=>({isInstallationGeneration:(g:any)=>g?.fixture===true}));
vi.mock('../../daemon/dist/src/process-launch.js',()=>({runProcessSync:m.process}));
vi.mock('../../daemon/dist/src/selection/local-host-settings.js',()=>({readLatestLocalHostSettings:m.settings}));
vi.mock('../../app/default-goal-planning-bootstrap.mjs',()=>({DEFAULT_GOAL_PLANNING_SETTINGS_ID:'goal-planning-default',createDefaultGoalPlanningBootstrap:m.bootstrap}));
vi.mock('../../app/native-existing-file-authorities.mjs',()=>({readNativeProposalExecutionCatalog:m.catalog}));
import {createStartupGoalPlanningFactory} from '../../app/protected-installation.mjs';
const root=resolve('..'),native=resolve('node_modules/better-sqlite3/build/Release/better_sqlite3.node');
function fixture(){const db={},worktree=resolve('fixture-worktree');return {guard:{fixture:true,assertCurrent:vi.fn(),snapshot:{root,dependencyRoot:resolve('node_modules'),files:[{label:'dependency/better-sqlite3/build/Release/better_sqlite3.node',sha256:'a'.repeat(64)}]}},daemon:{db,status:'ready'},config:{worktreeRoot:worktree},nativeConfiguration:JSON.stringify({fixture:'native'}),executionFactory:vi.fn(()=>({executionStagingSupport:'git-worktree-v1',supportsGoalProposals:true})),worktree} as any;}
beforeEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();for(const key of ['settings','process','bootstrap','catalog','fetch'] as const)m[key].mockReset();
  m.process.mockReturnValue({status:0,stdout:JSON.stringify({programFiles:'C:\\Program Files',localAppData:'C:\\Users\\Fixture\\AppData\\Local',temp:'C:\\Users\\Fixture\\Temp'})});
  m.fetch.mockResolvedValue(new Response(JSON.stringify({data:[{id:'qwen38-27b-unc'}]})));
  m.catalog.mockReturnValue({executionPolicies:{},approvedExecution:{}});
  m.bootstrap.mockImplementation(authority=>(context:any)=>({authority,context}));
  for(const key of Object.keys(m.cache))delete m.cache[key];m.cache[native]={};vi.stubGlobal('fetch',m.fetch);
});
test.each([undefined,{settings:{version:'cue-local-host-settings-v2',templateId:'goal-planning-v1',enabled:false}},
  {settings:{version:'cue-local-host-settings-v2',templateId:'generated-json-v1',enabled:true}}])('missing/disabled/wrong-template planning setup makes no model metadata request or native probe',async saved=>{
  m.settings.mockReturnValue(saved);const f=fixture(),factory=await createStartupGoalPlanningFactory(f);
  expect(factory({db:f.daemon.db,config:f.config,worktree:f.worktree})).toMatchObject({available:false});
  expect(f.executionFactory).not.toHaveBeenCalled();expect(m.catalog).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();expect(m.process).not.toHaveBeenCalled();
});
test('enabled setup refuses unready native execution before local model health',async()=>{
  m.settings.mockReturnValue({settings:{version:'cue-local-host-settings-v2',templateId:'goal-planning-v1',enabled:true}});
  const f=fixture();f.executionFactory.mockReturnValue({available:false,reasons:['unqualified']});
  const factory=await createStartupGoalPlanningFactory(f);
  expect(factory({db:f.daemon.db,config:f.config,worktree:f.worktree})).toMatchObject({available:false});
  expect(m.catalog).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();
});
test('guarded same-ledger ready native contract precedes fixed model health and is rechecked at capture',async()=>{
  m.settings.mockReturnValue({settings:{version:'cue-local-host-settings-v2',templateId:'goal-planning-v1',enabled:true}});
  const f=fixture(),factory=await createStartupGoalPlanningFactory(f),value=factory({db:f.daemon.db,config:f.config,worktree:f.worktree}) as any;
  expect(m.catalog).toHaveBeenCalledWith({db:f.daemon.db,configuration:{fixture:'native'}});
  expect(m.fetch).toHaveBeenCalledExactlyOnceWith('http://127.0.0.1:8085/v1/models',expect.objectContaining({method:'GET',redirect:'error'}));
  expect(value.authority.readExecutionContract({db:f.daemon.db,config:f.config,worktree:f.worktree})).toEqual({executionPolicies:{},approvedExecution:{}});
  expect(value.authority.readExecutionContract.bind(null,{db:{},worktree:f.worktree})).toThrow('ledger-or-worktree');
  m.catalog.mockReturnValue({executionPolicies:{changed:true},approvedExecution:{}});
  expect(value.authority.readExecutionContract.bind(null,{db:f.daemon.db,config:f.config,worktree:f.worktree})).toThrow('contract-drift');
});
