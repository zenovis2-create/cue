import { createHash } from 'node:crypto';
import { closeSync, fstatSync, lstatSync, openSync, readSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';

const MAX_FILE=268435456, MAX_TOTAL=1073741824, MAX_ENTRIES=8192;
const DIRS=['app','daemon/src','daemon/dist/src','daemon/migrations','daemon/dist/migrations'];
const FILES=['package.json','package-lock.json','daemon/package.json','daemon/package-lock.json','daemon/native/change-snapshot/manifest.json','daemon/native/change-snapshot/change-snapshot.exe','daemon/dist/native/change-snapshot/manifest.json','daemon/dist/native/change-snapshot/change-snapshot.exe'];
const SELF=fileURLToPath(import.meta.url);
const hash=value=>createHash('sha256').update(value).digest('hex');
const ordered=(a,b)=>a<b?-1:a>b?1:0;
function fail(){throw Error('installation_identity_unavailable_or_drifted');}
function statIdentity(s){return {dev:String(s.dev),ino:String(s.ino),size:s.size,mtimeMs:s.mtimeMs,ctimeMs:s.ctimeMs};}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function plain(input){
  if(!input||typeof input!=='object'||types.isProxy(input)||Object.getPrototypeOf(input)!==Object.prototype)fail();
  const keys=Reflect.ownKeys(input);if(keys.length!==2||!keys.includes('root')||!keys.includes('dependencyRoot'))fail();
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);if(!d.enumerable||!Object.hasOwn(d,'value'))fail();}
}
function rootPath(path){
  if(typeof path!=='string'||path.length>4096||!isAbsolute(path))fail();
  const full=resolve(path),s=lstatSync(full);
  if(!s.isDirectory()||s.isSymbolicLink()||realpathSync(full)!==full)fail();
  return full;
}
function inside(root,path){const r=relative(root,path);return !isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+sep);}
function inspectPath(root,path){
  if(!inside(root,path))fail();
  let cursor=root;
  for(const part of ['',...relative(root,path).split(sep).filter(Boolean)]){
    if(part)cursor=join(cursor,part);
    const s=lstatSync(cursor);if(s.isSymbolicLink()||realpathSync(cursor)!==cursor||(!s.isDirectory()&&cursor!==path))fail();
  }
  return lstatSync(path);
}
function inventory(root,dependencyRoot){
  const entries=[];
  function walk(base,path,label,depth){
    if(depth>32||entries.length>=MAX_ENTRIES)fail();
    const s=inspectPath(base,path);
    if(!s.isDirectory()&&!s.isFile())fail();
    entries.push({label,kind:s.isDirectory()?'directory':'file',...statIdentity(s),path,base});
    if(s.isDirectory())for(const name of readdirSync(path).sort(ordered)){
      if(name==='.'||name==='..'||name.includes(':')||name.includes('/')||name.includes('\\'))fail();
      walk(base,join(path,name),label+'/'+name,depth+1);
    }
  }
  for(const dir of DIRS){const path=join(root,...dir.split('/'));if(!inspectPath(root,path).isDirectory())fail();walk(root,path,'root/'+dir,0);}
  for(const file of FILES){const path=join(root,...file.split('/'));if(!inspectPath(root,path).isFile())fail();walk(root,path,'root/'+file,0);}
  walk(dependencyRoot,join(dependencyRoot,'better-sqlite3'),'dependency/better-sqlite3',0);
  return entries.sort((a,b)=>ordered(a.label,b.label));
}
function fileHash(path,before,budget,base){
  if(!Number.isSafeInteger(before.size)||before.size<0||before.size>MAX_FILE||(budget.bytes+=before.size)>MAX_TOTAL)fail();
  const fd=openSync(path,'r');
  try{
    const opened=fstatSync(fd);if(!opened.isFile()||!same(statIdentity(opened),before))fail();
    const digest=createHash('sha256'),buffer=Buffer.alloc(1048576);let count=0;
    for(;;){const n=readSync(fd,buffer,0,Math.min(buffer.length,MAX_FILE-count+1),null);if(!n)break;count+=n;if(count>before.size)fail();digest.update(buffer.subarray(0,n));}
    const after=fstatSync(fd),current=base?inspectPath(base,path):lstatSync(path);
    if(count!==before.size||!same(statIdentity(after),before)||!current.isFile()||current.isSymbolicLink()||!same(statIdentity(current),before))fail();
    return digest.digest('hex');
  }finally{closeSync(fd);}
}
function boundedPackage(path){
  const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.size<1||s.size>65536)fail();
  const fd=openSync(path,'r');try{
    const bytes=Buffer.alloc(65537);let length=0;for(;;){const n=readSync(fd,bytes,length,bytes.length-length,null);if(!n)break;length+=n;if(length>65536)fail();}
    if(length!==s.size||!same(statIdentity(fstatSync(fd)),statIdentity(s)))fail();
    const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,length)));
    if(value.name!=='better-sqlite3'||value.version!=='13.0.3'||value.main!=='lib/index.js'||!value.dependencies||typeof value.dependencies!=='object'||Array.isArray(value.dependencies)
      ||Object.keys(value.dependencies).some(key=>key!=='node-addon-api')||typeof value.dependencies['node-addon-api']!=='string')fail();
    return {name:value.name,version:value.version,main:value.main};
  }finally{closeSync(fd);}
}
function measure(root,dependencyRoot){
  rootPath(root);rootPath(dependencyRoot);
  const initial=inventory(root,dependencyRoot),budget={bytes:0};
  const files=initial.map(entry=>{
    const {path,base,...record}=entry;
    return {...record,...(entry.kind==='file'?{sha256:fileHash(path,statIdentity(entry),budget,base)}:{})};
  });
  const sqlite=boundedPackage(join(dependencyRoot,'better-sqlite3','package.json'));
  if(!initial.some(e=>e.label==='dependency/better-sqlite3/lib/index.js'&&e.kind==='file')||!initial.some(e=>e.label.startsWith('dependency/better-sqlite3/')&&e.label.endsWith('.node')&&e.kind==='file'))fail();
  const runtimePath=realpathSync(process.execPath),runtimeStat=lstatSync(runtimePath),selfPath=realpathSync(SELF),selfStat=lstatSync(selfPath);
  if(lstatSync(process.execPath).isSymbolicLink()||lstatSync(SELF).isSymbolicLink())fail();
  const runtime={executable:runtimePath,node:process.versions.node,electron:process.versions.electron??null,abi:process.versions.modules,platform:process.platform,arch:process.arch,
    ...statIdentity(runtimeStat),sha256:fileHash(runtimePath,statIdentity(runtimeStat),budget)};
  const helper={path:selfPath,...statIdentity(selfStat),sha256:fileHash(selfPath,statIdentity(selfStat),budget)};
  if(!same(initial,inventory(root,dependencyRoot)))fail();
  return {version:'cue-installation-generation-v1',root,dependencyRoot,sqlite,runtime,helper,files};
}
function frozen(value){if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}

/** Import this builtin-only small TCB before ANY app/daemon/SQLite loader import,
 * then capture; assertCurrent immediately after dynamic imports and before every
 * issuance/dispatch boundary. No module or native addon is loaded by this helper.
 * Host-exclusive roots are required: this does not defeat hostile write-and-revert,
 * modified builtins/OS, or a helper modified before its own trusted import. */
const generations = new WeakSet();
/** Proves this helper issued the object, not that the caller captured it before
 * importing application code. Fresh entry ordering remains a separate gate. */
export function isInstallationGeneration(value) { return generations.has(value); }
export function captureInstallationIdentity(input){
  try{
    plain(input);const root=rootPath(input.root),dependencyRoot=rootPath(input.dependencyRoot),snapshot=frozen(measure(root,dependencyRoot));
    const digest=hash(JSON.stringify(snapshot));
    const generation = Object.freeze({snapshot,digest,assertCurrent(){try{if(hash(JSON.stringify(measure(root,dependencyRoot)))!==digest)fail();return true;}catch{fail();}}});
    generations.add(generation);
    return generation;
  }catch{fail();}
}
