# Checker candidate kind — independent review

2026-09-11. Reviewer contracts_review; maker root. PASS, no blocking findings. No product edits or live calls. Configured model unchanged; no runtime usage-limit error occurred.

Done: read candidate identity/role/admission paths, typecheck and focused tests exit0, record current hashes. Correction cap2, used0. One evidence write then readback/hash.

Independent gates (cwd daemon):

- npx --no-install tsc -p tsconfig.json --noEmit — exit0. A preceding read in the same tool command used an incorrect doubled daemon path and failed; it was separately corrected. The typecheck itself completed successfully and is not inferred from that read.
- npx --no-install vitest run test/integration-catalog.test.ts test/integration-runtime-contract.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1 — exit0, 27 tests/2files PASS, 19:11:11, 532ms.
- npx --no-install vitest run test/capability-admission.test.ts --reporter=dot --fileParallelism=false --maxWorkers=1 — exit0, 8 tests PASS, 19:11:32, 214ms.

Catalog recognizes checker as a distinct kind and requires null model binding. Expected-kind lookup cannot silently reinterpret checker as model or agent. Existing alias collisions, schema, source age and subject drift semantics remain.

Runtime only permits recognized agent/model/checker kinds. Non-agent implementation execution is rejected before launch even if supportedRoles advertises it. Checker model-role execution still resolves fresh host subject/evidence and requires the unchanged M1/M2/M3 admission; any missing M probe or subject drift rejects. No WRITE_PROBES requirement is removed from implementation. Cancellation/late-start/cleanup behavior is unchanged.

This is type/contract support, not actual checker qualification, semantic correctness, default host activation or live execution. Tests use synthetic admission evidence; no fixture eligibility is published.

Current SHA256:
- daemon/src/integration-catalog.ts : 04EBCA37B010AA0C89DF0F848533ABAAF8685F6EB9DEE18E75B38810F0963A14
- daemon/src/integration-runtime.ts : 27331A2FA59209943371D5F0707AFB5C8875D06DF755204101A9D58845227590
- daemon/src/capability-admission.ts : DA9073981F0EBC5FF1F0D1CCA2F81022D2163DA0524B521AA0C47D17D8BE8530
- daemon/test/integration-catalog.test.ts : 94407842F85C9E8623CC2246D3D7000EF2ED6122DE2469C5C77F18403872ED6A
- daemon/test/integration-runtime-contract.test.ts : F44E9D1EA82E4343C1C3414E877953E9076315DC371C6A4F0C8B80E5D473D646
- daemon/test/capability-admission.test.ts : 544E2EFD07075F34756619ED0F56DDE463CCA557C5933EEF57EBE5F52CEA795C
