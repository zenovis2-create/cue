# Independent review — public-driver restart actual 4

Verdict: **PASS. The original scoped A04 public-driver/native restart gate is closed. S4-05 core behavior passes; its live external-receipt authenticity boundary remains open.**

Reviewed 2026-09-15 (Asia/Seoul). This was a read-only audit. No additional actual run, build, provider, Electron, local-8085, signaling, deletion, or source qualification was performed.

## Frozen basis

- Final source generation: `e09c32b4df353d395c9098fd46b557c771b628cad87fc7fdd6aaf862a981e011`.
- Fixture: `b7f96fd6297e660aa45e5aca24b1dfebeff3c07b60e043384bc15b2a85a113cb`.
- Test: `9f190884922983200eb9fc58f240c77b72004b67b4a0806420a34639ca62754c`.
- All 22 paths in `runtime-pins.json` currently hash to their recorded values; mismatch count 0.
- Build 7's separate staging-authority reopen review is CLEAR, with its reported 129/129 broad and 58/58 required gates.

## Actual artifacts

| Artifact | SHA-256 |
|---|---|
| `actual.log` | `3cb51fb543ba72525de51253c8dee75f3d7abc8bb8171bae32b94c57f2104f86` |
| `observations.json` | `cf4b90cee0e4f508d5287b3869d1ddc2f43e0bec5f50b648c37b07360b588c08` |
| `cleanup.json` | `98b99be28ba95e856a086b7a644734680665e40cab1ca23e341ced628fcd812e` |

The exact command exited 0. All eight tests passed in 19.38 seconds; the actual A04 scenario completed in 13.609 seconds.

## Public-driver crash window

The pinned fixture calls the exported public driver through prepare, persisted approval, activate, and start. The first actual process was independently observed as PID 122412 with creation time `2026-09-15T22:25:00.4498650+09:00`.

Its persisted response proves:

- one launch, one staged open, one staged read, and one native write;
- exactly one durable publication intent and zero durable publication results at termination;
- an exact publication ID and intent payload whose SHA-256 validates against the persisted payload bytes;
- native commit from the six-byte `before` preimage to the 26-byte `published-by-public-driver` postimage while preserving the target identity;
- matching native outcome, on-disk bytes, and SHA-256 `8b27c0cab00b1de03c6c07ee3e06d8914bf3479f7e92b70b1c5926a846f62a35`.

The first child then closed exactly with no stderr. Exit 1 is the intentional crash-window termination outcome, not an assertion failure.

## Real ownership restart and refusal to resume

The second actual process was independently observed as a different PID, 38876, with creation time `2026-09-15T22:25:10.8109410+09:00`. The fixture acquires real `ownDaemonWorktree` ownership before constructing the fresh public driver.

Its persisted response proves:

- public `start('workflow')` and public `snapshot('workflow')` both refuse absent in-memory preparation with `driver_prepare_missing`;
- the separately read durable root task is `blocked` with reason `crash`;
- the original and only attempt remains `blocked` with `cleanup_verified=0`;
- the original change set is represented by one `held` case at revision 0 with `final_seal=null`, reason `interrupted-native-journal`, and exactly one transition;
- the held payload SHA-256 validates against its persisted bytes;
- the original workspace write lease and `AM target.txt\n` artifact remain;
- publication result, receipt, acceptance, replacement attempt, and new attempt counts remain zero;
- one `blocked_no_auto_resume` recovery record exists;
- relaunch, publication authorization, staged reopen, staged reread, and native resend/execute counters are all zero;
- target bytes and SHA-256 exactly match the first process's committed postimage.

This is a real separate-process ownership restart over the same SQLite ledger and owned worktree. It proves the unresolved native side effect stays held and is not automatically relaunched, reopened, reread, resent, overwritten, receipted, accepted, or replaced.

## Cleanup

`cleanup.json` records both exact child identities closed. Both Node `signal` fields are null, and neither child has a recorded cleanup error or stderr. The first child was nevertheless intentionally terminated through exact-identity tree termination at the crash window; a null Node signal field does not mean no termination action occurred. The restart child exited 0. The receipt records the exact root `D:\\Temp\\User\\cue-public-driver-restart-4RnSNZ` absent and not retained.

Independent read-only checks found both PIDs absent and the exact actual-4 root absent. The retained actual-2 root `D:\\Temp\\User\\cue-public-driver-restart-k3JYSB` remains present and untouched.

## Scope verdicts

**A04 original scoped gate: CLOSED / PASS.** The previously missing public-driver plus real daemon-ownership startup path is now exercised across an intentional mid-publication process death and a different restart PID. It proves duplicate launch, staged access, resend, and write resume remain zero until an explicit reconciled action. This does not qualify a live provider session, provider reconnection, machine power loss, or source installation.

**S4-05: CORE PASS, LIVE BOUNDARY OPEN.** The gate now proves held recovery after a real native external file side effect, preserved lease/postimage, and no automatic side-effect resume through the public-driver ownership restart. The remaining execution map separately requires external receipt authenticity at the final live boundary. No provider or authenticated external receipt participated here, so that broader live-required portion is not closed or inferred.

No further actual run or build is required for this scoped A04 closure.
