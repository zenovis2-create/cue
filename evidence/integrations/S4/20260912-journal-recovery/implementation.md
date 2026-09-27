# S4 interrupted-run journal recovery implementation

Date: 2026-09-12 KST

The daemon ownership path now inventories every orchestration attempt belonging to an interrupted workspace run and creates or validates one immutable held-recovery case per attempt in a single immediate transaction. This transaction runs before session fencing and AppContainer profile cleanup for both a previous ledger and the current ledger. The inventory is complete up to a fail-closed cap of 4096. Exact reopen/replay changes no bytes. Corrupt held state aborts startup before process handling.

`reconcileInterruptedWrites` retains the run flag and exact workspace lease whenever any recovery case exists for the run, including cleanup-verified attempts and corrupt/finalized case states. A missing writable journal, legacy journal, readonly attempt, and unknown recovery coverage all remain held. Readonly attempts are labeled separately and receive no invented empty filesystem journal.

The registered native recovery host appends a fresh change-journal observation only after all of these facts agree: the protected installation guard and stored lineage resolve; the host-owned native observer reports no matching live/unknown process, matched path provenance, and absent task/profile paths; the exact terminal receipt references a hash-valid cleanup observation; and that observation matches the attempt's native subject and session and says `verified-clean`. Fixture observations never qualify. Journal/root/helper/tamper failures append unknown observations or remain unavailable. Reconciliation has no registered artifact resolver or exhaustive external-effect authority in this unit, so it honestly remains held.

No API accepts a cleanup/death boolean or cached journal observation. No start, resume, selection, reservation, restore, resend, provider/model/native-executor, credential, acceptance, or direct-SQL-pass path was added. Renderer projection is separately owned and exposes no authority-bearing command.

## Maker verification

- Recovery journal cases including real read-only Windows helper tamper/root replacement: **5/5 PASS**.
- Held/recovery/backend/native-host combined: **21/21 PASS**. The prior 20/21 run exposed a stale hostile installation fixture that omitted four packaging-required native helper/manifest assets. Updating only that synthetic fixture to the current required closure made the previously failing guard test pass.
- `npx --no-install tsc --noEmit`: PASS.
- `npm run build`: PASS.
- Scoped `git diff --check`: PASS (line-ending notices only).

## Candidate hashes

| File | SHA-256 |
|---|---|
| `daemon/src/recovery.ts` | `95b27d155495443f183590739fd65f5155f54b8413a1e8e97008b155268b054e` |
| `daemon/src/held-recovery.ts` | `2dc47f5387432907714504ec3e9653ccc31d905bff75a2f37e14afe462d9f2e2` |
| `daemon/src/journal-recovery.ts` | `e909c595748bc741bc41cbaaf24df1e4c8ae3bec47ab018720616beffad9069a` |
| `daemon/src/daemon-ownership.ts` | `f65e24dc1b423741d68b36fcf0d88e16f03807c31bc9e7046a2c51a4723618df` |
| `app/native-recovery-host.mjs` | `9a75a130fe3c45ea3ac49313af527a02123a294c72727fb899dc187234c2c164` |
| `app/native-recovery-host.d.mts` | `5b4e97cb18b652f1b650a8d16d07f2fd98a3114479be66f9674556a96ecbd40f` |
| `daemon/test/integration-journal-recovery.test.ts` | `025f658c02fe52b2d1cace4e9dcb5addf84595f007020ba2ba73a93bffbb835e` |
| `daemon/test/integration-native-recovery-host.test.ts` | `3e9e7dd6427a7429ba595bce6ea07e48fb1ab05d6ef8c9fce1cc61b631d139e0` |
