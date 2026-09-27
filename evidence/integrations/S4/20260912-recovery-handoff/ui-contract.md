# Recovery handoff reason UI contract

Done means the existing native recovery journal projection accepts only the backend's finite optional `reasonCode`, exposes no raw reason/path/case identity, and the renderer displays a concise Korean explanation through `textContent` only for held/unavailable journal states. Unknown, proxy, accessor, or malformed reason data is ignored without evaluation. Existing state/revision meaning, observation-only authority, and absence of recovery actions remain unchanged.

Attempt cap: two diagnosed correction hypotheses. Every pass runs the native recovery UI and recovery run-picker regressions plus JavaScript syntax checks; the final pass records a scoped diff and stable source hashes. Failures receive one new evidence-backed hypothesis, then handoff after the second. No backend, build, Electron, native helper, model, network, or documentation changes are in scope.
