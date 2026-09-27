import { lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { join, parse, resolve, sep } from 'node:path';

// Initial trusted code: builtin-only and synchronous, before any app module
// import or Electron readiness. Caller is the protected main process.
function directory(path) {
  const absolute = resolve(path);
  let current = parse(absolute).root;
  for (const component of absolute.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, component);
    try { mkdirSync(current); } catch (error) { if (error?.code !== 'EEXIST') throw error; }
    const stat = lstatSync(current);
    const real = realpathSync(current);
    const same = process.platform === 'win32' ? real.toLowerCase() === current.toLowerCase() : real === current;
    if (!stat.isDirectory() || stat.isSymbolicLink() || !same) throw Error('electron_profile_path_denied');
  }
  return absolute;
}
export function bindElectronProfile(app) {
  const input = process.env.CUE_USER_DATA;
  if (input === undefined || input === '') return null;
  if (typeof input !== 'string' || input.length > 32768 || input.includes('\0')) throw Error('electron_profile_path_denied');
  if (app.isReady()) throw Error('electron_profile_too_late');
  const userData = directory(input), sessionData = directory(join(userData, 'electron-session'));
  if (app.isReady()) throw Error('electron_profile_too_late');
  app.setPath('userData', userData);
  app.setPath('sessionData', sessionData);
  if (app.getPath('userData') !== userData || app.getPath('sessionData') !== sessionData) throw Error('electron_profile_binding_unverified');
  return Object.freeze({ userData, sessionData });
}
