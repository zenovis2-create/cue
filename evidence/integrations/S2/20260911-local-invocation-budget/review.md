# Independent local invocation budget foundation review

Result: no actionable defect found in this bounded foundation. Independent focused suite **7 PASS**, 2026-09-11 21:12:57 local time, duration 1.21 seconds; additional isolated in-memory SQL probes confirmed four UPSERT refusals. No product edits, model calls or changes to historical canary databases.

Reviewed SHA-256:

- `daemon/src/local-invocation-budget.ts`: `00FFEE80AF0ECB180669CC6BF4CDCC82D94A0F36BE00CBC68E91848ACA7165F3`
- `daemon/migrations/021_local_invocation_budget.sql`: `C4488E0D5DF45BA5E48DEFBEFAE0A1FC53A1C8C9007FB7B262620B6BCAA1B50E`
- `daemon/test/integration-local-invocation-budget.test.ts`: `1C9F184C41C8FE9C1D5FB9238270760414A3B96AC90984D8782028F8F02AFCAF`

The schema and returned summary contain a nonmonetary invocation limit and immutable committed-intent rows. There is no currency, pricing estimate, billing finality, refund or claim that a provider actually received the request. Failed dispatches remain consumed after their transaction commits; rollback of the outer transaction leaves neither claim nor count. A new retry attempt consumes another immutable reservation, while exact historical replay does not.

Reservation requires an enclosing transaction, validates actual attempt/run/task/candidate ownership, matches plan and run envelope hashes, revalidates the canonical plan/digest, checks producer/verifier role and candidate membership, and requires the invocation policy revision to match the plan approval. New reservations require running attempts; historical exact replay remains valid after completion. Summaries derive counts from rows and revalidate canonical payloads, indexed identity fields, hashes and lineage rather than trusting a mutable counter.

Observed tests cover two separate worker database connections competing for a one-slot cap: exactly one claim/reservation commits and the competing claim rolls back. Existing monetary policy remains independent; additive SQL triggers reject monetary/local policy overlap in both insertion directions. Existing monetary update/delete/replace guards remain unchanged. New local tables refuse update/delete/replace. Separate SQL probes verified `ON CONFLICT ... DO NOTHING` and `DO UPDATE` also throw immutable errors for both tables. Hash tampering after deliberate trigger removal is rejected on read.

Command: `npx vitest run test/integration-local-invocation-budget.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from daemon, exit 0. Maker separately reports build/typecheck exit 0. Additional UPSERT probes used only a newly created in-memory ledger with migration 021 applied explicitly and no process/model launches.

Limits: this module cannot independently prove a caller is reserving in the same transaction that first created an attempt; actual engine claim/reserve composition is the next integration responsibility. Host policy source and limits remain trusted host inputs. Migration registration and engine/app integration were not included in this maker unit and were not present in the reviewed registration search; focused fixtures apply 021 explicitly. These passing foundation tests therefore do not prove active application enforcement, current-subject qualification or provider request counting.
