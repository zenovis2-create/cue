# A06 account identity maker result

Monetary preparation now requires and atomically persists a canonical opaque account identity for every planned candidate: credential-store reference, tool/source/subject/model identity, and run/plan/policy/envelope lineage. Exact persistence and current catalog equality are checked on every prepared-entry use, before runtime resolution and launch intent, after the runtime resolver callback, and immediately before launch. The trusted launch context carries only the opaque reference and binding digest. Local-invocation flows are exempt. This establishes credential identity continuity, not provider entitlement.

Migration 043 is packaged and startup verifies both tables, marker, and all immutable guards. New focused store tests cover replay, changed identity, immutability and payload corruption. Driver coverage proves full planned coverage and pre-launch drift refusal; the existing local suite proves exemption.

Pass 1 build passed; focused run was 74/75 because the new check preceded the established rolled-back-preparation error. Pass 2 restored assertion order and passed. Final build exit0 and 3 files/78 tests passed (`logs/final-build.log`, `logs/final-test.log`). Failed history remains in `logs/test1.log`. No external calls or real credentials were used.

Final SHA-256: migration `9310fb333fe354389586674f2d62d25dda3fcd539069b96e22b5c9cc5615401d`; store `389744dc066eb6c50ffe0f1824c5fc7e96c1f23da1449c9f85221c56e013b87e`; ledger `a8d9952d3c6665583960fef318f3cb417c093af5114555353b2be712659edbaa`; copier `4b1163499660d60c8970756de3ce86c4f4e8272b76427fc60066fcccc6de0108`; driver `4a261a3f2ad986c6f1c93a9a610b430ef39d5d65d8b699ea0a2314a718f7dec6`; driver test `9b545b6c72e852148a651951f9d3084036682f63e487db1c1f7bc11239e34973`; store test `8b3f13d6bef807be762a38934ba8b69af071a99563ce733b3907a1d711784f80`.

Outside owned files, `integration-driver-wait-crash-child.mjs` and `integration-generated-json-host.test.ts` still use null monetary fixture auth references and require their owners to add opaque fixture references. Maker evidence does not claim full A06 entitlement/provider binding closure.
