// P13 R-7a fixture: an OBEDIENT tool.
// Spawns one child that watches its parent and exits when the parent dies, so both
// stop on request and nothing survives a hard kill of the root.
// argv: [childCount, lifetimeMs?]  lifetimeMs => the root exits on its own (B5 normal path)
import { spawn } from 'node:child_process';

const count = Number(process.argv[2] ?? 1);
const parentPid = process.pid;
for (let i = 0; i < count; i += 1) {
  spawn(process.execPath, ['-e', `
    const parent = ${parentPid};
    setInterval(() => {
      try { process.kill(parent, 0); } catch { process.exit(0); }
    }, 100);
  `], { stdio: 'ignore', detached: false });
}
process.stdout.write(`obedient ready pid=${process.pid}\n`);
const lifetime = Number(process.argv[3] ?? 0);
if (lifetime > 0) setTimeout(() => process.exit(0), lifetime);
else setInterval(() => {}, 1000);
