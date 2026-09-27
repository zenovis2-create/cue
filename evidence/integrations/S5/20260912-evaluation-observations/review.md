# Independent Sol review — PASS

Scope reviewed: durable evaluation observation revisions, migration 027, and the four Core evaluation methods. No product files were edited by this review.

The final source satisfies the contract: outcomes come from the internal `readRunOutcome` boundary; caller outcome/time fields are excluded; outer transactions are refused; the separate committed read is followed by an atomic revision CAS; and replay requires the original enrollment and prior revision both before reread and in the in-transaction race path. Stored reads validate canonical payload bytes, enrollment binding, revision/supersedes linkage, strict null/unavailable/recorded outcome variants, recorded source digest, and an exhaustive typed `PlanRole` map.

Coverage binds the cutoff observation to the exact dataset/arm/policy cohort and uses persisted append `sequence <= cutoff.sequence`, so equal or backwards host clocks do not admit later observations. It returns all current enrolled slots, including null and terminal non-success observations, discloses `current-enrollments-at-read`, separates expected cases from enrolled slots, and fails closed on row/output bounds. SQLite UPDATE, DELETE, REPLACE/conflicting insert, and unique revision constraints preserve immutability.

Core verifies configured canonical workspace ownership for enrollment/read/observe and every current coverage slot, supplies `Date.now()` internally, returns `evaluation_unavailable` for foreign access, and introduces no report, stop, execution, IPC, renderer, or trial state transition through these APIs. The dedicated Core fixture covers local shared-ledger use, foreign read/observe, mixed-cohort coverage denial, caller-clock rejection, outer-transaction rejection, exact replay, and no extra observation writes on denial. Existing strict readers perform bounded filesystem metadata checks; this review makes no filesystem-zero claim.

Independent final gate (post-stable build):

- Vitest: 5 files, 23 tests passed — outcome, enrollment, observation, dedicated evaluation Core, and existing Core composition.
- `npx tsc -p tsconfig.json --noEmit`: exit 0.
- `node --check app/core.mjs`: exit 0.
- Migration 027 source/dist SHA-256 match: `F82B4CED7B7376BCA5511233908CE5C0290F2D735DCDB7B174B68780846115FC`.
- Source hashes: observations `0C0FC97A29DD7EAE4EACD2DA9F85C554C2C7B6B1DD6E63A5AB68AEE0A194D588`; observation tests `68ED690A46233F2D066A0AD10B420F9AEE6D6E824F83C16781EEE650B0A99B73`; dedicated Core tests `527E34EB6296AAB384C9C5A5183D55343E18B4C4D95A66053BA8DD9F89DA1286`; Core `E70B4DD25CD5ED38F9D9B1E08C66708912A6218C635D3A262B067DF3D72230EC`.

The earlier 22-pass/1-fail checkpoint occurred before the latest source was compiled; it correctly exposed stale distributed replay behavior. After the maker rebuilt, the same Core assertion passed in the final independent gate.
