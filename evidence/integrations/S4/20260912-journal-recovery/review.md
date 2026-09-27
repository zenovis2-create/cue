# Independent review: interrupted native-journal recovery

Date: 2026-09-12 KST  
Verdict: **PASS for the bounded startup hold and protected fresh-journal observation component**

## Reviewed result

`AppDaemon` acquires ownership in its constructor. The real `ownDaemonWorktree` callsite invokes `holdInterruptedJournalRecoveries` before session fencing, AppContainer profile cleanup, and interrupted-write reconciliation for both a stale ledger and the current ledger. An isolated invocation of the actual function proves the current-ledger hold is visible through a second SQLite connection inside the mocked fence callback. Injected fence failure prevents profile cleanup, write reconciliation, and owner publication while preserving the durable hold and lease. The stale-ledger branch has the same order by source inspection; it was not invoked by this runtime regression. The bounded inventory and all idempotent hold inserts execute in one immediate transaction. More than 4096 attempts fails closed. Corrupt held state aborts startup before process handling.

Every attempt belonging to an interrupted run is held, including a terminal attempt whose `cleanup_verified` value is already 1 and whose journal is missing. Reopen preserves one deterministic case per attempt. Reconciliation retains the exact workspace lease whenever any held row exists; it does not auto-resume, start, restore, remove, kill, resend, accept, or release ownership.

The phase-two mutating path is private to `createNativeRecoveryHost`. The public daemon recovery module exports phase one only. Renderer/IPC inputs provide only run, attempt, and identity references; they cannot provide cleanup facts, journal facts, or a recovery callback. The protected host obtains the full native observation from its registered observer, rereads the latest exact terminal receipt through the canonical cleanup-observation store, matches candidate, role, subject, and all six stored session fields, and validates the stored native identity. It repeats authority validation in the final CAS after asynchronous work.

A successful protected observation may append a fresh read-only filesystem journal batch. Missing/legacy/tampered journals, root replacement, unknown native state, stale or mismatched cleanup/session identity, corrupt held state, and fixture observations remain held. No terminal-handoff validator or exhaustive external-effect resolver is registered in this unit, so the host does **not** advance a case to disposition eligibility. The historical label `readonly-attempt-recovery-held` is only a non-authoritative reason string inferred from absence of a root contract; it does not prove the attempt was read-only and grants no authority.

## Preserved failure history

- Initial checker findings: cleanup-verified interrupted attempts could be omitted; inventory ran outside the immediate transaction; held corruption was swallowed; a raw `sourceKind: native` object could reach reconciliation; final authority and held integrity were not fully reread; handoff presence was not integrity validation; empty external-intent inventory was treated as complete.
- The first independent required run was 20/21. The sole failure occurred while another protected-closure gate changed the installation generation.
- The first frozen rerun was also 20/21. This proved a deterministic test-fixture defect: the hostile synthetic installation no longer contained the four native helper/manifest assets required by the current installation closure. The test-owned fixture was corrected without weakening production capture.

## Independent verification

- Required recovery/held/reconciliation/protected-host selection: **4 files, 21/21 PASS**, 80.54 seconds.
- Checker-owned state/module regressions: **1 file, 3/3 PASS**. They verify cleanup-verified missing-journal hold and lease retention after close/reopen, both startup source-order blocks, AppDaemon ownership before native-host construction, and absence of an exported fixture recovery coordinator.
- Checker-owned actual startup regression: **1 file, 1/1 PASS**. It invokes the real `ownDaemonWorktree` against an owned temporary `LOCALAPPDATA`, worktree, and SQLite ledger. Mocked process/profile side effects prove the current-ledger hold is committed before fencing; injected fence failure leaves owner rows at zero and retains the hold and exact writer lease. No process query, kill, or profile cleanup ran.
- `npx --no-install tsc --noEmit`: PASS.
- Maker build after the final product correction: PASS; the independent 21/21 protected-host run occurred against that built closure.
- Scoped `git diff --check`: PASS. The only output was the repository's existing LF-to-CRLF warning for two tracked files.

No model, provider, native executor, process-kill gate, profile-cleanup gate, credential, network, restore, or direct-SQL pass was used. Native journal tests use the existing read-only helper only against owned temporary roots.

## Frozen hashes

| File | SHA-256 |
|---|---|
| `daemon/src/journal-recovery.ts` | `E909C595748BC741BC41CBAAF24DF1E4C8AE3BEC47AB018720616BEFFAD9069A` |
| `daemon/src/held-recovery.ts` | `2DC47F5387432907714504EC3E9653CCC31D905BFF75A2F37E14AFE462D9F2E2` |
| `daemon/src/recovery.ts` | `95B27D155495443F183590739FD65F5155F54B8413A1E8E97008B155268B054E` |
| `daemon/src/daemon-ownership.ts` | `F65E24DC1B423741D68B36FCF0D88E16F03807C31BC9E7046A2C51A4723618DF` |
| `app/native-recovery-host.mjs` | `9A75A130FE3C45EA3AC49313AF527A02123A294C72727FB899DC187234C2C164` |
| `app/native-recovery-host.d.mts` | `5B4E97CB18B652F1B650A8D16D07F2FD98A3114479BE66F9674556A96ECBD40F` |
| `daemon/test/integration-journal-recovery.test.ts` | `025F658C02FE52B2D1CACE4E9DCB5ADDF84595F007020BA2BA73A93BFFBB835E` |
| `daemon/test/integration-journal-recovery-review.test.ts` | `19D1C0C2502940C0C220FB160153620A2867C358CC6A48F2B55982A64977487D` |
| `daemon/test/integration-journal-recovery-startup-review.test.ts` | `14CCB7B2C77D09A2151D3442F3FC93FC4788563D820A0AB6FF33C16A18F09F44` |
| `daemon/test/integration-native-recovery-host.test.ts` | `3E9E7DD6427A7429BA595BCE6EA07E48FB1AB05D6EF8C9FCE1CC61B631D139E0` |
| `daemon/migrations/037_s4_change_recovery.sql` | `40DB0AF5DB2AAD8BCE52A4DFED1219A2A1EC68BA4A11D8E447237044D10C927A` |
| `daemon/migrations/038_s4_native_change_journal.sql` | `3C7EB9A2887D950DE8E9D130B451F136B1C1D9808438DD87E1CD7EC69A25828E` |

This PASS does not prove successful disposition eligibility, terminal-handoff qualification, exhaustive external-effect registration, automatic cleanup, restoration/CAS, real provider/native-executor behavior, or whole S4/S0-S7 completion.
