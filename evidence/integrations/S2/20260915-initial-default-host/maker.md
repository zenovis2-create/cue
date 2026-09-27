# Initial-default trusted-host maker result

Implemented the optional monetary-host `prepare.initialDefault` boundary without changing daemon store or engine contracts. The host supplies only candidate, conservative estimate, source, and binding time. The driver derives the exact run and selected-policy identity, uses `bindInitialDefault` for canonical validation/digesting inside the existing immediate transaction after policy and budget initialization, and checks the persisted binding on every prepared-entry access. Existing stored defaults reject omitted or changed configuration; local hosts reject the field before persistent writes.

The frozen approval summary contains candidate, canonical digest, conservative cost/time, and currency. Core appends a plain Korean candidate and conservative-bound disclosure to the existing approval lines; the internal digest is deliberately absent from visible copy. No new UI setting or IPC mutation was added.

Meaningful fixture coverage proves actual no-statistics selection and its persisted attempt marker through the driver; legacy absence; post-prepare mutation isolation; extra foreign lineage/accessor rejection; later-step rollback; exact reopen plus changed/omitted refusal; local pre-write refusal; and frozen Core disclosure.

Revision 1 build command used a bad relative redirection path and did not run; the command failure is retained. The corrected build passed. The first six-suite run reached 92/94: one fixture installed `observeInitialSelection` after engine construction, and another replayed a sealed change-target registration during reopen. Both product hypotheses were unchanged. Revision 2 moved the observation behind the existing fixture truth seam and omitted unrelated change targets from the reopen fixture. The focused driver suite then passed, followed by the final required gate.

- Final build: exit 0 (`logs/final-build.log`).
- Final serial gate: 6 files, 94 tests passed, exit 0 (`logs/final-vitest.log`).
- Pass 3 copy correction: removed the internal digest from visible approval text while retaining it in the frozen summary/storage. Current build passed and the focused Core suite passed 5/5 (`logs/pass3-build.log`, `logs/pass3-core-vitest.log`). The 94/94 combined gate is retained as pre-copy-correction history; only Core source and its focused assertion changed afterward.
- No provider/model/native/Electron/live calls were made.
- Full original bytes are retained under `preimages/`; all failed outputs are retained under `logs/`.

Final source SHA-256:

- `app/orchestration-driver.mjs`: `e1640ca4009d489ac3c19c4d72553015a246da7268d7d28dc5e4518b7ec1819d`
- `app/orchestration-driver.d.mts`: `432818c6ad4588e49a1e4847225d1a550ce55f3a6710c6afc56ee8d611bc0da6`
- `app/core.mjs`: `cd00ba74e58efe44adb8687b6b8e0e48eda9be7a8566de4aae3cedcadbcce70c`
- `daemon/test/integration-driver.test.ts`: `a3f8013dac3700e85c0370b1dbee5e3b2aa14dad5cb79e500ee0c5a2c59efceb`
- `daemon/test/integration-selection-preference-core.test.ts`: `eef83f9a2a45dd76b7323bca81d3eac46e869fdadb65ad4973c0732879efd9d0`
- `daemon/test/integration-local-driver.test.ts`: `8ab58652af7da80abdf8bb11c488ed78fcfb8075069a03026b1e4a2423e5a673`

This is maker evidence only. Independent review determines qualification.
