# Held recovery admission reproduction

The hypothesis is reproduced with the real recovery policy store and migrated ledger. A verified failed attempt with a valid terminal handoff, clean receipt, remaining budget, and `run.write_in_progress=0` received a `replan` decision while its `held_recovery` row remained `state='held'`, revision 0, and unsealed.

Command:

```text
npx vitest run daemon/test/integration-held-recovery-admission.test.ts
```

Result: 1 file, 1 test passed. This is a before-behavior reproduction; no product source changed and no native, model/provider, network, or external-effect action ran.

Evidence basis:

- `daemon/src/orchestration/recovery-policy.ts` SHA-256 `3D64515BD8A5AB56729034AB56293DA17845752451B3DBEC2A7E3E556BEAA63E`
- `daemon/src/held-recovery.ts` SHA-256 `2DC47F5387432907714504EC3E9653CCC31D905BFF75A2F37E14AFE462D9F2E2`
- focused test SHA-256 `8F614D50023A26037AB5CB57BBED16903E84C325179D3A711263416C8EC1EE45`

Cause: `recordDecision` derives `writerLeaseReleasable` solely from `run.write_in_progress` and never reads `held_recovery`. `createHeldRecovery` appends the held case without changing that run flag, so the otherwise verified recovery facts remain eligible.

Minimal proposed fix: inside the existing immediate `recordDecision` transaction, read and integrity-check the prior attempt's held case before decision issuance. An open `state='held'` case must fail closed with a stable recovery-admission error before writing `orchestration_recovery_decision`; only a properly sealed `eligible-for-disposition` case may proceed. A sealed `reconciled-stop` case must continue to stop/seal rather than authorize retry, switch, or replan. Focused negatives should cover corrupt held payload, open held, eligible disposition, reconciled stop, and the no-held legacy path.
