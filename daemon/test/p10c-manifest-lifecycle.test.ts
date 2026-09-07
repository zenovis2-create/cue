import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

const roots: string[] = [];
const children: ChildProcess[] = [];
afterEach(() => {
  for (const child of children.splice(0)) {
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    }
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe.skipIf(process.platform !== 'win32')('manifest proof process lifecycle', () => {
  it('waits for the child to close before its current working directory is removed', async () => {
    // @ts-expect-error The lifecycle helper is an ESM evidence script, not daemon runtime code.
    const { stopProcessTree } = await import('../scripts/process-lifecycle.mjs');
    const root = mkdtempSync(join(tmpdir(), 'cue-manifest-lifecycle-'));
    roots.push(root);
    const cwd = join(root, 'controller-workspace');
    mkdirSync(cwd);
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
      cwd,
      stdio: 'ignore',
      windowsHide: true,
    });
    children.push(child);
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });

    await stopProcessTree(child, 5_000);
    rmSync(root, { recursive: true, force: true });

    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
    expect(existsSync(root)).toBe(false);
  }, 15_000);
});
