import { afterEach, expect, test, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const state = vi.hoisted(() => ({ calls: [] as { args: string[]; input?: Buffer }[], dead: vi.fn(), terminate: vi.fn() }));
vi.mock('../src/change-snapshot-host.js', () => ({ identifyChangeSnapshotRoot: () => ({ state: 'ok', identity: { volumeSerial: '1', fileId: '2' } }) }));
vi.mock('../src/readonly-verifier-control.js', () => ({ snapshotReadonlyVerifierControl: (value: unknown) => value, verifyReadonlyVerifierControl: () => true }));
vi.mock('../src/readonly-verifier-identity-store.js', () => ({ createReadonlyVerifierIdentityStore: () => ({ record: vi.fn(), cleanup: vi.fn() }) }));
vi.mock('../src/process-termination.js', () => ({ terminateVerifiedTree: state.terminate, verifyProcessesDead: state.dead }));
vi.mock('../src/process-launch.js', () => {
  class Events {
    listeners = new Map<string, ((value: any) => void)[]>();
    on(name: string, fn: (value: any) => void) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]); return this; }
    once(name: string, fn: (value: any) => void) { return this.on(name, fn); }
    emit(name: string, value: any) { for (const fn of this.listeners.get(name) ?? []) fn(value); }
  }
  return {
    resolveOwnedExecutable: () => 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    spawnOwned: (_db: unknown, owner: any, _command: string, args: string[]) => {
      const index = state.calls.push({ args }) - 1, stdout = new Events(), stderr = new Events(), child = new Events() as any;
      child.stdout = stdout; child.stderr = stderr; child.exitCode = null; child.kill = vi.fn();
      if (index === 0) queueMicrotask(() => { stdout.emit('data', 'O:BAG:BAD:(A;;FA;;;SY)\r\n'); child.exitCode = 0; child.emit('close', 0); });
      else child.stdin = { once: vi.fn(), end(value: string) { state.calls[index]!.input = Buffer.from(value); queueMicrotask(() => { stdout.emit('data', 'CUE_READONLY_PID=321;CREATED_FILE_TIME=12345678901\r\n'); child.exitCode = 1; child.emit('close', 1); }); } };
      return { child, session: { ...owner, handle: `session-${index}`, pid: 100 + index, start_time: 'fixture' } };
    },
  };
});

const roots: string[] = [];
afterEach(() => { vi.clearAllMocks(); state.calls.length = 0; for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test('writes an LF-terminated bootstrap and parses an exact CRLF PID line without promoting failed execution', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cue-readonly-bootstrap-')); roots.push(root);
  const worktree = join(root, 'worktree'), runtime = join(root, 'runtime'); mkdirSync(worktree); mkdirSync(runtime);
  const { createHash } = await import('node:crypto');
  const launcher = join(root, 'launcher.ps1'), executable = join(root, 'checker.exe'), launcherBytes = Buffer.from('param($PayloadBase64)'); writeFileSync(launcher, launcherBytes); writeFileSync(executable, 'fixture');
  const control = { executable, launcher, executableSha256: 'a'.repeat(64), launcherSha256: createHash('sha256').update(launcherBytes).digest('hex'), sha256: 'c'.repeat(64) } as any;
  const command = { argv: ['--fixture'], timeoutMs: 100, commandDigest: '' };
  const environmentContractDigest = createHash('sha256').update(JSON.stringify({ version: 'cue-readonly-env-v1', keys: ['APPDATA','HOME','LOCALAPPDATA','TEMP','TMP','USERPROFILE','SystemRoot','WINDIR'], systemRoot: process.env.SystemRoot ?? 'C:\\Windows' })).digest('hex');
  command.commandDigest = createHash('sha256').update(JSON.stringify({ argv: command.argv, timeoutMs: command.timeoutMs, control: control.sha256, environmentContractDigest })).digest('hex');
  const stage = { attemptId: 'attempt', owner: { cwd: resolve(worktree), task_id: 'stage-task', run_id: 'attempt' }, envelope: { worktree_realpath: resolve(worktree), egress: [], allowed_actions: ['command'] } } as any;
  const db = { inTransaction: false, prepare: () => ({ get: () => ({ role: 'verifier', candidate_id: 'checker', expected_subject_digest: 'd'.repeat(64) }) }) } as any;
  const { createReadonlyVerifierWorker } = await import('../src/readonly-verifier-worker.js');
  const worker = createReadonlyVerifierWorker({ db, control, runtimeRootBase: runtime, resolveBinding: () => ({ stage, command }) });
  const result = await worker.launch('attempt', new AbortController().signal);
  expect(state.calls[0]!.args).toEqual(['-NoProfile','-NonInteractive','-Command', `(Get-Acl -LiteralPath '${resolve(worktree)}').Sddl`]);
  expect(state.calls[1]!.args).toEqual(['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command','-']);
  const input = state.calls[1]!.input!; expect(input.at(-1)).toBe(0x0a); expect(input.subarray(-2).equals(Buffer.from('\\n'))).toBe(false);
  expect(state.dead).toHaveBeenCalledWith([321]);
  expect(result).toMatchObject({ outcome: 'failed', exitCode: 1, identityRef: null, cleanupRef: null });
});
