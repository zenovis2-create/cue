import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
      binarySha256: 'cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4',
      toolNames: ['cue_workspace'],
      hostExecutionTools: [],
    });
    expect(proof.toolManifest).toEqual([
      expect.objectContaining({ type: 'function', name: 'cue_workspace' }),
    ]);
    expect(proof.requestEndpoint).toMatch(/\/responses$/u);
  }, 100_000);
});
