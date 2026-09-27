import { closeSync, constants, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { types } from 'node:util';
import type { ReportIR } from './ir.js';
import { renderReportHtml } from './html.js';

const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
function fail(): never { throw new Error('report_delivery_rejected'); }
function inspectRoot(root: string): void {
  let current = root;
  for (;;) {
    const info = lstatSync(current);
    if (!info.isDirectory() || info.isSymbolicLink()) fail();
    if (current === parse(current).root) break;
    current = dirname(current);
  }
  if (realpathSync(root).toLowerCase() !== root.toLowerCase()) fail();
}

/** The host must own this existing directory and all ancestor entries exclusively:
 * no agent/plugin/untrusted process may mutate them during delivery. Path checks
 * detect links but are not an OS sandbox or a defense against a hostile root owner.
 * No path or grant is accepted per delivery. Directory metadata crash durability
 * is not promised on Windows; file content is fsynced before atomic replacement.
 */
export function createReportDelivery(outputRoot: string) {
  if (typeof outputRoot !== 'string' || !isAbsolute(outputRoot)) fail();
  const root = resolve(outputRoot); inspectRoot(root);
  const identity = lstatSync(root);
  return Object.freeze({
    deliver(reportId: string, report: ReportIR, artifact: ReturnType<typeof renderReportHtml>) {
      if (typeof reportId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(reportId) || /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(reportId)) fail();
      // Re-render the branded immutable IR. A caller's hash never authenticates
      // arbitrary HTML, and property access on an untrusted artifact is avoided.
      const expected = renderReportHtml(report);
      if (!artifact || typeof artifact !== 'object' || types.isProxy(artifact) || expected.artifactBytes > 33554432) fail();
      const descriptors = Object.getOwnPropertyDescriptors(artifact);
      for (const key of ['html', 'specificationSha256', 'specificationBytes', 'artifactSha256', 'artifactBytes'] as const) {
        const entry = descriptors[key];
        if (!entry || !Object.hasOwn(entry, 'value') || entry.value !== expected[key]) fail();
      }
      inspectRoot(root);
      const current = lstatSync(root);
      if (current.dev !== identity.dev || current.ino !== identity.ino) fail();
      const destination = join(root, `${reportId}.html`);
      try { const existing = lstatSync(destination); if (!existing.isFile() || existing.isSymbolicLink()) fail(); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const temporary = join(root, `.cue-report-${randomUUID()}.tmp`);
      let fd: number | null = null, committed = false;
      try {
        fd = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR, 0o600);
        writeFileSync(fd, expected.html, 'utf8');
        fsyncSync(fd);
        // Reading via filename gets fresh bytes independently of the write cursor.
        const bytes = readFileSync(temporary);
        if (bytes.length !== expected.artifactBytes || digest(bytes) !== expected.artifactSha256) fail();
        closeSync(fd); fd = null;
        inspectRoot(root);
        const finalRoot = lstatSync(root);
        if (finalRoot.dev !== identity.dev || finalRoot.ino !== identity.ino) fail();
        renameSync(temporary, destination); committed = true;
        return Object.freeze({ reportId, artifactSha256: expected.artifactSha256, artifactBytes: expected.artifactBytes,
          specificationSha256: expected.specificationSha256, specificationBytes: expected.specificationBytes,
          status: 'delivered' as const, fileSynced: true, directorySynced: false,
          crashDurability: 'directory-metadata-not-guaranteed', upstreamValidation: 'not-run', browserEvidence: 'not-run', visualReview: 'not-run' });
      } finally {
        if (fd !== null) closeSync(fd);
        if (!committed) { try { unlinkSync(temporary); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }
      }
    },
  });
}
