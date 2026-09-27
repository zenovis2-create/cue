import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

// Codex 0.154.0 win32-x64; audited provenance is documented in app/core.mjs.
// This is an evidence-tool pin, not authentication, entitlement or dispatch authority.
export const PINNED_CODEX_SHA256 = 'be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde';

export function resolvePinnedCodex(env = process.env) {
  function measure(binary, source) {
    if (!statSync(binary).isFile()) throw Error('pinned Codex binary is not a file');
    const binarySha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
    if (binarySha256 !== PINNED_CODEX_SHA256) throw Error('pinned Codex binary hash mismatch');
    return Object.freeze({ binary, binarySha256, binarySource: source });
  }
  if (env.CUE_VENDOR_CODEX !== undefined) {
    if (!env.CUE_VENDOR_CODEX || !isAbsolute(env.CUE_VENDOR_CODEX)) throw Error('pinned Codex binary override must be absolute');
    // An explicit mismatch is an error, never permission to select another binary.
    return measure(env.CUE_VENDOR_CODEX, 'explicit');
  }
  const candidates = [];
  if (env.APPDATA && isAbsolute(env.APPDATA)) candidates.push([
    join(env.APPDATA, 'npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe'), 'npm-global',
  ]);
  if (env.LOCALAPPDATA && isAbsolute(env.LOCALAPPDATA)) candidates.push([
    join(env.LOCALAPPDATA, 'Programs/OpenAI/Codex/bin/codex.exe'), 'standalone',
  ]);
  for (const [binary, source] of candidates) {
    try { return measure(binary, source); } catch { /* Try only the other fixed location against the same pin. */ }
  }
  throw Error('pinned Codex 0.154.0 is unavailable at the standard locations; set CUE_VENDOR_CODEX to an independently verified pinned executable');
}
