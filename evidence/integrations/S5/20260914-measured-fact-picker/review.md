# Independent S5 measured-fact picker review

Outcome: **PASS**. No blocking finding remains in the bounded component.

## Checker contract

- Done: the eight final pins match; the eight original preimages and both eight-file correction snapshots are preserved; the exact three-suite gate passes; syntax and scoped whitespace checks pass; static review confirms the bounded Core, IPC, safe DTO, manual picker, and stale/error/approval fences.
- Attempt cap: two independent passes. Pass 1 exposed two untested UI races after 33/33 passed. Pass 2 followed the distinct UI-correction hypothesis and is final.
- Every pass: inspect product/tests/evidence, run the exact three focused suites, verify final pins and captured preimages, then run syntax and scoped whitespace checks. Maker/root builds are not duplicated.
- Failure: preserve the concrete blocker and return it to root; no further checker retry.

## Evidence

- Final independent gate from `daemon`: `npx vitest run test/integration-evaluation-measured-fact-evidence-core.test.ts test/integration-evaluation-measured-evidence-ui.test.ts test/integration-evaluation-ui.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — exit 0, **3 files / 35 tests passed**. See `logs/reviewer-pass2.log`; root's full verbose corrected log is `ui-correction-vitest.log`.
- JavaScript syntax: `node --check` for Core, IPC, and renderer — all exit 0.
- Scoped `git diff --check` over all eight pinned paths — exit 0, with only existing line-ending notices.
- Pin/preimage verification: **8/8 final pins match**, **8/8 original preimages match**; the eight-file maker handoff and eight-file pre-UI-correction maps are present.
- Root-owned builds after the IPC and UI corrections exited 0 as recorded in `ROOT-CORRECTION.md` and `UI-CORRECTION.md`; intentionally not duplicated.

## Contract review

- Core accepts only exact plain `{limit,cursor}` input, validates limit 1..20 and null/positive-safe-integer cursor before access, rejects disabled host, closed DB, outer transaction, and nonexistent cursor, and uses a closed-over store/workspace so a forged receiver adds no authority.
- Each call selects at most 64 descending SQLite rowids and returns at most 20 valid records. Every candidate goes through the protected evidence projection and current-workspace check. Foreign and corrupt rows are swallowed without content or error disclosure. The page remains incomplete with a rowid continuation when 64 invalid rows yield an empty page, and a later page reaches the older valid row.
- The returned DTO is limited to fact ID, producer class/revision/recorded time, and fixed false readiness/promotion constraints. Tests assert that measurement, evidence, reason, total, and stored secret fields do not appear, and list reads cause no capture or database write.
- IPC admits list/read before prepare, independently rejects malformed shapes, hostile descriptors/proxies/prototypes, and numeric bounds before Core is called, and strictly reprojects Core results. Selection invokes the existing detail endpoint, which revalidates fact identity and evidence.
- Renderer access is manual: refresh, next, and selection do not capture, execute, approve, dispatch, create trials, or promote. Directly typed IDs survive list failure. New run, approval, generic evaluation failure, list error, and superseded detail requests invalidate stale list/detail responses and keep controls locked while approval owns the run.
- Static review found two real races after the first passing gate: selecting B while detail A was pending could leave input B with response A, and a failed list refresh could be followed by late detail repopulation. Root preserved the pre-correction sources, changed generation fencing, added deterministic deferred-promise reproductions, and the final independent gate passed 35/35.

## Limits

This proves the bounded saved measured-fact discovery and manual detail-selection component with synthetic SQLite/Core→IPC and JSDOM coverage. Terminal authority, lineage, and measured records are synthetic fixtures. It does not prove live Electron visuals, production measurement accuracy or eligibility, provider/model/native execution, trial creation, policy promotion, or broad S5 completion. No model/server/network/native helper, commit, or push was used.
