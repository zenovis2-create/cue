import { assertCurrentProviderInstallation } from './provider-installation.mjs';

const fail = () => { throw Error('provider-installation-binding-unavailable'); };
const samePath = (a, b) => typeof a === 'string' && typeof b === 'string'
  && (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

/** Binds candidate evidence to the exact provider installation that was
 * identified. This is identity freshness only, never auth or qualification. */
export function bindProviderInstallationCandidate(input) {
  try {
    const { installation, record, currentSubject, evidenceReferences, provider, executablePath } = input;
    if (typeof currentSubject !== 'function' || typeof evidenceReferences !== 'function') fail();
    assertCurrentProviderInstallation(installation);
    if (installation.provider !== provider || !samePath(installation.executablePath, executablePath)
      || record.sourceVersion !== installation.version.value) fail();
    const subject = () => {
      assertCurrentProviderInstallation(installation);
      const value = currentSubject();
      if (value?.toolBinarySha256 !== installation.executable.sha256) fail();
      return value;
    };
    subject();
    return Object.freeze({
      currentSubject: subject,
      evidenceReferences() { subject(); return evidenceReferences(); },
    });
  } catch { fail(); }
}
