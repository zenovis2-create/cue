# Integration documentation reconciliation 19

Date: 2026-09-13

Done contract before document edits: update only the four integration documents with accurate independently reviewed current-state blocks after the windowless-launch review is terminal. Preserve earlier actual failures and distinguish the newest actual failure, offline ACL lifecycle, and windowless patch evidence.

Correction cap: 2. Every pass checks exact review wording and counts, all local Markdown references with zero missing, SHA-256, and the scoped whitespace diff. A failed pass requires a concrete new hypothesis.

Boundaries retained: no native rerun after the windowless patch, no causal DLL claim, no permission/cleanup/qualification/registration proof, and no current full-suite or S7 snapshot claim. Broad S0-S7 and the `usageLimited` GOAL remain unfinished.

This documentation unit performs no tests, build, model/native/Electron calls, OS actions, or product-source changes.

## Applied reviewed evidence

- ACL lifecycle: [`../../S1/20260913-readonly-acl-lifecycle/review.md`](../../S1/20260913-readonly-acl-lifecycle/review.md) — 2 files 13/13 plus build PASS for bounded observation/abort/output/termination handling; five seconds is an observation trigger, not total return time.
- Latest actual: [`../../S1/20260913-readonly-pathext-gate/actual-review.md`](../../S1/20260913-readonly-pathext-gate/actual-review.md) — FAILED and closed after PID37904 creation with `0xC0000142`; no worker result or permission scenario. Bounded evidence is nonce/cleanup frame, PID death, restored root identity/SDDL, absent profile, empty runtime, and unchanged bytes.
- Windowless patch: [`../../S1/20260913-readonly-windowless-launch/review.md`](../../S1/20260913-readonly-windowless-launch/review.md) — exact one-line `CREATE_NO_WINDOW` addition, source/dist parity, 10/10 offline PASS. No native rerun or causal/DLL claim.

## Documentation gate

- Scoped whitespace gate: `git diff --check` over the four owned documents — PASS.
- Local Markdown reference audit: 351 references checked, 0 missing.
- SHA-256:
  - `docs/INTEGRATION_SPEC.md`: `D4A7F40B884FDA3FDAD6D6470E7D826D9A047D1B96EDFC5B5D5F5C720D614C01`
  - `docs/INTEGRATION_CHECKLIST.md`: `1C4B409ADC3244CD3C22C1F077D81F9B6F4DF535E48D2A8B347A8B615F83FE4A`
  - `docs/INTEGRATION_PROGRESS.md`: `CE280C43A977A0283CCC1155274826AE7E9367B43A5164C1EA2DB6A2F6F3859D`
  - `docs/integration/LOOP.md`: `F1DA22DD7FE9C792BA5437468115C4E8998042ACFBC0C1185E7E0C3882FD6993`

Previous actual failures remain historical; the latest actual failure is current. The previous full suite and S7 snapshot remain historical after source changes. No permission/qualification/registration proof, current full-suite green/static snapshot, or broad S0-S7 completion is claimed. The GOAL remains `usageLimited` and unfinished.
