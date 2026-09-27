# Native Codex verifier results

## Result

The native implementation host now consumes a typed Codex verifier executor as a distinct candidate with its own exact account binding. The adapter fixes its runtime role to `model`, requires an empty action and egress envelope before launch, reuses the common Codex controller lifecycle, and optionally binds an issued provider installation descriptor to the exact verifier executable and current measurement subject. The legacy opaque candidate input remains compatible and is mutually exclusive with the executor input. Candidate independence does not require purchasing or configuring a second account; two distinct qualified candidates may bind to the same approved account reference.

The initial implementation passed its synthetic focused gate but independent review found that the real host runtime always launched workspace snapshot workers, which require `command`. That historical pass did not establish production viability. The correction adds an adapter-owned `read-only-result` runtime mode. It is accepted only with exact empty actions and egress, skips both write-oriented snapshots, leaves controller tool requests behind the existing worker guard, rejects any tool attempt as a verifier transport result, requires a nonempty terminal model response, and keeps `goalVerification.passed` false. Only the verifier adapter maps the explicit `read_only_result_received` transport state to execution completion; requirement acceptance remains separate.

## Gates

- Initial focused gate: 3 files, 12 passed, exit 0. This is retained as pre-review history and does not prove the corrected runtime boundary.
- Independent review: `NOT CLEAR` because the initial injected launcher bypassed the production snapshot worker failure. See `REVIEW.md`.
- Corrected coordinated build: exit 0, root record `evidence/integrations/planning/20260916-progress-reconcile-75/build-correction.raw.log`.
- Corrected TypeScript no-emit: exit 0.
- Corrected focused gate: 3 files, 15 passed, exit 0.
- Post-review account-binding compatibility gate: 2 files, 7 passed, exit 0. Durable Vitest JSON: `focused-results.json` (SHA-256 `d18380f92e3148e476b913c4bf8e94d54e2f25fd525dffdff978b29c55782365`). It proves distinct candidates may use the same exact approved account reference.
- Existing host/controller regression: 3 files, 28 passed, exit 0, root record `evidence/integrations/planning/20260916-progress-reconcile-75/host-regression.raw.log`.
- The corrected Windows tests invoke the real `launchHostCodexRun` entry with a fixture controller process. They prove a tool-free nonempty response, zero snapshot/tool workers, rejected workspace-tool attempts with zero workers, rejected empty terminal output, and rejection of nonempty authority in read-only mode.

No provider, subscription model, or local model call was made. The fixture controller uses a copied local Node executable. Qwen remained off and the prior subscription budget remained exhausted.

## Final source hashes

- `daemon/src/adapters/integration-executors.ts`: `79e1e4f8f18e602958b932542538c5185df8f9ff26cb5bdf744e3c54a6b58577`
- `daemon/src/host-codex-runtime.ts`: `377d7d7c6be2bdf77cd66796b0fc66861de28552cba3af72274bf79fd23bbb92`
- `app/native-implementation-host.mjs`: `13bda3920257f5f2de51aa2815a6b315a5d84d4491de64ed55f51eee2c94aec0`
- `app/native-implementation-host.d.mts`: `741e1b147880f13ea2f3e4bf3a50b1c829b7048184d9b1dc39a04cae6988c153`
- `daemon/test/integration-native-verifier.test.ts`: `5f298c42b0dfdcb7174497b10efad14350dcb7b35188b86ae161fb3119ad332f`

`PREIMAGES.json` records exact pre-edit SHA-256 values and the one pre-existing byte-copy location. The host runtime preimage was hashed before editing but was not copied; that evidence limitation is explicit and no reconstructed bytes are claimed.

## Limits

This provides a production composition and execution seam. It does not make the native implementation host the default application deployment, grant authentication or qualification, establish provider billing truth, or constitute requirement acceptance. A verifier terminal response is a transport result that still requires the existing independent acceptance path.
