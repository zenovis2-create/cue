# Official Git command sources

- Git worktree: https://git-scm.com/docs/git-worktree
  - `worktree add --detach` creates a linked worktree at an exact commit without creating a branch.
  - `worktree list --porcelain -z` is the stable machine-readable listing used for independent metadata-presence checks.
  - Ordinary `worktree remove` accepts only clean worktrees; `--force` is intentionally absent. Dirty cleanup therefore retains the root and authority.
- Git status: https://git-scm.com/docs/git-status
  - Porcelain v2 is stable for scripts. `--untracked-files=all`, `--ignored=matching`, and `--ignore-submodules=none` prevent hidden untracked/ignored/submodule dirt from being treated as clean.
  - `--no-optional-locks` avoids the optional status index refresh write; the factory also sets `GIT_OPTIONAL_LOCKS=0`.
- Git environment/configuration: https://git-scm.com/docs/git
  - `GIT_CONFIG_NOSYSTEM` and `GIT_CONFIG_GLOBAL` support a predictable configuration environment; `GIT_TERMINAL_PROMPT=0` prevents interactive credential prompts.

These sources describe Git behavior only. They do not qualify Cue's production driver boundary, external providers, arbitrary Git configurations, or S3-01/S3-03 closure.
