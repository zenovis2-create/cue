import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('../src/process-launch.js', () => ({ runProcessSync: mocks.run }));

import { terminateVerifiedTree } from '../src/process-termination.js';

const result = (stdout: string) => ({ status: 0, stdout, stderr: '', pid: 1, signal: null, output: [] }) as any;
const tree = (createdAt: string) => JSON.stringify({
  target: 424242,
  descendants: [{ pid: 424242, ppid: 1, createdAt }],
  selfChain: [],
});

afterEach(() => { vi.restoreAllMocks(); mocks.run.mockReset(); });

describe.skipIf(process.platform !== 'win32')('verified termination creation identity', () => {
  it('refuses a rebound PID observed by the termination layer before taskkill', () => {
    mocks.run.mockReturnValue(result(tree('2026-09-15T10:00:00.1234566Z')));
    expect(() => terminateVerifiedTree(424242, '2026-09-15T10:00:00.1234567Z')).toThrow(/OUT_OF_SCOPE.*identity changed/);
    expect(mocks.run).toHaveBeenCalledOnce();
    expect(mocks.run.mock.calls.some(([command]) => command === 'taskkill.exe')).toBe(false);
  });

  it('allows an exact equivalent identity through the verified taskkill path', () => {
    vi.spyOn(process, 'kill').mockImplementation(() => { throw Object.assign(new Error('gone'), { code: 'ESRCH' }); });
    mocks.run.mockImplementation((command: string) => command === 'powershell.exe'
      ? result(tree('2026-09-15T10:00:00.1234567Z'))
      : result(''));
    expect(() => terminateVerifiedTree(424242, '2026-09-15T19:00:00.1234567+09:00')).not.toThrow();
    expect(mocks.run.mock.calls.filter(([command]) => command === 'taskkill.exe')).toHaveLength(1);
  });
});
