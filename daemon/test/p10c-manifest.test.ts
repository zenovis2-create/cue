import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe.skipIf(process.platform !== 'win32')('pinned Codex effective tool manifest', () => {
  it('writes the root evidence command to the repository evidence directory', () => {
    const rootPackage = JSON.parse(readFileSync(resolve(process.cwd(), '..', 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(rootPackage.scripts['evidence:p10c:manifest']).toContain('--output evidence/P10C/p10c_manifest_proof.json');
  });

  it('observes only cue_workspace in the actual model request', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-manifest-test-')); roots.push(root);
    const output = join(root, 'manifest.json');
    const script = resolve(import.meta.dirname, '..', 'scripts', 'p10c-manifest-proof.mjs');
    const startedAt = Date.now();
    const run = spawnSync(process.execPath, [script, '--output', output], {
      cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8', timeout: 90_000,
    });
    const elapsedMs = Date.now() - startedAt;
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
    expect(elapsedMs).toBeLessThan(15_000);
    const proof = JSON.parse(readFileSync(output, 'utf8'));
    expect(proof).toMatchObject({
      verdict: 'PASS',
      binarySha256: 'be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde',
      toolNames: ['cue_workspace'],
      hostExecutionTools: [],
    });
    expect(['explicit', 'npm-global', 'standalone']).toContain(proof.binarySource);
    expect(existsSync(proof.binaryPath)).toBe(true);
    expect(proof.executedSnapshotSha256).toBe(proof.binarySha256);
    expect(proof.toolManifest).toEqual([
      expect.objectContaining({ type: 'function', name: 'cue_workspace' }),
    ]);
    expect(proof.requestEndpoint).toMatch(/\/responses$/u);
  }, 100_000);

  it('rejects an explicit unpinned executable without fallback or proof publication', () => {
    const root=mkdtempSync(join(tmpdir(),'cue-manifest-denied-'));roots.push(root);
    const binary=join(root,'codex.exe'),output=join(root,'proof.json');writeFileSync(binary,'not an approved executable');
    const run=spawnSync(process.execPath,[resolve(import.meta.dirname,'../scripts/p10c-manifest-proof.mjs'),'--output',output],{
      encoding:'utf8',timeout:10_000,env:{...process.env,CUE_VENDOR_CODEX:binary,CUE_VENDOR_CODEX_SHA256:'f'.repeat(64)},
    });
    expect(run.status).not.toBe(0);expect(run.stderr).toContain('pinned Codex binary hash mismatch');expect(existsSync(output)).toBe(false);
  });

  it('rejects a changed staged copy before capture or proof publication', () => {
    const root=mkdtempSync(join(tmpdir(),'cue-manifest-stage-drift-'));roots.push(root);
    const script=resolve(import.meta.dirname,'../scripts/p10c-manifest-proof.mjs');
    const driftFs=join(root,'drift-fs.mjs'),copy=join(root,'probe.mjs'),output=join(root,'proof.json');
    writeFileSync(driftFs,`export {constants,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {copyFileSync as copy,writeFileSync} from 'node:fs';
export function copyFileSync(source,target,mode){copy(source,target,mode);writeFileSync(target,'changed staged bytes');}`);
    const source=readFileSync(script,'utf8')
      .replace(/from '(\.\.?\/[^']+)'/gu,(_match,specifier)=>`from ${JSON.stringify(pathToFileURL(resolve(dirname(script),specifier)).href)}`)
      .replace("from 'node:fs'",`from ${JSON.stringify(pathToFileURL(driftFs).href)}`);
    writeFileSync(copy,source);
    const run=spawnSync(process.execPath,[copy,'--output',output],{encoding:'utf8',timeout:20_000});
    expect(run.status).not.toBe(0);expect(run.stderr).toContain('pinned Codex staged binary hash mismatch');expect(existsSync(output)).toBe(false);
  });

  it('never publishes PASS if cleanup fails after the real loopback capture', () => {
    const root=mkdtempSync(join(tmpdir(),'cue-manifest-cleanup-'));roots.push(root);
    const script=resolve(import.meta.dirname,'../scripts/p10c-manifest-proof.mjs');
    const failureFs=join(root,'failure-fs.mjs'),copy=join(root,'probe.mjs'),output=join(root,'proof.json'),captured=join(root,'captured.txt');
    writeFileSync(failureFs,`export {constants,copyFileSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {rmSync as remove} from 'node:fs';
export function rmSync(path,options){remove(path,options);throw Error('forced manifest cleanup failure');}`);
    const source=readFileSync(script,'utf8')
      .replace(/from '(\.\.?\/[^']+)'/gu,(_match,specifier)=>`from ${JSON.stringify(pathToFileURL(resolve(dirname(script),specifier)).href)}`)
      .replace("from 'node:fs'",`from ${JSON.stringify(pathToFileURL(failureFs).href)}`)
      .replace('  proof = {',`  writeFileSync(${JSON.stringify(captured)},'captured');\n  proof = {`);
    writeFileSync(copy,source);
    const run=spawnSync(process.execPath,[copy,'--output',output],{encoding:'utf8',timeout:90_000});
    expect(run.status).not.toBe(0);expect(run.stderr).toContain('forced manifest cleanup failure');
    expect(existsSync(captured)).toBe(true);expect(existsSync(output)).toBe(false);
  },100_000);
});
