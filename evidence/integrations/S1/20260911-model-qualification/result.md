# Model qualification collector — maker evidence

Owned files: `daemon/src/model-qualification.ts`, `daemon/test/integration-model-qualification.test.ts`. Native qualification harness and subject factory are independently owned. No Qwen or paid provider calls were made.

Done gate: `npm run build` exit 0; focused collector suite checks actual Windows child processes with fixture model transport, actual checker calculations, pinned diagnostics, ledger ownership, cleanup receipts, fixture provenance, subject drift and transactional raw-journal tamper refusal. Independent review remains required.

## Contract

- Default live path uses the installed compiled collector, current self-file hash, full subject measurement, actual production executors and default model transport. The declared PowerShell must equal the executable used by production executors.
- Production client and fixed diagnostic client are separately pinned and separately recorded. Their observed token, zero capabilities, Job active-process limit, client kind and argument recipe must match. Diagnostics are never represented as the production client.
- Every launched child uses `spawnOwnedPiped`, real task/run/session ownership in the supplied ledger. Existing independent cleanup verifies each native leg and commits its receipt before qualification publication.
- Fresh raw observations are committed to existing artifacts. Final evidence embeds those exact bytes and rechecks their database rows inside the transaction that publishes all three M references. Subject drift, abort, incomplete cleanup or missing observations cannot publish PASS. Journal mutation rolls back every reference.
- Any fixture seam forces `kind: fixture` and `eligible: false`; model fixtures require their own transport. They cannot accidentally use the live model transport.
- M3 scope is controlled loopback TCP with positive host nonce controls before and after the denied child operation, plus the pinned fixed-client protocol/recipe. This is not B3, all-network confinement, WFP proof, provider confinement, billing knowledge or performance evidence.

## Corrections and gates

Initial native fixture gate exposed PowerShell progress CLIXML on stderr from module autoload during ACL JSON serialization. The helper already used module-free `IO.File.GetAccessControl` and SID translation; explicitly suppressing progress preserves strict failure-on-stderr while removing progress output. Initial measurements failed closed with unknown M statuses. A Windows cwd-release race also required bounded private-fixture directory deletion before publication; cleanup failure now prevents PASS instead of throwing after references have committed.

The final focused run is recorded in `test.log`. Build completed with exit 0 after adding the compiled-self hash and PowerShell identity checks. Actual native runs use in-memory SQLite fixtures; file persistence/reopen semantics of the reused immutable capability and cleanup stores were independently reviewed in their earlier store units. No current-subject live issuance has been performed by this maker.

Source SHA-256:

- `model-qualification.ts`: `5A2D24FB09B305F98A87A5EE2E044B04CA0BC7D6ADDC94EDDCC57937E01BC0E8`
- `integration-model-qualification.test.ts`: `EF1D67CB56944C7C39178DE0E10F86FE90AE246261128C2B01B83C87813E91E5`

Live use requires a fresh compiled process after the final source freeze, independent collector review, and a newly measured full subject. Historical test PASS records are not inputs to issuance.
