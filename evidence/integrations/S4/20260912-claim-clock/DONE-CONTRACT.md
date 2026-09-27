# Claim clock correction

Done: deterministic final-slot callback regression and normal retry pass; related recovery/retry/driver tests, TypeScript and build exit 0; independent Sol review before checklist credit.

Cap: three diagnosed correction passes. Every pass runs the focused recovery-policy suite; widen after source stabilizes. Preserve baseline failure and unrelated edits.

Baseline 7817be: 3/6 failures in new fixture before scheduler assertion (`stage_attempt_revision_mismatch`). Fixture binds stage before creating its required attempt. First correct fixture ordering; then reproduce clock callback after cap reads and fix ordering. No model, provider, native process or external effects.
