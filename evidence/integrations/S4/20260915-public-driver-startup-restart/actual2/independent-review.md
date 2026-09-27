# Independent review — public-driver restart actual 2

Verdict: **PARTIAL EVIDENCE, A04 NOT CLOSED. Preserve the retained root and do not rerun from these artifacts.**

Reviewed 2026-09-15 (Asia/Seoul). This audit was read-only. It did not reopen ownership, signal or terminate a process, delete or modify the retained root, build, contact a provider, use local-8085, or rerun the actual gate.

## Evidence hashes

| Artifact | SHA-256 |
|---|---|
| `actual.log` | `cc477beb1470eb74618b66bb325701a018412fcd00c63476e1c0ae1455603baa` |
| `observations.json` | `8e8e449333d172fb03befa1470e5dcd58f5e927a4c0900199874f50e090e721d` |
| `cleanup.json` | `9895c1e5b742067d652098c30d52b73c164cd3a01d20dc63743c44503beb724f` |
| retained `ledger.db` at review time | `6446e33d30443a0b5c0a1f3176cfeb14a352ad32cbc7db3f09c34a3735fd078a` |
| retained `worktree/target.txt` at review time | `8b27c0cab00b1de03c6c07ee3e06d8914bf3479f7e92b70b1c5926a846f62a35` |

Fixture pins were `0fbba6f74353d6bac91a6ea29f0136ca07b1a703da8514a55c1a23aa827ee879` and `a2c5ccd9d4dfdb76e98f4d6a49daeb08228aa11fa4bcdc983fe53f693eb41677`. Complete runtime pins remain in `runtime-pins.json`.

## What actual 2 proves

The four offline tests passed, then the actual scenario failed after about 17 seconds with `public_driver_restart_frame_eof`; cleanup separately reported `public_driver_restart_identity_changed`.

The persisted first response binds independently observed PID 24752 and creation time `2026-09-15T22:07:17.3652550+09:00` to a genuine public-driver effect. It proves:

- exactly one launch, staged open, staged read, and native write;
- exactly one durable publication intent and zero publication results at the crash window;
- the exact publication ID and a payload whose current SHA-256 matches its stored hash;
- a committed native replacement from the six-byte preimage to `published-by-public-driver`, with the expected target identity and SHA-256;
- no second response was fabricated or persisted.

Read-only ledger inspection of the retained database additionally proves startup ownership recovery ran far enough to persist:

- one original attempt in `blocked` with `cleanup_verified=0`;
- the same single publication intent and zero results;
- one `held` recovery case at revision 0, `final_seal=NULL`, reason `interrupted-native-journal`;
- one transition from no prior state to `held` for that case;
- one `blocked_no_auto_resume` recovery attempt;
- one workspace write lease;
- zero orchestration receipts and zero final acceptances;
- one `git_status` artifact containing `AM target.txt\n`.

Both the intent payload and held-recovery payload hashes validated against their retained bytes. The retained target currently contains `published-by-public-driver` and matches SHA-256 `8b27c0...62a35`.

## What actual 2 does not prove

The second child emitted no persisted restart response before stdout EOF. Therefore the run does not prove the expected public `driver.start('workflow')` refusal, snapshot contents, zero relaunch/authorization/resend counters inside that child, replacement-attempt count, or the complete asserted restart frame. Durable database facts support the recovery side but cannot replace those missing public-path observations.

The log also does not retain the second child's stderr. The immediate reason it exited before emitting the frame is therefore not established by these artifacts. Maker diagnosis must remain a hypothesis until grounded in source or new offline evidence.

## Process and cleanup state

Cleanup records PID 24752 exact-closed with no error. A current read-only process lookup also found PID 24752 absent.

Cleanup records the second child as PID 104496 with creation time `2026-09-15T22:07:28.4704780+09:00`, `closed:false`, and `public_driver_restart_identity_changed`. A current read-only lookup found PID 104496 absent, but this later absence does not retroactively prove exact closure of the recorded creation identity. The cleanup result correctly failed closed and retained the root.

The exact root `D:\\Temp\\User\\cue-public-driver-restart-k3JYSB` still exists with `ledger.db`, `worktree`, and `local-app-data`. It must remain untouched for further evidence inspection. Cleanup is verified for the first child only; exact second-child cleanup and root deletion are unresolved.

## Disposition

A04 remains open. Preserve every actual-2 artifact and the retained root. Any correction and later actual attempt require a newly pinned fixture/test preflight; they must not reuse, reopen ownership on, signal processes for, or delete this retained evidence root during diagnosis.
