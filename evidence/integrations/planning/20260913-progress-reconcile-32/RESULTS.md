# Integration documentation reconciliation 32

Date: 2026-09-13

## Reviewed evidence

- [Driver change-exclusion review](../../S4/20260913-driver-change-exclusion/review.md), SHA-256 `C133E7EE31CE88DE57321D9F675129F6F09F4E4063E12AAE7B9CAF4AD329EED1`: two files and41 tests PASS. Real SQLite `moved` is blocked early with `change_observation_unknown`; real `modified` reaches only the downstream evidence block. The other unsafe statuses are source-inspected, and no successful retry is claimed.
- [Held-recovery admission review](../../S4/20260913-held-recovery-admission/review.md), SHA-256 `A15642BF3BFC02DD72ACD57818749546EB64AFF1D2027B72B3CDB71A40D813A7`: four distinct files and24 tests PASS for sealed disposition rechecks across decision, replay, replan, and replacement claim. The prior open-held replan reproduction is failed-behavior history, not a passing test count.
- Combined reviewed scope is six files and65 distinct tests. [Root build receipt](../../S7/20260913-recovery-source-refresh/build.json), SHA-256 `2DD2954379D4F75406047145B52380469CBE4F551897687F12B2EFD28B7159AA`, records daemon build exit0.
- [Current bounded JS/TS source review](../../S7/20260913-recovery-source-refresh/review.md), SHA-256 `A45926B03DB070E2CA46F11FBC8B6ADEE0965E171747A022916F39F3B1E93B77`: generation `5454b1feec206768a1ad3845310e224d9285499acb41a22364293820c68d3b3a`,165 current source hashes,374 edges, five artifacts, source-basis127 entries, and48 unchanged historical files PASS.

No live reconciliation, eligibility creation, successful retry, native/WFP/model/provider action, restore/CAS, or broad S4 completion follows. The previous one-shot WFP smoke remains failed and consumed. The full suite remains historical and the `usageLimited` GOAL remains unfinished.

## Documentation gate

- [Done contract](DONE-CONTRACT.md), SHA-256 `A94B7D7757D58ED0D56C323C390822B723993A8DB577BF92C8D714ABD8AE27E9`.
- Scoped whitespace diff: PASS.
- Four-document local Markdown references:373 checked,0 missing.
- `docs/INTEGRATION_SPEC.md`: `17374FD553649A3D83F1CFB7B5E425C6E7F71D649C5D1D197374DAA62291676F`
- `docs/INTEGRATION_CHECKLIST.md`: `2F48624007167E97CC7EE79EA9090F279475941E67863FBEE7D86E0A638350F2`
- `docs/INTEGRATION_PROGRESS.md`: `295797D8103090E59F02DB4582C3EA10B95FD69F3B62900C52D834979EF41593`
- `docs/integration/LOOP.md`: `54A88DCA4BE89FC850BC68932A9073493CFE5CD1948B12D89140572B6EC7BD46`
