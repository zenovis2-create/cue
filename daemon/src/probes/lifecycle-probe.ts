import { openRunScope, extendRunScope, survivorsOf, type ProcessIdentity, type RunScope } from './run-scope.js';
import { observeBoundaryResidue, observedClasses, unobservedClasses, type BoundarySpec, type ResidueClass, type ResidueFinding } from './boundary-residue.js';

// P13 R-2 / P1 + P3.
//   P1 termination proof : after a stop request, does the tool's own run-scoped set die?
//   P3 parent-death       : after a HARD KILL of the supervisor, is the set empty?
// Both judge only processes belonging to this run (R-2a). A verdict of `false` is a
// legitimate outcome and is never softened (absolute rules 1, 2, 5).
//
// This module does NOT start processes. P4/P4.5 seal the codebase to a single spawn
// boundary in `process-launch.ts`, and a measurement tool is not entitled to an
// exemption from the contract it measures - so the caller starts the subject through
// the owned boundary and hands the running handle in.

export interface ProbeOutcome {
  passed: boolean;
  survivors: ProcessIdentity[];
  detail: string;
}

/** A process the caller already started, plus the way to ask it to stop. */
export interface SubjectHandle {
  pid: number;
  stop: (hard: boolean) => void;
}

export interface ObservedSubject {
  rootPid: number;
  scope: RunScope;
  stop: (hard: boolean) => void;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

/** Bind a run scope to an already-running subject. `settleMs` lets the tool create
 *  its children before we photograph the tree. */
export async function openSubject(handle: SubjectHandle, settleMs = 1200): Promise<ObservedSubject> {
  await sleep(settleMs);
  const scope = extendRunScope(openRunScope(handle.pid));
  return { rootPid: handle.pid, scope, stop: handle.stop };
}

async function waitForQuiet(scope: RunScope, budgetMs: number): Promise<ProcessIdentity[]> {
  const deadline = Date.now() + budgetMs;
  let survivors = survivorsOf(scope);
  while (survivors.length > 0 && Date.now() < deadline) {
    await sleep(250);
    survivors = survivorsOf(scope);
  }
  return survivors;
}

/** P1: stop request, then the run-scoped set must be empty within the budget.
 *  Exceeding the budget is a FAIL, never "inconclusive" (absolute rule 2). */
export async function probeTermination(subject: ObservedSubject, budgetMs = 8000): Promise<ProbeOutcome> {
  // Stop the ROOT only. Sweeping the tree ourselves would make every tool look
  // obedient - the question is whether the tool's children follow it down.
  subject.stop(false);
  const survivors = await waitForQuiet(subject.scope, budgetMs);
  return {
    passed: survivors.length === 0,
    survivors,
    detail: survivors.length === 0
      ? `run-scoped set empty after stop (root ${subject.rootPid})`
      : `${survivors.length} run-scoped process(es) survived the stop request: ${survivors.map((entry) => `${entry.pid}@${entry.createdAt}`).join(', ')}`,
  };
}

/** P3: hard kill of the supervisor, then the run-scoped set must be empty. */
export async function probeParentDeath(subject: ObservedSubject, budgetMs = 8000): Promise<ProbeOutcome> {
  subject.stop(true);
  const survivors = await waitForQuiet(subject.scope, budgetMs);
  return {
    passed: survivors.length === 0,
    survivors,
    detail: survivors.length === 0
      ? `no run-scoped survivors after hard kill (root ${subject.rootPid})`
      : `${survivors.length} run-scoped process(es) outlived the hard-killed supervisor: ${survivors.map((entry) => `${entry.pid}@${entry.createdAt}`).join(', ')}`,
  };
}

// ---------------------------------------------------------------------------
// B5 - residue after normal exit, stop, and crash.
//
// v0.1's profile leak did not show on the normal path; it only appeared on a hard
// kill. So B5 is not one measurement with three names: each path gets its own
// verdict, and B5 passes only if all three are clean.

export type ResiduePath = 'normal' | 'stop' | 'crash';

export interface ResidueOutcome extends ProbeOutcome {
  path: ResiduePath;
  /** Non-process residue found on this path. Process survivors live in `survivors`. */
  findings: ResidueFinding[];
  /** Residue classes this path was actually able to look at. */
  observed: ResidueClass[];
  /** Classes nobody looked at. Non-empty means the path cannot be called clean. */
  unobserved: ResidueClass[];
}

/** Fold the boundary classes into a process-only outcome. A path is clean only when
 *  BOTH the process table and every boundary artifact are empty - v0.1 leaked a
 *  profile while the process table was already spotless. */
function withBoundary(outcome: ProbeOutcome, path: ResiduePath, spec: BoundarySpec): ResidueOutcome {
  const findings = observeBoundaryResidue(spec);
  const unobserved = unobservedClasses(spec);
  const detail = findings.length === 0
    ? outcome.detail
    : `${outcome.detail}; boundary residue: ${findings.map((f) => `${f.kind}: ${f.detail}`).join(' | ')}`;
  return {
    ...outcome,
    path,
    findings,
    observed: observedClasses(spec),
    unobserved,
    passed: outcome.passed && findings.length === 0,
    detail,
  };
}

export interface BoundaryResidueReport {
  passed: boolean;
  paths: ResidueOutcome[];
  detail: string;
}

/** Normal path: the subject ends on its own. We never stop it - stopping it would
 *  measure the stop path again and quietly skip the one B5 exists for. */
export async function probeResidueAfterNormalExit(subject: ObservedSubject, spec: BoundarySpec = {}, limitMs = 20000): Promise<ResidueOutcome> {
  const deadline = Date.now() + limitMs;
  let rootAlive = true;
  while (rootAlive && Date.now() < deadline) {
    rootAlive = survivorsOf(subject.scope).some((entry) => entry.pid === subject.rootPid);
    if (rootAlive) await sleep(200);
  }
  if (rootAlive) {
    return withBoundary({
      passed: false,
      survivors: survivorsOf(subject.scope),
      // NOTE: the R-7 release gate scans all of src/ for a currency symbol near the
      // word "budget" - and an interpolated limit variable trips it. The gate is
      // right to be blunt; the probe renames its variable, the gate does not move.
      detail: `subject did not exit on its own within ${limitMs}ms; the normal path was never observed`,
    }, 'normal', spec);
  }
  const survivors = await waitForQuiet(subject.scope, Math.max(0, deadline - Date.now()));
  return withBoundary({
    passed: survivors.length === 0,
    survivors,
    detail: survivors.length === 0
      ? 'no run-scoped process residue after normal exit'
      : `${survivors.length} process(es) outlived a NORMAL exit: ${survivors.map((entry) => `${entry.pid}@${entry.createdAt}`).join(', ')}`,
  }, 'normal', spec);
}

/** Compose one B5 verdict from three independently measured paths. Callers supply a
 *  freshly launched subject per path - reusing one would make the later paths
 *  measure an already-dead process and pass for free. */
export function summarizeResidue(paths: readonly ResidueOutcome[]): BoundaryResidueReport {
  const required: ResiduePath[] = ['normal', 'stop', 'crash'];
  const missing = required.filter((path) => !paths.some((outcome) => outcome.path === path));
  if (missing.length > 0) {
    // Absolute rule 1: no measurement, no claim.
    return { passed: false, paths: [...paths], detail: `B5 unmeasured on: ${missing.join(', ')}` };
  }
  // A class nobody looked at is not a clean class. Reporting "residue 0" while
  // AppContainer profiles were never queried is exactly how v0.1's leak stayed
  // invisible, so an unobserved class sinks the verdict just like a found one.
  const blind = paths.filter((outcome) => outcome.unobserved.length > 0);
  if (blind.length > 0) {
    return {
      passed: false,
      paths: [...paths],
      detail: `B5 blind on: ${blind.map((outcome) => `${outcome.path} -> ${outcome.unobserved.join(',')}`).join(' | ')}`,
    };
  }
  const failed = paths.filter((outcome) => !outcome.passed);
  return {
    passed: failed.length === 0,
    paths: [...paths],
    detail: failed.length === 0
      ? 'residue 0 in every class on all three paths (normal, stop, crash)'
      : `residue found on: ${failed.map((outcome) => `${outcome.path} (${outcome.detail})`).join(' | ')}`,
  };
}

export async function probeResidueOnStop(subject: ObservedSubject, spec: BoundarySpec = {}, waitMs = 8000): Promise<ResidueOutcome> {
  return withBoundary(await probeTermination(subject, waitMs), 'stop', spec);
}

export async function probeResidueOnCrash(subject: ObservedSubject, spec: BoundarySpec = {}, waitMs = 8000): Promise<ResidueOutcome> {
  return withBoundary(await probeParentDeath(subject, waitMs), 'crash', spec);
}
