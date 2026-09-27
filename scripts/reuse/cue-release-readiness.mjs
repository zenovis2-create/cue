import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sourcePaths = Object.freeze({
  checklist: 'docs/INTEGRATION_CHECKLIST.md',
  specification: 'docs/INTEGRATION_SPEC.md',
  executionMap: 'docs/integration/REMAINING_EXECUTION_MAP.md',
});
const fail = reason => { throw new Error(`release_readiness:${reason}`); };
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function boundedFile(path, max = 8 * 1024 * 1024) {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > max) fail('invalid_source');
  const bytes = readFileSync(path);
  if (bytes.length !== info.size) fail('source_changed');
  return bytes;
}

export function parseChecklist(markdown, checklistPath, evidenceRoot) {
  const sections = new Map();
  let current = null;
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const title = heading[1];
      const stage = /^S([0-7])\b/.exec(title)?.[1];
      const id = stage === undefined ? (title.includes('공통 게이트') ? 'common' : title.includes('출시 인수') ? 'launch' : null) : `S${stage}`;
      current = id ? { id, title, items: [] } : null;
      if (current) sections.set(id, current);
      continue;
    }
    if (!current) continue;
    const item = /^-\s+\[([ xX])\]\s+(.+)$/.exec(line);
    if (!item) continue;
    const links = [...item[2].matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(match => match[1]).filter(target => !/^[a-z]+:/i.test(target) && !target.startsWith('#'));
    const references = links.map(target => {
      const absolute = resolve(dirname(checklistPath), decodeURIComponent(target.split('#')[0]));
      const inside = relative(evidenceRoot, absolute);
      if (inside.startsWith('..') || resolve(evidenceRoot, inside) !== absolute) return { target, state: 'unverified', reason: 'outside-evidence-root' };
      if (!existsSync(absolute)) return { target, state: 'missing', reason: 'not-found' };
      try { const bytes = boundedFile(absolute); return { target, state: 'verified-present', sha256: sha256(bytes) }; }
      catch { return { target, state: 'unverified', reason: 'invalid-evidence-file' }; }
    });
    current.items.push({ line: index + 1, checked: item[1] !== ' ', text: item[2], references });
  }
  for (const id of ['common', 'S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'launch']) if (!sections.has(id)) fail(`missing_section:${id}`);
  return sections;
}

function summarize(id, sections) {
  const section = sections.get(id);
  const unchecked = section.items.filter(item => !item.checked);
  const checkedWithoutEvidence = section.items.filter(item => item.checked && item.references.length === 0).map(item => ({ target: `checklist-line:${item.line}`, state: 'unverified', reason: 'checked-item-without-evidence-reference' }));
  const badReferences = [...section.items.flatMap(item => item.references).filter(reference => reference.state !== 'verified-present'), ...checkedWithoutEvidence];
  const state = unchecked.length ? 'missing' : !section.items.length || badReferences.length ? 'unverified' : 'documented';
  return { id, title: section.title, state, evidenceReferences: section.items.flatMap(item => item.references), checkedCount: section.items.length - unchecked.length, totalCount: section.items.length,
    unchecked: unchecked.map(item => ({ line: item.line, text: item.text, references: item.references })), badReferences };
}

export function buildReadiness({ checklist, specification, executionMap, expectedHashes, checklistPath = resolve(repo, sourcePaths.checklist), evidenceRoot = resolve(repo, 'evidence') }) {
  const inputs = { checklist: Buffer.from(checklist), specification: Buffer.from(specification), executionMap: Buffer.from(executionMap) };
  const text = Object.fromEntries(Object.entries(inputs).map(([name, bytes]) => [name, bytes.toString('utf8')]));
  const sources = Object.fromEntries(Object.entries(inputs).map(([name, bytes]) => [name, { path: sourcePaths[name], sha256: sha256(bytes), bytes: bytes.length }]));
  for (const name of Object.keys(inputs)) if (!expectedHashes?.[name] || sources[name].sha256 !== String(expectedHashes[name]).toLowerCase()) fail(`source_pin_mismatch:${name}`);
  if (!text.specification.includes('첫 제품 이정표는 S0~S4') || !text.specification.includes('S5 개선을 입증하기 전에는') || !text.specification.includes('S6~S7은 확장/설명 계층')) fail('spec_acceptance_clause');
  if (!/\|\s*A07\s*\|[^\n]+S0~S4[^\n]+S5[^\n]+S6~S7/.test(text.executionMap)) fail('execution_map_a07');
  const sections = parseChecklist(text.checklist, checklistPath, evidenceRoot);
  const common = summarize('common', sections), launch = summarize('launch', sections);
  const stage = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`S${index}`, summarize(`S${index}`, sections)]));
  const combine = ids => ids.some(id => stage[id].state === 'missing') ? 'missing' : ids.some(id => stage[id].state === 'unverified') ? 'unverified' : 'documented';
  const firstMilestone = combine(['S0', 'S1', 'S2', 'S3', 'S4']);
  const efficiencyProof = stage.S5.state;
  const extensionComponents = combine(['S6', 'S7']);
  const dependencies = { commonGate: common.state, launchAcceptance: launch.state };
  // Checklist and file presence establish documentation only, never runtime or empirical qualification.
  const releaseState = 'not-ready';
  return Object.freeze({ schemaVersion: 1, kind: 'cue-release-readiness', generatedAt: null, sources, qualification: 'not-assessed', milestones: {
    firstMilestone: { label: 'S0–S4 first product milestone', state: firstMilestone, stages: ['S0', 'S1', 'S2', 'S3', 'S4'] },
    efficiencyProof: { label: 'S5 efficiency proof', state: efficiencyProof, stages: ['S5'], claim: 'not-proven' },
    extensions: { label: 'S6–S7 extension components', componentState: extensionComponents, releaseState: 'not-release-qualified', stages: ['S6', 'S7'] },
  }, dependencies, release: { state: releaseState, claim: 'all-product' }, stages: stage,
    note: 'Developer/release evidence projection only. Documented means checked with present evidence files; evidence content and freshness are not qualified. It grants no execution, publication, empirical proof, or completion authority.' });
}

export function renderReadinessHtml(report) {
  const rows = [report.milestones.firstMilestone, report.milestones.efficiencyProof].map(value => `<tr><th>${escapeHtml(value.label)}</th><td>${escapeHtml(value.state)}</td><td>${escapeHtml(value.stages.join(', '))}</td></tr>`).join('') +
    `<tr><th>${escapeHtml(report.milestones.extensions.label)}</th><td>${escapeHtml(report.milestones.extensions.componentState)} component / ${escapeHtml(report.milestones.extensions.releaseState)}</td><td>S6, S7</td></tr>`;
  const stageDetails = Object.values(report.stages).map(stage => `<section><h3>${escapeHtml(stage.id)} · ${escapeHtml(stage.state)}</h3><p>${stage.checkedCount} checked of ${stage.totalCount}; ${stage.unchecked.length} unchecked.</p><ul>${stage.unchecked.map(item => `<li>Line ${item.line}: ${escapeHtml(item.text)}</li>`).join('')}</ul></section>`).join('');
  const sourceRows = Object.values(report.sources).map(source => `<li>${escapeHtml(source.path)} · sha256 ${escapeHtml(source.sha256)} · ${source.bytes} bytes</li>`).join('');
  const style = 'body{font:16px system-ui;margin:2rem;max-width:1100px;color:#17212b}h1{margin-bottom:.2rem}.verdict{padding:1rem;background:#fee;border-left:6px solid #b22}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbc;padding:.6rem;text-align:left}section{border-top:1px solid #ccd;margin-top:1rem}code{overflow-wrap:anywhere}';
  const csp = `default-src 'none'; style-src 'sha256-${createHash('sha256').update(style).digest('base64')}'; img-src 'none'; script-src 'none'; connect-src 'none'; frame-src 'none'`;
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + csp + '"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cue release readiness</title><style>' + style + '</style></head><body><h1>Cue milestone readiness</h1><p class="verdict"><strong>All-product: ' + escapeHtml(report.release.state.toUpperCase()) + '</strong><br>S5 optimizer: ' + escapeHtml(report.milestones.efficiencyProof.claim.toUpperCase()) + '<br>Common gate: ' + escapeHtml(report.dependencies.commonGate) + '; launch acceptance: ' + escapeHtml(report.dependencies.launchAcceptance) + '</p><table><thead><tr><th>Milestone</th><th>State</th><th>Scope</th></tr></thead><tbody>' + rows + '</tbody></table><h2>Checklist evidence</h2>' + stageDetails + '<h2>Source pins</h2><ul>' + sourceRows + '</ul><p>' + escapeHtml(report.note) + '</p></body></html>';
}

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) { if (!args[index]?.startsWith('--') || args[index + 1] === undefined) fail('arguments'); values[args[index].slice(2)] = args[index + 1]; }
  return values;
}

export function readinessGenerationId(report, generatorBytes) {
  return sha256(Buffer.from(JSON.stringify({report, generatorSha256:sha256(generatorBytes)})));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = args.output && resolve(repo, args.output);
  if (!output || relative(repo, output).startsWith('..')) fail('output');
  const expectedHashes = { checklist: args['checklist-sha256'], specification: args['spec-sha256'], executionMap: args['map-sha256'] };
  const before = Object.fromEntries(Object.entries(sourcePaths).map(([name, path]) => [name, boundedFile(resolve(repo, path))]));
  const report = buildReadiness({ ...before, expectedHashes });
  const after = Object.fromEntries(Object.entries(sourcePaths).map(([name, path]) => [name, boundedFile(resolve(repo, path))]));
  for (const name of Object.keys(before)) if (sha256(before[name]) !== sha256(after[name])) fail(`source_changed:${name}`);
  const generatorBytes = boundedFile(fileURLToPath(import.meta.url));
  const generationId = readinessGenerationId(report, generatorBytes);
  const generation = join(output, 'generations', generationId);
  mkdirSync(generation, { recursive: true });
  const json = Buffer.from(JSON.stringify(report, null, 2) + '\n'), html = Buffer.from(renderReadinessHtml(report));
  const jsonPath = join(generation, 'release-readiness.json'), htmlPath = join(generation, 'release-readiness.html');
  writeFileSync(jsonPath, json, { flag: 'wx' });
  try { writeFileSync(htmlPath, html, { flag: 'wx' }); }
  catch (error) { try { unlinkSync(jsonPath); } catch {} throw error; }
  const manifest = { schemaVersion: 1, generation: generationId, generatorSha256: sha256(generatorBytes), sources: report.sources, files: [
    { name: 'release-readiness.json', sha256: sha256(json), bytes: json.length },
    { name: 'release-readiness.html', sha256: sha256(html), bytes: html.length },
  ] };
  writeFileSync(join(generation, 'generation.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(join(output, 'current-generation.json'), JSON.stringify({ schemaVersion: 1, generation: `generations/${generationId}`, manifestSha256: sha256(Buffer.from(JSON.stringify(manifest, null, 2) + '\n')) }, null, 2) + '\n');
  console.log(JSON.stringify({ state: report.release.state, generation: generationId, jsonSha256: sha256(json), htmlSha256: sha256(html) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
