# Core host factory and generated parent approval — independent review

2026-09-11. Reviewer contracts_review; maker root. PASS, no blocking finding or product edits. No Qwen calls.

Done: inspect same-ledger factory and failure ownership, generated approval versus actual envelope, legacy path; build/focused tests exit0; record current hashes. Correction cap2, reviewer requested0. Evidence write once then read/hash verification.

Independent cwd daemon:

- npm run build — exit0 (f96d93).
- npx --no-install vitest run test/integration-driver-core.test.ts test/integration-approval-plan.test.ts test/p10c-core.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
- Exit0, 3files/29tests PASS. 20:02:34, 56.03s. Session36092 finalchunkf65a1c. Includes constructor failure regression added after prior maker28PASS.

Factory is invoked once with actual daemon.db, config and canonical worktree. Direct host plus factory, unavailable factory result and unsupported template reject. Construction failure does not fall back to Codex. Newly owned AppDaemon closes via its empty-worker synchronous path; supplied daemon remains open. Existing ownership/reopen and lifecycle barriers pass.

Only explicit host parentTemplate generated-json-v1 changes approval. Parent retains command and goal scope, omits file_change and includes exactly http://127.0.0.1:8085/v1. The actual egress JSON is persisted and included in envelope hash/approval. Generated copy describes transformation/checking, no file change and no outside destination; renderer displays actual egress using textContent. Legacy has original command/file_change and empty egress. An unmeasured candidate remains denied after approval without legacy launcher fallback; unresolved cleanup retains ledger/budget.

This is trusted main-process composition. Host must still narrow child actions, provide real qualified candidates and bind actual template input/checker contracts. No claim that parent command permission itself implements a sandbox. Factory callbacks are trusted constructors and must not independently launch unregistered work during construction.

Default app/main host is not enabled by this unit. No real model/checker workflow, M evidence issuance or final goal acceptance is established. Tests are real SQLite/core and renderer fixtures plus existing lifecycle regressions.

Current SHA256:
- app/core.mjs : 4A6B2D91D0CCABD5E3A4687C379C7827A8B4F98755CDC987789DA3A3AAD28D83
- app/core.d.mts : 7CFEDCF86389E64326EFF9FE3887CB519F181DB0B0BBBB0EA9B3473FB8186832
- app/orchestration-driver.d.mts : 1DB4C9E08A75A58B3658F225B5BCB3B092E44648EAFB6E004FD81BA385D4E392
- app/renderer/renderer.js : 4832EAEC50E04294A447E801FED93422D747C0E67B140C9CF61BCF981F509165
- daemon/test/integration-driver-core.test.ts : 2836889BD66F738891B3CF1E8B0270CB98593317F57E2A83482180D385E89C36
- daemon/test/integration-approval-plan.test.ts : 38C3144B9587916BA7CAE57B3882383F48EAB09C8839E5F68CD7BFE466FE303D
- daemon/test/p10c-core.test.ts : B452425820A9EE3E408B2556529ABB820700799F703410A2EB419D2F7B8B7D46
