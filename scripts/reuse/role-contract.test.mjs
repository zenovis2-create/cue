import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRole, serializeRole } from './role-contract.mjs';

const valid = { id: 'implement-login', role: 'implementer', instructions: '로그인 구현\n검증 결과를 보고한다.', model: { canonicalId: 'provider/model-1' } };
test('deterministic constrained serialization and immutable independent output', () => {
  const copy = structuredClone(valid);
  const output = parseRole(valid);
  assert.deepEqual(valid, copy);
  assert.notEqual(output.model, valid.model);
  assert.ok(Object.isFrozen(output) && Object.isFrozen(output.model));
  assert.equal(serializeRole(valid), serializeRole({ model: valid.model, instructions: valid.instructions, role: valid.role, id: valid.id }));
  assert.deepEqual(JSON.parse(serializeRole(valid)), valid);
});
test('unknown fields and privilege-bearing extras are rejected', () => {
  for (const key of ['tools', 'permissions', 'tool_extras', 'allow', '__proto__', 'constructor', 'prototype']) {
    const input = JSON.parse(JSON.stringify(valid));
    Object.defineProperty(input, key, { value: { bypass: true }, enumerable: true });
    assert.throws(() => parseRole(input), /unknown_field/u);
  }
  assert.throws(() => parseRole({ ...valid, model: { canonicalId: 'x', permissions: ['write'] } }), /unknown_field/u);
});
test('invalid shapes, optional values, identifiers and limits are rejected', () => {
  for (const input of [null, [], 'text', 5]) assert.throws(() => parseRole(input));
  for (const role of ['admin', '', null, 3]) assert.throws(() => parseRole({ ...valid, role }));
  for (const model of [undefined, null, 'provider/model', [], {}, { canonicalId: 7 }]) assert.throws(() => parseRole({ ...valid, model }));
  for (const id of ['', '../escape', 'a\npermission=true', 'a"', 'x'.repeat(129)]) assert.throws(() => parseRole({ ...valid, id }));
  for (const instructions of ['', 4, '\u0000', '한'.repeat(5462)]) assert.throws(() => parseRole({ ...valid, instructions }));
});
test('prototype and accessors are rejected without reading getter', () => {
  assert.throws(() => parseRole(Object.assign(Object.create({ permission: true }), valid)), /prototype_rejected/u);
  let called = false;
  const input = { ...valid };
  Object.defineProperty(input, 'instructions', { get() { called = true; return 'x'; } });
  assert.throws(() => parseRole(input), /accessor_rejected/u);
  assert.equal(called, false);
});
test('role IDs reject path syntax while canonical model IDs remain data', () => {
  for (const id of ['a/../../escape', 'a/b', 'a\\b', 'C:escape', 'a:role', '..', '.', '../escape']) {
    assert.throws(() => parseRole({ ...valid, id }));
  }
  assert.equal(parseRole(valid).model.canonicalId, 'provider/model-1');
});
test('quotes/newlines remain JSON data and do not create executable fields', () => {
  const instructions = '"\n[permissions]\nwrite=true\n$(never-run) `never-run`';
  const text = serializeRole({ id: 'review', role: 'verifier', instructions });
  assert.equal(text.split('\n').length, 2);
  assert.deepEqual(JSON.parse(text), { id: 'review', role: 'verifier', instructions });
  assert.equal(Object.hasOwn(JSON.parse(text), 'permissions'), false);
});
