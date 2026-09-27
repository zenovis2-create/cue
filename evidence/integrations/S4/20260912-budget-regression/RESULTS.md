# S4 budget regression results

Date: 2026-09-12

Verdict: executor gate passed; independent root rerun remains required.

## Diagnosis and corrections

1. Baseline chunk `35ce53` passed 13/16 tests. The ordinary local-invocation chain failed `task_not_ready` because boolean-only receipt verification left completed dependencies without current schema-033 terminal evidence. Both concurrent tests started `openLedger` in parallel; the monetary test surfaced `database is locked`, and the local test did not reach its required limit result.
2. Added normalized parent/stage bindings, exact selection records, durable session identities, launch intents, authorized artifacts, and handoffs to the local fixture. Serialized worker connection/schema initialization in both concurrency tests, then released both transactions together. This isolates reservation contention and does not claim concurrent migration-open support. The concurrency assertions passed; stage binding then exposed missing persisted approval and placeholder policy lineage.
3. Added the exact approval event and a saved/bound selection policy shared by the orchestration plan and local-invocation policy. The local budget's policy semantics and all exactly-once assertions remain intact. SQLite busy/locked is never translated to success.

A `--reporter=basic` verification attempt failed at Vitest startup because that reporter does not exist; no tests ran and no product behavior was implicated. The corrected command passed.

## Gates

- `npm run build -- --pretty false`: exit 0, chunk `b9d3aa`.
- `npx --no-install tsc --noEmit -p tsconfig.json --pretty false --incremental false`: exit 0, chunk `829207`.
- Focused two-file Vitest gate: 16/16 passed, chunk `36d84c`.
- Scoped `git diff --check`: exit 0.

## SHA-256

```text
48bf48d68be356228a4a1327578c4484928ad4d07edfd4ff629a2ee061d8666e  daemon/test/integration-local-invocation-budget.test.ts
6e82e1bb98dfde06b1d2e97ed7e48f4122b7d896b04e47ebbaa51f802640d156  daemon/test/integration-budget.test.ts
```

No product source, model, native helper, provider, network, or Electron behavior was used.
