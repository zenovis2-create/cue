import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { measureArtifactSet } from '../src/measurement-artifacts.js';
import { subjectDigest } from '../src/measurement-subject.js';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function files() { const root = mkdtempSync(join(tmpdir(), 'cue-artifacts-')); roots.push(root); const a = join(root, 'client.cjs'), b = join(root, 'launcher.ps1'); writeFileSync(a, 'client-v1'); writeFileSync(b, 'launcher-v1'); return { root, a, b }; }
describe('actual composite measurement artifacts', () => {
  it('bounds reads by the initial size when a writer continuously appends', async () => {
    const { a } = files(); writeFileSync(a, 'x'); let reads = 0;
    vi.resetModules();
    vi.doMock('node:fs', async () => {
      const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
      return { ...fs, readSync: (...args: unknown[]) => {
        if (++reads > 8) throw Error('test_unbounded_read');
        fs.appendFileSync(a, 'x');
        return Reflect.apply(fs.readSync, fs, args);
      } };
    });
    try {
      const measured = await import('../src/measurement-artifacts.js');
      expect(() => measured.measureArtifactSet([{ id: 'growing', path: a }])).toThrow('artifact_set_changed');
      expect(reads).toBeLessThanOrEqual(2);
    } finally { vi.doUnmock('node:fs'); vi.resetModules(); }
  });
  it('binds every labeled component and invalidates the existing subject on drift', () => {
    const { a, b } = files(), input = [{ id: 'client', path: a }, { id: 'launcher', path: b }];
    const first = measureArtifactSet(input);
    expect(measureArtifactSet([...input].reverse())).toEqual(first);
    const subject = { toolBinarySha256: 'a'.repeat(64), adapterSha256: first.sha256, enforcementSha256: 'b'.repeat(64), boundaryProviderId: 'fixture', boundaryPolicySha256: 'c'.repeat(64), boundaryContractVersion: 'v1', probeSuiteSha256: 'd'.repeat(64), runtimeArtifactSha256: 'e'.repeat(64), osBuild: 'fixture-os' };
    writeFileSync(b, 'launcher-v2'); const second = measureArtifactSet(input);
    expect(second.sha256).not.toBe(first.sha256);
    expect(subjectDigest({ ...subject, adapterSha256: second.sha256 })).not.toBe(subjectDigest(subject));
    expect(measureArtifactSet([{ id: 'other-role', path: a }, input[1]]).sha256).not.toBe(second.sha256);
    expect(Object.isFrozen(first.artifacts[0])).toBe(true);
  });
  it('measures content independently of install location and streams large files exactly', () => {
    const { root, a } = files(); const moved = join(root, 'copy.cjs'); const bytes = Buffer.alloc(2_097_153, 73); writeFileSync(a, bytes); writeFileSync(moved, bytes);
    expect(measureArtifactSet([{ id: 'client', path: a }])).toEqual(measureArtifactSet([{ id: 'client', path: moved }]));
    bytes[1_048_577] = 74; writeFileSync(moved, bytes);
    expect(measureArtifactSet([{ id: 'client', path: a }]).sha256).not.toBe(measureArtifactSet([{ id: 'client', path: moved }]).sha256);
  });
  it('fails on missing/non-file components, duplicate identities and accessor input', () => {
    const { root, a } = files(); const dir = join(root, 'directory'); mkdirSync(dir);
    expect(() => measureArtifactSet([{ id: 'missing', path: join(root, 'absent') }])).toThrow();
    expect(() => measureArtifactSet([{ id: 'directory', path: dir }])).toThrow();
    expect(() => measureArtifactSet([{ id: 'same', path: a }, { id: 'same', path: a }])).toThrow(/duplicate/);
    let invoked = false; const hostile = [{ id: 'hostile', get path() { invoked = true; return a; } }];
    expect(() => measureArtifactSet(hostile)).toThrow(); expect(invoked).toBe(false);
    expect(() => measureArtifactSet(new Array(1))).toThrow();
    expect(() => measureArtifactSet(new Proxy([], {}))).toThrow();
  });
});
