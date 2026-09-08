import { createInterface, type Interface as ReadLineInterface } from 'node:readline';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { Readable, Writable } from 'node:stream';

export const CUE_WORKSPACE_TOOL = Object.freeze({
  type: 'function',
  name: 'cue_workspace',
  description: 'Perform an exact text write or run one program inside Cue\'s capability-zero Windows AppContainer. The working directory is pinned to the approved worktree. Prefer operation=write_text for exact file creation or replacement.',
  deferLoading: false,
  inputSchema: Object.freeze({
    type: 'object',
    oneOf: Object.freeze([
      Object.freeze({
        type: 'object',
        additionalProperties: false,
        properties: Object.freeze({
          program: Object.freeze({ type: 'string', minLength: 1, maxLength: 4096 }),
          args: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string', maxLength: 32_768 }), maxItems: 256 }),
          timeoutMs: Object.freeze({ type: 'integer', minimum: 1, maximum: 120_000 }),
        }),
        required: Object.freeze(['program', 'args']),
      }),
      Object.freeze({
        type: 'object',
        additionalProperties: false,
        properties: Object.freeze({
          operation: Object.freeze({ type: 'string', enum: Object.freeze(['write_text']) }),
          path: Object.freeze({ type: 'string', minLength: 1, maxLength: 4096 }),
          content: Object.freeze({ type: 'string', maxLength: 16_384 }),
          timeoutMs: Object.freeze({ type: 'integer', minimum: 1, maximum: 120_000 }),
        }),
        required: Object.freeze(['operation', 'path', 'content']),
      }),
    ]),
  }),
});

export interface HostThreadStartParams {
  cwd: string;
  model?: string;
  ephemeral: true;
  sandbox: 'read-only';
  environments: readonly [];
  approvalsReviewer: 'user';
  approvalPolicy: {
    granular: {
      mcp_elicitations: false;
      request_permissions: false;
      rules: false;
      sandbox_approval: false;
      skill_approval: false;
    };
  };
  developerInstructions: string;
  dynamicTools: readonly [typeof CUE_WORKSPACE_TOOL];
}

export function buildHostThreadStartParams(cwd: string, goal: string, model?: string): HostThreadStartParams {
  if (!cwd.trim()) throw new Error('worktree cwd required');
  if (!goal.trim()) throw new Error('goal required');
  return Object.freeze({
    cwd,
    ...(model ? { model } : {}),
    ephemeral: true,
    sandbox: 'read-only',
    environments: Object.freeze([]) as readonly [],
    approvalsReviewer: 'user',
    approvalPolicy: Object.freeze({
      granular: Object.freeze({
        mcp_elicitations: false,
        request_permissions: false,
        rules: false,
        sandbox_approval: false,
        skill_approval: false,
      }),
    }),
    developerInstructions: [
      'You are Cue\'s host-side reasoning and model-communication controller.',
      'No host workspace execution environment is available.',
      'Use cue_workspace for every command and every file read, write, build, or test operation.',
      'The tool is pinned to the user-approved worktree and runs inside a capability-zero Windows AppContainer.',
      'The worker OS is Windows. Prefer powershell.exe with -NoProfile and -NonInteractive; each call starts a fresh process in the approved worktree.',
      'Worker child processes are prohibited by the OS job. Request each executable directly in a separate cue_workspace call so Cue resolves and verifies it outside every writable worktree. Commands requiring nested subprocesses are unsupported.',
      'For exact file creation or replacement, Prefer cue_workspace operation=write_text with a relative path and literal content; Cue encodes the values and the AppContainer worker writes exact UTF-8 bytes. Verify exact file content with a separate PowerShell built-in read.',
      'Use PowerShell or cmd.exe built-ins only for other file checks. Do not run git, npm, node, python, or repository-discovery commands; they may traverse unapproved ancestor paths or require child processes.',
      'Never invent command output or claim completion without verifying the requested result through cue_workspace.',
      `Complete this approved goal: ${goal}`,
    ].join('\n'),
    dynamicTools: Object.freeze([CUE_WORKSPACE_TOOL]) as readonly [typeof CUE_WORKSPACE_TOOL],
  });
}

export interface DynamicToolCallParams {
  namespace?: unknown;
  tool?: unknown;
  arguments?: unknown;
}

export interface CueWorkspaceCommand {
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  operation?: 'write_text';
  inspectedPaths?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCueWorkspaceCall(params: DynamicToolCallParams, approvedCwd: string): CueWorkspaceCommand {
  if ((params.namespace !== undefined && params.namespace !== null) || params.tool !== CUE_WORKSPACE_TOOL.name) {
    throw new Error('unapproved dynamic tool');
  }
  if (!isRecord(params.arguments)) throw new Error('dynamic tool arguments must be an object');
  const operation = params.arguments.operation;
  if (operation === 'write_text') {
    const allowed = new Set(['operation', 'path', 'content', 'timeoutMs']);
    for (const key of Object.keys(params.arguments)) {
      if (!allowed.has(key)) throw new Error(`unexpected dynamic tool argument: ${key}`);
    }
    const path = params.arguments.path;
    const content = params.arguments.content;
    const timeoutMs = params.arguments.timeoutMs ?? 120_000;
    if (typeof path !== 'string' || !path.trim() || path.length > 4096 || path.includes('\0') || isAbsolute(path)) {
      throw new Error('write_text path must be a non-empty relative path');
    }
    if (Buffer.from(path, 'utf8').toString('utf8') !== path) {
      throw new Error('write_text path must contain valid Unicode scalar values');
    }
    const target = resolve(approvedCwd, path);
    const relativeTarget = relative(approvedCwd, target);
    if (!relativeTarget || relativeTarget === '..' || relativeTarget.startsWith(`..${sep}`) || isAbsolute(relativeTarget)) {
      throw new Error('write_text path escapes the approved worktree');
    }
    if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 16_384 || content.includes('\0')) {
      throw new Error('write_text content must be a UTF-8 string of at most 16384 bytes');
    }
    if (Buffer.from(content, 'utf8').toString('utf8') !== content) {
      throw new Error('write_text content must contain valid Unicode scalar values');
    }
    if (!Number.isInteger(timeoutMs) || Number(timeoutMs) < 1 || Number(timeoutMs) > 120_000) {
      throw new Error('timeoutMs out of range');
    }
    const encodedPath = Buffer.from(path, 'utf8').toString('base64');
    const encodedContent = Buffer.from(content, 'utf8').toString('base64');
    const script = [
      "$ErrorActionPreference='Stop'",
      `$relative=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}'))`,
      '$target=[IO.Path]::GetFullPath([IO.Path]::Combine([Environment]::CurrentDirectory,$relative))',
      `$bytes=[Convert]::FromBase64String('${encodedContent}')`,
      '$parent=[IO.Path]::GetDirectoryName($target)',
      'if ($parent) {[IO.Directory]::CreateDirectory($parent) | Out-Null}',
      '[IO.File]::WriteAllBytes($target,$bytes)',
      "[Console]::Out.Write('CUE_WRITE_OK')",
    ].join(';');
    const workerArgs = ['-NoProfile', '-NonInteractive', '-Command', script];
    const commandLineChars = 'powershell.exe'.length + workerArgs.reduce((total, arg) => total + arg.length + 3, 0);
    if (commandLineChars > 30_000) {
      throw new Error('write_text request exceeds the safe Windows command-line budget');
    }
    return {
      executable: 'powershell.exe',
      args: workerArgs,
      cwd: approvedCwd,
      timeoutMs: Number(timeoutMs),
      operation: 'write_text',
      inspectedPaths: [target],
    };
  }
  if (operation !== undefined) throw new Error('unsupported cue_workspace operation');
  const allowed = new Set(['program', 'args', 'timeoutMs']);
  for (const key of Object.keys(params.arguments)) {
    if (!allowed.has(key)) throw new Error(`unexpected dynamic tool argument: ${key}`);
  }
  const program = params.arguments.program;
  const args = params.arguments.args;
  const timeoutMs = params.arguments.timeoutMs ?? 120_000;
  if (typeof program !== 'string' || !program.trim() || program.length > 4096 || program.includes('\0')) {
    throw new Error('program must be a non-empty string');
  }
  if (!Array.isArray(args) || args.length > 256 || args.some(arg => typeof arg !== 'string' || arg.includes('\0'))) {
    throw new Error('args must contain only strings');
  }
  const argSizes = args.map(arg => Buffer.byteLength(arg, 'utf8'));
  if (argSizes.some(size => size > 32_768)) throw new Error('per-argument byte limit exceeded');
  if (argSizes.reduce((total, size) => total + size, 0) > 131_072) throw new Error('aggregate argument byte limit exceeded');
  if (!Number.isInteger(timeoutMs) || Number(timeoutMs) < 1 || Number(timeoutMs) > 120_000) {
    throw new Error('timeoutMs out of range');
  }
  return { executable: program, args: [...args] as string[], cwd: approvedCwd, timeoutMs: Number(timeoutMs) };
}

export interface WorkspaceWorkerResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  appContainerPid?: number;
  enforcement: string;
  violation?: string;
}

const TERMINAL_ENFORCEMENT_VIOLATIONS = new Set(['filesystem', 'network_gate', 'executable_sealing']);

export class CueEnforcementViolationError extends Error {
  readonly code = 'CUE_ENFORCEMENT_VIOLATION';
  readonly violation: string;

  constructor(violation: string) {
    super(`CUE_ENFORCEMENT_VIOLATION: ${violation}`);
    this.name = 'CueEnforcementViolationError';
    this.violation = violation;
  }
}

function boundedDiagnostic(value: string): { text: string; truncated: boolean } {
  const redacted = value.replace(/((?:token|secret|password|api[_-]?key)\s*[:=]\s*)[^\s;]+/giu, '$1[REDACTED]');
  const maximum = 7_500;
  return redacted.length <= maximum
    ? { text: redacted, truncated: false }
    : { text: `${redacted.slice(0, maximum)}\n[CUE_OUTPUT_TRUNCATED]`, truncated: true };
}

export function workspaceToolResponse(result: WorkspaceWorkerResult): {
  contentItems: Array<{ type: 'inputText'; text: string }>;
  success: boolean;
} {
  const stdout = boundedDiagnostic(result.stdout);
  const stderr = boundedDiagnostic(result.stderr);
  const payload = {
    exitCode: result.exitCode,
    appContainerPid: result.appContainerPid ?? null,
    enforcement: result.enforcement,
    violation: result.violation ?? null,
    stdout: stdout.text,
    stderr: stderr.text,
    truncated: stdout.truncated || stderr.truncated,
  };
  return {
    contentItems: [{ type: 'inputText', text: JSON.stringify(payload) }],
    success: result.exitCode === 0 && result.violation === undefined,
  };
}

export interface HostCodexTransport {
  readable: Readable;
  writable: Writable;
}

export interface WorkspaceToolContext {
  threadId: string;
  turnId: string;
  callId: string;
  signal: AbortSignal;
}

export type WorkspaceToolRunner = (
  command: CueWorkspaceCommand,
  context: WorkspaceToolContext,
) => Promise<WorkspaceWorkerResult>;

export interface HostCodexRunOptions {
  cwd: string;
  workspaceCwd?: string;
  goal: string;
  model?: string;
}

export interface HostCodexRunResult {
  threadId: string;
  turnId: string;
  status: string;
  finalMessage: string;
}

interface PendingRequest {
  method: string;
  resolve(value: unknown): void;
  reject(reason: Error): void;
  timer: NodeJS.Timeout;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function rpcError(error: unknown): Error {
  if (error instanceof Error) return error;
  const data = record(error);
  return new Error(typeof data.message === 'string' ? data.message : String(error));
}

function thrownEnforcementViolation(error: unknown): string | undefined {
  const value = record(error);
  return value.code === 'CUE_WORKER_ENFORCEMENT_VIOLATION'
    && typeof value.violation === 'string'
    && TERMINAL_ENFORCEMENT_VIOLATIONS.has(value.violation)
    ? value.violation
    : undefined;
}

function finalAgentText(item: Record<string, unknown>): string | undefined {
  if (item.type !== 'agentMessage') return undefined;
  if (typeof item.text === 'string') return item.text;
  if (!Array.isArray(item.content)) return undefined;
  return item.content
    .map(part => isRecord(part) && typeof part.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n');
}

export class HostCodexRpcSession {
  readonly #transport: HostCodexTransport;
  readonly #runner: WorkspaceToolRunner;
  readonly #requestTimeoutMs: number;
  readonly #runTimeoutMs: number;
  readonly #lines: ReadLineInterface;
  readonly #pending = new Map<number, PendingRequest>();
  readonly #seenCallIds = new Set<string>();
  readonly #abort = new AbortController();
  #nextId = 0;
  #activeToolCalls = 0;
  #toolCallCount = 0;
  #cwd = '';
  #threadId = '';
  #turnId = '';
  #finalMessage = '';
  #terminal?: {
    resolve(value: HostCodexRunResult): void;
    reject(reason: Error): void;
    timer: NodeJS.Timeout;
  };
  #earlyTerminal?: HostCodexRunResult;
  #fatalError?: Error;
  #enforcementViolation?: string;
  #turnCompleted = false;
  #closed = false;
  #ran = false;

  constructor(
    transport: HostCodexTransport,
    runner: WorkspaceToolRunner,
    options: { requestTimeoutMs?: number; runTimeoutMs?: number } = {},
  ) {
    this.#transport = transport;
    this.#runner = runner;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.#runTimeoutMs = options.runTimeoutMs ?? 900_000;
    this.#lines = createInterface({ input: transport.readable });
    this.#lines.on('line', line => this.#receive(line));
    this.#lines.once('close', () => {
      if (!this.#closed) this.#fail(new Error('Codex app-server stream closed before turn completion'));
    });
    transport.readable.on('error', error => this.#fail(rpcError(error)));
    transport.writable.on('error', error => this.#fail(rpcError(error)));
  }

  #send(message: Record<string, unknown>): void {
    if (this.#closed || this.#transport.writable.destroyed) throw new Error('Codex app-server transport closed');
    this.#transport.writable.write(`${JSON.stringify(message)}\n`);
  }

  #request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this.#nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`${method} timed out after ${this.#requestTimeoutMs}ms`));
      }, this.#requestTimeoutMs);
      timer.unref?.();
      this.#pending.set(id, { method, resolve, reject, timer });
      this.#send({ id, method, params });
    });
  }

  #respond(id: unknown, result: unknown): void {
    this.#send({ id, result });
  }

  #reject(id: unknown, code: number, message: string): void {
    this.#send({ id, error: { code, message } });
  }

  #sealEnforcement(id: unknown, violation: string, response: unknown): void {
    // Poison the turn before returning the denial. PassThrough transports can
    // deliver a follow-up request re-entrantly while #respond is writing.
    this.#enforcementViolation = violation;
    this.#abort.abort();
    this.#respond(id, response);
    if (this.#threadId && this.#turnId && !this.#closed) {
      void this.#request('turn/interrupt', { threadId: this.#threadId, turnId: this.#turnId }).catch(() => undefined);
    }
    this.#fail(new CueEnforcementViolationError(violation));
  }

  #receive(line: string): void {
    let message: Record<string, unknown>;
    try {
      message = record(JSON.parse(line));
    } catch {
      this.#fail(new Error('Codex app-server emitted invalid JSON'));
      return;
    }
    if (typeof message.method === 'string') {
      if (message.id !== undefined) {
        void this.#handleServerRequest(message).catch(error => {
          if (!this.#closed) this.#fail(rpcError(error));
        });
      } else this.#handleNotification(message.method, record(message.params));
      return;
    }
    if (typeof message.id === 'number') {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error !== undefined) pending.reject(rpcError(message.error));
      else {
        if (pending.method === 'turn/start') {
          const turnId = record(record(message.result).turn).id;
          if (typeof turnId !== 'string' || !turnId) {
            pending.reject(new Error('turn/start returned no turn id'));
            return;
          }
          this.#turnId = turnId;
        }
        pending.resolve(message.result);
      }
    }
  }

  async #handleServerRequest(message: Record<string, unknown>): Promise<void> {
    const method = String(message.method);
    const id = message.id;
    if (method === 'item/tool/call') {
      const params = record(message.params);
      try {
        if (this.#turnCompleted) throw new Error('dynamic tool call after turn completion');
        if (this.#enforcementViolation) throw new Error(`dynamic tool call after enforcement violation: ${this.#enforcementViolation}`);
        if (typeof params.threadId !== 'string' || params.threadId !== this.#threadId) throw new Error('dynamic tool thread mismatch');
        if (typeof params.turnId !== 'string' || params.turnId !== this.#turnId) throw new Error('dynamic tool turn mismatch');
        if (typeof params.callId !== 'string' || !params.callId || params.callId.length > 256) throw new Error('dynamic tool call id required');
        if (this.#seenCallIds.has(params.callId)) throw new Error('duplicate dynamic tool call id');
        this.#seenCallIds.add(params.callId);
        const command = parseCueWorkspaceCall(params, this.#cwd);
        if (this.#toolCallCount >= 64) throw new Error('dynamic tool call cap exceeded');
        if (this.#activeToolCalls !== 0) throw new Error('concurrent dynamic tool call denied');
        this.#toolCallCount += 1;
        this.#activeToolCalls += 1;
        let result: WorkspaceWorkerResult;
        try {
          try {
            result = await this.#runner(command, {
              threadId: params.threadId,
              turnId: params.turnId,
              callId: params.callId,
              signal: this.#abort.signal,
            });
          } catch (error) {
            const violation = thrownEnforcementViolation(error);
            if (!violation) throw error;
            const diagnostic = boundedDiagnostic(rpcError(error).message).text;
            this.#sealEnforcement(id, violation, { contentItems: [{ type: 'inputText', text: diagnostic }], success: false });
            return;
          }
        } finally {
          this.#activeToolCalls -= 1;
        }
        const response = workspaceToolResponse(result);
        if (result.violation && TERMINAL_ENFORCEMENT_VIOLATIONS.has(result.violation)) {
          this.#sealEnforcement(id, result.violation, response);
          return;
        }
        this.#respond(id, response);
      } catch (error) {
        const diagnostic = boundedDiagnostic(rpcError(error).message).text;
        this.#respond(id, { contentItems: [{ type: 'inputText', text: diagnostic }], success: false });
      }
      return;
    }
    if (method === 'item/commandExecution/requestApproval' || method === 'item/fileChange/requestApproval') {
      this.#respond(id, { decision: 'decline' });
      return;
    }
    if (method === 'execCommandApproval' || method === 'applyPatchApproval') {
      this.#respond(id, { decision: 'denied' });
      return;
    }
    this.#reject(id, -32601, `Cue declined unsupported server request: ${method}`);
  }

  #handleNotification(method: string, params: Record<string, unknown>): void {
    if (method === 'item/completed') {
      if (params.threadId !== this.#threadId || params.turnId !== this.#turnId) return;
      const text = finalAgentText(record(params.item));
      if (text !== undefined) this.#finalMessage = text;
      return;
    }
    if (method !== 'turn/completed') return;
    const turn = record(params.turn);
    if (params.threadId !== this.#threadId || turn.id !== this.#turnId) return;
    this.#turnCompleted = true;
    const threadId = this.#threadId;
    const turnId = this.#turnId;
    const status = String(turn.status ?? 'unknown');
    const value = { threadId, turnId, status, finalMessage: this.#finalMessage };
    if (!this.#terminal) {
      this.#earlyTerminal = value;
      return;
    }
    const terminal = this.#terminal;
    this.#terminal = undefined;
    clearTimeout(terminal.timer);
    terminal.resolve(value);
  }

  #fail(error: Error): void {
    this.#fatalError ??= error;
    this.#earlyTerminal = undefined;
    for (const [id, pending] of this.#pending) {
      this.#pending.delete(id);
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    if (this.#terminal) {
      const terminal = this.#terminal;
      this.#terminal = undefined;
      clearTimeout(terminal.timer);
      terminal.reject(error);
    }
  }

  async run(options: HostCodexRunOptions): Promise<HostCodexRunResult> {
    if (this.#ran) throw new Error('HostCodexRpcSession can run only once');
    this.#ran = true;
    this.#cwd = options.workspaceCwd ?? options.cwd;
    await this.#request('initialize', {
      clientInfo: { name: 'cue_desktop', title: 'Cue Desktop', version: '0.1.0' },
      capabilities: { experimentalApi: true },
    });
    this.#send({ method: 'initialized', params: {} });
    const threadResult = record(await this.#request('thread/start', buildHostThreadStartParams(options.cwd, options.goal, options.model) as unknown as Record<string, unknown>));
    this.#threadId = String(record(threadResult.thread).id ?? '');
    if (!this.#threadId) throw new Error('thread/start returned no thread id');

    const turnResult = record(await this.#request('turn/start', {
      threadId: this.#threadId,
      input: [{ type: 'text', text: `Execute the approved goal now and verify it before finishing.\nGoal: ${options.goal}` }],
    }));
    const returnedTurnId = String(record(turnResult.turn).id ?? '');
    if (!returnedTurnId || returnedTurnId !== this.#turnId) throw new Error('turn/start returned inconsistent turn id');
    if (this.#fatalError) throw this.#fatalError;
    const terminal = new Promise<HostCodexRunResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#terminal = undefined;
        reject(new Error(`Codex turn timed out after ${this.#runTimeoutMs}ms`));
      }, this.#runTimeoutMs);
      timer.unref?.();
      this.#terminal = { resolve, reject, timer };
    });
    if (this.#earlyTerminal && this.#terminal) {
      const early = this.#earlyTerminal;
      this.#earlyTerminal = undefined;
      const pendingTerminal = this.#terminal;
      this.#terminal = undefined;
      clearTimeout(pendingTerminal.timer);
      pendingTerminal.resolve(early);
    }
    return terminal;
  }

  interrupt(): void {
    this.#abort.abort();
    if (this.#threadId && this.#turnId && !this.#closed) {
      void this.#request('turn/interrupt', { threadId: this.#threadId, turnId: this.#turnId }).catch(() => undefined);
    }
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#abort.abort();
    this.#fail(new Error('HostCodexRpcSession closed'));
    this.#lines.close();
    this.#transport.writable.end();
  }
}
