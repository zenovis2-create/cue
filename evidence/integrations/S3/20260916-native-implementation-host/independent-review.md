# Batch 72 native implementation host — independent review

Verdict: **CLEAR for the bounded offline composition seam, not production startup or successful execution.** Reviewer `/root/broker_review`; maker `/root/native_host72`. Source review, one initial focused gate and one correction gate, and final no-emit typecheck only. No shared build, provider/model/Qwen/native-helper invocation, new subagent, or product edit by reviewer.

## Final source-bound gates

Working directory: `C:/Users/User/cue/daemon`.

```text
npx --no-install vitest run test/integration-native-implementation-host.test.ts --fileParallelism=false --maxWorkers=1
Vitest 4.1.11; 2026-09-16 08:20:50 KST; 2/2 PASS; 929ms; exit 0
tool e170f9

npx --no-install tsc --noEmit -p tsconfig.json
exit 0; tool 14902a
```

| File | SHA-256 |
| --- | --- |
| app/native-implementation-host.mjs | 7B1889677FA70BDEFD90903FD40CFB0F1D16D8C9A2590A6A27553652D1513CFD |
| app/native-implementation-host.d.mts | CA6483961F4AB3B3D8383BDE71396D34B69738E54A8C9D7611DE81FC16112017 |
| daemon/test/integration-native-implementation-host.test.ts | 06FD292E74BF9F0AFD2CA8547B95C0E939C28E09B986B88D72865E254F94D2DD |

The first independent gate also passed 2/2 at 08:18:27, 1.20s (57534a), on mjs 5F6368B8ABB53984756370D45CED7DD207A575F4AC42EA2EBED36629D04ABF41 and test 3B711B4A2AD7BF58D3C5052A1E192C7AAF6E3BE5947B73C080FFF8D93C40A5A0. It was **not** cleared: review found two defects absent from those assertions. Maker preserved those bytes under correction/preimages. Final two tests contain additional assertions; do not sum the repeated runs into four unique tests.

## Findings and resolution

1. Preliminary role mismatch: orchestration/engine.ts maps every non-implementation task, including verifier, to runtime role `model`; driver forwards that role. The old factory required `verifier` and would reject the verifier. Final authorizeRun accepts only implementation/implement with the implementation candidate, or model/verify with the verifier candidate, in addition to the supplied authorization callback. This was source-traced; the Core refusal fixture does not reach a successful verifier launch.
2. Preliminary mutable callback containers and driver limit mismatch were corrected. Clock/callback references are captured, plain nested runtime/evidence/authority data is recursively copied and frozen, and limits now match driver prepare: launch 120000ms, task 600000ms, poll 1000ms. Function internals and the ledger remain trusted host authority; freezing references does not attest their behavior.
3. At the first freeze, supportedRoles was still read before candidate snapshot, invoking a nested getter. Final code snapshots the verifier candidate first; the regression rejects its hostile accessor with getterReads=0. The test also preserves top-level accessor refusal.
4. At the first freeze, conservative cost was compared with the role reservation cap only during factory construction. A later fresh observation could rise from 1 to 100 while a reservation of 10 still passed. Final observe(role) snapshots and checks the exact observation returned to the engine on every call; the regression rejects this drift before reservation (counter 0). Engine selection separately checks policy eligibility/freshness. Reservation currency/unit/source and role upper units are tied to configured accounting, while final receipt verification remains a supplied authority.

No remaining blocker was found for the limited seam and documented trusted-input boundary after this correction.

## Actual coverage and authority

The positive setup fixture uses real Core, deployment wrapper, driver and SQLite stores, synthetic catalog/measurement/monetary observations, and synthetic staging callbacks. It prepares the implementation→verifier plan, approves it, persists the existing-file target contract and approval, and reaches the execute path. Missing capability evidence then produces blocked with provider launch counter 0. This is a refusal test, not a production candidate qualification or successful workflow. The cost drift assertion directly exercises the host observation function; it does not independently run a paid-cost transition through a provider.

The deployed staging wrapper adds executionStaging to the returned host before driver prepare. Driver/staging authority binds the attempt execution workspace; the final publication host derives registered staged replacements from immutable attempt/change-set lineage and native snapshots. The new factory's stagedPublication marker itself is a declaration, not measured capability. As LIMITATIONS.md states, the supplied Codex binding resolver must use that driver-created stage envelope. This review does not qualify an arbitrary resolver, prove writer quiescence, or authorize direct publication to the original workspace.

Distinct candidate IDs and owner labels do not prove independent review. Existing acceptance.ts resolves principals for all maker attempts and rejects a verifier principal shared with producers; strict requirement/checker/manifests and final acceptance remain required. The legacy Codex host's file-change goal heuristic is not final acceptance. This factory delegates receipt, cleanup, manifest and checker authority and never fabricates those facts. TEST money is fixture data, not measured provider pricing.

## Reachability and remaining work

At review time main still obtains createStartupOrchestrationFactory from protected-installation.mjs; that factory composes the configured generated-JSON host, not this new module. Native host construction is exercised through explicit injection in the test only. No default native startup activation is established. Protected current account entitlement/binding, independent verifier executor/principal/evidence policy, monetary observations/final billing, requirement configuration and final acceptance authority are still absent from that startup path.

The new module does not inspect the installed Codex binary, version, signature, CLI schema or authentication itself. It consumes host-supplied catalog records and current subject/evidence callbacks; current runtime capability admission still must succeed. Separate installed-CLI metadata/help observations, if completed by other workers, cannot turn this 2-test seam into Codex execution compatibility. No installed CLI was invoked in this review. See [LIMITATIONS.md](LIMITATIONS.md) and [correction history](correction/RESULT.md). S3 successful implementation, independent verifier, final acceptance, billing settlement and release closure remain open.
