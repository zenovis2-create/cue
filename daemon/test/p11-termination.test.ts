import { afterEach, describe, expect, it, vi } from 'vitest';
import * as launch from '../src/process-launch.js';
import { terminateTree } from '../src/host-codex-runtime.js';

afterEach(() => vi.restoreAllMocks());
describe.skipIf(process.platform !== 'win32')('P11 fail-closed process termination', () => {
  it('brands a thrown launch-resolution error as unverified termination', () => {
    vi.spyOn(launch, 'runProcessSync').mockImplementation(() => { throw new Error('executable not found'); });
    const child = { pid: 123456789, exitCode: null, signalCode: null, kill: vi.fn() } as any;
    expect(() => terminateTree(child)).toThrow(/CUE_TERMINATION_UNVERIFIED/);
  });
  it('refuses to declare termination when the process-tree observation fails', () => {
    vi.spyOn(launch, 'runProcessSync').mockReturnValue({ status: 1, stdout: '', stderr: 'observation failed' } as any);
    const child = { pid: 123456789, exitCode: null, signalCode: null, kill: vi.fn() } as any;
    expect(() => terminateTree(child)).toThrow(/CUE_TERMINATION_UNVERIFIED/);
  });
  it('refuses to declare termination after a failed kill while the attributed process is alive', () => {
    vi.spyOn(launch, 'runProcessSync').mockImplementation((command) => ({
      status: command.includes('powershell') ? 0 : 1,
      stdout: command.includes('powershell') ? '[123456789]' : '', stderr: '',
    }) as any);
    vi.spyOn(process, 'kill').mockReturnValue(true);
    const child = { pid: 123456789, exitCode: null, signalCode: null, kill: vi.fn() } as any;
    expect(() => terminateTree(child)).toThrow(/CUE_TERMINATION_UNVERIFIED/);
  });
});
