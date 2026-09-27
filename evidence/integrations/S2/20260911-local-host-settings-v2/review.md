# Independent local host settings v2 compatibility review

Result: no actionable blocker found. Independent focused suite **8 PASS** at 2026-09-11 21:20:52 local time, exit 0. No product edits, admission issuance, execution or model calls.

Reviewed hashes:

- `daemon/src/selection/local-host-settings.ts`: `B9A08D81232946639D0CBB423D397BFC1F39EB66FB25F193E24EE527CCF61ADC`
- `daemon/test/integration-local-host-settings.test.ts`: `E6348BFE213E8DF95A2646AC4151C1CE17A96D950B1AE0CA3CFE895246EF3B06`
- Existing migration 020: `3DB8FF78F291AA9868EDD5C886F6F2CD490B3BC91862C146DEEEFCA8AFA39195`.

V1 retains its original canonical object ordering and policy-table interpretation. The fixed pre-v2 baseline digest `4b7f71d3303794b41cd7dd999d365ad418a944d06842e04779f2a9826c739a9a` remains unchanged. V1 local-invocation intent does not silently reinterpret old monetary selection references as local policy references.

V2 requires the explicit version discriminator and only `{kind: local-invocation}` accounting. It resolves references solely through the new local policy table, requiring exact ID/revision/digest and matching mode. Same IDs/revisions deliberately present in both policy tables do not cross-resolve. V2 rejects monetary accounting, currency/price fields, wrong mode/digest and settings invocation/time limits above any referenced policy. Later policy updates do not replace an explicitly referenced historical revision.

Descriptor-only strict schemas preserve getter/proxy rejection without evaluating accessors. Snapshots and nested references remain frozen and defensively reconstructed. Cross-connection CAS, actual database reopen, outer transaction denial, canonical byte/hash verification and referenced-policy corruption refusal all pass. Existing SQL immutability guards continue rejecting update/delete/REPLACE/UPSERT with recursive triggers disabled.

Command: `npx vitest run test/integration-local-host-settings.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from daemon. The coordinated shared build was reported successful by transport_review after the unrelated engine/settings type fixes; this reviewer did not repeat the shared build. Initial source lookup omitted the `selection/` directory, then the correct file was read and hashed.

Limits: settings express protected host intent. Enabled state, source reference, local mode name and count limits grant no capability admission, price knowledge, provider-request proof or launch authority. Active engine/app assembly remains a separate integration concern.
