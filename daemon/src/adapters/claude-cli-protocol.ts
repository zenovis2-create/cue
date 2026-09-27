/** Documentation-mapped CLI stream subset. Not a qualified 2.1.274 adapter. */
export type ClaudeProjection = Readonly<{
  ordinal: number; kind: 'init' | 'delta' | 'assistant' | 'tool' | 'subagent' | 'error';
  sessionId: string; messageId?: string; blockIndex?: number; text?: string;
  parentToolUseId?: string; toolUseId?: string; toolName?: string;
  model?: string; claudeCodeVersion?: string; cwd?: string;
  tools?: readonly string[]; mcpServers?: readonly string[];
}>;
export type ClaudeTerminal = Readonly<{
  sessionId: string; subtype: string; outcome: 'success' | 'error'; text?: string;
  estimatedCostUsd: number; modelUsage: Readonly<Record<string, Readonly<{inputTokens: number; outputTokens: number; costUSD: number}>>>;
  permissionDenials: number;
}>;
export const CLAUDE_CLI_LIMITS = Object.freeze({bytes: 1024 * 1024, lineBytes: 256 * 1024, frames: 4096});

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('claude_protocol_object');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 4096) throw Error('claude_protocol_string');
  return value;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error('claude_protocol_number');
  return value;
}
function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw Error('claude_protocol_count');
  return value as number;
}

export function createClaudeCliDecoder() {
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let pending = '', bytes = 0, frames = 0, ordinal = 0, sessionId: string | undefined;
  let result: ClaudeTerminal | undefined, failed = false, closed = false;
  const seen = new Map<string, string>();
  const fail = (): never => { failed = true; throw Error('claude_protocol_invalid'); };
  const frame = (line: string): ClaudeProjection[] => {
    let raw: Record<string, unknown>;
    try { raw = object(JSON.parse(line)); } catch { return fail(); }
    if (++frames > CLAUDE_CLI_LIMITS.frames) return fail();
    const type = raw.type;
    if (type === 'system' && raw.subtype === 'init') {
      if (sessionId || result) return fail();
      sessionId = string(raw.session_id);
      const claudeCodeVersion = string(raw.claude_code_version), model = string(raw.model), cwd = string(raw.cwd);
      if (!Array.isArray(raw.tools) || !Array.isArray(raw.mcp_servers)) return fail();
      const tools = raw.tools.map(string);
      const mcpServers = raw.mcp_servers.map(value=>string(object(value).name));
      return [{ordinal:++ordinal,kind:'init',sessionId,claudeCodeVersion,model,cwd,tools:Object.freeze(tools),mcpServers:Object.freeze(mcpServers)}];
    }
    if (!sessionId || raw.session_id !== sessionId) return fail();
    // The pinned SDK type says informational system messages may follow a result.
    if (result) {
      if (type === 'system' && ['status','task_notification','session_state_changed'].includes(String(raw.subtype))) return [];
      return fail();
    }
    const parent = raw.parent_tool_use_id;
    if (parent !== undefined && parent !== null && typeof parent !== 'string') return fail();
    const base = {ordinal: ++ordinal, sessionId, ...(parent ? {parentToolUseId: parent} : {})};
    if (type === 'stream_event') {
      const event = object(raw.event);
      if (event.type !== 'content_block_delta') return [];
      const index = event.index;
      if (!Number.isSafeInteger(index) || (index as number) < 0) return fail();
      const delta = object(event.delta);
      if (delta.type !== 'text_delta') return [];
      if (typeof delta.text !== 'string') return fail();
      return [{...base, kind: parent ? 'subagent' : 'delta', blockIndex: index as number, text: delta.text}];
    }
    if (type === 'assistant') {
      const message = object(raw.message), messageId = string(message.id);
      if (!Array.isArray(message.content)) return fail();
      const projections: ClaudeProjection[] = [];
      const wrapperId = string(raw.uuid);
      for (let blockIndex = 0; blockIndex < message.content.length; blockIndex++) {
        const block = message.content[blockIndex];
        const content = object(block);
        const key = JSON.stringify([parent ?? null,messageId,wrapperId,blockIndex]);
        const fingerprint = JSON.stringify(content);
        const previous = seen.get(key);
        if (previous !== undefined) { if (previous !== fingerprint) return fail(); else continue; }
        seen.set(key, fingerprint);
        if (content.type === 'text') {
          if (typeof content.text !== 'string') return fail();
          // Complete assistant blocks reconcile provisional deltas; consumers must not append both.
          projections.push({...base, kind: parent ? 'subagent' : 'assistant', messageId, blockIndex, text: content.text});
        } else if (content.type === 'tool_use') {
          projections.push({...base, kind: 'tool', messageId, blockIndex, toolUseId:string(content.id), toolName:string(content.name)});
        } else if (content.type !== 'thinking' && content.type !== 'redacted_thinking') return fail();
      }
      if (raw.error !== undefined || raw.aborted === true) projections.push({...base, kind: 'error', messageId});
      return projections;
    }
    if (type === 'result') {
      const subtype = string(raw.subtype);
      if (!['success','error_during_execution','error_max_turns','error_max_budget_usd','error_max_structured_output_retries'].includes(subtype)) return fail();
      if (typeof raw.is_error !== 'boolean' || !Array.isArray(raw.permission_denials)) return fail();
      const modelUsage = object(raw.modelUsage), usage: Record<string, {inputTokens:number;outputTokens:number;costUSD:number}> = Object.create(null);
      for (const [model, value] of Object.entries(modelUsage)) {
        const item = object(value);
        usage[model] = {inputTokens:count(item.inputTokens), outputTokens:count(item.outputTokens), costUSD:number(item.costUSD)};
      }
      const outcome = subtype === 'success' && raw.is_error === false && raw.permission_denials.length === 0 ? 'success' : 'error';
      if (subtype === 'success' && typeof raw.result !== 'string') return fail();
      result = Object.freeze({sessionId, subtype, outcome, ...(typeof raw.result === 'string' ? {text:raw.result} : {}), estimatedCostUsd:number(raw.total_cost_usd), modelUsage:Object.freeze(usage), permissionDenials:raw.permission_denials.length});
      return [];
    }
    // SDKMessage is an open union. Unknown informational frames do not grant a capability.
    if (type === 'system' || type === 'user' || type === 'rate_limit_event') return [];
    return fail();
  };
  return Object.freeze({
    abort(): void { failed = true; },
    push(chunk: Uint8Array): readonly ClaudeProjection[] {
      if (failed || closed) throw Error('claude_protocol_closed');
      try {
        if (!(chunk instanceof Uint8Array) || (bytes += chunk.byteLength) > CLAUDE_CLI_LIMITS.bytes) return fail();
        pending += decoder.decode(chunk, {stream:true});
        const projections: ClaudeProjection[] = [];
        for (;;) {
          const pos = pending.indexOf('\n');
          if (pos < 0) break;
          let line = pending.slice(0,pos); pending = pending.slice(pos+1);
          if (line.endsWith('\r')) line = line.slice(0,-1);
          if (Buffer.byteLength(line) > CLAUDE_CLI_LIMITS.lineBytes || !line) return fail();
          projections.push(...frame(line));
        }
        if (Buffer.byteLength(pending) > CLAUDE_CLI_LIMITS.lineBytes) return fail();
        return Object.freeze(projections);
      } catch { return fail(); }
    },
    finish(): ClaudeTerminal {
      if (failed || closed) throw Error('claude_protocol_closed');
      closed = true;
      try { if (decoder.decode() || pending || !result) return fail(); } catch { return fail(); }
      return result;
    },
  });
}
