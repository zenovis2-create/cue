# Current-source root regression

- Run the unfiltered root `npm test` (including daemon pretest/build), one worker as configured by package scripts, with a 30-minute outer timeout.
- Clear inherited live-provider, real-restart and Orca opt-in test flags. Tests retain their normal Windows/local fixture coverage. The manifest test uses the pinned local Codex executable against a loopback synthetic HTTP endpoint with authentication disabled; this is not an external provider/model request.
- Preserve initial Git status, source byte hashes before/after, the complete output and process exit status. No replacement of earlier failed logs.
- Existing source and untracked work must remain intact. Do not change test timeouts or suppress tests merely to obtain a pass.
- If a failure is actionable, first preserve the affected file preimage, then investigate no more than two correction hypotheses for that blocker. Isolated reruns are not a root pass.
- No live model/provider authorization, inference, download, acceptance gate closure, commit, push or publication is included.
