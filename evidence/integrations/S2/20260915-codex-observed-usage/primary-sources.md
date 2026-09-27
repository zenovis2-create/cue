# Immutable upstream protocol sources

GitHub remote resolution performed 2026-09-15:

```text
6bc50f104dcc0192e696cdeae721dfc19b507391 refs/tags/rust-v0.153.0
41e22fee981a63b3698df7ed36bad393cda24715 refs/tags/rust-v0.153.0^{}
```

The first value is the annotated tag object. The peeled commit used below is `41e22fee981a63b3698df7ed36bad393cda24715`. No claim is made that the movable tag name or current `main` is immutable or equivalent.

Raw-byte retrieval receipts:

| Bytes | SHA-256 | Immutable source |
|---:|---|---|
| 332 | `53ce4421d686b8a7f9a86c5ad54de2a7dceecfb95df74fa5f441947e136f063d` | [ThreadTokenUsageUpdatedNotification.ts](https://github.com/openai/codex/blob/41e22fee981a63b3698df7ed36bad393cda24715/codex-rs/app-server-protocol/schema/typescript/v2/ThreadTokenUsageUpdatedNotification.ts) |
| 345 | `27cae6c3e6c44696225e9a0903e0531c6eff126c6de3da2176bc5cdd904def4e` | [ThreadTokenUsage.ts](https://github.com/openai/codex/blob/41e22fee981a63b3698df7ed36bad393cda24715/codex-rs/app-server-protocol/schema/typescript/v2/ThreadTokenUsage.ts) |
| 345 | `e983f21175fdfdf1a239e26cd8916e1cb765bc0cb7904e2bd9cc83ffe325c8a7` | [TokenUsageBreakdown.ts](https://github.com/openai/codex/blob/41e22fee981a63b3698df7ed36bad393cda24715/codex-rs/app-server-protocol/schema/typescript/v2/TokenUsageBreakdown.ts) |
| 36,034 | `8a79e9f5a498eed6778bd64a79edd8a3c879b193cd6144de2396dd4a9a556057` | [codex_thread.rs](https://github.com/openai/codex/blob/41e22fee981a63b3698df7ed36bad393cda24715/codex-rs/core/src/codex_thread.rs#L560-L569) |

The pinned schemas define `threadId`, `turnId`, and `tokenUsage`; `tokenUsage` contains `total`, `last`, and nullable `modelContextWindow`; each breakdown contains the six numeric counters consumed by Cue. The pinned Core source calls `token_usage_info` the complete snapshot cached for the thread and states that reading only `total_token_usage` would omit last-turn usage from the notification.

Accounting interpretation: `total` is the cumulative per-thread snapshot and is replaced rather than summed. `last` is retained for payload completeness and is not treated as an increment. Cue creates an ephemeral thread for each attempt, so its accepted thread cumulative total is scoped to that attempt.
