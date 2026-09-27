# Independent review — recovery wait matrix

## Completion criteria (declared before findings)

- Public retry, switch, and replan paths route replacement attempts through the durable wait/claim contract.
- No replacement starts while the predecessor's provider execution lifecycle is unsettled or its cleanup claim is unknown.
- Stored attempt/run identity, terminal reason, and routing remain exact across the public driver and Core seams.
- Fixture-only or mock execution is not reported as provider qualification.
- One source/contract audit and, after source freeze, one combined focused Vitest execution provide the evidence.

Attempt cap: 2 corrections for this bounded unit. Any failed pass requires a new hypothesis; no silent fixture revisions or repeated unchanged command.

Status: audit in progress; test gate intentionally held pending source freeze.

## Maker-evidence audit before independent gate

- Revision 1 is preserved as a failed diagnostic, but `logs/revision-1-vitest.txt` is a partial yielded transcript. It records `exit_code: RUNNING` and omits the terminal process exit and complete test totals. It must not be cited as a complete raw run or as evidence for exact revision-1 totals.
- Revision 2 records build exit 0 and a complete four-file result of 78/78 tests. This is maker evidence only and does not replace the required independent combined frozen gate.
- The saved `preimages/integration-driver.test.ts` is a text-oriented, LF-normalized preimage. Its diff is inspectable, but it is not proof of the original file's exact bytes and must not be described as a full byte preimage.
- These evidence limitations do not change the source-contract finding, but they narrow any provenance claim to the recorded normalized diff plus final source pin.

## Verdict

PASS. Final test pin `0356a0b34f3220c9e190946a067b1d263f3c5aa690767027974c9e4fed3654cd` and unchanged driver pin `79d44e00ef70e9d28acfe54a71fbcee5ebc2bdd39198141d65bf35b511076cdf` match the audited source. The single independent frozen combined gate exited 0 with 5/5 files and 79/79 tests, including retry/switch/replan replacement routing, exact wait identity/content, failed-predecessor rejection, and reopen no-resend. Complete raw output is retained at `../20260914-wait-process-restart/logs/independent-combined-vitest.log` with SHA-256 `ba56296376da5acb2ebe1f942b5efe92d91018f0ed40b189c3210de4297a0946`.

Scope: deterministic public-driver/store contract. The synthetic fixtures do not qualify any provider or native runtime. Revision-1 and normalized-preimage limitations above remain part of this verdict.
