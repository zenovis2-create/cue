import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
export const CLEAN_CONFIG = `web_search = "disabled"\n\n[features]\napps = false\nauth_elicitation = false\nbrowser_use = false\nbrowser_use_external = false\nbrowser_use_full_cdp_access = false\ncode_mode_host = false\ncomputer_use = false\nhooks = false\nimage_generation = false\nin_app_browser = false\nin_app_local_automation = false\nin_app_updates = false\nmcp = false\nmulti_agent = false\nplugin_sharing = false\nplugins = false\nremote_plugin = false\nrequest_permissions_tool = false\nshell_tool = false\nskill_mcp_dependency_install = false\nskill_search = false\nskills = false\ntool_call_mcp_elicitation = false\ntool_suggest = false\n\n[tools.experimental_request_user_input]\nenabled = false\n\n[tools.update_plan]\nenabled = false\n\n[orchestrator.skills]\nenabled = false\n\n[orchestrator.mcp]\nenabled = false\n`;
export function createCleanCodexHome(parent: string, authPath: string): string {
  mkdirSync(parent, { recursive: true });
  const home = mkdtempSync(join(parent, 'codex-home-'));
  try {
    copyFileSync(authPath, join(home, 'auth.json'));
    writeFileSync(join(home, 'config.toml'), CLEAN_CONFIG, { mode: 0o600 });
    const entries = readdirSync(home).sort();
    if (entries.join(',') !== 'auth.json,config.toml') throw new Error('unclean tool home');
    return home;
  } catch (error) {
    rmSync(home, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
    throw error;
  }
}
export function safeCleanupCodexHome(codexHome: string): void {
  if (!basename(codexHome).startsWith('codex-home-')) throw new Error(`unsafe controller home cleanup refused: ${codexHome}`);
  rmSync(codexHome, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
}
export function assertVendorBinary(path: string): string {
  if (!isAbsolute(path) || !/[\\/]vendor[\\/]/i.test(path) || /[\\/]\.bin[\\/]|npm(?:\.cmd)?$/i.test(path)) throw new Error('vendor binary absolute path required');
  return path;
}
export function vendorCodexLaunchSpec(path: string, args: readonly string[], codexHome: string): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  const allowed = ['PATH','Path','PATHEXT','SYSTEMROOT','SystemRoot','WINDIR','PROGRAMDATA','ProgramFiles','ProgramFiles(x86)','COMSPEC'];
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowed) if (process.env[key] !== undefined) env[key] = process.env[key];
  const appData = join(codexHome, 'appdata');
  const localAppData = join(codexHome, 'localappdata');
  const temporary = join(codexHome, 'tmp');
  for (const directory of [appData, localAppData, temporary]) mkdirSync(directory, { recursive: true });
  Object.assign(env, {
    CODEX_HOME: codexHome,
    HOME: codexHome,
    USERPROFILE: codexHome,
    APPDATA: appData,
    LOCALAPPDATA: localAppData,
    TEMP: temporary,
    TMP: temporary,
  });
  return { command: assertVendorBinary(path), args: [...args], env };
}
