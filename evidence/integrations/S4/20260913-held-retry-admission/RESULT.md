# Held legacy retry admission reproduction

The hypothesis is reproduced. The real orchestration store admitted an ordinary decision-free retry while the prior verified clean failed attempt still had an open, revision-0 `held_recovery` case. The call returned `launchRequired:true`, inserted the replacement running attempt, and inserted its retry link; the held row remained open.

Command, from `daemon/`:

```text
npx vitest run test/integration-held-retry-admission.test.ts
```

Result: 1 file, 1 test passed.

Hashes:

- current `orchestration/store.ts`: `1DFBF90935FFCAE35ABEDA888AB6E9D1DEC16E03A4309F757C484A876CFCC2B3`
- focused before-behavior test: `F6B0C943D631E90CB3A88F0AF7E9D8B8D92F92D27BA4F1F9837A63F4FC9AC1AB`

Cause: the final held-disposition read in `claim` is conditional on `recoveryDecision`. The legacy retry path has a trusted retry reference but no recovery decision, so it reaches attempt and retry-link insertion without reading the prior attempt's held case.

Minimal proposed fix: at the existing final admission point after all host callbacks, select the prior attempt from `recoveryDecision.prior_attempt_id` or, for decision-free retry, `retry.previousAttemptId`; run the same exact-seal disposition reader before any lease, attempt, activation, retry-link, or stage mutation. Open/corrupt cases fail closed, reconciled-stop remains blocked, valid eligible disposition and no-held legacy retry remain admissible. Add zero-write negatives and eligible/no-held positives.

No product source, native process, model/provider, network, external effect, or shared build changed or ran.
