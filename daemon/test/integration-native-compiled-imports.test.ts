import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('built native and Claude executor modules load in real Node', () => {
  const script = `
    const subject = await import('./dist/src/native-provider-measurement-subject.js');
    const account = await import('./dist/src/native-account-observation.js');
    const native = await import('../app/native-existing-file-authorities.mjs');
    const startup = await import('../app/protected-installation.mjs');
    const claude = await import('./dist/src/adapters/claude-cli-executor.js');
    const configuration = await import('../app/claude-configuration.mjs');
    for (const value of [subject.measureNativeProviderSubject,
      account.observeNativeProviderAccount, account.readIssuedNativeAccountObservation,
      account.observeNativeServiceAuthentication, account.readIssuedNativeServiceAuthentication,
      account.observeNativeServiceCapacity, account.readIssuedNativeServiceCapacity,
      native.createNativeExistingFileAuthorities, startup.createStartupOrchestrationFactory,
      claude.createClaudeCliExecutor, configuration.createClaudeConfigurationResolver,
      configuration.consumeClaudeConfiguration]) {
      if (typeof value !== 'function') throw Error('native compiled export missing');
    }
    process.stdout.write('native-compiled-imports-ok');
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8', timeout: 15_000, windowsHide: true,
  });
  expect(output).toBe('native-compiled-imports-ok');
});
