import {createHash} from 'node:crypto';
import {closeSync,fstatSync,lstatSync,mkdirSync,mkdtempSync,openSync,opendirSync,readSync,realpathSync,writeFileSync,type Stats} from 'node:fs';
import {isAbsolute,join,parse,resolve,sep} from 'node:path';
import {types} from 'node:util';
import {freezeEvaluationDataset,type EvaluationDataset,type EvaluationSplit} from './comparison.js';
import {createNativeExistingFileContract} from '../verification/native-existing-file-checker.js';

const issued=new WeakSet<object>();
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
function fail(reason:string):never{throw Error(`evaluation_workload_${reason}`);}
const MAX_BYTES=1048576;
type WorkloadFile=Readonly<{relativePath:string;content:string}>;
export type WorkloadCase=Readonly<{
  id:string;family:string;split:EvaluationSplit;goal:string;inputDigest:string;
  files:readonly WorkloadFile[];contract:ReturnType<typeof createNativeExistingFileContract>;
}>;
export type FrozenEvaluationWorkload=Readonly<{
  version:'cue-evaluation-workload-v1';suiteDigest:string;
  dataset:EvaluationDataset;datasetInput:Readonly<Pick<EvaluationDataset,'id'|'revision'|'cases'>>;
  cases:readonly WorkloadCase[];
}>;
function record(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)fail('record');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(descriptors).length!==keys.length)fail('fields');
  const copy:Record<string,unknown>={};
  for(const key of keys){const d=descriptors[key];if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('fields');copy[key]=d.value;}
  return copy;
}
function array(value:unknown,max:number):unknown[]{
  if(!Array.isArray(value)||types.isProxy(value)||Object.getPrototypeOf(value)!==Array.prototype
    ||value.length<1||value.length>max||Reflect.ownKeys(value).length!==value.length+1)fail('array');
  const result:unknown[]=[];
  for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('array');result.push(d.value);}
  return result;
}
function identity(value:unknown):string{
  if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(value))fail('identity');return value;
}
function text(value:unknown,max:number,budget:{bytes:number}):string{
  if(typeof value!=='string'||value.includes('\0'))fail('text');
  const bytes=Buffer.byteLength(value);budget.bytes+=bytes;
  if(bytes>max||budget.bytes>MAX_BYTES)fail('size');
  if(Buffer.from(value,'utf8').toString('utf8')!==value)fail('text');return value;
}
function relativePath(value:unknown):string{
  if(typeof value!=='string'||value.length>240)fail('path');
  const parts=value.split('/');
  if(parts.length>8||parts.some(part=>!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(part)||part.endsWith('.')
    ||/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/iu.test(part)))fail('path');
  return value;
}

/** Authored exact-artifact workload, not measured trials or semantic quality.
 * IDs/family/split labels cannot disguise identical input/contract content. */
export function freezeEvaluationWorkload(input:unknown):FrozenEvaluationWorkload{
  const top=record(input,['version','id','revision','cases']);
  if(top.version!=='cue-evaluation-workload-v1')fail('version');
  const id=identity(top.id),revision=identity(top.revision),budget={bytes:0},families=new Map<string,EvaluationSplit>();
  const canonical=array(top.cases,64).map(raw=>{
    const c=record(raw,['id','family','split','goal','files']),caseId=identity(c.id),family=identity(c.family);
    if(c.split!=='evaluation'&&c.split!=='holdout')fail('split');
    const prior=families.get(family);if(prior&&prior!==c.split)fail('family_overlap');families.set(family,c.split);
    const goal=text(c.goal,4096,budget);if(!goal.trim())fail('goal');
    const paths:string[]=[];
    const files=array(c.files,16).map(rawFile=>{
      const f=record(rawFile,['relativePath','initial','expected']),path=relativePath(f.relativePath),key=path.toLowerCase();
      if(paths.some(p=>p===key||p.startsWith(key+'/')||key.startsWith(p+'/')))fail('path_overlap');paths.push(key);
      const initial=text(f.initial,65536,budget),expected=text(f.expected,65536,budget);
      if(initial===expected)fail('unchanged_target');
      return Object.freeze({relativePath:path,initial,expected});
    }).sort((a,b)=>compare(a.relativePath,b.relativePath));
    return Object.freeze({id:caseId,family,split:c.split,goal,files:Object.freeze(files)});
  }).sort((a,b)=>compare(a.id,b.id));
  const cases=Object.freeze(canonical.map(c=>{
    const contract=createNativeExistingFileContract(c.files.map((file,index)=>({targetId:`${c.id}-${index+1}`,relativePath:file.relativePath,
      maxBytes:Math.max(1,Buffer.byteLength(file.initial),Buffer.byteLength(file.expected)),expectedSha256:hash(file.expected),
      expectedByteLength:Buffer.byteLength(file.expected),originalSha256:hash(file.initial)})));
    const files=Object.freeze(c.files.map(file=>Object.freeze({relativePath:file.relativePath,content:file.initial})));
    // Native target IDs derive from labels. Exclude those from the input digest
    // while binding every path/byte/hash/limit/checker field that affects work.
    const verification={checkerId:contract.checkerId,checkerRevision:contract.checkerRevision,
      targets:contract.targets.map(({targetId,...target})=>target)};
    const inputDigest=hash(JSON.stringify({version:'cue-workload-input-v1',goal:c.goal,files,verification}));
    return Object.freeze({id:c.id,family:c.family,split:c.split,goal:c.goal,files,contract,inputDigest});
  }));
  const datasetInput=Object.freeze({id,revision,cases:Object.freeze(cases.map(c=>Object.freeze({id:c.id,kind:'code' as const,inputDigest:c.inputDigest,split:c.split})))});
  const dataset=freezeEvaluationDataset(datasetInput);
  const payload=JSON.stringify({version:top.version,id,revision,cases:canonical});if(Buffer.byteLength(payload)>MAX_BYTES)fail('size');
  const result=Object.freeze({version:'cue-evaluation-workload-v1' as const,suiteDigest:hash(payload),dataset,datasetInput,cases});
  issued.add(result);return result;
}

function selected(workload:FrozenEvaluationWorkload,caseId:string,split:EvaluationSplit):WorkloadCase{
  if(!issued.has(workload))fail('unissued');
  if(split!=='evaluation'&&split!=='holdout')fail('split');
  const item=workload.cases.find(c=>c.id===caseId);if(!item||item.split!==split)fail('case_or_split');return item;
}
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
function canonicalDirectory(input:string):string{
  if(typeof input!=='string'||input.includes('\0')||input.length>4096||!isAbsolute(input)||!samePath(resolve(input),input))fail('parent');
  let cursor=parse(input).root;
  for(const part of ['',...input.slice(cursor.length).split(sep).filter(Boolean)]){
    if(part)cursor=join(cursor,part);const stat=lstatSync(cursor);
    if(!stat.isDirectory()||stat.isSymbolicLink()||!samePath(realpathSync.native(cursor),cursor))fail('parent');
  }
  return input;
}
const sameStat=(a:Stats,b:Stats)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs&&a.nlink===b.nlink;

/** Read-only, pre-Git seed snapshot. Does not prove executed inputs or qualify a
 * run. The host must exclusively own the root during this non-atomic check. */
export function verifyEvaluationWorkloadCase(workload:FrozenEvaluationWorkload,input:unknown){
  const f=record(input,['caseId','split','worktreePath','goal']);
  const item=selected(workload,identity(f.caseId),f.split as EvaluationSplit);
  if(f.goal!==item.goal)fail('goal_mismatch');
  const root=canonicalDirectory(f.worktreePath as string),observed=new Map<string,Stats>();
  const expected=new Map(item.files.map(file=>[file.relativePath,file.content]));let entries=0;
  function visit(directory:string,prefix:string){
    canonicalDirectory(directory);observed.set(directory,lstatSync(directory));
    const handle=opendirSync(directory);
    try{for(let entry=handle.readSync();entry;entry=handle.readSync()){
      if(++entries>256)fail('tree_limit');
      const path=join(directory,entry.name),relative=prefix+entry.name,before=lstatSync(path);
      if(before.isSymbolicLink())fail('unsafe_file');
      if(before.isDirectory()){
        if(![...expected.keys()].some(key=>key.startsWith(relative+'/')))fail('unexpected_path');
        visit(path,relative+'/');continue;
      }
      const content=expected.get(relative);
      if(content===undefined)fail('unexpected_path');
      if(!before.isFile()||before.nlink!==1||before.size>65536)fail('unsafe_file');
      const fd=openSync(path,'r');
      try{
        const opened=fstatSync(fd);if(!opened.isFile()||!sameStat(before,opened))fail('file_changed');
        const bytes=Buffer.alloc(Buffer.byteLength(content)+1);let length=0;
        while(length<bytes.length){const count=readSync(fd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;}
        if(!bytes.subarray(0,length).equals(Buffer.from(content)))fail('seed_mismatch');
        if(!sameStat(before,fstatSync(fd))||!sameStat(before,lstatSync(path)))fail('file_changed');
      }finally{closeSync(fd);}
      observed.set(path,before);expected.delete(relative);
    }}finally{handle.closeSync();}
  }
  visit(root,'');
  if(expected.size)fail('missing_file');
  for(const [path,stat]of observed)if(!sameStat(stat,lstatSync(path)))fail('file_changed');
  canonicalDirectory(root);
  return Object.freeze({version:'cue-evaluation-input-check-v1' as const,authority:'point-in-time-seed-check-only' as const,
    suiteDigest:workload.suiteDigest,datasetDigest:workload.dataset.digest,caseId:item.id,split:item.split,
    inputDigest:item.inputDigest,fileCount:item.files.length,goalMatches:true,seedBytesMatch:true,
    executionAuthorized:false,executedInputVerified:false,baselineConfigured:false});
}

export class WorkloadPreparationError extends Error{
  readonly retainedWorktreePath:string;
  constructor(path:string){super('evaluation_workload_preparation_incomplete');this.retainedWorktreePath=path;}
}

/** Materialize only seeds in a new directory under an explicit existing parent.
 * Parent must be host-owned. No agent, Git, credential, approval or trial I/O.
 * If preparation fails, report the incomplete owned path; never broadly delete. */
export function prepareEvaluationWorkloadCase(workload:FrozenEvaluationWorkload,input:unknown){
  const f=record(input,['caseId','split','parent']);
  const item=selected(workload,identity(f.caseId),f.split as EvaluationSplit);
  const parent=canonicalDirectory(f.parent as string);
  const worktreePath=mkdtempSync(join(parent,'cue-eval-'));
  try{
    canonicalDirectory(worktreePath);
    for(const file of item.files){
      let directory=worktreePath;
      for(const part of file.relativePath.split('/').slice(0,-1)){
        directory=join(directory,part);mkdirSync(directory,{recursive:true});canonicalDirectory(directory);
      }
      writeFileSync(join(worktreePath,...file.relativePath.split('/')),file.content,{encoding:'utf8',flag:'wx'});
    }
    return Object.freeze({version:'cue-evaluation-preparation-v1' as const,authority:'input-materialization-only' as const,
      suiteDigest:workload.suiteDigest,dataset:workload.datasetInput,datasetDigest:workload.dataset.digest,
      caseId:item.id,split:item.split,inputDigest:item.inputDigest,goal:item.goal,worktreePath,
      expectedArtifacts:item.contract.targets,checkerId:item.contract.checkerId,checkerRevision:item.contract.checkerRevision,
      parametersDigest:item.contract.parametersDigest,executionAuthorized:false as const,baselineConfigured:false as const});
  }catch{throw new WorkloadPreparationError(worktreePath);}
}
