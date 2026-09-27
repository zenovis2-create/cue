# Provider lifecycle correction 2 contract

Final correction pass: 2 of 2.

## Done

- Before any public append, the same immediate transaction revalidates every predecessor event for the exact attempt using canonical payload bytes, recomputed SHA-256, typed relational columns, contiguous ordinals, lineage/candidate identity, terminal uniqueness, seal order, and provider receipt binding.
- Before public client acknowledgement, billing finality, lifecycle seal, or provider reference binding, a forged or corrupted predecessor causes `provider_lifecycle_payload_integrity` (or the narrower sequence-integrity error), writes zero new rows, and leaves orchestration attempt, cleanup, budget, and acceptance state unchanged.
- Database inserts recompute canonical payload SHA-256 through the trusted ledger connection function, so a canonical-looking row with a fake caller-supplied hash cannot become a relational predecessor. Public revalidation remains mandatory and catches tampering performed with immutable triggers deliberately disabled, including after close/reopen.
- Valid chains, exact replay, two-connection serialization, fresh/pre-032 migration replay, integrity/FK checks, and source/dist migration parity remain green.

## Attempt cap

This is correction pass 2 of 2. No third implementation hypothesis is permitted.

## Every pass

1. Run the reviewer counterexamples for forged terminal to billing, forged cancel to acknowledgement, forged parent to binding/seal, and reopened predecessor tamper.
2. Run provider lifecycle + P5 + handoff regression, TypeScript, and build.
3. Run fresh/pre-032 file-backed close/reopen integrity/FK, broader orchestration plus isolated concurrent-claim, source/dist parity, hashes, and owned diff/whitespace checks.

## Failure rule

If this final hypothesis fails, preserve the raw failure as `FINAL BLOCKED`; do not retry or invoke a provider, model, CLI, native launcher, Electron, or network path.
