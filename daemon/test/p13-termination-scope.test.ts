import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { observeProcessTree, terminateVerifiedTree } from '../src/process-termination.js';

// P13 R-2a. A PID is not an identity. Windows recycles PIDs, so a "descendant set"
// built from ParentProcessId alone can absorb unrelated live processes - including the
// test host itself, which then dies mid-run and produces no exit code at all.
// Absolute rules: measurement over assumption (1), timeouts are FAIL (2), and never
// widen the kill to make a stop succeed (5).

const win32 = process.platform === 'win32';

describe('P13 termination scope', () => {
  it.runIf(win32)('T1 never places this process or an ancestor inside a foreign tree closure', () => {
    const { descendants, selfChain } = observeProcessTree(process.pid);
    expect(selfChain).toContain(process.pid);
    // The closure of our own pid legitimately contains us; the guard is that the
    // walk is anchored and bounded, not that it is empty.
    expect(descendants.some((entry) => entry.pid === process.pid)).toBe(true);
    for (const entry of descendants) {
      expect(Number.isSafeInteger(entry.pid)).toBe(true);
      expect(entry.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    }
  });

  it.runIf(win32)('T2 requires a child to be younger than the parent it is attributed to', async () => {
    // The host process is far older than any child we spawn now. If parent/child
    // edges ignored creation time, an ancestor could be reattached under a recycled
    // pid and swept up.
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], { stdio: 'ignore' });
    try {
      await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      const { descendants } = observeProcessTree(child.pid!);
      const self = descendants.find((entry) => entry.pid === process.pid);
      expect(self, 'host must never appear beneath a freshly spawned child').toBeUndefined();
      const target = descendants.find((entry) => entry.pid === child.pid);
      expect(target).toBeDefined();
      for (const entry of descendants) {
        expect(new Date(entry.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(target!.createdAt).getTime() - 1000);
      }
    } finally {
      child.kill('SIGKILL');
    }
  });

  it.runIf(win32)('T3 refuses to terminate a tree whose closure reaches this process', () => {
    // Killing our own tree would look like a clean shutdown while destroying the run.
    // The contract is refusal, and the refusal must be distinguishable from
    // "death could not be verified".
    let error: (Error & { code?: string }) | null = null;
    try { terminateVerifiedTree(process.pid); }
    catch (thrown) { error = thrown as Error & { code?: string }; }
    expect(error, 'terminating our own tree must not silently succeed').not.toBeNull();
    expect(error!.code).toBe('CUE_TERMINATION_OUT_OF_SCOPE');
    expect(error!.message).toMatch(/ancestor|this process/i);
  });

  it('T4 rejects an invalid pid instead of guessing', () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => terminateVerifiedTree(bad)).toThrow(/CUE_TERMINATION/);
    }
  });
});
