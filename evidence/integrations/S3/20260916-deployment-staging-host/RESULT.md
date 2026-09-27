# Deployment staging host result

The protected Electron startup now passes host-owned
`CUE_GIT_STAGING_CONFIG` through a deployment wrapper before Core constructs the
public orchestration driver. Missing or explicitly disabled configuration keeps
the existing startup readiness unchanged. Invalid JSON, extra fields, relative
paths, noncanonical/reparse paths, unsafe executable types, and storage/worktree
overlap fail closed. Invalid configuration invokes neither the underlying
provider factory nor the Git staging factory.

Enabled configuration attaches the exact staging object only when the
underlying host declares `executionStagingSupport: 'git-worktree-v1'`. The
focused capable-host fixture reaches real `createCueCore` and
`createOrchestrationDriver` construction. A generated-json-shaped adapter with
no declaration returns `deployment-staging-adapter-unsupported` and does not
invoke the staging factory.

Current production limitation: no shipped production orchestration adapter
declares that support marker or prepares `executionStaging: true`. Therefore the
configuration seam is present but does not silently make the generated-json
adapter file-capable, and no real staged execution is claimed by this batch.

Root review then corrected drive-root child parsing, moved canonical worktree
and overlap refusal ahead of the consuming host invocation, and added guarded
fixture cleanup. The final focused gate passed 6/6. The no-emit TypeScript check was attempted
and failed only in concurrently edited `git-staging-factory.ts`; root owns the
coordinated final compile after that work freezes. No provider, local model, or
paid execution ran.
