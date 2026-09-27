# Opus 5.5 read-only bottleneck advice and disposition

2026-09-24. One Claude Code CLI `-p` turn, exact `claude-opus-5-5`, no tools, no session persistence, `--max-budget-usd 1`. CLI JSON reports `num_turns:1`, model `claude-opus-5-5`, tool calls 0, `total_cost_usd:0.1332382`, successful exit. Raw answer: `response.json`; stderr and exit retained. This was architecture advice, not source inspection or independent review.

## Critical review

Opus proposed an immutable staged-file bundle delivered over a Cue-owned stdin pipe. The useful principle is to separate **Cue-owned submitted bytes** from arbitrary child file reads and provider-side model context. But a successful pipe write means bytes were accepted by the local pipe, **not** that the child read them; an app-server response can be fabricated by an untrusted child and does not prove provider model consumption. Replacing Codex app-server JSON-RPC input with a file bundle would change the current tool protocol and cannot be treated as a minimal safe fix. Spawn-suspended/Job Object and a separate DPAPI signing process require their own Windows feasibility, ownership, ACL and independent-key trust proofs. A proposed ledger consume-before-resume cannot atomically know subsequent delivery success. None of these recommendations grants `executedInput.matches:true`.

## Narrow implementation

The existing host Codex JSON-RPC session now hashes the **exact newline-delimited `thread/start` and `turn/start` request bytes** before writing them and emits a bounded `host-rpc-app-server-ack-only` event only after a valid matching response ID. The event contains method, SHA-256, UTF-8 byte length and `executedInputVerified:false`; it contains no goal/prompt text. The existing adapter projects it as a `progress` journal summary with an `ack-only` label. Rejected/malformed responses do not emit that method's acknowledgement, and an activity sink failure fails the run. This is a host protocol **response observation**, not a process-consumed file receipt, trusted child read attestation, or model-context evidence. The default `measuredFactHost` remains absent; no measured fact/trial or policy promotion is created.

## Verification

`build.log` passes. `focused.log` covers 7 files/67 tests, including exact outbound-byte digest, valid ack only, rejected/malformed response, sink failure, adapter progress projection, native runtime fixture, and handoff activity. All are offline/local fixtures; no Cue provider evaluation run occurred. The prior root suite timeout/failure is not superseded by this focused pass.

## Remaining blocker

To establish a process-consumed-input claim for the existing-file workload, a separately qualified boundary must establish what the actual worker/provider consumed, not merely what Cue staged or sent to its untrusted app-server. The current protocol event supplies useful exact request lineage but cannot fill the executed-input `matches:true` slot. Independent verifier-quality, complete environment/account/price/final-cost, queue-through-cleanup timing and remote termination/billing still require separate genuine producers. No live Cue provider run was performed here. Do not reuse the Opus question, its reported confidence or offline protocol fixtures as qualification.
