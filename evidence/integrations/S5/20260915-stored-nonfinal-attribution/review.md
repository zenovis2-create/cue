# Independent stored non-final attribution review

## Verdict

PASS. The new regression closes the previously disclosed test precision gap. It proves that an exact, stored budget receipt which is estimated or actual-but-not-provider-final cannot substantiate a known final invoice partition. Product source is unchanged and this does not supply an authoritative production billing producer.

## Source and fixture review

`monetaryFixture` now accepts `final | estimated | nonfinal-actual`. For the two negative variants it uses the real budget manager's `observe` path to persist either:

- `kind='estimated'`, `provider_final=0`; or
- `kind='actual'`, `provider_final=0`.

The fixture then captures the real authoritative accounting snapshot. The hostile attribution references the exact stored receipt ID, revision, payload digest, attempt, request, handoff, and accounting snapshot digest. Before calling `prepare`, each case re-reads the budget receipt and proves its kind/finality and payload digest, then proves the snapshot points to that same receipt with `providerFinal=false`.

`createHandoffAccountingStore.prepare` rejects both cases with exact `handoff_accounting_billing`. The test compares SQLite `total_changes()` before and after and requires both `handoff_cost_attribution` and `evaluation_handoff_cost_projection` to remain at zero rows. The existing final-actual positive fixture remains the default. The older hostile case is accurately renamed to “absent billing receipt,” so it no longer implies stored non-final coverage.

The fixture deliberately relaxes unrelated orchestration lineage triggers to construct its synthetic run. This is an attribution-store regression and no provider or production qualification follows.

## Independent gate

From `daemon/`:

`npx --no-install vitest run test/integration-evaluation-measured-facts.test.ts test/integration-handoff-accounting.test.ts test/integration-evaluation-authoritative-accounting.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1`

Result: exit 0, 3 files and 30 tests passed. The two distinct cases appeared as:

- `stored estimated receipt cannot substantiate a final invoice partition`
- `stored nonfinal-actual receipt cannot substantiate a final invoice partition`

No build, provider, model, credential, local endpoint, native helper, network, or Electron action was used.

## Pins

- `daemon/test/integration-evaluation-measured-facts.test.ts`: `4ACCFCEF3C6B9F169CAEBB1E516A318B8E66A082B26E205850EE3D34C0287EBD`
- `daemon/src/evaluation/handoff-accounting.ts`: `F4AEFDFD192EF28F110F793EBD66D83A5715F2E51C65C393E484F71935CC8072`
