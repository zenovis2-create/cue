import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Ledger } from './ledger.js';
import { vendorCodexLaunchSpec } from './tool-home.js';
import { spawnOwned, type SessionOwner } from './session-spawn.js';
import { resolveOwnedExecutable } from './process-launch.js';

function quote(value: string): string {
  return value.length && !/[\s"]/u.test(value)
    ? value
    : `"${value.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\+)$/u, '$1$1')}"`;
}

/** Legacy whole-Codex launcher retained for compatibility probes only.
 * Production Cue v0.1 uses host-codex-runtime plus AppContainer tool workers.
 */
export function spawnVendorCodexInAppContainer(
  db: Ledger,
  owner: SessionOwner,
  binary: string,
  codexHome: string,
  args: readonly string[],
) {
  const spec = vendorCodexLaunchSpec(binary, args, codexHome);
  const executable = resolveOwnedExecutable(db, owner, spec.command, [codexHome], spec.env);
  const launcher = resolveOwnedExecutable(db, owner, fileURLToPath(new URL('./appcontainer-launch.ps1', import.meta.url)));
  const disposableHome = basename(codexHome).startsWith('codex-home-');
  const payload = Buffer.from(JSON.stringify({
    executable,
    commandLine: [executable, ...spec.args].map(quote).join(' '),
    cwd: owner.cwd,
    parentPid: process.pid,
    profileName: `Cue.Worker.${randomUUID().replaceAll('-', '')}`,
    grantPaths: [codexHome],
    cleanupPaths: disposableHome ? [codexHome] : [],
  })).toString('base64');
  const launched = spawnOwned(
    db,
    owner,
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher, '-PayloadBase64', payload],
    { env: spec.env, stdio: 'pipe' },
  );
  launched.child.stdin?.end();
  let pending = '';
  launched.child.stdout?.on('data', chunk => {
    pending += String(chunk);
    const match = pending.match(/CUE_APPCONTAINER_PID=(\d+);START_TIME=([^\r\n]+)/u);
    if (!match) return;
    launched.session.pid = Number(match[1]);
    launched.session.start_time = match[2];
    if (db.open) {
      db.prepare('UPDATE session_handle SET pid=?,start_time=? WHERE handle=?')
        .run(launched.session.pid, launched.session.start_time, launched.session.handle);
    }
    pending = '';
  });
  return launched;
}
