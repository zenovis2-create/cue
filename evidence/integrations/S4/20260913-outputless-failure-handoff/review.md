# Independent review: outputless failed handoff

## Contract

Review completion means the focused maker gate and a separate reviewer hostile gate pass; source hashes match the maker's saved preimages and final pins; persisted outputless failure reopens with failed/clean terminal integrity and a cleanup-evidence handoff; and no checker launch or acceptance is observed. Review cap: two test passes. A failure requires a new concrete hypothesis before the second pass; a second failure stops the review.

The first reviewer invocation discovered that Vitest ignored a test outside its configured root. It passed the maker's 22 tests but supplied no new hostile evidence, so it is not counted as a hostile gate. The new hypothesis moved the reviewer-owned test to `daemon/test/integration-outputless-handoff-review.test.ts`, the path explicitly authorized by root, and added full terminal-integrity reopen coverage.

## Verdict: PASS

The final focused command passed 25/25 tests in three files:

`npm exec vitest run -- test/integration-generated-json-host.test.ts test/integration-recovery-handoff.test.ts test/integration-outputless-handoff-review.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1`

The generated-host fixture proves an outputless failed producer persists `state='failed'`, `cleanup_verified=1`, a cleanup-evidence handoff, no generated-output observation, no dependent checker launch, and unverified acceptance. It also resolves the artifact after SQLite reopen. The independent real-SQLite fixture proves the complete handoff reader returns `verified` after reopen and retains failed/clean state. Separate executable cases reject unknown cleanup, foreign candidate, foreign subject, foreign session, mutated cleanup bytes, and a succeeded receipt inserted while the attempt is still `running`.

Source review confirms the fallback is producer-only, requires an exact host-issued failed/clean receipt and null result text, and rejects any output activity. The cleanup bytes are used as immutable artifact provenance only. Resolution binds their hash and canonical bytes to the exact attempt, candidate, model role, subject, launch intent, identity, six-field session, failed terminal activity, receipt, and handoff manifest. A cleanup-store read does not establish current OS cleanup truth, freshness, provider termination, billing finality, model quality, retry authority, or acceptance.

Maker final pins independently matched:

- `app/generated-json-host.mjs`: `223B8A990D9915775DCDE85CCDC88AC1F0344BF82D15796CB53C76D01FD6E6E2`
- `app/generated-json-handoff-authority.mjs`: `277173919D0FD459825BD7144265B63B43ADC07C8A27A6C0AA51EC43E415DBCE`
- unchanged declaration: `935F9CABA9EA903BE5F7B75152B8DDDE4CD74F22D10E8EC2743614401525E6AF`
- generated-host test: `0745E9E0E10EA50D829A3764D31E1082562C7E1680E99B793010D7F61165FBB9`
- unchanged recovery-handoff test: `EE946B490C36470B10345C0A1DD12E5C45B24B7D6902BE6C44EF2B5A4D2820EF`
- reviewer test: `7FB52DAC11AC30311F6138C726E73095C0884BF5318CDED204803F964D69999D`

The pre-edit hashes in `PLAN.md` differ only for the two implementation sources and generated-host test identified by the maker; declaration and recovery-handoff test remained identical. Full preimage byte copies were not captured because these files were already untracked, so only the recorded pre-edit hashes support that comparison. `git diff --check` passed for the scoped files. The maker's build passed before this independent test-only addition; per task boundary the reviewer did not rebuild. No native child, model, network, live workflow, UI, provider, or billing test ran.
