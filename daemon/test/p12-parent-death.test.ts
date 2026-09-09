import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('P12 parent-death fail-closed contract', () => {
  it('checks host-controller job termination and bounds its parent-loss wait', () => {
    const launcher = readFileSync(join(process.cwd(), 'src', 'job-object-launch.ps1'), 'utf8');
    expect(launcher).toContain('TerminateAndWait(job, process.hProcess, 114);');
    expect(launcher).toContain('if (!TerminateJobObject(job, exitCode))');
    expect(launcher).toContain('WaitForSingleObject(process, 5000)');
    expect(launcher).toContain('WAIT_TIMEOUT');
  });

  it('checks job termination and bounds the worker-death wait after parent loss', () => {
    const launcher = readFileSync(join(process.cwd(), 'src', 'appcontainer-launch.ps1'), 'utf8');
    expect(launcher).toContain('if (!TerminateJobObject(job, 114))');
    expect(launcher).toContain('WaitForSingleObject(process.hProcess, 5000)');
    expect(launcher).toContain('WAIT_TIMEOUT');
  });
});
