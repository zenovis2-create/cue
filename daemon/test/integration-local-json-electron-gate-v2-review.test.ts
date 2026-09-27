import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const gate = new URL('../../scripts/reuse/local-json-electron-gate-v2.mjs', import.meta.url);

test('module import is inert and live execution remains behind exact frozen authority', async () => {
  const fetch = vi.fn(() => { throw new Error('unexpected network'); });
  vi.stubGlobal('fetch', fetch);
  const loaded = await import(gate.href + '?review=inert');
  expect(fetch).not.toHaveBeenCalled();
  expect(() => loaded.parseExecutionArgs([])).toThrow('electron_gate_explicit_frozen_authority_required');
  expect(loaded.CONTRACT).toMatchObject({ qualificationProcesses: 1, workflowProcesses: 1, maxQwenRequests: 2 });
  vi.unstubAllGlobals();
});

test('source fixes the two-child topology and binds acceptance checker revision to frozen installed bytes', () => {
  const source = readFileSync(gate, 'utf8');
  expect(source.match(/await executeChild\(/g)).toHaveLength(2);
  expect(source).toContain("record.expectedCheckerRevision='v1:'+hash(readFileSync(join(root,'daemon','dist','src','verification','json-format-checker.cjs')))");
  expect(source).toContain("'checker_qualification_pins'");
  expect(source).toContain("'checker_revision_qualification_mismatch'");
  expect(source).toContain("'workflow_candidate_identity'");
  expect(source).toContain('no provider-side HTTP request counter is available');
  expect(source).toContain('if (process.argv[1] && resolve(process.argv[1]) === script)');
});
