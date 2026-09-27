# Independent review: account execution binding

Date: 2026-09-15
Result: PASS for the offline account-binding predecessor; A06 remains open for real account authority.

## Findings

- Preparation resolves every candidate in the accepted initial plan and stores an immutable canonical binding to the run, candidate, opaque `authReference`, tool/source, measured subject, model and endpoint, plan, policy, and envelope. Local orchestration is explicitly exempt.
- The store accepts only descriptor-safe exact plain data and validates the complete batch before writing. A nested transaction/savepoint prevents partial extension when an outer caller catches a conflict.
- Migration 043 checks the payload digest with the registered deterministic `cue_sha256` function, ties payload run/candidate scalars and plan/policy/envelope lineage to existing rows, and refuses inserts after approval or an attempt. Reads independently verify the canonical payload, digest, and selected SQL scalars.
- Preparation replay requires the complete exact candidate set. Activation, persisted-entry reads, candidate resolution, launch intent, and launch recheck catalog availability and every bound identity field. Endpoint drift is covered separately from model and credential drift.
- Launch performs its final account assertion after host callbacks and deadline/expiry checks. The opaque reference and binding digest reach the adapter in a frozen context. The driver preserves that exact enriched object for ordinary cleanup and optional failed-start cleanup; it does not add an absent optional cleanup hook.
- Replanning remains fail-closed against the original immutable approved identity set. The summary and account binding retain the original accepted plan, so recovery cannot silently authorize a new account identity.

## Independent verification

- `npm run build` in `daemon`: exit 0.
- Combined gate: exit 0; 10 files passed, 155 tests passed, duration 47.03 s. Suites were account binding, orchestration driver, local driver, generated JSON host, real restart, driver Core, authoritative accounting, measured facts, evaluation outcome, and evaluation.
- Compiled migration smoke: exit 0. A fresh ledger contained exactly six account objects (two tables and four triggers), exact reopen retained the v1 marker, and a one-table partial schema failed with `account_identity_migration_partial`.
- No provider, credential-store, model, native helper, Electron, network, or local-model call was made.

## Reviewed source pins

- `daemon/src/orchestration/account-binding.ts` — `809958a2a3a906525d809415a2dbc90a80a01f6f4f609bfc033994f911f233d7`
- `daemon/migrations/043_account_identity.sql` — `79bc548a18ccaf5d18b34b3bdadfa6916e98e1b13a2d59a0433a28f1c768f235`
- `daemon/dist/migrations/043_account_identity.sql` — `79bc548a18ccaf5d18b34b3bdadfa6916e98e1b13a2d59a0433a28f1c768f235`
- `daemon/src/ledger.ts` — `6e1af66b7b7654e190df8439544a4037b9b751cabbb2297b1b834dd9d645fe03`
- `daemon/scripts/copy-assets.mjs` — `4b1163499660d60c8970756de3ce86c4f4e8272b76427fc60066fcccc6de0108`
- `app/orchestration-driver.mjs` — `1d70715164ddd49773655819193ed53f4f7a4ec7ce57e3190521bd7bf2e213ed`
- `app/orchestration-driver.d.mts` — `b7bd7e9d1692b3b8ee059959f16812948a77e698256fc2390c2f837230d991f8`
- `daemon/src/integration-runtime.ts` — `f17747c5be244e951d48c722796108bbb60c0f3dc40f7cfce5b287a054dc5b03`
- `daemon/test/integration-account-binding.test.ts` — `d8e9ec374c9465c67076fc0f565bb4706587f59cb11c7c8d0be2c4e8fdeae0d0`
- `daemon/test/integration-driver.test.ts` — `35c9a9acab6afb0a2e012e81f1cdc26b1fd058778dc0ecb8cd242a8d5215c711`
- `daemon/test/integration-generated-json-host.test.ts` — `07d444c5fda482bd0d316c92f86b284f2676330839ccbef237de1db8a773a62d`
- `daemon/test/fixtures/integration-driver-wait-crash-child.mjs` — `2b57e43fbb76327f8165d8708b58f09acb56b519fa9e2b71289ef4c4e0a263b9`
- `daemon/test/integration-driver-core.test.ts` — `3afea5c569d6914af0da002bcb07da7dab70770daa8e7dd3dc80bfccbee3336a`

## Limitations

This unit proves an offline refusal and lineage boundary around an opaque host credential reference. It does not prove that the reference belongs to the intended real principal, that the credential store resolves it, that the provider grants the required entitlement, or that any real adapter consumes it correctly. Those live/account-authority conditions keep A06 open. Migration 043 is a candidate in the current workspace rather than evidence of deployment to a shipped installation.
