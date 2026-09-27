# Public-driver restart parser/lifecycle correction

Recorded before correction2 edits against fixture pin `ab8e5095fe8b1a829248f0e6482f322c49f092934c4a90bb8fc42cf41267818f` and test pin `39d992fc5544213ab83cb7fb99ab21776281c5b989763306bd4e979e922ae528`.

Done means incoming bytes are scanned and appended only in segments whose combined pending size is at most 64 KiB; malformed and overflow termination clears queued data; natural EOF/process close preserves completed frames and returns them before its terminal error; and a permanent child `error` listener is attached immediately after spawn, records root retention and the receipt diagnostic, and participates in observation/handshake failure.

Attempt cap: two edit-and-gate passes. Each pass runs fixture syntax, TypeScript no-emit, and the focused Vitest file. No build, actual gate, provider, Electron, local-8085, or network operation.
