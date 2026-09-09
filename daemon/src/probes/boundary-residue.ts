import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { runProcessSync } from '../process-launch.js';

// Sealed system executables, resolved the same way the launch/cleanup scripts do -
// a probe that let PATH pick its own powershell.exe would be measuring whatever an
// attacker put earlier on PATH.
const system32 = join(process.env.SystemRoot ?? 'C:\Windows', 'System32');
const POWERSHELL = join(system32, 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const ICACLS = join(system32, 'icacls.exe');
const SYNC_OPTS = { encoding: 'utf8' as const, windowsHide: true, timeout: 30000 };

// P13 R-3 / B5. Process residue is the CHEAPEST residue class, not the important one.
// v0.1's leak was an AppContainer profile that survived a hard kill while the process
// table was already clean - a probe that only counts survivors would have called that
// run spotless. So B5 observes every boundary artifact a run can create, and ANY class
// left behind is RED.

export type ResidueClass =
  | 'process'
  | 'appcontainer_profile'
  | 'worktree_ace'
  | 'tool_home'
  | 'cleanup_journal';

export const RESIDUE_CLASSES: readonly ResidueClass[] = [
  'process', 'appcontainer_profile', 'worktree_ace', 'tool_home', 'cleanup_journal',
];

export interface ResidueFinding {
  kind: ResidueClass;
  detail: string;
}

/** What a run claimed it would create. Every field is what the boundary OWNS, so an
 *  observer can look for it directly instead of diffing global state. */
export interface BoundarySpec {
  profileName?: string;
  worktree?: string;
  toolHomeParent?: string;
  journal?: { count: () => number };
}

const PROFILE_NAME = /^Cue\.Worker\.[0-9a-f]{32}$/;

/** Registry mappings are the same source appcontainer-profile-cleanup.ps1 verifies
 *  against, so a leak here is exactly the artifact cleanup claims to have removed. */
export function appContainerProfileCount(profileName: string): number {
  if (process.platform !== 'win32') return 0;
  if (!PROFILE_NAME.test(profileName)) throw new Error(`CUE_RESIDUE: refusing to query a non-Cue profile name: ${profileName}`);
  const script = `$root='Registry::HKEY_CURRENT_USER\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppContainer\\Mappings';`
    + `if (-not (Test-Path $root)) { Write-Output 0; exit 0 };`
    + `@(Get-ChildItem $root | Where-Object { (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).Moniker -eq '${profileName}' }).Count`;
  const result = runProcessSync(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', script], SYNC_OPTS);
  const text = String(result.stdout ?? '').trim();
  const count = Number(text);
  // No measurement is not zero measurement (absolute rule 1).
  if (!Number.isFinite(count)) throw new Error(`CUE_RESIDUE: profile count unreadable: ${JSON.stringify(text)}`);
  return count;
}

/** Any ACE naming a Cue worker SID that outlived the run. */
export function worktreeCueAceCount(worktree: string): number {
  if (process.platform !== 'win32' || !existsSync(worktree)) return 0;
  const result = runProcessSync(ICACLS, [worktree], SYNC_OPTS);
  const text = String(result.stdout ?? '');
  if (text.trim() === '') throw new Error(`CUE_RESIDUE: icacls returned nothing for ${worktree}`);
  // AppContainer SIDs live under S-1-15-2-*; a Cue worker ACE is one of ours.
  return (text.match(/S-1-15-2-[0-9-]+/g) ?? []).length;
}

export function toolHomeLeftovers(parent: string): string[] {
  if (!parent || !existsSync(parent)) return [];
  return readdirSync(parent).filter((entry) => basename(entry).startsWith('codex-home-'));
}

/** Observe every class. Returns the findings; an empty array is the only clean result. */
export function observeBoundaryResidue(spec: BoundarySpec): ResidueFinding[] {
  const findings: ResidueFinding[] = [];
  if (spec.profileName) {
    const count = appContainerProfileCount(spec.profileName);
    if (count > 0) findings.push({ kind: 'appcontainer_profile', detail: `${count} AppContainer profile mapping(s) for ${spec.profileName}` });
  }
  if (spec.worktree) {
    const count = worktreeCueAceCount(spec.worktree);
    if (count > 0) findings.push({ kind: 'worktree_ace', detail: `${count} AppContainer ACE(s) still on ${spec.worktree}` });
  }
  if (spec.toolHomeParent) {
    const homes = toolHomeLeftovers(spec.toolHomeParent);
    if (homes.length > 0) findings.push({ kind: 'tool_home', detail: `tool home(s) not removed: ${homes.join(', ')}` });
  }
  if (spec.journal) {
    const count = spec.journal.count();
    if (count > 0) findings.push({ kind: 'cleanup_journal', detail: `${count} cleanup journal row(s) still pending` });
  }
  return findings;
}

/** Which classes this spec is actually able to observe. A class that was never wired
 *  up must be reported as UNOBSERVED, never silently counted as clean. */
export function observedClasses(spec: BoundarySpec): ResidueClass[] {
  const classes: ResidueClass[] = ['process'];
  if (spec.profileName) classes.push('appcontainer_profile');
  if (spec.worktree) classes.push('worktree_ace');
  if (spec.toolHomeParent) classes.push('tool_home');
  if (spec.journal) classes.push('cleanup_journal');
  return classes;
}

export function unobservedClasses(spec: BoundarySpec): ResidueClass[] {
  const seen = new Set(observedClasses(spec));
  return RESIDUE_CLASSES.filter((kind) => !seen.has(kind));
}
