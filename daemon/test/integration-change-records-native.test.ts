import { afterEach, describe, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { closeSync, linkSync, mkdtempSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { changeSnapshotHelper, compareWriteExistingNative, identifyChangeSnapshotRoot, snapshotRelativeNative } from '../src/change-snapshot-host.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive:true, force:true }); });
function root() { const value=mkdtempSync(join(tmpdir(),'cue-native-snapshot-')); roots.push(value); return value; }
function approved(value:string) { const result=identifyChangeSnapshotRoot(value); expect(result.state).toBe('ok'); if(result.state!=='ok') throw Error(result.reason); return result.identity; }

describe.runIf(process.platform==='win32')('real Windows native change snapshot boundary', () => {
  test('reads a regular file and reports bounded bytes, SHA-256, and full FILE_ID_INFO', () => {
    const work=root(), bytes=Buffer.from('journal preimage'); writeFileSync(join(work,'a.txt'),bytes);
    const expectedRoot=approved(work), result=snapshotRelativeNative({root:work,expectedRoot,targets:['a.txt'],maxBytes:1024});
    expect(result.state).toBe('ok'); if(result.state!=='ok') return;
    expect(result.rootIdentity).toEqual(expectedRoot); expect(result.results[0]).toMatchObject({state:'ok',path:'a.txt',byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    expect(result.results[0]?.identity).toMatchObject({volumeSerial:expect.stringMatching(/^[0-9a-f]{16}$/),fileId:expect.stringMatching(/^[0-9a-f]{32}$/)});
    expect(result.results[0]?.bytes).toEqual(bytes);
  });
  test('establishes absence and refuses cap+1 bytes without returning content', () => {
    const work=root(), expectedRoot=approved(work); writeFileSync(join(work,'large.bin'),Buffer.alloc(33,7));
    const result=snapshotRelativeNative({root:work,expectedRoot,targets:['missing','large.bin'],maxBytes:32}); expect(result.state).toBe('ok'); if(result.state!=='ok') return;
    expect(result.results[0]).toMatchObject({state:'absent'}); expect(result.results[1]).toMatchObject({state:'unavailable',reason:'byte-limit'}); expect(result.results[1]).not.toHaveProperty('bytes');
  });
  test('returns exact empty bytes and rejects cleaned traversal before opening another target', () => {
    const work=root(); mkdirSync(join(work,'a')); writeFileSync(join(work,'empty'),Buffer.alloc(0)); writeFileSync(join(work,'other'),'unapproved'); const expectedRoot=approved(work);
    const result=snapshotRelativeNative({root:work,expectedRoot,targets:['empty','a\\..\\other'],maxBytes:64}); expect(result.state).toBe('ok'); if(result.state!=='ok') return;
    expect(result.results[0]).toMatchObject({state:'ok',byteLength:0,sha256:createHash('sha256').update(Buffer.alloc(0)).digest('hex'),bytes:Buffer.alloc(0)});
    expect(result.results[1]).toMatchObject({state:'unavailable',reason:'invalid-path'}); expect(result.results[1]).not.toHaveProperty('bytes');
  });
  test('snapshots accessor-backed input once and rejects requests beyond the total byte bound', () => {
    const work=root(); writeFileSync(join(work,'approved'),'approved'); writeFileSync(join(work,'other'),'other'); const expectedRoot=approved(work); let reads=0;
    const values:string[]=[]; Object.defineProperty(values,0,{enumerable:true,get(){reads++; return reads===1?'approved':'other';}}); Object.defineProperty(values,'length',{value:1});
    expect(snapshotRelativeNative({root:work,expectedRoot,targets:values,maxBytes:64})).toMatchObject({state:'unavailable',reason:'request'}); expect(reads).toBe(0);
    expect(snapshotRelativeNative({root:work,expectedRoot,targets:['approved','other'],maxBytes:9*1024*1024})).toMatchObject({state:'unavailable',reason:'request'});
  });
  test('rejects target and ancestor junction traversal, including a swapped ancestor', () => {
    const work=root(), outside=root(); writeFileSync(join(outside,'value.txt'),'outside'); mkdirSync(join(work,'inside')); writeFileSync(join(work,'inside','value.txt'),'inside');
    symlinkSync(outside,join(work,'direct-junction'),'junction'); const expectedRoot=approved(work);
    renameSync(join(work,'inside'),join(work,'old-inside')); symlinkSync(outside,join(work,'inside'),'junction');
    const result=snapshotRelativeNative({root:work,expectedRoot,targets:['direct-junction\\value.txt','inside\\value.txt'],maxBytes:100}); expect(result.state).toBe('ok'); if(result.state!=='ok') return;
    expect(result.results.every(v=>v.state==='unknown'||v.state==='unavailable')).toBe(true); expect(result.results.every(v=>v.bytes===undefined)).toBe(true);
  });
  test('rejects a root reached through a junction and root substitution after preapproval', () => {
    const parent=root(), real=join(parent,'real'), replacement=join(parent,'replacement'), alias=join(parent,'alias'); mkdirSync(real); mkdirSync(replacement); symlinkSync(real,alias,'junction');
    expect(identifyChangeSnapshotRoot(alias).state).not.toBe('ok');
    const identity=approved(real); renameSync(real,join(parent,'old')); renameSync(replacement,real);
    const result=snapshotRelativeNative({root:real,expectedRoot:identity,targets:['missing'],maxBytes:10}); expect(result).toMatchObject({state:'unavailable',reason:'root-identity-or-request'});
  });
  test('rejects hard links, sparse files, ADS, absolute, traversal, and directories', () => {
    const work=root(), outside=root(); writeFileSync(join(work,'base'),'x'); linkSync(join(work,'base'),join(work,'hard')); writeFileSync(join(work,'sparse'),Buffer.alloc(1)); mkdirSync(join(work,'directory'));
    const sparse=spawnSync('fsutil.exe',['sparse','setflag',join(work,'sparse')],{encoding:'utf8',windowsHide:true}); expect(sparse.status).toBe(0);
    const expectedRoot=approved(work), result=snapshotRelativeNative({root:work,expectedRoot,targets:['hard','sparse','base:stream','..\\escape',join(outside,'x'),'directory'],maxBytes:100}); expect(result.state).toBe('ok'); if(result.state!=='ok') return;
    expect(result.results.every(v=>v.state==='unknown'||v.state==='unavailable')).toBe(true); expect(result.results.every(v=>v.bytes===undefined)).toBe(true);
  });
  test('exclusive target sharing returns unknown while another handle is open, then succeeds', () => {
    const work=root(); writeFileSync(join(work,'locked'),'stable'); const expectedRoot=approved(work), handle=openSync(join(work,'locked'),'r+');
    try { expect(snapshotRelativeNative({root:work,expectedRoot,targets:['locked'],maxBytes:100})).toMatchObject({state:'ok',results:[{state:'unknown'}]}); }
    finally { closeSync(handle); }
    expect(snapshotRelativeNative({root:work,expectedRoot,targets:['locked'],maxBytes:100})).toMatchObject({state:'ok',results:[{state:'ok'}]});
  });
  test('host owns one fixed hashed executable and bounded protocol settings', () => {
    expect(changeSnapshotHelper.path).toMatch(/daemon[\\/]native[\\/]change-snapshot[\\/]change-snapshot\.exe$/i); expect(changeSnapshotHelper.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(changeSnapshotHelper).toMatchObject({timeoutMs:5000,outputLimitBytes:24*1024*1024}); expect(Object.keys(changeSnapshotHelper)).not.toContain('executable');
  });
  test('compare/write commits one winner and a stale preimage cannot overwrite it', () => {
    const work=root(), path=join(work,'nested','value.json'); mkdirSync(join(work,'nested')); writeFileSync(path,'P');
    const expectedRoot=approved(work), snapshot=snapshotRelativeNative({root:work,expectedRoot,targets:['nested\\value.json'],maxBytes:1024});
    expect(snapshot.state).toBe('ok'); if(snapshot.state!=='ok'||snapshot.results[0]?.state!=='ok') throw Error('preimage');
    const preimage=snapshot.results[0], expected={identity:preimage.identity!,byteLength:preimage.byteLength!,sha256:preimage.sha256!};
    const winner=compareWriteExistingNative({root:work,expectedRoot,target:'nested\\value.json',expected,replacement:Buffer.from('A'),maxBytes:1024});
    expect(winner).toMatchObject({state:'committed',rootIdentity:expectedRoot,before:expected,after:{identity:expected.identity,byteLength:1,sha256:createHash('sha256').update('A').digest('hex')}});
    const loser=compareWriteExistingNative({root:work,expectedRoot,target:'nested\\value.json',expected,replacement:Buffer.from('B'),maxBytes:1024});
    expect(loser).toMatchObject({state:'contention',reason:'preimage-mismatch'}); expect(readFileSync(path,'utf8')).toBe('A');
  });
});
