# Deployment staging host — bounded plan

Done means a production startup wrapper supplies `executionStaging` to the actual
Core/driver construction path only when trusted host configuration is exact and
the underlying adapter explicitly declares Git-worktree staging support.

- Attempt cap: 2.
- Every pass: run the focused deployment-host Vitest file and `tsc --noEmit`.
- Required checks: missing/disabled configuration preserves existing startup
  behavior; malformed, relative, overlapping, reparse, or unsupported-adapter
  configuration returns explicit unavailable readiness before staging-factory or
  underlying-provider work; an opted-in supported adapter reaches Core/driver
  construction with the exact immutable staging host.
- On failure: retry only with a new hypothesis. If the second pass fails, retain
  raw evidence and hand the unresolved issue to the root agent.
- No local-model probe/restart, paid/provider execution, shared build, or change
  to the Git staging factory is authorized.

## Root-authorized corrective pass

Fresh cap: 1. New hypothesis: the wrapper reached the real driver constructor;
the injected capable-host fixture omitted the constructor's required
`runtime.evidence` and cleanup members. Add those members after inspecting the
constructor, then run the same focused file once. No production behavior changes.

## Root-review correction

Fresh cap: 1. Correct three independently identified boundary defects together:
resolve a prospective storage child with `basename`, validate the real worktree
and overlap before invoking the underlying host factory, and guard recursive
fixture cleanup by its canonical temporary-root prefix. Run the focused file once.
