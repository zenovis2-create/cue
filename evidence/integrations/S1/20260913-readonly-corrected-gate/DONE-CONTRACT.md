# Corrected-environment read-only gate done contract

Done for preflight means a new one-attempt gate has a frozen runner, test, client, unchanged production launcher, executable, and manifest; meaningful offline tests pass; and an independent reviewer approves the exact command and owned paths. This phase does not execute the gate.

If separately authorized after preflight, done for the actual attempt means exactly one native launcher call proves project read and runtime write success; create, overwrite, remove, rename, ACL mutation, sibling read/write, and controlled loopback fail with explicit access-denial evidence; the exact root identity and ACL are restored; the worker is dead; the AppContainer profile is absent; and bounded raw ACL, launcher, and profile subprocess receipts are durable on PASS or FAIL.

The gate owns `D:\Temp\User\Cue.ReadonlyVerifier.CorrectedGate1` and `evidence/integrations/S1/20260913-readonly-corrected-gate/actual-attempt1`. The maximum is one gate attempt and one native launcher call, with no retry. It invokes no model, provider, external network, credential, production edit, build, cleanup-recovery gate, or historical marker reset. Every implementation pass runs syntax, offline contract tests, manifest hash verification, and scoped diff check. Failure remains failure.
