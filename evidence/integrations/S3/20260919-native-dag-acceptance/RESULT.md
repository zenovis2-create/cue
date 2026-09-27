# Native DAG acceptance focused result

Source SHA-256: `F80EC3893F166A1831E5B3CDBE28316A46F2B92FA1AE5D6F21D9FA89D611E41C`.
Test SHA-256: `39D4C900B038542C865CE1556FC88DAC1C38769DFBEBC3164125D911AB99C4E2`.

From `daemon`, `npx vitest run test/integration-native-existing-file-acceptance-host.test.ts --reporter=verbose --no-file-parallelism` passed: 17 tests, 1 platform skip. The first call from repository root failed only because the preexisting fixture resolves migrations relative to `daemon`; rerunning from the package directory passed.

The new fixture has ordered `make` and `make-second` writers with distinct approved requirements and files, then one verifier with a native read-only result receipt. Per-run bindings return separate evidence policies. Both exact files pass their corresponding requirement; altering only the second file yields first pass, second fail, and blocked finalization. A swapped producer mapping fails; a missing native verifier receipt never passes. Re-registering identical bindings is idempotent; changed bindings fail. Legacy single-writer cases remain green.

This focused test uses a synthetic `producerPrincipalForAttempt` callback, as did the preexisting acceptance fixture. Native producer receipt validation is the caller's responsibility and must be covered by the host-composition gate. Root owns the coordinated build; independent reviewer owns final diff judgment.
