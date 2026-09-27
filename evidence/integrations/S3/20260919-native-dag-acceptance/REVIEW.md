# Independent acceptance review

Reviewed source SHA-256: `daemon/src/verification/native-existing-file-acceptance-host.ts` F80EC3893F166A1831E5B3CDBE28316A46F2B92FA1AE5D6F21D9FA89D611E41C; `daemon/test/integration-native-existing-file-acceptance-host.test.ts` 39D4C900B038542C865CE1556FC88DAC1C38769DFBEBC3164125D911AB99C4E2.

Independent command from `daemon`: `npx vitest run test/integration-native-existing-file-acceptance-host.test.ts --reporter=verbose --no-file-parallelism` exited 0, 17 passed and 1 platform skip. This checks the real Windows snapshot helper, two separately bound producer requirements, per-requirement pass/fail, swapped producer mapping refusal, and missing verifier receipt refusal.

The host verifies each registered requirement against its persisted plan, check parameters, target IDs, and evidence policy. Collection selects the matching binding, checks the verifier task and receipt, filters its measured targets, and emits its producer principal from the requirement-specific acceptance context. The core acceptance verifier checks that the emitted principal belongs to that requirement's producer tasks. Identical run binding retries are idempotent; changed bindings refuse. I found no source-backed acceptance defect at these hashes. This focused result does not by itself qualify the complete Core/Git multiwriter execution path.
