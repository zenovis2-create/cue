# Independent review: journal approval presentation

Date: 2026-09-12 KST  
Verdict: **BLOCKED on empty-list contract parity**

## Review done contract

Done means reviewing only `app/renderer/index.html`, `renderApprovalPlan` in `app/renderer/renderer.js`, and the two new journal-target cases in `daemon/test/integration-approval-plan.test.ts` against the declared optional `changeTargets` summary shape. The review verifies all-target display, exact bounded paths, task and backup-limit disclosure, malformed-list approval blocking, stale clearing, literal text rendering, syntax, focused DOM results, and owned diff/hash state. Maximum review corrections: 2. Only this review file is owned. No Electron, native helper, model, provider, or network process is run.

## Findings

A concrete cross-layer validation blocker remains.

The approval markup adds a dedicated hidden `approval-changes` section with an ordered target list and clear pre-execution backup wording. `renderApprovalPlan` clears and hides that section before reading a replacement plan, so read-only replacement, malformed replacement, missing plan, and preparation failure cannot retain stale paths.

The optional `changeTargets` value must be an array of at most 64 entries. Every entry must contain nonempty bounded `taskId`, `targetId`, and `relativePath` strings, a safe integer `maxBackupBytes` from 1 through 16 MiB, and a lowercase 64-character `rootContractDigest`. Any malformed entry throws the fixed Korean disclosure error; the surrounding prepare handler clears `pending`, clears the plan, keeps approval disabled, and publishes the error. An absent array remains compatible with legacy/read-only plans.

For each valid target the renderer creates an `li` and assigns `textContent` containing the complete bounded `relativePath`, task ID, and exact backup byte limit. It does not truncate the path through the generic 128-character summary helper. The 64-entry test includes a hostile HTML-looking 200-plus-character path and proves all 64 paths render literally with no `img` element, the final path remains present, and the exact `4096`-byte limit is visible. The malformed-target test proves approval remains disabled and stale list children are removed.

**Blocker:** the driver owner confirmed that trusted prepare emits `changeTargets` only for a nonempty 1..64 declaration set; absence means no declared file-change stages, and an explicitly supplied empty array is rejected. `renderApprovalPlan` instead accepts `changeTargets: []`, hides the disclosure, continues rendering, and the prepare handler enables approval. Concrete DOM reproduction: return the otherwise valid test summary with `changeTargets: []`; after submit, `#approval-changes` is hidden and `#approve.disabled` becomes `false`, rather than showing `변경 대상 목록을 확인할 수 없습니다.` and keeping approval disabled. This violates the agreed host summary shape and the requirement that malformed lists block approval. Require `length < 1 || length > 64` to fail, and add this case to the focused test.

All nonempty-entry fields otherwise match the agreed driver shape `{taskId,targetId,relativePath,maxBackupBytes,rootContractDigest}` and its bounds. The concurrent driver implementation had not yet published `changeTargets` in the shared `app/orchestration-driver.mjs` at review time, so this verdict does not claim actual host-to-renderer integration or native journal behavior.

## Verification

- Root-reported focused approval-plan suite: **11/11 passed**, exit 0, session `12948` / result chunk `d1d12d`.
- Independent `node --check app/renderer/renderer.js`: **passed**.
- Owned `git diff --check`: **passed**; Git emitted only its existing LF-to-CRLF working-copy warning.
- `app/renderer/index.html` SHA-256: `DA88AB481930349B19DF9879FBC2007377CCCF4561F7EBE265F747C210396457`.
- `app/renderer/renderer.js` SHA-256: `92092116DD583D3A0DC7B3A1906BBC52CDCC5780A9FF4BC7C25AB0B4A1CF10C8`.
- `daemon/test/integration-approval-plan.test.ts` SHA-256: `F3741675CB23D94982997F2F494EBE413993C65A4E88E1567A3CA37A7300BD8E`.

This verdict is limited to DOM approval disclosure and failure behavior. It is not actual Electron visual evidence, actual host integration, native snapshot/journal approval, execution authorization, or restore/CAS verification.
