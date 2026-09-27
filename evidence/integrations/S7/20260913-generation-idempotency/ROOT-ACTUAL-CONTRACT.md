# Root actual same-generation verification

Done: after the repaired generator source is frozen and independently reviewed, run `node scripts/reuse/cue-current-source-report.mjs` once against the existing repository snapshot. Require exit 0 with an explicit reuse result, and verify that the active pointer, generation manifest and its five artifacts retain their recorded bytes and hashes. Verify the historical failed staging directory remains present. Independently audit the result before closing the checklist item.

Attempt cap: one actual run under the newly reviewed implementation. No blind retries, replacement of historical generations, or cleanup of old staging. Before this run record source hash and current pointer/artifact hashes; afterward compare them and capture the command's actual result. A failure remains a failed attempt and requires a new hypothesis.

This command is static JS/TS source/report work only. It does not run a worker, subscribe to WFP, change OS policy, call a model, or prove PowerShell coverage. Earlier failed publication evidence remains historical and unchanged.
