export interface RawApprovalRequest { method: string; params: unknown }

export function carryRawRequest(method: string, params: unknown): RawApprovalRequest {
  return { method, params };
}

export function codexArgv(appServerArgs: readonly string[] = []): string[] {
  return ['-a', 'on-request', 'app-server', ...appServerArgs];
}
