import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { closeSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { sourceReport } from '../../daemon/dist/src/reports/ir.js';
import { renderReportHtml } from '../../daemon/dist/src/reports/html.js';
import { createReportDelivery } from '../../daemon/dist/src/reports/delivery.js';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(repo, 'daemon/package.json'));
const { parseSync } = require('rolldown/utils');
const parserVersion = require('rolldown').VERSION;
const roots = ['app', 'daemon/src'];
const excluded = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.venv', '__pycache__']);
const limits = { files: 256, edges: 4096, entries: 8192, fileBytes: 1048576, totalBytes: 33554432 };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const slash = path => path.replaceAll('\\', '/');
const under = path => roots.some(root => path.startsWith(`${root}/`));
const fail = reason => { throw Error(`source_report:${reason}`); };

export function extractionMetadata() {
  const parserPaths = [...new Set([require.resolve('rolldown/utils'), ...Object.keys(require.cache).filter(p => p.endsWith('.node') && p.includes('rolldown'))])];
  return Object.freeze({ limits: Object.freeze({ ...limits }), parser: Object.freeze({ name: 'rolldown/utils.parseSync', version: parserVersion,
    api: 'https://rolldown.rs/reference/Function.parseSync', identities: Object.freeze(parserPaths.map(path => Object.freeze({ path: slash(relative(repo, path)), sha256: sha(readFileSync(path)) }))) }) });
}

function readBounded(path) {
  if (lstatSync(path).isSymbolicLink()) fail('symlink');
  const fd = openSync(path, 'r');
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size > limits.fileBytes) fail('file_limit');
    const bytes = Buffer.alloc(before.size + 1); let size = 0;
    while (size < bytes.length) { const read = readSync(fd, bytes, size, bytes.length - size, size); if (!read) break; size += read; }
    const after = fstatSync(fd);
    if (size !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ino !== before.ino) fail('changed');
    return bytes.subarray(0, size);
  } finally { closeSync(fd); }
}
function inventory(root) {
  if (!isAbsolute(root) || realpathSync(root).toLowerCase() !== resolve(root).toLowerCase() || lstatSync(root).isSymbolicLink()) fail('root');
  const files = [], skipped = []; let entries = 0;
  const visit = dir => {
    if (lstatSync(dir).isSymbolicLink()) { skipped.push(slash(relative(root, dir))); return; }
    for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      if (++entries > limits.entries) fail('entry_limit');
      const path = join(dir, item.name), logical = slash(relative(root, path));
      if (excluded.has(item.name)) continue;
      if (item.isSymbolicLink()) { skipped.push(logical); continue; }
      if (item.isDirectory()) visit(path);
      else if (item.isFile() && /\.(?:[cm]?[jt]s|tsx|jsx)$/.test(item.name)) {
        if (!under(logical) || !/^[A-Za-z0-9._/-]{1,128}$/.test(logical)) fail('path');
        files.push(logical); if (files.length > limits.files) fail('file_limit');
      }
    }
  };
  for (const sourceRoot of roots) {
    let cursor = root;
    for (const segment of sourceRoot.split('/')) { cursor = join(cursor, segment); if (lstatSync(cursor).isSymbolicLink()) fail('root_symlink'); }
    visit(cursor);
  }
  return { files: files.sort(), skipped: skipped.sort() };
}
export function captureSource(root) {
  root = resolve(root); const before = inventory(root); let total = 0;
  const files = before.files.map(path => {
    const bytes = readBounded(join(root, path)); total += bytes.length; if (total > limits.totalBytes) fail('total_limit');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { path, sha256: sha(bytes), byteLength: bytes.length, text };
  });
  const metadata = files.map(({ path, sha256, byteLength }) => ({ path, sha256, byteLength }));
  return { root, inventory: before, files, digest: sha(JSON.stringify({ inventory: before, files: metadata })) };
}
export function verifySource(snapshot) {
  const current = captureSource(snapshot.root);
  if (current.digest !== snapshot.digest) fail('changed');
}
function imports(file) {
  // Filename inference preserves declaration-file (dts) grammar as well as TS/JS.
  const parsed = parseSync(file.path, file.text);
  if (parsed.errors.length) fail(`parse_error:${file.path}`);
  const found = [], stack = [parsed.program]; let count = 0;
  while (stack.length) {
    const node = stack.pop(); if (!node || typeof node !== 'object') continue;
    if (++count > 200000) fail('ast_limit');
    let specifier, kind;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) { specifier = node.source.value; kind = node.importKind === 'type' || node.exportKind === 'type' ? 'type-declaration' : 'static-declaration'; }
    else if (node.type === 'TSExternalModuleReference') { specifier = node.expression?.value; kind = 'ts-import-equals'; }
    else if (node.type === 'TSImportType') { specifier = node.argument?.value ?? node.argument?.literal?.value; kind = 'type-query'; }
    else if (node.type === 'ImportExpression') { specifier = node.source?.value; kind = 'dynamic-syntax'; }
    else if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'require') { specifier = node.arguments?.[0]?.value; kind = 'require-syntax-not-binding-resolved'; }
    if (kind) found.push({ specifier: typeof specifier === 'string' ? specifier : null, kind, offset: node.start });
    for (const [key, child] of Object.entries(node)) if (!['comments', 'loc', 'range'].includes(key)) {
      if (Array.isArray(child)) stack.push(...child); else if (child && typeof child === 'object') stack.push(child);
    }
  }
  return found.sort((a, b) => a.offset - b.offset);
}
export function extractGraph(snapshot) {
  const paths = new Set(snapshot.files.map(f => f.path)), importsFound = [], edges = new Map();
  for (const file of snapshot.files) for (const entry of imports(file)) {
    let target = null, resolution = 'nonliteral-unresolved'; const spec = entry.specifier;
    if (spec !== null) {
      resolution = 'external-unresolved';
      if (spec.startsWith('.')) {
        const exact = slash(relative(snapshot.root, resolve(snapshot.root, dirname(file.path), spec)));
        if (!under(exact)) resolution = 'outside-source-roots';
        else if (paths.has(exact)) { target = exact; resolution = 'exact-source-path'; }
        else {
          const replacement = exact.endsWith('.js') ? exact.slice(0, -3) + '.ts' : exact.endsWith('.mjs') ? exact.slice(0, -4) + '.mts' : exact.endsWith('.cjs') ? exact.slice(0, -4) + '.cts' : null;
          if (replacement && paths.has(replacement)) { target = replacement; resolution = 'source-extension-counterpart-not-runtime-resolution'; }
          else resolution = 'relative-unresolved';
        }
      }
    }
    const record = { from: file.path, ...entry, target, resolution }; importsFound.push(record);
    if (importsFound.length > limits.edges) fail('import_limit');
    if (target) { const id = sha(JSON.stringify([file.path, target])); edges.set(id, { id, from: file.path, to: target }); }
  }
  return { imports: importsFound, edges: [...edges.values()].sort((a, b) => a.id < b.id ? -1 : 1) };
}
function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'cue-source-report-'));
  try {
    mkdirSync(join(root, 'app')); mkdirSync(join(root, 'daemon/src'), { recursive: true });
    writeFileSync(join(root, 'app/a.ts'), 'import type {X} from "../daemon/src/b.js"; import "../../outside.js"; const text="import fake"; import(name); require("node:fs");');
    writeFileSync(join(root, 'daemon/src/b.ts'), 'export interface X {}');
    writeFileSync(join(root, 'app/types.d.mts'), 'export const known: string;');
    const first = captureSource(root), graph = extractGraph(first); verifySource(first);
    assert.equal(graph.edges.length, 1); assert.equal(graph.imports.length, 4);
    assert(graph.imports.some(i => i.resolution === 'outside-source-roots'));
    assert(graph.imports.some(i => i.resolution === 'nonliteral-unresolved'));
    writeFileSync(join(root, 'daemon/src/b.ts'), 'export interface Changed {}'); assert.throws(() => verifySource(first), /changed/);
    const second = captureSource(root); writeFileSync(join(root, 'app/new.js'), ''); assert.throws(() => verifySource(second), /changed/);
    symlinkSync(join(root, 'daemon/src'), join(root, 'app/linked'), 'junction'); assert(captureSource(root).inventory.skipped.includes('app/linked'));
    writeFileSync(join(root, 'app/bad name.ts'), ''); assert.throws(() => captureSource(root), /path/);
    console.log('self-test PASS: AST/type/external/nonliteral, changed bytes/inventory, symlink skip, badpath');
  } finally { rmSync(root, { recursive: true, force: true }); }
}
function main() {
  if (process.argv[2] === '--self-test') return selfTest();
  if (process.argv.length > 2) fail('unknown_argument');
  const snapshot = captureSource(repo), graph = extractGraph(snapshot);
  const input = { identity: 'cue-static-source-imports', revision: snapshot.digest,
    files: snapshot.files.map(({ path, sha256 }) => ({ path, sha256 })),
    nodes: snapshot.files.map(f => ({ id: f.path, label: `${f.path} · 정적 문법 추출, 실행/영향 미검증` })), edges: graph.edges };
  const report = sourceReport(JSON.stringify(input)); const artifact = renderReportHtml(report);
  verifySource(snapshot);
  const output = join(repo, 'evidence/integrations/S7/20260911-source-structure'); mkdirSync(output, { recursive: true });
  const receipt = createReportDelivery(output).deliver('cue-source-structure', report, artifact);
  const metadata = extractionMetadata();
  const evidence = { snapshotDigest: snapshot.digest, ...metadata, inventory: snapshot.inventory, fileCount: snapshot.files.length, edgeCount: graph.edges.length,
    scope: 'Static JS/TS syntax only; source-extension counterparts are not runtime resolution; require names not binding-resolved; no execution, influence or safety claim; dirty workspace digest not Git commit.',
    receipt, ...graph };
  writeFileSync(join(output, 'source.json'), JSON.stringify(input, null, 2));
  writeFileSync(join(output, 'result.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ fileCount: evidence.fileCount, edgeCount: evidence.edgeCount, snapshotDigest: snapshot.digest, artifactSha256: receipt.artifactSha256, parser: parserVersion }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
