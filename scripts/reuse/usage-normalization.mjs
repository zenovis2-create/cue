// R-05 isolated contract experiment. No pricing, auth, network, or tool execution.
// Provider counters are observations, not a statement about final billing.
function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error('usage must be a plain record');
  }
  return value;
}

function count(value) {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('invalid token counter');
  return value;
}

export function normalizeUsage(provider, raw) {
  if (!['openai-chat', 'ollama'].includes(provider)) throw new Error('unsupported usage provider');
  if (raw === undefined || raw === null) {
    return Object.freeze({ provider, status: 'unknown', input: null, output: null, cachedInput: null, total: null, totalSource: 'unknown' });
  }
  const value = record(raw);
  const input = count(provider === 'openai-chat' ? value.prompt_tokens : value.prompt_eval_count);
  const output = count(provider === 'openai-chat' ? value.completion_tokens : value.eval_count);
  const cachedInput = provider === 'openai-chat' && value.prompt_tokens_details != null
    ? count(record(value.prompt_tokens_details).cached_tokens) : null;
  const reportedTotal = provider === 'openai-chat' ? count(value.total_tokens) : null;
  if (input !== null && cachedInput !== null && cachedInput > input) throw new Error('cached tokens exceed input');
  const sum = input !== null && output !== null ? input + output : null;
  if (sum !== null && !Number.isSafeInteger(sum)) throw new Error('token sum overflow');
  if (reportedTotal !== null && ((input !== null && reportedTotal < input)
    || (output !== null && reportedTotal < output) || (sum !== null && reportedTotal !== sum))) {
    throw new Error('inconsistent token total');
  }
  const total = reportedTotal ?? sum;
  if (total !== null && cachedInput !== null && cachedInput > total - (output ?? 0)) {
    throw new Error('cached tokens exceed available input within total');
  }
  return Object.freeze({
    provider,
    status: input !== null && output !== null ? 'reported' : total !== null || input !== null || output !== null || cachedInput !== null ? 'partial' : 'unknown',
    input, output, cachedInput, total,
    totalSource: reportedTotal !== null ? 'reported' : sum !== null ? 'derived' : 'unknown',
  });
}
