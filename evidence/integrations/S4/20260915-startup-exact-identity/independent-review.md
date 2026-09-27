# Independent review — BLOCKED

Reviewed frozen sources:

- `daemon/src/recovery.ts` SHA-256 `FCA73ACE0058476C103CEA6F06F03ABC032F2255E732CE95F43A302B0F556FDA`
- `daemon/test/integration-startup-exact-identity.test.ts` SHA-256 `7C77020E55BD03B9A3060FECC9F0AED7E906ACA94DD451357282CAE8B86D7739`

## Blocker

🔴 The process identity is not carried across the final termination boundary. `recovery.ts:36-43` observes PID 424242 and proves that observation has the expected creation time, but then calls `terminateVerifiedTree(row.pid)` with only the numeric PID. `process-termination.ts:105-111` performs a new process-tree observation and accepts any root having that PID; it never compares the root's `createdAt` with the identity accepted by recovery. If the original process exits and Windows reuses its PID between those two observations, the helper can terminate the replacement process and report `terminated_verified_session` for the stale ledger row.

The focused test cannot detect this race because `integration-startup-exact-identity.test.ts:8` replaces the entire termination module with a mock, and the success assertion at lines 43-49 proves only that the PID was forwarded. It does not prove that the terminating observation remains bound to the accepted creation identity.

The final termination operation should accept the expected creation identity and refuse unless its own root observation matches it. If the contract requires an absolute guarantee through the OS kill call, a process handle bound to that identity is required; a check followed by PID-only `taskkill` retains a smaller reuse window.

## Other reviewed properties

- Exact comparison is sound for the represented format: the parser preserves 100 ns ticks, pads shorter fractions consistently, and normalizes equivalent timezone offsets through the whole-second epoch calculation.
- The anchored expression rejects trailing input, more than seven fractional digits, and non-ISO offset forms. The component round-trip rejects invalid calendar/time fields, while `Date.parse` rejects invalid offsets.
- Persisted PID input is rejected unless it is a positive safe integer within the Windows 32-bit unsigned range before interpolation, so malformed ledger values cannot inject into the PowerShell command.
- A nonzero query status, launch error, or stderr throws before any death artifact or termination call. Empty successful stdout alone is treated as `session_not_live`.
- Legacy approximate timestamps and one-tick mismatches are refused rather than terminated.

## Independent gates

- Focused startup identity test: PASS, 7/7.
- TypeScript no-emit: PASS.
- Selected failed-initial-query regression: PASS, 1/1 selected (14 skipped).

Commands and output summaries are recorded in `reviewlogs/checker-gates.txt`. No build, provider/network request, localhost request, or real process termination was run.
