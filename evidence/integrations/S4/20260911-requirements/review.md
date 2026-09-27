# S4 immutable requirement contracts — independent review

Date: 2026-09-11
Reviewer: native agent `transport_review`; implementation by `reuse_pure`.
Verdict: **PASS for the declarative pre-approval binding unit**. No blocking defect found in the reviewed scope. This unit does not produce acceptance verdicts or execute checkers.

## Independent evidence

Working directory `C:/Users/User/cue/daemon`:

```text
npm run build
exit 0
npx vitest run test/integration-requirements.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
9 pass, 1 test file pass, exit 0
```

| File | SHA-256 |
| --- | --- |
| `daemon/src/verification/requirements.ts` | `031BB9B5EFF64807908FA90F114D6EF840F3986EE25F3AB32D5CAA755DF172BF` |
| `daemon/migrations/013_requirement_contract.sql` | `B7349DCB8368EA31FBF68287E7C9A3113E6792572D4C3D5D9EE4D061242EE099` |
| `daemon/test/integration-requirements.test.ts` | `C7F37A4B65B4B18BED0EF6A249F631DA8EFAB75C238FCCC4334555C3CB2ED059` |

Migration 013 is referenced by current ledger opening and asset copying. Tests redundantly apply its idempotent SQL; reopening uses the normal ledger entry point. Driver approval summary integration and renderer are outside these three reviewed files.

## Inspected contract behavior

- Requirement IDs must exactly match the validated plan's approved requirement set. Missing, extra and duplicate IDs fail. Every contract, including an optional one, has nonempty checks; at least one requirement must be required.
- Code, research, document and external kinds are supported declaratively. Text is nonempty, byte-bounded and rejects prohibited control characters. IDs, parameter hashes and target lists are validated; record/array proxies and accessors are rejected without invoking supplied getters.
- Check limits are bounded per requirement and overall; target arrays and total serialized contract size are bounded. Sorting contracts, checks, targets and checker descriptors makes equivalent input order deterministic. The resulting nested values are frozen without mutating inputs.
- Initial validation requires the host resolver to return the exact checker ID/revision with compatible kinds. Conflicting descriptor results for one ID/revision fail. Extra command or callback fields are not accepted. No checker invocation, eval, shell command or model pass is provided here.
- Used registered descriptors are canonical snapshots included in the requirements digest. Historical read/exact replay validates that immutable snapshot rather than requiring the checker to remain installed. Tests demonstrate stable read and replay after host registry removal and database reopen.
- Binding verifies the persisted plan, parent run/envelope and immutable run-policy digest/revision. A first bind must occur before any accepted approval or orchestration attempt; both API checks inside an immediate transaction and a SQL insertion trigger enforce that boundary.
- Exact replay preserves the original binding time. Changed required flags or content cannot silently replace the contract because the canonical digest changes. UPDATE, DELETE and REPLACE are blocked at the binding table.
- Read recomputes and compares the canonical payload and all binding digests/lineage. Tests cover rollback with no residual binding, deliberate corruption detection after removing a trigger, and changed run linkage rejection.

## Important scope distinctions

`required:false` is a host-declared optional requirement in the initial pre-approval contract. It is not permission to downgrade an already bound requirement; replay changes fail. The initial UI/approval integration must show the required/optional designation and checker criteria before acceptance.

Historical registration snapshots preserve what was approved; they do not prove a checker is currently installed, unchanged, safe, independent or capable of executing. Before a future checker runs, host execution logic must resolve and verify its actual implementation and parameter/target bindings. A parameter digest alone is not a stored executable configuration or proof its referenced data exists.

Registration compatibility is not a result. No requirement is passed, user task completed, billing settled or execution authority granted by this unit. A subsequent evidence/acceptance layer must independently verify results and retain unknown/fail outcomes. The nine fixtures do not establish real model or external-state correctness.

No source implementation was edited by the reviewer; only this artifact was written.
