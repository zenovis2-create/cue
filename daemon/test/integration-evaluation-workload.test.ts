import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {freezeEvaluationWorkload} from '../src/evaluation/workload.js';
import {readExistingFileWorkload,EXISTING_FILE_WORKLOAD_SHA256} from '../src/evaluation/workload-release.js';
import {verifyNativeExistingFileArtifacts} from '../src/verification/native-existing-file-checker.js';
const release=new URL('../evaluation/existing-files-v1.json',import.meta.url);
const raw=()=>JSON.parse(readFileSync(release,'utf8'));
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');

test('pinned authored workload has eight immutable inputs and disjoint declared families',()=>{
  expect(hash(readFileSync(release))).toBe(EXISTING_FILE_WORKLOAD_SHA256);
  const suite=readExistingFileWorkload();expect(suite.cases).toHaveLength(8);
  expect(suite.cases.filter(c=>c.split==='evaluation')).toHaveLength(4);
  expect(suite.cases.filter(c=>c.split==='holdout')).toHaveLength(4);
  expect(new Set(suite.cases.map(c=>c.inputDigest)).size).toBe(8);
  expect(new Set(suite.cases.map(c=>c.family)).size).toBe(8);
  expect(Object.isFrozen(suite.cases[0].files[0])).toBe(true);
  expect(Object.isFrozen(suite.datasetInput.cases)).toBe(true);
  expect(suite).not.toHaveProperty('trials');expect(suite).not.toHaveProperty('baseline');
  expect(suite.cases[0].files[0]).not.toHaveProperty('expected');
});
test('canonical order and copied inputs are stable; changing goal, seeds or acceptance changes identity',()=>{
  const source=raw(),suite=freezeEvaluationWorkload(source);
  const reordered=raw();reordered.cases.reverse();for(const c of reordered.cases)c.files.reverse();
  expect(freezeEvaluationWorkload(reordered).suiteDigest).toBe(suite.suiteDigest);
  expect(freezeEvaluationWorkload(reordered).dataset.digest).toBe(suite.dataset.digest);
  source.cases[0].files[0].initial='changed';expect(freezeEvaluationWorkload(raw())).toEqual(suite);
  for(const mutate of [(s:any)=>{s.cases[0].goal+=' extra';},(s:any)=>{s.cases[0].files[0].initial+='\n';},(s:any)=>{s.cases[0].files[0].expected+='\n';}]){
    const changed=raw();mutate(changed);const next=freezeEvaluationWorkload(changed);
    expect(next.suiteDigest).not.toBe(suite.suiteDigest);expect(next.dataset.digest).not.toBe(suite.dataset.digest);
  }
});
test('relabeled identical inputs and family leakage across holdout are rejected',()=>{
  const source=raw();source.cases.push({...source.cases[0],id:'renamed',family:'other-family',split:'holdout'});
  expect(()=>freezeEvaluationWorkload(source)).toThrow('dataset_overlap');
  const family=raw();family.cases[4].family=family.cases[0].family;
  expect(()=>freezeEvaluationWorkload(family)).toThrow('family_overlap');
  const noHoldout=raw();for(const c of noHoldout.cases)c.split='evaluation';
  expect(()=>freezeEvaluationWorkload(noHoldout)).toThrow('independent_holdout');
});
test('every authored seed fails and its host-only reference bytes pass the existing exact-artifact checker',()=>{
  const suite=readExistingFileWorkload(),source=raw();
  for(const c of suite.cases){
    const definition=source.cases.find((entry:any)=>entry.id===c.id);
    const observations=(key:'initial'|'expected')=>c.contract.targets.map(target=>{
      const content=definition.files.find((file:any)=>file.relativePath===target.relativePath)[key];
      return {targetId:target.targetId,relativePath:target.relativePath,sha256:hash(content),byteLength:Buffer.byteLength(content),sourceRef:'authored-fixture'};
    });
    expect(verifyNativeExistingFileArtifacts(c.contract,observations('initial')).verdict).toBe('fail');
    expect(verifyNativeExistingFileArtifacts(c.contract,observations('expected')).verdict).toBe('pass');
    expect(c.inputDigest).toBe(suite.dataset.cases.find(item=>item.id===c.id)?.inputDigest);
  }
});
test.each(['../escape.mjs','C:/escape.mjs','src\\escape.mjs','src/file:stream','src/CON.txt','src/aux','src/trailing.','.git/config','src//file','/absolute'])('rejects nonportable target %s',path=>{
  const source=raw();source.cases[0].files[0].relativePath=path;expect(()=>freezeEvaluationWorkload(source)).toThrow('path');
});
test('case-insensitive or parent/child path collisions and unchanged targets refuse before materialization',()=>{
  for(const paths of [['src/x.mjs','src/X.mjs'],['src/file','src/file/nested']]){
    const source=raw();source.cases[0].files[0].relativePath=paths[0];source.cases[0].files[1].relativePath=paths[1];
    expect(()=>freezeEvaluationWorkload(source)).toThrow('path_overlap');
  }
  const source=raw();source.cases[0].files[0].expected=source.cases[0].files[0].initial;
  expect(()=>freezeEvaluationWorkload(source)).toThrow('unchanged_target');
});
test('rejects hostile shapes without invoking getters, iterators or proxy traps',()=>{
  let traps=0;
  const proxy=new Proxy(raw(),{getPrototypeOf(){traps++;throw Error('trap');}});
  expect(()=>freezeEvaluationWorkload(proxy)).toThrow('record');
  const getter=raw();Object.defineProperty(getter.cases[0].files[0],'initial',{enumerable:true,get(){traps++;return 'trap';}});
  expect(()=>freezeEvaluationWorkload(getter)).toThrow('fields');
  const sparse=raw();delete sparse.cases[1];expect(()=>freezeEvaluationWorkload(sparse)).toThrow('array');
  const iterator=raw();iterator.cases[Symbol.iterator]=()=>{traps++;throw Error('trap');};
  expect(()=>freezeEvaluationWorkload(iterator)).toThrow('array');expect(traps).toBe(0);
});
test('bounds text, case count and raw Unicode without lossy digest conversion',()=>{
  for(const content of ['x'.repeat(65537),'\ud800','nul\0']){
    const source=raw();source.cases[0].files[0].initial=content;expect(()=>freezeEvaluationWorkload(source)).toThrow(/size|text/);
  }
  const extra=raw();extra.cases=Array(65).fill(extra.cases[0]);expect(()=>freezeEvaluationWorkload(extra)).toThrow('array');
  const injected=raw();injected.executionAuthorized=true;expect(()=>freezeEvaluationWorkload(injected)).toThrow('fields');
});
