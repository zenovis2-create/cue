# Installed protocol observation result

2026-09-12. Evidence only; product source/docs/manifest pins unchanged. Root's DONE-CONTRACT and initial stable generation remain original evidence. This worker generated experimental schemas once because Cue opts into experimentalApi and uses fields absent from stable parameter properties. Exact recorded codex.ps1 wrapper, offline generate-json-schema, exit0/696.48ms; stdout/stderr and command receipt retained. No app-server listener, auth/login, model/provider request, dependency installation or build.

## Inventory gate

| Collection | JSON files | Total bytes | Result |
|---|---:|---:|---|
| schema/ stable |305|3492670|Every JSON parsed using fatal UTF8 and JSON.parse; SHA256/byte count recorded|
| schema-experimental/ |426|4210655|Same checks; separate bundle, not substituted for stable|

Limits: <=4096 JSON files, <=16MiB/file, <=128MiB/collection, reject symlink entries. Inventories sort relative paths and record all emitted JSON hashes. This is JSON syntax/integrity inspection, not JSON Schema evaluation, semantic validation, $ref resolution or complete runtime protocol acceptance. No AJV/jsonschema package used. parameter-observations.json contains selected local schema properties/definitions for inspection.

## Cue request comparison

Source: daemon/src/host-codex-controller.ts SHA D06B68BEF5BC3158C89AE8883BBC3338BF1FE223B01647885A1E34DB316539B7.

- initialize at585 sends clientInfo{name,title,version} and capabilities.experimentalApi=true. Generated v1/InitializeParams requires clientInfo; ClientInfo requires name/version and declares title; InitializeCapabilities declares experimentalApi boolean. The outgoing fields/types are present in inspected declarations. Subsequent initialized notification is emitted by Cue, but full notification sequencing/acceptance was not exercised.
- buildHostThreadStartParams at75 sends cwd, optional model, ephemeral=true, sandbox=read-only, environments=[], approvalsReviewer=user, granular approval flags, developerInstructions, dynamicTools. Stable ThreadStartParams property list omits environments/dynamicTools even though some corresponding definitions are still present. Experimental ThreadStartParams declares both fields. Omission is not proof a stable validator rejects additional fields; no full validator ran.
- Experimental environments is an array/null branch; an empty array is representable in that declaration. This does not prove runtime host workspace/environment absence. Sandbox read-only and reviewer user appear in generated enum definitions; these declarations do not prove OS restrictions.
- Granular approval declaration requires mcp_elicitations/rules/sandbox_approval booleans; request_permissions/skill_approval are also declared. Cue supplies all five false. Current code is compatible with these inspected field/type requirements; no enforcement behavior was tested.
- DynamicToolSpec function branch requires type/description/inputSchema/name. Current CUE_WORKSPACE_TOOL includes type=function (source22), and the remaining fields. Experimental array points to this union. This observation does not validate the embedded inputSchema or tool execution authorization.
- turn/start at593 sends threadId and input array of type=text/text. Generated TurnStartParams requires input/threadId; UserInput text branch requires type/text and gives text_elements a default empty list. Cue's inspected fields satisfy those narrow required-key/type declarations. No turn was started and no model ID, return turn/thread identity or event behavior was measured.

These are source-to-declaration observations only. Generated schema may expose more enum/experimental methods than Cue uses, and does not grant capabilities or license production activation.

## Fingerprints and provenance

Root observed codex-cli0.154.0 and Claude Code2.1.267 before this work (DONE-CONTRACT). We did not repeat version/help. Post hashes:

- Codex wrapper codex.ps1: 0C149DB80ED0BF442C810146B0AD0163B74982FE4542D673F56C354D7B8229CB — matches preimage.
- Claude native executable: 23DDE2A47CF1D7D9C4A2D96D21FA80EA9BFC872DFDE0EE06E9982D2908603350 — matches preimage.

The Codex hash is wrapper-only; native binary/package/dependency hash was not captured here. Wrapper stability does not prove its referenced implementation could not change between commands. No historical pinned binary is replaced. Installed schema bytes are a version-labelled observation, not a source-commit or native executable attestation. Claude executable stability/version/help does not qualify a stream parser, credentials or model access.

OpenAI Docs skill was read; requested local installed schema/source takes precedence over moving documentation for this narrowly authorized measurement. No external documentation fact was needed for the schema comparison.

Ready for independent evidence audit. No runtime/provider/Windows qualification or complete schema-validity PASS claimed.
