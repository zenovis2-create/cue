# Run staging authority reopen correction review

Status: **CLEAR**

This review is separate from the scoped Build 6 staging-authority review. It covers the Build 7 correction for ordinary and monetary driver reopen after the new append-only `run_staging_authority` record was introduced.

## Finding and correction

Build 6 unconditionally inserted `run_staging_authority` during every `prepare()`. Exact default and monetary reopen therefore hit the immutable insert trigger. The broad gate exposed two failures out of 80 ordinary driver/core cases.

Build 7 first reads the existing row. It reconstructs the canonical payload using the persisted `created_at_ms`, then compares all 15 scalar fields, the payload SHA-256, Buffer type, and exact payload bytes. An exact row is reused without an INSERT. Any enabled/disabled state, envelope, plan, policy, factory, publication root/native identity, base commit, clean snapshot, target-root contract digest, timestamp, hash, or payload mismatch refuses. If the row is absent after approval, preparation refuses instead of retrofitting authority. The SQL update/delete/replace guards remain unchanged.

The enabled/disabled preapproval model still prevents an ordinary run from acquiring sibling-root execution authority later. Factory drift refuses before claim, lease, create, or launch. Target authority remains bound to the exact immutable `change_root_contract.payload_sha256`, which itself commits the full target set. Disabled local runs reuse their local-policy-bound authority; local execution staging remains unsupported.

## Evidence

- Root-coordinated Build 7: exit 0.
- Broad raw union: 9 files, 129/129 tests passed. This includes the two formerly failing exact default and monetary reopen cases, staging publication cases, local driver/policy cases, and compiled migration reopen.
- Required source gate: 7 files, 58/58 tests passed.
- Current graph digest: `e09c32b4df353d395c9098fd46b557c771b628cad87fc7fdd6aaf862a981e011`.
- Driver SHA-256: `dbab79d0ad1e0cfeb373fc6b40a89d5436374897e26ed0bcbdbab0230c2ce8a6`.
- Ordinary driver test SHA-256: `35c9a9acab6afb0a2e012e81f1cdc26b1fd058778dc0ecb8cd242a8d5215c711`.
- Staging publication test SHA-256: `44d70dd15436855b8d0e8bd8c888c9d8eac8ce2a89e82717f1b97bca3b203ec5`.
- Gate log: `evidence/integrations/planning/20260915-progress-reconcile-69/reopen-correction-gates.log`.

No live provider, local port 8085, production Git-worktree factory, or production Windows qualification claim is part of this correction review.
