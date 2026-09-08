import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots: string[] = [];
function cueProfileCount(): number {
  const script = `$base='Registry::HKEY_CURRENT_USER\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppContainer\\Mappings'; if(!(Test-Path $base)){Write-Output 0; exit}; @(...(Get-ChildItem $base | ForEach-Object {$p=Get-ItemProperty $_.PSPath; if($p.Moniker -like 'cue.worker.*') { $_ }})).Count`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('failed to query Cue AppContainer profiles');
  return Number(result.stdout.trim());
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('P12 stop-canary path ownership', () => {
  it('rejects a caller-owned non-empty root without deleting it', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p12-stop-owned-'));
    roots.push(root);
    const sentinel = join(root, 'keep.txt');
    writeFileSync(sentinel, 'keep');

    const result = spawnSync(process.execPath, [resolve('scripts/p10c-stop-canary.mjs')], {
      cwd: resolve('.'),
      env: { ...process.env, NODE_ENV: 'test', CUE_EVIDENCE_PHASE: 'P12', CUE_STOP_ROOT: root },
      encoding: 'utf8',
      timeout: 30_000,
    });

    expect(result.status).not.toBe(0);
    expect(existsSync(sentinel)).toBe(true);
    expect(`${result.stdout}\n${result.stderr}`).toContain('P12 stop fixture paths are harness-owned');
  });

  it('reaps live sessions and emits FAIL after a forced core close failure', () => {
    const output = mkdtempSync(join(tmpdir(), 'cue-p12-stop-output-'));
    roots.push(output);
    const result = spawnSync(process.execPath, [resolve('scripts/p10c-stop-canary.mjs')], {
      cwd: resolve('.'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CUE_EVIDENCE_PHASE: 'P12',
        CUE_STOP_OUTPUT_DIR: output,
        CUE_TEST_STOP_CLOSE_FAILURE: '1',
      },
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(result.status).toBe(2);
    const receipt = JSON.parse(readFileSync(join(output, 'p12_stop_result.json'), 'utf8'));
    expect(receipt).toMatchObject({ verdict: 'FAIL', checks: { fixturePathsRemoved: true } });
    expect(receipt.failure).toContain('forced core.close failure');
    expect(receipt.sessions.length).toBeGreaterThanOrEqual(3);
    expect(receipt.sessions.some((session: { aliveBeforeStop: boolean }) => session.aliveBeforeStop)).toBe(true);
    expect(receipt.sessions.every((session: { aliveAfterStop: boolean }) => session.aliveAfterStop === false)).toBe(true);
  }, 60_000);

  it('does not leak an AppContainer profile after a normal stop', () => {
    const output = mkdtempSync(join(tmpdir(), 'cue-p12-stop-profile-output-'));
    roots.push(output);
    const before = cueProfileCount();
    const result = spawnSync(process.execPath, [resolve('scripts/p10c-stop-canary.mjs')], {
      cwd: resolve('.'),
      env: { ...process.env, NODE_ENV: 'test', CUE_EVIDENCE_PHASE: 'P12', CUE_STOP_OUTPUT_DIR: output },
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(cueProfileCount()).toBe(before);
  }, 60_000);
});
