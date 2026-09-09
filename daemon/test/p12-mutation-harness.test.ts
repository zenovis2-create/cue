import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
function cueProfileCount(): number {
  const script = `$base='Registry::HKEY_CURRENT_USER\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppContainer\\Mappings'; if(!(Test-Path $base)){Write-Output 0; exit}; @(Get-ChildItem $base | ForEach-Object {$p=Get-ItemProperty $_.PSPath; if($p.Moniker -like 'cue.worker.*') { $_ }}).Count`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('failed to query Cue AppContainer profiles');
  return Number(result.stdout.trim());
}
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });

describe.skipIf(process.platform !== 'win32')('P12 mutation harness', () => {
  it('proves fail-fast, lifecycle, and parent-death tests detect security regressions in disposable copies', () => {
    const output = mkdtempSync(join(tmpdir(), 'cue-p12-mutation-output-'));
    roots.push(output);
    const protectedSources = [
      resolve('src/host-codex-controller.ts'),
      resolve('../app/core.mjs'),
      resolve('src/appcontainer-launch.ps1'),
    ];
    const before = protectedSources.map(sha);
    const profilesBefore = cueProfileCount();
    const result = spawnSync(process.execPath, [resolve('scripts/p12-mutation-proof.mjs')], {
      cwd: resolve('.'),
      env: { ...process.env, NODE_ENV: 'test', CUE_MUTATION_OUTPUT_DIR: output },
      encoding: 'utf8',
      timeout: 120_000,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const receipt = JSON.parse(readFileSync(join(output, 'p12_mutation_result.json'), 'utf8'));
    expect(receipt.verdict).toBe('PASS');
    expect(receipt.mutations).toHaveLength(3);
    expect(receipt.mutations.every((entry: { detected: boolean }) => entry.detected)).toBe(true);
    expect(protectedSources.map(sha)).toEqual(before);
    expect(cueProfileCount()).toBe(profilesBefore);
  }, 120_000);
});
