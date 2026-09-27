import {afterEach,expect,test,vi} from 'vitest';
import {mkdtempSync,realpathSync,rmSync,writeFileSync,readFileSync,mkdirSync,linkSync,symlinkSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const mutation=vi.hoisted(()=>({afterRead:null as null|(()=>void)}));
vi.mock('node:fs',async original=>{const fs=await original<typeof import('node:fs')>();return{...fs,readSync:(...args:Parameters<typeof fs.readSync>)=>{const n=fs.readSync(...args);const callback=mutation.afterRead;mutation.afterRead=null;callback?.();return n;}};});
import {readExistingFileWorkload} from '../src/evaluation/workload-release.js';
import {prepareEvaluationWorkloadCase,verifyEvaluationWorkloadCase} from '../src/evaluation/workload.js';
const roots:string[]=[];
afterEach(()=>{mutation.afterRead=null;for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture(caseId='eval-empty-sum'){
  const root=realpathSync.native(mkdtempSync(join(tmpdir(),'cue-workload-verify-')));roots.push(root);const workload=readExistingFileWorkload(),item=workload.cases.find(x=>x.id===caseId)!;
  const prepared=prepareEvaluationWorkloadCase(workload,{caseId,split:item.split,parent:root});
  const input={caseId,split:item.split,worktreePath:prepared.worktreePath,goal:item.goal};return{root,workload,item,input};
}
test('all eight prepared cases verify exact goal, complete seed tree and pinned digest without execution authority',()=>{
  for(const item of readExistingFileWorkload().cases){const f=fixture(item.id),before=item.files.map(file=>readFileSync(join(f.input.worktreePath,file.relativePath)));
    const checked=verifyEvaluationWorkloadCase(f.workload,f.input);expect(checked).toMatchObject({inputDigest:item.inputDigest,fileCount:item.files.length,goalMatches:true,seedBytesMatch:true,executedInputVerified:false,executionAuthorized:false,baselineConfigured:false});
    expect(Object.isFrozen(checked)).toBe(true);item.files.forEach((file,i)=>expect(readFileSync(join(f.input.worktreePath,file.relativePath))).toEqual(before[i]));
  }
});
test.each(['changed','missing','extra-file','extra-directory','hardlink','oversized'])('refuses %s and never rewrites or cleans the workspace',kind=>{
  const f=fixture(),path=join(f.input.worktreePath,f.item.files[0].relativePath);
  if(kind==='changed')writeFileSync(path,'different');if(kind==='missing')rmSync(path);
  if(kind==='extra-file')writeFileSync(join(f.input.worktreePath,'AGENTS.md'),'unapproved context');
  if(kind==='extra-directory')mkdirSync(join(f.input.worktreePath,'.git'));
  if(kind==='hardlink')linkSync(path,join(f.root,'alias'));if(kind==='oversized')writeFileSync(path,Buffer.alloc(65537));
  expect(()=>verifyEvaluationWorkloadCase(f.workload,f.input)).toThrow();
  if(kind==='changed')expect(readFileSync(path,'utf8')).toBe('different');if(kind==='extra-file')expect(readFileSync(join(f.input.worktreePath,'AGENTS.md'),'utf8')).toBe('unapproved context');
});
test('refuses junction roots and descendant directories without reading through them',()=>{
  const f=fixture(),link=join(f.root,'linked');symlinkSync(f.input.worktreePath,link,'junction');
  expect(()=>verifyEvaluationWorkloadCase(f.workload,{...f.input,worktreePath:link})).toThrow('parent');
  const src=join(f.input.worktreePath,'src'),saved=join(f.root,'saved');renameSync(src,saved);symlinkSync(saved,src,'junction');expect(()=>verifyEvaluationWorkloadCase(f.workload,f.input)).toThrow('unsafe_file');
});
test('strict request and goal/case/split mismatches refuse without getter execution',()=>{
  const f=fixture();let touched=0;const getter=Object.defineProperty({...f.input},'goal',{enumerable:true,get(){touched++;return f.input.goal;}});
  for(const input of [{...f.input,goal:f.input.goal+' '},{...f.input,split:'holdout'},{...f.input,caseId:'missing'},{...f.input,worktreePath:'relative'},{...f.input,approved:true},getter,new Proxy(f.input,{get(){touched++;throw Error('trap')}})])expect(()=>verifyEvaluationWorkloadCase(f.workload,input)).toThrow('evaluation_workload');
  expect(()=>verifyEvaluationWorkloadCase({...f.workload},f.input)).toThrow('unissued');expect(touched).toBe(0);
});
test('replacement after a bounded read invalidates the observation',()=>{
  const f=fixture(),path=join(f.input.worktreePath,f.item.files[0].relativePath);
  mutation.afterRead=()=>{writeFileSync(path,'changed-during-read');};expect(()=>verifyEvaluationWorkloadCase(f.workload,f.input)).toThrow();
  expect(readFileSync(path,'utf8')).toBe('changed-during-read');
});
test('compiled CLI verify succeeds on seeds and fails nonzero on drift or missing explicit goal',()=>{
  const f=fixture(),cli=resolve('scripts/evaluation-workload.mjs');const args=['verify','--case',f.input.caseId,'--split',f.input.split,'--worktree',f.input.worktreePath,'--goal',f.input.goal];
  const run=(argv:string[])=>spawnSync(process.execPath,[cli,...argv],{encoding:'utf8',timeout:15000,windowsHide:true});
  const good=run(args);expect(good.status,good.stderr).toBe(0);expect(JSON.parse(good.stdout)).toMatchObject({inputDigest:f.item.inputDigest,executedInputVerified:false});
  expect(run(args.slice(0,-2)).status).toBe(1);writeFileSync(join(f.input.worktreePath,f.item.files[0].relativePath),'drift');const bad=run(args);
  expect(bad.status).toBe(1);expect(bad.stdout).toBe('');expect(JSON.parse(bad.stderr)).toEqual({error:'evaluation_workload_seed_mismatch'});
});
