import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { openSubject, probeTermination, probeParentDeath, type ObservedSubject } from '../src/probes/lifecycle-probe.js';
import { survivorsOf } from '../src/probes/run-scope.js';

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
const win32 = process.platform === 'win32';

// The probe never spawns (P4/P4.5 single-boundary seal); the test owns its fixtures
// and hands running handles in.
const opened: ObservedSubject[] = [];
async function launch(script: string, children = 2): Promise<ObservedSubject> {
  const child = spawn(process.execPath, [script, String(children)], { stdio: 'ignore' });
  await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  const subject = await openSubject({
    pid: child.pid!,
    stop: (hard: boolean) => { try { child.kill(hard ? 'SIGKILL' : 'SIGTERM'); } catch { /* already gone */ } },
  });
  opened.push(subject);
  return subject;
}

afterEach(() => {
  for (const subject of opened.splice(0)) {
    // Fixtures are ours to clean up; never leave stray processes behind, and never
    // let cleanup decide a verdict.
    for (const entry of survivorsOf(subject.scope)) { try { process.kill(entry.pid, 'SIGKILL'); } catch { /* gone */ } }
  }
});

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
});
