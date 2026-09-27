# Reviewer temporary-directory cleanup limitation

Two failed migration-smoke harnesses created these reviewer-owned directories:

- `D:\Temp\User\cue-044-review-FQ660M`
- `D:\Temp\User\cue-044-review2-e74zQy`

A separate read-only enumeration established both exact paths, their `Directory` attribute without `ReparsePoint`, and matching 2026-09-15 12:44 creation activity. Recursive `Remove-Item -LiteralPath` was then rejected by the automatic command policy with the only supplied reason: `rejected: blocked by policy`. A second deletion attempt using the two literal paths was rejected the same way. No bypass or broader temporary-directory deletion was attempted, and no unrelated path was touched. The user must remove these two directories through an allowed mechanism.
