import { runProcessSync } from './process-launch.js';
import { appendFileSync } from 'node:fs';

export function terminationFailure(): Error & { code: string } {
  return Object.assign(new Error('CUE_TERMINATION_UNVERIFIED: process-tree death could not be verified; writer lease must remain held'), { code: 'CUE_TERMINATION_UNVERIFIED' });
}

export function terminationScopeFailure(detail: string): Error & { code: string } {
  return Object.assign(new Error(`CUE_TERMINATION_OUT_OF_SCOPE: ${detail}`), { code: 'CUE_TERMINATION_OUT_OF_SCOPE' });
}

export interface ObservedProcess { pid: number; ppid: number; createdAt: string }

// Diagnostic only: records exactly which pids a kill is about to sweep, immediately
// before taskkill runs. Off unless CUE_TERMINATION_AUDIT names a file, and it must
// never change the decision - a diagnostic that alters behaviour measures itself.
function auditClosure(target: number, descendants: readonly ObservedProcess[], selfChain: readonly number[]): void {
  const path = process.env.CUE_TERMINATION_AUDIT;
  if (!path) return;
  try {
    appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), auditor: process.pid, target, selfChain, descendants })}\n`, 'utf8');
  } catch { /* diagnostics must never break termination */ }
}

/** Check the entire attributed tree; taskkill's exit status alone is not proof. */
export function terminateVerifiedTree(pid: number): void {
  try { terminateObservedTree(pid); }
  catch (error) {
    // An out-of-scope tree is a FAIL, never a kill. Surface it as-is so the caller
    // cannot mistake "we refused to kill" for "we could not verify death".
    if ((error as { code?: string }).code === 'CUE_TERMINATION_OUT_OF_SCOPE') throw error;
    throw terminationFailure();
  }
}

// A PID alone does not identify a process: Windows reuses PIDs, so a live process can
// name a recycled PID as its parent and get swept into an unrelated "descendant" set.
// Every edge therefore requires the child to have started at or after its parent, and
// the resulting closure must not contain this process or any of its ancestors.
const TREE_SCRIPT = (targetPid: number, selfPid: number): string => `
$ErrorActionPreference='Stop'
$all = @(Get-CimInstance Win32_Process -ErrorAction Stop | Select-Object ProcessId,ParentProcessId,CreationDate)
$byPid = @{}
foreach ($p in $all) { $byPid[[int]$p.ProcessId] = $p }
$target = ${targetPid}
$descendants = [Collections.Generic.HashSet[int]]::new()
if ($byPid.ContainsKey($target)) { [void]$descendants.Add($target) }
do {
  $added = $false
  foreach ($p in $all) {
    $childId = [int]$p.ProcessId
    $parentId = [int]$p.ParentProcessId
    if ($descendants.Contains($childId)) { continue }
    if (-not $descendants.Contains($parentId)) { continue }
    $parent = $byPid[$parentId]
    if ($null -eq $parent) { continue }
    if ($null -eq $p.CreationDate -or $null -eq $parent.CreationDate) { continue }
    if ($p.CreationDate -lt $parent.CreationDate) { continue }
    $added = $descendants.Add($childId) -or $added
  }
} while ($added)
$ancestors = [Collections.Generic.HashSet[int]]::new()
$walk = ${selfPid}
$guard = 0
while ($byPid.ContainsKey($walk) -and $guard -lt 64) {
  [void]$ancestors.Add($walk)
  $node = $byPid[$walk]
  $next = [int]$node.ParentProcessId
  if ($next -le 0 -or $ancestors.Contains($next)) { break }
  $parent = $byPid[$next]
  if ($null -eq $parent) { break }
  if ($null -ne $node.CreationDate -and $null -ne $parent.CreationDate -and $node.CreationDate -lt $parent.CreationDate) { break }
  $walk = $next
  $guard++
}
$out = [ordered]@{
  target = $target
  descendants = @($descendants | ForEach-Object { $id = $_; $p = $byPid[$id]; [ordered]@{ pid = $id; ppid = [int]$p.ParentProcessId; createdAt = $p.CreationDate.ToString('o') } })
  selfChain = @($ancestors)
}
ConvertTo-Json -InputObject $out -Compress -Depth 4
`.trim();

export function observeProcessTree(pid: number, selfPid: number = process.pid): { descendants: ObservedProcess[]; selfChain: number[] } {
  const observed = runProcessSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', TREE_SCRIPT(pid, selfPid)], { encoding: 'utf8', timeout: 15_000, windowsHide: true });
  if (observed.status !== 0 || observed.error || observed.stderr.trim()) throw terminationFailure();
  const parsed: unknown = JSON.parse(observed.stdout);
  if (!parsed || typeof parsed !== 'object') throw terminationFailure();
  const record = parsed as { descendants?: unknown; selfChain?: unknown };
  const rawDescendants = Array.isArray(record.descendants) ? record.descendants : record.descendants ? [record.descendants] : [];
  const rawChain = Array.isArray(record.selfChain) ? record.selfChain : record.selfChain === undefined ? [] : [record.selfChain];
  const descendants = rawDescendants.map((entry) => {
    const value = entry as { pid?: unknown; ppid?: unknown; createdAt?: unknown };
    if (!Number.isSafeInteger(value.pid) || (value.pid as number) <= 0) throw terminationFailure();
    if (typeof value.createdAt !== 'string' || value.createdAt === '') throw terminationFailure();
    return { pid: value.pid as number, ppid: Number(value.ppid ?? 0), createdAt: value.createdAt };
  });
  const selfChain = rawChain.map((value) => {
    if (!Number.isSafeInteger(value) || (value as number) <= 0) throw terminationFailure();
    return value as number;
  });
  return { descendants, selfChain };
}

function terminateObservedTree(pid: number): void {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw terminationFailure();
  let pids = [pid];
  if (process.platform === 'win32') {
    const { descendants, selfChain } = observeProcessTree(pid);
    if (descendants.length === 0) { verifyProcessesDead([pid]); return; }
    if (!descendants.some((entry) => entry.pid === pid)) throw terminationFailure();
    // Refuse rather than kill: sweeping the test host or any ancestor would look
    // exactly like a clean shutdown while destroying the evidence of the run.
    const guarded = new Set(selfChain);
    const trespass = descendants.filter((entry) => guarded.has(entry.pid));
    if (trespass.length > 0) {
      throw terminationScopeFailure(`refusing to terminate tree ${pid}: closure contains this process or an ancestor (${trespass.map((entry) => `${entry.pid}@${entry.createdAt}`).join(', ')})`);
    }
    pids = descendants.map((entry) => entry.pid);
    auditClosure(pid, descendants, selfChain);
    runProcessSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8', timeout: 5_000, windowsHide: true });
  } else {
    try { process.kill(pid, 'SIGKILL'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw terminationFailure(); }
  }
  verifyProcessesDead(pids);
}

export function verifyProcessesDead(pids: readonly number[]): void {
  const alive = (candidate: number): boolean => {
    try { process.kill(candidate, 0); return true; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
      throw terminationFailure();
    }
  };
  const deadline = Date.now() + 2_000;
  const wait = new Int32Array(new SharedArrayBuffer(4));
  while (pids.some(alive)) {
    if (Date.now() >= deadline) throw terminationFailure();
    Atomics.wait(wait, 0, 0, 25);
  }
}
