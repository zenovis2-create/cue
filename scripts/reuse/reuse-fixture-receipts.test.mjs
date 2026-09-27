import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { generateReceiptArtifacts, generateR06, validateSelectedAdoptionMatrices, verifyReceiptArtifacts } from './reuse-fixture-receipts.mjs';

const expected = resolve('evidence/integrations/S0/20260916-selected-adoption-gates/receipts');
const artifactNames = ['R-02-result.json', 'R-04-result.json', 'R-05-result.json', 'R-06-result.json', 'lifecycle-matrix.json','incorporation-matrix.json','test-authority-matrix.json', 'receipt.json'];

test('dedicated R-06 validator fixture produces exact deterministic boundary results', async () => {
  const first = await generateR06();
  assert.equal(first, await generateR06());
  const result = JSON.parse(first);
  assert.deepEqual(result.cases.map(item => [item.caseId, item.status, item.error ?? null]), [
    ['role-exact-object-accepted', 'accepted', null],
    ['role-privilege-field-rejected', 'rejected', 'unknown_field'],
    ['role-model-extra-field-rejected', 'rejected', 'unknown_field'],
    ['usage-negative-counter-rejected', 'rejected', 'invalid token counter'],
    ['usage-array-rejected', 'rejected', 'usage must be a plain record'],
  ]);
});

test('fresh generated results and receipt match checked-in bytes', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'cue-reuse-receipts-test-'));
  try {
    await generateReceiptArtifacts(temporary);
    for (const name of artifactNames) {
      const [actual, wanted] = await Promise.all([readFile(join(temporary, name)), readFile(join(expected, name))]);
      assert.deepEqual(actual, wanted, name);
    }
    const receipt = JSON.parse(await readFile(join(temporary, 'receipt.json'), 'utf8'));
    assert.deepEqual(receipt.entries.map(entry => entry.id), ['R-01', 'R-02', 'R-03', 'R-04', 'R-05', 'R-06']);
    assert.ok(receipt.entries.every(entry => entry.execution.exitCode === 0 && entry.execution.durationMilliseconds > 0 && entry.noDrift));
    assert.ok(receipt.entries.every(entry => entry.implementation.setSha256 !== entry.canonicalInputFixture.sha256));
    const pure = receipt.entries.filter(entry => ['R-02', 'R-04', 'R-05', 'R-06'].includes(entry.id));
    assert.ok(pure.every(entry => entry.lifecycle.applicability === 'not-applicable-pure-synchronous-function'));
    assert.equal(receipt.entries.find(entry => entry.id === 'R-03').lifecycle.applicability, 'incomplete-historical-transport-receipt');
    assert.match(receipt.entries.find(entry => entry.id === 'R-04').selectionProof.cueContract, /thin fixture adapter/u);
    assert.match(receipt.entries.find(entry => entry.id === 'R-05').selectionProof.upstreamProof, /not incorporated/u);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('canonical selected set has a complete six-behavior lifecycle matrix without deferred transports', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'cue-reuse-lifecycle-test-'));
  try {
    await generateReceiptArtifacts(temporary);
    const matrix = JSON.parse(await readFile(join(temporary, 'lifecycle-matrix.json'), 'utf8'));
    assert.deepEqual(matrix.rows.map(row => row.decisionId), ['R-04', 'R-05', 'R-06', 'R-08']);
    assert.equal(matrix.adoptionAuthorized, false);
    assert.deepEqual(matrix.behaviors, ['success','failure','cancel','restart','duplicate','boundary']);
    for (const row of matrix.rows) {
      assert.deepEqual(row.behaviors.map(item => item.behavior), matrix.behaviors);
      assert.ok(row.behaviors.every(item => item.disposition === 'executed-hash-bound-receipt'
        || item.disposition === 'executed-hash-bound-selection' || (item.disposition === 'not-applicable' && /^N\/A: /u.test(item.detail))));
    }
    assert.ok(matrix.excluded.includes('deferred transports'));
    assert.doesNotMatch(JSON.stringify(matrix), /R-0[123]/u);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('selected incorporation and three-authority matrices are exact and fail closed',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'cue-reuse-adoption-test-'));try{await generateReceiptArtifacts(temporary);const incorporation=JSON.parse(await readFile(join(temporary,'incorporation-matrix.json'),'utf8')),authorities=JSON.parse(await readFile(join(temporary,'test-authority-matrix.json'),'utf8'));
    assert.equal(validateSelectedAdoptionMatrices(incorporation,authorities),true);assert.deepEqual(incorporation.rows.map(row=>row.decisionId),['R-04','R-05','R-06','R-08']);assert.deepEqual(authorities.authorities,['upstream','cue-regression','necessary-boundary']);
    const hostile=[];let value=structuredClone(incorporation);value.rows.pop();hostile.push([value,authorities]);value=structuredClone(incorporation);value.rows.push(structuredClone(value.rows[0]));hostile.push([value,authorities]);value=structuredClone(incorporation);value.rows[0].sourceNotice='';hostile.push([value,authorities]);value=structuredClone(incorporation);delete value.rows[1].patches;hostile.push([value,authorities]);value=structuredClone(incorporation);value.rows[2].caller='app/core.mjs';hostile.push([value,authorities]);value=structuredClone(incorporation);value.rows[3].selectedBytes=[{path:'external',sha256:'0'.repeat(64)}];hostile.push([value,authorities]);value=structuredClone(incorporation);value.rows[3].adoptionAuthorized=true;hostile.push([value,authorities]);
    let tests=structuredClone(authorities);tests.rows[0].upstream.reason='N/A';hostile.push([incorporation,tests]);tests=structuredClone(authorities);tests.rows[1].cueRegression=structuredClone(tests.rows[1].necessaryBoundary);hostile.push([incorporation,tests]);tests=structuredClone(authorities);tests.rows[2].necessaryBoundary.source=null;hostile.push([incorporation,tests]);tests=structuredClone(authorities);tests.rows[3].necessaryBoundary.disposition='verified-current-cli';hostile.push([incorporation,tests]);for(const args of hostile)assert.throws(()=>validateSelectedAdoptionMatrices(...args),/selected adoption/u);
  }finally{await rm(temporary,{recursive:true,force:true});}
});

test('current CLI refuses stale test authority bytes and a missing boundary artifact',async()=>{
  const altered=await mkdtemp(join(tmpdir(),'cue-reuse-adoption-altered-'));try{await generateReceiptArtifacts(altered);const path=join(altered,'test-authority-matrix.json'),matrix=JSON.parse(await readFile(path,'utf8'));matrix.rows[0].cueRegression.source.sha256='0'.repeat(64);await writeFile(path,`${JSON.stringify(matrix,null,2)}\n`);await assert.rejects(verifyReceiptArtifacts(altered),/test-authority-matrix\.json: expected receipt drift/u);await rm(path);await assert.rejects(verifyReceiptArtifacts(altered),/ENOENT/u);}finally{await rm(altered,{recursive:true,force:true});}
});

test('receipt verifier rejects a changed bound source or fixture hash', async () => {
  const altered = await mkdtemp(join(tmpdir(), 'cue-reuse-receipts-altered-'));
  try {
    await generateReceiptArtifacts(altered);
    const path = join(altered, 'receipt.json');
    const receipt = JSON.parse(await readFile(path, 'utf8'));
    receipt.entries[1].canonicalInputFixture.sha256 = '0'.repeat(64);
    await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    await assert.rejects(verifyReceiptArtifacts(altered), /reuse evidence refused: changed-binding/u);
  } finally {
    await rm(altered, { recursive: true, force: true });
  }
});

test('missing current receipt refuses unless an exact pinned fallback is supplied', async () => {
  const missing = await mkdtemp(join(tmpdir(), 'cue-reuse-receipts-missing-'));
  try {
    await assert.rejects(verifyReceiptArtifacts(missing), /reuse evidence refused: missing-receipt/u);
    const decision = await verifyReceiptArtifacts(missing, expected);
    assert.deepEqual({ reusable: decision.reusable, action: decision.action, invalidation: decision.invalidation },
      { reusable: true, action: 'use-pinned-fallback', invalidation: 'missing-receipt' });
  } finally {
    await rm(missing, { recursive: true, force: true });
  }
});

test('the consumed registry binding invalidates changed selected revisions and descriptor bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cue-reuse-catalog-'));
  const catalogPath = 'docs/reuse-decisions/upstream-source-catalog.json';
  const original = await readFile(catalogPath);
  const catalog = JSON.parse(original);
  const selected = catalog.applicableSelections.filter(entry => ['R-04', 'R-05', 'R-06', 'R-08'].includes(entry.decisionId));
  try {
    for (const path of new Set([catalogPath, ...selected.flatMap(entry => entry.decisionId === 'R-08'
      ? entry.cueProductBytes.map(ref => ref.path) : [entry.manifest?.path ?? entry.decision.path, ...entry.selectedBytes.map(ref => ref.path)])])) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), await readFile(path));
    }
    await verifyReceiptArtifacts(expected, null, root);
    for (const entry of selected) {
      const changed = structuredClone(catalog);
      const changedRow = changed.applicableSelections.find(row => row.decisionId === entry.decisionId);
      if (entry.decisionId === 'R-08') changedRow.decisionPinnedCommit = '0'.repeat(40);
      else changedRow.selectedRevision = `sha256:${'0'.repeat(64)}`;
      await writeFile(join(root, catalogPath), JSON.stringify(changed));
      await assert.rejects(verifyReceiptArtifacts(expected, null, root), entry.decisionId === 'R-08' ? /changed-binding/u : /selected_catalog/u);
      await writeFile(join(root, catalogPath), original);
      if (entry.decisionId === 'R-08') {
        const ref = entry.cueProductBytes[0], before = await readFile(join(root, ref.path));
        await writeFile(join(root, ref.path), Buffer.concat([before, Buffer.from('\n')]));
        await assert.rejects(verifyReceiptArtifacts(expected, null, root), /reuse_manifest_hash/u);
        await writeFile(join(root, ref.path), before);
        continue;
      }
      const ref = entry.manifest ?? entry.decision, before = await readFile(join(root, ref.path));
      const altered = Buffer.concat([before, Buffer.from('\n')]);
      await writeFile(join(root, ref.path), altered);
      await assert.rejects(verifyReceiptArtifacts(expected, null, root));
      // Even an intentional new descriptor pin changes the expected basis;
      // an old receipt and its identical fallback cannot qualify that revision.
      const repinned = structuredClone(catalog), row = repinned.applicableSelections.find(row => row.decisionId === entry.decisionId);
      (row.manifest ?? row.decision).sha256 = createHash('sha256').update(altered).digest('hex');
      await writeFile(join(root, catalogPath), JSON.stringify(repinned));
      await assert.rejects(verifyReceiptArtifacts(expected, expected, root), /changed-binding/u);
      await writeFile(join(root, ref.path), before);
      await writeFile(join(root, catalogPath), original);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
