# Protocol correction plan

Done means account observation accepts the pinned app-server response/notification framing without weakening the receipt: optional `jsonrpc:"2.0"` is accepted, safe bounded notifications may interleave, `account/updated` invalidates the observation, server requests/duplicate or unknown response IDs/malformed frames fail closed, and an unterminated stdout frame is capped before line buffering. Stderr is continuously drained without storing provider data.

Account identity uses normalized non-null email only; mutable plan metadata does not rotate identity. A ChatGPT account with null email remains present with null identity/reference.

- Attempt cap: 2 focused correction runs.
- Every pass: focused account-observation tests plus TypeScript no-emit.
- Preserve the rejected reviewer artifact and exact byte preimages.
- No live provider, model, service, or network call. No service-accepted/authentication claim is added.
