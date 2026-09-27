Done gate: npx vitest run test/integration-model-control-bundle.test.ts test/integration-goal-proposal-checker-client.test.ts --reporter=verbose (daemon cwd), exit 0.
Attempt cap: two edit/test passes per defect.
Every pass: targeted gate, inspect native launcher result, inspect hash-pin and cleanup observations.
Failure: revise one hypothesis, rerun; then report blocker to root.
Exact preimages captured before edits:
daemon/src/model-control-bundle.ts SHA256 28539C343C6F5790C9088249061A3F349C3251022D4BBC10AC97B1A1BE91EDF1
daemon/src/model-only-launch.ps1 SHA256 83142D09009418737961FB6D1D0456714A940871242FD566D935AD456FEACF6D
daemon/test/integration-model-control-bundle.test.ts SHA256 97D0883F8C2770B17E14E00D29E9F0FEDDBF1F3DCEE04F30C25DF17A3521A3D6
Addendum done gate: npx vitest run test/integration-model-qualification.test.ts test/integration-fixed-model-qualification.test.ts --reporter=verbose (daemon cwd), exit 0.
Attempt cap: two edit/test passes per defect.
Every pass: targeted gate, inspect goal diagnostic boundary and fixture eligibility.
Failure: revise hypothesis once, then report blocker.
Exact addendum preimages before edits:
daemon/src/model-qualification.ts SHA256 AEDA80F84AE65DE5A63EBE39C7A38CE83E123B4A028671D5DD68246ACE3E9FE0
daemon/test/integration-model-qualification.test.ts SHA256 637C3A5CA319A0792D53F049C5C52878C92E0F5A8BD96AE847980C47A535EAA9
daemon/test/integration-fixed-model-qualification.test.ts SHA256 30E031B43FA870B69A2EF4189C9CFCA11A3446FA17A7D62644BB2EA4F40A321B
