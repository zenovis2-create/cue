# Explicit model-producer role — independent review

2026-09-11. Reviewer contracts_review, makers reuse_pure/reuse_transport/admission_impl. Verdict: PASS for the bounded role integration; no blocking finding. Product source was read-only to reviewer.

Completion contract: inspect current role/authority/history/UI paths; build exit 0 and focused integration gates pass; record inspected hashes. Correction cap 2; no correction requested. Evidence writing is one pass, followed by hash/readback.

## Independently executed gates

Working directory daemon:

- npm run build — exit 0.
- npx --no-install vitest run test/integration-plan.test.ts test/integration-orchestration.test.ts test/integration-engine.test.ts test/integration-stage-envelope.test.ts test/integration-acceptance.test.ts test/integration-acceptance-history.test.ts test/integration-observation.test.ts test/integration-approval-plan.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1 — exit 0, 8 files / 86 tests passed; start 17:51:41, duration 9.38 s. Tool session 52580, final output chunk f52d07.

## Findings verified

- Explicit role adds no new serialized plan fields. Existing canonical digest regression remains a9565c9dca9ae89213a5635640151e507b8c4355357e449ecbc5973ba0c59acc. Legacy historical acceptance/reopen tests passed.
- isPlanMaker includes implementation and model-producer for requirement coverage, all-maker ancestor dependencies, and structural owner separation. A planner alone cannot satisfy production coverage.
- Engine retains literal implementation -> implementation admission mapping; model-producer receives model admission. A real runtime fixture with M-only evidence launches the new role, while legacy implementation with only M evidence launches nothing. Fixtures are not live eligibility evidence.
- Store acquires/releases writer authority only for implementation. Model producer leaves an existing other-owner lease unchanged and does not set write_in_progress.
- Stage binding still denies file_change inherited from parent for model producer; empty-action binding succeeds with actual immutable child run lineage. Existing readonly, scope, expiry and replay restrictions remain.
- Acceptance includes every historical model producer and native implementation principal, including failed clean retries. Unknown past identity, current or former maker collisions and mixed-maker collisions block; finalization rechecks the independent identity. This is host identity plumbing, not proof that arbitrary supplied principal strings identify separate actors.
- DTO and both renderer role labels display model output production. Scope, candidate, requirement and unverified acceptance semantics remain visible; role labels grant no authority.

## Explicit limits

No generated-output artifact kind, real default host, new migration, model write capability, live provider qualification or full-goal completion was introduced or reviewed. The prior host discovery's artifact/default-host gaps remain separate. Acceptance's fixtures use existing artifact kinds; they do not establish production handling of a generated model answer.

## Current source/test hashes
- daemon/src/orchestration/plan.ts : 04D8877DA6C85DABFB7574EE968EA0E54D6FA7D081C47938D3216DD9D7FE4113
- daemon/src/orchestration/store.ts : 218FFCEA4EB291E5928B3C38FF9A79BFF30966EAF7280DD326A3163AEB373547
- daemon/src/orchestration/engine.ts : EC0F2EF65D33DDDD6362AECA43010FDD5A73A73B7646E31EC8D731F15C936FEE
- daemon/src/orchestration/stage-envelope.ts : 575E3BC95F39BBDBA37898657A9981B86A1B5540355B435D004EA826E4CDB3DE
- daemon/src/verification/acceptance.ts : 2C11CA985F678BDED483C4BE04B5B1A27C9A72724F5B03D064FCB0DB6000EEB5
- daemon/src/ui/orchestration.ts : 6C2DBD50012480C408D5DA031261A73E31AA2D625AE28F1BA961F194843D7F3E
- app/renderer/renderer.js : 073FDED59D325C273B2B2102CA4827F14B0FE2F921FE3852E15D0B8D814C1F92
- daemon/test/integration-plan.test.ts : 90CB9429597CE1918EC31644F7E23F2A52E8DC724BDA66196F4C63A3C044971A
- daemon/test/integration-orchestration.test.ts : 886D83BDC35EA1CD4D9AE3A25721B1FDB8EDDB524B49161E7BD623DD2A205BB3
- daemon/test/integration-engine.test.ts : A1D12387DC5ABB17DC90FFF3E1F4BB95B4383B1DD1B428376AA9446C87BF4D5F
- daemon/test/integration-stage-envelope.test.ts : 330A6AFC2C7A57356D7174DC309EF7E8B189CD0BBD925341642629ED0025085B
- daemon/test/integration-acceptance.test.ts : EAD8467B672CBAF54DD97CEDCA2F53B9FD4FED515EE555A79D63443728A3C49F
- daemon/test/integration-acceptance-history.test.ts : 4C708EC1A10D52EB99F7BC654B7138CFD3A48CF92895FDADF9975F878C614EFB
- daemon/test/integration-observation.test.ts : BE33ACF9E77642CA4DC6109B1F60A74760FBD206C41DA4CACCD0814E2906F20C
- daemon/test/integration-approval-plan.test.ts : F1CB567AF38E191C9BEDDB0FF0BBD6DB8280433A21D045144F6EF37E0190374A
