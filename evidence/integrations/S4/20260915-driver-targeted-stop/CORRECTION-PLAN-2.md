# Failure-cleanup correction 2

Prior corrected source SHA-256 `25D5BE2F614DE88CA234FFFFCE7B30B1C071728D14AAA52CC9AC63548BEEE02F` is preserved by the independent `correction/review.md` and its findings. No actual OS attempt has run.

Offline correction cap: 2. Done means partial descendant loss cannot suppress cleanup of the still-exact controller: cleanup checks controller PID plus OS creation time independently, terminates its verified current tree, awaits its child handle when open, and re-observes every captured PID/creation identity before any root removal. If an original identity remains, cleanup throws and retains that root. Independent cleanup callbacks all run and aggregate failures so one retained root does not skip safe cleanup of the other. Offline gate: Vitest list/import and `git diff --check`; then independent re-review before the first OS execution.

The first documentation command used the daemon working directory with a repo-relative evidence path and failed before writing this file; the corrected command wrote this receipt at the intended root evidence path. The code import/diff gates in that pass still succeeded.
