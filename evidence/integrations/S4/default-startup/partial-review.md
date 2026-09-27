# Default startup: partial observation, not PASS

2026-09-11. Maker receipt; this is not independent product qualification.

The original two-attempt unit is closed. Both attempts used `electron .`, with the package entry `app/start.mjs`, isolated temporary `CUE_USER_DATA`, worktree and Electron profile. The observer was injected through `NODE_OPTIONS`; it changes process initialization and cannot establish a fresh qualified module closure. No task preparation or inference was requested. Native-cache integrity, network request counts and live model qualification were not measured.

1. [First process log](process.log) records `MODULE_NOT_FOUND` for the observer's early `require('electron')`, before app startup observation. [Process receipt](process.json) records PID 87364, exit 1 and closed handle. SHA-256: log `ED0128773C4B9C35ADC7EC3F794C40D46DA981CA300D635959FF92BD44EE73E4`; receipt `1D869CC22A9B56311EDBE605D538BB75DA7918DA4F2EB1507E644DAF74B9B88C`.
2. [Second window receipt](attempt2/window.json) records the actual renderer URL, real preload API, Node isolation, sandbox, unconfigured revision-null local JSON settings and unavailable default host. Moving observer initialization to `setImmediate` allowed that observation. Hidden-window capture then failed with `UnknownVizError`; no screenshot or graceful-quit PASS was produced. SHA-256 `1C69B4CD9C07CB03349E1555A49A8D9A13E1D599206D383B9060353B5C601591`.

[Second process receipt](attempt2/process.json) records PID 41224, exit 1 and closed handle; SHA-256 `4E90A29FFCF57AEF0E3B4E6EC11BA5282FDBCAD5B61BF9A70FA89FFA31CDB0B3`. Both owned temporary roots were removed after bounded process-tree cleanup completed. This is an owned-child cleanup observation, not an exhaustive machine-wide process census.

[Partial summary](attempt2/summary.json), SHA-256 `904DC0A0C56D3457F827EF0BDB5909F768E14CC57E0FB3526B437C4012D08A47`, retains the missing screenshot, normal shutdown and post-exit SQLite integrity/count gates. Task/session/attempt counts were not measured after these failures and must not be reported as verified zero. The observer's `inferenceCalls: 0` describes the no-inference test scenario, not provider-side telemetry. Original evidence remains unchanged.

## Separate compositor unit, prepared only

The revised QA script preserves the application's original visible window, waits for two animation frames and uses CDP `Page.captureScreenshot`. It always requests normal quit after the window probe and records post-exit SQLite results separately from screenshot success. Its new output directory is `compositor1`; existing output causes refusal instead of overwrite. This new unit has a one-attempt cap and awaits a new root source-freeze signal. No additional run is claimed here, and retrospective fixture UI proof remains a separate unit.

## Compositor unit actual result — partial, visual gate failed

The root subsequently authorized one frozen-source execution. [Result](compositor1/result.json), [window observation](compositor1/window.json) and [process receipt](compositor1/process.json) record actual package startup, real preload reads, normal `before-quit`/`will-quit`, Electron exit 0, post-exit SQLite integrity `ok`, and zero task/session/attempt/local-settings/local-invocation-budget rows. The listed source file hashes matched before and after the run. PID 41956 closed and the owned temporary root was removed.

The observed BrowserWindow remained `visible: false` despite retaining the application's `show: true` configuration. The visual guard therefore refused capture before the CDP screenshot request. There is no screenshot, and the overall result remains `passed: false`. Parent process `windowsHide` or runtime display behavior is only a possible explanation, not an established cause. This one-attempt unit is closed with no rerun. No inference was invoked; these observations still do not establish qualification, provider telemetry, full native-cache integrity or active-run Stop behavior.
