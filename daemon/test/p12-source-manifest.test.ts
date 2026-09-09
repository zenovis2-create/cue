import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots: string[] = [];
const sha = (value: string): string => createHash('sha256').update(value).digest('hex');
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('P12 source manifest binding', () => {
  it('hashes staged blobs rather than dirty working files and excludes evidence', () => {
    const repo = mkdtempSync(join(tmpdir(), 'cue-p12-manifest-index-'));
    roots.push(repo);
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr);
    };
    git('init', '--quiet');
    git('config', 'user.email', 'cue@example.invalid');
    git('config', 'user.name', 'Cue Test');
    mkdirSync(join(repo, 'evidence'));
    writeFileSync(join(repo, 'source.txt'), 'committed');
    writeFileSync(join(repo, 'delete-me.txt'), 'old');
    writeFileSync(join(repo, 'evidence', 'old.txt'), 'ignored evidence');
    git('add', '.');
    git('commit', '--quiet', '-m', 'fixture');
    writeFileSync(join(repo, 'source.txt'), 'staged');
    writeFileSync(join(repo, 'staged-only.txt'), 'staged-only');
    git('add', 'source.txt', 'staged-only.txt');
    git('rm', '--quiet', 'delete-me.txt');
    writeFileSync(join(repo, 'source.txt'), 'dirty-after-stage');
    writeFileSync(join(repo, 'untracked.txt'), 'untracked');
    writeFileSync(join(repo, 'evidence', 'new.txt'), 'new evidence');

    const output = join(repo, 'manifest.json');
    const script = resolve('..', 'scripts', 'p10c-source-manifest.mjs');
    const dirtyResult = spawnSync(process.execPath, [script, output, '--index'], {
      cwd: resolve('..'),
      env: { ...process.env, CUE_SOURCE_MANIFEST_REPO: repo },
      encoding: 'utf8',
    });
    expect(dirtyResult.status).not.toBe(0);
    expect(dirtyResult.stderr).toContain('unstaged or untracked source drift');

    writeFileSync(join(repo, 'source.txt'), 'staged');
    unlinkSync(join(repo, 'untracked.txt'));
    rmSync(output, { force: true });
    const result = spawnSync(process.execPath, [script, output, '--index'], {
      cwd: resolve('..'),
      env: { ...process.env, CUE_SOURCE_MANIFEST_REPO: repo },
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    const manifest = JSON.parse(readFileSync(output, 'utf8'));
    expect(manifest.mode).toBe('index');
    expect(manifest.files.map((file: { path: string }) => file.path)).toEqual(['source.txt', 'staged-only.txt']);
    expect(manifest.files[0]).toMatchObject({ path: 'source.txt', sha256: sha('staged') });
    expect(manifest.files[1]).toMatchObject({ path: 'staged-only.txt', sha256: sha('staged-only') });

    git('commit', '--quiet', '-m', 'candidate');
    const headOutput = join(repo, 'head-manifest.json');
    const headResult = spawnSync(process.execPath, [script, headOutput, '--head'], {
      cwd: resolve('..'),
      env: { ...process.env, CUE_SOURCE_MANIFEST_REPO: repo },
      encoding: 'utf8',
    });
    expect(headResult.status, headResult.stderr).toBe(0);
    const headManifest = JSON.parse(readFileSync(headOutput, 'utf8'));
    expect(headManifest.mode).toBe('head');
    expect(headManifest.sourceTreeSha256).toBe(manifest.sourceTreeSha256);
  });
});
