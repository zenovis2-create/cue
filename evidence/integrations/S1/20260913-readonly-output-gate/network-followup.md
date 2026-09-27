# Output-gate network follow-up

Status: read-only diagnosis after the one authorized output gate was consumed. No gate, policy, audit setting, ACL, profile, process, listener, model, or provider state was changed.

## Retained facts

The retained result records worker PID `65008`, launcher status `0`, project read `unchanged`, owned-runtime write `allowed`, and seven filesystem/sibling operations denied with `EPERM`. The controlled client reported network `denied:ETIMEDOUT`; the host listener recorded zero accepted connections after its prelaunch sanity connection. The gate correctly remains `passed:false`, because its denial predicate accepts only `EACCES` or `EPERM`. A timeout and zero accepts do not identify which layer dropped, delayed, or failed the connection.

The run window was `2026-09-13T01:23:27.558Z` through `2026-09-13T01:23:30.0422687Z` UTC. A bounded Security-log query for events `5152` and `5157` in that window, narrowed to decimal PID `65008` or hexadecimal `0xFDE0`, returned `No events were found that match the specified selection criteria.` This is absence of audit evidence, not evidence that WFP did or did not block the attempt.

## Primary Windows evidence

Microsoft defines Security event [5157](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-5157) as a Windows Filtering Platform blocked connection and documents its process ID, application, direction, addresses, ports, protocol, filter runtime ID, and layer fields. Microsoft’s [filter-origin documentation](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/filter-origin-documentation) says 5157/5152 filter-origin data can identify an AppContainer loopback default-block origin on supported Windows versions. It also makes clear these events depend on the corresponding audit surfaces; their absence is not a block verdict.

Microsoft documents [NetworkIsolationSetAppContainerConfig](https://learn.microsoft.com/en-us/windows/win32/api/networkisolation/nf-networkisolation-networkisolationsetappcontainerconfig) as configuring which AppContainer SIDs may send loopback traffic, specifically for debugging. This gate did not call it or add an exemption. Microsoft’s [FWPM_NET_EVENT_CAPABILITY_DROP0](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_net_event_capability_drop0) structure is the direct WFP representation of traffic denied for a missing AppContainer network capability and includes the filter ID and an `isLoopback` field. A live net-event subscription is possible through [FwpmNetEventSubscribe1](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmneteventsubscribe1), but Microsoft requires `FWPM_ACTRL_SUBSCRIBE` access; this run did not request it.

## Smallest discriminating proof

A future, separately authorized gate should preserve the same pinned client, fixed loopback endpoint, timeout policy, and strict permission predicate, while a protected host observer subscribes read-only to WFP net events before the child resumes and unsubscribes after it exits. The observer must bind an event to the exact worker PID, executable, time window, destination `127.0.0.1:48193`, outbound direction, and AppContainer capability-drop/loopback fields. It must persist the filter ID and event type from the host observer, not from child output. Subscription failure, insufficient access, no matching event, ambiguous PID reuse, or only timeout/zero-accept observations must remain unknown.

That experiment would distinguish a WFP AppContainer capability/loopback drop from an unexplained timeout without enabling audit policy or granting a loopback exemption. It would establish only the reason for this controlled network denial; it would not grant general network, permission, readiness, acceptance, or cleanup authority.
