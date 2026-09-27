# S3 handoff/activity correction 2 final independent review

Date: 2026-09-12  
Correction cap: 2 of 2, exhausted  
Verdict: **FINAL BLOCKED**  
Status: this final review supersedes the correction-1 BLOCKED review previously stored here.

## Scope and method

I treated `correction2.md` as an untrusted maker report and inspected the final contract, migration 031, handoff/activity store, orchestration store, runtime/driver, generated host, Codex executor/factory, UI projection, and focused tests. I ran the non-native build/typecheck/focused suite and direct hostile SQLite/API probes. No product, test, or documentation file was changed; this review is the only modified artifact.

## Final blocker: structurally valid fake handoff and artifact facts can still create a terminal attempt

Correction 2 rejects the correction-1 exact `{}` payload. With a current launch intent, non-null owned session identity, and clean same-attempt receipt in place, this statement returned `handoff exact lineage required`:

```sql
INSERT INTO orchestration_handoff
VALUES(
  'forged-empty','attempt','receipt',1,'identity','succeeded','clean',
  '4444444444444444444444444444444444444444444444444444444444444444',
  X'7B7D'
);
```

The new trigger checks JSON shape and equality with the relational columns, but it cannot verify `payload_sha256` or whether the artifact hash/length came from approved source bytes. The same probe changed only the payload to a structurally valid object and inserted a matching relational manifest:

```sql
INSERT INTO orchestration_handoff
VALUES(
  'forged-structured','attempt','receipt',1,'identity','succeeded','clean',
  '4444444444444444444444444444444444444444444444444444444444444444',
  CAST('{"schemaVersion":"cue-handoff-v1","handoffId":"forged-structured","attemptId":"attempt","receiptId":"receipt","receiptRevision":1,"identityId":"identity","outcome":"succeeded","cleanup":"clean","artifacts":[{"kind":"output","sourceRef":"fake-source","sha256":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","byteLength":999}]}' AS BLOB)
);

INSERT INTO orchestration_handoff_artifact
VALUES(
  'forged-structured',0,'attempt','output','fake-source',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',999
);

UPDATE orchestration_attempt
SET state='completed', cleanup_verified=1
WHERE attempt_id='attempt';
```

All three statements succeeded. The stored payload's actual SHA-256 is `a26973191752b61695afb14b928a9125eeb674300f195b8bd3e3dac974558522`, while the accepted row stores `4444444444444444444444444444444444444444444444444444444444444444`.

Exact observed result:

```json
{
  "empty":"handoff exact lineage required",
  "structured":"ACCEPTED",
  "terminal":"ACCEPTED",
  "validate":"handoff_integrity",
  "artifacts":[{
    "handoff_id":"forged-structured",
    "ordinal":0,
    "attempt_id":"attempt",
    "kind":"output",
    "source_ref":"fake-source",
    "sha256":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "byte_length":999
  }],
  "attempt":{"state":"completed","cleanup_verified":1},
  "fk":[]
}
```

The trusted public `validateTerminal` later rejected the row with `handoff_integrity`, and `store.ts:91-106` now invokes that validation when deriving readiness, so the checked readiness path blocks this forged attempt. The durable database nevertheless contains a false `completed` and `cleanup_verified=1` state with an FK-clean fabricated handoff. Any consumer reading terminal state directly can observe false completion. The UI query still derives `handoffStatus: 'verified'` from handoff row existence, so this row can be projected as completed with a verified handoff even though the public validator rejects it.

This violates the final contract's atomic terminal truth boundary. Relational equality proves that two submitted values agree with each other; it does not prove their bytes, hash, source authorization, or host observation.

Required disposition: the terminal authority consumed by every database/application/UI path must be a host-validated seal that cannot be created by merely inserting mutually consistent submitted values. The DB transition, readiness, and UI must share that validated authority. Because correction attempt 2 of 2 is exhausted, this review requests disposition rather than another maker mutation pass.

## Secondary unresolved duplicate-source API behavior

Correction 2 adds `UNIQUE(handoff_id,source_ref)` to the relational manifest, so a cross-kind duplicate fails during `commitHandoff`. However, `handoff-activity.ts:175-177` still deduplicates `${kind}\0${sourceRef}`. The public `prepareHandoff` API therefore still accepts two entries with one logical source when only `kind` differs, producing a branded prepared object that cannot later commit. The correction-1 exact probe remains applicable because this code is unchanged:

```json
{
  "accepted":true,
  "artifacts":[
    {"kind":"output","sourceRef":"same-source","sha256":"58100dc8fc06562ce3e578231dc948e083520ee49c4b4ee5a5a28bb4b4003feb","byteLength":10},
    {"kind":"artifact","sourceRef":"same-source","sha256":"58100dc8fc06562ce3e578231dc948e083520ee49c4b4ee5a5a28bb4b4003feb","byteLength":10}
  ]
}
```

The durable transaction fails closed, but the public preparation contract does not reject the duplicate at its advertised validation boundary. Deduplication should use canonical logical source/target identity independent of caller-controlled `kind`.

## Recheck of the other correction-1 blockers

### Generated child artifact membership: resolved at the component seam

`app/generated-json-host.mjs:102-108` now joins `orchestration_handoff_artifact` by producer attempt, `generated-output:<observationId>`, observation digest, recorded byte length, and actual blob length. `resolveHandoffSource` repeats the manifest match at lines 119-126 and then uses the generated-output store integrity read. The focused generated composition test confirms normal producer/checker handoffs and returns `null` after hostile manifest-hash mutation.

This fixes the correction-1 existence-only child query. It does not cure the final raw-SQL blocker because an attacker can submit a fabricated observation/manifest pair, and no DB hash function verifies those bytes.

### Codex common executor/factory: resolved at the non-native component seam

`createDefaultCodexCandidate` is production source and directly constructs `createCodexExecutor`. It declares `host-codex-controller-v1` typed activity and `session-handle-v1` durable reference capabilities. The executor maps controller tool/output/artifact/terminal events, emits heartbeat, emits explicit unknown token usage, uses the canonical host-supplied tool ID/revision rather than event labels, and returns `session:<backend session handle>`. The orchestration driver refuses agent candidates without those exact capability declarations.

The focused tests instantiate this factory with a synthetic backend. No real Codex process, controller lifecycle, provider, model, or product deployment entrypoint was executed, so only the component composition is established.

### Durable identity lineage: resolved at the session-handle component seam

`AdapterExecution` now carries `durableRef`; runtime forwards it only after launch returns a valid handle; the driver persists it instead of `null`. Migration 031 makes the column non-null and requires `session:<handle>` whose `session_handle.run_id` equals the orchestration attempt. Commit and terminal replay recheck that session ownership. Missing, null, and cross-attempt handles fail closed, including after reopen.

This proves persisted session-handle lineage in SQLite. Actual native identity/process lifecycle remains outside this non-native review.

### Correction-1 regressions: no source/test regression found

- Cross-attempt receipt/identity/handoff substitution remains rejected.
- Public raw `detail` activity remains rejected; legacy rows expose only `legacy-activity-unavailable`.
- New terminal handoffs remain nonempty.
- Public terminal replay recomputes payload and artifact hashes and rejects changed resolver bytes.
- Typed event shape/order/replay and late-write fences remain covered.
- Legacy handoff/UI states remain explicit.
- Pre-typed attempt-decision history remains `legacy-not-recorded` / `historical-explanation-only`; current typed decisions remain bound to the claim and one exact reservation without synthesizing historical authority.

## Independent gates

- `daemon: npm run build`: PASS.
- `daemon: npx --no-install tsc --project tsconfig.json --noEmit --pretty false`: PASS.
- Expanded 10-file suite: first independent run produced **9 files passed, 1 failed; 119/120 tests passed**. The only failure was `integration-orchestration.test.ts > independent connections atomically claim exactly once` with `database is locked`.
- Per reviewer direction, the exact failing test was run alone once and passed: **1/1**. A second full-suite run was not performed after the final raw-SQL blocker was confirmed. The maker's reported 120/120 remains maker evidence, not an independent green full-suite result.
- The exact `{}` plus fake-hash probe is rejected, but the stronger canonical-looking fake-hash/fake-artifact probe above succeeds and is the final blocker.
- The correction-1 independent source/deployed migration parity and fresh/pre-031 reopen/FK gates passed against the prior 031 bytes. Correction 2 maker reports the new source/deployed SHA-256 as `0e13b1b4d9e9483a807bfcc8d34bdd51c5434f6c2eb2734bedf7ef6bf6336233` and fresh/copied-pre031 reopen with empty FK checks. After the decisive final-cap blocker and explicit stop direction, I did not claim those correction-2 maker checks as independently rerun.

## Evidence boundary and dependent work

`p3c.test.ts` was not rerun; its prior native result is historical evidence only. No real model, provider, Codex/local-model execution, native/AppContainer helper, OS process cleanup/Stop lifecycle, Electron UI, network, or worktree creation/integration was performed or proven in correction 2.

S3 Unit 1 is not component-complete. Both checklist meaning statements at lines 121 and 122 remain open. S3 Unit 2, S4, S5, and any unit depending on this terminal/handoff authority must not start or claim completion while this final blocker remains unresolved.
