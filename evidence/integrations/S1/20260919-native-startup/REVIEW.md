# Native startup routing review (2026-09-19)

Scope: `app/main.mjs`, `app/protected-installation.mjs` and its declaration, native provider measurement closure, and focused startup tests. This is a source and mocked-test review; no native provider, service, Qwen, or network call was made. Composer behavior is owned by the concurrent implementation worker and is not qualified here.

## Resolved finding

The initial review found that `NATIVE_PROVIDER_SUBJECT_PATHS` omitted `app/main.mjs` and `app/deployment-staging-host.mjs`, which select and wrap the native startup route. The root owner added both to the fixed ADAPTER list and to the missing-artifact closure test. Independent rerun of `test/native-provider-measurement-subject.test.ts` passed: 6/6. No open startup routing finding remains in this scoped review.

## Verified behavior

- An explicitly present native configuration enters the native branch, even if malformed; invalid configuration returns unavailable and does not consult local host settings or model health.
- The native branch checks the daemon status before composition and checks the same ledger and daemon status on readiness calls. Installation generation is checked before and after async composition and on readiness calls.
- `npx vitest run test/integration-native-startup.test.ts test/integration-protected-installation.test.ts test/integration-default-startup.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` passed: 3 files, 23 tests.

Limit: the native startup tests mock the composer. They prove routing and refusal behavior, not live provider authentication, capability admission, execution, or publication.
