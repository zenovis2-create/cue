import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureInstallationIdentity } from './installation-identity.mjs';

// This entry and the builtin-only identity helper are the initial trusted code.
// Trusted startup must import this canonical URL once, without query aliases.
// This is an ordering boundary, not proof of every module already in memory.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dependencyRoot = resolve(root, 'daemon', 'node_modules');
let attempted = false;

/**
 * Capture before invoking the protected main-process loader, then check again
 * before releasing its result. A failed or pending attempt cannot be restarted.
 * Module top-level side effects cannot be undone by the post-load check: loaders
 * should load definitions only, and initialize the application AFTER this returns.
 * The caller retains the guard for checks before issuance and dispatch. No paths,
 * reset capability, application imports, or renderer interface are accepted here.
 */
export async function runGuardedEntry(loader) {
  if (attempted) throw new Error('guarded_entry_already_attempted');
  attempted = true;
  if (typeof loader !== 'function') throw new Error('guarded_entry_invalid_loader');
  const guard = captureInstallationIdentity({ root, dependencyRoot });
  const loaded = await loader(guard);
  guard.assertCurrent();
  return Object.freeze({ guard, loaded });
}
