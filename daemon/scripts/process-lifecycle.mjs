import { spawnSync } from 'node:child_process';

/**
 * Terminate a spawned process tree and wait for the child handle to close.
 * @param {import('node:child_process').ChildProcess | undefined} child
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
export async function stopProcessTree(child, timeoutMs = 5_000) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;

  const closed = new Promise((resolve, reject) => {
    let timer;
    const onClose = () => {
      clearTimeout(timer);
      resolve();
    };
    child.once('close', onClose);
    timer = setTimeout(() => {
      child.off('close', onClose);
      reject(new Error(`process tree ${child.pid} did not close within ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref?.();
  });

  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { child.kill('SIGKILL'); } catch { /* already exited */ }
  }
  await closed;
}
