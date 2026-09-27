import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, realpathSync, readFileSync } from 'node:fs';
import { arch, release, version } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { types } from 'node:util';
import { measureArtifactSet, type MeasurementArtifact } from './measurement-artifacts.js';
import { subjectDigest, type MeasurementSubject } from './measurement-subject.js';
import { runProcessSync } from './process-launch.js';

export const MODEL_SUBJECT_MANIFEST_VERSION = 'cue-model-subject-files-v2';
const PROBE_SOURCES = ['model-boundary-probe.cjs','model-qualification.ts'];
const SOURCE_REQUIRED = ['adapters/isolated-local-model.ts','adapters/isolated-json-checker.ts','adapters/isolated-model-cleanup.ts','adapters/local-model.ts','adapters/native-identity-commit.ts','native-execution-identity-store.ts',
 'process-launch.ts','integration-runtime.ts','capability-admission.ts','model-control-bundle.ts','selection/local-host-settings.ts','measurement-subject.ts','measurement-artifacts.ts',
 'model-only-launch.ps1','model-only-profile-cleanup.ps1','model-only-client.cjs','json-checker-client.cjs','verification/json-format-checker.cjs',
 'goal-proposal-checker-client.cjs','verification/goal-proposal-checker.cjs','adapters/isolated-goal-proposal-checker.ts','verification/goal-proposal-acceptance-host.ts','ledger.ts',...PROBE_SOURCES];
const PROBES_COMMON = ['integration-model-boundary-qualification.test.ts','integration-model-boundary-observation.test.ts','integration-model-boundary-process-limit.test.ts',
 'integration-model-boundary-hardkill.test.ts','integration-model-control-bundle.test.ts','integration-isolated-model-cleanup.test.ts',
 'integration-fixed-model-qualification.test.ts','integration-model-qualification.test.ts','integration-native-identity-commit.test.ts','integration-native-execution-identity-store.test.ts'];
const PROBES_KIND = {model:['integration-isolated-local-model.test.ts'], 'json-checker':['integration-isolated-json-checker.test.ts','integration-json-format-checker.test.ts'], 'goal-proposal-checker':['integration-goal-proposal-checker-client.test.ts']};
const POLICIES = ['docs/P13_SPEC.md','daemon/src/capability-admission.ts','daemon/src/integration-runtime.ts','daemon/src/model-control-bundle.ts'];
export const MODEL_SUBJECT_REQUIRED_PATHS = Object.freeze([...SOURCE_REQUIRED.map(p=>'daemon/src/'+p),...POLICIES,
 ...PROBES_COMMON.map(p=>'daemon/test/'+p),...Object.values(PROBES_KIND).flat().map(p=>'daemon/test/'+p),
 'app/core.mjs','app/orchestration-driver.mjs','app/protected-installation.mjs','app/default-goal-planning-bootstrap.mjs',
 'app/goal-proposal.mjs','app/goal-planning-contract.mjs','app/goal-planning-handoff-authority.mjs','app/goal-planning-host.mjs','app/accepted-goal-planning-output.mjs',
 'app/main.mjs','app/preload.cjs','package.json','package-lock.json','daemon/package.json','daemon/package-lock.json']);
export interface ModelMeasurementInput {
 readonly installRoot: string; readonly kind: 'model'|'json-checker'|'goal-proposal-checker'; readonly nodeExecutable: string;
 readonly powershellExecutable: string; readonly sqliteNativePath: string; readonly dependencyRoot: string;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const slash = (p: string) => p.split(sep).join('/');
function same(a:string,b:string) { return process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b; }
function regular(path:string,directory=false) {
 const lexical=resolve(path), actual=realpathSync(lexical), stat=lstatSync(lexical);
 if(stat.isSymbolicLink() || !same(actual,lexical) || (directory?!stat.isDirectory():!stat.isFile())) throw Error('subject_path_reparse_or_type');
 return lexical;
}
function inside(root:string,path:string) { const rel=relative(root,path); if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep)) throw Error('subject_path_outside'); }
function copyInput(input:ModelMeasurementInput) {
 if(!input||typeof input!=='object'||types.isProxy(input)||Object.getPrototypeOf(input)!==Object.prototype) throw Error('subject_input_invalid');
 const keys=['installRoot','kind','nodeExecutable','powershellExecutable','sqliteNativePath','dependencyRoot'];const descriptors=Object.getOwnPropertyDescriptors(input);
 if(Reflect.ownKeys(descriptors).length!==keys.length||keys.some(k=>!descriptors[k]?.enumerable||!Object.hasOwn(descriptors[k],'value')||typeof descriptors[k].value!=='string'||!descriptors[k].value.trim()||descriptors[k].value.includes('\0'))) throw Error('subject_input_invalid');
 const result=Object.fromEntries(keys.map(k=>[k,descriptors[k]!.value])) as unknown as ModelMeasurementInput;
 if(!['model','json-checker','goal-proposal-checker'].includes(result.kind)) throw Error('subject_kind');return result;
}
/** Fixed installed file closure, not an eligibility issuer. Windows/.NET/system
 * DLLs and a remote/full-privilege model provider remain explicit external TCB.
 * Source/tests are fingerprints only: checker M1-M3 semantics require independent
 * actual measurements. Caller cannot substitute a convenient subset of files. */
export function createModelMeasurementSubject(input:ModelMeasurementInput) {
 const source=copyInput(input), root=regular(source.installRoot,true), deps=regular(source.dependencyRoot,true);
 const files=new Map<string,string>();let total=0;
 const directorySnapshots=new Map<string,string>();
 const directoryState=(path:string)=>JSON.stringify(readdirSync(path,{withFileTypes:true}).map(e=>[e.name,e.isDirectory(),e.isFile(),e.isSymbolicLink()]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
 function add(id:string,path:string) {
  if(files.has(id)) {if(files.get(id)!==path)throw Error('subject_duplicate_id');return;}
  regular(path);const size=lstatSync(path).size;
  if(size>256*1024*1024||files.size>=4096||(total+=size)>1024*1024*1024)throw Error('subject_inventory_limit');files.set(id,path);
 }
 function tree(base:string,id:string,extensions:Set<string>) {
  regular(base,true);const pending=[base];let nodes=0;
  while(pending.length){const directory=pending.pop()!;directorySnapshots.set(directory,directoryState(directory));for(const entry of readdirSync(directory,{withFileTypes:true})){
   if(++nodes>8192)throw Error('subject_inventory_limit');const path=join(directory,entry.name);inside(base,path);
   if(entry.isSymbolicLink())throw Error('subject_path_reparse_or_type');
   if(entry.isDirectory()){regular(path,true);pending.push(path);}else if(entry.isFile()&&extensions.has(extname(entry.name).toLowerCase()))add(id+'/'+slash(relative(base,path)),path);
   else if(!entry.isFile())throw Error('subject_path_reparse_or_type');
  }}
 }
 const code=new Set(['.ts','.cts','.mts','.js','.cjs','.mjs','.ps1','.json']);
 tree(join(root,'daemon','src'),'source',code);
 tree(join(root,'daemon','dist','src'),'compiled',new Set(['.js','.cjs','.mjs','.ps1','.json']));
 tree(join(root,'daemon','migrations'),'source-migrations',new Set(['.sql']));
 tree(join(root,'daemon','dist','migrations'),'compiled-migrations',new Set(['.sql']));
 tree(join(root,'app'),'app',new Set(['.js','.cjs','.mjs','.json','.html','.css']));
 for(const path of MODEL_SUBJECT_REQUIRED_PATHS) {regular(join(root,path));}
 for(const p of ['package.json','package-lock.json','daemon/package.json','daemon/package-lock.json']) add('package/'+p,join(root,p));
 for(const p of POLICIES)add('policy/'+p,join(root,p));
 for(const p of PROBE_SOURCES)add('probe-source/'+p,join(root,'daemon','src',p));
 for(const p of [...PROBES_COMMON,...PROBES_KIND[source.kind]])add('probe/'+p,join(root,'daemon','test',p));
 // Every source executable/migration must have a measured packaged counterpart.
 for(const [id,path] of [...files]) {
  if(id.startsWith('source/')&&!/\.d\.(?:ts|cts|mts)$/.test(path)) {
   const rel=id.slice(7), ext=extname(rel);const output=ext==='.ts'?rel.slice(0,-3)+'.js':ext==='.cts'?rel.slice(0,-4)+'.cjs':ext==='.mts'?rel.slice(0,-4)+'.mjs':rel;
   if(!files.has('compiled/'+output))throw Error('subject_compiled_missing:'+output);
  }
  if(id.startsWith('source-migrations/')&&!files.has('compiled-migrations/'+id.slice(18)))throw Error('subject_migration_missing');
 }
 if(!files.has('source-migrations/001_init.sql')||!files.has('compiled-migrations/001_init.sql'))throw Error('subject_migration_missing');
 // Actual supported loader closure: better-sqlite3 13.0.3 ships its own loader,
 // node-addon-api is a build-header dependency; the shipped .node and loader
 // bytes are measured. This does not attest the native build toolchain.
 const packageRoot=join(deps,'better-sqlite3'), packageJson=join(packageRoot,'package.json');
 inside(deps,packageRoot);regular(packageJson);
 if(lstatSync(packageJson).size>65536)throw Error('subject_dependency_manifest_limit');
 const pkg=JSON.parse(readFileSync(packageJson,'utf8'));
 if(pkg.name!=='better-sqlite3'||pkg.version!=='13.0.3'
   || (pkg.dependencies!==undefined && (pkg.dependencies===null||typeof pkg.dependencies!=='object'||Object.keys(pkg.dependencies).some(key=>key!=='node-addon-api')||(pkg.dependencies['node-addon-api']!==undefined&&pkg.dependencies['node-addon-api']!=='^8.0.0')))
   || ['optionalDependencies','peerDependencies'].some(key=>pkg[key]!==undefined&&(pkg[key]===null||typeof pkg[key]!=='object'||Object.keys(pkg[key]).length!==0)))throw Error('subject_dependency_closure_unsupported');
 regular(join(packageRoot,'lib','index.js'));
 tree(packageRoot,'dependency/better-sqlite3',new Set(['.js','.cjs','.mjs','.json','.node']));

 const sqlite=regular(source.sqliteNativePath);inside(join(deps,'better-sqlite3'),sqlite);
 if(extname(sqlite)!=='.node'||![...files.values()].some(p=>same(p,sqlite)))throw Error('subject_sqlite_native_missing');
 const node=regular(source.nodeExecutable),hostRuntime=regular(process.execPath),powershell=regular(source.powershellExecutable);
 const expectedPs=resolve(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 if(process.platform!=='win32'||!same(powershell,expectedPs))throw Error('subject_host_powershell_invalid');
 add('binary/isolated-node',node);add('binary/host-runtime',hostRuntime);add('binary/host-powershell',powershell);add('binary/sqlite-native',sqlite);
 const os=runProcessSync(powershell,['-NoLogo','-NoProfile','-NonInteractive','-Command',"$v=Get-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'; [Console]::Write(($v.CurrentBuildNumber.ToString())+'.'+($v.UBR.ToString()))"],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:4096});
 if(os.status!==0||os.stderr||!/^\d{4,6}\.\d{1,8}$/.test(os.stdout))throw Error('subject_os_revision_unknown');
 const entries=[...files].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,path])=>({id,path}));
 const fileState=(path:string)=>{const s=lstatSync(path);return JSON.stringify([s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs,s.isSymbolicLink()]);};
 const fileSnapshots=new Map(entries.map(e=>[e.path,fileState(e.path)]));
 const artifacts:{id:string;sha256:string}[]=[];
 for(let i=0;i<entries.length;i+=128)artifacts.push(...measureArtifactSet(entries.slice(i,i+128)).artifacts);
 for(const [path,state] of fileSnapshots)if(fileState(path)!==state)throw Error('subject_inventory_changed');
 for(const [directory,state] of directorySnapshots)if(directoryState(directory)!==state)throw Error('subject_inventory_changed');
 const group=(predicate:(id:string)=>boolean)=>hash({version:MODEL_SUBJECT_MANIFEST_VERSION,kind:source.kind,artifacts:artifacts.filter(a=>predicate(a.id))});
 const subject:MeasurementSubject=Object.freeze({toolBinarySha256:artifacts.find(a=>a.id==='binary/isolated-node')!.sha256,
  adapterSha256:group(id=>id.startsWith('source/')),enforcementSha256:group(id=>id.startsWith('source/')&&(id.endsWith('.ps1')||id.includes('process-launch')||id.includes('control-bundle')||PROBE_SOURCES.some(p=>id==='source/'+p))),
  boundaryProviderId:'windows-appcontainer-client/'+source.kind,boundaryPolicySha256:group(id=>id.startsWith('policy/')),boundaryContractVersion:MODEL_SUBJECT_MANIFEST_VERSION+'/'+source.kind,
  probeSuiteSha256:group(id=>id.startsWith('probe/')||id.startsWith('probe-source/')),runtimeArtifactSha256:group(id=>!id.startsWith('probe/')),
  osBuild:JSON.stringify({platform:process.platform,release:release(),version:version(),buildRevision:os.stdout,arch:arch()})});
 return Object.freeze({subject,subjectDigest:subjectDigest(subject),manifest:Object.freeze({version:MODEL_SUBJECT_MANIFEST_VERSION,kind:source.kind,artifacts:Object.freeze(artifacts.map(v=>Object.freeze(v)))}),
  limitations:Object.freeze(['no-eligibility-issued','installed-control-root-trust-required','windows-dotnet-system-dlls-external-tcb','native-build-toolchain-not-runtime-pinned','provider-outside-client-boundary','probe-fingerprint-not-full-checker-M-qualification'])});
}
