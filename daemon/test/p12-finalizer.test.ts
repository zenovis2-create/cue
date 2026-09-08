import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots: string[] = [];
const sha = (value: string): string => createHash('sha256').update(value).digest('hex');
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('P12 one-commit verdict finalizer', () => {
  it('wires the root npm finalizer command to the required argument contract', () => {
    const rootPackage = JSON.parse(readFileSync(resolve('..', 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(rootPackage.scripts?.['evidence:p12:finalize']).toBe(
      'node scripts/p12-finalize.mjs --source-manifest evidence/P12/p12_source_manifest.json --gate-summary evidence/P12/p12_gate_summary.json --security-review evidence/P12/p12_security_review.json --release-review evidence/P12/p12_release_review.json --output evidence/P12/v01_verdict.json',
    );
  });

  it('binds the staged source and exact receipt hashes, then rejects tampering', () => {
    const repo = mkdtempSync(join(tmpdir(), 'cue-p12-finalize-'));
    roots.push(repo);
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr);
    };
    git('init', '--quiet');
    git('config', 'user.email', 'cue@example.invalid');
    git('config', 'user.name', 'Cue Test');
    writeFileSync(join(repo, 'source.txt'), 'base');
    git('add', 'source.txt');
    git('commit', '--quiet', '-m', 'base');
    writeFileSync(join(repo, 'source.txt'), 'candidate');
    git('add', 'source.txt');
    const evidence = join(repo, 'evidence', 'P12');
    mkdirSync(evidence, { recursive: true });
    const receipt = join(evidence, 'full.log');
    writeFileSync(receipt, 'PASS\n');
    const sourceManifest = join(evidence, 'source.json');
    const manifestScript = resolve('..', 'scripts', 'p10c-source-manifest.mjs');
    const manifested = spawnSync(process.execPath, [manifestScript, sourceManifest, '--index'], {
      cwd: resolve('..'), env: { ...process.env, CUE_SOURCE_MANIFEST_REPO: repo }, encoding: 'utf8',
    });
    expect(manifested.status, manifested.stderr).toBe(0);
    const source = JSON.parse(readFileSync(sourceManifest, 'utf8'));
    const gateSummary = join(evidence, 'gates.json');
    writeFileSync(gateSummary, JSON.stringify({
      schema: 'cue.p12.gates.v1', passed: true, sourceTreeSha256: source.sourceTreeSha256,
      gates: { regression: true }, receipts: [{ path: 'evidence/P12/full.log', sha256: sha('PASS\n') }],
    }));
    const review = (role: string) => ({ schema: 'cue.p12.review.v1', role, valid: true, passed: true, sourceTreeSha256: source.sourceTreeSha256, blockers: [] });
    const security = join(evidence, 'security.json');
    const release = join(evidence, 'release.json');
    writeFileSync(security, JSON.stringify(review('security')));
    writeFileSync(release, JSON.stringify(review('release')));
    const output = join(evidence, 'v01_verdict.json');
    const finalizer = resolve('..', 'scripts', 'p12-finalize.mjs');
    const args = [finalizer, '--source-manifest', sourceManifest, '--gate-summary', gateSummary, '--security-review', security, '--release-review', release, '--output', output];
    const result = spawnSync(process.execPath, args, { cwd: resolve('..'), env: { ...process.env, CUE_FINALIZE_REPO: repo }, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const verdict = JSON.parse(readFileSync(output, 'utf8'));
    expect(verdict).toMatchObject({ verdict: 'GO', passed: true, sourceTreeSha256: source.sourceTreeSha256 });
    expect(verdict).not.toHaveProperty('commitSha');

    writeFileSync(receipt, 'TAMPERED\n');
    const tampered = spawnSync(process.execPath, args, { cwd: resolve('..'), env: { ...process.env, CUE_FINALIZE_REPO: repo }, encoding: 'utf8' });
    expect(tampered.status).not.toBe(0);
    expect(tampered.stderr).toContain('receipt hash mismatch');
    expect(existsSync(output)).toBe(false);
  });
});
