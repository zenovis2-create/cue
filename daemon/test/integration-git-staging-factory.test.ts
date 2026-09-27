import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test } from 'vitest';
import { createGitStagingHost } from '../src/orchestration/git-staging-factory.js';

const roots: string[] = [];
const git = (cwd: string, ...args: string[]): string => execFileSync('git.exe', args, { cwd, encoding: 'utf8', windowsHide: true, shell: false });
function fixture() {
  const container = realpathSync.native(mkdtempSync(join(tmpdir(), 'cue-git-stage-'))); roots.push(container);
  const publication = join(container, 'publication'), storage = join(container, 'factory');
  mkdirSync(publication); mkdirSync(storage);
  git(publication, 'init'); git(publication, 'config', 'user.name', 'Cue Test'); git(publication, 'config', 'user.email', 'cue@example.invalid');
  writeFileSync(join(publication, 'tracked.txt'), 'base\n'); git(publication, 'add', 'tracked.txt'); git(publication, 'commit', '-m', 'base');
  return { publication: realpathSync.native(publication), storage: realpathSync.native(storage) };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe.runIf(process.platform === 'win32')('trusted Git staging factory', () => {
  test('inspects exact clean attached publication root and rejects dirty/ignored/attribute/submodule surfaces', () => {
    const f = fixture(), host = createGitStagingHost({ storageRoot: f.storage });
    const clean = host.inspectCleanRoot(f.publication);
    expect(clean).toMatchObject({ worktreeRealpath: f.publication, detached: false, unborn: false, reparseFree: true, trackedModified: [], staged: [], untracked: [], conflicted: [] });
    writeFileSync(join(f.publication, '.gitignore'), 'ignored.txt\n'); git(f.publication, 'add', '.gitignore'); git(f.publication, 'commit', '-m', 'ignore'); writeFileSync(join(f.publication, 'ignored.txt'), 'ignored');
    expect(host.inspectCleanRoot(f.publication).untracked).toContain('ignored.txt');
    rmSync(join(f.publication, 'ignored.txt')); writeFileSync(join(f.publication, '.gitattributes'), '* text\n'); git(f.publication, 'add', '.gitattributes'); git(f.publication, 'commit', '-m', 'attributes');
    expect(() => host.inspectCleanRoot(f.publication)).toThrow('git_staging_attributes_unsupported');
  });

  test('creates exact detached commit once and discovers the durable active root after reopen', () => {
    const f = fixture(), first = createGitStagingHost({ storageRoot: f.storage }), clean = first.inspectCleanRoot(f.publication);
    const input = { attemptId: 'attempt-1', publicationWorktreeRealpath: f.publication, baseCommitId: clean.baseCommitId, cleanSnapshotSha256: 'a'.repeat(64) };
    const created = first.factory.create(input);
    expect(git(created.worktreeRealpath, 'rev-parse', 'HEAD').trim()).toBe(clean.baseCommitId);
    expect(readFileSync(join(created.worktreeRealpath, 'tracked.txt'), 'utf8')).toBe('base\n');
    const reopened = createGitStagingHost({ storageRoot: f.storage });
    expect(reopened.factory.sha256).toBe(first.factory.sha256);
    expect(reopened.factory.create(input)).toEqual(created);
    expect(reopened.factory.cleanup(created)).toMatchObject({ rootAbsent: true, metadataAbsent: true });
    expect(reopened.factory.inspectCleanup(created)).toMatchObject({ rootAbsent: true, metadataAbsent: true });
  }, 20_000);

  test('refuses unknown partial creation instead of automatically retrying', () => {
    const f = fixture(), host = createGitStagingHost({ storageRoot: f.storage }), clean = host.inspectCleanRoot(f.publication), attemptId = 'partial';
    const digest = createHash('sha256').update(attemptId).digest('hex');
    mkdirSync(join(f.storage, digest)); writeFileSync(join(f.storage, digest, 'ownership.json'), '{}');
    expect(() => host.factory.create({ attemptId, publicationWorktreeRealpath: f.publication, baseCommitId: clean.baseCommitId, cleanSnapshotSha256: 'b'.repeat(64) })).toThrow('git_staging_ownership_corrupt');
  });

  test('keeps dirty execution root and metadata when non-force cleanup cannot prove absence', () => {
    const f = fixture(), host = createGitStagingHost({ storageRoot: f.storage }), clean = host.inspectCleanRoot(f.publication);
    const created = host.factory.create({ attemptId: 'dirty', publicationWorktreeRealpath: f.publication, baseCommitId: clean.baseCommitId, cleanSnapshotSha256: 'c'.repeat(64) });
    writeFileSync(join(created.worktreeRealpath, 'tracked.txt'), 'changed\n');
    expect(() => host.factory.cleanup(created)).toThrow('git_staging_git_failed');
    expect(host.factory.inspectCleanup(created)).toMatchObject({ rootAbsent: false, metadataAbsent: false, reason: 'git_staging_cleanup_incomplete' });
  });

  test('reconciles only exact published target bytes and refuses unknown execution changes', () => {
    const f = fixture(), host = createGitStagingHost({ storageRoot: f.storage }), clean = host.inspectCleanRoot(f.publication);
    const created = host.factory.create({ attemptId: 'published', publicationWorktreeRealpath: f.publication, baseCommitId: clean.baseCommitId, cleanSnapshotSha256: 'd'.repeat(64) });
    const replacement = Buffer.from('published\n'), digest = createHash('sha256').update(replacement).digest('hex');
    writeFileSync(join(created.worktreeRealpath, 'tracked.txt'), replacement); writeFileSync(join(f.publication, 'tracked.txt'), replacement);
    expect(host.factory.reconcilePublished).toBeTypeOf('function');
    host.factory.reconcilePublished!(created, [{ relativePath: 'tracked.txt', maxBytes: 1024, publishedSha256: digest, original: Buffer.from('base\n') }]);
    expect(readFileSync(join(created.worktreeRealpath, 'tracked.txt'), 'utf8')).toBe('base\n');
    expect(host.factory.cleanup(created)).toMatchObject({ rootAbsent: true, metadataAbsent: true });

    const second = host.factory.create({ attemptId: 'unknown-file', publicationWorktreeRealpath: f.publication, baseCommitId: clean.baseCommitId, cleanSnapshotSha256: 'e'.repeat(64) });
    writeFileSync(join(second.worktreeRealpath, 'tracked.txt'), replacement); writeFileSync(join(second.worktreeRealpath, 'extra.txt'), 'unknown\n');
    expect(() => host.factory.reconcilePublished!(second, [{ relativePath: 'tracked.txt', maxBytes: 1024, publishedSha256: digest, original: Buffer.from('base\n') }])).toThrow('git_staging_reconcile_diverged');
    expect(readFileSync(join(second.worktreeRealpath, 'tracked.txt'), 'utf8')).toBe('published\n');
  }, 20_000);

  test('accepts no-op and mixed published targets while restoring only the dirty subset', () => {
    const f = fixture(); writeFileSync(join(f.publication, 'second.txt'), 'second-base\n'); git(f.publication, 'add', 'second.txt'); git(f.publication, 'commit', '-m', 'second base');
    const host = createGitStagingHost({ storageRoot: f.storage }), clean = host.inspectCleanRoot(f.publication);
    const created = host.factory.create({ attemptId: 'mixed-noop', publicationWorktreeRealpath: f.publication, baseCommitId: clean.baseCommitId, cleanSnapshotSha256: 'f'.repeat(64) });
    const first = Buffer.from('base\n'), replacement = Buffer.from('second-published\n');
    writeFileSync(join(created.worktreeRealpath, 'second.txt'), replacement); writeFileSync(join(f.publication, 'second.txt'), replacement);
    host.factory.reconcilePublished!(created, [
      { relativePath: 'tracked.txt', maxBytes: 1024, publishedSha256: createHash('sha256').update(first).digest('hex'), original: first },
      { relativePath: 'second.txt', maxBytes: 1024, publishedSha256: createHash('sha256').update(replacement).digest('hex'), original: Buffer.from('second-base\n') },
    ]);
    expect(readFileSync(join(created.worktreeRealpath, 'tracked.txt'), 'utf8')).toBe('base\n');
    expect(readFileSync(join(created.worktreeRealpath, 'second.txt'), 'utf8')).toBe('second-base\n');
    expect(git(created.worktreeRealpath, 'status', '--porcelain')).toBe('');
    expect(host.factory.cleanup(created)).toMatchObject({ rootAbsent: true, metadataAbsent: true });
  }, 20_000);
});
