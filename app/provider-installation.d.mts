export type ProviderId = 'claude' | 'codex';
export type ProviderVersionExpectation =
  | { kind: 'pe-file'; value: string }
  | { kind: 'package'; value: string; packageName: string; manifestPath: string; expectedManifestSha256: string };
export interface ProviderInstallationInput {
  provider: ProviderId; executablePath: string; expectedSha256: string;
  expectedSigner: { subject: string; thumbprint: string };
  version: ProviderVersionExpectation; authProfilePaths: string[];
}
export interface ProviderInstallationDescriptor {
  readonly provider: ProviderId; readonly executablePath: string;
  readonly executable: Readonly<{ sha256: string; size: number; dev: string; ino: string; mtimeMs: number; ctimeMs: number; signerSubject: string; signerThumbprint: string }>;
  readonly version: Readonly<{ kind: string; value: string; packageName?: string; manifestPath?: string; manifestSha256?: string }>;
  readonly authProfiles: readonly Readonly<{ path: string; size: number; dev: string; ino: string; mtimeMs: number; ctimeMs: number }>[];
  readonly status: 'unqualified'; readonly authenticated: false; readonly entitled: false; readonly qualified: false;
}
export function identifyProviderInstallation(input: ProviderInstallationInput): ProviderInstallationDescriptor;
export function assertCurrentProviderInstallation(value: unknown): true;
