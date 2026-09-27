# Native authority composer attempt

## Done gate

A fixed composer supplies `createNativeImplementationHost` and the deployment staging factory without accepting caller execution, cleanup, billing, checker, or publication verdict callbacks. A focused offline integration test must drive real Core prepare/approve/staging with OS transport mocked at its lowest boundary, and reject subject/profile/evidence/lineage drift. No provider or service call is authorized for this test. This closes only the composer unit, not the broad remaining 11 items.

## Attempt contract

At most two production hypotheses. Every pass runs the focused `daemon/test/integration-native-existing-file-authorities.test.ts` Vitest gate and inspects real ledger lineage. A failing pass changes hypothesis or removes the production candidate. Root owns coordinated build and import relocation; no standalone TypeScript compile.

All three owned source/test paths were absent before edit: `app/native-existing-file-authorities.mjs`, `app/native-existing-file-authorities.d.mts`, `daemon/test/integration-native-existing-file-authorities.test.ts`. No existing source preimage is touched here. Existing native host batch79 includes the built-in expected-artifact AcceptanceHost; this attempt must use it. Read-only verifier identity/cleanup is migration 039; native runtime receipts are migration 050.
