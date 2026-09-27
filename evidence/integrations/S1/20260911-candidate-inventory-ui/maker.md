Done: new candidate inventory core/IPC/DOM focused tests, existing catalog/selection/P11/setup race tests, npm run build exit0. Maximum two corrections; every pass runs affected focused tests then final build/regressions. No live model/qualification/auth operations. Independent review and actual Electron QA separate. Source preimage recorded before edits.

## Maker result

- Core candidateInventory reads the existing protected catalog snapshot and local settings reader. Output omits aliases, model bindings, endpoints, auth references, sourceVersion/raw payloads. URL-like IDs are redacted. Kinds, reason enums and observedAt retained. Authentication and capability eligibility explicitly unknown; inventory never grants execution authority.
- Available means catalog present, row catalogAvailable means catalog prerequisites only. Selection availability is separate. Unavailable bootstrap reasons retained with no guessed rows. Saved local v2 policy references remain configuration even when host unavailable; four fixed-pair modes are unmeasured.
- Exact read-only IPC/preload, escaped DOM text, independent refresh generation drops late replies, narrow long-ID wrapping. No Stop/activeExecution state changes. Product defaults do not create runtime qualification.
- Initial build0; focused5PASS1FAIL from minimal test host missing runtime.evidence. One fixture correction supplied unresolved evidence reader (no capability PASS). No product relaxation. Final build0, 7files44PASS in8.95s:

```powershell
cd daemon
npx vitest run test/integration-candidate-inventory-ui.test.ts test/p11-electron-surface.test.ts test/integration-catalog.test.ts test/integration-selection.test.ts test/integration-local-json-setup-ui.test.ts test/integration-retrospective-ui.test.ts test/integration-approval-plan.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1
npm run build
```

- New core fixtures verify zero task/session/approval creation, frozen projection, no secret sentinel leakage, unchanged stale observation, setup policy references without available inventory. New IPC rejects accessor/proxy/extra fields and untrusted sender. DOM fixture verifies inert hostile string and late reply discard.
- Actual no-model Electron QA and independent source review are separate pending gates. This maker record is not runtime qualification or complete layout proof.

## Independent finding correction: policy pair truth

- Reviewer found V2 settings can reference different producer/checker pairs; version alone did not prove four modes share one pair. Preserved prior source hashes and gate above.
- Core now reads all four immutable local policy revisions with the existing reader, verifies reference digests and compares exact producer/checker IDs. Any unequal pairs display unknown. Added actual protected saveLocalHostSettings with a different speed pair regression; unavailable catalog remains empty.
- Correction gate npm run build exit0; integration-candidate-inventory-ui + integration-local-host-settings + integration-local-selection-policy:20PASS /3files /2.19s. No live calls. Current correction hashes separate policy-correction-hashes.json.
