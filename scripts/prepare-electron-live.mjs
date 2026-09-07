import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const evidence = join(repo, 'evidence', 'P10C');
for (const leaf of ['electron-worktree', 'electron-state']) {
  rmSync(join(evidence, leaf), { recursive: true, force: true });
  mkdirSync(join(evidence, leaf), { recursive: true });
}
