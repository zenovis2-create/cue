# Evaluation projection UI bridge plan

## Done

- Core accepts only an enrollment ID and observation ID, validates stored workspace lineage, derives a stable server-owned projection ID, and delegates to the immutable projection store.
- IPC keeps the prepared-run and current-enrollment gate, validates the complete stored projection, and returns a bounded descriptive DTO.
- The renderer persists only the currently displayed stored observation after an explicit `비교용 기록 저장` action and labels the result as derived, non-measured, and ineligible for policy promotion.
- Real SQLite Core and IPC tests cover replay, reopen, tamper, foreign workspace, hostile input, and absence of runtime, approval, and policy writes. DOM tests cover explicit action, sanitized rendering, stale response, and failure clearing.

## Execution bounds

- Attempt cap: 2 substantive implementation passes.
- Every pass: new projection Core test, evaluation UI test, existing evaluation trials test, daemon build, and syntax checks for changed JavaScript.
- No model, network, native host, or live Electron execution.

## Scope

- No schema, projection-store, comparison semantics, measurement, runtime, approval, or policy changes.
- Existing comparison read/list behavior remains unchanged.
