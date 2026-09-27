import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { types } from 'node:util';
import { measureArtifactSet } from './measurement-artifacts.js';
export interface ModelControlBundle {
  readonly version: 'cue-model-control-v1'; readonly clientKind: 'model' | 'json-checker' | 'goal-proposal-checker';
  readonly nodeSha256: string; readonly launcherSha256: string; readonly guardianSha256: string;
  readonly clientSha256: string; readonly checkerCoreSha256: string | null; readonly sha256: string;
}
const fields = ['version','clientKind','nodeSha256','launcherSha256','guardianSha256','clientSha256','checkerCoreSha256'] as const;
function digest(value: Omit<ModelControlBundle,'sha256'>) { return createHash('sha256').update(JSON.stringify(fields.map(key=>value[key]))).digest('hex'); }
/** Host-measured installed control root only. A hash is drift detection, not an
 * installation trust decision. The root/launcher/adapter must be outside every
 * agent-writable grant. Measure at approval; never replace pins during launch. */
export function measureModelControlBundle(input: { controlRoot: string; nodeExecutable: string; clientKind: 'model' | 'json-checker' | 'goal-proposal-checker' }): Readonly<ModelControlBundle> {
  if (!['model','json-checker','goal-proposal-checker'].includes(input.clientKind)) throw Error('control_bundle_kind');
  const items = [{id:'node',path:input.nodeExecutable},{id:'launcher',path:join(input.controlRoot,'model-only-launch.ps1')},
    {id:'guardian',path:join(input.controlRoot,'model-only-profile-cleanup.ps1')},{id:'client',path:join(input.controlRoot,input.clientKind==='model'?'model-only-client.cjs':input.clientKind==='json-checker'?'json-checker-client.cjs':'goal-proposal-checker-client.cjs')}];
  if(input.clientKind!=='model') items.push({id:'core',path:join(input.controlRoot,'verification',input.clientKind==='json-checker'?'json-format-checker.cjs':'goal-proposal-checker.cjs')});
  const hashes = new Map(measureArtifactSet(items).artifacts.map(v=>[v.id,v.sha256]));
  const value = {version:'cue-model-control-v1' as const,clientKind:input.clientKind,nodeSha256:hashes.get('node')!,launcherSha256:hashes.get('launcher')!,guardianSha256:hashes.get('guardian')!,clientSha256:hashes.get('client')!,checkerCoreSha256:hashes.get('core')??null};
  return Object.freeze({...value,sha256:digest(value)});
}
export function snapshotModelControlBundle(input: ModelControlBundle, kind: ModelControlBundle['clientKind'], nodeSha256: string): Readonly<ModelControlBundle> {
  if(!input || typeof input!=='object' || types.isProxy(input) || Object.getPrototypeOf(input)!==Object.prototype) throw Error('control_bundle_invalid');
  const descriptors=Object.getOwnPropertyDescriptors(input);
  if(Reflect.ownKeys(descriptors).length!==8 || ![...fields,'sha256'].every(key=>descriptors[key]?.enumerable && Object.hasOwn(descriptors[key],'value'))) throw Error('control_bundle_invalid');
  const value=Object.fromEntries([...fields,'sha256'].map(key=>[key,descriptors[key]!.value])) as unknown as ModelControlBundle;
  if(value.version!=='cue-model-control-v1'||value.clientKind!==kind||value.nodeSha256!==nodeSha256.toLowerCase()
    || !['nodeSha256','launcherSha256','guardianSha256','clientSha256','sha256'].every(key=>typeof value[key as keyof ModelControlBundle]==='string'&&/^[a-f0-9]{64}$/.test(value[key as keyof ModelControlBundle]!))
    || (kind==='model'?value.checkerCoreSha256!==null:typeof value.checkerCoreSha256!=='string'||!/^[a-f0-9]{64}$/.test(value.checkerCoreSha256)) || digest(value)!==value.sha256) throw Error('control_bundle_invalid');
  return Object.freeze(value);
}

/** Native JSON observation must agree with the previously frozen host pins.
 * Matching metadata alone never proves admission or cleanup. */
export function matchesModelControlObservation(bundle: ModelControlBundle, observation: unknown): boolean {
  if (!observation || typeof observation !== 'object' || types.isProxy(observation) || Object.getPrototypeOf(observation) !== Object.prototype) return false;
  const fields = Object.getOwnPropertyDescriptors(observation);
  const expected = {controlStatus:'pinned',controlBundleSha256:bundle.sha256,clientKind:bundle.clientKind,
    clientSha256:bundle.clientSha256,checkerCoreSha256:bundle.checkerCoreSha256,guardianSha256:bundle.guardianSha256,
    preserveDependencySymlinks:bundle.clientKind!=='model'};
  return Object.entries(expected).every(([key,value])=>fields[key] && Object.hasOwn(fields[key],'value') && fields[key].value===value);
}
