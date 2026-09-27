import {mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,expect,test,vi} from 'vitest';
const io=vi.hoisted(()=>({remainingWrites:Infinity}));
vi.mock('node:fs',async original=>{
  const fs=await original<typeof import('node:fs')>();
  return {...fs,writeFileSync:(...args:Parameters<typeof fs.writeFileSync>)=>{
    if(String(args[0]).includes('cue-eval-')&&--io.remainingWrites<0)throw Error('injected disk failure');
    return fs.writeFileSync(...args);
  }};
});
import {prepareEvaluationWorkloadCase,WorkloadPreparationError} from '../src/evaluation/workload.js';
import {readExistingFileWorkload} from '../src/evaluation/workload-release.js';
const roots:string[]=[];
const parent=()=>{const root=realpathSync.native(mkdtempSync(join(tmpdir(),'cue-workload-test-')));roots.push(root);return root;};
afterEach(()=>{io.remainingWrites=Infinity;for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const walk=(root:string):string[]=>(readdirSync(root,{recursive:true,withFileTypes:true}) as any[]).filter(entry=>entry.isFile()).map(entry=>join(entry.parentPath,entry.name));

test('prepares unique seed-only folders without overwriting an existing parent sentinel',()=>{
  const root=parent(),sentinel=join(root,'keep.txt');writeFileSync(sentinel,'user-owned');
  const suite=readExistingFileWorkload();
  for(const item of suite.cases){
    const output=prepareEvaluationWorkloadCase(suite,{caseId:item.id,split:item.split,parent:root});
    expect(output).toMatchObject({authority:'input-materialization-only',executionAuthorized:false,baselineConfigured:false,inputDigest:item.inputDigest});
    expect(walk(output.worktreePath).sort()).toEqual(item.files.map(file=>join(output.worktreePath,...file.relativePath.split('/'))).sort());
    for(const file of item.files)expect(readFileSync(join(output.worktreePath,...file.relativePath.split('/')),'utf8')).toBe(file.content);
    expect(JSON.stringify(output)).not.toContain('"expected":');
    expect(output.dataset.cases).toHaveLength(8);
  }
  const input={caseId:suite.cases[0].id,split:suite.cases[0].split,parent:root};
  const first=prepareEvaluationWorkloadCase(suite,input),second=prepareEvaluationWorkloadCase(suite,input);
  expect(first.worktreePath).not.toBe(second.worktreePath);
  expect(first.inputDigest).toBe(second.inputDigest);
  expect(readFileSync(sentinel,'utf8')).toBe('user-owned');
});
test('unknown case, omitted/wrong split, unissued workload and relative parent create nothing',()=>{
  const root=parent(),suite=readExistingFileWorkload(),item=suite.cases[0],input={caseId:item.id,split:item.split,parent:root};
  for(const value of [{...input,caseId:'missing'},{caseId:item.id,parent:root},{...input,split:'holdout'},{...input,parent:'relative'},{...input,approve:true}])
    expect(()=>prepareEvaluationWorkloadCase(suite,value)).toThrow('evaluation_workload');
  expect(()=>prepareEvaluationWorkloadCase({...suite},input)).toThrow('unissued');
  expect(readdirSync(root)).toEqual([]);
});
test('a reparse-point parent is refused without touching its target',()=>{
  const root=parent(),target=parent(),link=join(root,'linked');symlinkSync(target,link,'junction');
  const suite=readExistingFileWorkload();expect(()=>prepareEvaluationWorkloadCase(suite,{caseId:suite.cases[0].id,split:'evaluation',parent:link})).toThrow('parent');
  expect(readdirSync(target)).toEqual([]);
});
test('write failure reports the partial owned root and never deletes unrelated files',()=>{
  const root=parent(),sentinel=join(root,'keep.txt');writeFileSync(sentinel,'user-owned');
  io.remainingWrites=1;let caught:unknown;
  try{prepareEvaluationWorkloadCase(readExistingFileWorkload(),{caseId:'eval-nullish-defaults',split:'evaluation',parent:root});}catch(error){caught=error;}
  expect(caught).toBeInstanceOf(WorkloadPreparationError);
  const retained=(caught as WorkloadPreparationError).retainedWorktreePath;
  expect(retained.startsWith(root)).toBe(true);expect(walk(retained)).toHaveLength(1);
  expect(readFileSync(sentinel,'utf8')).toBe('user-owned');
  expect(readdirSync(root)).toContain('keep.txt');
});
