import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Path-only policy. Never read or match credential values.
export function isCredentialPath(path) {
  const normalized = path.replaceAll('\\', '/').toLowerCase();
  const parts = normalized.split('/');
  return parts.some(part => part === '.codex' || part.startsWith('codex-home-') || part.startsWith('.test-state-'))
    || /(^|\/)(auth\.json|credentials?(\.[^/]*)?|tokens?\.json|\.env(\.[^/]*)?|id_rsa|id_ed25519)$/u.test(normalized)
    || /\.(pem|p12|pfx|key)$/u.test(normalized);
}

export function stagedCredentialPaths(cwd = process.cwd(), env = process.env) {
  return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { cwd, env, encoding: 'utf8' })
    .split('\0').filter(Boolean).filter(isCredentialPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const paths = stagedCredentialPaths();
  if (paths.length) {
    console.error(`Credential-shaped staged paths refused:\n${paths.join('\n')}`);
    process.exitCode = 1;
  }
}
