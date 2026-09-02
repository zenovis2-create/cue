import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
export const CLEAN_CONFIG = `[features]\nhooks = false\nmcp = false\nplugins = false\nskills = false\n`;
export function createCleanCodexHome(parent: string, authPath: string): string {
  mkdirSync(parent, { recursive: true });
  const home = mkdtempSync(join(parent, 'codex-home-'));
  copyFileSync(authPath, join(home, 'auth.json'));
  writeFileSync(join(home, 'config.toml'), CLEAN_CONFIG, { mode: 0o600 });
  const entries = readdirSync(home).sort();
  if (entries.join(',') !== 'auth.json,config.toml') throw new Error('unclean tool home');
  return home;
}
export function assertVendorBinary(path: string): string {
  if (!isAbsolute(path) || !/vendor/i.test(path) || /node_modules|npm(?:\.cmd)?$/i.test(path)) throw new Error('vendor binary absolute path required');
  return path;
}
export function spawnVendorCodex(path: string, args: string[], codexHome: string, options: SpawnOptions = {}): ChildProcess {
  const command = assertVendorBinary(path);
  return spawn(command,args,{...options,env:{...process.env,...options.env,CODEX_HOME:codexHome},shell:false});
}
