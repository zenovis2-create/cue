# Integration documentation reconciliation 9

Date: 2026-09-12

Scope: documentation only. Reconcile newly reviewed S4 claim-clock and budget regression evidence, retain pending status for S4 Unit 2 and S5 accounting, and scope the S7 `24f8...` generation to its exact historical source snapshot.

Done contract: update only the four integration documents; preserve prior evidence and unrelated edits; make no product or test changes. At most two documentation passes. Each pass checks scoped content, relative links, referenced evidence, SHA-256, and whitespace.

No product test was rerun for this documentation-only unit.

Verification:

- Scoped content audit: PASS. Reviewed S4 facts are 17/17 plus pretest build and root 7-file 75/75; concurrent migration opening remains unproved.
- Status audit at the initial pass: S4 Unit 2 and S5 authoritative accounting were pending/BLOCKED. A later independent correction-2 review narrowly passed the isolated read-only S5 accounting component; S4 Unit 2 remains pending and no broad S4, S5, S7, or GOAL completion claim was added.
- S7 freshness audit: PASS. The `24f8...` generation remains checked only as an exact historical bounded snapshot and current-worktree recapture is required.
- Relative Markdown link audit: PASS.
- Scoped `git diff --check`: PASS. These documents are untracked in this worktree, so direct content/link/hash checks are the effective gate.

Final SHA-256:

```text
7afccf34c065dc7eb040f0521a282ab876282d211853d9788ac669abbc6cc3f5  docs/INTEGRATION_CHECKLIST.md
0ec36498f569247672308563f8b98931dc310dfccd98b98a00438eb053bacc22  docs/INTEGRATION_PROGRESS.md
f3847753c149a4178ee6e1387eb2066f44fcbde1d0b4d990ed3f445ccbe8a0f8  docs/INTEGRATION_SPEC.md
59f0145ba897345ec673ff0d8830bd48088b67767a7159b9445551d7814ed742  docs/integration/LOOP.md
```

## Later S5 accounting append

Evidence [`S5/20260912-authoritative-accounting/review-correction2.md`](../../S5/20260912-authoritative-accounting/review-correction2.md) independently passed the isolated read-only all-inventory accounting component: 6/6 focused tests, nonincremental typecheck and diff PASS, maker build 0. The documentation now checks only that component and preserves Core/migration034 quarantine, revised-role unclassified status, and the absence of real trials, measurements, or promotion.

The four hashes above describe the initial reconcile-9 pass and are superseded by the appended final hashes below.

```text
f1f0b08ada7c0af33eead706d2dc21ddf798038bddfedb6f90ee1178645de8b7  docs/INTEGRATION_CHECKLIST.md
f47fdb0bd8d9c98aca2a07c45bf474ab877a531e1debd5c51383485879adb57f  docs/INTEGRATION_PROGRESS.md
a00a3f121500e116a83ed1f1245db53dbdf98417574e7225ade64e28425dcb59  docs/INTEGRATION_SPEC.md
c2b7938b7aebb8ec112ab9f544e5575af7e6c5b8f3008049bf11c6a0c47d77de  docs/integration/LOOP.md
```

## Final QA append

The final documentation wrap additionally records:

- nine user-selected inactive/resolved-unqualified S0 identities;
- the S4 14-file 129/129 combined gate, disconnected Unit 2 groundwork, and the unimplemented handle-relative native next unit;
- S2 selection-explanation actual UI PASS with display-only Stop and viewport limits;
- S5 existing enrollment/observation/coverage UI attempt-2 PASS after root visual review and independent Sol artifact audit, while authoritative accounting remains disconnected;
- current S7 snapshot `55859c698ae86026376445a59ac852beef4be5852e6c3d6aa9e530148e69d26d` with 157 files, 711 import observations, 351 edges, independent source review, and six-view visual PASS.

Final relative-link audit and scoped whitespace check: PASS. No product source or test file was changed. No source/build freeze remains active; GOAL remains `usageLimited` and unfinished.

Final SHA-256:

```text
79c82e5169d4d3d2423f85a0070a0b3801bc44a5c8260a64f7abaa6be6cd8042  docs/INTEGRATION_CHECKLIST.md
fa883b08f50d0c8d4eca46bef737f76ef93c5c77938416390e7756f1ccfeec82  docs/INTEGRATION_PROGRESS.md
a940b98f8acddfddce8d6e10605bb48b9a63af665a703785e428eff2b684b00d  docs/INTEGRATION_SPEC.md
a523eb88b33f99c67308e97a8444d69bf667ff507945c592325484f359676ade  docs/integration/LOOP.md
```

## Definitive root audit

The [root final reconciliation review](root-review.md) is the definitive six-document scope, 340-link audit, and final hash record. Read-only source confirmation agrees with its wording correction: inventory/dependency bounds are checked before row fetch/materialization, while the serialized 2 MiB projection bound is checked after construction and before return. The corrected checklist SHA-256 is `1f1b4041c8942c4bb855a9e4e896ee6cd2c3a3851503ec2e2d494c9cb1a7ee50`.
