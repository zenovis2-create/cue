# Independent review: generated host checker-policy contract

Date: 2026-09-12 KST  
Verdict: **PASS for the bounded per-configuration checker-policy correction**

## Finding and corrected behavior

The original `runs shared-ledger` integration failed with `invalid_requirements:array` because the production generated acceptance checker omitted the `evidencePolicies` array required by the strict requirement snapshot. The correction does not relax `checkerSnapshot`, requirement validation, quarantine, acceptance evidence, or the disabled pass gate.

`createGeneratedJsonHost.prepare` now places one frozen checker descriptor in the exact run configuration. Its evidence policy derives from the run's requirement, producer task, input SHA-256, target, parameters digest, fixed checker ID, and pin-derived checker revision. The orchestration driver validates only that configuration's bounded descriptor array, rejects duplicate or unreferenced checker descriptors, and uses the local resolver while it validates and atomically stores that run's requirement contract. Other hosts retain the existing registered-checker resolver.

The native generated acceptance host independently recomputes the expected policy from the persisted generated-output target before collection. It compares the normalized policy identity instead of trusting a context-supplied source revision. Wrong checker identity or revision is rejected before policy issuance. This keeps policy provenance tied to stored input/target facts and the pinned checker rather than a caller string.

## Runtime evidence

- The original generated-host file, including `runs shared-ledger`, passes **16/16** with synthetic owned executors.
- The independent combined run of the original file plus checker-owned policy regressions passes **2 files, 18/18** in 14.21 seconds.
- Checker-owned regressions verify deterministic frozen policy descriptors; sensitivity to requirement, producer, target, revision, parameter, and input facts; rejection of a wrong checker ID; and the production pin-revision/configuration callsites. The first checker pass was 1/2 because it incorrectly expected `requirementId` to alter `sourceRevision`; correction pass 1 instead verifies that requirement identity changes the full descriptor while source revision remains the source/target revision. Final result: **2/2 PASS**.
- Maker two-run/file-reopen coverage verifies distinct inputs produce distinct parameters and source revisions, each persisted checker contains only its own policy, and the first run remains unchanged after reopen.
- Maker generated acceptance, requirement, and driver gate: **53/53 PASS**; final post-schema driver/generated-host gate: **52/52 PASS**.
- Independent `npx --no-install tsc --noEmit`: PASS.
- Maker build and scoped diff check: PASS.

No live model, provider, native executor, process kill, cleanup operation, credential, network, paid call, approval expansion, or verification pass was used.

## Frozen hashes

| File | SHA-256 |
|---|---|
| `app/generated-json-host.mjs` | `36B0621E489BD89EA8EF666D2A488B624A5A18F631ACD3D3243C276E4A091D31` |
| `app/orchestration-driver.mjs` | `592306B40369E8386C0493A4BC25906B0DC208B94BDE92A53C2390A13B8CAE0C` |
| `app/orchestration-driver.d.mts` | `827D295C1D7D876D9673689151762B8D0F6796B5B5F8A5190A61405A323FB53D` |
| `daemon/src/verification/generated-acceptance-host.ts` | `C7FDD3F509630C5CD39ACA7A0D1CA31C5AB072A866506E14EDB87CD36CE11BFC` |
| `daemon/test/integration-generated-json-host.test.ts` | `940EEC7CF4AE33ED31FA882A2F8FE405E931ACE778063E81E8E638964BD38A64` |
| `daemon/test/integration-generated-acceptance-host.test.ts` | `D6988F399DCF3CD8C943524C56B95C2A27D4FACDAF3F8FAA1627D8DD3526C542` |
| `daemon/test/integration-generated-host-contract-review.test.ts` | `2DE7544C73B5854CB9BEF32CBCA2C7884E45F19C6281E1FE7FB8E141D5D7D054` |

This PASS proves the generated JSON checker's per-run evidence-policy binding and restores the original synthetic shared-ledger integration. It does not prove a live model/checker run, acceptance pass, native isolation, billing, cleanup, recovery eligibility, or whole S4/S0-S7 completion.
