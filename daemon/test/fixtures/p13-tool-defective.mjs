// P13 R-7a fixture: a DEFECTIVE tool.
// Spawns a DETACHED child that ignores the parent entirely. Killing the root leaves
// this child alive, which is exactly the failure a P1/P3 probe must catch.
// A harness that reports PASS here is checking nothing.
// argv: [childCount]
import { spawn } from 'node:child_process';

const count = Number(process.argv[2] ?? 1);
for (let i = 0; i < count; i += 1) {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 120000)'], {
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  process.stdout.write(`orphan pid=${child.pid}\n`);
}
process.stdout.write(`defective ready pid=${process.pid}\n`);
setInterval(() => {}, 1000);
