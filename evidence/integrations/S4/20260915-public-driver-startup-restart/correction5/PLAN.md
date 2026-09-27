# Actual2 child-exit diagnosis and cleanup correction

Recorded before correction5 source edits. Exact source bytes are preserved in the sibling base64 files; decoding must reproduce fixture SHA-256 `0fbba6f74353d6bac91a6ea29f0136ca07b1a703da8514a55c1a23aa827ee879` and test SHA-256 `a2c5ccd9d4dfdb76e98f4d6a49daeb08228aa11fa4bcdc983fe53f693eb41677`.

Actual2 facts: the first PID 24752 produced a hash-valid intent-1/result-0 committed effect and closed. The second PID 104496 passed the exact identity handshake, then stdout ended without a restart frame. Its stderr/exit diagnostic was lost because the frame rejection bypassed the later assertion. Cleanup observed OS absence during the close-event race and incorrectly labeled it identity-changed; the root `D:/Temp/User/cue-public-driver-restart-k3JYSB` was retained. No exact startup cause is inferred from EOF alone.

Done means child stderr and exit status are captured from spawn and persisted as bounded partial observation evidence on every frame/exit failure. Cleanup first gives an already-exiting child a bounded close-event opportunity; if the exact PID is already absent it awaits close without signaling, while a present changed identity still refuses all signaling. Existing exact identity and restart assertions remain unchanged.

Attempt cap: two edit-and-gate passes. Every pass runs fixture syntax, TypeScript no-emit, and focused Vitest. No actual run, build, retained-root/database access, deletion, signaling, provider, local-8085, or production edit.
