# Independent review — wait process restart

## Completion criteria (declared before findings)

- A dangerous crash after the host effect and before acknowledgement is reproduced by terminating a real Node producer process.
- A fresh, distinct Node process reopens the same SQLite file and observes the exact durable claim.
- Restart does not resend the provider request or create a replacement writer while the predecessor outcome is uncertain.
- Process IDs/identity and persisted claim fields demonstrate actual process independence; mocks do not count as provider qualification.
- One source/contract audit and, after source freeze, one combined focused Vitest execution provide the evidence.

Attempt cap: 2 corrections for this bounded unit. Any failed pass requires a new hypothesis; no silent fixture revisions or repeated unchanged command.

Status: audit in progress; test gate intentionally held pending source freeze.

## Superseded maker handoff audit

The original maker exhausted its two-revision cap without reaching the child-ready boundary. Both builds exited 0; both focused gates exited 1. The retained failures are valid diagnostics, not passing evidence.

Source audit identifies two fixture/test contract errors:

1. The synthetic agent advertises `typedActivitySource: synthetic-fixture-v1` and `durableExecutionRef: synthetic-session-v1`, while the unchanged public driver admits an agent only with `host-codex-controller-v1` and `session-handle-v1`. The child therefore exits before emitting ready state.
2. The test expects `durableRef` in the reopened dispatch-claim DTO, but the durable claim API does not return that field. Exact durable identity must instead be read and compared from the persisted attempt identity while retaining the public replay assertion.

The parent assigned a separate, one-revision fixture repair with full handoff preimages. No product-source change was required or implied.

## Verdict

PASS. The repaired fixture/test pins and both full preimages match their manifests. The single independent frozen gate exited 0 with 5/5 files and 79/79 tests. Source inspection plus the passing assertions establish two distinct real Node PIDs, exact first-child termination, one durable claim before death, zero acknowledgement observations, fresh SQLite reopen, exact persisted attempt/identity/durable reference, zero second-process callback, and one unchanged first-process marker. See `logs/independent-final-audit.md` and the complete `logs/independent-combined-vitest.log`.

Scope: synthetic child-process lifecycle only; no provider qualification, model/native/Electron/network behavior, billing finality, or whole-product completion.
