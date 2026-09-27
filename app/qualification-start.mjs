import { app } from 'electron';
import { runGuardedEntry } from './guarded-entry.mjs';
import { bindElectronProfile } from './electron-profile.mjs';

// Explicit CLI only; no top-level await, UI, fallback, or renderer arguments.
const args = process.argv.slice(2);
const runtime = Object.freeze({ electron: process.versions.electron ?? null, node: process.versions.node, abi: process.versions.modules });
const electronRuntime = typeof runtime.electron === 'string' && /^\d+\.\d+\.\d+/.test(runtime.electron)
  && typeof runtime.node === 'string' && typeof runtime.abi === 'string' && /^\d+$/.test(runtime.abi);
let profile;
const startup = electronRuntime && args.length === 1 && args[0] === '--generated-json-qualify' && process.env.CUE_LIVE_RUN !== '1'
  ? runGuardedEntry(() => {
    profile = bindElectronProfile(app);
    return import('./qualification-application.mjs');
  })
  : Promise.reject(Error('qualification_explicit_command_required'));
startup.then(({ guard, loaded }) => loaded.runQualificationApplication({ guard }))
  .then(result => {
    if (profile && (app.getPath('userData') !== profile.userData || app.getPath('sessionData') !== profile.sessionData)) throw Error('qualification_profile_drift');
    console.log(JSON.stringify({ ...result, runtime, profile }));
    app.exit(result.exitCode);
  })
  .catch(() => {
    console.error('cue_qualification_startup_denied');
    app.exit(1);
  });
