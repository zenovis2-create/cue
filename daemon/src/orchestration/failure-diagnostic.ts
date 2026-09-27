export const HOST_FAILURE_DIAGNOSTIC_CODES = Object.freeze([
  'cancelled',
  'deadline-exceeded',
  'transport-failed',
  'local-http-401',
  'local-http-403',
  'local-http-408',
  'local-http-429',
  'local-http-5xx',
  'local-http-other',
  'protocol-invalid',
  'output-limit',
  'native-io-failed',
  'native-exit-failed',
  'terminal-incomplete',
  'native-boundary-unverified',
  'cleanup-unverified',
  'unknown',
] as const);

export type HostFailureDiagnosticCode = typeof HOST_FAILURE_DIAGNOSTIC_CODES[number];

export function isHostFailureDiagnosticCode(value: unknown): value is HostFailureDiagnosticCode {
  return typeof value === 'string' && (HOST_FAILURE_DIAGNOSTIC_CODES as readonly string[]).includes(value);
}
