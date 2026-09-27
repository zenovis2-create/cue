# Maker record — A03 actual-fixture lifetime correction

## Diagnosis

Completion-fence corrective actual 1 failed before cancellation: `driver.stop('workflow')` returned false. Both real process identities were discovered roughly one second after start, while the fixture policy deadline was 1,000 ms and its launch/task limits were 100 ms. The raw log and driver control flow support automatic expiry before the public Stop assertion. Cleanup later proved both exact trees absent, but no completion-fence or sibling-isolation result followed.

## Candidate

Only the test fixture changed:

- policy timeout: 1,000 → 120,000 ms;
- task timeout: 100 → 120,000 ms;
- launch timeout: 100 → 30,000 ms;
- envelope expiry: 60,000 → 180,000 ms.

These values remain within driver validation bounds and are limited to two real local process trees. They do not alter or claim product latency.

Immediately before public Stop, the raw before frame now includes both driver snapshots, both lifecycles, cancellation-request count, and completion IDs. Assertions require both tasks to be `running` with null reason, zero cancellation requests, no completion marker, and unknown billing. This distinguishes manual Stop from automatic deadline/timeout cancellation before the existing exact-identity and sibling-isolation checks.

## Offline evidence

- Loop contract score: 100/100, all seven critical contracts present.
- Revision 1 filtered delayed-cancellation preflight: exit 0, one passed and Windows actual skipped.
- Revision 1 `npx tsc -p tsconfig.json --noEmit`: exit 0.
- Candidate SHA-256: `F3C7581F213D6851F6A2859C684B0C4C4A4D0A7FBC088F9A9EC80EB0CECAE2AC`.
- Preimage SHA-256: `EE2E7682D28D616D438127C7130D7C22F268D55B1D5C75DE91AA628A79EEDA6A`.

Offline revision budget used: 1/2.

## Actual receipt

Independent review cleared candidate `F3C7581F…CAE2AC`, and root coordinated the sole corrective Windows execution after the UI child closed. The exact filtered Vitest command exited 0: one actual test passed, one offline preflight was filtered/skipped, and the targeted test completed in 56.918 seconds.

The raw before frame proved both root tasks were `running` with null reasons, zero cancellation requests, no completion IDs, and billing/provider/cleanup still unknown. Target cancellation completed with both original PID/creation pairs absent. While the target was absent, the sibling heartbeat advanced from 416 to 1,888 bytes and both sibling PID/creation pairs were unchanged. Sibling cancellation then completed; final and cleanup frames showed both exact trees with no remaining original identities.

Corrective actual budget used: 1/1. Product/source hashes remained identical before and after. No product build/edit, model/provider, network, Electron/native application, commit, or push occurred. The receipt proves local public-driver targeted Stop isolation for this fixture; it does not establish provider termination or billing.
