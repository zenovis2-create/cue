# DONE contract — self-contained WFP launcher generation

Done means a deterministic generator produces one standalone `readonly-verifier-wfp-launch.ps1` whose embedded C# is the exact normalized union of the pinned base launcher, collector, and observation adapter. It performs no runtime source load, preserves payload/environment/ACL/root/executable behavior, and replaces exactly one launch route with a concrete provider bound to the held executable, freshly created package SID, fixed port 48193, and internal observation launch path. Inputs remain unchanged.

Tests must prove repeated bytes, dependency mutation changes output hash, missing/duplicate anchors refuse without output, generated embedded C# compiles under Windows PowerShell, route anchors are unique, and no payload WFP/authority flag is introduced. Completion commands: focused generator test, related adapter/launcher tests, `npm run build`, generated-byte/hash check, and scoped `git diff --check`. Correction cap: two total; every pass runs the focused test and source/hash checks. Failure requires a new measured hypothesis or handoff.

This unit generates but does not execute or select the WFP launcher. No AppContainer, WFP query/subscription, worker, network, model, provider, policy, elevation, or historical gate operation is authorized.
