# Held legacy retry admission implementation

The before behavior and original hashes remain preserved in `RESULT.md`. The store's final admission snapshot now checks a de-duplicated set containing both the ordinary retry prior attempt and the recovery-decision prior attempt. This read occurs after claim authorization, retry classification/clock callbacks, retry cap checks, and revision freshness checks, before any writer lease, attempt, activation, retry link, or stage mutation.

Behavioral coverage proves open, callback-created open, reconciled-stop, and bad-seal cases reject with no new store writes. It also proves no-held and valid sealed eligible-for-disposition retries proceed, and exact replay of an already inserted attempt remains `launchRequired:false`.

Command, from `daemon/`:

```text
npx vitest run test/integration-held-retry-admission.test.ts test/integration-held-recovery-admission.test.ts test/integration-retry-backend.test.ts
```

Result: 3 files, 19 tests passed on the first implementation pass.

Hashes:

- `daemon/src/orchestration/store.ts`: `267B755F0C6CE4EC4267B522686878D77305FA19AD12354A72B0045FDEAA5E02`
- focused test: `077D3D371F2D370C474A40956E2C72306B786C33092D05D42955D04C7105FEF5`

This is a store admission result. Budget reservation and execution preparation occur later in the engine and were not invoked by this fixture. Root owns the shared build; no native/live/model/provider action ran.
