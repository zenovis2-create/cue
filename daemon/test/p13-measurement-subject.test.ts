import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildMeasurementSubject,
  subjectDigest,
  bindProbeResult,
  readProbeResult,
  SUBJECT_FIELDS,
} from '../src/measurement-subject.js';

// P13 R-1. The measurement subject is the fingerprint of *what was measured*.
// A probe result that is not bound to a subject digest is not evidence.
// Absolute rules exercised here:
//   1. no measurement -> false          (never "assume it still holds")
//   4. no file -> no claim              (a subject cannot be built from absence)
//   5. never lower the bar to get true  (a changed fingerprint invalidates, always)

let root: string;
const files: Record<string, string> = {};

function writeArtifact(name: string, body: string): string {
  const path = join(root, name);
  writeFileSync(path, body);
  return path;
}

function baseInput() {
  return {
    toolBinary: files.binary,
    adapterSource: files.adapter,
    enforcementSource: files.enforcement,
    boundaryProviderId: 'appcontainer',
    boundaryPolicySource: files.policy,
    boundaryContractVersion: 'v1',
    probeSuiteSource: files.probe,
    runtimeArtifactSource: files.artifact,
    osBuild: '10.0.26100',
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cue-subject-'));
  files.binary = writeArtifact('codex.exe', 'BINARY-v0.151.0');
  files.adapter = writeArtifact('adapter.ts', 'export const adapter = 1;');
  files.enforcement = writeArtifact('enforcement.ts', 'export const enforce = 1;');
  files.policy = writeArtifact('policy.json', '{"net":"deny"}');
  files.probe = writeArtifact('probe.mjs', 'export const probe = 1;');
  files.artifact = writeArtifact('probe.build.mjs', 'export const built = 1;');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

describe('P13 measurement subject', () => {
  it('S1 produces a digest that is independent of property insertion order', () => {
    const a = buildMeasurementSubject(baseInput());
    const reordered = Object.fromEntries(Object.entries(baseInput()).reverse());
    const b = buildMeasurementSubject(reordered as ReturnType<typeof baseInput>);
    expect(subjectDigest(a)).toBe(subjectDigest(b));
    expect(subjectDigest(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('S2 changes the digest when ANY single component changes', () => {
    const original = subjectDigest(buildMeasurementSubject(baseInput()));
    const mutations: Array<[string, () => ReturnType<typeof baseInput>]> = [
      ['toolBinarySha256', () => ({ ...baseInput(), toolBinary: writeArtifact('codex2.exe', 'BINARY-v0.153.4') })],
      ['adapterSha256', () => ({ ...baseInput(), adapterSource: writeArtifact('adapter2.ts', 'export const adapter = 2;') })],
      ['enforcementSha256', () => ({ ...baseInput(), enforcementSource: writeArtifact('enf2.ts', 'export const enforce = 2;') })],
      ['boundaryProviderId', () => ({ ...baseInput(), boundaryProviderId: 'job-object' })],
      ['boundaryPolicySha256', () => ({ ...baseInput(), boundaryPolicySource: writeArtifact('policy2.json', '{"net":"allow"}') })],
      ['boundaryContractVersion', () => ({ ...baseInput(), boundaryContractVersion: 'v2' })],
      ['probeSuiteSha256', () => ({ ...baseInput(), probeSuiteSource: writeArtifact('probe2.mjs', 'export const probe = 2;') })],
      ['runtimeArtifactSha256', () => ({ ...baseInput(), runtimeArtifactSource: writeArtifact('built2.mjs', 'export const built = 2;') })],
      ['osBuild', () => ({ ...baseInput(), osBuild: '10.0.22631' })],
    ];
    expect(mutations.map(([field]) => field).sort()).toEqual([...SUBJECT_FIELDS].sort());
    for (const [field, mutate] of mutations) {
      const mutated = subjectDigest(buildMeasurementSubject(mutate()));
      expect(mutated, `${field} must move the digest`).not.toBe(original);
    }
  });

  it('S3 refuses to build a subject when a component is missing or blank', () => {
    for (const key of ['boundaryProviderId', 'boundaryContractVersion', 'osBuild'] as const) {
      expect(() => buildMeasurementSubject({ ...baseInput(), [key]: '' })).toThrow(/measurement subject/i);
      const dropped = { ...baseInput() } as Record<string, unknown>;
      delete dropped[key];
      expect(() => buildMeasurementSubject(dropped as ReturnType<typeof baseInput>)).toThrow(/measurement subject/i);
    }
  });

  it('S4 refuses to build a subject from a file that does not exist', () => {
    // Absolute rule 4: no file, no claim. A subject must never fall back to a
    // placeholder hash for an artifact nobody could read.
    expect(() => buildMeasurementSubject({ ...baseInput(), toolBinary: join(root, 'absent.exe') }))
      .toThrow(/unreadable|ENOENT/i);
    expect(() => buildMeasurementSubject({ ...baseInput(), probeSuiteSource: join(root, 'absent.mjs') }))
      .toThrow(/unreadable|ENOENT/i);
  });

  it('S5 invalidates a bound probe result once any fingerprint moves', () => {
    const subject = buildMeasurementSubject(baseInput());
    const bound = bindProbeResult(subject, { P1: true, P2: true, P3: true, P4: true, P5: true });
    expect(readProbeResult(bound, subject)).toEqual({ P1: true, P2: true, P3: true, P4: true, P5: true });

    // The binary is replaced underneath us - exactly the 0.151.0 -> 0.153.4 event.
    writeFileSync(files.binary, 'BINARY-v0.153.4');
    const now = buildMeasurementSubject(baseInput());
    expect(subjectDigest(now)).not.toBe(subjectDigest(subject));
    // Rule 1: unmeasured, therefore null - never the stale PASS.
    expect(readProbeResult(bound, now)).toBeNull();
  });

  it('S6 invalidates a bound result when only the probe suite changes', () => {
    // Raising the bar must retire every earlier PASS, even though the tool is untouched.
    const subject = buildMeasurementSubject(baseInput());
    const bound = bindProbeResult(subject, { P1: true, P2: true, P3: true, P4: true, P5: true });
    writeFileSync(files.probe, 'export const probe = 2; // stricter');
    const stricter = buildMeasurementSubject(baseInput());
    expect(readProbeResult(bound, stricter)).toBeNull();
  });

  it('S7 hashes the resolved target, not the link path', () => {
    let link: string;
    try {
      link = join(root, 'link.exe');
      symlinkSync(files.binary, link);
    } catch {
      return; // symlink creation needs privileges on Windows; skip rather than fake a pass
    }
    const viaLink = buildMeasurementSubject({ ...baseInput(), toolBinary: link });
    const direct = buildMeasurementSubject(baseInput());
    expect(viaLink.toolBinarySha256).toBe(direct.toolBinarySha256);
  });
});
