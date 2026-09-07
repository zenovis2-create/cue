import { runProcessSync } from './process-launch.js';

export function terminationFailure(): Error & { code: string } {
  return Object.assign(new Error('CUE_TERMINATION_UNVERIFIED: process-tree death could not be verified; writer lease must remain held'), { code: 'CUE_TERMINATION_UNVERIFIED' });
}

/** Check the entire attributed tree; taskkill's exit status alone is not proof. */
export function terminateVerifiedTree(pid: number): void {
  try { terminateObservedTree(pid); }
  catch { throw terminationFailure(); }
}

function terminateObservedTree(pid: number): void {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw terminationFailure();
  let pids = [pid];
  if (process.platform === 'win32') {
    const script = `$ErrorActionPreference='Stop';$all=@(Get-CimInstance Win32_Process -ErrorAction Stop);$ids=[Collections.Generic.HashSet[int]]::new();[void]$ids.Add(${pid});do{$added=$false;foreach($p in $all){if($ids.Contains([int]$p.ParentProcessId)){$added=$ids.Add([int]$p.ProcessId) -or $added}}}while($added);ConvertTo-Json -InputObject @($ids) -Compress`;
    const observed = runProcessSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 5_000, windowsHide: true });
    if (observed.status !== 0 || observed.error || observed.stderr.trim()) throw terminationFailure();
    try {
      const parsed: unknown = JSON.parse(observed.stdout);
      if (!Array.isArray(parsed) || !parsed.includes(pid) || parsed.some(value => !Number.isSafeInteger(value) || value <= 0)) throw terminationFailure();
      pids = parsed as number[];
    } catch { throw terminationFailure(); }
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
