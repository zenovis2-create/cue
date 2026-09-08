import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('P12 Electron proof final receipt ordering', () => {
  it('does not emit passed:true when cleanup fails after the UI checks pass', () => {
    const output = mkdtempSync(join(tmpdir(), 'cue-p12-electron-proof-result-'));
    roots.push(output);
    const repo = resolve('..');
    const result = spawnSync(process.execPath, [join(repo, 'scripts', 'p11-electron-proof.mjs')], {
      cwd: repo,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CUE_EVIDENCE_PHASE: 'P12',
        CUE_ELECTRON_PROOF_OUTPUT_DIR: output,
        CUE_ELECTRON_PROOF_FORCE_CLEANUP_FAILURE: '1',
      },
      encoding: 'utf8',
      timeout: 120_000,
    });

    expect(result.status).not.toBe(0);
    expect(existsSync(join(output, 'p12_electron_window_result.json'))).toBe(false);
    const failure = JSON.parse(readFileSync(join(output, 'p12_electron_window_failure.json'), 'utf8'));
    expect(failure.passed).toBe(false);
    expect(failure.error).toContain('forced cleanup failure');
  }, 130_000);
});
