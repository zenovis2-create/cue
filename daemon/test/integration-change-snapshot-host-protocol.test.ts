import { createHash } from 'node:crypto';
import { describe, expect, test, vi } from 'vitest';

const mocks=vi.hoisted(()=>({run:vi.fn()}));
vi.mock('../src/process-launch.js',()=>({runProcessSync:mocks.run}));
import { compareWriteExistingNative } from '../src/change-snapshot-host.js';

const rootIdentity={volumeSerial:'1'.repeat(16),fileId:'2'.repeat(32)};
const fileIdentity={volumeSerial:'1'.repeat(16),fileId:'3'.repeat(32)};
const beforeBytes=Buffer.from('before');
const expected={identity:fileIdentity,byteLength:beforeBytes.length,sha256:createHash('sha256').update(beforeBytes).digest('hex')};
const input=()=>({root:'C:\\owned',expectedRoot:rootIdentity,target:'value',expected,replacement:Buffer.from('after'),maxBytes:1024});

describe.runIf(process.platform==='win32')('compare/write host protocol boundary',()=>{
  test('partial or corrupted committed response is unknown',()=>{
    mocks.run.mockImplementation((_command:unknown,_args:unknown,options:{input:string})=>{
      const request=JSON.parse(options.input as string);
      return {status:0,signal:null,error:undefined,stderr:'',stdout:JSON.stringify({version:'cue-change-snapshot-v2',nonce:request.nonce,state:'committed',rootIdentity,before:expected}),pid:1,output:[]};
    });
    expect(compareWriteExistingNative(input())).toEqual({state:'unknown',reason:'protocol'});
    mocks.run.mockImplementation((_command:unknown,_args:unknown,options:{input:string})=>{
      const request=JSON.parse(options.input as string), after={identity:fileIdentity,byteLength:5,sha256:'0'.repeat(64)};
      return {status:0,signal:null,error:undefined,stderr:'',stdout:JSON.stringify({version:'cue-change-snapshot-v2',nonce:request.nonce,state:'committed',rootIdentity,before:expected,after}),pid:1,output:[]};
    });
    expect(compareWriteExistingNative(input())).toEqual({state:'unknown',reason:'protocol'});
  });
  test('rejects descriptors, proxies, and bounds before helper invocation',()=>{
    mocks.run.mockClear();
    const accessor=Object.create(null); Object.defineProperty(accessor,'root',{enumerable:true,get(){throw Error('read');}});
    expect(compareWriteExistingNative(accessor as never)).toEqual({state:'contention',reason:'request'});
    const proxied=Proxy.revocable(Buffer.from('after'),{}).proxy;
    expect(compareWriteExistingNative({...input(),replacement:proxied})).toEqual({state:'contention',reason:'request'});
    expect(compareWriteExistingNative({...input(),maxBytes:0})).toEqual({state:'contention',reason:'request'});
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
