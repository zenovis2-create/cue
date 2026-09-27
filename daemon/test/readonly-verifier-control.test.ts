import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { measureReadonlyVerifierControl, snapshotReadonlyVerifierControl, verifyReadonlyVerifierControl } from '../src/readonly-verifier-control.js';

const roots:string[]=[];afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture(){const root=mkdtempSync(join(tmpdir(),'cue-readonly-control-'));roots.push(root);const executable=join(root,'tool.exe'),launcher=join(root,'launch.ps1');writeFileSync(executable,'tool');writeFileSync(launcher,'launch');return{root,executable,launcher};}
test('measures an immutable exact control closure and detects drift',()=>{const f=fixture(),value=measureReadonlyVerifierControl(f);expect(verifyReadonlyVerifierControl(value)).toBe(true);writeFileSync(f.launcher,'changed');expect(verifyReadonlyVerifierControl(value)).toBe(false);});
test('rejects accessor proxy extra fields and changed digest',()=>{const f=fixture(),value=measureReadonlyVerifierControl(f),getter={...value};Object.defineProperty(getter,'launcher',{enumerable:true,get(){throw Error('no');}});for(const hostile of [new Proxy(value,{}),{...value,extra:true},{...value,sha256:'0'.repeat(64)},getter])expect(()=>snapshotReadonlyVerifierControl(hostile as any)).toThrow();});
