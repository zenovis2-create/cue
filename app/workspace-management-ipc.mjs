import {types} from 'node:util';
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const validTitle=value=>typeof value==='string'&&value.length>=1&&value.length<=100&&value===value.trim()&&value!=='새 작업 세션'&&Buffer.from(value,'utf8').toString('utf8')===value&&!/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value);
const id=value=>typeof value==='string'&&ID.test(value);
function record(input,keys){
  if(!input||typeof input!=='object'||types.isProxy(input)||Object.getPrototypeOf(input)!==Object.prototype)throw Error('workspace IPC denied');
  const fields=Object.getOwnPropertyDescriptors(input);
  if(Reflect.ownKeys(fields).length!==keys.length||keys.some(key=>!fields[key]?.enumerable||!Object.hasOwn(fields[key],'value')))throw Error('workspace IPC denied');
  return Object.fromEntries(keys.map(key=>[key,fields[key].value]));
}
function array(input,max){
  if(!Array.isArray(input)||types.isProxy(input)||Object.getPrototypeOf(input)!==Array.prototype)throw Error('workspace response denied');
  const fields=Object.getOwnPropertyDescriptors(input),n=fields.length?.value;
  if(!Number.isSafeInteger(n)||n<0||n>max||Reflect.ownKeys(fields).length!==n+1)throw Error('workspace response denied');
  return Array.from({length:n},(_,i)=>{const d=fields[String(i)];if(!d?.enumerable||!Object.hasOwn(d,'value'))throw Error('workspace response denied');return d.value;});
}
export function projectCommand(input){
  if(!input||typeof input!=='object'||types.isProxy(input))throw Error('workspace IPC denied');
  const op=Object.getOwnPropertyDescriptor(input,'operation')?.value;
  const value=record(input,['list','add'].includes(op)?['operation']:op==='switch'?['operation','projectId']:[]);
  if(!['list','add','switch'].includes(op)||('projectId'in value&&!id(value.projectId)))throw Error('project IPC denied');return value;
}
export function userSessionCommand(input){
  if(!input||typeof input!=='object'||types.isProxy(input))throw Error('workspace IPC denied');
  const op=Object.getOwnPropertyDescriptor(input,'operation')?.value;
  const keys=op==='create'?['operation']:op==='list'?['operation','limit','cursor','archived']:op==='search'?['operation','limit','cursor','archived','query']:op==='read'?['operation','sessionId','limit','cursor']:op==='archive'?['operation','sessionId']:op==='rename'?['operation','sessionId','expectedTitle','title']:[];
  const value=record(input,keys);
  if(!keys.length||('sessionId'in value&&!id(value.sessionId))||('limit'in value&&(!Number.isSafeInteger(value.limit)||value.limit<1||value.limit>20||!(value.cursor===null||Number.isSafeInteger(value.cursor)&&value.cursor>=1)))||(['list','search'].includes(op)&&typeof value.archived!=='boolean')||(op==='search'&&!(typeof value.query==='string'&&value.query.length>=1&&value.query.length<=100&&value.query===value.query.trim()))||(op==='rename'&&(!validTitle(value.title)||typeof value.expectedTitle!=='string'||value.expectedTitle.length>100)))throw Error('session IPC denied');
  return value;
}
export function optionalSessionId(input){
  if(!input||typeof input!=='object'||types.isProxy(input)||Object.getPrototypeOf(input)!==Object.prototype)throw Error('session IPC denied');
  const field=Object.getOwnPropertyDescriptor(input,'sessionId');
  if(!field)return null;
  if(!field.enumerable||!Object.hasOwn(field,'value')||!id(field.value))throw Error('session IPC denied');return field.value;
}
const text=(s,max)=>typeof s==='string'&&s.length<=max;
function project(input){const p=record(input,['projectId','root','name','archived','current']);
  if(!id(p.projectId)||!text(p.root,4096)||!text(p.name,256)||typeof p.archived!=='boolean'||typeof p.current!=='boolean')throw Error('project response denied');return Object.freeze(p);}
function session(input){const s=record(input,['sessionId','title','createdAt','archived','runCount','lastRunId','lastState']);
  if(!id(s.sessionId)||!text(s.title,100)||!text(s.createdAt,128)||typeof s.archived!=='boolean'||!Number.isSafeInteger(s.runCount)||s.runCount<0||!(s.lastRunId===null||id(s.lastRunId))||!(s.lastState===null||['awaiting_approval','queued','running','completed','blocked','failed'].includes(s.lastState)))throw Error('session response denied');return Object.freeze(s);}
function page(v,version,authority,map){const p=record(v,['version','authority','archived','records','nextCursor','complete']);
  if(p.version!==version||p.authority!==authority||typeof p.archived!=='boolean'||typeof p.complete!=='boolean'||p.complete!==(p.nextCursor===null)||(p.nextCursor!==null&&(!Number.isSafeInteger(p.nextCursor)||p.nextCursor<1)))throw Error('session response denied');
  return Object.freeze({...p,records:Object.freeze(array(p.records,20).map(map))});}
export function projectProjection(value,operation){
  if(operation==='list'){const v=record(value,['version','authority','records']);if(v.version!=='cue-projects-v1'||v.authority!=='registered-roots-only-no-execution')throw Error('project response denied');return Object.freeze({...v,records:Object.freeze(array(v.records,100).map(project))});}
  if(operation==='add')return project(value);
  return value;
}
export function userSessionProjection(value,operation){
  if(operation==='create')return session(value);
  if(operation==='archive'){const v=record(value,['sessionId','archived']);if(!id(v.sessionId)||v.archived!==true)throw Error('session response denied');return Object.freeze(v);}
  if(operation==='rename'){const v=record(value,['sessionId','title','authority']);if(!id(v.sessionId)||!validTitle(v.title)||v.authority!=='metadata-only-no-execution')throw Error('session response denied');return Object.freeze(v);}
  if(operation==='list'||operation==='search')return page(value,'cue-user-sessions-v1','metadata-only-no-execution',session);
  const v=record(value,['version','authority','sessionId','title','archived','records','nextCursor','complete']);
  if(v.version!=='cue-user-session-v1'||v.authority!=='historical-links-only-no-resume'||!id(v.sessionId)||!text(v.title,100)||typeof v.archived!=='boolean'||v.complete!==(v.nextCursor===null)||(v.nextCursor!==null&&(!Number.isSafeInteger(v.nextCursor)||v.nextCursor<1)))throw Error('session response denied');
  const records=array(v.records,20).map(item=>{const r=record(item,['runId','state','startedAt','goal']);if(!id(r.runId)||!['awaiting_approval','queued','running','completed','blocked','failed'].includes(r.state)||!text(r.startedAt,128)||!(r.goal===null||text(r.goal,4096)))throw Error('session response denied');return Object.freeze(r);});
  return Object.freeze({...v,records:Object.freeze(records)});
}
