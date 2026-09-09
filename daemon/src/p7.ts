import type { Ledger } from './ledger.js';

export interface ResultRecord {
  readonly artifactId: string;
  readonly version: number;
  readonly title: string;
  readonly summary: string;
  readonly details: readonly string[];
}

export const allowedHtmlComponents = Object.freeze(['article', 'heading', 'paragraph', 'list'] as const);
type HtmlNode =
  | { readonly component: 'article'; readonly children: readonly HtmlNode[] }
  | { readonly component: 'heading'; readonly text: string }
  | { readonly component: 'paragraph'; readonly text: string }
  | { readonly component: 'list'; readonly items: readonly string[] };

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function renderHtmlNode(value: unknown): string {
  if (!value || typeof value !== 'object' || !('component' in value) || !allowedHtmlComponents.includes((value as {component:string}).component as never)) throw new Error('component not allowed');
  const node = value as HtmlNode;
  if (node.component === 'article') return `<article>${node.children.map(renderHtmlNode).join('')}</article>`;
  if (node.component === 'heading') return `<h1>${escapeHtml(node.text)}</h1>`;
  if (node.component === 'paragraph') return `<p>${escapeHtml(node.text)}</p>`;
  return `<ul>${node.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function renderKoreanSummary(record: ResultRecord): string { return `${record.title}: ${record.summary} (v${record.version})`; }
export function renderDetailedReport(record: ResultRecord): string { return [record.title, record.summary, ...record.details, `artifact=${record.artifactId}@${record.version}`].join('\n'); }
export function renderResultHtml(record: ResultRecord): string {
  return renderHtmlNode({component:'article', children:[{component:'heading',text:record.title},{component:'paragraph',text:record.summary},{component:'list',items:record.details}]});
}

export interface PublishItem { readonly name: string; readonly fields: Readonly<Record<string,string>> }
export type SecretScanner = (items: readonly PublishItem[]) => void;
export type ArtifactShare = (items: readonly PublishItem[]) => Promise<string>;
const secretPatterns = [
  /\b(?:token|bearer)\s*[:= ]\s*\S+/iu,
  /\b(?:api[_-]?key|secret[_-]?key)\s*[:= ]\s*\S+/iu,
  /(?:^|[\\/])\.env(?:\b|[\\/])|(?:^|\n)\s*[A-Z][A-Z0-9_]*\s*=\s*\S+/u,
  /(?:[A-Za-z]:\\Users\\|\/Users\/|\/home\/)[^\\/\s]+[\\/]/u,
] as const;
export const scanPublishItems: SecretScanner = items => {
  const text = items.flatMap(item => [item.name, ...Object.entries(item.fields).flat()]).join('\n');
  if (secretPatterns.some(pattern => pattern.test(text))) throw new Error('sensitive content');
};

export class PublishGate {
  private stage = 0;
  private items: readonly PublishItem[] = [];
  constructor(private readonly scanner: SecretScanner, private readonly shareAdapter: ArtifactShare) {}
  list(items: readonly PublishItem[]): readonly {name:string;fields:readonly string[]}[] {
    if (this.stage !== 0) throw new Error('publish steps out of order');
    this.items=items; this.stage=1;
    return items.map(item=>({name:item.name,fields:Object.keys(item.fields)}));
  }
  scan(): void { if(this.stage!==1) throw new Error('publish steps out of order'); this.scanner(this.items); this.stage=2; }
  preview(): string { if(this.stage!==2) throw new Error('publish steps out of order'); this.stage=3; return this.items.map(item=>item.name).join('\n'); }
  approveByHuman(): void { if(this.stage!==3) throw new Error('publish steps out of order'); this.stage=4; }
  async share(): Promise<string> { if(this.stage!==4) throw new Error('human approval required'); const result=await this.shareAdapter(this.items); this.stage=5; return result; }
}

interface AnnotationBase { readonly id:string; readonly taskId:string; readonly screenshotId:string; readonly koreanText:string; readonly urlLabel?:string; readonly selector?:string; readonly createdAt:string }
export type WorkAnnotation = AnnotationBase & { readonly surface:'work'; readonly pageId:string; readonly artifactId?:never; readonly artifactVersion?:never };
export type ExplainAnnotation = AnnotationBase & { readonly surface:'explain'; readonly artifactId:string; readonly artifactVersion:number; readonly pageId?:never };
export type AnnotationRecord = WorkAnnotation | ExplainAnnotation;

export function parseAnnotation(value: unknown): AnnotationRecord {
  if (!value || typeof value !== 'object') throw new Error('invalid annotation');
  const row=value as Record<string,unknown>;
  const common=typeof row.id==='string' && typeof row.taskId==='string' && typeof row.screenshotId==='string' && typeof row.koreanText==='string' && row.koreanText.trim() && typeof row.createdAt==='string';
  if (!common || (row.surface!=='work' && row.surface!=='explain')) throw new Error('surface required');
  if (row.surface==='work' && typeof row.pageId==='string' && row.pageId.trim() && row.artifactId===undefined && row.artifactVersion===undefined) return value as WorkAnnotation;
  if (row.surface==='explain' && typeof row.artifactId==='string' && row.artifactId.trim() && Number.isInteger(row.artifactVersion) && (row.artifactVersion as number)>0 && row.pageId===undefined) return value as ExplainAnnotation;
  throw new Error('exclusive annotation identity required');
}

export interface AnnotationTask { readonly surface:'work'|'explain'; readonly imageId:string; readonly instruction:string; readonly identity:string }
export function annotationToTask(annotation: AnnotationRecord): AnnotationTask {
  return {surface:annotation.surface,imageId:annotation.screenshotId,instruction:annotation.koreanText,identity:annotation.surface==='work'?annotation.pageId:`${annotation.artifactId}@${annotation.artifactVersion}`};
}
export function authorizeAnnotationTask(annotation: AnnotationRecord, requestsCodeChange:boolean, envelopeDecision:(task:AnnotationTask)=>boolean): boolean {
  const task=annotationToTask(annotation);
  return requestsCodeChange ? envelopeDecision(task) : true;
}

export type OrcaExec = (args:readonly string[])=>Promise<string>;
export interface CaptureBundle { readonly captureId:string; readonly screenshot:string; readonly snapshot:string; readonly page:unknown }
export async function captureTurn(captureId:string, exec:OrcaExec):Promise<CaptureBundle> {
  const [screenshot,snapshot,pageText]=await Promise.all([exec(['screenshot']),exec(['snapshot']),exec(['tab','current','--json'])]);
  return Object.freeze({captureId,screenshot,snapshot,page:JSON.parse(pageText)});
}

export interface LocalStorageAdapter { get():Promise<readonly AnnotationRecord[]>; set(records:readonly AnnotationRecord[]):Promise<void> }
export class OrcaLocalStorage implements LocalStorageAdapter {
  constructor(private readonly exec:OrcaExec, private readonly key='cue.annotations.pending') {}
  async get():Promise<readonly AnnotationRecord[]> { const value=JSON.parse(await this.exec(['storage','local','get',this.key])); return Array.isArray(value)?value.map(parseAnnotation):[]; }
  async set(records:readonly AnnotationRecord[]):Promise<void> { await this.exec(['storage','local','set',this.key,JSON.stringify(records)]); }
}

function insertAnnotation(db:Ledger, annotation:AnnotationRecord):void {
  db.prepare('INSERT INTO annotation_v2(id,task_id,surface,page_id,artifact_id,artifact_version,url_label,selector,screenshot_id,korean_text,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(
    annotation.id,annotation.taskId,annotation.surface,annotation.surface==='work'?annotation.pageId:null,annotation.surface==='explain'?annotation.artifactId:null,annotation.surface==='explain'?annotation.artifactVersion:null,annotation.urlLabel??null,annotation.selector??null,annotation.screenshotId,annotation.koreanText,annotation.createdAt);
}
export class AnnotationStore {
  constructor(private readonly db:Ledger, private readonly backup:LocalStorageAdapter) {}
  async save(annotation:AnnotationRecord, daemonAvailable=true):Promise<'ledger'|'backup'> {
    const valid=parseAnnotation(annotation);
    if(daemonAvailable){ insertAnnotation(this.db,valid); return 'ledger'; }
    await this.backup.set([...(await this.backup.get()),valid]); return 'backup';
  }
  async flush():Promise<number> {
    const pending=await this.backup.get();
    this.db.transaction(()=>{ for(const annotation of pending) insertAnnotation(this.db,annotation); })();
    await this.backup.set([]); return pending.length;
  }
}

export function recordResult(db:Ledger, record:ResultRecord, now=new Date()):void {
  db.prepare('INSERT INTO result_record(artifact_id,version,record_json,created_at) VALUES(?,?,?,?)').run(record.artifactId,record.version,JSON.stringify(record),now.toISOString());
}
export function regenerateResult(db:Ledger, artifactId:string, mutate:(previous:ResultRecord)=>ResultRecord, now=new Date()):ResultRecord {
  const row=db.prepare('SELECT record_json FROM result_record WHERE artifact_id=? ORDER BY version DESC LIMIT 1').get(artifactId) as {record_json:string}|undefined;
  if(!row) throw new Error('result not found');
  const previous=JSON.parse(row.record_json) as ResultRecord, next=mutate(previous);
  if(next.artifactId!==artifactId || next.version!==previous.version+1) throw new Error('regeneration must create next version');
  recordResult(db,next,now); return next;
}
