# Batch92 — explicit fixed-plan manual baseline and user confirmation

2026-09-22. Direct implementation/self-review. No delegated agents, real provider/account/model requests, credentials or publication. Qwen OFF; old subscription allowance4/4 spent.

Resolve structural mismatch without changing selector semantics: a global single-candidate pin would pin the verifier to the writer. Introduce an explicitly requested planDigest-bound baseline variant, validating the existing immutable run plan: singleton candidate per task, implementation writers share one candidate, independent verifier candidate, no fallback candidates, no recovery plan or mismatched execution. Keep legacy no-plan requests requiring global policy pin. The existing native host already emits singleton per-task plans; do not relax its unpinned policy guard or modify runtime admission.

Add a host-controlled confirmation bridge: derive actual policy and pinned task plan in Core; user submits only baseline/enrollment IDs, full dataset/case and metric/environment/account refs. Native Electron confirmation defaults Cancel; exact immutable request binding, no renderer-provided true/verifier/timestamp/policy/candidate authority. Recheck current run/approval/workspace/plan and short confirmation deadline after asynchronous consent. Replays return stored declaration; conflicting reuse refuses. Baseline confirmation never executes/approves a task or creates a measurement.

Connect existing evaluation panel via explicit baseline action, reuse imported full manifest/case and user reference fields. Preserve ordinary enroll, stale-response and approval locking. Retain baseline trial:null and qualification limits.

Verify backend plan validation/read/reopen, actual Core/SQLite/IPC confirmation boundary with mocked native response (not a genuine user choice), cancellation/default false, mutation/delay/new run/approval races and hostile shapes; renderer tests and startup/import regressions. At most two correction hypotheses per unchanged blocker; keep failed logs and preimages. Full prior suite is historical, not current qualification.
