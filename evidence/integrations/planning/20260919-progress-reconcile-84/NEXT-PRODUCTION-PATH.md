# Remaining production path

Source discovery after the planning workflow implementation confirms a concrete remaining gap, not merely a missing live test:

- `app/main.mjs` does not supply `planningOrchestrationFactory`.
- `app/native-implementation-host.mjs` and `app/native-existing-file-authorities.mjs` fix task IDs, role/candidate mapping, scope, checker, targets, and instructions to their original implementation/verification contract.
- The planning host requires the isolated local model plus its qualified checker. Qwen remains off, and the new checker's full M1–M3 production qualification collector is explicitly unsupported; the diagnostic child test does not grant it eligibility.
- Tests opt the execution fixture into proposal support and remove fixture checker descriptors. This proves Core transport, not a proposal-aware production native host.

The next concrete production step is to give the native host the captured approved proposal at preparation, resolve its checker references through a protected registry, and bind each task's instruction, role, candidate pool, target scope, reservation, receipt and cleanup to the approved plan. Test a real Core/SQLite/Git path with more than the fixed two tasks, including exact source/instruction/scope/candidate refusal cases. Preserve independent completion verification.

After that, a protected startup configuration may select both factories on the same guarded ledger, installation generation and daemon lifecycle. Missing qualification remains unavailable. Adding a selector or a support flag alone does not implement the general execution path. Actual model/provider calls remain subject to the user's limits; the previous allowance is exhausted and Qwen must not be probed or restarted.
