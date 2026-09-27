Done gate: npx vitest run test/integration-model-qualification.test.ts --reporter=verbose (daemon cwd), exit 0.
Companion gate after root build: npx vitest run test/integration-fixed-model-qualification.test.ts --reporter=verbose, exit 0.
Attempt cap: two edit/test passes per defect.
Every pass: targeted qualification gate; inspect pass/fail/unknown goal verdicts, native recipe, cleanup, and capability kind.
Failure: revise hypothesis once; then report blocker and retained evidence.
Exact byte preimages captured before edits:
daemon/src/model-qualification.ts SHA256 2E18A6DDA807FC36E53A707D3B31FC1C164A87A08DB3D49D931973F3F2E0065B
daemon/test/integration-model-qualification.test.ts SHA256 92CD6CB37275A50F9387183DF353FB32129052BE89985E5D6CFBB3BB8FD27528
Addendum: root authorized narrow native identity-store kind extension after direct launcher proved checker protocol works and collector failed before first frame at identity commit.
Done gate: npx vitest run test/integration-native-execution-identity-store.test.ts test/integration-model-qualification.test.ts --reporter=verbose (daemon cwd), exit 0.
Attempt cap remains two hypothesis passes per defect.
Exact byte preimages before identity-store edits:
daemon/src/native-execution-identity-store.ts SHA256 609BCBBE77FCFC33494800FFF372209D340172507110438744CB50A2E98500A5
daemon/test/integration-native-execution-identity-store.test.ts SHA256 1C4A750A2AA2A961740C144C2F7F3A8020AE8E8D82596FC6D6E581AAA90695C6
Second proven boundary defect: goal adapter sorts verdict keys but compares to an unsorted literal; valid native checker_result is rejected.
One-line predicate correction under root-authorized narrow adapter scope.
Exact preimage before edit: 
daemon/src/adapters/isolated-goal-proposal-checker.ts
 SHA256 
BF881ABCD0BE09F6924DBB7993543587EA5146ACF45FEDE6F00A5F479A25AFBE
