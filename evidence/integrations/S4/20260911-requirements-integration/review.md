# S4 preparation and criteria UI — independent review

Date: 2026-09-11. Reviewer: native agent `transport_review`; source edits by parent and `admission_impl`.
Verdict: **PASS for the requirement-binding integration and criteria display**. This does not implement or approve requirement verdict execution.

## Independent checks

Current `npm run build` passed during the immediately preceding P5 regression check. No intervening source change was needed for the following command, run from `C:/Users/User/cue/daemon`:

```text
npx vitest run test/integration-driver.test.ts test/integration-driver-core.test.ts test/integration-approval-plan.test.ts test/integration-observation.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
22 pass, 4 files pass, exit 0
```

The underlying requirement contract unit was independently reviewed with its own 9 passing tests in the neighboring requirements review. No paid/live model or native visual test was performed by this reviewer.

## Review findings

No blocking defect found in the connected increment:

- The driver snapshots host preparation data, validates optional requirement contracts against the validated plan and host registered checker resolver, and exposes immutable normalized contracts plus digest in the pre-approval summary.
- Run-policy binding, budget initialization, plan installation and requirement binding occur in one transaction. The bound requirement digest is compared against the earlier validated digest; a registry change between the two validations fails and rolls back rather than binding unseen criteria.
- The driver uses a host-level checker resolver, not model-generated executable callbacks. Persisted-state checks include the requirement digest. Exact preparation replay returns the stored immutable summary; changing the original configuration or uninstalling the checker does not rewrite historical approved criteria.
- The core integration test demonstrates a requirement binding exists after `prepareGoal` and before approval. Execute still rejects before approval; unavailable capability evidence causes the real runtime to refuse launch afterward without falling back to the legacy executor. The driver test ends with `acceptance_unverified`, never accepted success.
- An absent optional requirement configuration yields a null digest and empty criteria list. The UI explicitly says `기준 미등록 · 최종 인수 미확인`. Optional configuration is backward compatibility, not acceptance evidence.
- Approval criteria show original text, requirement ID/kind, required versus optional designation, checker ID/revision, targets and parameter digest using textContent. Full valid contract limits fit the display: 256 requirements, text up to 16384 UTF-8 bytes, 32 checks each and 128 targets each. Since UTF-16 string length cannot exceed its UTF-8 byte length for this input, the 16384-character display bound does not silently truncate valid original text.
- Explicit omission markers handle out-of-contract oversized text/lists. Hostile markup stays literal, legacy/failed preparation clears the criteria nodes, and the existing observation/stop/completion qualifier regression remains passing.

## Reviewed SHA-256

| File | SHA-256 |
| --- | --- |
| `app/orchestration-driver.mjs` | `12E191A26C46E0013080CD94CB859CCC8E569204EF6487FAA66C569554650278` |
| `app/orchestration-driver.d.mts` | `9129A2C2B8AD5232F0C9FCAB51CFE0F7B39CEC741692234BB2CA72043ECBD590` |
| `daemon/test/integration-driver.test.ts` | `ADCFFEF0689C46A53B5CB7148FDD42FD212F3AB572CF7ABCFEF55D8966A403B7` |
| `daemon/test/integration-driver-core.test.ts` | `88AF7BCA6DD48BECC7564038C7945226E6BF9955B2DB1517AA3A6154CA3DD5BB` |
| `daemon/test/integration-approval-plan.test.ts` | `6C63044139D7C69F99F22B8CC670CD9E2394EB19F60877454112ECCDD489A640` |
| `app/renderer/index.html` | `1EA92B066E0CFEEA2DBF06E6378409F2CD0F46282A1EF15699E5DED01D2C698A` |
| `app/renderer/renderer.js` | `403DBBE90539D237355B1203B14C827C0544E9D629F36212B490E9FAAAA14E7B` |
| `app/renderer/styles.css` | `A4B91204C44B279CF9AD6018E7CC529E59B2A448330F8B94B11B0A5052DB3E93` |

## Limits

Checker registration snapshots describe the approved references, not currently installed executable identity or actual results. Parameter hashes and target IDs still need independently verified resolution at checker execution. Neither the visible contract nor completed plan steps justify passing requirements. Native Electron layout and full real-provider operation remain separate evidence. The current driver intentionally cannot declare final acceptance even when these optional contracts exist.

Only this review artifact was written by the reviewer. The previous S3 UI reviews retain their historical hashes; this artifact records the current connected S4 increment.
