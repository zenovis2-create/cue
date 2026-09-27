import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, parse, relative } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { AppDaemon, createCueCore, initializeConfig } from '../../app/core.mjs';
import { createDeploymentStagingOrchestrationFactory } from '../../app/deployment-staging-host.mjs';
import { ATTEMPT_STAGING_FACTORY_PROTOCOL } from '../src/orchestration/staging-authority.js';

const roots: string[] = [];
const makeRoot = () => { const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'cue-deployment-staging-'))); roots.push(root); return root; };
afterEach(() => { for (const root of roots.splice(0)) { const exact = realpathSync.native(root), base = join(realpathSync.native(tmpdir()), 'cue-deployment-staging-'); if (!isAbsolute(exact) || !exact.startsWith(base) || relative(exact, root) !== '') throw Error('fixture_cleanup_target_untrusted'); rmSync(exact, { recursive: true, force: true }); } });

test('parser retains the full basename for a prospective drive-root child without creating it', async () => {
  const prospective = join(parse(realpathSync.native(tmpdir())).root, 'cue-deployment-staging-parser-do-not-create');
  const { parseDeploymentStagingConfiguration } = await import('../../app/deployment-staging-host.mjs');
  expect(parseDeploymentStagingConfiguration(JSON.stringify({ version: 'cue-git-staging-deployment-v1', enabled: true, storageRoot: prospective }))).toMatchObject({ storageRoot: prospective });
});

test('invalid deployment configuration refuses before provider or staging factory work', async () => {
  let providers = 0, factories = 0;
  const factory = await createDeploymentStagingOrchestrationFactory({
    configuration: JSON.stringify({ version: 'cue-git-staging-deployment-v1', enabled: true, storageRoot: 'relative' }),
    createOrchestrationFactory: () => { providers++; throw Error('provider-called'); },
    createStagingHost: () => { factories++; throw Error('factory-called'); },
  });
  expect(factory({} as any)).toEqual({ available: false, reasons: ['deployment-staging-config-invalid'] });
  expect({ providers, factories }).toEqual({ providers: 0, factories: 0 });
});

test('missing and disabled opt-in preserve the existing explicit readiness', async () => {
  for (const configuration of [undefined, JSON.stringify({ version: 'cue-git-staging-deployment-v1', enabled: false })]) {
    const reasons = Object.freeze(['default-host-settings-missing-or-disabled']);
    const original = () => Object.freeze({ available: false as const, reasons });
    const factory = await createDeploymentStagingOrchestrationFactory({ configuration, createOrchestrationFactory: () => original });
    expect(factory({} as any)).toEqual({ available: false, reasons });
  }
});

test('supported opted-in host reaches the Core driver with exact immutable execution staging', async () => {
  const root = makeRoot(), userData = join(root, 'user'), worktree = join(root, 'worktree'), storageRoot = join(root, 'staging');
  mkdirSync(userData); mkdirSync(worktree); mkdirSync(storageRoot);
  const staging = Object.freeze({ inspectCleanRoot: () => { throw Error('not prepared'); }, factory: Object.freeze({
    protocol: ATTEMPT_STAGING_FACTORY_PROTOCOL, sha256: 'a'.repeat(64),
    create: () => { throw Error('not started'); }, inspectRoot: () => { throw Error('not started'); }, reconcilePublished: () => { throw Error('not started'); },
    cleanup: () => { throw Error('not started'); }, inspectCleanup: () => { throw Error('not started'); },
  }) });
  let options: any, contexts = 0;
  const baseHost = Object.freeze({ executionStagingSupport: 'git-worktree-v1', now: () => 0, catalog: {}, prepare: () => { throw Error('not prepared'); }, authority: {},
    runtime: { evidence: { now: () => 0, maxAgeMs: 1, resolveEvidence: () => undefined }, verifyCleanup: () => { throw Error('not started'); } }, engine: {}, stage: () => ({}) });
  const factory = await createDeploymentStagingOrchestrationFactory({
    configuration: JSON.stringify({ version: 'cue-git-staging-deployment-v1', enabled: true, storageRoot }),
    createOrchestrationFactory: () => (context: any) => { contexts++; expect(context.worktree).toBe(realpathSync.native(worktree)); return baseHost as any; },
    createStagingHost: value => { options = value; return staging; },
  });
  const config = initializeConfig(userData, { worktreeRoot: worktree, ledgerPath: join(userData, 'cue.db') });
  const daemon = new AppDaemon(config);
  try {
    const core = createCueCore(config, daemon, { orchestrationFactory: factory as any });
    expect(contexts).toBe(1); expect(options).toEqual({ storageRoot });
    expect(core.selectionPreferences().available).toBe(true);
    await core.close();
  } finally { if (daemon.db.open) await daemon.close(); }
});

test('enabled configuration does not upgrade an adapter without an explicit staging contract', async () => {
  const root = makeRoot(), worktree = join(root, 'worktree'), storageRoot = join(root, 'staging'); mkdirSync(worktree); mkdirSync(storageRoot);
  let factories = 0;
  const factory = await createDeploymentStagingOrchestrationFactory({
    configuration: JSON.stringify({ version: 'cue-git-staging-deployment-v1', enabled: true, storageRoot }),
    createOrchestrationFactory: () => () => ({ parentTemplate: 'generated-json-v1' } as any),
    createStagingHost: () => { factories++; return {} as any; },
  });
  expect(factory({ worktree } as any)).toEqual({ available: false, reasons: ['deployment-staging-adapter-unsupported'] });
  expect(factories).toBe(0);
});

test('unsafe worktree and overlap refuse before the consuming host factory runs', async () => {
  const root = makeRoot(), worktree = join(root, 'worktree'), storageRoot = join(worktree, 'staging'); mkdirSync(worktree); mkdirSync(storageRoot);
  let hosts = 0, factories = 0;
  const factory = await createDeploymentStagingOrchestrationFactory({
    configuration: JSON.stringify({ version: 'cue-git-staging-deployment-v1', enabled: true, storageRoot }),
    createOrchestrationFactory: () => () => { hosts++; return { executionStagingSupport: 'git-worktree-v1' } as any; },
    createStagingHost: () => { factories++; return {} as any; },
  });
  expect(factory({ worktree: 'relative' } as any)).toEqual({ available: false, reasons: ['deployment-staging-worktree-invalid'] });
  expect(factory({ worktree } as any)).toEqual({ available: false, reasons: ['deployment-staging-storage-overlap'] });
  expect({ hosts, factories }).toEqual({ hosts: 0, factories: 0 });
});
