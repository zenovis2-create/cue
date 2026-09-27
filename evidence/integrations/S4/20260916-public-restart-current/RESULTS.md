# Results

The failure was fixture contract drift. The old crash child advertised staged publication while using the publication worktree for execution and an in-memory replacement map. The current driver correctly requires an authorized execution-staging factory before a writable launch.

The bounded correction uses the compiled Git staging host, starts from a clean committed publication root, writes the replacement in the isolated execution worktree, and reads that actual file for native final publication. No production source changed.

Evidence limitation: only SHA-256 values were captured before editing; exact pre-edit byte copies were not retained. The report does not claim that the hashes are byte-copy artifacts.

## Gates

- Focused opt-in integration: **PASS**, 8/8, exit 0. The actual restart scenario emitted one native committed write with intent count 1 and result count 0, then a different process observed held recovery without launch, authorize, reopen, reread, or resend.
- Cleanup receipt: **PASS**. Both identified children closed; the retained flag is false and the exact temporary root is absent.
- TypeScript no-emit: **unrelated shared-tree failure**, exit 1, confined to `src/host-codex-runtime.ts:217-218`. Neither owned test file contributes a diagnostic. See `tsc-noemit.log`.

## Current hashes

- Crash child: `efb730aa03bb84724bd02b97f9c707e10881cf16ac7ce0fc6ebf59a60c332ef0`
- Integration test: `6bab0d64307714b2919c85e6ebaf34af73e3b6ec2bcb7efba30aa2b914b413e0`
- Focused JSON: `0d31caf0bb2cbb0999900579300c5b40d5b8d0991efc3c2ba1da5dac66cf9c02`
- Observation receipt: `3544c616a1c33ce5555d9c120e0bc992763b2f399605b5bd02bcc2cd668256b7`
- Cleanup receipt: `80a54ce9594f49a36a0f4c29931ac65b94a9a8b53bd8f90423498ae1c75ed556`

The first child's exit code 1 is expected from verified forced termination at the deliberate crash window; its stderr is empty. The restart child exits 0.
