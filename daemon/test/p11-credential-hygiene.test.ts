import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const guard = resolve(import.meta.dirname, '../../scripts/credential-path-guard.mjs');
describe('P11 credential path staging guard', () => {
  it('refuses any credential-shaped path staged in the actual repository', () => {
    const checked = spawnSync(process.execPath, [guard], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8' });
    expect(checked.stdout + checked.stderr).toBe('');
    expect(checked.status).toBe(0);
  });
  it('fails for a forced staged credential-home path without reading values, and accepts its removal', () => {
    const root = mkdtempSync(join(tmpdir(), 'cue-p11-staging-'));
    try {
      execFileSync('git', ['init', '-q', root]);
      mkdirSync(join(root, '.codex'));
      writeFileSync(join(root, '.codex', 'auth.json'), '');
      execFileSync('git', ['add', '-f', '.codex/auth.json'], { cwd: root });
      const blocked = spawnSync(process.execPath, [guard], { cwd: root, encoding: 'utf8' });
      expect(blocked.status).toBe(1);
      expect(blocked.stderr).toContain('.codex/auth.json');
      execFileSync('git', ['rm', '--cached', '.codex/auth.json'], { cwd: root });
      const clean = spawnSync(process.execPath, [guard], { cwd: root, encoding: 'utf8' });
      expect(clean.status).toBe(0);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
