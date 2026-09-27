# Independent review: legacy fixture corrections

## Scope and material inspected

Goal: repair two stale test fixtures without weakening account-identity or migration guards. I compared the current files byte-for-byte by diff against the stored preimages:

- `daemon/test/integration-selection-preference-core.test.ts`
- `daemon/test/integration-attempt-selection.test.ts`
- `preimage-integration-selection-preference-core.test.ts`
- `preimage-integration-attempt-selection.test.ts`

The diff has exactly two functional changes. The Core fixture now creates one installed, protocol-verified, authenticated `agent` catalog record with a 64-character subject digest and a matching current-subject callback (lines 8 and 22-32). The attempt fixture's post-025 migration helper now includes every three-digit migration numbered 025 or later (lines 62-64).

Every original assertion remains. Neither target nor either preimage contains `.skip` or `.only`. The existing unavailable/legacy-mode, explicit-mode refusal, policy mismatch, hostile-input, migration legacy-membership, snapshot immutability, and foreign-key assertions remain in place.

The catalog fixture supplies the prerequisites which `createIntegrationCatalog` actually checks: freshness, installed status, verified protocol, authentication, and matching subject digest. It does not replace the catalog guard with a stub or bypass account identity. The migration range includes current migrations 025 through 047, including the account-identity migration 043 and attempt-staging migration 047, so the real pre-025 upgrade case no longer invokes an engine against an incomplete current schema.

## Evidence and verification

The recorded result is internally consistent:

- `focused.exit.txt` and `tsc.exit.txt` both contain `0`.
- `focused.raw.log` reports both named files and 15 passing tests; `tsc.raw.log` records the intended no-emit command.
- Recomputed SHA-256 values match all four pins in `RESULTS.md`:
  - current Core: `14D63821973A9CD21562630423600D0F7505F5385085DB2309972739B9DBCA47`
  - Core preimage: `EEF83F9A2A45DD76B7323BCA81D3EAC46E869FDADB65AD4973C0732879EFD9D0`
  - current attempt: `B98C0EB99F75B9D396776E7A0D20807398CBBFC8D8D30EEAF3C6E0DB9EFE4D36`
  - attempt preimage: `6F10BC318C3CF54466004E844694A2430B923E6D269B68AABCE080FADFD74D51`

I also independently ran the focused Vitest command directly (15/15 passing) and `npx --no-install tsc -p tsconfig.json --noEmit` (exit 0). The fixture uses denied synthetic runtime functions; no provider, model, credential, or network action occurred.

## Skill-perspective check

The requested `remove-ai-slops` and `programming` skills are unavailable in the provided skill catalog, so their stated criteria were applied directly. This check ran. The diff contains no deletion-only or tautological tests, no assertion that merely mirrors the new fixture constants, no brittle prompt checks, no untyped production escape hatch, and no needless production parsing, normalization, or abstraction. It violates neither perspective.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Verdict

- `codeQualityStatus`: `CLEAR`
- `recommendation`: `APPROVE`
- `blockers`: none
