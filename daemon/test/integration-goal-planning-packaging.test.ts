import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('built planning checker assets match their reviewed source bytes', () => {
  for (const path of ['goal-proposal-checker-client.cjs', 'verification/goal-proposal-checker.cjs',
    'json-checker-client.cjs', 'verification/json-format-checker.cjs']) {
    expect(readFileSync(new URL(`../dist/src/${path}`, import.meta.url)))
      .toEqual(readFileSync(new URL(`../src/${path}`, import.meta.url)));
  }
});

test('planning host, output reader and compiled checker load in a fresh Node process', () => {
  const script = `
    const host = await import('../app/goal-planning-host.mjs');
    const reader = await import('../app/accepted-goal-planning-output.mjs');
    const executor = await import('./dist/src/adapters/isolated-goal-proposal-checker.js');
    const acceptance = await import('./dist/src/verification/goal-proposal-acceptance-host.js');
    for (const value of [host.createGoalPlanningHost, reader.readAcceptedGoalPlanningOutput,
      executor.createIsolatedGoalProposalCheckerExecutor, acceptance.createGoalProposalAcceptanceHost]) {
      if (typeof value !== 'function') throw Error('planning export missing');
    }
    process.stdout.write('planning-imports-ok');
  `;
  expect(execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8',
    timeout: 15_000, windowsHide: true,
  })).toBe('planning-imports-ok');
});
