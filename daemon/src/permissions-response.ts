import { isAbsolute, relative } from 'node:path';

export type NonEmpty<T> = readonly [T, ...T[]];
export interface PermissionEntry { path: string; access: 'read' | 'write' }
export interface PermissionsAccept {
  decision: 'accept';
  scope: 'turn';
  strictAutoReview: true;
  entries: NonEmpty<PermissionEntry>;
}

export function isConcreteContainedPath(worktree: string, value: unknown): value is string {
  if (typeof value !== 'string' || !isAbsolute(value) || /[*?\[\]{}]/.test(value)) return false;
  const rel = relative(worktree, value);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

export function buildPermissionsAccept(worktree: string, raw: unknown): PermissionsAccept | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const entries: PermissionEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || 'special' in item) return undefined;
    const candidate = item as Record<string, unknown>;
    if (!isConcreteContainedPath(worktree, candidate.path)) return undefined;
    if (candidate.access !== 'read' && candidate.access !== 'write') return undefined;
    entries.push({ path: candidate.path, access: candidate.access });
  }
  return { decision: 'accept', scope: 'turn', strictAutoReview: true, entries: entries as [PermissionEntry, ...PermissionEntry[]] };
}
