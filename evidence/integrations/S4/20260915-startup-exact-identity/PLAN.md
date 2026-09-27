# Startup exact-identity fence

Done is `npx tsc -p tsconfig.json --noEmit` and the focused startup identity test passing offline, with mocked process-command boundaries proving:

- a live PID observed within the former +/-10 second window but with a different creation instant is refused with zero kill calls;
- an exact creation instant, including equivalent timezone offsets and seven fractional digits, reaches verified tree termination;
- malformed ledger identity and failed process observation cannot authorize or invent cleanup.

Attempt cap: two coherent revisions. Every pass reruns the focused test and TypeScript no-emit. A failure gets one new hypothesis; a regression is reverted rather than retained.

No real process kill, provider/network request, localhost request, or build command is permitted by this evidence run.
