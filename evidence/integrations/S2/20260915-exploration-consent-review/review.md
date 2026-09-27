# Exploration consent independent review

Verdict: **PASS for the bounded offline exploration-consent implementation.** This does not qualify a provider, live Electron flow, price/quota truth, local model, or the broad S2/release parents.

## Independent gates

- Current post-correction combined gate: 10 files, 151/151 tests, exit 0. It covered driver, local exclusion, exploration budget/engine, initial-default conflict, Core transaction, strict IPC/preload/DOM, and acceptance regression.
- Current daemon build: `npm --prefix daemon run build`, exit 0.
- Compiled migration smoke, run after that build: fresh database `{table:1,triggers:4}`, file reopen `{table:1,triggers:4}`, deliberately interrupted schema rejected with `exploration_consent_migration_partial`, source/compiled migration SHA-256 both `7c47ed3bc2144e9c50846941ad3ba81392c3ff07aa692c02a16d7c8cf544d68b`, exit 0. The smoke used an owned temporary directory and removed it.
- The earlier current-candidate run before the consent-loss correction passed 150 tests, but is superseded history. Source inspection then found that an activated entry could tolerate a missing consent row. The retained maker correction first reproduced a launch despite lost consent, then changed `assertPersisted` to reject the missing row; its root gate passed 2 files/95 tests. The final independent 151-test gate includes `refuses start when explicit consent disappears after activation` and observes no launch/reservation.

## Contract findings

- Host preparation alone creates no execution authority. Activation requires ordinary approval and the exact immutable consent; missing consent prevents start, including after activation-state corruption/reopen checks.
- The renderer starts unchecked, renders bounded Korean scope text, clears consent on new/stale/error/ordinary/Stop transitions, and sends `allowExploration:true` only after the explicit checkbox. IPC accepts only exact own-data plain inputs and does not invoke Core for getter/proxy/false/extra-field inputs.
- Core validates that exploration is configured, calls `approveExploration` inside the same SQLite transaction as `approval_event` and autonomy, and rolls both back when the ordinary approval insert fails.
- Migration 042 and the driver bind consent to run, envelope, plan, policy, authorization/grant digest, candidate, and sorted approved task membership. Rows are immutable; replay accepts only the same digest.
- Local exploration and exploration combined with initial-default configuration reject before authorization rows. Serial and parallel request construction flags only listed task IDs. Current positive tests cover serial membership, parallel read-wave membership and reopen, same-candidate retry propagation, single exploration reservation, and no replay recharge. Recovery switch/replan inputs remain rejected for exploration.
- Missing consent or a host grant without UI consent causes no launch. Budget reservation happens only when the exact exploration flag reaches the engine; ordinary verifier tasks remain unflagged.

## Evidence integrity and limits

The driver maker explicitly records that true full-byte preimages were not captured before its first edit. Candidate copies are not treated as preimages and the historical `fb070...` static generation is only a source hash snapshot. This is a workflow limitation, not reconstructed baseline evidence. The later UI, dispatch-coverage, A05, and consent-loss correction units have their own plans/preimages/pins. The current bounded result rests on independent source inspection, the post-correction hashes below, retained failing consent-loss reproduction, the 151-test gate, build, and compiled migration smoke.

Key current SHA-256 values:

- `app/orchestration-driver.mjs`: `8a92d9592f1da09c7b701944c682c89ed7eb5a0e28bf26f72e3f9add47b2a479`
- `app/core.mjs`: `c71d66f7c979487445abab4088da138864011f259488f5097660cb397fe7c70f`
- `app/ipc.mjs`: `377ad1b04d74e5bc08c184969303ca34c61ca20f557f9414d30e5ef6d83823a4`
- `app/renderer/renderer.js`: `1d730a8107f73dc2d4c0382d1a08ba942e8dd800b399d7489d7412ff4a530288`
- `daemon/src/ledger.ts`: `40d394413320416cdb8ff706077b3edf1f19fef1698f44a9c387b335589d53fc`
- `daemon/test/integration-driver.test.ts`: `ecb3492ead988a7bf1f9b15097f90e2ec67b5533fe3d57425cae081241c5ed7a`

No model, provider, native helper, network, Electron actual, local-model server, restart, or download was used.

## A05 independent assessment

The exact release parent “부분 결과를 완성했다고 보고하는 모델 fixture를 완료로 인정하지 않는다.” is supported for completion marking. `integration-acceptance.test.ts` first proves a complete independent-evidence control can pass, then inserts an explicit model-completed claim and separately tests a partial target manifest and model-report bytes. Both produce `unknown`, finalize as `blocked`, create no accepted receipt, leave the existing root task non-completed, and retain the ordinary 50-unit commitment. The connected real-driver fixture separately keeps model self-report blocked with `acceptance_unverified` and no final acceptance row. The final independent gate passed both files in the same current-source run. This is the exact adversarial fixture requested by A05; it does not close broader S4 qualification or any live workflow parent.

## Parent closure assessment

The exact S2 parent “cold-start 기본값과 별도 허용된 탐색 예산을 구현한다” is also supported for completion marking. Spec §2 requires a verified conservative default when statistics are absent and permits paid exploration only through a separately authorized exploration budget. The reviewed default store/engine/host chain and exploration store/engine/Core/IPC/UI/driver chain now implement those two behaviors, including explicit consent and exact budget membership. Actual price/statistics provenance remains under the separate S2 cost/uncertainty parents, and provider qualification remains elsewhere. User-editable host settings are not a normative condition in the original clause; the spec says a monetary host may supply them. The stale checklist parenthetical should be updated to describe the reviewed connection and retain those separate limitations.

The A07 milestone-display parent should remain open. Spec §7 and the documents distinguish S0–S4, S5, and S6–S7 conceptually, but this review found no current release-status artifact or acceptance scenario that presents those three states independently. Section headings alone are insufficient evidence for a release acceptance scenario.
