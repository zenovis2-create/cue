import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
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
  if (!isAbsolute(path) || !/[\\/]vendor[\\/]/i.test(path) || /[\\/]\.bin[\\/]|npm(?:\.cmd)?$/i.test(path)) throw new Error('vendor binary absolute path required');
  return path;
}
export function vendorCodexLaunchSpec(path: string, args: readonly string[], codexHome: string): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  const allowed = ['PATH','Path','PATHEXT','SYSTEMROOT','SystemRoot','WINDIR','TEMP','TMP','LOCALAPPDATA','APPDATA','PROGRAMDATA','ProgramFiles','ProgramFiles(x86)','COMSPEC'];
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowed) if (process.env[key] !== undefined) env[key] = process.env[key];
  env.CODEX_HOME = codexHome;
  return { command: assertVendorBinary(path), args: [...args], env };
}
