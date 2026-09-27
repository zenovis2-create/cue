# S3 handoff/activity independent-review correction contract

Date: 2026-09-12
Attempt: correction 1 of 2

Scope note: the parent authorized a minimal dependency extension to `daemon/src/selection/attempt-decision-store.ts` and its direct integration test. That store hard-coded a raw `detail` request at `engine-request/<attempt>`; removing public raw activity requires selection history to bind the typed request-digest fact to the current claim and one exact reservation. Pre-typed history remains authority-unavailable.

## Completion definition recorded before product edits

- Database and public APIs reject every cross-attempt handoff combination: handoff attempt, receipt attempt/outcome/revision, identity attempt, and launch intent must have exact lineage. The reviewer counterexample using attempt A with attempt B receipt or identity must fail in real SQLite, and attempt A must remain non-completed.
- `store.finish` independently rechecks persisted intent, identity, receipt bytes/outcome/revision, verified artifact bytes, and handoff lineage. Exact replay is accepted only after current persisted bytes and lineage revalidate.
- Fresh databases and databases created through migration 030 then upgraded through the unreleased 031 bytes pass close/reopen integrity and foreign-key checks. Source and deployed 031 bytes are identical.
- The default generated-JSON local host path and the Codex path bind their supported output/tool/artifact/usage/terminal facts to the runtime/driver activity sink. Unsupported facts remain explicit `unknown`; late callbacks cannot mutate terminal handoff state.
- New public activity writes accept only bounded typed facts. Legacy string-detail rows remain readable solely as `legacy-activity-unavailable` metadata and cannot expose or grant anything.
- Generated terminal handoff requires trusted resolution of the generated output/artifact bytes and exact source/digest binding. Empty-artifact handoffs cannot make a new launch-intent attempt consumable, and child readiness consumes the verified handoff lineage.
- UI projection explicitly reports legacy handoff/activity and unsupported facts without raw text, paths, secrets, or inferred identifiers.

## Attempt and gate contract

- Attempt cap: correction 1 is attempt 1 of at most 2.
- Every pass runs `npm run build`, the existing nine focused Vitest files plus all correction hostile tests, `npx --no-install tsc -p tsconfig.json --noEmit`, source/deployed migration byte parity, fresh/pre-031 close-reopen integrity and `foreign_key_check`, and scoped diff/whitespace checks.
- On failure, retry only with a new counterexample-backed hypothesis. Keep a correction only when the complete measured gate improves; roll back a regression. If correction 1 does not resolve every blocker, report the exact remaining counterexample before attempt 2.
- No model, native/provider, Electron, network, or worktree execution is authorized for this correction.

## Reviewer counterexamples received

- Cross-attempt receipt and identity substitution can currently be assembled into a handoff and then used to complete attempt A.
- Adapter-only event tests do not prove the default generated-JSON host or actual Codex host path persists typed activity.
- The public store still accepts legacy `detail:string` activity and therefore permits new arbitrary raw text rows.
- Clean verified completion can currently synthesize an empty artifact handoff instead of resolving the generated output used by a dependency.
- UI does not explicitly distinguish legacy handoff/activity unavailability or unsupported facts.
