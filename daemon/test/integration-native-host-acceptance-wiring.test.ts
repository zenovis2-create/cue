import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { createNativeImplementationHost } from '../../app/native-implementation-host.mjs';
import { createNativeExistingFileContract, NATIVE_EXISTING_FILE_CHECKER_ID, NATIVE_EXISTING_FILE_CHECKER_REVISION } from '../src/verification/native-existing-file-checker.js';

const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const expectedArtifacts = [{ targetId: 'target', relativePath: 'target.txt', maxBytes: 1024,
  expectedSha256: sha('replacement'), expectedByteLength: 11, originalSha256: sha('original') }];
const contract = createNativeExistingFileContract(expectedArtifacts);
const workflow = { requirementId: 'code', requirementText: 'Update target.txt',
  checkerId: NATIVE_EXISTING_FILE_CHECKER_ID, checkerRevision: NATIVE_EXISTING_FILE_CHECKER_REVISION,
  parametersDigest: contract.parametersDigest, expectedArtifacts,
  targets: [{ targetId: 'target', relativePath: 'target.txt', maxBackupBytes: 1024 }],
  launchTimeoutMs: 1000, taskTimeoutMs: 5000, pollMs: 5 };

// The input fails before any provider or policy access. These denials prevent a caller
// from mixing a purported fixed checker with caller-provided acceptance authority.
test('declarative native checker rejects caller acceptance and checker overrides', () => {
  const db = { open: true };
  const base = { db, now: () => 1, workflow, implementation: {}, verifier: {}, accounting: {}, policies: {},
    authority: {}, runtime: {}, engine: {}, authorizePublication: () => true };
  for (const override of [{ acceptance: {} }, { requirementCheckers: [] }, { resolveRequirementChecker: () => undefined }]) {
    expect(createNativeImplementationHost({ ...base, ...override } as never)).toEqual({ available: false,
      reasons: ['native-implementation-checker-override'] });
  }
});

test('workflow getter is rejected without invoking it', () => {
  let reads=0;
  const workflowWithGetter=Object.defineProperty({...workflow},'expectedArtifacts',{enumerable:true,get(){reads++;throw Error('getter invoked');}});
  const result=createNativeImplementationHost({db:{open:true},now:()=>1,workflow:workflowWithGetter,implementation:{},verifier:{},
    accounting:{},policies:{},authority:{},runtime:{},engine:{},authorizePublication:()=>true} as never);
  expect(result).toEqual({available:false,reasons:['native-implementation-data-invalid']});
  expect(reads).toBe(0);
});

test('declarative contract rejects changed expected bytes or target scope before provider composition', () => {
  const base = { db: { open: true }, now: () => 1, workflow, implementation: {}, verifier: {}, accounting: {}, policies: {},
    authority: {}, runtime: {}, engine: {}, authorizePublication: () => true };
  for (const changed of [
    { ...workflow, expectedArtifacts: [{ ...expectedArtifacts[0], expectedSha256: sha('wrong') }] },
    { ...workflow, targets: [{ ...workflow.targets[0], maxBackupBytes: 2048 }] },
    { ...workflow, checkerId: 'caller-checker' },
  ]) expect(createNativeImplementationHost({ ...base, workflow: changed } as never)).toEqual({ available: false,
    reasons: ['native-implementation-contract-mismatch'] });
});
