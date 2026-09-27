import type { ProviderInstallationDescriptor } from './provider-installation.mjs';
export type ClaudeConfigurationRequest = Readonly<{
  attemptId: string; candidateId: string; subjectDigest: string;
  accountIdentity: Readonly<{ reference: string; digest: string }>;
  model: string; worktreePath: string;
}>;
export type ClaudeConfigurationEnvironment = Readonly<Record<
  'SystemRoot' | 'WINDIR' | 'USERPROFILE' | 'HOME' | 'APPDATA' | 'LOCALAPPDATA' | 'TEMP' | 'TMP' | 'CLAUDE_CONFIG_DIR', string>>;
export type ClaudeAuthorizedSession = Readonly<{
  request: ClaudeConfigurationRequest; authProfilePath: string;
  environment: ClaudeConfigurationEnvironment; observedAtMs: number; validUntilMs: number;
}>;
/** Opaque at runtime: structural copies are never accepted. */
export type ClaudeConfigurationBinding = Readonly<{ version: 'cue-claude-configuration-v1' }>;
export type ClaudeConfigurationResolver = (request: ClaudeConfigurationRequest) => Promise<ClaudeConfigurationBinding | null>;
export function createClaudeConfigurationResolver(host: Readonly<{
  installation: ProviderInstallationDescriptor; now(): number; maxAgeMs: number;
  resolveAuthorizedSession(request: ClaudeConfigurationRequest): ClaudeAuthorizedSession | null | Promise<ClaudeAuthorizedSession | null>;
}>): ClaudeConfigurationResolver;
export function consumeClaudeConfiguration(binding: ClaudeConfigurationBinding, request: ClaudeConfigurationRequest,
  installation: ProviderInstallationDescriptor): ClaudeConfigurationEnvironment;
