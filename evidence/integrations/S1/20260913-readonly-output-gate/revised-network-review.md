# Independent revised network-plan review

Status: **PASS as an executable diagnostic plan.** The initial `network-review.md` remains preserved at `9ED66B44557C717ACA3EAFA5E6E33FE1E7310A14D9CF1449423FE4A3B1F693E3`; this review covers the corrected plan only.

Reviewed plan SHA-256: `3E7A75B6AD7A461C40B81FB5D5E609006DF53E2FEC887411348F0C7FF93684F1`.

The revision correctly separates two evidence routes:

- Existing Security 5157 evidence may bind a documented PID only when the audit surface was already enabled and the event exactly matches PID, application, outbound TCP endpoint, and bounded lifetime. The plan neither enables auditing nor treats absent/unreadable events as evidence.
- The WFP subscription route makes no direct PID claim. It proceeds only after a query-only `FWPM_ENGINE_COLLECT_NET_EVENTS == 1`, uses Event/Header3 plus capability-drop data, and requires every documented presence flag before reading package SID, app ID, IP/protocol, address, and port fields.

The WFP association is now both concrete and honestly labeled as an inference. The observer must subscribe successfully before resume; match an event from subscription activation through verified job death; require exact newly created profile SID, capability-drop type, missing capability, `isLoopback=true`, IPv4/TCP, outbound controlled endpoint, and filter ID; and prove an exclusive one-process job interval. Expected app ID is derived before resume with `FwpmGetAppIdFromFileName0` from the exact held/sealed executable path, copied into protected state, compared byte-for-byte with the flagged event blob, and freed with `FwpmFreeMemory0`.

Disabled collection, subscription/access failure, missing flags, unavailable fields, overflow/loss, multiple events or processes, profile/PID reuse ambiguity, nonexclusive interval, or no match remains `unknown`. Filter ID, timeout, zero accepts, child output, package SID, or app ID alone is insufficient. The plan calls no setter, audit enablement, loopback exemption, or arbitrary audit mutation.

The proposed offline proof is proportional: synthetic structures must exercise every presence flag and field binding, canonical app-ID bytes, exact endpoint/time window, cardinality, collection-disabled/subscription-failure behavior, and inference wording before any separately authorized live gate. The existing `ETIMEDOUT` stays rejected and no general network, permission, readiness, cleanup, or acceptance authority follows.

This was a documentation-only review. No implementation, WFP subscription, audit query/change, native launch, listener, profile, model, provider, or network action occurred.
