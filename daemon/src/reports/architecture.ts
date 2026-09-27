import { assertReport, type ReportIR } from './ir.js';

const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Display projection of validated source IR. Directory labels come only from
 * node IDs; this does not resolve runtime calls, external dependencies or layers. */
export function sourceArchitecture(report: ReportIR): string {
  assertReport(report);
  if (report.kind !== 'source') throw Error('source_report_required');
  const directories = new Map<string, string[]>();
  for (const node of report.nodes) {
    const split = node.id.lastIndexOf('/'), directory = split < 0 ? '(루트)' : node.id.slice(0, split);
    const entries = directories.get(directory) ?? []; entries.push(node.id); directories.set(directory, entries);
  }
  const ranked = [...directories].sort((a,b) => b[1].length-a[1].length || order(a[0],b[0]));
  const overflow = ranked.length > 8;
  const selected = ranked.slice(0, overflow ? 7 : 8).sort((a,b) => order(a[0],b[0]));
  const groups = selected.map(([label,nodes]) => ({ label, nodes, directories: [label] }));
  if (overflow) {
    const remainder = ranked.slice(7);
    groups.push({ label: `기타 ${remainder.length}개 디렉터리`, nodes: remainder.flatMap(([,nodes]) => nodes), directories: remainder.map(([name]) => name).sort(order) });
  }
  const memberships = new Map<string, number>(); groups.forEach((g,i) => g.nodes.forEach(id => memberships.set(id,i)));
  const matrix = groups.map(() => groups.map(() => 0)), distinct = new Set<string>();
  for (const edge of report.edges) {
    const key = JSON.stringify([edge.from,edge.to]); if (distinct.has(key)) continue; distinct.add(key);
    matrix[memberships.get(edge.from)!]![memberships.get(edge.to)!]++;
  }
  const n = groups.length, cell = 44, left = 74, top = 56, width = Math.max(250,left+n*cell+20), height = top+n*cell+16;
  const svg = groups.map((g,i) => `<text x="${left+i*cell+22}" y="36" text-anchor="middle">G${i+1}</text><text x="54" y="${top+i*cell+27}" text-anchor="end">G${i+1}</text>`).join('')
    + matrix.map((row,i) => row.map((count,j) => `<g><title>${escape(groups[i]!.label)} → ${escape(groups[j]!.label)}: ${count}개 고유 관계</title><rect class="${count?'matrix-filled':'matrix-empty'}" x="${left+j*cell}" y="${top+i*cell}" width="40" height="40" rx="5"/><text x="${left+j*cell+20}" y="${top+i*cell+26}" text-anchor="middle">${count||'·'}</text></g>`).join('')).join('');
  const alternatives = matrix.flatMap((row,i) => row.map((count,j) => count ? `<li>G${i+1} → G${j+1}: ${count}개 고유 관계 (${escape(groups[i]!.label)} → ${escape(groups[j]!.label)})</li>` : '')).join('');
  return `<section class="architecture" aria-labelledby="architecture-heading"><h2 id="architecture-heading">디렉터리별 소스 관계</h2><p class="architecture-total">${report.nodes.length}개 파일/노드 · ${directories.size}개 디렉터리 · ${report.edges.length}개 IR 관계 · ${distinct.size}개 고유 파일 쌍</p><p>행에서 열로 향하는 선언 관계 수입니다. 같은 그룹 내부 관계도 대각선에 표시합니다. 실행 호출·계층·안전성이 아닌 <strong>미검증 소스 대응</strong>입니다.</p>${overflow?`<p class="architecture-overflow">표시 한도 8그룹: 파일 수가 많은 7개 디렉터리와 나머지 ${ranked.length-7}개를 ‘기타’로 묶었습니다. 전체 목록은 아래에 보존합니다.</p>`:''}<div class="architecture-layout"><svg class="architecture-matrix" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="matrix-title matrix-description"><title id="matrix-title">디렉터리 그룹 간 미검증 소스 관계 행렬</title><desc id="matrix-description">행이 출발 그룹이고 열이 도착 그룹입니다. 숫자는 고유 파일 쌍 수이며 점은 관계 없음입니다. 그룹 이름과 파일 수는 옆 목록, 같은 집계의 텍스트는 아래에 있습니다.</desc>${svg}</svg><ul class="architecture-groups">${groups.map((g,i) => `<li data-group="${i}" data-count="${g.nodes.length}"><strong>G${i+1}</strong><span>${escape(g.label)}</span><small>${g.nodes.length}개 파일/노드</small></li>`).join('')}</ul></div><details class="architecture-alternative"><summary>그룹 구성과 관계 집계 · 텍스트 대안</summary><ul>${groups.map((g,i) => `<li>G${i+1}: ${g.directories.map(escape).join(', ')} · ${g.nodes.length}개 파일/노드</li>`).join('')}</ul><ul>${alternatives||'<li>관계 없음</li>'}</ul></details></section>`;
}
