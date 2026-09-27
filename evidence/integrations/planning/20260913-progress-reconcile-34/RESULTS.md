# Integration documentation reconciliation 34

Date: 2026-09-13

## Reviewed evidence

- [Recovery claim-limits review](../../S4/20260913-recovery-claim-limits/review.md), SHA-256 `0ADC16986F37F564B5BE6242C0A4ED8960C6C58AF41AEB07E20710651FACF680`: test-only PASS, three files and21/21 tests. Valid decision/revision claims reject deadline equality, cumulative attempt exhaustion, and a final authorization callback that advances the trusted clock, with zero replacement attempt or recovery activation. An otherwise valid in-limit revised claim remains admissible.
- [Root typecheck receipt](../../S4/20260913-recovery-claim-limits/typecheck.json), SHA-256 `8D70D549ED31D6CD38CD5494DD70949403985022885BC61C22E1CB763B20CD4C`, records exit0.
- The suspected production bypass is refuted for valid store-created recovery scopes. Mandatory retry-contract presence and exact scope equality are source-inspected, not a separately exercised negative runtime case. The21 cases overlap older focused suites and are not added to prior totals.

No production source changed. Monetary budget exhaustion, full driver dispatch, execution preparation, live recovery, native/WFP/model/provider activity, and broad S4 completion remain open. Generation `5454b1...` and the full suite remain historical; the consumed WFP smoke remains FAILED/CLOSED. The `usageLimited` GOAL remains unfinished.

## Documentation gate

- [Done contract](DONE-CONTRACT.md), SHA-256 `519B3C763D817BDE88A79024308A87A4413D01662A4832383B2767A8339B3A12`.
- Scoped whitespace diff: PASS.
- Four-document local Markdown references:380 checked,0 missing.
- `docs/INTEGRATION_SPEC.md`: `51846088A4ECC3192733DC138EBF2C5B3D2E4060367977DC6D894BA38B300F10`
- `docs/INTEGRATION_CHECKLIST.md`: `A09A40B9DD991B658A4791FB4EBAB820B4F57867CF3B651D82754BE99116E502`
- `docs/INTEGRATION_PROGRESS.md`: `C3F6ACE1A088928242D183C223117D2A434DCE2F55E0F923FCD8EA00D266098E`
- `docs/integration/LOOP.md`: `7A79C5E2C23C7BB4A5D822171627479E110DD6C832EFEFC248CE229A1E442F80`
