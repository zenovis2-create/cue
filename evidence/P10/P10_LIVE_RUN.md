# P10 live run

Overall verdict: **FAIL**.

## Goal A

- Input: `알파 릴리스 체크리스트를 작성한다`
- Run: `0a4279e9-b3c2-4e49-b209-81dccb5f9a59`
- Actual AppContainer PID: `103284`
- Expected artifact: `알파-릴리스-체크리스트를-작성한다-419c2431.txt`
- Artifact content: absent
- Observed result: `blocked/human_required`; Codex exited 1 before work because canonicalizing the isolated `CODEX_HOME` returned Windows error 5 (`Access denied`).

## Goal B

- Input: `베타 회고 요약을 작성한다`
- Actual PID: absent
- Artifact path/content: absent
- Reason: the sequential live fixture stopped after Goal A failed. This is not a P10-3 pass.

## Cancellation and violations

- Cancellation PID: not observed; test skipped after the live prerequisite failed.
- Outside-write block: not observed in the P10 run; test skipped after the live prerequisite failed.
- Forbidden-network block: not observed in the P10 run; test skipped after the live prerequisite failed. P3-16 remains detection-then-stop and remains PARTIAL.

## Regression

`npx vitest run --exclude test/p10.test.ts --reporter=verbose` completed with 174 passed and 5 skipped. The P10 run itself failed its live prerequisite and skipped 12 item tests; see `p10_test_output.log`.
