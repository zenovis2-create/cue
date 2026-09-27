# Terminal-wait source generation attempt

Root command: `node scripts/reuse/cue-current-source-report.mjs`.

Tool receipt: `93c766`. One attempt, exit 1. Node v24.18.0 reported `EPERM` at the staging-directory rename into the existing generation `097ef304a7ea63788d36e0c6951f2ca323340c6f198a926e7ca07f7d6cf7fcd5`.

Retained staging directory: `.staging-cb93d71b-d95d-4ed7-9980-e15e71db330b`. The command reached the rename before the pointer publication call. No retry, directory deletion, or generation replacement was performed.

The changed launcher is a PowerShell file. The unchanged JS/TS snapshot digest requires a scope audit, not a claim that a new snapshot was published. Independent review of the existing pointer, artifacts, and current scoped source is recorded separately. This failed publication attempt does not invalidate the independently reviewed launcher tests, and those tests do not prove static publication success.
