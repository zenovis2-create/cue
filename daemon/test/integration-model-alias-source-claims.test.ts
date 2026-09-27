import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { generateSourceClaimsBytes, verifySourceClaimsBytes, webClaimDigest,
  WEB_KIND, LOCAL_FILE_KIND } from '../scripts/model-alias-source-claims.mjs';
import { getModelAliasRegistry } from '../src/model-alias-registry.js';

interface Claim {
  alias: string;
  kind: string;
  reference: string;
  claim: string;
  observedDate: string;
  digest: string;
  [key: string]: unknown;
}
interface SourceDocument {
  version: string;
  digestRules: Record<string, string>;
  claims: Claim[];
}

const root = resolve(import.meta.dirname, '../..');
const claimsPath = join(root, 'evidence/integrations/S0/20260912-model-aliases/source-claims.json');
const qwenPath = join(root, 'evidence/integrations/S1/20260911-qwen-live/result.json');
const qwenBytes = readFileSync(qwenPath);

function committed() { return readFileSync(claimsPath); }
function document(): SourceDocument { return JSON.parse(committed().toString('utf8')) as SourceDocument; }
function bytes(value: unknown) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function resign(item: Claim) {
  if (item.kind === WEB_KIND) item.digest = webClaimDigest(item.reference, item.claim, item.observedDate);
}

describe('model alias source claim generator and verifier', () => {
  test('fresh temp regeneration is byte-identical to committed evidence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cue-model-alias-'));
    try {
      const output = join(directory, 'source-claims.json');
      writeFileSync(output, generateSourceClaimsBytes(qwenBytes));
      expect(readFileSync(output)).toEqual(committed());
      expect(verifySourceClaimsBytes(readFileSync(output), qwenBytes)).toMatchObject({ webClaims: 11, localFileClaims: 1 });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  test('registry evidence reference, date and digest exactly match generated claims', () => {
    const claims = document().claims;
    const records = getModelAliasRegistry().records;
    expect(claims.map(item => item.alias)).toEqual(records.map(item => item.originalAlias));
    for (let index = 0; index < records.length; index++) {
      expect(records[index].evidence).toEqual({ reference: claims[index].reference,
        digest: claims[index].digest, observedDate: claims[index].observedDate });
    }
  });

  test.each(['claim', 'reference', 'observedDate'] as const)('rejects a changed web %s even when re-signed', field => {
    const value = document();
    value.claims[0][field] += field === 'observedDate' ? '0' : '-changed';
    resign(value.claims[0]);
    expect(() => verifySourceClaimsBytes(bytes(value), qwenBytes)).toThrow();
  });

  test('rejects CRLF conversion and field reordering', () => {
    expect(() => verifySourceClaimsBytes(Buffer.from(committed().toString('utf8').replace(/\n/gu, '\r\n')), qwenBytes)).toThrow(/CRLF/);
    const value = document();
    const first = value.claims[0];
    value.claims[0] = { kind: first.kind, alias: first.alias, reference: first.reference, claim: first.claim,
      observedDate: first.observedDate, digest: first.digest };
    expect(() => verifySourceClaimsBytes(bytes(value), qwenBytes)).toThrow(/schema/);
  });

  test('rejects unknown fields, duplicate claims and digest tampering', () => {
    const extra = document(); extra.claims[0].extra = true;
    const duplicate = document(); duplicate.claims[1] = structuredClone(duplicate.claims[0]);
    const tampered = document(); tampered.claims[0].digest = '0'.repeat(64);
    for (const value of [extra, duplicate, tampered]) expect(() => verifySourceClaimsBytes(bytes(value), qwenBytes)).toThrow();
  });

  test('keeps Qwen on the separate exact-file-bytes kind and rejects kind/rule/file tamper', () => {
    const valid = document();
    const qwen = valid.claims.find(item => item.alias === 'qwen 3.8 27b (로컬)');
    expect(qwen).toMatchObject({ kind: LOCAL_FILE_KIND, reference: 'evidence/integrations/S1/20260911-qwen-live/result.json' });
    const wrongKind = document();
    const wrongKindQwen = wrongKind.claims.find(item => item.alias === 'qwen 3.8 27b (로컬)')!;
    wrongKindQwen.kind = WEB_KIND; resign(wrongKindQwen);
    const wrongRule = document(); wrongRule.digestRules[LOCAL_FILE_KIND] = 'sha256(text)';
    expect(() => verifySourceClaimsBytes(bytes(wrongKind), qwenBytes)).toThrow();
    expect(() => verifySourceClaimsBytes(bytes(wrongRule), qwenBytes)).toThrow();
    expect(() => verifySourceClaimsBytes(committed(), Buffer.concat([qwenBytes, Buffer.from('\n')]))).toThrow(/digest/);
  });
});
