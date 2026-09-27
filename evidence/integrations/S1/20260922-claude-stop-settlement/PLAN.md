# S1 Claude cancellation settlement (batch86)

Scope: continue the unfinished S1 second-agent / cancellation lifecycle prerequisite without enabling the inactive Claude candidate. In the current executor, a child `close` can settle completion before a pending owned-tree stop rejects or times out. Test that race and await the existing bounded stop operation before classifying the result. A local close is not whole-tree death, provider termination, or final billing.

Done gate: reproduce the race with mocked child processes; preserve the failing output; fix only the completion barrier; pass Claude executor/protocol/SQLite ownership regressions and shared runtime/lifecycle tests; daemon build and compiled import gate. Exact existing-file preimages are in `preimages/`. At most two diagnosed corrections for the same defect. No independent reviewer tool is available in this session: self-review must not be labeled independent, and no original parent checkbox is closed.

Cases: close before delayed stop rejection, close before stop timeout, close before successful stop acknowledgement, existing missing identity / no-close / cancellation idempotency. Unknown result retains its durable session handle. Cancel acknowledgement still grants no cleanup authority.

Constraints: zero Claude/Codex model, provider, service or account calls; Qwen remains OFF; subscription budget remains 4/4 exhausted. No GUI/live qualification, commit, publication, or unrelated cleanup. Preserve the existing dirty worktree.
