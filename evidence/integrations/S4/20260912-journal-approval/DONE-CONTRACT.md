# Journal approval presentation

Done: the existing approval form displays every host-declared change target's task, exact relative path and backup limit before approval; clears stale targets on replacement/failure; treats paths as text. No renderer-supplied target authority is introduced.

Root owns app/renderer/index.html, app/renderer/renderer.js and daemon/test/integration-approval-plan.test.ts. Contract with journal worker: optional immutable changeTargets array containing taskId, targetId, relativePath, maxBackupBytes and rootContractDigest. Cap: two diagnosed corrections. Each pass runs the focused approval-plan test and syntax/diff checks. An independent agent reviews the final change. Actual Electron visual evidence is not claimed by DOM tests.
