import { app, dialog } from 'electron';
import { runGuardedEntry } from './guarded-entry.mjs';
import { bindElectronProfile } from './electron-profile.mjs';

// Electron and the entry/identity helpers are initial TCB. There is no top-level
// await: Electron can complete readiness while the protected load settles.
const startup = process.env.CUE_LIVE_RUN === '1'
  ? Promise.reject(new Error('cue_legacy_live_startup_denied'))
  : runGuardedEntry(() => {
    bindElectronProfile(app);
    return import('./main.mjs');
  });
startup
  .then(({ guard, loaded }) => loaded.startCueApplication({ guard }))
  .catch(error => {
    console.error('Cue startup failed:', error instanceof Error ? error.message : 'startup_failed');
    dialog.showErrorBox('Cue 시작 실패', error instanceof Error ? error.message : '알 수 없는 오류');
    app.exit(1);
  });
