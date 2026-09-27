# Subscription runner independent review

## Review contract (declared before writing findings)

- **Done:** independently inspect the runner, offline tests, and prepared live descriptors for the four-slot cap, reservation ordering, retry behavior, termination, subscription-only enforcement, and secret-safe evidence.
- **Attempt cap:** two review passes, with the second only after maker changes.
- **Gate every pass:** run the focused offline test suite; inspect the exact current source; search the resulting evidence design for credential values and unbounded provider execution.
- **Failure rule:** issue a stop-ship finding with a concrete correction; do not run a provider/model task.

## Pass 1 verdict: stop before live execution

The runner correctly enforces slots 1–4, reserves each slot durably with exclusive creation before executable hashing or spawn, consumes failed/unknown reservations, performs exactly one `spawn`, and contains no application retry loop. These controls satisfy the core global-cap mechanics when every launch goes through the fixed default ledger.

Live execution should wait for the findings below.

### Stop-ship findings

1. **The `completed` status describes process completion, not provider-result success.** `launchSubscriptionTask` sets it from process exit/timeout/overflow fields alone. The root-owned validator separately checks terminal events, expected result, actual model, usage, and absence of tools, so this split is acceptable if the field is documented or renamed `process-completed` and no final report treats it as provider success.

2. **Full streams were persisted after best-effort regex redaction.** The maker corrected this after pass 1: the current ledger persists an allowlisted projection plus stream byte counts/hashes rather than raw stdout/stderr. This finding is resolved in the runner itself.

3. **The prepared isolated Codex auth copy has no cleanup owner.** `prepare-live.mjs` copies `~/.codex/auth.json` into system temp, while neither preparation nor the runner removes that temp profile. Add guaranteed cleanup after durable outcome recording and only after the owned process tree is confirmed dead. If quiescence is unknown, preserve the directory path as a cleanup blocker without printing its contents and do not claim cleanup.

4. **Normal root close does not prove descendant quiescence.** Successful runs record `owned-root-close-only`. A child or daemon could survive after the root closes. Observe the creation-bound tree during execution and verify tracked descendants at completion, or classify local cleanup/quiescence as unknown rather than complete. Timeout cleanup uses the creation-bound helper and the Windows timeout test passed.

### Additional hardening

- `validateSpec` validates shape but does not enforce provider-specific subscription-only arguments/environment. A reviewed descriptor can accidentally omit forced ChatGPT login, retry-zero, safe mode, empty tools, or the expected executable path and still pass. Either enforce exact provider contracts in code or verify a pinned descriptor digest in an independently reviewed manifest before reserving/spawning.
- `options.ledgerRoot` is suitable for offline tests but must never be exposed in the live CLI path. The current `main` uses the fixed default, which is correct.
- The default ledger path is `.../ledger/20260916-subscription-live/slot-N.json`; document this nested location so operators do not inspect or reset the wrong directory.

## Evidence from pass 1

The focused test command reported passes for durable four-slot behavior, failure consumption/projection, pending reservation exclusion, and verified Windows timeout cleanup. The combined-stream overflow case was then run independently and passed in 7.8 seconds, within its 5-second child timeout plus creation-bound Windows cleanup overhead.

No provider executable or model request was invoked during this review.

## Pass 2 integration review: ready for the fixed bounded checks

The final runner (`SHA-256 B1C3529B8992CF1EA28ADA3E9804CCC24AFEF79916158D38CD3B44E7BCFF3EB7`) improves input hardening, projects terminal/session/usage/result/model and tool-event evidence, and no longer persists raw streams. Sanitized bounded stdout/stderr remain non-enumerable, in-memory return fields solely for the root wrapper's provider-specific validation. JSON serialization into the durable ledger omits them. Targeted offline tests pass.

The pass-2 integration mismatches are resolved:

- The original spec surface is restored, so `prepare-live.mjs` and `validateSpec` agree.
- `execute-slot.mjs` can parse the non-enumerable in-memory stdout, while the durable ledger retains only its safe projection, sizes, and hashes.
- Requested model and provider-reported model remain distinct evidence; the runner does not falsely compare Claude alias `opus` with a canonical event ID.

The root-owned cleanup wrapper validates the canonical system-temp parent/prefix, refuses symlink cleanup roots, waits for observed root-process absence, and labels its scope as root-close cleanup rather than remote/provider death. It separately requires provider terminal evidence, usage, exact deterministic output, zero observed retry/tool events, Claude empty init tools/MCP, and successful credential-profile cleanup. This design is ready for the two fixed, bounded no-tool checks. It does not establish remote billing finality or full descendant/provider death, and the report must retain those limits.

The final focused suite was independently re-run after the contract fix. Six tests completed inside the command's 30-second observation window; the remaining overflow test had already passed independently in 7.8 seconds. The maker's uninterrupted run reports 7/7 passing. No provider/model call was made by any review command.

## Live evidence and slot-3 correction review

- **Slot 1 (Claude): pass, narrowly scoped.** The signed/hash-pinned Claude executable exited 0 and reported terminal success, canonical model `claude-opus-5`, usage, the exact nonce-bound result, empty init tools/MCP, zero observed tool/retry events, and removed temp state. This proves one bounded Claude subscription task only. The CLI-reported API-equivalent cost is preserved separately; subscription invoicing remains unknown.
- **Slot 2 (Codex): consumed argument failure.** It exited 2 with 0 stdout bytes, no provider terminal/model/session/usage/result, and removed the isolated auth copy. It provides no Codex model-capability evidence. The failure was reproduced without a model by the misplaced global `--ask-for-approval` option under `exec`.
- **Slot 3 correction: clear to launch.** The only material argv change moves `--ask-for-approval never` before `exec`; all prior subscription, retry-zero, no-tool, read-only, ephemeral, isolated-profile, model, and effort controls remain. The exact corrected argv with `--help` exits 0. The new stderr classifier stores only a bounded category, not raw stderr. Slot 3 has a fresh nonce/profile, uses a new durable slot, and does not overwrite or retry slot 2.

These observations do not qualify the full Cue workflow or close lifecycle, billing, optimization, or all-provider claims.

## Slot-3 diagnosis and final-slot hypothesis

Slot 3 exited 1 before any stdout/provider terminal evidence. Model-free config diagnostics identified the cause: current Codex rejects configuration entries under the reserved built-in provider ID `model_providers.openai`. This is distinct from slot 2's argument-placement error, and slot 3 remains consumed with no model-capability claim.

The OpenAI Codex source supports one diagnosed final-slot correction: select a new provider ID such as `cue_subscription`, set its name to `OpenAI`, `wire_api="responses"`, `requires_openai_auth=true`, and set its request/stream retry counters to zero. Leave `base_url`, `env_key`, bearer token, custom auth, and AWS auth unset. The source routes an absent base URL to `https://chatgpt.com/backend-api/codex` when the active auth mode is ChatGPT, and the first-party auth path requires exactly `requires_openai_auth=true` with no alternate credential source. Preserve `forced_login_method="chatgpt"`.

Before slot 4, the complete exact configuration must pass a model-free strict config diagnostic in an isolated profile. A separate 401 authentication-recovery replay path is not controlled by the request/stream retry counters; final evidence may claim zero **observed** retry events, not an absolute single-HTTP-attempt guarantee.
