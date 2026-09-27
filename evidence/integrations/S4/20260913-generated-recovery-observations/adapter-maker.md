# Adapter diagnostic regression maker report

Added an isolated regression suite against the actual `createIsolatedLocalModelExecutor` adapter. The fixture mocks `spawnOwnedPiped` with `EventEmitter` and `PassThrough`, uses the real in-memory SQLite ledger, and makes no native process, model, or network call.

Coverage (6 tests):

- cancellation remains `cancelled`, while fake-timer expiry is `deadline-exceeded`;
- later stderr/child errors do not overwrite the first failure;
- a transport exception containing `provider-api-key-sk-secret-value` becomes only `transport-failed`, and the result contains none of the source message;
- malformed broker framing becomes `protocol-invalid`;
- a valid model result with native close code 7 fails the final-close predicate as `native-exit-failed`;
- a valid model result with cleanup evidence, exit observation 0, and close code 0 succeeds without `diagnosticCode`.

Validation, pass 1 of the cap of 2:

- `cd daemon && npm exec vitest run -- test/integration-isolated-model-diagnostics.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1` — exit 0; 1 test file passed, 6 tests passed.
- `cd daemon && npm exec tsc -- --noEmit -p tsconfig.json` — exit 0.
- `git diff --check -- daemon/test/integration-isolated-model-diagnostics.test.ts evidence/integrations/S4/20260913-generated-recovery-observations/adapter-PLAN.md` — exit 0.

Artifact SHA-256 values before this report was added:

- `daemon/test/integration-isolated-model-diagnostics.test.ts` (110 lines): `47289056ba5ecde60244292c72fb33c134e77becae584789c8c3ec40633adc27`
- `evidence/integrations/S4/20260913-generated-recovery-observations/adapter-PLAN.md` (7 lines): `dbbbadb43fdac86cbb4a3c4bfd19abd51b9ae9a21e9a6d2869794464ef3a256f`

No production file changed. The prohibited real-native `integration-isolated-local-model.test.ts` suite was not run.
