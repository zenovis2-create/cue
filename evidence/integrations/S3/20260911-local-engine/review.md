# Independent local engine and policy identity bridge review

Result: no actionable blocker found in this bounded implementation. Independent **8 suites / 101 PASS**, 2026-09-11 21:30:34 local time, duration 11.13 seconds. Root reports the shared build subsequently passed after the separate driver legacy-overload correction. No model/provider calls or product edits by this reviewer.

Reviewed SHA-256:

- `daemon/src/orchestration/engine.ts`: `E224325A474BDA7641081BE18F271C5C7D5D5725D456FEF53C384376D92CBDA8`
- `daemon/src/selection/run-policy-identity.ts`: `443260196900DBF5804DFCEBAF69ADB04EB2CEF3B10BD94CA7E9E96DBC0A800F`
- `daemon/src/verification/requirements.ts`: `3AA08AB8FEA2FA7E146BF546C5A01E335E916F502386691FBA44FCC3B08E3ADD`
- `daemon/src/orchestration/stage-envelope.ts`: `41EA97006E7D5AC4FD652B0AD22C78F61D7066151D47E8ED6C5F3C3F5CAD7519`
- `daemon/test/integration-local-engine.test.ts`: `C1AF3B7B26566B1C251A68BCB5C6D485218794DE3AD55A3F28C2501E4B928CEF`

Local dispatch uses an exact immutable local policy, matching plan approval revision/digest and invocation budget. It requires a fixed producer/checker pair with the checker depending on the producer; both use model-only runtime roles. Current host eligibility checks are evaluated before the durable claim. Claim, row-derived count reservation, synchronous stage preparation and request journal share one transaction; runtime launch occurs only after commit. Stage/check/cap/age/timeout rejection rolls the new state back without launch.

Exact replay validates the recorded request, claim and reservation, does not repeat selection or launch, and cannot acquire ownership by creating a new engine instance. Failed or uncertain starts retain the committed intent and cannot produce cleanup/acceptance through a missing future-launch fence. Explicit retry requires the existing trusted failure/cleanup contract and consumes a new count. The shared lifecycle preserves monetary reconciliation for the old engine while the local path rejects billing fields and never turns invocation count into provider usage, monetary settlement or acceptance.

The initial monetary-only requirements/stage reads were real integration gaps. The final typed identity resolver validates both immutable snapshot forms, refuses conflicting bindings and corrupted snapshots without falling back, and only treats a genuinely absent pre-022 local table as historical absence. Requirements retain exact policy/plan checks. Stage binding preserves monetary candidate allowlists and enforces local role-specific producer/checker identities, rejecting swapped candidates. Acceptance and retry consume the existing requirements/stage lineage without changes to acceptance core.

Independent gate command from daemon:

`npx vitest run test/integration-local-engine.test.ts test/integration-engine.test.ts test/integration-retry-backend.test.ts test/integration-runtime-contract.test.ts test/integration-requirements.test.ts test/integration-stage-envelope.test.ts test/integration-acceptance.test.ts test/integration-acceptance-history.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

The 101 passing checks comprise 13 local-engine scenarios, 37 existing engine/retry/runtime regressions, and 51 requirements/stage/acceptance/history checks. Local stage cases bind actual temporary-worktree envelopes; injected runtime/evidence fixtures test composition and are not newly measured live capability evidence.

Build provenance: the maker's intermediate shared build was blocked by an unrelated driver test union type. Root later confirmed the build owner obtained exit 0 after fixing legacy overload ordering; this reviewer did not duplicate the shared build. Current driver fixtures and bootstrap assembly are separate workers' scopes.

Limits: engine managers and host callbacks are protected trusted objects over the supplied database. The new path performs fixed-pair routing with `ranking: not-performed`, not optimization or cost measurement. This review does not establish actual generated-host/local-bootstrap execution, fresh model qualification, provider request counts or a successful post-correction live canary. Historical failed canary evidence and its exhausted two-request allowance remain unchanged.
