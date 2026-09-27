# Recovery journal status display

Done: the existing native recovery observation panel displays optional persisted journal status without adding an execution action. Unknown/missing/invalid status is unavailable, old status clears on target/query changes, and status cannot turn on resume or cleanup. Root owns renderer HTML/JS and integration-native-recovery-ui.test.ts. Host worker owns summary DTO.

Cap two diagnosed corrections. Each pass runs focused native recovery UI plus run-picker regressions, renderer syntax and scoped diff. An independent reviewer checks the final DOM behavior and host DTO compatibility. This is not actual Electron visual or native/provider qualification.

Root also owns the narrow app/ipc.mjs projection change: journal state/revision only cross IPC, with raw reason, case ID and private details omitted. No new IPC operation or authority input is added.
