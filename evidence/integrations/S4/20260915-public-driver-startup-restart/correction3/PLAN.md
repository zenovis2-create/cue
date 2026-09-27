# Public-driver restart observation evidence correction

Recorded before correction3 edits at fixture pin `ab8e5095fe8b1a829248f0e6482f322c49f092934c4a90bb8fc42cf41267818f` and test pin `2913bb04bb33724f473899819ac636bc4b47502b61e0b9c357e3267187ea8d46`.

Done means the actual gate requires `CUE_PUBLIC_DRIVER_RESTART_OBSERVATIONS_RECORD` to be an absolute path outside the temporary scenario root with an existing parent. The genuinely received effect response and restart response are each paired with the independently observed child identity, appended to in-memory scenario evidence, and durably rewritten before response assertions. Cleanup rewrites the same record so partial failure evidence survives. Handshake frames are validated in memory and are outside this response-evidence artifact. No frame is fabricated.

Attempt cap: two edit-and-gate passes. Each pass runs fixture syntax and focused Vitest; TypeScript no-emit is run and may remain externally blocked by concurrent unowned sources. No build or actual run.
