# Independent correction review: journal approval presentation

Date: 2026-09-12 KST  
Verdict: **PASS for the DOM approval-presentation scope**

## Review done contract

Done means preserving the original blocked review, verifying explicit empty `changeTargets` is rejected consistently with the driver contract, checking stale-path and approval-disable behavior for empty and partial lists, and running the focused approval plus JSON-template DOM tests, renderer syntax, hashes, and owned diff check. Only this correction review is owned. No Electron, native helper, model, provider, or network process is run.

## Correction assessment

The renderer now rejects a supplied `changeTargets` array when its length is less than 1 or greater than 64. Omission remains the only no-declared-change representation, matching the driver contract. Because the change section and list are cleared before validation, an empty or malformed replacement cannot retain prior paths. The prepare handler catches the fixed disclosure error, clears pending approval state and plan content, and leaves the approval button disabled.

The focused regression uses named objects rather than an ambiguous tuple expansion. It independently exercises both `{changeTargets: []}` and a partial target containing only `relativePath`; each case begins from a valid enabled approval, submits the malformed replacement, observes `변경 대상 목록을 확인할 수 없습니다.`, verifies approval is disabled, and verifies the target list is empty.

The existing nonempty behavior remains intact: up to 64 declared targets render their complete bounded relative path, task ID, and exact backup limit through `textContent`; hostile HTML-looking path text creates no element. Read-only replacement, missing plan, and preparation failure continue to clear disclosure. JSON-template form behavior is unaffected.

## Verification

- Approval-plan plus JSON-template UI: **15/15 passed**, exit 0.
- `node --check app/renderer/renderer.js`: **passed**.
- Owned `git diff --check`: **passed**; only the existing LF-to-CRLF working-copy warning was emitted.
- Corrected `app/renderer/renderer.js` SHA-256: `76971D631452239AEC5C7662D98A4E430D9D87FF3409BB46F33A98B8A7F97F59`.
- Corrected `daemon/test/integration-approval-plan.test.ts` SHA-256: `1EEDA3D4B0E4C8FB6E47E96E49D1A1A7B877923E9E5C8603EEF7DDF0CFB53AAA`.

No blocking issue remains in this correction scope. This PASS covers DOM approval disclosure and failure behavior only. It is not actual Electron visual evidence, actual host/native journal integration, execution authorization, or restore/CAS verification.
