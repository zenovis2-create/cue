# Independent review — public-driver restart actual 1

Verdict: **VALID HARNESS FAILURE; cleanup verified. Do not treat this run as product failure or success, and do not rerun at these fixture pins.**

Reviewed 2026-09-15 (Asia/Seoul). This was a read-only audit of the retained actual-run evidence and pinned source. No build, provider, Electron, local-8085, network, process termination, or actual rerun was performed.

## Evidence hashes

| Artifact | SHA-256 |
|---|---|
| `actual.log` | `2ce1bcf283c699d6ea05b86264899790c18c0b78b08aa870c3d41d140bb2652f` |
| `observations.json` | `ba78127cfe90c9cbb9a7a364296813e8c57db67e20ce4075fb271ee6deb60fe3` |
| `cleanup.json` | `4be4e2c73361519c36186d7e15cf4812e55cf7d1add8c3a12dcb86d5eefb8a35` |

## Source pins used by actual 1

- Fixture: `ab8e5095fe8b1a829248f0e6482f322c49f092934c4a90bb8fc42cf41267818f`
- Test: `db10b8e4543fb7837408104924b2f33f2ecfcfc612c675963cd18fed8e45279f`
- `daemon/src/final-publication.ts`: `653a15cda3e60303110dfc6a7ee4f903e24a7d61ae0eaa73d37116da179273d9`

The complete runtime pins are retained in `runtime-pins.json`; the fixture pins are retained in `fixture-pins.json`.

## Failure audit

The run exited 1 after the first actual child response. The response proves the public-driver path launched once, staged/opened/read once, invoked the native writer once, and committed `published-by-public-driver` with the expected 26-byte SHA-256 `8b27c0cab00b1de03c6c07ee3e06d8914bf3479f7e92b70b1c5926a846f62a35`. It also reported zero publication results, as expected at the crash window.

The failed assertion was only `intentCount`: expected 1, observed 0. At pinned `final-publication.ts:89`, the intent is inserted before native execution. At line 90, however, the execute callback receives native arguments (`root`, identities, target, replacement, and max bytes) and does not receive `publicationId`. The fixture queried `change_publication_intent WHERE publication_id=?` using `publication.publicationId`, which is therefore `undefined`. The zero count is a fixture-observation bug; it does not show that the intent was absent.

The proposed correction direction is appropriate if it binds the callback to exactly one already-inserted intent using the native arguments plus the captured attempt identity, and fails closed on zero or multiple matches before the write observation is emitted. That correction requires its own frozen pins and offline/preflight review before actual 2.

No restart child was launched, so this run supplies no restart/recovery verdict.

## Cleanup audit

`cleanup.json` records phase `complete`, exact child PID 67920 with creation time `2026-09-15T21:32:58.7254250+09:00`, `closed: true`, no child error, `absent: true`, and `retained: false` for root `D:\\Temp\\User\\cue-public-driver-restart-jEioDf`.

Independent post-run checks confirmed:

- PID 67920 is not present.
- `D:\\Temp\\User\\cue-public-driver-restart-jEioDf` does not exist.

Cleanup is therefore verified for the only child and exact scenario root created by actual 1.

## Gate disposition

Actual 1 is consumed as a diagnostic failure. Actual 2 remains blocked until correction 4 is independently reviewed at new fixture/test pins and the root completes the planned combined source freeze and build 2.
