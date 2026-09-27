import {execFileSync,spawnSync} from 'node:child_process';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {afterEach,expect,test} from 'vitest';
import {readExistingFileWorkload} from '../src/evaluation/workload-release.js';
const daemon=fileURLToPath(new URL('..',import.meta.url)),cli=join(daemon,'scripts/evaluation-workload.mjs');
const roots:string[]=[];
function parent(){const path=realpathSync.native(mkdtempSync(join(tmpdir(),'cue-workload-cli-')));roots.push(path);return path;}
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
function run(args:string[]){return JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:15000,windowsHide:true}));}

test('packaged CLI lists source-identical frozen metadata without claiming measurement or baseline',()=>{
  const suite=readExistingFileWorkload(),output=run(['list']);
  expect(output).toMatchObject({suiteDigest:suite.suiteDigest,datasetDigest:suite.dataset.digest,baselineConfigured:false,executionAuthorized:false,measurements:'not-collected'});
  expect(output.cases).toHaveLength(8);expect(JSON.stringify(output)).not.toContain('return total');
});
test('CLI prepares selected split inputs and refuses omitted/mismatched split before creating anything',()=>{
  const root=parent();
  for(const args of [[],['prepare','--case','eval-empty-sum','--parent',root],['prepare','--case','eval-empty-sum','--split','holdout','--parent',root]]){
    const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:15000,windowsHide:true});
    expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(JSON.parse(result.stderr).error).toMatch(/^evaluation_workload_/);
    expect(readdirSync(root)).toEqual([]);
  }
  const output=run(['prepare','--case','eval-empty-sum','--split','evaluation','--parent',root]);
  expect(readFileSync(join(output.worktreePath,'src/sum.mjs'),'utf8')).toBe('export const sum = values => values.reduce((a, b) => a + b);\n');
  expect(output.executionAuthorized).toBe(false);expect(output.expectedArtifacts).toHaveLength(1);
});
test('isolated compiled release loads exact bytes and refuses even whitespace-only release drift',()=>{
  const root=parent();writeFileSync(join(root,'package.json'),'{"type":"module"}');
  for(const name of ['src/evaluation/workload.js','src/evaluation/workload-release.js','src/evaluation/comparison.js','src/verification/native-existing-file-checker.js','evaluation/existing-files-v1.json']){
    const target=join(root,...name.split('/'));mkdirSync(dirname(target),{recursive:true});copyFileSync(join(daemon,'dist',...name.split('/')),target);
  }
  const moduleUrl=pathToFileURL(join(root,'src/evaluation/workload-release.js')).href;
  const script=`const {readExistingFileWorkload}=await import(${JSON.stringify(moduleUrl)});process.stdout.write(readExistingFileWorkload().dataset.digest);`;
  expect(execFileSync(process.execPath,['--input-type=module','--eval',script],{encoding:'utf8',timeout:15000,windowsHide:true})).toBe(readExistingFileWorkload().dataset.digest);
  const release=join(root,'evaluation/existing-files-v1.json');writeFileSync(release,readFileSync(release,'utf8')+'\n');
  const rejected=spawnSync(process.execPath,['--input-type=module','--eval',script],{encoding:'utf8',timeout:15000,windowsHide:true});
  expect(rejected.status).not.toBe(0);expect(rejected.stdout).toBe('');expect(rejected.stderr).toContain('evaluation_workload_release');
});
