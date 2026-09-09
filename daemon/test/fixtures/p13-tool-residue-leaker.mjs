// P13 B5 fixture: a tool that is PERFECTLY WELL-BEHAVED about processes and still
// dirty. It spawns no children and exits on request, so `survivorsOf(scope)` is 0 -
// yet it leaves boundary artifacts behind: a tool home directory and a pending
// cleanup-journal row. This is the shape of v0.1's real leak (an AppContainer profile
// outliving a spotless process table), and a B5 harness that only counts survivors
// calls this run clean.
// argv: [toolHomeParent, lifetimeMs?]   lifetimeMs => exits on its own (normal path)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const parent = process.argv[2];
if (!parent) { process.stderr.write('toolHomeParent required\n'); process.exit(2); }

// Leak a tool home: created, never removed. Same naming safeCleanupCodexHome guards.
const home = join(parent, `codex-home-leak-${process.pid}`);
mkdirSync(home, { recursive: true });
writeFileSync(join(home, 'auth.json'), '{}');
process.stdout.write(`leaked home=${home}\n`);
process.stdout.write(`residue-leaker ready pid=${process.pid}\n`);

const lifetime = Number(process.argv[3] ?? 0);
if (lifetime > 0) setTimeout(() => process.exit(0), lifetime);
else setInterval(() => {}, 1000);
