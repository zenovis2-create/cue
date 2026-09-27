# Independent review — authoritative handoff-cost attribution

Verdict: **PASS for the bounded offline attribution seam.** This does not establish provider-supplied invoice decomposition and does not close empirical S2-03 or S5-03.

## Reviewed behavior

- Migration 045 records a fixed legacy measured-fact boundary, immutable legacy membership, immutable attribution rows, and a mandatory per-new-fact projection.
- A known attribution binds the existing authoritative accounting snapshot's exact request, attempt, latest-at-accounting-cutoff final actual budget receipt and digest, exact handoff, and exact orchestration receipt/revision.
- `base + retry + verification + handoff` is checked with `BigInt` against the already-billed safe-integer total. The projection decomposes that total; it does not add components to authoritative `totalUnits`.
- The measured-fact host result and optional attribution result are descriptor/proxy-safe snapshotted once. Preparation and commit occur inside the measured-fact immediate transaction. The prepared value is capability-bound by a `WeakSet`, and commit rejects a forged value or an absent outer transaction.
- Current preparation and commit require the handoff receipt to remain the latest receipt. Historical read validates the exact stored receipt and handoff without consulting a newer current maximum, so later receipt rows do not rewrite old projection meaning.
- Missing attribution remains explicit unknown coverage. A new measured fact cannot exist without its projection; legacy facts require exact immutable legacy membership.

## Independent execution

1. Before the historical correction, an evidence-only same-attempt receipt-revision append reproduced a real defect: exit 1, 11 passed/1 failed, `handoff_accounting_handoff`. The exact temporary assertion is preserved in `independent-review/historical-receipt-reproducer.md`; it was removed from the product test after reproduction.
2. Frozen corrected focused gate: exit 0, 3 files, **21/21** tests. It proves historical replay survives the later receipt while a fresh stale capture is refused.
3. Frozen affected gate initially produced 58/59 because an older Core test expected two callbacks after an oversized primary host snapshot. The implementation correctly stopped after the first callback, before optional attribution capture. Root changed only that test expectation and explicitly asserted zero attribution callbacks.
4. Corrected affected gate: exit 0, 8 files, **59/59** tests:
   - handoff accounting
   - authoritative accounting
   - measured facts
   - measured evidence Core and UI/IPC
   - Core containment
   - observation Core
   - run-report measured evidence
5. `independent-review/compiled-045-smoke.mjs`: exit 0. Observed 4 fresh tables, 12 guards, populated pre-045 baseline rowid 1, exact legacy marker, unchanged legacy payload/digest bytes, legacy read `null`, missing projection refusal for a new fact, stable reopen, missing-trigger startup refusal, and cleanup of every owned database file.

The permanent hostile tests explicitly cover foreign lineage, absent receipt ID, duplicate attempt overlap, unsafe integer, unequal component sum, wrong cost class, zero attribution/projection writes on prepare refusal, and full transaction rollback when the second prepared attribution becomes stale. The test named “nonfinal or absent” mutates the receipt ID to an absent value; it does not independently create a stored non-final receipt. Source inspection separately confirms both the accounting snapshot and stored receipt must have `kind='actual'` and `provider_final=1`. No empirical provider claim is credited.

## Frozen pins

```text
5224355DBF7FDA9157520B4A450FED275B441FE522F88EABA759FA81D935A248  daemon/migrations/045_handoff_cost_attribution.sql
F4AEFDFD192EF28F110F793EBD66D83A5715F2E51C65C393E484F71935CC8072  daemon/src/evaluation/handoff-accounting.ts
32DFB1271DAA02A95F364DA6319486826EB232F27A40616AA0BF0F63B414F099  daemon/src/evaluation/measured-facts.ts
4A8A0994D6F7C4C015D8595CD6080D5B5E7E9E70A36011FFF99DE70C169095D9  daemon/src/ledger.ts
C82EA999F7588F8E90F6217046A087F410C8CAB7F8968C51BC4DA5EE16097313  daemon/scripts/copy-assets.mjs
80F6AE79F7713F054FA14BE7930B45BF91365819CDDA4C2F107A28E29A8B8660  daemon/test/integration-handoff-accounting.test.ts
4FCB2E1AB4F74CC5FA70683CDDDBED8C2A51CC8D5B2EFDCEFECE71E35D585B57  daemon/test/integration-evaluation-authoritative-accounting.test.ts
00DBD304BBE2FD127FA67C6F6C04C4330778A7BBB6600568136C9DDBBC64E793  daemon/test/integration-evaluation-measured-facts.test.ts
92587484EAB220665806CECC1201BDDDB4C112C8CD14799BBD5A496FB47DBB7B  daemon/test/integration-evaluation-measured-fact-evidence-core.test.ts
1C2CFB3984AA8B69D0867C51F90B3349F14C0095C81ACB4489E337F366DBA893  evidence/integrations/S5/20260915-handoff-cost-attribution/independent-review/compiled-045-smoke.mjs
```

The maker's post-correction build exited 0 and pinned compiled handoff-accounting JS as `AE7EE25E692BB8756C7FDBFC097182F3507EE7C779136E920456C50A83394718`. I did not repeat that build during the coordinated source/dist freeze.
