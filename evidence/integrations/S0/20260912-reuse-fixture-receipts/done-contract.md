# Done contract — reuse fixture receipts

Done means one offline receipt system verifies R-01 through R-06 with, for each R-ID: command, exit code, duration, current implementation SHA-256, a distinct canonical input fixture SHA-256, result/output SHA-256, and an explicit no-drift result. Pure functions keep lifecycle `N/A`. R-01/R-03 revalidate and reference the historical loopback receipt bytes/hash without rerunning loopback or network activity. R-02 records separate synthetic Claude launch/transcript input and result hashes. R-04 role, R-05 usage, and R-06 validator-boundary inputs and normalized results are deterministic separate artifacts; R-06 has its own exact-guard cases.

No external, network, CLI, model, native, Electron, install, or download operation is allowed. Attempt cap: 2. Every pass runs the related pure tests, the receipt hash/drift verifier against fresh temporary output and checked-in expected bytes, and target-only diff plus whitespace checks. If a pass fails, record a new hypothesis before retrying; after two attempts, hand the remaining failure to the human reviewer.

Completion commands:

```text
node --test scripts/reuse/claude-launch-spec.test.mjs scripts/reuse/role-contract.test.mjs scripts/reuse/usage-normalization.test.mjs scripts/reuse/reuse-fixture-receipts.test.mjs
node scripts/reuse/reuse-fixture-receipts.mjs --verify evidence/integrations/S0/20260912-reuse-fixture-receipts
git diff --check -- scripts/reuse evidence/integrations/S0/20260912-reuse-fixture-receipts
git status --short -- scripts/reuse evidence/integrations/S0/20260912-reuse-fixture-receipts
```

The checked-in expected receipt and generated result artifacts must match a fresh temporary generation byte-for-byte and by SHA-256. This implementation evidence does not check checklist line 15 and does not self-approve its sufficiency.
