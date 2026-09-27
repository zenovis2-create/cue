# Independent live-evidence review

## Review contract

- **Done:** independently reconcile all four authorized slots with their specs, durable ledgers, validations, cleanup state, and narrow provider-capability claims.
- **Attempt cap:** two evidence-review passes.
- **Gate:** exactly four durable slot records; every recomputed spec digest matches; no temp/auth copy remains; passing slots have terminal, usage, deterministic output, and zero observed tool/retry events; failures remain failures.
- **Failure rule:** preserve the evidence and narrow the claim. No additional provider launch is authorized or needed.

## Verdict

The authorized four-slot budget is exhausted and internally consistent. Slots 1–4 each have one exclusive durable record; there is no slot 5. Recomputing the runner digest from each reviewed spec, including the runner's sorted environment snapshot, matches all four recorded `specDigest` values.

Two bounded subscription tasks passed: slot 1 through Claude and slot 4 through Codex. Slots 2 and 3 are preserved Codex startup/configuration failures. No further execution should occur under this authorization.

| Slot | Provider | Process/result | Provider evidence | Cleanup |
|---|---|---|---|---|
| 1 | Claude | Exit 0; validation pass | Terminal success, exact nonce-bound JSON, usage, requested `opus`, reported `claude-opus-5`, no observed tool/retry event, init tools and MCP empty | Temp removed |
| 2 | Codex | Exit 2; failed/unknown | No stdout, terminal, model, session, usage, or result; misplaced global option diagnosed model-free | Temp/auth copy removed |
| 3 | Codex | Exit 1; failed/unknown | No stdout, terminal, model, session, usage, or result; reserved built-in provider override diagnosed model-free | Temp/auth copy removed |
| 4 | Codex | Exit 0; validation pass | Terminal success, exact nonce-bound JSON, session and usage (17,419 input / 42 output), no observed tool/retry event | Temp/auth copy removed |

All four preflight temp roots are absent at review time. Consequently, none of the isolated Codex auth copies remains. Successful root-process exits are recorded with `owned-root-close-only`; this is local root-close and temp-removal evidence, not proof about remote provider lifecycle or every possible descendant.

## Claim boundaries

- Slot 1 proves one short no-tool Claude subscription task using configured alias `opus`; its event reports canonical model `claude-opus-5`.
- Slot 4 proves one short no-tool Codex subscription task requested with `gpt-6-astra` through the explicit ChatGPT backend and ChatGPT-only auth configuration. The Codex JSONL did not report a model ID, so the evidence records the requested model and leaves the reported model null. It must not claim provider-reported model identity.
- Both passing validations observed zero tool events and zero retry events. This supports **zero observed tools/retries**, not absolute HTTP-request cardinality. Codex has a separate authentication-recovery path, and neither CLI transcript proves the total number of transport-level attempts.
- Slots 2 and 3 fail before provider terminal evidence and are consistent with the independently reproduced syntax/configuration diagnoses. They show no evidence of an inference request, but the retained evidence does not prove network-level HTTP cardinality.
- Claude's `total_cost_usd` is labeled API-equivalent CLI-reported cost. Actual subscription invoicing remains unknown. Codex emitted no cost field. No paid-API billing conclusion is supported by these artifacts.
- Slot 4 retained a bounded classifier of `stderr-present-review-required`; raw stderr is intentionally absent from durable evidence. The process nevertheless emitted a valid terminal event, exact output, usage, and clean exit. The classifier must remain visible rather than being rewritten as empty stderr.
- These two passes establish only the installed CLIs' ability to complete the fixed bounded tasks through the existing subscription setups. They do not qualify the full Cue workflow, all 21 acceptance rows, lifecycle finality, billing finality, optimization, or production readiness.

## Integrity observations

- Executable hashes in every ledger match the reviewed signed installations: Claude `FD7F35EC7761195AB5BA4EFF423E48A78A7849E78F60D93EC31256CDB1A9EC7E`; Codex `BE96B992178B1E467C225800DA0D65F2C86D5EBA1EF0B14632F65DB381CBDFDE`.
- Slot 1 stdout hash agrees between ledger and validation. Slot 4 stdout hash also agrees between ledger and validation.
- Deterministic outputs contain the correct case marker, sum `42`, sorted array `[2,3,5]`, and their slot-specific nonce.
- Ledger statuses correctly preserve slots 2 and 3 as `failed-or-unknown`; later diagnosis did not rewrite them as passes.

No provider or model call was made by this independent review.
