# Independent local JSON setup backend review

Verdict: PASS for configureLocalJsonSettings and the private writer extraction. No blocking defect found. This is explicit configuration persistence, not qualification, startup activation or execution permission.

Done gate: read-only review of the new setup delta, focused setup and existing settings tests, typecheck and hashes. Review cap 1; only this evidence file is written by reviewer. Reviewer originally authored the settings base, which has a separate independent review; this verdict covers another maker's new setup function/refactor, with old tests used as regression evidence rather than self-approval.

Independent checks (2026-09-11):
- cwd daemon: `npx --no-install vitest run test/integration-local-json-setup.test.ts test/integration-local-host-settings.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`: exit 0, 14 passed, started 21:54:16, duration 1.09 s.
- cwd daemon: `npx --no-install tsc -p tsconfig.json --noEmit`: exit 0.
- settings source SHA256: 94466A3C36A408F2D0B519AB54F4D1FDF39414AA1EC6DD1E944E1947ED47D3FE.
- new setup test SHA256: 29A71ED4693B00A77D19F46F152B18CBAA7A081CA24A64A0DB576D45809A467F.
- existing settings test SHA256: E6348BFE213E8DF95A2646AC4151C1CE17A96D950B1AE0CA3CFE895246EF3B06.

Confirmed:
- Exact descriptor-based input is expectedRevision/enabled/limits/createdAt. Unknown candidate/policy/path/authority fields cannot be supplied. Getter/proxy/inherited objects reject before invocation or writes.
- Fixed default settings identity and producer/checker identities; four versioned local policies get identical explicit count/time limits and correct distinct modes. Setup limits are 2–1000 attempts, 1000–120000 ms, bounded output bytes/tokens. No monetary references, prices, currency, quality score or estimates are invented.
- An outer immediate transaction checks settings CAS before creating any policies. Each nested policy write and final settings write remains inside that transaction. Separate-connection stale CAS performs no writes. Failure injected at the third policy or settings insert rolls every newly inserted row back; a later valid call succeeds.
- The extracted private writer does not expose transaction bypass: public saveLocalHostSettings still rejects caller-owned outer transactions. Existing V1 literal digest, V1/V2 reads and policy-table separation regressions pass.
- Disabling/updating creates new immutable references; prior settings and policy revisions survive actual SQLite reopen. No existing approval binding is replaced by this setup function.
- Capability evidence, attempts, sessions, money budgets and monetary policies are not created by setup. Enabled remains intent; authentication, provider/resource discovery, M qualification and launch remain separate guarded operations.

This review contains no model request, native process probe, main/IPC/UI wiring or product source edit. The fixed candidate IDs identify the intended local pair; they do not certify that either candidate is installed, available or qualified.
