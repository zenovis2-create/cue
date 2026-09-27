# Independent review: Git staging factory

Verdict: **CLEAR for the bounded clean-root staging-factory contract.** This does not qualify a production writer or close the broader S3 production-boundary work.

Reviewed frozen pins:

- `daemon/src/orchestration/git-staging-factory.ts`: `22F0234AA18C22040D6F80FE8375D29B35BBC070F28CB623D1CE90658F0D6E95`
- `daemon/test/integration-git-staging-factory.test.ts`: `220BBA5B6964CA01281070707C150B8EEB43C3830E36CAB73490A540E21B754D`

The corrected implementation writes an exact `creating` ownership record before `git worktree add`, and retained `creating` state remains unresolved rather than adopting a newly discovered root. Active state binds native identities for the storage root, per-attempt directory, publication root, publication Git common directory, execution root, and per-worktree Git admin directory. Reopen and cleanup re-observe those bindings and reject path, identity, or reparse changes.

Git is invoked with `shell:false`, bounded time/output, sealed executable resolution, system/global config disabled, hooks disabled, prompts disabled, and system attributes disabled. Local include/filter/hooks/fsmonitor/worktree-config/attributes-file settings, tracked attributes, submodules, detached/unborn publication roots, and every dirty/ignored publication state are rejected.

Cleanup uses ordinary non-force `git worktree remove`. A dirty execution root therefore remains intentionally uncleanable by this factory. The corrected failure path re-locks the worktree and verifies that lock. Successful proof requires both the execution root and its exact recorded Git admin directory to be absent, plus absence from the publication worktree list under the still-bound common directory.

Independent validation passed daemon-local TypeScript no-emit, the maker's 4 focused disposable-repository tests, and 2 reviewer-hostile fixtures covering verified relock after dirty cleanup, `core.attributesFile` rejection, and retained-`creating` refusal. See `independent-gates.raw.log` and `reviewer-hostile.test.ts`.

Bounded limitations preserved:

- The caller must supply a host-controlled storage root. The factory verifies exact path, separation, identities, and reparse absence; it does not prove Windows ACL ownership.
- A crash retaining `creating` state requires explicit external reconciliation. The factory refuses automatic adoption and does not claim the unknown effect absent.
- Dirty coding output cannot complete normal cleanup without a separately designed safe publication/reconciliation boundary. No force remove, prune, clean, or reset is used.
- These tests use disposable local repositories and do not establish production writer qualification.
