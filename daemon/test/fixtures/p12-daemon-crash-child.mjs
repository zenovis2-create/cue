import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCueCore, initializeConfig } from '../../../app/core.mjs';

const [stateRoot, worktree, sourceHome] = process.argv.slice(2);
mkdirSync(worktree, { recursive: true });
mkdirSync(sourceHome, { recursive: true });
writeFileSync(join(sourceHome, 'auth.json'), '{}');
const never = new Promise(() => {});
const core = createCueCore(
  initializeConfig(stateRoot, { worktreeRoot: worktree }),
  undefined,
  {
    binary: process.execPath,
    codexHome: sourceHome,
    launchHost: async () => ({
      session: { pid: process.pid },
      child: { pid: process.pid },
      stop() {},
      done: never,
    }),
  },
);
const active = core.prepareGoal('Create active.txt', 1);
core.approve(active.runId);
core.execute(active.runId);
const queued = core.prepareGoal('Create queued.txt', 1);
core.approve(queued.runId);
core.execute(queued.runId);
process.stdout.write(`${JSON.stringify({ ready: true, active, queued, pid: process.pid })}\n`);
setInterval(() => {}, 1000);
