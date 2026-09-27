import {expect,test} from 'vitest';
import {parseReadonlyWfpDiagnostic} from '../src/readonly-wfp-diagnostic.js';

const nonce='a'.repeat(64),root='1:2',prefix='CUE_READONLY_WFP=';
const event=(appId=Buffer.alloc(4096,0x5a).toString('base64'))=>({timestamp:'0',flags:0,ipVersion:0,protocol:6,remoteAddress:0x7f000001,remotePort:48193,packageSid:'S-1-15-2-1',appId,capability:0,filterId:'0',isLoopback:true});
const payload=(events:unknown[]=[])=>({version:'cue-readonly-wfp-diagnostic-v1',nonce,rootIdentity:root,state:'captured',overflow:false,events});

test('accepts the exact positive event, App ID, and UInt64 boundaries',()=>{
 const parsed=parseReadonlyWfpDiagnostic(prefix+JSON.stringify(payload(Array.from({length:64},()=>event())))+'\n',nonce,root,true);
 expect(parsed.state).toBe('captured');expect(parsed.events).toHaveLength(64);
 expect(parsed.events[0]).toMatchObject({timestamp:'0',filterId:'0',appId:event().appId});
});

test('enforces the JSON and stdout byte caps at their exact boundaries',()=>{
 const json=JSON.stringify(payload());
 const exactJson=json+' '.repeat(524288-Buffer.byteLength(json));
 expect(parseReadonlyWfpDiagnostic(prefix+exactJson+'\n',nonce,root,true).state).toBe('captured');
 expect(parseReadonlyWfpDiagnostic(prefix+exactJson+' \n',nonce,root,true)).toEqual({state:'unknown',overflow:false,events:[]});
 const frame=prefix+json+'\n', filler='x'.repeat(1_048_576-Buffer.byteLength(frame)-1)+'\n';
 expect(Buffer.byteLength(filler+frame)).toBe(1_048_576);
 expect(parseReadonlyWfpDiagnostic(filler+frame,nonce,root,true).state).toBe('captured');
 expect(parseReadonlyWfpDiagnostic('x'+filler+frame,nonce,root,true)).toEqual({state:'unknown',overflow:false,events:[]});
});
