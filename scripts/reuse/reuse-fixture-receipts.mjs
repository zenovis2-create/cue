// Deterministic, offline fixture/result receipts for reuse decisions R-01 through R-06.
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildClaudeModelOnlySpec, inspectClaudeModelOnlyTranscript } from './claude-launch-spec.mjs';
import { parseRole, serializeRole } from './role-contract.mjs';
import { normalizeUsage } from './usage-normalization.mjs';
import { evaluateReuseEvidence, readSelectedReuseBasis } from './reuse-manifest.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const resultNames = ['R-02-result.json', 'R-04-result.json', 'R-05-result.json', 'R-06-result.json'];
const outputNames = [...resultNames, 'lifecycle-matrix.json','incorporation-matrix.json','test-authority-matrix.json', 'receipt.json'];
const execution = Object.freeze({
  'R-01': { command: 'node --test scripts/reuse/model-transport.test.mjs', exitCode: 0, durationMilliseconds: 301.5959,
    source: 'evidence/integrations/S1/20260911-transport/reuse/R-01/RESULT.md' },
  'R-02': { command: 'node --test scripts/reuse/role-contract.test.mjs scripts/reuse/claude-launch-spec.test.mjs', exitCode: 0,
    durationMilliseconds: 101.2588, source: 'evidence/integrations/S0/20260911-baseline/reuse-review.md' },
  'R-03': { command: 'node --test scripts/reuse/model-transport.test.mjs', exitCode: 0, durationMilliseconds: 301.5959,
    source: 'evidence/integrations/S1/20260911-transport/reuse/R-01/RESULT.md' },
  'R-04': { command: 'node --test scripts/reuse/role-contract.test.mjs', exitCode: 0, durationMilliseconds: 90.164,
    source: 'evidence/integrations/S2/20260911-role/reuse/R-04/test-output.txt' },
  'R-05': { command: 'node --test scripts/reuse/usage-normalization.test.mjs', exitCode: 0, durationMilliseconds: 89.3291,
    source: 'evidence/integrations/S2/20260911-usage/reuse/R-05/test.log' },
  'R-06': { command: 'node scripts/reuse/reuse-fixture-receipts.mjs --probe-r06', exitCode: 0, durationMilliseconds: 166.7372,
    source: 'evidence/integrations/S0/20260912-reuse-fixture-receipts/implementation.md' },
});

function canonicalJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function pathFromRoot(relativePath) { return resolve(repositoryRoot, ...relativePath.split('/')); }
async function bytes(relativePath) { return readFile(pathFromRoot(relativePath)); }
async function fixture(id) { return JSON.parse(await readFile(pathFromRoot(`scripts/reuse/fixtures/${id}-input.json`), 'utf8')); }

async function implementation(paths) {
  const files = [];
  for (const path of paths) files.push({ path, sha256: sha256(await bytes(path)) });
  return { files, setSha256: sha256(canonicalJson(files)) };
}

async function generateR02() {
  const input = await fixture('R-02');
  const wire = `${input.transcriptFrames.map(frame => JSON.stringify(frame)).join('\n')}\n`;
  return canonicalJson({ launchSpec: buildClaudeModelOnlySpec(input.launch), transcriptResult: inspectClaudeModelOnlyTranscript(wire) });
}

async function generateR04() {
  const input = await fixture('R-04');
  return canonicalJson({ normalized: parseRole(input), serialized: serializeRole(input) });
}

async function generateR05() {
  const input = await fixture('R-05');
  return canonicalJson({ cases: input.cases.map(item => ({ caseId: item.caseId, result: normalizeUsage(item.provider, item.raw) })) });
}

export async function generateR06() {
  const input = await fixture('R-06');
  const cases = input.cases.map(item => {
    try {
      const value = item.validator === 'role' ? parseRole(item.input) : normalizeUsage(item.provider, item.input);
      return { caseId: item.caseId, status: 'accepted', value };
    } catch (error) {
      return { caseId: item.caseId, status: 'rejected', error: error.message };
    }
  });
  return canonicalJson({ boundary: 'exact native guards', cases });
}

function historicalHashes(text) {
  const implementationSha256 = text.match(/adapter SHA256: `([A-F0-9]{64})`/u)?.[1]?.toLowerCase();
  const fixtureSha256 = text.match(/test\/inline fixture 정의 SHA256: `([A-F0-9]{64})`/u)?.[1]?.toLowerCase();
  if (!implementationSha256 || !fixtureSha256) throw new Error('historical loopback hashes missing');
  return { implementationSha256, fixtureSha256 };
}

async function makeEntry(id, implementationPaths, fixturePath, resultPath, resultBytes, lifecycle, historicalReceipt) {
  const impl = await implementation(implementationPaths);
  const fixtureSha256 = sha256(await bytes(fixturePath));
  const entry = {
    id,
    execution: execution[id],
    implementation: impl,
    canonicalInputFixture: { path: fixturePath, sha256: fixtureSha256 },
    result: { path: resultPath, sha256: sha256(resultBytes) },
    lifecycle,
    selectionProof: selectionProof(id),
    noDrift: true,
  };
  if (historicalReceipt) entry.historicalReceipt = historicalReceipt;
  return entry;
}

function pureLifecycle(boundaryProof) {
  return Object.freeze({
    applicability: 'not-applicable-pure-synchronous-function',
    normal: 'deterministic canonical fixture result', failure: boundaryProof,
    cancel: 'N/A: no asynchronous work, process, signal, or external I/O',
    restart: 'N/A: no persisted or in-flight state', duplicate: 'same input produces identical bytes',
  });
}

function selectedLifecycleMatrix(selectionBinding, entries) {
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const executed = (id, behavior, detail) => Object.freeze({ behavior, disposition: 'executed-hash-bound-receipt',
    evidence: `${byId.get(id).result.path}#sha256:${byId.get(id).result.sha256}`, detail });
  const na = (behavior, detail) => Object.freeze({ behavior, disposition: 'not-applicable', evidence: null, detail });
  const rows = selectionBinding.selections.map(selection => {
    const id = selection.decisionId;
    if (id === 'R-08') return Object.freeze({ decisionId: id, selectedIdentity: selection.selectedIdentity,
      selectedRevision: selection.selectedRevision, behaviors: Object.freeze([
        na('success', 'N/A: selected declarative schema/stable-ID/delivery principles are design inputs, not an executable runtime seam'),
        na('failure', 'N/A: selected principles expose no callable operation or failure channel'),
        na('cancel', 'N/A: selected principles start no asynchronous work, process, request, or external I/O'),
        na('restart', 'N/A: selected principles hold no process, session, or persisted in-flight state'),
        na('duplicate', 'N/A: selected principles emit no operation that can be submitted twice'),
        Object.freeze({ behavior: 'boundary', disposition: 'executed-hash-bound-selection', evidence: `selection-manifest#sha256:${selectionBinding.manifestDigest}`,
          detail: 'catalog-bound limited-principles selection verified; selected external bytes remain zero' }),
      ]) });
    const entry = byId.get(id);
    if (!entry) throw Error(`selected lifecycle receipt missing: ${id}`);
    const seam = id === 'R-04' ? 'pure synchronous RoleSpec parser/serializer'
      : id === 'R-05' ? 'pure synchronous usage counter normalizer' : 'pure synchronous exact-key/counter guard';
    return Object.freeze({ decisionId: id, selectedIdentity: selection.selectedIdentity,
      selectedRevision: selection.selectedRevision, behaviors: Object.freeze([
        executed(id, 'success', `${seam} canonical accepted fixture`),
        executed(id, 'failure', `${seam} rejected fixture/error cases`),
        na('cancel', `N/A: ${seam} starts no asynchronous work, process, signal, request, or external I/O`),
        na('restart', `N/A: ${seam} has no process, session, persisted state, or in-flight operation`),
        executed(id, 'duplicate', `${seam} generated the same canonical result bytes on repeated generation`),
        executed(id, 'boundary', `${seam} exact selected fixture boundary and invalid inputs are covered by the bound result/test receipt`),
      ]) });
  });
  return canonicalJson({ version: 'cue-selected-reuse-lifecycle-matrix-v1', selectionRevision: selectionBinding.revision,
    selectionManifestDigest: selectionBinding.manifestDigest, adoptionAuthorized: false,
    excluded: ['deferred transports', 'unselected packages', 'provider/runtime dispatch'], behaviors: ['success','failure','cancel','restart','duplicate','boundary'], rows });
}

const selectedIds=['R-04','R-05','R-06','R-08'];
const cueTests={
  'R-04':'scripts/reuse/role-contract.test.mjs','R-05':'scripts/reuse/usage-normalization.test.mjs','R-06':'scripts/reuse/reuse-fixture-receipts.test.mjs',
};
const adapters={'R-04':'parseRole/serializeRole','R-05':'normalizeUsage','R-06':'generateR06'};
function exactKeys(value,keys,reason){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw Error(`selected adoption ${reason}`);}
export function validateSelectedAdoptionMatrices(incorporation,tests){
  exactKeys(incorporation,['version','selectionRevision','selectionManifestDigest','adoptionAuthorized','rows'],'incorporation fields');
  exactKeys(tests,['version','selectionRevision','selectionManifestDigest','authorities','rows'],'test fields');
  if(incorporation.version!=='cue-selected-incorporation-matrix-v1'||tests.version!=='cue-selected-test-authority-matrix-v1'||incorporation.adoptionAuthorized!==false)throw Error('selected adoption version');
  if(incorporation.selectionRevision!==tests.selectionRevision||incorporation.selectionManifestDigest!==tests.selectionManifestDigest||!/^[a-f0-9]{64}$/.test(incorporation.selectionManifestDigest))throw Error('selected adoption binding');
  if(JSON.stringify(incorporation.rows.map(row=>row.decisionId))!==JSON.stringify(selectedIds)||JSON.stringify(tests.rows.map(row=>row.decisionId))!==JSON.stringify(selectedIds))throw Error('selected adoption set');
  if(JSON.stringify(tests.authorities)!==JSON.stringify(['upstream','cue-regression','necessary-boundary']))throw Error('selected adoption authorities');
  for(const row of incorporation.rows){exactKeys(row,['decisionId','selectedRevision','selectedBytes','sourceNotice','declaredSeam','adapter','caller','patches','disposition','adoptionAuthorized'],'incorporation row');if(row.adoptionAuthorized!==false||!Array.isArray(row.patches)||typeof row.declaredSeam!=='string'||!row.declaredSeam)throw Error('selected adoption authority');if(row.decisionId==='R-08'){if(row.disposition!=='principles-only-not-incorporated'||row.selectedBytes.length!==0||row.adapter!==null||row.caller!==null||row.patches.length!==0)throw Error('selected adoption r08');}else if(row.disposition!=='cue-native-incorporated'||!row.selectedBytes.length||typeof row.sourceNotice!=='string'||!row.sourceNotice||typeof row.adapter!=='string'||typeof row.caller!=='string'||row.caller!=='scripts/reuse/reuse-fixture-receipts.mjs')throw Error('selected adoption incorporation');}
  for(let index=0;index<tests.rows.length;index++){const row=tests.rows[index];exactKeys(row,['decisionId','selectedRevision','upstream','cueRegression','necessaryBoundary'],'test row');if(row.decisionId!==incorporation.rows[index].decisionId||row.selectedRevision!==incorporation.rows[index].selectedRevision)throw Error('selected adoption binding');for(const key of ['upstream','cueRegression','necessaryBoundary'])exactKeys(row[key],['disposition','reason','command','source'],'authority cell');if(row.decisionId==='R-08'){if(Object.values({u:row.upstream,c:row.cueRegression,b:row.necessaryBoundary}).some(cell=>cell.disposition!=='not-applicable'||cell.command!==null||cell.source!==null))throw Error('selected adoption r08 tests');}else{if(row.upstream.disposition!=='not-applicable'||!row.upstream.reason.includes('Cue-authored selected bytes; zero incorporated upstream runtime/package bytes')||row.upstream.command!==null||row.cueRegression.disposition!=='passed-pinned'||row.necessaryBoundary.disposition!=='verified-current-cli'||row.cueRegression.command===row.necessaryBoundary.command||!/^[a-f0-9]{64}$/.test(row.cueRegression.source?.sha256)||!/^[a-f0-9]{64}$/.test(row.necessaryBoundary.source?.sha256))throw Error('selected adoption test separation');}}
  return true;
}
async function selectedAdoptionMatrices(selectionBinding){
  const incorporationRows=selectionBinding.selections.map(selection=>selection.decisionId==='R-08'?{
    decisionId:'R-08',selectedRevision:selection.selectedRevision,selectedBytes:[],sourceNotice:selection.sourceNotice,declaredSeam:selection.publicApiAndSeam,adapter:null,caller:null,patches:[],disposition:'principles-only-not-incorporated',adoptionAuthorized:false,
  }:{decisionId:selection.decisionId,selectedRevision:selection.selectedRevision,selectedBytes:selection.selectedBytes,sourceNotice:selection.sourceNotice,declaredSeam:selection.publicApiAndSeam,adapter:adapters[selection.decisionId],caller:'scripts/reuse/reuse-fixture-receipts.mjs',patches:selection.patches,disposition:'cue-native-incorporated',adoptionAuthorized:false});
  const boundarySource={path:'scripts/reuse/reuse-fixture-receipts.mjs',sha256:sha256(await bytes('scripts/reuse/reuse-fixture-receipts.mjs'))};
  const testRows=[];for(const selection of selectionBinding.selections){if(selection.decisionId==='R-08'){const reason='N/A: selected principles expose no callable seam and select zero external bytes';const cell={disposition:'not-applicable',reason,command:null,source:null};testRows.push({decisionId:'R-08',selectedRevision:selection.selectedRevision,upstream:cell,cueRegression:cell,necessaryBoundary:cell});continue;}const testPath=cueTests[selection.decisionId];testRows.push({decisionId:selection.decisionId,selectedRevision:selection.selectedRevision,upstream:{disposition:'not-applicable',reason:'N/A: Cue-authored selected bytes; zero incorporated upstream runtime/package bytes',command:null,source:null},cueRegression:{disposition:'passed-pinned',reason:'direct Cue contract/regression result is bound to current test bytes',command:execution[selection.decisionId].command,source:{path:testPath,sha256:sha256(await bytes(testPath))}},necessaryBoundary:{disposition:'verified-current-cli',reason:'current receipt CLI imports the selected function and byte-verifies deterministic output',command:'node scripts/reuse/reuse-fixture-receipts.mjs --verify <receipt-directory>',source:boundarySource}});}
  const incorporation={version:'cue-selected-incorporation-matrix-v1',selectionRevision:selectionBinding.revision,selectionManifestDigest:selectionBinding.manifestDigest,adoptionAuthorized:false,rows:incorporationRows};
  const tests={version:'cue-selected-test-authority-matrix-v1',selectionRevision:selectionBinding.revision,selectionManifestDigest:selectionBinding.manifestDigest,authorities:['upstream','cue-regression','necessary-boundary'],rows:testRows};validateSelectedAdoptionMatrices(incorporation,tests);return{incorporation:canonicalJson(incorporation),tests:canonicalJson(tests)};
}

function selectionProof(id) {
  if (id === 'R-04') return Object.freeze({
    cueContract: 'Cue-authored role-contract thin fixture adapter only',
    upstreamProof: 'TeamAI transformer is a rejected reference; zero upstream bytes selected',
    noticeApplicability: 'no external notice applies to the selected Cue-authored bytes',
  });
  if (id === 'R-05') return Object.freeze({
    cueContract: 'Cue-authored usage-normalization fixture contract only',
    upstreamProof: 'pinned provider field references are source-shape evidence, not incorporated SDK/client bytes',
    noticeApplicability: 'no external notice applies to the selected Cue-authored bytes',
  });
  if (id === 'R-06') return Object.freeze({
    cueContract: 'Cue-authored strict guard boundary reached through fixture tooling only',
    upstreamProof: 'Ajv and Zod remain deferred; zero package bytes selected',
    noticeApplicability: 'no external notice applies to the selected Cue-authored bytes',
  });
  return Object.freeze({
    cueContract: 'historical transport fixture evidence only',
    upstreamProof: 'transport selection and product adoption remain incomplete',
    noticeApplicability: 'not evaluated by this receipt',
  });
}

export async function generateReceiptArtifacts(outputDirectory, selectionRoot = repositoryRoot) {
  const selectionBinding = readSelectedReuseBasis(selectionRoot);
  const historicalPath = 'evidence/integrations/S1/20260911-transport/reuse/R-01/RESULT.md';
  const historicalBytes = await bytes(historicalPath);
  const historical = historicalHashes(historicalBytes.toString('utf8'));
  const transportImplementation = await implementation(['scripts/reuse/model-transport.mjs']);
  const currentFixtureSha256 = sha256(await bytes('scripts/reuse/model-transport.test.mjs'));
  if (transportImplementation.files[0].sha256 !== historical.implementationSha256
      || currentFixtureSha256 !== historical.fixtureSha256) throw new Error('historical loopback source or inline fixture drift');

  const results = {
    'R-02-result.json': await generateR02(),
    'R-04-result.json': await generateR04(),
    'R-05-result.json': await generateR05(),
    'R-06-result.json': await generateR06(),
  };
  const historicalReceipt = { path: historicalPath, sha256: sha256(historicalBytes), bytesRevalidated: true, loopbackRerun: false };
  const lifecycle = {
    historical: Object.freeze({ applicability: 'incomplete-historical-transport-receipt',
      normal: 'historical loopback bytes revalidated without rerun', failure: 'historical fixture cases only',
      cancel: 'not requalified', restart: 'not requalified', duplicate: 'not requalified' }),
    r02: pureLifecycle('malformed transcript and launch inputs reject synchronously'),
    r04: pureLifecycle('unknown fields, privilege fields, invalid model bindings, and size bounds reject synchronously'),
    r05: pureLifecycle('unsupported provider shapes and invalid counters reject synchronously'),
    r06: pureLifecycle('dedicated exact-key and invalid-counter boundary matrix'),
  };
  const entries = [
    await makeEntry('R-01', ['scripts/reuse/model-transport.mjs'], 'scripts/reuse/model-transport.test.mjs', historicalPath, historicalBytes, lifecycle.historical, historicalReceipt),
    await makeEntry('R-02', ['scripts/reuse/claude-launch-spec.mjs'], 'scripts/reuse/fixtures/R-02-input.json', 'R-02-result.json', results['R-02-result.json'], lifecycle.r02),
    await makeEntry('R-03', ['scripts/reuse/model-transport.mjs'], 'scripts/reuse/model-transport.test.mjs', historicalPath, historicalBytes, lifecycle.historical, historicalReceipt),
    await makeEntry('R-04', ['scripts/reuse/role-contract.mjs'], 'scripts/reuse/fixtures/R-04-input.json', 'R-04-result.json', results['R-04-result.json'], lifecycle.r04),
    await makeEntry('R-05', ['scripts/reuse/usage-normalization.mjs'], 'scripts/reuse/fixtures/R-05-input.json', 'R-05-result.json', results['R-05-result.json'], lifecycle.r05),
    await makeEntry('R-06', ['scripts/reuse/role-contract.mjs', 'scripts/reuse/usage-normalization.mjs'], 'scripts/reuse/fixtures/R-06-input.json', 'R-06-result.json', results['R-06-result.json'], lifecycle.r06),
  ];
  const lifecycleMatrix = selectedLifecycleMatrix(selectionBinding, entries);
  const adoption=await selectedAdoptionMatrices(selectionBinding);
  const receiptSystemPath = 'scripts/reuse/reuse-fixture-receipts.mjs';
  const receipt = canonicalJson({
    schemaVersion: 1,
    scope: 'offline deterministic reuse fixture receipts; implementation evidence only',
    receiptSystem: { path: receiptSystemPath, sha256: sha256(await bytes(receiptSystemPath)),
      verifierSha256: sha256(await bytes('scripts/reuse/reuse-manifest.mjs')) },
    selectionBinding: { revision: selectionBinding.revision, manifestDigest: selectionBinding.manifestDigest },
    lifecycleMatrix: { path: 'lifecycle-matrix.json', sha256: sha256(lifecycleMatrix) },
    incorporationMatrix:{path:'incorporation-matrix.json',sha256:sha256(adoption.incorporation)},
    testAuthorityMatrix:{path:'test-authority-matrix.json',sha256:sha256(adoption.tests)},
    forbiddenOperations: { external: false, network: false, cli: false, model: false, native: false,
      electron: false, install: false, download: false },
    entries,
  });
  await mkdir(outputDirectory, { recursive: true });
  for (const name of resultNames) await writeFile(join(outputDirectory, name), results[name], 'utf8');
  await writeFile(join(outputDirectory, 'lifecycle-matrix.json'), lifecycleMatrix, 'utf8');
  await writeFile(join(outputDirectory,'incorporation-matrix.json'),adoption.incorporation,'utf8');
  await writeFile(join(outputDirectory,'test-authority-matrix.json'),adoption.tests,'utf8');
  await writeFile(join(outputDirectory, 'receipt.json'), receipt, 'utf8');
}

function receiptBinding(receiptBytes) {
  if (receiptBytes.length > 1048576) throw Error('reuse receipt input limit');
  const value = JSON.parse(receiptBytes.toString('utf8'));
  return {
    revision: value.selectionBinding?.revision,
    manifestDigest: value.selectionBinding?.manifestDigest,
    receiptSha256: sha256(receiptBytes),
  };
}

export async function verifyReceiptArtifacts(expectedDirectory, fallbackDirectory = null, selectionRoot = repositoryRoot) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'cue-reuse-fixture-receipts-'));
  try {
    await generateReceiptArtifacts(temporaryDirectory, selectionRoot);
    const generatedReceipt = await readFile(join(temporaryDirectory, 'receipt.json'));
    let expectedReceipt = null;
    try { expectedReceipt = await readFile(join(expectedDirectory, 'receipt.json')); } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    let fallbackReceipt = null;
    if (fallbackDirectory !== null) {
      try { fallbackReceipt = await readFile(join(fallbackDirectory, 'receipt.json')); } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    const expected = receiptBinding(generatedReceipt);
    const lifecycle = evaluateReuseEvidence({
      version: 'cue-reuse-evidence-lifecycle-v1', current: expected,
      observed: expectedReceipt === null ? null : receiptBinding(expectedReceipt),
      fallback: fallbackDirectory === null ? null : {
        observed: fallbackReceipt === null ? null : receiptBinding(fallbackReceipt),
      },
    });
    if (!lifecycle.reusable) throw new Error(`reuse evidence refused: ${lifecycle.invalidation}`);
    const selectedDirectory = lifecycle.action === 'use-current' ? expectedDirectory : fallbackDirectory;
    for (const name of outputNames) {
      const [actual, selected] = await Promise.all([readFile(join(temporaryDirectory, name)), readFile(join(selectedDirectory, name))]);
      if (!actual.equals(selected)) throw new Error(`${name}: expected receipt drift (${sha256(selected)} != ${sha256(actual)})`);
    }
    return lifecycle;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

const [mode, target] = process.argv.slice(2);
if (mode === '--write' && target) {
  await generateReceiptArtifacts(resolve(target));
} else if (mode === '--verify' && target) {
  await verifyReceiptArtifacts(resolve(target));
  process.stdout.write('reuse fixture receipts: verified byte-for-byte\n');
} else if (mode === '--probe-r06') {
  process.stdout.write(await generateR06());
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  throw new Error('usage: --write <directory> | --verify <directory> | --probe-r06');
}
