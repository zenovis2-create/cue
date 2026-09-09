import { runProcessSync } from '../process-launch.js';

// P13 R-2a. Judgement inputs must be run-scoped. Counting global `codex.exe`
// processes lets an unrelated session decide a verdict, so a probe starts from a
// root PID it created itself and closes the set over full process identity:
// pid + ppid + creation time + executable path + command line.
//
// Processes outside that closure do not exist for the verdict. We never kill them
// and never count them as failures.

export interface ProcessIdentity {
  pid: number;
  ppid: number;
  createdAt: string;
  exePath: string | null;
  commandLine: string | null;
}

export interface RunScope {
  rootPid: number;
  rootCreatedAt: string;
  members: ProcessIdentity[];
}

export class ScopeError extends Error {
  constructor(message: string) { super(`CUE_SCOPE: ${message}`); }
}

const SCRIPT = (rootPid: number): string => `
$ErrorActionPreference='Stop'
$all = @(Get-CimInstance Win32_Process -ErrorAction Stop |
  Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine)
$byPid = @{}
foreach ($p in $all) { $byPid[[int]$p.ProcessId] = $p }
$root = ${rootPid}
$set = [Collections.Generic.HashSet[int]]::new()
if ($byPid.ContainsKey($root)) { [void]$set.Add($root) }
do {
  $added = $false
  foreach ($p in $all) {
    $childId = [int]$p.ProcessId
    $parentId = [int]$p.ParentProcessId
    if ($set.Contains($childId)) { continue }
    if (-not $set.Contains($parentId)) { continue }
    $parent = $byPid[$parentId]
    if ($null -eq $parent) { continue }
    if ($null -eq $p.CreationDate -or $null -eq $parent.CreationDate) { continue }
    # A recycled pid cannot mother a process older than itself.
    if ($p.CreationDate -lt $parent.CreationDate) { continue }
    $added = $set.Add($childId) -or $added
  }
} while ($added)
$rows = @($set | ForEach-Object {
  $id = $_; $p = $byPid[$id]
  [ordered]@{
    pid = $id
    ppid = [int]$p.ParentProcessId
    createdAt = $p.CreationDate.ToString('o')
    exePath = $p.ExecutablePath
    commandLine = $p.CommandLine
  }
})
ConvertTo-Json -InputObject @{ members = $rows } -Compress -Depth 4
`.trim();

function query(rootPid: number): ProcessIdentity[] {
  const result = runProcessSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SCRIPT(rootPid)], { encoding: 'utf8', timeout: 20_000, windowsHide: true });
  if (result.status !== 0 || result.error) throw new ScopeError(`process query failed for root ${rootPid}`);
  const parsed = JSON.parse(result.stdout || '{"members":[]}') as { members?: unknown };
  const raw = Array.isArray(parsed.members) ? parsed.members : parsed.members ? [parsed.members] : [];
  return raw.map((entry) => {
    const value = entry as Record<string, unknown>;
    if (!Number.isSafeInteger(value.pid) || (value.pid as number) <= 0) throw new ScopeError('malformed pid in closure');
    if (typeof value.createdAt !== 'string' || value.createdAt === '') throw new ScopeError('missing creation time in closure');
    return {
      pid: value.pid as number,
      ppid: Number(value.ppid ?? 0),
      createdAt: value.createdAt,
      exePath: typeof value.exePath === 'string' ? value.exePath : null,
      commandLine: typeof value.commandLine === 'string' ? value.commandLine : null,
    };
  });
}

/** Bind a scope to a root the caller just created. The root's creation time is part
 *  of its identity from this moment on, so a later pid recycle cannot impersonate it. */
export function openRunScope(rootPid: number): RunScope {
  const members = query(rootPid);
  const root = members.find((entry) => entry.pid === rootPid);
  if (!root) throw new ScopeError(`root ${rootPid} not observable at scope open; refusing to measure an unidentified root`);
  return { rootPid, rootCreatedAt: root.createdAt, members };
}

/** Re-observe the scope. Anything whose identity does not match the bound root's
 *  lineage is treated as absent rather than as a survivor. */
export function refreshRunScope(scope: RunScope): ProcessIdentity[] {
  const observed = query(scope.rootPid);
  const root = observed.find((entry) => entry.pid === scope.rootPid);
  if (root && root.createdAt !== scope.rootCreatedAt) {
    // The pid came back as a different process. Our root is gone; its descendants
    // cannot be attributed through a stranger.
    return observed.filter((entry) => entry.pid !== scope.rootPid && scope.members.some((known) => known.pid === entry.pid && known.createdAt === entry.createdAt));
  }
  return observed;
}

/** Liveness of specific identities. Re-deriving the closure from the root is not
 *  enough: once the root dies the closure query returns nothing, so orphans that
 *  outlived their supervisor would read as "all clear" - the exact defect a P3
 *  probe exists to catch. Identity is (pid, creation time). */
export function observeIdentities(pids: readonly number[]): ProcessIdentity[] {
  if (pids.length === 0) return [];
  const list = pids.map((pid) => String(pid)).join(',');
  const script = `
$ErrorActionPreference='Stop'
$want = @(${list})
$rows = @(Get-CimInstance Win32_Process -ErrorAction Stop |
  Where-Object { $want -contains [int]$_.ProcessId } |
  ForEach-Object {
    [ordered]@{
      pid = [int]$_.ProcessId
      ppid = [int]$_.ParentProcessId
      createdAt = $_.CreationDate.ToString('o')
      exePath = $_.ExecutablePath
      commandLine = $_.CommandLine
    }
  })
ConvertTo-Json -InputObject @{ members = $rows } -Compress -Depth 4
`.trim();
  const result = runProcessSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 20_000, windowsHide: true });
  if (result.status !== 0 || result.error) throw new ScopeError('liveness query failed');
  const parsed = JSON.parse(result.stdout || '{"members":[]}') as { members?: unknown };
  const raw = Array.isArray(parsed.members) ? parsed.members : parsed.members ? [parsed.members] : [];
  return raw.map((entry) => {
    const value = entry as Record<string, unknown>;
    return {
      pid: value.pid as number,
      ppid: Number(value.ppid ?? 0),
      createdAt: String(value.createdAt ?? ''),
      exePath: typeof value.exePath === 'string' ? value.exePath : null,
      commandLine: typeof value.commandLine === 'string' ? value.commandLine : null,
    };
  });
}

/** Survivors = processes still alive whose identity was captured in this run. */
export function survivorsOf(scope: RunScope): ProcessIdentity[] {
  const known = new Map(scope.members.map((entry) => [`${entry.pid}@${entry.createdAt}`, entry]));
  // While the root still lives, keep absorbing newly spawned descendants.
  try { for (const entry of refreshRunScope(scope)) known.set(`${entry.pid}@${entry.createdAt}`, entry); } catch { /* root gone; known set stands */ }
  const live = new Set(observeIdentities([...new Set([...known.values()].map((entry) => entry.pid))]).map((entry) => `${entry.pid}@${entry.createdAt}`));
  return [...known.entries()].filter(([key]) => live.has(key)).map(([, entry]) => entry);
}

export function extendRunScope(scope: RunScope): RunScope {
  const seen = new Map(scope.members.map((entry) => [`${entry.pid}@${entry.createdAt}`, entry]));
  for (const entry of refreshRunScope(scope)) seen.set(`${entry.pid}@${entry.createdAt}`, entry);
  return { ...scope, members: [...seen.values()] };
}
