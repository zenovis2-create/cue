import { test, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createCueCore, initializeConfig } from '../../app/core.mjs';
import { registerIpcHandlers } from '../../app/ipc.mjs';
import { createIntegrationCatalog } from '../src/integration-catalog.js';
import { readLatestLocalHostSettings, saveLocalHostSettings, LOCAL_JSON_SETTINGS_ID } from '../src/selection/local-host-settings.js';
import { saveLocalSelectionPolicy } from '../src/selection/local-policy-store.js';

function rootFixture() {
  const root = mkdtempSync(join(tmpdir(), 'cue-inventory-')), work = join(root, 'work'); mkdirSync(work);
  return { root, config: initializeConfig(join(root, 'data'), { worktreeRoot: work }) };
}
test('real core unavailable inventory retains configured policy references without claiming candidates', async () => {
  const f = rootFixture(), core = createCueCore(f.config, undefined, { orchestrationFactory: () => ({ available: false, reasons: ['qualification-missing'] }) });
  try {
    expect(core.candidateInventory()).toMatchObject({ available: false, records: [], unavailableReasons: ['qualification-missing'] });
    core.configureLocalJson({ expectedRevision: null, enabled: true, limits: { maxInvocations: 2, timeoutMs: 60000, maxOutputBytes: 65536, maxOutputTokens: 2048 } });
    const value = core.candidateInventory();
    expect(value.configuration).toMatchObject({ settingsRevision: 1, modeComparison: 'fixed-pair-unmeasured', restartRequired: true });
    expect(value.configuration.policies).toHaveLength(4); expect(value.selection.available).toBe(false);
    expect(JSON.stringify(value)).not.toMatch(/endpoint|http:|authReference/);
    for (const table of ['task', 'session_handle', 'approval_event']) expect(core.daemon.db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
    expect(Object.isFrozen(value.configuration.policies)).toBe(true);
    const saved = readLatestLocalHostSettings(core.daemon.db, LOCAL_JSON_SETTINGS_ID)!;
    const different = saveLocalSelectionPolicy(core.daemon.db, { policyId: 'different-speed-pair', expectedRevision: null,
      createdAt: new Date().toISOString(), sourceVersion: 'fixture', policy: { version: 'cue-local-selection-v1', mode: 'speed',
        producerCandidateId: 'another-producer', checkerCandidateId: 'another-checker', limitAttempts: 2, timeoutMs: 60000 } });
    saveLocalHostSettings(core.daemon.db, { settingsId: LOCAL_JSON_SETTINGS_ID, expectedRevision: saved.revision,
      createdAt: new Date().toISOString(), sourceVersion: 'fixture', settings: { ...saved.settings, policies: { ...saved.settings.policies,
        speed: { policyId: different.policyId, revision: different.revision, digest: different.digest } } } });
    expect(core.candidateInventory().configuration.modeComparison).toBe('unknown');
    expect(core.candidateInventory().records).toEqual([]);
  } finally { await core.close(); rmSync(f.root, { recursive: true, force: true }); }
});
test('real catalog projection preserves kind/reasons/time without aliases auth refs or payload; reread stays stale', async () => {
  const f = rootFixture(); let now = Date.now(); const observedAt = new Date(now).toISOString();
  const catalog = createIntegrationCatalog({ now: () => now, maxAgeMs: 1000 }, [{ canonicalId: 'fixed-checker', toolId: 'cue-checker', kind: 'checker', aliases: ['not-a-row'], installation: 'installed', protocol: 'verified', authReference: 'PRIVATE_AUTH_REF', authAvailable: true, sourceVersion: 'PRIVATE_SOURCE', observedAt, subjectDigest: null, binding: null }], ['unresolved']);
  const forbidden = vi.fn(() => { throw Error('must not execute'); });
  const host = { now: () => now, catalog, authority: {}, runtime: { evidence: { now: () => now, maxAgeMs: 1000, resolveEvidence: () => undefined } }, engine: {}, prepare: forbidden, verifyFinalBilling: forbidden };
  const core = createCueCore(f.config, undefined, { orchestration: host as never });
  try {
    const fresh = core.candidateInventory(); expect(fresh.records).toHaveLength(1);
    expect(fresh.records[0]).toMatchObject({ kind: 'checker', catalogAvailable: true, observedAt, authentication: 'unknown', capabilityEligibility: 'unknown', executionAuthority: 'not-granted-by-inventory' });
    now += 1001; const stale = core.candidateInventory();
    expect(stale.records[0]).toMatchObject({ catalogAvailable: false, observedAt, reasons: ['stale-observation'] });
    expect(JSON.stringify(stale)).not.toMatch(/PRIVATE_|not-a-row|unresolved|authReference|binding/);
    expect(forbidden).not.toHaveBeenCalled();
  } finally { await core.close(); rmSync(f.root, { recursive: true, force: true }); }
});
test('inventory IPC only accepts exact read and trusted frame', () => {
  const handlers = new Map<string, Function>(), core = { candidateInventory: vi.fn(() => ({ available: false })) }, sender = {};
  const ipc = registerIpcHandlers({ handle: (key, fn) => { handlers.set(key, fn); } }, core as never, { isTrustedSender: event => event === sender });
  expect(() => handlers.get('cue:candidate-inventory')!({}, { operation: 'read' })).toThrow('sender denied');
  expect(handlers.get('cue:candidate-inventory')!(sender, { operation: 'read' })).toEqual({ available: false });
  const getter = vi.fn(); const bad = Object.defineProperty({}, 'operation', { enumerable: true, get: getter });
  for (const value of [null, bad, new Proxy({ operation: 'read' }, {}), Object.create({ operation: 'read' }), { operation: 'install' }, { operation: 'read', auth: 'x' }, { operation: 'read', [Symbol()]: 1 }]) expect(() => ipc.invoke('cue:candidate-inventory', value)).toThrow('input denied');
  expect(() => ipc.invoke('cue:candidate-inventory', { operation: 'read' }, {})).toThrow('input denied');
  expect(getter).not.toHaveBeenCalled(); expect(core.candidateInventory).toHaveBeenCalledOnce();
});
function inventory(id = 'fixed-checker') {
  return { version: 'cue-candidate-inventory-v1', authority: 'read-only-observation', available: true, unavailableReasons: [], readAt: 'display-time',
    records: [{ canonicalId: id, toolId: 'fixture', kind: 'checker', installation: 'installed', protocol: 'verified', observedAt: 'old-observation', catalogAvailable: false, reasons: ['stale-observation'] }],
    selection: { mode: 'value', revision: 1, available: false }, configuration: { modeComparison: 'fixed-pair-unmeasured', policies: [], restartRequired: false } };
}
test('DOM inventory is inert read-only and stale replies cannot replace newer unavailable state', async () => {
  const dom = new JSDOM(readFileSync(resolve('../app/renderer/index.html'), 'utf8'), { runScripts: 'outside-only' });
  let finish!: (value: any) => void;
  const api = { candidateInventory: vi.fn(async (): Promise<any> => inventory('<img src=x onerror=alert(1)>')) };
  Object.assign(dom.window, { cue: api }); dom.window.eval(readFileSync(resolve('../app/renderer/renderer.js'), 'utf8'));
  try {
    await vi.waitFor(() => expect(dom.window.document.querySelector('#candidate-records')!.textContent).toContain('old-observation'));
    expect(dom.window.document.querySelector('#candidate-records img')).toBeNull();
    expect(dom.window.document.querySelector('#candidate-modes')!.textContent).toContain('같은 고정');
    api.candidateInventory.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    dom.window.document.querySelector<HTMLButtonElement>('#candidate-refresh')!.click();
    api.candidateInventory.mockResolvedValueOnce({ ...inventory(), available: false, records: [], unavailableReasons: ['qualification-missing'] });
    dom.window.document.querySelector<HTMLButtonElement>('#candidate-refresh')!.click();
    await vi.waitFor(() => expect(dom.window.document.querySelector('#candidate-status')!.textContent).toContain('qualification-missing'));
    finish(inventory('obsolete')); await Promise.resolve();
    expect(dom.window.document.querySelector('#candidate-records')!.textContent).toBe('');
    expect(api.candidateInventory.mock.calls).toEqual(Array(3).fill([{ operation: 'read' }]));
  } finally { dom.window.close(); }
});
