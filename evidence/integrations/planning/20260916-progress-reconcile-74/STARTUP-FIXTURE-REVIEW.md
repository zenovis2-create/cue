# Startup fixture correction review

## Verdict

**CLEAR.** The test-only correction fixes the positive startup-fence fixture without weakening production process-identity checks or the reused-PID negative case. The root-owned focused gate passed both named cases.

## Reviewed scope

- Current `daemon/test/p10c-core.test.ts` against `startup-fixture/preimage-p10c-core.test.ts`.
- Production matching in `daemon/src/recovery.ts` and `daemon/src/process-termination.ts`.
- No production source was changed by this correction.

## Findings

No actionable defect found in the corrected source.

The prior positive fixture captured wall-clock time before spawning the child. Windows startup recovery compares the persisted session start time to the process's actual CIM creation identity, then passes that same expected identity into verified tree termination. A timestamp sampled before spawn is therefore not a valid positive identity and can correctly produce `pid_identity_mismatch_refused`.

The correction spawns the child first, polls `observeProcessTree` for that exact PID, and persists the returned `createdAt`. The poll is bounded at five seconds; failure to observe the child prevents construction of a guessed positive identity. This exercises the same identity representation consumed by the production normalization and comparison paths.

The reused-PID negative fixture remains unchanged: it persists the deliberately mismatched `2000-01-01T00:00:00.000Z`, asserts the child is still alive, and expects `pid_identity_mismatch_refused`. The fixture still cleans up the child explicitly after observing the refusal.

## Evidence limits

- The preimage plan records the pre-edit Git-object hash as `b452425820a9ee3e408b2556529abb820700799f703410a2eb419d2f7b8b7d46`. The stored preimage copy hashes to `b50d2786f92fe30b04698cc3197388dfcfe0998e86406a56a3c133c770d15f50`; the plan identifies line-ending normalization, so the stored copy is not claimed as byte-identical to the Git object.
- Current corrected test file SHA-256: `3c15c518b4796d95d794f3b5d13457ca798aa39d3440f4828e2811c0af727f96`.
- This review establishes source alignment only. It does not close broader recovery or qualification work.

## Focused gate

Root ran from `daemon/`:

```text
npx --no-install vitest run test/p10c-core.test.ts -t "fences a verified|refuses to kill a reused" --reporter=verbose --fileParallelism=false --maxWorkers=1
```

Result: exit 0; 2 passed and 15 skipped in 19.03 seconds. The verified-session case passed in 12.29 seconds and the mismatched reused-PID case passed in 5.99 seconds. This confirms that the observed identity allows verified positive termination while the mismatched identity preserves refusal behavior.

The bounded result record is `startup-fixture/RESULTS.md`, SHA-256 `994e8b9ccbb82febd4acd54c25a3b6359b19a7665b83705c4c79390f868a0858`. It records that no broader test, build, provider, model, network, or live-budget call was part of this correction.
