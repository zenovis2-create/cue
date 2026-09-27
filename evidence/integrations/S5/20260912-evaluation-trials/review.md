# Independent S5 evaluation-trial projection review — PASS

Scope reviewed: `daemon/src/evaluation/trials.ts`, migration 028 and its ledger/copy registration, plus the focused trial/observation/outcome tests. Product edits by this checker: 0.

## Checker completion contract

Done required one independent pass of the same three-file focused Vitest command, TypeScript no-emit, daemon build, source/dist migration SHA equality, source/dist registration inspection, and scoped whitespace/diff checks, with direct source review against every requested safety property. Attempt cap: 1 checker pass. Any test/type/build failure or material contract defect would be reported as **BLOCKED** without a product correction.

## Verdict and reviewed behavior

No blocker was found. The public write input is exactly the three own enumerable data fields `projectionId`, `enrollmentId`, and `observationId`. Proxy and accessor inputs are rejected without invoking traps/getters. Both `read` and `project` reject a closed database or caller-owned outer transaction before input inspection or SQL. A direct hostile-input probe observed `touched:0` and `sql:0` for accessor, proxy, and outer-transaction cases.

The reader selects an explicit fixed column list, bounds the payload projection, forces the projection primary-key index, validates byte size before JSON use, and reconstructs canonical bytes solely from validated stored enrollment and observation records. The slot lookup uses the schema's unique `(enrollment_id, observation_id)` index; an independent `EXPLAIN QUERY PLAN` reported `sqlite_autoindex_evaluation_trial_projection_2`. Enrollment ID/digest, observation ID/digest, run lineage, and the recorded outcome policy kind/revision/digest/mode are checked before a projection is accepted. Recomputed projection payload tampering and corrupted nested observation outcomes fail closed through the canonical observation validator and projection policy/lineage checks.

The projection is append-only. The schema has a primary-key unique index, a unique enrollment/observation slot, and UPDATE, DELETE, and conflicting INSERT/REPLACE triggers. Exact replay returns the canonical saved projection; projection-ID rebinding and slot reuse conflict. Reopen, oversized payload, trigger-protected SQL mutation, recomputed payload tamper, policy tamper, and observation nested-outcome corruption are exercised by the focused tests.

All projected metric, environment, account-limit, dataset, case, split, arm, and policy values come from the stored enrollment. Outcome comes only from the stored observation. The caller cannot inject quality, elapsed time, tool/model revisions, price, currency, or costs. Recorded `success`, `fail`, `cancelled`, and `unknown` are retained by the outcome/observation contract; unavailability remains explicit. The current `cue-run-outcome-v1` shape cannot supply trusted tool/model revisions, quality, elapsed time, price provenance, or the four cost components, so every current projection is deliberately `trial:null` with deterministic complete missing-evidence reasons. Nothing in this path calls comparison or creates comparability.

Static mutation review found only one write in `trials.ts`: INSERT into `evaluation_trial_projection`. It performs no execution, approval, policy, observation, enrollment, comparison, promotion, provider, model, native-helper, or network write. Migration 028 is registered in source and freshly built `dist/src/ledger.js`; the build copy is registered in `copy-assets.mjs`. The live schema exposed both unique indexes and all three immutability triggers.

## Independent gate evidence

- Focused Vitest: `3` files, `19` tests passed; exit 0.
- `npx --no-install tsc --noEmit -p tsconfig.json`: exit 0.
- `npm run build`: exit 0; emitted `dist/src/evaluation/trials.js` and copied migration 028.
- Migration source/dist SHA-256: both `77C62843A01D921AD8ED3BA66299BFEE3FCBBE698E98D4B065557C5000A7AC1D`.
- Scoped tracked `git diff --check`: exit 0. Supplemental `git diff --no-index --check` for the three untracked S5 source/test/migration files printed no whitespace errors; its expected per-file exit was 1 because each file differs from an empty input.
- Source SHA-256: `daemon/src/evaluation/trials.ts` `410B3B5508BA49E653A65E4708E6931CFAF3BBB013F537DB46593AAC3453ED12`.
- Test SHA-256: `daemon/test/integration-evaluation-trials.test.ts` `73321D4D97C91E152C50767B30DF74E07DA1A1E9EB561A9EAF741C097BF00CA1`.
- Fresh compiled JS SHA-256: `daemon/dist/src/evaluation/trials.js` `7A1A660E2430AB6902B65F987B4E96068A5E1FCCA78BCC36EC54F655A7A037A9`.
- Maker evidence SHA-256, used only as an identified artifact and not as verification authority: `implementation.md` `635259A105A3DED5F239452C609FC9C8C6D7F1A2A54161B40DAD7B957050CADD`.

## Limits

This PASS covers durable fail-closed projection from already stored enrollment and observation records. Enrollment still discloses `claimed-not-verified` input binding. The factory currently has no production caller outside its source and focused tests, and this review did not run Electron, a provider/model, native helpers, pricing, real measurements, comparison, policy promotion, or full S5 qualification. It does not establish that any existing run is comparable or that any selection policy improved.
