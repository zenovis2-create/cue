# Independent network follow-up review

Status: **REVISE.** The read-only diagnosis is honest, but the proposed live WFP subscription cannot directly satisfy its stated exact-PID binding with the documented event structure.

The reviewed follow-up is `E91AEB33F5FFA612C0BE5C4D170353B27FB86666368A627BA8C714A2F5C178E0`. Its retained-fact interpretation is correct: `ETIMEDOUT` plus zero accepted connections is unknown, and the empty bounded 5152/5157 query is absence of audit evidence rather than proof of allow or deny. The plan also correctly refuses to enable audit policy or add a loopback exemption.

Microsoft documents Security event 5157 with process ID, application, direction, addresses, ports, protocol, filter ID, and layer. However, the subscribed `FWPM_NET_EVENT_HEADER1/2/3` structures document timestamp, endpoint/protocol, application ID, user ID, and, in newer headers, package/AppContainer SID; they do **not** contain a PID. `FWPM_NET_EVENT_CAPABILITY_DROP0` adds missing capability, filter ID, and `isLoopback`, also without PID. Therefore a `FwpmNetEventSubscribe1` callback cannot be required to report or directly match worker PID 65008 as currently written.

The smallest executable revision is:

1. Keep Security 5157 evidence as an optional separate source. If the required audit surface is already enabled and an event independently matches PID, application, outbound `127.0.0.1:48193`, protocol, and bounded process lifetime, record it. Unreadable/disabled logs, no event, or ambiguity remain unknown; do not enable auditing.
2. For a live WFP subscription, bind only fields actually present and flagged valid: exact event type, timestamp inside the protected observation interval, IPv4/TCP, local/remote endpoint orientation for the attempted outbound connection, exact application ID, exact package/AppContainer SID, capability-drop type, `isLoopback=true`, and filter ID.
3. A protected host may infer association with the worker only if it additionally proves the subscribed package SID is the newly created exact profile SID, the sealed executable identity matches the event application ID, and the already protected job has exactly one active process for the full observation interval. Subscription must be active before resume and remain active until that exact held process terminates. Any missing flag/field, subscription/access failure, event overflow, multiple matching events/processes, PID reuse ambiguity, or inability to prove the one-process interval remains unknown.
4. Persist the raw bounded event fields and the independently held process/profile/job identities. Keep timeout, zero accepts, child narration, and filter ID alone nonauthoritative. Do not promote the finding into general network or acceptance authority.

With those changes, a future separately authorized experiment could discriminate an AppContainer capability/loopback drop without inventing a PID field. The present plan should not be approved for implementation until it replaces the impossible direct PID requirement with this package/application/job binding or chooses the already-enabled 5157 path.

No runtime, launcher, policy, audit, ACL, profile, process, listener, model, provider, or network state was changed in this review.
