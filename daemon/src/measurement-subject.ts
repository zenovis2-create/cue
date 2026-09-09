import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';

// P13 R-1. A capability result only means something together with a fingerprint of
// what was measured. Bind every probe result to `subjectDigest`; when any component
// moves, the result reverts to unmeasured (absolute rule 1) rather than surviving as
// a stale PASS. Nothing here may invent a value for an artifact it could not read
// (absolute rule 4).

export const SUBJECT_FIELDS = Object.freeze([
  'toolBinarySha256',
  'adapterSha256',
  'enforcementSha256',
  'boundaryProviderId',
  'boundaryPolicySha256',
  'boundaryContractVersion',
  'probeSuiteSha256',
  'runtimeArtifactSha256',
  'osBuild',
] as const);

export type SubjectField = (typeof SUBJECT_FIELDS)[number];
export type MeasurementSubject = Readonly<Record<SubjectField, string>>;

export interface MeasurementSubjectInput {
  toolBinary: string;
  adapterSource: string;
  enforcementSource: string;
  boundaryProviderId: string;
  boundaryPolicySource: string;
  boundaryContractVersion: string;
  probeSuiteSource: string;
  runtimeArtifactSource: string;
  osBuild: string;
}

function hashFile(path: unknown, field: SubjectField): string {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new Error(`measurement subject requires a path for ${field}`);
  }
  let resolved: string;
  try {
    // Hash the artifact that actually runs, not the name used to reach it.
    resolved = realpathSync(path);
  } catch (error) {
    throw new Error(`measurement subject artifact unreadable for ${field}: ${path} (${(error as Error).message})`);
  }
  try {
    return createHash('sha256').update(readFileSync(resolved)).digest('hex');
  } catch (error) {
    throw new Error(`measurement subject artifact unreadable for ${field}: ${path} (${(error as Error).message})`);
  }
}

function literal(value: unknown, field: SubjectField): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`measurement subject requires a value for ${field}`);
  }
  return value;
}

export function buildMeasurementSubject(input: MeasurementSubjectInput): MeasurementSubject {
  const source = (input ?? {}) as Partial<MeasurementSubjectInput>;
  const subject = {
    toolBinarySha256: hashFile(source.toolBinary, 'toolBinarySha256'),
    adapterSha256: hashFile(source.adapterSource, 'adapterSha256'),
    enforcementSha256: hashFile(source.enforcementSource, 'enforcementSha256'),
    boundaryProviderId: literal(source.boundaryProviderId, 'boundaryProviderId'),
    boundaryPolicySha256: hashFile(source.boundaryPolicySource, 'boundaryPolicySha256'),
    boundaryContractVersion: literal(source.boundaryContractVersion, 'boundaryContractVersion'),
    probeSuiteSha256: hashFile(source.probeSuiteSource, 'probeSuiteSha256'),
    runtimeArtifactSha256: hashFile(source.runtimeArtifactSource, 'runtimeArtifactSha256'),
    osBuild: literal(source.osBuild, 'osBuild'),
  };
  return Object.freeze(subject);
}

export function canonicalSubjectJson(subject: MeasurementSubject): string {
  // Fixed field order, so a digest never depends on how the object was assembled.
  return JSON.stringify(SUBJECT_FIELDS.map((field) => [field, literal(subject?.[field], field)]));
}

export function subjectDigest(subject: MeasurementSubject): string {
  return createHash('sha256').update(canonicalSubjectJson(subject)).digest('hex');
}

export interface BoundProbeResult<T> {
  readonly subjectDigest: string;
  readonly measuredAt: string;
  readonly result: T;
}

export function bindProbeResult<T>(subject: MeasurementSubject, result: T): BoundProbeResult<T> {
  return Object.freeze({
    subjectDigest: subjectDigest(subject),
    measuredAt: new Date().toISOString(),
    result: Object.freeze(result) as T,
  });
}

/**
 * Returns the measured result only when it was measured against exactly this subject.
 * Any drift yields null, which callers must treat as unmeasured -> not eligible.
 * There is deliberately no "close enough" comparison and no override argument.
 */
export function readProbeResult<T>(bound: BoundProbeResult<T> | null | undefined, subject: MeasurementSubject): T | null {
  if (!bound || typeof bound.subjectDigest !== 'string') return null;
  return bound.subjectDigest === subjectDigest(subject) ? bound.result : null;
}
