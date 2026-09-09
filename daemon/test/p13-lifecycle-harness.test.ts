import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
  openSubject, probeTermination, probeParentDeath,
  probeResidueAfterNormalExit, probeResidueOnStop, probeResidueOnCrash, summarizeResidue,
  type ObservedSubject, type ResidueOutcome,
} from '../src/probes/lifecycle-probe.js';
import { survivorsOf, observeIdentities } from '../src/probes/run-scope.js';
import { RESIDUE_CLASSES, observeBoundaryResidue, unobservedClasses, type BoundarySpec } from '../src/probes/boundary-residue.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// P13 R-7a. HARNESS SENSITIVITY, not subject measurement.
//
// Every case here runs against a FIXTURE we wrote, so RED->GREEN is mandatory:
//   - defective fixture (detached child that ignores its supervisor) MUST fail
//   - obedient fixture (child that follows its supervisor down)      MUST pass
// A harness that passes a broken tool is checking nothing.
//
// Real subjects (codex) are measured elsewhere and their PASS/FAIL stands as-is;
// demanding GREEN there would be pressure to lower the bar.

const fixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');
const obedient = join(fixtures, 'p13-tool-obedient.mjs');
const defective = join(fixtures, 'p13-tool-defective.mjs');
const leaker = join(fixtures, 'p13-tool-residue-leaker.mjs');
const win32 = process.platform === 'win32';

// The probe never spawns (P4/P4.5 single-boundary seal); the test owns its fixtures
// and hands running handles in.
const opened: ObservedSubject[] = [];
const scratch: string[] = [];
function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'p13-b5-'));
  scratch.push(dir);
  return dir;
}

/** A spec that can SEE every residue class. The fixture creates none of them, so a
 *  clean run is genuinely clean rather than merely unexamined - which is the whole
 *  point of unobservedClasses(). */
function fullSpec(overrides: Partial<BoundarySpec> = {}): BoundarySpec {
  return {
    profileName: `Cue.Worker.${randomUUID().replaceAll('-', '')}`,
    worktree: tempRoot(),
    toolHomeParent: tempRoot(),
    journal: { count: () => 0 },
    ...overrides,
  };
}

async function launch(script: string, children: number | string = 2, lifetimeMs = 0): Promise<ObservedSubject> {
  const child = spawn(process.execPath, [script, String(children), String(lifetimeMs)], { stdio: 'ignore' });
  await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  const subject = await openSubject({
    pid: child.pid!,
    stop: (hard: boolean) => { try { child.kill(hard ? 'SIGKILL' : 'SIGTERM'); } catch { /* already gone */ } },
  });
  opened.push(subject);
  return subject;
}

afterEach(() => {
  // One enumeration for every subject, not one per subject: the Win32 snapshot costs
  // seconds, and three subjects blew the default 10s hook budget (H11/H12 went red on
  // cleanup, not on their assertions).
  const subjects = opened.splice(0);
  const pids = subjects.flatMap((subject) => subject.scope.members.map((entry) => entry.pid));
  // Fixtures are ours to clean up; never leave stray processes behind, and never
  // let cleanup decide a verdict.
  for (const entry of observeIdentities(pids)) { try { process.kill(entry.pid, 'SIGKILL'); } catch { /* gone */ } }
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}, 60_000);

describe.runIf(win32)('P13 R-7a lifecycle harness sensitivity (fixtures only)', () => {
  it('H1 RED: P1 fails when the tool leaves a child running after a stop request', async () => {
    const subject = await launch(defective);
    expect(subject.scope.members.length, 'closure must contain the root and its children').toBeGreaterThan(1);
    const outcome = await probeTermination(subject, 6000);
    expect(outcome.passed, 'a tool that ignores stop must not be reported as passing').toBe(false);
    expect(outcome.survivors.length).toBeGreaterThan(0);
    expect(outcome.detail).toMatch(/survived the stop request/);
  }, 60_000);

  it('H2 GREEN: P1 passes when the tool takes its children down with it', async () => {
    const subject = await launch(obedient);
    const outcome = await probeTermination(subject, 8000);
    expect(outcome.detail).toBeTypeOf('string');
    expect(outcome.survivors).toEqual([]);
    expect(outcome.passed).toBe(true);
  }, 60_000);

  it('H3 RED: P3 fails when a child outlives a hard-killed supervisor', async () => {
    const subject = await launch(defective);
    const outcome = await probeParentDeath(subject, 6000);
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toMatch(/outlived the hard-killed supervisor/);
  }, 60_000);

  it('H4 GREEN: P3 passes when nothing outlives a hard-killed supervisor', async () => {
    const subject = await launch(obedient);
    const outcome = await probeParentDeath(subject, 8000);
    expect(outcome.survivors).toEqual([]);
    expect(outcome.passed).toBe(true);
  }, 60_000);

  it('H5 the verdict ignores identical processes outside this run', async () => {
    // A second, unrelated obedient tool must not appear in the first one's closure.
    // Global `codex.exe`-style counting is exactly what R-2a forbids.
    const mine = await launch(obedient);
    const stranger = await launch(obedient);
    const mineIds = new Set(mine.scope.members.map((entry) => entry.pid));
    expect(mineIds.has(stranger.rootPid), 'a foreign root must never enter our closure').toBe(false);
    for (const entry of stranger.scope.members) {
      if (entry.pid === stranger.rootPid) continue;
      expect(mineIds.has(entry.pid), `foreign pid ${entry.pid} leaked into our run scope`).toBe(false);
    }
    const outcome = await probeTermination(mine, 8000);
    expect(outcome.passed, 'a live unrelated tool must not fail our verdict').toBe(true);
    // The stranger is untouched: not killed, not counted.
    expect(survivorsOf(stranger.scope).length).toBeGreaterThan(0);
  }, 90_000);

  it('H6 a stop budget that expires is a FAIL, not an inconclusive result', async () => {
    const subject = await launch(defective);
    const outcome = await probeTermination(subject, 1000);
    expect(outcome.passed).toBe(false);
    expect(outcome).not.toHaveProperty('inconclusive');
  }, 60_000);

  // --- B5: residue after normal exit / stop / crash, each measured separately ---

  it('H7 GREEN: an obedient tool leaves no residue on the NORMAL exit path', async () => {
    const subject = await launch(obedient, 2, 9000);
    const outcome = await probeResidueAfterNormalExit(subject, fullSpec(), 30_000);
    expect(outcome.path).toBe('normal');
    expect(outcome.survivors).toEqual([]);
    expect(outcome.passed).toBe(true);
  }, 60_000);

  it('H8 RED: the normal path catches residue the stop path would hide', async () => {
    // The defective tool's detached child survives its parent's own clean exit.
    // v0.1's profile leak was exactly this shape: invisible unless you look here.
    const subject = await launch(defective, 2, 9000);
    const outcome = await probeResidueAfterNormalExit(subject, fullSpec(), 30_000);
    expect(outcome.passed, 'a detached survivor of a normal exit is residue').toBe(false);
    expect(outcome.detail).toMatch(/outlived a NORMAL exit/);
  }, 60_000);

  it('H9 RED: a subject that never exits is a FAIL, not a clean normal path', async () => {
    const subject = await launch(obedient, 1, 0); // runs forever
    const outcome = await probeResidueAfterNormalExit(subject, fullSpec(), 3000);
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toMatch(/never observed/);
  }, 60_000);

  it('H10 B5 needs all three paths; two green paths do not carry the third', async () => {
    const twoPaths: ResidueOutcome[] = [
      { path: 'normal', passed: true, survivors: [], detail: 'ok', findings: [], observed: [...RESIDUE_CLASSES], unobserved: [] },
      { path: 'stop', passed: true, survivors: [], detail: 'ok', findings: [], observed: [...RESIDUE_CLASSES], unobserved: [] },
    ];
    const partial = summarizeResidue(twoPaths);
    expect(partial.passed, 'an unmeasured path must never pass by omission').toBe(false);
    expect(partial.detail).toMatch(/unmeasured on: crash/);
  });

  it('H11 B5 GREEN only when all three paths are independently clean', async () => {
    const normal = await probeResidueAfterNormalExit(await launch(obedient, 2, 9000), fullSpec(), 30_000);
    const stop = await probeResidueOnStop(await launch(obedient), fullSpec(), 8000);
    const crash = await probeResidueOnCrash(await launch(obedient), fullSpec(), 8000);
    const report = summarizeResidue([normal, stop, crash]);
    expect(report.paths.map((entry) => entry.path)).toEqual(['normal', 'stop', 'crash']);
    expect(report.passed).toBe(true);
    expect(report.detail).toMatch(/residue 0 in every class on all three paths/);
  }, 120_000);

  it('H12 B5 RED: one dirty path sinks the verdict even if the others are clean', async () => {
    const normal = await probeResidueAfterNormalExit(await launch(obedient, 2, 9000), fullSpec(), 30_000);
    const stop = await probeResidueOnStop(await launch(obedient), fullSpec(), 8000);
    const crash = await probeResidueOnCrash(await launch(defective), fullSpec(), 6000);
    const report = summarizeResidue([normal, stop, crash]);
    expect(report.passed).toBe(false);
    expect(report.detail).toMatch(/residue found on: crash/);
  }, 120_000);
  // --- B5 boundary residue: process count 0 is NOT a clean run ---

  it('H13 RED: a process-clean tool that leaks a tool home still fails B5', async () => {
    // The decisive case. This fixture spawns nothing and exits on request, so
    // survivorsOf() is empty and a process-only harness reports PASS - while a tool
    // home is sitting on disk. v0.1's AppContainer profile leaked in exactly this
    // shape: a spotless process table hiding a live boundary artifact.
    const parent = tempRoot();
    const subject = await launch(leaker, parent);
    const outcome = await probeResidueOnStop(subject, fullSpec({ toolHomeParent: parent }), 8000);
    expect(outcome.survivors, 'the process side really is clean').toEqual([]);
    expect(outcome.findings.map((entry) => entry.kind)).toContain('tool_home');
    expect(outcome.passed, 'process residue 0 must not certify a dirty boundary').toBe(false);
    expect(outcome.detail).toMatch(/tool home\(s\) not removed/);
  }, 60_000);

  it('H14 RED: the same leak is caught on the NORMAL exit path too', async () => {
    const parent = tempRoot();
    const subject = await launch(leaker, parent, 6000);
    const outcome = await probeResidueAfterNormalExit(subject, fullSpec({ toolHomeParent: parent }), 30_000);
    expect(outcome.survivors).toEqual([]);
    expect(outcome.passed).toBe(false);
    expect(outcome.findings.map((entry) => entry.kind)).toContain('tool_home');
  }, 60_000);

  it('H15 RED: a pending cleanup-journal row is residue', async () => {
    const findings = observeBoundaryResidue({ journal: { count: () => 2 } });
    expect(findings.map((entry) => entry.kind)).toEqual(['cleanup_journal']);
    expect(findings[0].detail).toMatch(/2 cleanup journal row/);
  });

  it('H16 an unobserved residue class is never counted as clean', async () => {
    // Looking at nothing and finding nothing are not the same measurement.
    const blind = unobservedClasses({});
    expect(blind).toEqual(['appcontainer_profile', 'worktree_ace', 'tool_home', 'cleanup_journal']);
    const report = summarizeResidue([
      { path: 'normal', passed: true, survivors: [], detail: 'ok', findings: [], observed: ['process'], unobserved: blind },
      { path: 'stop', passed: true, survivors: [], detail: 'ok', findings: [], observed: [...RESIDUE_CLASSES], unobserved: [] },
      { path: 'crash', passed: true, survivors: [], detail: 'ok', findings: [], observed: [...RESIDUE_CLASSES], unobserved: [] },
    ]);
    expect(report.passed, 'three green paths cannot outvote a class nobody looked at').toBe(false);
    expect(report.detail).toMatch(/B5 blind on: normal -> appcontainer_profile/);
  });

  it('H17 the AppContainer probe refuses to answer for a non-Cue profile name', async () => {
    // A probe that happily queries arbitrary names invites a caller to point it at a
    // name that trivially returns 0 and call the run clean.
    expect(() => observeBoundaryResidue({ profileName: 'Administrators' })).toThrow(/non-Cue profile name/);
  });

  it('H18 a genuinely clean run reads 0 in every class, not "unknown"', async () => {
    const spec = fullSpec();
    expect(unobservedClasses(spec)).toEqual([]);
    expect(observeBoundaryResidue(spec)).toEqual([]);
  }, 60_000);
});
