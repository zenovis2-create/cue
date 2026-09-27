# Evaluation UI verifier contract

Done is a focused, source-bound implementation whose daemon/Core observation tests, new IPC/preload/renderer DOM tests, existing relevant app regressions, typecheck, and build all exit 0. The checklist covers exact pre-approval enrollment payloads, post-approval lock, current-run binding, impossible arbitrary run/cutoff fields, stale run/response fencing, explicit observation revision and replay, coverage with unobserved/failure truth, bounded wrapping identifiers, clearing stale data on errors, and zero evaluation calls on load/render.

Correction cap: 2 diagnosed correction passes.

Every pass runs the focused new app tests plus the existing evaluation observation Core tests; the final pass also runs relevant IPC/renderer regressions, typecheck, and build.

On failure, retry only with a new evidence-backed hypothesis and keep a change only when the measured gate improves. After two diagnosed corrections, preserve evidence and hand the remaining failure to the parent. Actual Electron execution is excluded and remains a separate independently reviewed gate.
