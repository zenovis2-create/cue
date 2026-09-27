import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertReadonlyRuntimeSeparated } from '../src/readonly-verifier-worker.js';

const roots:string[]=[];afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
test('rejects a writable runtime nested in or containing the approved worktree before launch',()=>{const root=mkdtempSync(join(tmpdir(),'cue-readonly-separation-'));roots.push(root);const worktree=join(root,'worktree'),nested=join(worktree,'runtime');mkdirSync(nested,{recursive:true});expect(()=>assertReadonlyRuntimeSeparated(worktree,nested)).toThrow('overlap');const outer=join(root,'outer');mkdirSync(outer);expect(()=>assertReadonlyRuntimeSeparated(nested,root)).toThrow('overlap');expect(()=>assertReadonlyRuntimeSeparated(worktree,outer)).not.toThrow();});
