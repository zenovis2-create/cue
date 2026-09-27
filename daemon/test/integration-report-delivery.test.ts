import { afterEach, expect, test, vi } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceReport } from '../src/reports/ir.js';
import { renderReportHtml } from '../src/reports/html.js';
import { createReportDelivery } from '../src/reports/delivery.js';
const fault = vi.hoisted(() => ({ rename: false, readback: false }));
vi.mock('node:fs', async importOriginal => {
  const original = await importOriginal<typeof import('node:fs')>();
  return { ...original, renameSync: (...args: Parameters<typeof original.renameSync>) => {
    if (fault.rename) throw new Error('injected-rename-failure'); return original.renameSync(...args);
  }, readFileSync: (...args: Parameters<typeof original.readFileSync>) => {
    if (fault.readback && String(args[0]).endsWith('.tmp')) return Buffer.from('corrupt');
    return original.readFileSync(...args);
  } };
});
const dirs: string[] = [];
afterEach(() => { fault.rename = false; fault.readback = false; dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
function fixture() { const dir = mkdtempSync(join(tmpdir(), 'cue-report-')); dirs.push(dir); return { dir, delivery: createReportDelivery(dir) }; }
const report = (label = 'Cue') => sourceReport(JSON.stringify({ identity: 'cue', revision: 'a'.repeat(40), files: [], nodes: [{ id: 'cue', label }], edges: [] }));
test('delivers and replaces exact HTML with matching content hashes and explicit directory durability limit', () => {
  const { dir, delivery } = fixture(); const first = report(), second = report('updated');
  delivery.deliver('report', first, renderReportHtml(first));
  const result = delivery.deliver('report', second, renderReportHtml(second));
  expect(readFileSync(join(dir, 'report.html'), 'utf8')).toBe(renderReportHtml(second).html);
  expect(result).toMatchObject({ status: 'delivered', fileSynced: true, directorySynced: false, browserEvidence: 'not-run' });
  expect(readdirSync(dir)).toEqual(['report.html']);
});
test.each(['../escape', 'dir/file', 'x.html', 'C:escape', 'CON', 'nul', 'a'.repeat(81)])('rejects caller path or unsafe report ID %s', id => {
  const { dir, delivery } = fixture(); const r = report();
  expect(() => delivery.deliver(id, r, renderReportHtml(r))).toThrow('rejected'); expect(readdirSync(dir)).toEqual([]);
});
test('mismatched hash, arbitrary HTML and getter/proxy artifacts preserve last good bytes', () => {
  const { dir, delivery } = fixture(), r = report(), artifact = renderReportHtml(r);
  delivery.deliver('report', r, artifact); let reads = 0;
  for (const changed of [{ ...artifact, artifactSha256: '0'.repeat(64) }, { ...artifact, html: '<script>bad</script>' },
    Object.defineProperty({ ...artifact }, 'html', { get() { reads++; return artifact.html; } }), new Proxy(artifact, {})]) {
    expect(() => delivery.deliver('report', r, changed)).toThrow();
  }
  expect(reads).toBe(0); expect(readFileSync(join(dir, 'report.html'), 'utf8')).toBe(artifact.html);
});
test.each(['rename', 'readback'] as const)('%s failure keeps previous report and removes private candidate', kind => {
  const { dir, delivery } = fixture(), r = report(), next = report('new');
  delivery.deliver('report', r, renderReportHtml(r)); fault[kind] = true;
  expect(() => delivery.deliver('report', next, renderReportHtml(next))).toThrow(); fault[kind] = false;
  expect(readFileSync(join(dir, 'report.html'), 'utf8')).toBe(renderReportHtml(r).html);
  expect(readdirSync(dir)).toEqual(['report.html']);
});
test('junction roots and non-file destinations are refused without changing outside files', () => {
  const { dir, delivery } = fixture(), r = report(); const outside = mkdtempSync(join(tmpdir(), 'cue-outside-')); dirs.push(outside);
  const linked = join(dir, 'linked'); symlinkSync(outside, linked, 'junction');
  expect(() => createReportDelivery(linked)).toThrow();
  mkdirSync(join(dir, 'report.html')); expect(() => delivery.deliver('report', r, renderReportHtml(r))).toThrow();
  expect(readdirSync(outside)).toEqual([]);
});
