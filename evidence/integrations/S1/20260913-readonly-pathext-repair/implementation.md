# Fixed-PATHEXT repair receipt

## Result

The bounded host-only diagnostic established that the absolute sealed `icacls.exe /?` command executes under exactly `SystemRoot`, `WINDIR`, and fixed `PATHEXT=.EXE`: status 0, no signal or spawn error, nonempty bounded stdout, and empty stderr. This proves only executable activation for that diagnostic.

The minimal offline repair adds fixed `.EXE` PATHEXT to the shared host PowerShell environment and the production worker's two host PowerShell sites. Caller environment extras and PATHEXT overrides are discarded. The isolated verifier payload and its command digest retain the original eight environment keys.

No boundary gate was rerun. The earlier corrected gate remains failed and closed, and the diagnostic does not prove ACL grants, AppContainer behavior, cleanup, durable identity, acceptance, or production qualification.

## Verification

- Shared helper tests: 9/9 passed.
- Worker/bootstrap tests: 2 files, 2 tests passed.
- TypeScript no-emit: passed.
- Coordinated build and asset copy: passed.
- Independent PATHEXT review: PASS, `review.md` SHA-256 `CACDAC73CFC09F53E80A2E45680C1A3B083EEA20C31C637A4A4BCAFEC703F3DB`.
- Independent coordinator review: PASS, SHA-256 `0038E151DE4C97C73F7CF8F091CD69114BAD711D9C2E847EE58743D4BA8472B4`.

## Frozen hashes

- Shared helper: `AD287C573FA1BD0CE096F09AA265C310527CA77C2607CB2E0172CEE3A57CDF3B`
- Shared helper test: `1CDC81C4F09A517B100DFAB6AFAD9D48E2ADA7A4FA7416EA5C29C46B8C62BC35`
- Production worker, including the separately reviewed CRLF PID parser: `DC3136E8F6387B3C0D7A2DF8D164AB3D2261CBD968B42E0933EAD545D2D4294C`
- Diagnostic script: `A3E34248A38B34C57EF8B2B6CF308BA8D90DE63E7869E91363FA251239C01B8F`
- Diagnostic result: `A2EC6EA91BBAA8B12164E3EE72E1F483A052ED2A95790A0DCCBAED20594E90CA`

The archived pre-edit helper, test, and executed corrected-gate manifest remain byte-identical at `C6C689FC...`, `48E05FCF...`, and `92F8D999...`, respectively. Historical intent and result files were not changed.
