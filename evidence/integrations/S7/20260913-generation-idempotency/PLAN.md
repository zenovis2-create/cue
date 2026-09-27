# Static generation idempotency

## Done contract

- Focused command from `daemon`: `npm exec vitest run -- test/current-source-report.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`.
- Attempt cap: 2. Every pass runs the focused command; final pass also runs `npm run build`.
- Done means an identical complete generation is reused, while missing/tampered artifacts, manifest mismatch, extra entries, and changed source-basis/provenance fail closed without changing the pointer or existing generation.
- If a pass fails, retry once with a new hypothesis; after a second failure report the exact assertion.

Tests use owned temporary roots. The real repository generator is not run here, and the preserved failed staging directory is untouched.
