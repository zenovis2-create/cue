# Native authority composer bounded result

## Status

IN PROGRESS / NOT QUALIFIED as a complete native existing-file execution authority. No broad 11-item closure. The opt-in constructor is present, but a successful issued native runtime result through handoff, final publication and built-in acceptance has not run. No provider/model/service network call was made in this test. The local provider budget remains exhausted and Qwen remains off.

The fixed constructor reads a pinned installation and selected profile, creates a ledger-backed preflight owner, uses the branded service-capacity reader, remeasures subject and capability evidence, creates clean per-attempt Codex homes, composes the native implementation host, uses its built-in expected-artifact checker, and binds fixed SQL-backed claim/stage/receipt/publication callbacks. Missing provider-final billing produces unknown non-final accounting. Adapter failure or cancellation cannot be promoted by a native succeeded receipt. The read-only Codex verifier path uses migration 050; older boundary notes describing migration 039 for this acceptance path are stale.

## Focused gate

`npx vitest run test/integration-native-existing-file-authorities.test.ts --reporter=verbose --no-file-parallelism`: **3/3 pass**, exit 0. Raw output: [focused-gate.log](focused-gate.log).

The real Core/driver test uses a committed Git fixture and default deployment staging host. Synthetic issuer/subject/probe modules supply no external authority claim. Core prepares and approves the two-task plan, writes the exact change target contract, and `core.execute` persists one exact `codex-native-implementation` attempt and an `attempt_staging_setup` row with the selected subject digest. It writes zero `native_runtime_receipt` rows and zero publication intents. A deliberately nonexistent provider binary leads `core.close()` to reject `orchestration_cleanup_unverified`; this is the expected conservative boundary, not a successful provider execution or cleanup proof. The fixture uses high-boundary synthetic service/subject/probe observations, so it validates Core/staging plumbing and denial only, not authentic service admission. Temporary fixture roots with unresolved native cleanup are retained when Windows refuses safe removal.

The initial fake staging fixture rolled back before a durable attempt and exposed an invalid test hypothesis. Replacing it with real Git staging advanced to the persisted attempt. The first real-Git assertion waited only one second for a blocked state and failed while the attempt was still running; the final gate waits for the durable attempt and asserts unresolved cleanup on close. Earlier failure output was displayed in the session but not saved as a full raw artifact. The final pass log is saved.

## Source pins and limits

All three owned source/test paths were absent before edits; [PLAN.md](PLAN.md) records this. Current SHA-256:

- `app/native-existing-file-authorities.mjs`: `4ebe1f150b5de37e75f5f7f9763d26e313f1449bf82ef3413534d4ffae66ef59`
- `app/native-existing-file-authorities.d.mts`: `9e6e7c600d275b0e5c0c3c7ddb5c1939c5dc8c33219f16c047d474adfbbb937b`
- `daemon/test/integration-native-existing-file-authorities.test.ts`: `43a25aeafb0ab735a3f061e49de693e689813cc59bda5d236ff58ce9c25f2831`

The coordinated build reported exit 0 before the final runtime-outcome fix; root owns a fresh build and combined gate. The successful native result path, branded receipt persistence, verified process cleanup, handoff artifact, unknown billing settlement, exact publication and acceptance remain untested as one sequence. A next bounded fixture needs to mock the lowest owned Codex process/RPC boundary while preserving the real runtime issuer, then assert all those rows and published bytes. Until then this constructor must not be described as launch qualified.

If a later runtime snapshot changes a cached issued outcome, the composer now refuses the replay. A failed/cancelled adapter snapshot with a native succeeded receipt is blocked; failure classification and recovery for that mismatch have not been verified.
