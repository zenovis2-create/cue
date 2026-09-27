import { beforeEach, expect, test, vi } from 'vitest';
import { join, resolve } from 'node:path';

// Resolver decision fixtures only. The actual-byte/real app-server proof remains
// in p10c-manifest.test.ts; these hashes are synthetic observations.
const fixture = vi.hoisted(() => ({files:new Map<string,{hash:string;regular?:boolean}>(), reads:[] as string[]}));
vi.mock('node:fs', () => ({
  statSync(path:string) { const file=fixture.files.get(path); if(!file)throw Error('missing'); return {isFile:()=>file.regular!==false}; },
  readFileSync(path:string) { fixture.reads.push(path); return Buffer.from(fixture.files.get(path)!.hash); },
}));
vi.mock('node:crypto', () => ({
  createHash(algorithm:string) {
    expect(algorithm).toBe('sha256');
    return {update(bytes:Buffer){return {digest(encoding:string){expect(encoding).toBe('hex');return bytes.toString();}};}};
  },
}));
// @ts-expect-error Evidence tooling is plain ESM, not part of the daemon runtime API.
import { PINNED_CODEX_SHA256, resolvePinnedCodex } from '../scripts/pinned-codex.mjs';

const env={APPDATA:resolve('fixture-roaming'),LOCALAPPDATA:resolve('fixture-local')};
const npm=join(env.APPDATA,'npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe');
const standalone=join(env.LOCALAPPDATA,'Programs/OpenAI/Codex/bin/codex.exe');
beforeEach(()=>{fixture.files.clear();fixture.reads.length=0;});

test('prefers exact pinned global bytes and records the selected source',()=>{
  fixture.files.set(npm,{hash:PINNED_CODEX_SHA256});fixture.files.set(standalone,{hash:PINNED_CODEX_SHA256});
  const result=resolvePinnedCodex(env);
  expect(result).toEqual({binary:npm,binarySha256:PINNED_CODEX_SHA256,binarySource:'npm-global'});
  expect(Object.isFrozen(result)).toBe(true);expect(fixture.reads).toEqual([npm]);
});
test.each(['missing','drifted','directory'])('uses independently pinned standalone bytes when global is %s',reason=>{
  if(reason!=='missing')fixture.files.set(npm,{hash:'f'.repeat(64),regular:reason!=='directory'});
  fixture.files.set(standalone,{hash:PINNED_CODEX_SHA256});
  expect(resolvePinnedCodex(env)).toEqual({binary:standalone,binarySha256:PINNED_CODEX_SHA256,binarySource:'standalone'});
});
test('does not trust version labels or a caller-supplied hash when neither artifact matches',()=>{
  fixture.files.set(npm,{hash:'f'.repeat(64)});fixture.files.set(standalone,{hash:'f'.repeat(64)});
  expect(()=>resolvePinnedCodex({...env,CUE_VENDOR_CODEX_SHA256:'f'.repeat(64)})).toThrow('unavailable');
});
test('explicit verified location is honored without reading defaults',()=>{
  const binary=resolve('fixed-toolchain/codex.exe');fixture.files.set(binary,{hash:PINNED_CODEX_SHA256});
  expect(resolvePinnedCodex({...env,CUE_VENDOR_CODEX:binary})).toMatchObject({binary,binarySource:'explicit'});
  expect(fixture.reads).toEqual([binary]);
});
test.each(['missing','drifted'])('explicit %s override never falls back to valid default bytes',reason=>{
  const binary=resolve('explicit/codex.exe');if(reason==='drifted')fixture.files.set(binary,{hash:'f'.repeat(64)});
  fixture.files.set(standalone,{hash:PINNED_CODEX_SHA256});
  expect(()=>resolvePinnedCodex({...env,CUE_VENDOR_CODEX:binary})).toThrow();
  expect(fixture.reads).not.toContain(standalone);
});
test.each(['','relative/codex.exe'])('invalid explicit path refuses before filesystem reads: %j',binary=>{
  expect(()=>resolvePinnedCodex({...env,CUE_VENDOR_CODEX:binary})).toThrow('must be absolute');expect(fixture.reads).toEqual([]);
});
test('missing environment roots never search the current directory',()=>{
  expect(()=>resolvePinnedCodex({})).toThrow('unavailable');expect(fixture.reads).toEqual([]);
});
