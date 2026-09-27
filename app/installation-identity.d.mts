export interface InstallationGeneration {
  readonly snapshot: Readonly<{
    version: 'cue-installation-generation-v1'; root: string; dependencyRoot: string;
    sqlite: Readonly<{ name: string; version: string; main: string }>;
    runtime: Readonly<{ executable: string; node: string; electron: string | null; abi: string; platform: string; arch: string; sha256: string; dev: string; ino: string; size: number; mtimeMs: number; ctimeMs: number }>;
    helper: Readonly<{ path: string; sha256: string; dev: string; ino: string; size: number; mtimeMs: number; ctimeMs: number }>;
    files: readonly Readonly<{ label: string; kind: string; dev: string; ino: string; size: number; mtimeMs: number; ctimeMs: number; sha256?: string }>[];
  }>;
  readonly digest: string;
  assertCurrent(): true;
}
export function captureInstallationIdentity(input: { root: string; dependencyRoot: string }): InstallationGeneration;
/** Object provenance only; fresh startup ordering is a separate requirement. */
export function isInstallationGeneration(value: unknown): value is InstallationGeneration;
