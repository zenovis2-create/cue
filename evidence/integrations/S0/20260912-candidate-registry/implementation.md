# S0 inactive candidate registry — implementation evidence

Date: 2026-09-12 (Asia/Seoul)

This record is implementation evidence for independent review. It does not issue a PASS verdict.

## Changed surface

- `docs/reuse-decisions/CANDIDATE_INVENTORY.md`: records `agy`, `grok build`, `openclaw`, `paseo`, established local `orca`, `herdr`, and `pi / PI-Desktop` as inactive `resolved-unqualified`; records `nlm mcp cli` and `hermesagent` as `inactive-unresolved` and not registered/activated.
- `docs/INTEGRATION_BACKLOG.md`: adds the matching S0 decision rows, explicit release conditions, and the reason no runtime registry row was added.
- `evidence/integrations/S0/20260912-candidate-registry/done-contract.md`: pre-edit completion and retry contract.

No source registry, adapter, install state, dependency, executable, credential, process, network endpoint, model/provider, or native helper was changed or invoked. `daemon/src/integration-catalog.ts` was left unchanged because it models host-measured installation/protocol/auth/subject state and cannot represent public-source-only identity provenance without changing its admission-adjacent contract.

## Identity and authority boundaries

- The seven resolved rows are inactive and explicitly deny implications of installed, authenticated, protocol-tested, qualified, enabled, admitted, or executable status.
- `nlm mcp cli` remains split between the Python and Go products; `hermesagent` remains split between Nous Hermes and the distinct `hermesagent` account product. Neither token is bound to a registry alias.
- Orca is registered only as the already-established local Orca product identity. `stablyai/orca` is comparison evidence, and the separate `xiws/orca` project is not attributed to the local runtime.
- Checklist lines 28, 30, 31, and 32 remain open. Identity research did not finish the installed Codex/Claude/local endpoint contract, resolve both ambiguous names, map model aliases, establish installed artifact hashes, or complete third-party asset/license conditions.

## Verification observations

Attempt 1:

- `npm --prefix daemon exec -- vitest run test/integration-catalog.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` — exit 0; 1 file and 9 tests passed.
- `npm --prefix daemon run build` — exit 0; TypeScript build and asset-copy step completed.
- Local documentation contract check — exit 0; link targets existed, checklist lines 28/30/31/32 were open, required candidate terms/statuses were present, and the scoped tracked diff check emitted no errors.
- `git diff --check` — exit 1 because concurrently modified `README.md` contains pre-existing Markdown hard-break trailing spaces at lines 51–56, 79–80, 117–124, and 132–135. No reported error referred to this task's files. The candidate documents are currently untracked in the shared worktree, so ordinary `git diff --check` does not inspect their content.

Attempt 2 after narrowing the candidate-list preamble so it cannot apply to existing Codex/Qwen rows:

- Focused catalog test — exit 0; 1 file and 9 tests passed.
- TypeScript/build — exit 0.
- The stricter documentation script exited 1 on its own pattern for `PI-Desktop`; the row label is `pi / PI-Desktop`, and a direct anchored row read confirms it ends in `inactive / resolved-unqualified`. This was a verifier-pattern false negative, not a missing or active candidate row.

The two-pass cap was reached. No third mutation or verifier pass was attempted. The unrelated whole-worktree whitespace failure and the second-pass checker-pattern limitation are left for the independent reviewer to assess; other agents' files were not edited.

Post-loop read-only diagnostics also found existing Markdown hard-break spaces on `docs/INTEGRATION_BACKLOG.md` lines 3–4. They predate and are outside the inserted S0 section; they were preserved. No trailing whitespace was found in the new candidate rows or evidence files.
