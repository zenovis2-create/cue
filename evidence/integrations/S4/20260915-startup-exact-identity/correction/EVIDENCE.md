# PID-rebind correction evidence

Corrected source freeze (SHA-256):

- `daemon/src/recovery.ts`: `AEE9628ADEF18E2C01A10E465A1D213FA1E66C097B5C4F865276AAA851C20406`
- `daemon/src/process-termination.ts`: `6E91F4ACAFFDC410B1AB4531FFCFEF8BE90DBEACAC3E1BD6A9327023964421DE`
- `daemon/test/integration-startup-exact-identity.test.ts`: `BCA85E0B2C23D1607222CB2F2F77B5C5B20FFB3E5640BC3B09B2FD2A0C6CC99D`
- `daemon/test/integration-termination-exact-identity.test.ts`: `31BD9FD0728E59D65F17518AE7D821DCA2B68B8759628FD696FAF000B06BFAAF`
- `PLAN.md`: `CBF3A9FCC9AD1AB821F28F5EAA3C4225522A7B7BC203364F47E1225880499ECC`
- `fullpreimages/PINS.md`: `4161BADB6360C4DD9BA22BB8FE42C9BE0700B2F7212D82717689A4BD400F8042`

Offline gates on Windows:

- `npx vitest run test/integration-termination-exact-identity.test.ts test/integration-startup-exact-identity.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`: PASS, 9/9.
- `npx tsc -p tsconfig.json --noEmit`: PASS.
- Final second-pass rerun (`--reporter=dot` plus `tsc --pretty false`): PASS, 9/9 and no-emit.
- `npx vitest run test/p11-writer-corrective.test.ts -t "failed initial process query" --reporter=dot --fileParallelism=false --maxWorkers=1`: PASS, 1/1 selected (14 skipped).
- `git diff --check` on the four source/test files: PASS.

The new termination test uses the real `terminateVerifiedTree` helper with mocked OS command and liveness boundaries. When its fresh observation reports the same PID with a creation time differing by one 100ns tick, it raises an out-of-scope refusal after one observation and makes zero `taskkill` calls. The equivalent-offset exact identity reaches one mocked `taskkill` call.

The initial recovery process query is bounded to 15 seconds and hides its Windows console; the focused regression checks both options.

Scope limitation: the correction binds recovery's identity to the termination layer's immediate pre-signal observation. Windows `taskkill` still accepts only a PID, so this does not provide an atomic kernel-handle guarantee against reuse in the remaining interval between that observation and `taskkill`. Closing that narrower interval requires native handle-based termination and is outside this bounded correction.

No real process kill, build, provider/network call, or localhost call ran.
