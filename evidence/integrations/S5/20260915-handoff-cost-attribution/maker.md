# Maker record

## Scope and claim limit

This unit adds an offline, synthetic-authority path that partitions an existing exact final invoice across exact stored request, attempt, handoff, and receipt lineage. It preserves the authoritative accounting total and historical v1 facts. It does not supply a real provider invoice producer, prove parallel-provider allocation, or close S2-03/S5-03 empirically.

## Maker passes

1. `focused-pass1.log`: 12 passed, 8 failed. One projection payload digest construction defect affected every failure.
2. `focused-pass2.log`: 19 passed, 1 failed. Production behavior passed; the replay test incorrectly required the ordinary measured-input evidence resolver to remain unused, beyond the attribution callback contract.
3. `focused-pass3.log`: 19 passed, 1 failed. Production behavior passed; the destructive missing-supplement fixture dropped a required trigger and therefore correctly failed earlier with `handoff_accounting_schema` instead of reaching `handoff_accounting_projection_missing`.

The declared cap of three maker passes is consumed. Production source is frozen. The remaining exact fixture correction was handed to root as a separate narrow unit: save the immutable-delete trigger SQL, drop it, delete the projection, restore the exact trigger SQL, then retain the exact missing-projection assertion.

## Other gates

- `build-pass1.log`: `npm run build`, exit 0, before the final test-only handoff.
- TypeScript no-emit check: exit 0 before the final test-only handoff. The console result was observed but not captured to a raw log, so no stronger artifact claim is made.

## Frozen source pins

- `5224355DBF7FDA9157520B4A450FED275B441FE522F88EABA759FA81D935A248`  `daemon/migrations/045_handoff_cost_attribution.sql`
- `EB6504DBEC4E6108FDB88292EA42BB6C65E57F01902FE51E33C7171E5AE70678`  `daemon/src/evaluation/handoff-accounting.ts`
- `32DFB1271DAA02A95F364DA6319486826EB232F27A40616AA0BF0F63B414F099`  `daemon/src/evaluation/measured-facts.ts`
- `80F6AE79F7713F054FA14BE7930B45BF91365819CDDA4C2F107A28E29A8B8660`  `daemon/test/integration-handoff-accounting.test.ts`
- `9A0025B4D15E9E05F56DCFE590079FB488CE99FF9C828FF43A2C3503F8BC3E69`  `daemon/test/integration-evaluation-measured-facts.test.ts`
- `4A8A0994D6F7C4C015D8595CD6080D5B5E7E9E70A36011FFF99DE70C169095D9`  `daemon/src/ledger.ts` (root-owned registration)
- `C82EA999F7588F8E90F6217046A087F410C8CAB7F8968C51BC4DA5EE16097313`  `daemon/scripts/copy-assets.mjs` (root-owned registration)
