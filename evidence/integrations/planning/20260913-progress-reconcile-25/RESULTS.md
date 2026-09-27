# Integration documentation reconciliation 25

Date: 2026-09-13

Done contract before document edits: update only the four integration documents after independent collector review and ABI probe evidence are terminal. Record the SDK correction and offline collector component separately from historical plans and live WFP/network evidence.

Correction cap: 2. Every pass checks exact review wording and counts, all local Markdown references with zero missing, SHA-256, and the scoped whitespace diff. A failed pass requires a concrete new hypothesis.

Boundaries retained: the prior Subscribe3/Event3 plan remains historical and is explicitly corrected to the reviewed Windows-1607 Subscribe2/CALLBACK2 with Event3/Header3 contract. Collector `captured|unknown` output is raw scoped diagnostic only. Before-resume subscription, exclusive job-through-death binding, live query/subscription, worker/network denial, policy/elevation, identity, qualification, and acceptance remain unproved. The earlier access-denied query remains blocked. Current S7 `097ef304...` remains valid for unchanged app/daemon source; the full suite remains historical. Broad S0-S7 and the `usageLimited` GOAL remain unfinished.

This documentation unit performs no tests, build, query/subscription, model/native/Electron calls, OS changes, or product-source changes.

## Reviewed update

- Independent collector review: [`S1/20260913-readonly-wfp-collector/review.md`](../../S1/20260913-readonly-wfp-collector/review.md), SHA-256 `26CFF19B352C9B4D5E3AAF2E932F4D9B5000D839284DF8113C9AAE632F76D00E`.
- The reviewed x64 collector passed 12/12 compiled-C# injected-native tests and SDK layout comparison. It corrects the historical Subscribe3/Event3 plan to `FwpmNetEventSubscribe2`/`FWPM_NET_EVENT_CALLBACK2` with Event3/Header3.
- The component returns only bounded raw `captured|unknown` diagnostic data. The access-denied query prevented subscribe; no live query, subscription, helper worker, before-resume/job-through-death bridge, network-denial proof, policy/elevation, identity, or qualification claim was added.
- The pure synthetic matcher remains separate. App/daemon source did not change, so the current S7 `097ef304...` static snapshot remains current; the full regression remains historical and the `usageLimited` GOAL remains unfinished.

## Documentation gate

- Scoped diff whitespace check: PASS.
- Local Markdown references across the four owned documents: 356 checked, 0 missing.
- `docs/INTEGRATION_SPEC.md`: `394A13D09C881F26EF230030DFBE700FAE2DA083118DE3547D3FC2BE4693D32C`
- `docs/INTEGRATION_CHECKLIST.md`: `5897CF79B1CB5208390A84180F6910AF9DBD4BF58034AD80ABDF92F625B0911A`
- `docs/INTEGRATION_PROGRESS.md`: `DED519859D1881C2DB36E77950C96089CA089621015353AAB6404653F403E663`
- `docs/integration/LOOP.md`: `8193A94D108B5DA2873E21C944733CC308EAED92C59F6FF7429C979E387DBC76`
