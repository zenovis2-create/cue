# S5-07 policy deployment/revert maker contract

## Done

Implement connected, durable monetary selection-policy deployment mechanics without claiming empirical qualification exists:

- migration `044_selection_policy_promotion.sql` installs an append-only transition ledger and a CAS deployment head whose active identity is validated against stored immutable policy snapshots and its latest transition;
- `selection/policy-promotion.ts` accepts promotion only from a trusted host resolver returning an exact canonical empirical qualification that binds predecessor/candidate policy identities plus dataset, holdout, metric, environment, account-limit and price-time evidence; the existing descriptive evaluation comparison is structurally rejected and no boolean eligibility shortcut exists;
- replay is exact/idempotent, conflicting or stale transitions write nothing, and revert restores only the exact active promotion's pinned predecessor;
- existing run-policy bindings remain unchanged;
- the generated JSON host keeps exact policy references pinned, while an explicit monetary deployment-channel reference is resolved again for each future `prepare` call so a new run observes the active head;
- focused fixtures label their qualification authority synthetic and establish only state-machine wiring, refusal, persistence and concurrency behavior, never a real positive qualification claim.

Changed-file hashes and raw focused test/build logs are recorded. Shared `ledger.ts` and asset-copy registration are supplied to root as exact requested edits and are not modified by this maker.

## Attempt cap

Three diagnosed correction passes. A failed pass must use a new evidence-backed hypothesis. Revert only this maker's regression if a measured gate worsens.

## Every pass

Run the focused policy-promotion test and dedicated generated-host deployment test after root registers migration/build assets. Run the existing generated JSON host test as a compatibility gate. Run `npm run build` only in the coordinated build slot. Inspect scoped diffs and changed-file hashes.

## Failure handoff

After three failed corrections, stop and report the exact failing assertion/type error, persisted state, attempted hypotheses and evidence paths to root. No provider, local-model, native, network or live execution is permitted.

## Claim limit

This unit does not close S5-07. A real qualified empirical comparison producer/verifier remains dependent on S5-05. Synthetic fixtures can exercise the trusted-authority boundary but cannot establish that a policy improved.
