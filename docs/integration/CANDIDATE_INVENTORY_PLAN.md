# Candidate inventory: next bounded UI unit

Status: bounded unit complete. [Independent review](../../evidence/integrations/S1/20260911-candidate-inventory-ui/review.md) recorded46 PASS/typecheck0 after correcting a false same-pair inference from V2 settings. The projection compares actual policy pairs and returns unknown for differing pairs. [Actual no-model Electron QA](../../evidence/integrations/S1/20260911-candidate-inventory-ui/actual-review.md) passed on final attempt2 within the original two-attempt cap; pre-correction evidence remains historical. This unit does not claim general tool support or measured mode optimization.

The next user-facing slice is a read-only list of candidates already registered by the host, their observed identity/compatibility status, and the configured mode/policy references. Reuse `orchestrationHost.catalog.snapshot()` and existing local policy/settings readers. Never populate this list by guessing the user's tool/model aliases.

## Contract

- Expose one exact read-only IPC operation through core/preload. It cannot install, authenticate, qualify, select, dispatch or mutate a candidate.
- Preserve the existing catalog kind and reason enums. Show recorded observation time separately from display time; reading an old record does not refresh its evidence.
- Do not equate catalog availability, mode selector availability, capability eligibility and execution authority. If current capability status cannot be derived from the existing protected host without new qualification, display unknown.
- Authentication must represent unknown/not-required distinctly from a verified configured state. Do not infer credentials from a model name or expose auth references, URLs, tokens or raw probe payloads.
- For an unavailable bootstrap, show its bounded reasons and unavailable inventory. Stored policy references may be shown as configuration, not as available execution candidates.
- Show that the current four local modes use the same fixed pair and have no measured ranking improvement. Exclude unresolved S0 aliases from actual candidate rows.

## Ownership and gates

One maker owns the host/core metadata projection; another may own the exact IPC/preload/renderer contract after the projection stabilizes. They must preserve the existing unavailable-host shape, authority boundaries and Stop ownership behavior.

Done requires focused catalog/selection/core/IPC tests, type/build checks, independent review and actual Electron list/unavailable/stale-response tests with no task execution or secret exposure. Record evidence before checking an S1/S2 UI item. A snapshot test is not real external CLI/model qualification.

Apply this unit only after the current regression source freeze ends. It is separate from the fresh Electron JSON gate and does not relax that gate's two-request limit or reuse historical qualification after source changes.
