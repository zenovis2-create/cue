# Integration documentation reconciliation 36

Date: 2026-09-13

## Reviewed evidence

- [Automatic-approved recovery review](../../S4/20260913-automatic-recovery/review.md), SHA-256 `F02200163E2D7AF048E825815F56D7FF80CAE7A0543AB1F8FFDAF40839A7680C`: bounded driver/backend PASS, four files and61/61 tests. It verifies immutable `manual|automatic-approved`, default manual, retry/requirements/trusted-host prerequisites, shared receipt-bound decision authority, approved retry/switch/quota, sealed stop, explicit-plan deferred replan, reentrancy/callback fences, and the original absolute deadline on real SQLite with injected runtime.
- [Root build receipt](../../S4/20260913-automatic-recovery/build.json), SHA-256 `BF901F2A8FB5F130FF378D5E05771FC1DA81D554BBFD40139701DA7D8AFA04EA`, records exit0. [Aggregate result](../../S4/20260913-automatic-recovery/RESULT.md), SHA-256 `040F0ED7BF5224ACD205086C5D3CAF0DFA8AEDAF41B922D8DAF72F340DE6F64A`, preserves the earlier58/59 and60/61 failures and restored61/61 deadline fixture.

The default generated host lacks trusted recovery callbacks, so default automatic recovery is not enabled. Replan does not fabricate a plan and remains blocked until explicit validated public recovery. No native/WFP/model/provider/billing/network/UI/live workflow ran, and no automatic qualification or broad S4 completion follows. The prior WFP smoke remains FAILED/CLOSED and consumed. Generation `5454b1...` and the full suite remain historical. The `usageLimited` GOAL remains unfinished. The earlier document scores6/70 predate final amendments and are not current readiness evidence.

## Documentation gate

- [Done contract](DONE-CONTRACT.md), SHA-256 `F68CCD5E315C344F95885364A79BF903B6FC513FD92221E98B91AC6D494C7ABC`.
- Scoped whitespace diff: PASS.
- Four-document local Markdown references:389 checked,0 missing.
- `docs/INTEGRATION_SPEC.md`: `F5E0AE7D1EF0696934B9614E051FEF742DBD2DE40DEE2605DBDD529C8BC33746`
- `docs/INTEGRATION_CHECKLIST.md`: `BC5E9CE933872C7E813C762AF7B7B20B035159445433B5CF28FFAEE976DAC4CA`
- `docs/INTEGRATION_PROGRESS.md`: `49BC90056FE047671F822EF0E6497B5218CA266516EB86BAF2F4A26D33972869`
- `docs/integration/LOOP.md`: `EC6D6018E34811EAC29A2BCF6ED6CE965E6D9E1451ACCC17FC0441161F02995E`
