import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { initializeConfig } from './core.mjs';

export async function initializeFirstRunConfig(userDataPath, options = {}) {
  const configPath = join(userDataPath, 'cue-config.json');
  if (existsSync(configPath)) return initializeConfig(userDataPath);

  let worktreeRoot = options.worktreeOverride ? resolve(options.worktreeOverride) : undefined;
  if (!worktreeRoot && options.chooseDirectory) {
    const chosen = await options.chooseDirectory();
    if (!chosen) throw new Error('workspace selection cancelled');
    worktreeRoot = resolve(chosen);
  }
  worktreeRoot ??= resolve(options.defaultRoot ?? process.cwd());
  return initializeConfig(userDataPath, { worktreeRoot });
}
