# Independent generation idempotency review

Status: **PASS for the bounded implementation and offline gate.** The repository generator was not run.

## Source audit

- An existing generation is reusable only when it is a real directory with exactly the five expected artifacts plus `generation.json`, the manifest binds the current snapshot digest, and every existing byte sequence matches the newly staged manifest and artifacts.
- A missing generation follows the new-generation path. Extra, missing, malformed, tampered, or stale-basis content fails before pointer publication and is not overwritten.
- Reuse removes only the newly owned `.staging-<UUID>` directory: the helper verifies its direct parent and name, unlinks the six fixed entries, and calls non-recursive `rmdirSync` on the empty directory. The focused test executes successful removal and rejects an outside path.
- Pointer publication remains after source/basis revalidation and generation-manifest validation. Its existing rollback logic restores the prior pointer only while the failed write still owns the pointer, so it does not replace a competing commit.
- Successful output now includes `reused`, allowing an actual verification to distinguish reuse from a new capture.

## Independent gate

From `C:\Users\User\cue\daemon`:

`npm exec vitest run -- test/current-source-report.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Result: exit 0; 1 file passed; 5 tests passed; 0 failed. The cases cover exact stage cleanup/path confinement, byte-identical reuse, corrupted and stale provenance rejection, entry and manifest mismatch rejection, pointer rollback/competition, and scoped source-basis equality.

Frozen SHA-256:

- `scripts/reuse/cue-current-source-report.mjs`: `7F9C8A75DF1AD4194FCE0869A914EA4D3B9DC6F7B4309C29C5AAAE6215688455`
- `daemon/test/current-source-report.test.ts`: `0CED200C15A8763E7268B7078427CC16F797C9BF563B886EE855D90ED9ADD062`

## Conditions for the root's actual run

Keep the reviewed source frozen. Before the single run, hash the current pointer, all six files in the active generation, and the preserved failed staging directory. Accept the result only when stdout parses as `ready:true` and `reused:true`, the pointer and active-generation hashes remain unchanged, and the preserved staging directory remains byte-for-byte unchanged. A source-basis change, `reused:false`, any changed hash, or any missing preserved artifact is a stop condition.

This review does not claim that an actual repository capture ran or that historical staging was cleaned.
