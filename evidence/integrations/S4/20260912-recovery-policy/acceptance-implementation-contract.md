# S4 Unit 1 acceptance implementation contract

Date: 2026-09-12

This continuation inherits the Unit 1 initial implementation and its remaining cap of two correction passes; it does not reset the cap.

Done means the requirement binding freezes a valid type-specific evidence policy before approval, acceptance collection evaluates actual host evidence through that policy, and finalization revalidates the evidence against an explicit `{ revision, planDigest }` lineage. Revision-zero rows remain readable for legacy runs, while a revised active run never falls back to the original plan and history from another revision cannot complete the task.

Every pass runs the build, the seven focused Unit 1 Vitest files, TypeScript no-emit checking, the scoped diff check, a temporary-ledger integrity and foreign-key check, and source/deployed migration `036` SHA-256 comparison from `DONE-CONTRACT.md`.

On failure, the next correction must use a new hypothesis tied to the exact counterexample. A change is retained only when the failing hostile gate improves without regressing the previously green focused set. After two failed corrections, preserve the failing evidence and hand the exact counterexample back to the human.
