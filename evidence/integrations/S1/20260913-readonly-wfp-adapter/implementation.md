# WFP observation lease adapter — implementation receipt

The new `CueWfpObservationLeaseFactory` creates an inert owned lease provider. Its production overload binds `NativeWfp` and the launcher's existing zero-time process wait without making a native call until `Ready()`. The provider snapshots the request before receiving the exact process/job handles. Invalid requests stop before the shared native guard or any native operation.

`Ready()` opens WFP, confirms collection, resolves the executable app ID, and subscribes before the launcher resumes. The adapter and collector share one lifetime guard. The callback copies at most 64 events and treats null/overflow as diagnostic loss. Readout deep-copies events and uses a dedicated diagnostic DTO; it grants no authority.

The lease rejects foreign process handles before waiting. Only `WAIT_OBJECT_0` permits disposal. Disposal calls unsubscribe without holding the event-buffer lock, then frees the app ID and closes the engine. Any ambiguous handle, unknown death, unsubscribe/free/close failure, or premature disposal remains unknown and quarantines the owned native state. Callback loss or overflow remains unknown after otherwise safe disposal; it does not itself imply unsafe native lifetime cleanup. Microsoft documents that `FwpmNetEventUnsubscribe0` waits for active callbacks to finish and that a zero-time `WaitForSingleObject` returns immediately; these contracts are why unsubscribe is outside the callback lock and only result zero is accepted.

- https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmneteventunsubscribe0
- https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject

Verification:

- Adapter injected-native test: 17/17.
- Preserved collector test: 17/17.
- Preserved launcher observation/terminal tests: 15/15.
- `npm run build`: exit 0.
- Collector, adapter, and launcher source/dist asset parity: exact.
- Scoped `git diff --check`: exit 0.

Final SHA-256:

- Collector: `5871FB8684AA3D8C2B6D635E3C31B6FD5A9FE45E18CDD9D7A1164C106C9CCB4F`
- Adapter: `9C00E6A55D93BCC43CFBCA33CA2DBC305CF3BB72734E8A24469EF3154D882F60`
- Launcher: `6060955CD91AFB9D0470697C1B8945A75850AFD3A0307CF60AC0063C271A48FF`
- Adapter test: `46E72B426F5D78AB25765524B5842F538310A7562B32BB1D4F23FFB2A1043C42`
- Done contract: `AD309A57A2FBDFCB0D7740196790F8E27D1D91E02BA288FFB92F2D5E29BC49B3`

This unit packages the building blocks but leaves the default launcher provider null. It does not activate WFP, prove a denial, or execute any live native, worker, network, model, provider, policy, elevation, or historical gate operation.

A verification invocation using unsupported Vitest reporter name `basic` failed before tests; the corrected standard `dot` invocation then passed 17/17. This was a harness CLI error, not a product test failure.

Independent final review passed at SHA-256 `1092D53F9ABAB6EAEED1D493DF104A1985F24ED53C3B72B759A71705A9314EC1`. The review preserves the inactive default-null provider and no-live-WFP limits.
