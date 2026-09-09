import { openRunScope, extendRunScope, survivorsOf, type ProcessIdentity, type RunScope } from './run-scope.js';

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
