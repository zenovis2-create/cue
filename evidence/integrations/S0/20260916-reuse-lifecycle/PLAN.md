# R03-R06 selected reuse lifecycle plan

Scope: `scripts/reuse/reuse-manifest.mjs`, `scripts/reuse/reuse-fixture-receipts.mjs`, their focused tests, and this evidence directory. No app/daemon product implementation, authoritative checklist/spec/progress documents, provider calls, installation, or deferred transport qualification.

## Done

- A pure lifecycle evaluator binds reusable evidence to a canonical selected revision, manifest digest, and receipt SHA-256.
- Current complete bindings are reusable; changed revision/hash or a missing receipt invalidates them.
- Invalid current evidence selects only an explicitly pinned, fully valid fallback or returns an explicit refusal. It never silently loads stale evidence.
- Receipt verification uses the lifecycle evaluator, and focused tests cover current, drift, missing receipt, valid pinned fallback, invalid fallback, and R-03 pure-function N/A grounding.
- R-04/R-05/R-06 closure claims remain limited to the currently selected fixture/tool seams; R-05 Cue behavior and upstream-reference proof stay separate. Deferred PI/TeamAI/transport work remains open and unauthorized.
- Raw focused-test stdout, exit code, source pins, and full pre-edit/final filesystem bytes for owned changed files are saved under this directory.

## Attempt contract

Attempt cap: 3. Every pass runs `node --test scripts/reuse/reuse-fixture-receipts.test.mjs` and the focused Vitest manifest file. A failing pass must produce a new diagnosis and hypothesis before another mutation. Keep a change only when these gates improve; after three failed hypotheses, preserve evidence and hand the unresolved defect to the parent.

Independent checking is separate from this maker. This plan and maker results are inputs to a later reviewer, not self-approval.
