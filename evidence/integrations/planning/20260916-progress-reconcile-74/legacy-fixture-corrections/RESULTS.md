# Legacy fixture correction results

## Outcome

Both full-suite failures were stale test contracts. No production source or guard changed.

- `integration-selection-preference-core.test.ts` now supplies the installed, protocol-verified, auth-referenced, subject-bound catalog identity required by current non-local driver preparation. The two positive preparations retain their original policy/default assertions. Disconnected and mismatch refusal cases remain.
- `integration-attempt-selection.test.ts` still constructs a genuine pre-025 ledger, then installs every currently shipped migration from 025 onward before invoking the current engine. Its legacy membership, replay-zero, immutability, and foreign-key assertions remain unchanged.

## Gates

- Focused command: `npm test -- --run test/integration-selection-preference-core.test.ts test/integration-attempt-selection.test.ts`
- Result: exit 0, 2 files / 15 tests passed. The package pretest also completed its build.
- TypeScript: `npx --no-install tsc -p tsconfig.json --noEmit` — exit 0.
- Raw logs: `focused.raw.log`, `tsc.raw.log`; exact codes: `focused.exit.txt`, `tsc.exit.txt`.

An earlier invocation supplied worker flags already present in the package script, so Vitest rejected duplicated option values before collecting tests. The corrected invocation above changed only the command line and passed.

## Pins

- corrected selection preference test: `14D63821973A9CD21562630423600D0F7505F5385085DB2309972739B9DBCA47`
- corrected attempt selection test: `B98C0EB99F75B9D396776E7A0D20807398CBBFC8D8D30EEAF3C6E0DB9EFE4D36`
- selection preference preimage: `EEF83F9A2A45DD76B7323BCA81D3EAC46E869FDADB65AD4973C0732879EFD9D0`
- attempt selection preimage: `6F10BC318C3CF54466004E844694A2430B923E6D269B68AABCE080FADFD74D51`

No provider, model, credential, authentication, network, or local endpoint call occurred.
