# Native Codex verifier plan

Done means `daemon/test/integration-native-verifier.test.ts` proves the native implementation host constructs a distinct Codex verifier from `verifier.executor`, launches it only as the runtime `model` role with an empty-action/empty-egress envelope, preserves controller lifecycle/cancellation/activity/subject behavior, accepts the legacy opaque `verifier.candidate`, and rejects mismatched installation identity, candidate/account identity, role, or write authority. The exact focused gate is `npx --no-install vitest run test/integration-native-verifier.test.ts test/integration-native-implementation-host.test.ts test/integration-executors.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon` after the root-owned shared build; before that handoff the maker runs `npx tsc -p tsconfig.json --noEmit` from `daemon`.

Attempt cap: 2 attempts per hypothesis.

Every pass checks the focused tests (when the coordinated dist build is available), TypeScript no-emit, the three owned source diffs, and these SHA-256 preimages:

- `daemon/src/adapters/integration-executors.ts`: `e8f8dfbd90f8bec59f22db8b47a575be4b3099d1c4926f2ef585bb4e2f9c7b2e`
- `app/native-implementation-host.mjs`: `5348014e014afafede64aafa250a95ffac1ca5e05bca063146ce63685e054d06`
- `app/native-implementation-host.d.mts`: `7a0b0fd501a8d567c578cd790d4fe75a7bbcbae09de51c7e966af4e98606ae9c`
- `daemon/test/integration-native-verifier.test.ts`: absent

On failure, retry only with a new evidence-backed hypothesis. If two attempts fail for one hypothesis, hand the exact failure and frozen diff to root. Keep a change only when the focused gate improves; revert a regression in the owned files.

## Independent-review correction hypothesis

The initial focused pass used an injected top-level launcher and missed that `launchHostCodexRun` always runs workspace snapshots through a worker requiring `command`. A read-only verifier therefore fails before RPC. The correction adds an explicit adapter-owned read-only result mode: only an exact empty-action/empty-egress envelope may use it; it skips write-oriented snapshots, keeps all controller tool calls routed through the existing worker guard, and treats a completed nonempty verifier response as transport success for downstream independent acceptance. The test must invoke the real `launchHostCodexRun` boundary with only a fixture controller process, observe zero workers and zero workspace changes, and prove a tool call still fails without command authority.

Correction preimage:

- `daemon/src/host-codex-runtime.ts`: `22d2217b119f8762b165c8afd7b853f24370b9518e10b7565785ead85364ecaf`
