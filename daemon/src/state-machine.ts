export const taskStates = ['queued', 'running', 'awaiting_approval', 'blocked', 'completed', 'failed'] as const;
export type TaskState = typeof taskStates[number];
export type BlockedReason = 'budget' | 'crash' | 'policy' | 'health';
export type TaskStatus = { state: Exclude<TaskState, 'blocked'> } | { state: 'blocked'; reason: BlockedReason };

export type TokenUsage = { input: number; output: number; total: number };

function numbers(value: unknown): TokenUsage {
  if (!value || typeof value !== 'object') throw new Error('invalid token usage');
  const record = value as Record<string, unknown>;
  const input = Number(record.input_tokens ?? record.inputTokens ?? 0);
  const output = Number(record.output_tokens ?? record.outputTokens ?? 0);
  const total = Number(record.total_tokens ?? record.totalTokens ?? input + output);
  if (![input, output, total].every(Number.isFinite)) throw new Error('invalid token usage');
  return { input, output, total };
}

export function tokenUsageFromAppServer(event: unknown): TokenUsage {
  const value = event as { method?: string; params?: { tokenUsage?: { last?: unknown } } };
  if (value.method !== 'thread/tokenUsage/updated') throw new Error('unsupported token source');
  return numbers(value.params?.tokenUsage?.last);
}

export function tokenUsageFromExec(event: unknown): TokenUsage {
  const value = event as { type?: string; usage?: unknown };
  if (value.type !== 'turn.completed') throw new Error('unsupported token source');
  return numbers(value.usage);
}

export function applyTokenLimit(current: TaskStatus, usage: TokenUsage, tokenLimit: number): TaskStatus {
  return usage.total >= tokenLimit ? { state: 'blocked', reason: 'budget' } : current;
}
