import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAclObservation } from './readonly-acl-diagnostic.mjs';

const base={status:0,signal:null,error:null,stdout:'O:BAG:BAD:(A;;FA;;;SY)\r\n',stderr:''};
test('accepts one trimmed SDDL value',()=>assert.deepEqual(classifyAclObservation(base),{ok:true,reason:'valid-sddl',sddl:'O:BAG:BAD:(A;;FA;;;SY)'}));
test('distinguishes spawn, signal, status, and stderr failures',()=>{
  assert.equal(classifyAclObservation({...base,error:{code:'ENOENT'}}).reason,'spawn-error');
  assert.equal(classifyAclObservation({...base,signal:'SIGTERM'}).reason,'terminated-by-signal');
  assert.equal(classifyAclObservation({...base,status:1}).reason,'nonzero-status');
  assert.equal(classifyAclObservation({...base,stderr:'diagnostic'}).reason,'stderr-diagnostic');
});
test('distinguishes empty and malformed SDDL without ignoring stderr',()=>{
  assert.equal(classifyAclObservation({...base,stdout:'  \r\n'}).reason,'empty-sddl');
  for(const stdout of ['not-sddl','O:owner\nD:acl','O:bad\0tail'])assert.equal(classifyAclObservation({...base,stdout}).reason,'malformed-sddl');
  assert.equal(classifyAclObservation({...base,stdout:'O:valid',stderr:'warning'}).reason,'stderr-diagnostic');
});
