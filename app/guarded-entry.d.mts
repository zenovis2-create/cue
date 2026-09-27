import type { InstallationGeneration } from './installation-identity.mjs';
/** Protected canonical startup only; load definitions, initialize after return. */
export function runGuardedEntry<T>(loader: (guard: InstallationGeneration) => T | Promise<T>): Promise<Readonly<{ guard: InstallationGeneration; loaded: T }>>;
