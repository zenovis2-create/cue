import { createHash } from 'node:crypto';
import { openSync, closeSync, readSync, fstatSync, realpathSync } from 'node:fs';
import { types } from 'node:util';

export interface MeasurementArtifact { readonly id: string; readonly path: string }
export interface MeasurementArtifactSet {
  readonly version: 'cue-measurement-artifacts-v1';
  readonly artifacts: readonly Readonly<{ id: string; sha256: string }>[];
  readonly sha256: string;
}

/** Host-owned, content-addressed component set for existing MeasurementSubject
 * hash fields. It measures supplied files; it does not discover dependencies,
 * prove a probe verdict, or grant execution permission. */
export function measureArtifactSet(input: readonly MeasurementArtifact[]): MeasurementArtifactSet {
  if (!Array.isArray(input) || types.isProxy(input) || Object.getPrototypeOf(input) !== Array.prototype
    || input.length < 1 || input.length > 128 || Reflect.ownKeys(input).length !== input.length + 1) throw Error('artifact_set_invalid');
  const entries: MeasurementArtifact[] = [];
  for (let i = 0; i < input.length; i++) {
    const item = Object.getOwnPropertyDescriptor(input, String(i));
    if (!item || !Object.hasOwn(item, 'value')) throw Error('artifact_set_accessor');
    const value = item.value;
    if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error('artifact_set_invalid');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== 2 || !['id', 'path'].every(key => descriptors[key]?.enumerable && Object.hasOwn(descriptors[key], 'value'))) throw Error('artifact_set_invalid');
    const id = descriptors.id.value, path = descriptors.path.value;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(id)
      || typeof path !== 'string' || !path.trim() || path.includes('\0')) throw Error('artifact_set_invalid');
    entries.push({ id, path });
  }
  if (new Set(entries.map(e => e.id)).size !== entries.length) throw Error('artifact_set_duplicate');
  const artifacts = entries.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(entry => {
    const fd = openSync(realpathSync(entry.path), 'r');
    try {
      const before = fstatSync(fd);
      if (!before.isFile()) throw Error('artifact_set_not_file');
      if (!Number.isSafeInteger(before.size) || before.size < 0) throw Error('artifact_set_size');
      const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024);
      let length = 0;
      for (;;) {
        // A growing file cannot extend synchronous work past its original size.
        const n = readSync(fd, buffer, 0, Math.min(buffer.length, before.size - length + 1), null);
        if (!n) break;
        length += n;
        if (length > before.size) throw Error('artifact_set_changed');
        hash.update(buffer.subarray(0, n));
      }
      const after = fstatSync(fd);
      if (length !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs
        || after.ctimeMs !== before.ctimeMs || after.ino !== before.ino || after.dev !== before.dev) throw Error('artifact_set_changed');
      return Object.freeze({ id: entry.id, sha256: hash.digest('hex') });
    } finally { closeSync(fd); }
  });
  const data = { version: 'cue-measurement-artifacts-v1' as const, artifacts: Object.freeze(artifacts) };
  return Object.freeze({ ...data, sha256: createHash('sha256').update(JSON.stringify(data)).digest('hex') });
}
