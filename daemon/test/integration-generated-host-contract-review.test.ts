import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { generatedJsonEvidencePolicy, GENERATED_JSON_CHECKER_ID } from '../src/verification/generated-acceptance-host.js';

const base = Object.freeze({
  requirementId: 'json-format', producerTaskId: 'produce-json', targetId: 'formatted-json',
  checkerId: GENERATED_JSON_CHECKER_ID, checkerRevision: `v1:${'a'.repeat(64)}`,
  parametersDigest: 'b'.repeat(64), inputSha256: 'c'.repeat(64),
});

test('generated evidence policy is immutable, deterministic, and bound to every per-run target fact', () => {
  const first = generatedJsonEvidencePolicy(base);
  expect(generatedJsonEvidencePolicy({ ...base })).toEqual(first);
  expect(Object.isFrozen(first)).toBe(true);
  for (const field of ['requirementId','producerTaskId','targetId','checkerRevision','parametersDigest','inputSha256'] as const) {
    const changed = { ...base, [field]: field.includes('Digest') || field === 'inputSha256' ? 'd'.repeat(64) : `${base[field]}-other` };
    const next = generatedJsonEvidencePolicy(changed);
    expect(next, field).not.toEqual(first);
    if (field !== 'requirementId') expect(next.sourceRevision, field).not.toBe(first.sourceRevision);
    if (field === 'parametersDigest') expect(next.parametersDigest).not.toBe(first.parametersDigest);
    if (field === 'targetId') expect(next.targetIds).not.toEqual(first.targetIds);
    if (field === 'producerTaskId') expect(next.producerTaskIds).not.toEqual(first.producerTaskIds);
  }
  expect(first).toMatchObject({ kind: 'document', checkerId: GENERATED_JSON_CHECKER_ID, hostileCheckIds: [], requiredSectionIds: ['json-document'], claimIds: [], requiresRender: false });
});

test('wrong checker identity is rejected and production policy issuance enforces the pinned revision', () => {
  expect(() => generatedJsonEvidencePolicy({ ...base, checkerId: 'other-checker' })).toThrow('generated_checker_policy_binding');
  const source = readFileSync(new URL('../src/verification/generated-acceptance-host.ts', import.meta.url), 'utf8');
  expect(source).toContain("target.checkerId!==GENERATED_JSON_CHECKER_ID||target.checkerRevision!==revision");
  const host = readFileSync(new URL('../../app/generated-json-host.mjs', import.meta.url), 'utf8');
  expect(host).toContain('requirementCheckers: [native.requirementChecker(');
  expect(host).toContain('inputSha256: sha(input)');
});
