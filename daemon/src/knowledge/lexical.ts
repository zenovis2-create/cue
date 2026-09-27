import { createHash } from 'node:crypto';
import { types } from 'node:util';
import type { ResourceSnapshot } from '../resources/packages.js';

interface Token { value: string; start: number; end: number; hangul: boolean }
export interface KnowledgeHit {
  readonly packageId: string; readonly version: string; readonly resourceId: string; readonly path: string;
  readonly source: string; readonly revision: string; readonly manifestSha256: string; readonly sha256: string;
  readonly sourceVerification: 'declared-not-remote-verified'; readonly authority: 'reference-only';
  readonly excerpt: string; readonly byteStart: number; readonly byteEnd: number; readonly score: number;
}
const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function data(v: unknown, keys: readonly string[]) {
  if (!v || typeof v !== 'object' || types.isProxy(v) || Object.getPrototypeOf(v) !== Object.prototype || !Object.isFrozen(v)) throw Error('knowledge_snapshot_required');
  const own = Reflect.ownKeys(v);
  if (own.length !== keys.length || keys.some(key => !own.includes(key))) throw Error('knowledge_plain_data');
  for (const key of own) {
    const d = Object.getOwnPropertyDescriptor(v, key)!;
    if (typeof key !== 'string' || !d.enumerable || !Object.hasOwn(d, 'value')) throw Error('knowledge_plain_data');
  }
}
function array<T>(v: unknown, maximum: number): T[] {
  if (!v || typeof v !== 'object' || types.isProxy(v) || !Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype) throw Error('knowledge_plain_array');
  const length = Object.getOwnPropertyDescriptor(v, 'length')!.value as number;
  if (length > maximum) throw Error('knowledge_package_limit');
  if (Reflect.ownKeys(v).length !== length + 1) throw Error('knowledge_plain_array');
  const result: T[] = [];
  for (let index = 0; index < length; index++) {
    const d = Object.getOwnPropertyDescriptor(v, String(index));
    if (!d?.enumerable || !Object.hasOwn(d, 'value')) throw Error('knowledge_plain_array');
    result.push(d.value as T);
  }
  return result;
}
function tokens(text: string, max: number): Token[] {
  const result: Token[] = [];
  for (const m of text.matchAll(/[A-Za-z0-9]+|[\p{Script=Hangul}]+/gu)) {
    const word = m[0], start = m.index;
    const pieces = /^[\p{Script=Hangul}]+$/u.test(word)
      ? [{ value: word, start, end: start + word.length, hangul: true }]
      : [...word.matchAll(/[A-Z]+(?=[A-Z][a-z]|\d|$)|[A-Z]?[a-z]+|\d+/g)].map(p => ({ value: p[0].toLowerCase(), start: start + p.index, end: start + p.index + p[0].length, hangul: false }));
    result.push(...pieces);
    if (result.length > max) throw Error('knowledge_token_limit');
  }
  return result;
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Host-approved, already loaded reference bytes only. This module does not approve
 * resource packages or authenticate their declared upstream provenance. It cannot
 * execute instructions, change policies, grant permissions, or mark evidence true. */
export function createKnowledgeIndex(snapshots: readonly ResourceSnapshot[]) {
  const packages = array<ResourceSnapshot>(snapshots, 32);
  const documents: { meta: Omit<KnowledgeHit,'excerpt'|'byteStart'|'byteEnd'|'score'>; text: string; tokens: Token[]; key: string }[] = [];
  let bytes = 0, tokenCount = 0; const keys = new Set<string>();
  for (const snapshot of packages) {
    data(snapshot, ['id','version','source','revision','manifestSha256','resources']);
    const resources = array<ResourceSnapshot['resources'][number]>(snapshot.resources, 32);
    for (const resource of resources) {
      data(resource, ['id','kind','path','sha256','byteLength','text']);
      if (resource.kind !== 'knowledge') continue;
      if (typeof resource.text !== 'string' || !digest(resource.sha256) || resource.text.length > 65536
        || resource.byteLength > 65536) throw Error('knowledge_content_integrity');
      // The package loader's UTF-8 decoder strips one leading BOM. Restore only
      // those exact three bytes when both original length and SHA prove them.
      // Token offsets and excerpts use this original text, not the stripped view.
      let originalText = resource.text;
      if (Buffer.byteLength(originalText) + 3 === resource.byteLength && hash('\uFEFF' + originalText) === resource.sha256) originalText = '\uFEFF' + originalText;
      if (Buffer.byteLength(originalText) !== resource.byteLength || hash(originalText) !== resource.sha256) throw Error('knowledge_content_integrity');
      if ((bytes += resource.byteLength) > 1048576 || documents.length >= 128) throw Error('knowledge_document_limit');
      const words = tokens(originalText, 4096); if ((tokenCount += words.length) > 32768) throw Error('knowledge_token_limit');
      for (const value of [snapshot.id,snapshot.version,snapshot.source,snapshot.revision,snapshot.manifestSha256,resource.id,resource.path]) {
        if (typeof value !== 'string' || !value || value.length > 512) throw Error('knowledge_provenance');
      }
      if (!digest(snapshot.manifestSha256) || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(snapshot.revision)) throw Error('knowledge_provenance');
      const key = snapshot.id + '\0' + resource.id;
      if (keys.has(key)) throw Error('knowledge_duplicate_resource'); keys.add(key);
      documents.push({ key, text: originalText, tokens: words, meta: Object.freeze({ packageId: snapshot.id, version: snapshot.version, resourceId: resource.id,
        path: resource.path, source: snapshot.source, revision: snapshot.revision, manifestSha256: snapshot.manifestSha256, sha256: resource.sha256,
        sourceVerification: 'declared-not-remote-verified', authority: 'reference-only' }) });
    }
  }
  return Object.freeze({
    search(query: string, limit = 5): readonly Readonly<KnowledgeHit>[] {
      if (typeof query !== 'string' || query.length > 256 || !Number.isSafeInteger(limit) || limit < 1 || limit > 10) throw Error('knowledge_query_limit');
      const terms = [...new Map(tokens(query, 32).map(t => [t.value,t])).values()];
      if (!terms.length) return Object.freeze([]);
      const results: { hit: KnowledgeHit; key: string }[] = [];
      for (const doc of documents) {
        let first = Infinity, score = 0, matched = true; const positions: number[] = [];
        for (const term of terms) {
          let found: Token | undefined, foundIndex = -1, inside = 0;
          for (let index = 0; index < doc.tokens.length; index++) {
            const t = doc.tokens[index]!;
            if (t.value === term.value) { found = t; foundIndex = index; inside = 0; break; }
            if (!found && term.hangul && term.value.length >= 2 && t.hangul && t.value.includes(term.value)) { found = t; foundIndex = index; inside = t.value.indexOf(term.value); }
          }
          if (!found && term.hangul && term.value.length >= 2) {
            for (let index = 0; index < doc.tokens.length && !found; index++) {
              const t = doc.tokens[index]!; if (!t.hangul) continue;
              let joined = t.value;
              for (let next = index + 1; next < doc.tokens.length && joined.length < term.value.length; next++) {
                const following = doc.tokens[next]!, previous = doc.tokens[next - 1]!;
                if (!following.hangul || !/^\s*$/u.test(doc.text.slice(previous.end, following.start))) break;
                joined += following.value;
              }
              if (joined.startsWith(term.value)) { found = t; foundIndex = index; }
            }
          }
          if (!found) { matched = false; break; }
          score += inside === 0 && found.value === term.value ? 2 : 1;
          first = Math.min(first, found.start + inside);
          positions.push(foundIndex);
        }
        if (!matched) continue;
        score += Math.max(0, terms.length * 4 - (Math.max(...positions) - Math.min(...positions)));
        let start = Math.max(0, first - 80), end = Math.min(doc.text.length, start + 320);
        if (start > 0 && /[\uDC00-\uDFFF]/.test(doc.text[start]!)) start--;
        if (end < doc.text.length && /[\uDC00-\uDFFF]/.test(doc.text[end]!)) end++;
        results.push({ key: doc.key, hit: Object.freeze({ ...doc.meta, score, excerpt: doc.text.slice(start,end), byteStart: Buffer.byteLength(doc.text.slice(0,start)), byteEnd: Buffer.byteLength(doc.text.slice(0,end)) }) });
      }
      return Object.freeze(results.sort((a,b) => b.hit.score-a.hit.score || compare(a.key,b.key)).slice(0,limit).map(r=>r.hit));
    },
  });
}
