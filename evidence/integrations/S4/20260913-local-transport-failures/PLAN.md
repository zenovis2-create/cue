# Plan

Done means mocked `fetch` HTTP rejections are privately classified by `streamLocalModel`, mapped by the isolated adapter to a finite host diagnostic code, and accepted by the existing durable terminal activity validator after storage/reopen; arbitrary thrown or forged errors remain `transport-failed`, while cancellation/deadline retain first cause.

Attempt cap: 2 implementation/verification passes per diagnosed issue.

Every pass runs the focused Vitest gate from `daemon` followed by `npm run build` once tests pass. Failures are recorded verbatim enough to identify the command, failing test, and cause before the next bounded pass.

Failure strategy: make only the smallest change justified by a focused failure; stop after the second failed attempt for the same diagnosed issue and report the blocker. Do not run native or real HTTP fixture suites.
