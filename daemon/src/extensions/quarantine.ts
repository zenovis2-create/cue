import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { isVerifiedResourceSnapshot, type ResourceSnapshot } from '../resources/packages.js';

const requirementNames = ['hook', 'mcp', 'tool', 'policy', 'permission', 'network', 'entrypoint'] as const;
type Requirement = typeof requirementNames[number];
export interface ExtensionCandidate {
  id: string;
  version: string;
  manifestSha256: string;
  mode: 'declarative-resource' | 'node-executable';
  requirements: Requirement[];
}

function ownData(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('extension_candidate_schema');
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || keys.some(key => !own.includes(key))) throw Error('extension_candidate_schema');
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error('extension_candidate_schema');
  }
}
function requirements(value: unknown): asserts value is Requirement[] {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > requirementNames.length) throw Error('extension_candidate_schema');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || !keys.includes('length')) throw Error('extension_candidate_schema');
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || !requirementNames.includes(descriptor.value as Requirement) || seen.has(descriptor.value as string)) throw Error('extension_candidate_schema');
    seen.add(descriptor.value as string);
  }
}
function validate(candidate: unknown): asserts candidate is ExtensionCandidate {
  ownData(candidate, ['id', 'version', 'manifestSha256', 'mode', 'requirements']);
  if (typeof candidate.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(candidate.id)
    || typeof candidate.version !== 'string' || !/^\d{1,5}\.\d{1,5}\.\d{1,5}(?:-[A-Za-z0-9.-]{1,32})?$/.test(candidate.version)
    || typeof candidate.manifestSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(candidate.manifestSha256)
    || !['declarative-resource', 'node-executable'].includes(candidate.mode as string)) throw Error('extension_candidate_schema');
  requirements(candidate.requirements);
}

/** Classifies host-supplied extension metadata without execution, registration,
 * path resolution, network access, policy changes, or persistence. */
export function assessExtensionCandidate(candidate: ExtensionCandidate, snapshot?: ResourceSnapshot) {
  validate(candidate);
  const encoded = JSON.stringify(candidate);
  const candidateSha256 = createHash('sha256').update(encoded).digest('hex');
  if (candidate.mode === 'node-executable' || candidate.requirements.length) return Object.freeze({
    status: 'quarantined' as const,
    reason: 'extension_execution_requires_isolation' as const,
    releaseRequires: Object.freeze(['os-isolation-boundary', 'p13-qualified-evidence'] as const),
    candidateSha256,
  });
  if (!isVerifiedResourceSnapshot(snapshot) || snapshot.id !== candidate.id || snapshot.version !== candidate.version
    || snapshot.manifestSha256 !== candidate.manifestSha256) throw Error('extension_snapshot_binding');
  return Object.freeze({
    status: 'reference-only' as const,
    reference: Object.freeze({ id: snapshot.id, version: snapshot.version, manifestSha256: snapshot.manifestSha256 }),
    resourceCount: snapshot.resources.length,
    totalBytes: snapshot.resources.reduce((total, resource) => total + resource.byteLength, 0),
  });
}
