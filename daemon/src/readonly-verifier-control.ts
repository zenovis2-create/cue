import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { types } from 'node:util';

export interface ReadonlyVerifierControlBundle { readonly version:'cue-readonly-verifier-control-v1'; readonly executable:string; readonly executableSha256:string; readonly launcher:string; readonly launcherSha256:string; readonly sha256:string }
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const digest=(v:Omit<ReadonlyVerifierControlBundle,'sha256'>)=>sha(JSON.stringify([v.version,v.executable,v.executableSha256,v.launcher,v.launcherSha256]));
export function measureReadonlyVerifierControl(input:{executable:string;launcher:string}):Readonly<ReadonlyVerifierControlBundle>{
  const executable=realpathSync.native(input.executable),launcher=realpathSync.native(input.launcher);
  const value={version:'cue-readonly-verifier-control-v1' as const,executable,executableSha256:sha(readFileSync(executable)),launcher,launcherSha256:sha(readFileSync(launcher))};
  return Object.freeze({...value,sha256:digest(value)});
}
export function snapshotReadonlyVerifierControl(input:ReadonlyVerifierControlBundle):Readonly<ReadonlyVerifierControlBundle>{
  if(!input||typeof input!=='object'||types.isProxy(input)||Object.getPrototypeOf(input)!==Object.prototype)throw Error('readonly_control_invalid');
  const d=Object.getOwnPropertyDescriptors(input),keys=['version','executable','executableSha256','launcher','launcherSha256','sha256'];
  if(Reflect.ownKeys(d).length!==keys.length||keys.some(k=>!d[k]?.enumerable||!Object.hasOwn(d[k],'value')))throw Error('readonly_control_invalid');
  const v=Object.fromEntries(keys.map(k=>[k,d[k]!.value])) as unknown as ReadonlyVerifierControlBundle;
  if(v.version!=='cue-readonly-verifier-control-v1'||![v.executableSha256,v.launcherSha256,v.sha256].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x))||digest(v)!==v.sha256)throw Error('readonly_control_invalid');
  return Object.freeze(v);
}
export function verifyReadonlyVerifierControl(input:ReadonlyVerifierControlBundle):boolean{try{const v=snapshotReadonlyVerifierControl(input);return realpathSync.native(v.executable)===v.executable&&realpathSync.native(v.launcher)===v.launcher&&sha(readFileSync(v.executable))===v.executableSha256&&sha(readFileSync(v.launcher))===v.launcherSha256;}catch{return false;}}
