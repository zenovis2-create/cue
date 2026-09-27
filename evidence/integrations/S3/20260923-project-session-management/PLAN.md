# Batch101 — project and Cue-owned session management

Goal: add bounded offline project registration/switch and durable multi-run Cue sessions around the existing run and approval boundaries. No provider/model calls, no credential copying. Preserve dirty state/preimages and failed evidence.

Authority design: shared ledger stores project roots and Cue session/run links; project selection never grants execution. Folder choice is host dialog only; no renderer path input. A switch refuses active/queued, unresolved write or prepared approval in memory. It blocks new IPC, awaits Core teardown, atomically changes only the active root config and relaunches. Failure before teardown leaves old authority; failure after teardown remains blocked and must recover without presenting success. No automatic resume; a continued Cue session starts a new run under current scope/approval. Historical run records remain read-only.

Tests: schema migration and cross-worktree containment, IPC malformed/forged DTOs, session attach/read/archive, switch decision/atomic config, renderer navigation and stale-response cases, existing UI/Core regression. Native Electron switch and manual acceptance remain separate unless proven.
