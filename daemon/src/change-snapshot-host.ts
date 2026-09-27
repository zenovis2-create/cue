import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { types } from 'node:util';
import { runProcessSync } from './process-launch.js';

const VERSION = 'cue-change-snapshot-v1' as const;
const COMPARE_WRITE_VERSION = 'cue-change-snapshot-v2' as const;
const REVIEWED_HELPER_SHA256 = '82ff0f80ecb63293de0eed39296bf66ad51b4cfdeee2d8d7aaea062fae80d07e';
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const configuredHelperPath = join(moduleDirectory, '..', 'native', 'change-snapshot', 'change-snapshot.exe');
const configuredManifestPath = join(moduleDirectory, '..', 'native', 'change-snapshot', 'manifest.json');
let helperPath = configuredHelperPath, loadedHelperHash: string | null = null;
try {
  const manifest = JSON.parse(readFileSync(configuredManifestPath, 'utf8')) as unknown;
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw Error('manifest');
  const value = manifest as Record<string, unknown>, artifact = value.artifact as Record<string, unknown> | undefined;
  if (value.schema !== 'cue-native-helper-manifest-v1' || value.protocol !== VERSION || value.compareWriteProtocol !== COMPARE_WRITE_VERSION || !artifact
    || artifact.path !== 'change-snapshot.exe' || artifact.platform !== 'win32' || artifact.arch !== 'x64'
    || artifact.sha256 !== REVIEWED_HELPER_SHA256) throw Error('manifest');
  helperPath = realpathSync.native(configuredHelperPath);
  const actual = createHash('sha256').update(readFileSync(helperPath)).digest('hex');
  if (actual !== REVIEWED_HELPER_SHA256) throw Error('digest');
  loadedHelperHash = actual;
} catch {}
const identityPattern = /^[0-9a-f]{16}$/;
const fileIdPattern = /^[0-9a-f]{32}$/;

export interface ChangeSnapshotIdentity { readonly volumeSerial: string; readonly fileId: string }
export type ChangeSnapshotResult = Readonly<{
  path: string; state: 'ok' | 'absent' | 'unknown' | 'unavailable'; reason?: string;
  identity?: ChangeSnapshotIdentity; byteLength?: number; sha256?: string; bytes?: Buffer;
}>;
export type RootIdentityResult = Readonly<{ state: 'ok'; identity: ChangeSnapshotIdentity } | { state: 'unknown' | 'unavailable'; reason: string }>;
export type RelativeSnapshotResponse = Readonly<{ state: 'ok'; rootIdentity: ChangeSnapshotIdentity; results: readonly ChangeSnapshotResult[] } | { state: 'unknown' | 'unavailable'; reason: string }>;
export type ChangeSnapshotHelperMetadata = Readonly<{ protocol: typeof VERSION; helperSha256: string; helperPath: string }>;
export type CompareWriteReceipt = Readonly<{ identity: ChangeSnapshotIdentity; byteLength: number; sha256: string }>;
export type CompareWriteExistingResult = Readonly<
  | { state: 'committed'; rootIdentity: ChangeSnapshotIdentity; before: CompareWriteReceipt; after: CompareWriteReceipt }
  | { state: 'contention' | 'unknown'; reason: string }
>;

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
}
function identity(value: unknown): ChangeSnapshotIdentity | null {
  const r = record(value); if (!r || Reflect.ownKeys(r).length !== 2 || typeof r.volumeSerial !== 'string' || typeof r.fileId !== 'string' || !identityPattern.test(r.volumeSerial) || !fileIdPattern.test(r.fileId)) return null;
  return Object.freeze({ volumeSerial: r.volumeSerial as string, fileId: r.fileId as string });
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean { const actual=Reflect.ownKeys(value); return actual.length===keys.length && keys.every(key=>Object.hasOwn(value,key)); }
function targets(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || types.isProxy(value) || value.length===0 || value.length>64) return null;
  const descriptors=Object.getOwnPropertyDescriptors(value) as unknown as Record<PropertyKey,PropertyDescriptor>, keys=Reflect.ownKeys(descriptors), lengthDescriptor=descriptors.length;
  if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor,'value') || typeof lengthDescriptor.value!=='number') return null;
  const length=lengthDescriptor.value;
  if (!length || keys.length!==length+1 || keys.some(key=>key!=='length' && (typeof key!=='string' || !/^\d+$/.test(key)))) return null;
  const snapshot:string[]=[];
  for(let index=0;index<length;index++){const descriptor=descriptors[String(index)]; if(!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor,'value') || typeof descriptor.value!=='string' || descriptor.value.length===0 || descriptor.value.length>32768) return null; snapshot.push(descriptor.value);}
  return Object.freeze(snapshot);
}
function frozen<T>(value: T): T { if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) { for (const child of Object.values(value)) frozen(child); Object.freeze(value); } return value; }
function unavailable(reason: string): RootIdentityResult { return Object.freeze({ state: 'unavailable', reason }); }
const digestPattern = /^[0-9a-f]{64}$/;
const reservedComponentPattern = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
function strictRelativePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 32768 || value.includes('\0') || value.includes(':') || value.startsWith('/') || value.startsWith('\\')) return false;
  return value.replaceAll('/', '\\').split('\\').every(component => component !== '' && component !== '.' && component !== '..' && !component.endsWith('.') && !component.endsWith(' ') && !reservedComponentPattern.test(component));
}
function receipt(value: unknown, maxBytes: number): CompareWriteReceipt | null {
  const r=record(value); if(!r || !exactKeys(r,['identity','byteLength','sha256'])) return null;
  const id=identity(r.identity), byteLength=r.byteLength, sha256=r.sha256;
  if(!id || !Number.isSafeInteger(byteLength) || (byteLength as number)<0 || (byteLength as number)>maxBytes || typeof sha256!=='string' || !digestPattern.test(sha256)) return null;
  return frozen({identity:id,byteLength:byteLength as number,sha256});
}

function invoke(payload: Record<string, unknown>): Record<string, unknown> | null {
  try {
    if (!loadedHelperHash) return null;
    if (createHash('sha256').update(readFileSync(helperPath)).digest('hex') !== loadedHelperHash) return null;
    const result = runProcessSync(helperPath, [], { input: JSON.stringify(payload), encoding: 'utf8', windowsHide: true, shell: false, timeout: 5000, maxBuffer: 24 * 1024 * 1024 });
    if (result.error || result.status !== 0 || result.signal || result.stderr !== '' || Buffer.byteLength(result.stdout) > 24 * 1024 * 1024) return null;
    if (createHash('sha256').update(readFileSync(helperPath)).digest('hex') !== loadedHelperHash) return null;
    return record(JSON.parse(result.stdout));
  } catch { return null; }
}

export function identifyChangeSnapshotRoot(root: string): RootIdentityResult {
  if (process.platform !== 'win32') return unavailable('platform');
  if (typeof root !== 'string' || root.length === 0 || root.length > 32768 || root.includes('\0')) return unavailable('request');
  const nonce = randomUUID(), raw = invoke({ version: VERSION, nonce, operation: 'identifyRoot', root });
  if (!raw || !exactKeys(raw,['version','nonce','state','rootIdentity']) || raw.version !== VERSION || raw.nonce !== nonce || raw.state !== 'ok') return Object.freeze({ state: 'unknown', reason: 'helper' });
  const id = identity(raw.rootIdentity); return id ? Object.freeze({ state: 'ok', identity: id }) : Object.freeze({ state: 'unknown', reason: 'protocol' });
}

export function snapshotRelativeNative(input: { root: string; expectedRoot: ChangeSnapshotIdentity; targets: readonly string[]; maxBytes: number }): RelativeSnapshotResponse {
  if (process.platform !== 'win32') return Object.freeze({ state: 'unavailable', reason: 'platform' });
  if (!input || types.isProxy(input)) return Object.freeze({ state: 'unavailable', reason: 'request' });
  const fields=record(input); if(!fields || !exactKeys(fields,['root','expectedRoot','targets','maxBytes'])) return Object.freeze({state:'unavailable',reason:'request'});
  const id = identity(fields.expectedRoot), targetSnapshot=targets(fields.targets), root=fields.root, maxBytes=fields.maxBytes;
  if (typeof root !== 'string' || root.length === 0 || root.length > 32768 || !id || !targetSnapshot || !Number.isSafeInteger(maxBytes) || (maxBytes as number) < 1 || (maxBytes as number) > 16 * 1024 * 1024 || targetSnapshot.length * (maxBytes as number) > 16 * 1024 * 1024) return Object.freeze({ state: 'unavailable', reason: 'request' });
  const nonce = randomUUID(), raw = invoke({ version: VERSION, nonce, operation: 'snapshotRelative', root, expectedRoot: id, targets: targetSnapshot, maxBytes });
  if (!raw || raw.version !== VERSION || raw.nonce !== nonce || !['ok', 'unknown', 'unavailable'].includes(String(raw.state))) return Object.freeze({ state: 'unknown', reason: 'helper' });
  if (raw.state !== 'ok') return exactKeys(raw,['version','nonce','state','reason']) && typeof raw.reason==='string' ? Object.freeze({ state: raw.state as 'unknown' | 'unavailable', reason:raw.reason }) : Object.freeze({state:'unknown',reason:'protocol'});
  if(!exactKeys(raw,['version','nonce','state','rootIdentity','results'])) return Object.freeze({state:'unknown',reason:'protocol'});
  const rootIdentity = identity(raw.rootIdentity); if (!rootIdentity || rootIdentity.volumeSerial!==id.volumeSerial || rootIdentity.fileId!==id.fileId || !Array.isArray(raw.results) || types.isProxy(raw.results) || raw.results.length !== targetSnapshot.length) return Object.freeze({ state: 'unknown', reason: 'protocol' });
  const results: ChangeSnapshotResult[] = [];
  for (let index = 0; index < raw.results.length; index++) {
    const r = record(raw.results[index]); if (!r || r.path !== targetSnapshot[index] || !['ok','absent','unknown','unavailable'].includes(String(r.state))) return Object.freeze({ state: 'unknown', reason: 'protocol' });
    if (r.state !== 'ok') { const keys=typeof r.reason==='string'?['path','state','reason']:['path','state']; if(!exactKeys(r,keys)) return Object.freeze({state:'unknown',reason:'protocol'}); results.push({ path:r.path as string, state:r.state as 'absent'|'unknown'|'unavailable', ...(typeof r.reason === 'string' ? {reason:r.reason} : {}) }); continue; }
    if(!exactKeys(r,['path','state','identity','byteLength','sha256','bytes'])) return Object.freeze({state:'unknown',reason:'protocol'});
    const targetIdentity = identity(r.identity), length = r.byteLength, digest = r.sha256, encoded = r.bytes;
    if (!targetIdentity || !Number.isSafeInteger(length) || (length as number) < 0 || (length as number) > (maxBytes as number) || typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest) || typeof encoded !== 'string') return Object.freeze({ state: 'unknown', reason: 'protocol' });
    const bytes = Buffer.from(encoded, 'base64'); if (bytes.length !== length || bytes.toString('base64') !== encoded || createHash('sha256').update(bytes).digest('hex') !== digest) return Object.freeze({ state: 'unknown', reason: 'protocol' });
    results.push({ path:r.path as string, state:'ok', identity:targetIdentity, byteLength:length as number, sha256:digest, bytes });
  }
  if(results.reduce((total,item)=>total+(item.byteLength??0),0)>16*1024*1024) return Object.freeze({state:'unknown',reason:'protocol'});
  return frozen({ state:'ok', rootIdentity, results });
}

export function compareWriteExistingNative(input: {
  root: string;
  expectedRoot: ChangeSnapshotIdentity;
  target: string;
  expected: CompareWriteReceipt;
  replacement: Buffer;
  maxBytes: number;
}): CompareWriteExistingResult {
  if (process.platform !== 'win32') return Object.freeze({state:'unknown',reason:'platform'});
  if (!input || types.isProxy(input)) return Object.freeze({state:'contention',reason:'request'});
  const fields=record(input);
  if(!fields || !exactKeys(fields,['root','expectedRoot','target','expected','replacement','maxBytes'])) return Object.freeze({state:'contention',reason:'request'});
  const root=fields.root, expectedRoot=identity(fields.expectedRoot), target=fields.target, maxBytes=fields.maxBytes;
  if(typeof root!=='string' || root.length===0 || root.length>32768 || root.includes('\0') || !expectedRoot || !strictRelativePath(target)
    || !Number.isSafeInteger(maxBytes) || (maxBytes as number)<1 || (maxBytes as number)>16*1024*1024) return Object.freeze({state:'contention',reason:'request'});
  const expected=receipt(fields.expected,maxBytes as number), replacementValue=fields.replacement;
  if(!expected || types.isProxy(replacementValue) || !Buffer.isBuffer(replacementValue) || replacementValue.length>(maxBytes as number)) return Object.freeze({state:'contention',reason:'request'});
  const replacement=Buffer.from(replacementValue), replacementSha256=createHash('sha256').update(replacement).digest('hex'), nonce=randomUUID();
  const raw=invoke({version:COMPARE_WRITE_VERSION,nonce,operation:'compareWriteExisting',root,expectedRoot,target,expected,
    replacement:replacement.toString('base64'),replacementByteLength:replacement.length,replacementSha256,maxBytes});
  if(!raw) return Object.freeze({state:'unknown',reason:'helper'});
  if(raw.version!==COMPARE_WRITE_VERSION || raw.nonce!==nonce || !['committed','contention','unknown'].includes(String(raw.state))) return Object.freeze({state:'unknown',reason:'protocol'});
  if(raw.state!=='committed') return exactKeys(raw,['version','nonce','state','reason']) && typeof raw.reason==='string' && raw.reason.length>0
    ? Object.freeze({state:raw.state as 'contention'|'unknown',reason:raw.reason}) : Object.freeze({state:'unknown',reason:'protocol'});
  if(!exactKeys(raw,['version','nonce','state','rootIdentity','before','after'])) return Object.freeze({state:'unknown',reason:'protocol'});
  const rootIdentity=identity(raw.rootIdentity), before=receipt(raw.before,maxBytes as number), after=receipt(raw.after,maxBytes as number);
  if(!rootIdentity || rootIdentity.volumeSerial!==expectedRoot.volumeSerial || rootIdentity.fileId!==expectedRoot.fileId || !before || !after
    || before.identity.volumeSerial!==expected.identity.volumeSerial || before.identity.fileId!==expected.identity.fileId || before.byteLength!==expected.byteLength || before.sha256!==expected.sha256
    || after.identity.volumeSerial!==before.identity.volumeSerial || after.identity.fileId!==before.identity.fileId || after.byteLength!==replacement.length || after.sha256!==replacementSha256) return Object.freeze({state:'unknown',reason:'protocol'});
  return frozen({state:'committed',rootIdentity,before,after});
}

const helperMetadata: ChangeSnapshotHelperMetadata | null = loadedHelperHash === REVIEWED_HELPER_SHA256
  ? Object.freeze({ protocol: VERSION, helperSha256: loadedHelperHash, helperPath }) : null;
export function getChangeSnapshotHelperMetadata(): ChangeSnapshotHelperMetadata | null { return helperMetadata; }
export const changeSnapshotHelper = Object.freeze({ path: helperPath, sha256: loadedHelperHash, timeoutMs: 5000, outputLimitBytes: 24 * 1024 * 1024 });
