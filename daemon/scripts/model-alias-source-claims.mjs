import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB_KIND = 'web-claim-v1';
export const LOCAL_FILE_KIND = 'local-file-sha256-v1';
export const WEB_DIGEST_RULE = 'sha256(UTF-8(reference + 0x0A + claim + 0x0A + observedDate)); no terminal LF';
export const LOCAL_FILE_DIGEST_RULE = 'sha256(exact referenced file bytes)';

export const CLAIM_SOURCES = Object.freeze([
  ['gpt 5.6 sol', WEB_KIND, 'https://developers.openai.com/api/docs/models', 'GPT-5.6 Sol -> gpt-5.6-sol', '2026-09-12'],
  ['terra', WEB_KIND, 'https://developers.openai.com/api/docs/models', 'Requested terra omits GPT-5.6; official page identifies GPT-5.6 Terra but does not define terra as a standalone API alias', '2026-09-12'],
  ['luna', WEB_KIND, 'https://developers.openai.com/api/docs/models', 'Requested luna omits GPT-5.6; official page identifies GPT-5.6 Luna but does not define luna as a standalone API alias', '2026-09-12'],
  ['6 astra', WEB_KIND, 'https://developers.openai.com/api/docs/models', 'GPT-6 Astra -> gpt-6-astra', '2026-09-12'],
  ['claude opus 5.0', WEB_KIND, 'https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions', 'Claude Opus 5 -> claude-opus-5; major-version 5 omits the minor segment', '2026-09-12'],
  ['sonnet 5', WEB_KIND, 'https://platform.claude.com/docs/en/models/overview', 'Claude Sonnet 5 -> claude-sonnet-5', '2026-09-12'],
  ['haiku', WEB_KIND, 'https://platform.claude.com/docs/en/models/overview', 'Requested haiku lacks a version; official current and historical Haiku IDs are versioned', '2026-09-12'],
  ['fable 5.1', WEB_KIND, 'https://platform.claude.com/docs/en/models/fable-5-1/overview', 'Claude Fable 5.1 -> claude-fable-5-1', '2026-09-12'],
  ['gemini flash 3.8', WEB_KIND, 'https://ai.google.dev/gemini-api/docs/models', 'Gemini 3.8 Flash -> gemini-3.8-flash', '2026-09-12'],
  ['qwen 3.8 27b (로컬)', LOCAL_FILE_KIND, 'evidence/integrations/S1/20260911-qwen-live/result.json', 'Local server advertised qwen38-27b-unc; marketing and weight identity remain unverified', '2026-09-11'],
  ['grok 4.6', WEB_KIND, 'https://docs.x.ai/developers/models/grok-4.6', 'Grok 4.6 -> grok-4.6', '2026-09-12'],
  ['muse 1.3', WEB_KIND, 'https://research.meta.ai/blog/introducing-muse-spark-1-3', 'Official page identifies Muse Spark 1.3 and Meta Model API availability but gives no canonical API model ID for requested muse 1.3', '2026-09-12'],
].map(row => Object.freeze(row)));

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function webClaimDigest(reference, claim, observedDate) {
  return sha256(Buffer.from(`${reference}\n${claim}\n${observedDate}`, 'utf8'));
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === keys.length && Object.keys(value).every((key, index) => key === keys[index]);
}

function requireText(value, name) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1000 || value.trim() !== value || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(`invalid ${name}`);
  }
}

function claimDigest(kind, reference, claim, observedDate, qwenBytes) {
  if (kind === WEB_KIND) return webClaimDigest(reference, claim, observedDate);
  if (kind === LOCAL_FILE_KIND) {
    if (!Buffer.isBuffer(qwenBytes)) throw new Error('qwen evidence bytes required');
    return sha256(qwenBytes);
  }
  throw new Error('unknown digest kind');
}

export function generateSourceClaimsBytes(qwenBytes) {
  if (!Buffer.isBuffer(qwenBytes)) throw new Error('qwen evidence bytes required');
  const claims = CLAIM_SOURCES.map(([alias, kind, reference, claim, observedDate]) => ({
    alias,
    kind,
    reference,
    claim,
    observedDate,
    digest: claimDigest(kind, reference, claim, observedDate, qwenBytes),
  }));
  const document = {
    version: 'cue-model-alias-source-claims-v2',
    digestRules: {
      [WEB_KIND]: WEB_DIGEST_RULE,
      [LOCAL_FILE_KIND]: LOCAL_FILE_DIGEST_RULE,
    },
    claims,
  };
  return Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

export function verifySourceClaimsBytes(bytes, qwenBytes) {
  if (!Buffer.isBuffer(bytes) || !Buffer.isBuffer(qwenBytes)) throw new Error('evidence bytes required');
  if (bytes.includes(0x0d)) throw new Error('CRLF is not canonical');
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('source claims must be UTF-8');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('invalid source claims JSON'); }
  if (!exactKeys(value, ['version', 'digestRules', 'claims']) || value.version !== 'cue-model-alias-source-claims-v2' ||
      !exactKeys(value.digestRules, [WEB_KIND, LOCAL_FILE_KIND]) || value.digestRules[WEB_KIND] !== WEB_DIGEST_RULE ||
      value.digestRules[LOCAL_FILE_KIND] !== LOCAL_FILE_DIGEST_RULE || !Array.isArray(value.claims) || value.claims.length !== CLAIM_SOURCES.length) {
    throw new Error('invalid source claims schema');
  }
  const unique = new Set();
  const aliases = new Set();
  for (const item of value.claims) {
    if (!exactKeys(item, ['alias', 'kind', 'reference', 'claim', 'observedDate', 'digest']) ||
        ![WEB_KIND, LOCAL_FILE_KIND].includes(item.kind)) throw new Error('invalid claim schema');
    requireText(item.alias, 'alias');
    requireText(item.reference, 'reference');
    requireText(item.claim, 'claim');
    if (typeof item.observedDate !== 'string' || !DATE.test(item.observedDate) || !SHA256.test(item.digest)) throw new Error('invalid claim value');
    const identity = `${item.kind}\u0000${item.reference}\u0000${item.claim}\u0000${item.observedDate}`;
    if (unique.has(identity)) throw new Error('duplicate claim');
    unique.add(identity);
    if (aliases.has(item.alias)) throw new Error('duplicate alias claim');
    aliases.add(item.alias);
    if (claimDigest(item.kind, item.reference, item.claim, item.observedDate, qwenBytes) !== item.digest) throw new Error('claim digest mismatch');
  }
  const expected = generateSourceClaimsBytes(qwenBytes);
  if (!bytes.equals(expected)) throw new Error('noncanonical or changed source claims');
  return Object.freeze({ webClaims: value.claims.filter(item => item.kind === WEB_KIND).length,
    localFileClaims: value.claims.filter(item => item.kind === LOCAL_FILE_KIND).length,
    bytes: bytes.length,
    sha256: sha256(bytes) });
}

function cli() {
  const args = process.argv.slice(2);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = resolve(scriptDir, '../..');
  const qwenPath = resolve(repositoryRoot, 'evidence/integrations/S1/20260911-qwen-live/result.json');
  const claimsPath = resolve(repositoryRoot, 'evidence/integrations/S0/20260912-model-aliases/source-claims.json');
  const qwenBytes = readFileSync(qwenPath);
  if (args.length === 1 && args[0] === '--check') {
    process.stdout.write(`${JSON.stringify(verifySourceClaimsBytes(readFileSync(claimsPath), qwenBytes))}\n`);
    return;
  }
  if (args.length === 2 && args[0] === '--output') {
    writeFileSync(resolve(args[1]), generateSourceClaimsBytes(qwenBytes));
    return;
  }
  throw new Error('usage: model-alias-source-claims.mjs --check | --output PATH');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli();
