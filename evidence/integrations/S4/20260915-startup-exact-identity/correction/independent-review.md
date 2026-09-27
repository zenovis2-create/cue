# Independent correction review — CLEAR (bounded scope)

Reviewed final source freeze:

- `daemon/src/recovery.ts`: `AEE9628ADEF18E2C01A10E465A1D213FA1E66C097B5C4F865276AAA851C20406`
- `daemon/src/process-termination.ts`: `6E91F4ACAFFDC410B1AB4531FFCFEF8BE90DBEACAC3E1BD6A9327023964421DE`
- `daemon/test/integration-startup-exact-identity.test.ts`: `BCA85E0B2C23D1607222CB2F2F77B5C5B20FFB3E5640BC3B09B2FD2A0C6CC99D`
- `daemon/test/integration-termination-exact-identity.test.ts`: `31BD9FD0728E59D65F17518AE7D821DCA2B68B8759628FD696FAF000B06BFAAF`

## Disposition

The previously reported cross-observation PID-rebind blocker is corrected for the stated bounded scope. Recovery passes the persisted `start_time` to `terminateVerifiedTree`. The helper's own fresh process-tree observation locates the root by PID, normalizes both creation timestamps with the shared 100 ns identity parser, and raises an out-of-scope refusal before `taskkill` when the identity differs or is malformed.

The new real-helper test exercises that boundary with mocked OS operations. A same-PID root differing by one 100 ns tick makes exactly one observation and zero `taskkill` calls. An exact instant expressed with an equivalent timezone offset reaches exactly one mocked `taskkill` call. The startup test also proves that recovery forwards the original creation identity and bounds its initial query to 15 seconds with a hidden console.

The exact parser continues to reject trailing input, excess precision, malformed offsets, and invalid calendar/time fields. It preserves one-to-seven fractional digits and normalizes equivalent offsets. Persisted PIDs are validated before PowerShell interpolation, and query status, launch errors, and stderr fail closed rather than being treated as process death. Legacy approximate rows remain refused.

## Residual limitation

This is not an atomic process-handle guarantee. After the helper's fresh identity observation, `taskkill` still accepts only the PID. A process can theoretically exit and have its PID reused between that observation and the signal command. The correction materially narrows and closes the reviewed initial-observation-to-helper-rebind gap, but native handle-based termination would be required to close the remaining observation-to-signal TOCTOU. The implementation and maker evidence state this limitation accurately, so it is not a blocker for the bounded correction.

## Independent gates

- Corrected focused tests: PASS, 9/9.
- TypeScript no-emit: PASS.
- Selected failed-initial-query regression: PASS, 1/1 selected (14 skipped).
- Source/test `git diff --check`: PASS.

No build, real process termination, provider/network call, or localhost call was run. Command evidence is recorded in `reviewlogs/checker-correction-gates.txt`.
