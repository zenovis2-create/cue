import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { HostCodexRpcSession } from '../src/host-codex-controller.js';

describe('host Codex bounded activity observer',()=>{
  it('observes safe output/terminal facts and quarantines late terminal callbacks',async()=>{
    const fromServer=new PassThrough(),toServer=new PassThrough();const events:any[]=[];
    const rpc=new HostCodexRpcSession({readable:fromServer,writable:toServer},async()=>({exitCode:0,stdout:'',stderr:'',enforcement:'appcontainer'}),{onEvent:event=>events.push(event)});
    const lines=createInterface({input:toServer});
    lines.on('line',line=>{const message=JSON.parse(line);if(message.method==='initialize')fromServer.write(JSON.stringify({id:message.id,result:{}})+'\n');
      else if(message.method==='thread/start')fromServer.write(JSON.stringify({id:message.id,result:{thread:{id:'thread'}}})+'\n');
      else if(message.method==='turn/start'){fromServer.write(JSON.stringify({id:message.id,result:{turn:{id:'turn'}}})+'\n');
        fromServer.write(JSON.stringify({method:'item/completed',params:{threadId:'foreign',turnId:'turn',item:{type:'agentMessage',text:'foreign'}}})+'\n');
        fromServer.write(JSON.stringify({method:'item/completed',params:{threadId:'thread',turnId:'turn',item:{type:'agentMessage',text:'safe result'}}})+'\n');
        fromServer.write(JSON.stringify({method:'item/completed',params:{threadId:'thread',turnId:'turn',item:{type:'agentMessage',text:'safe result'}}})+'\n');
        fromServer.write(JSON.stringify({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}})+'\n');}}
    );
    const result=await rpc.run({cwd:'C:\\work',goal:'test',ephemeral:true} as any);
    expect(result.finalMessage).toBe('safe result');expect(events.map(event=>event.kind)).toEqual(['input','input','output','terminal']);
    expect(events.slice(0,2)).toMatchObject([{method:'thread/start',scope:'host-rpc-app-server-ack-only',executedInputVerified:false},
      {method:'turn/start',scope:'host-rpc-app-server-ack-only',executedInputVerified:false}]);
    fromServer.write(JSON.stringify({method:'item/completed',params:{threadId:'thread',turnId:'turn',item:{type:'agentMessage',text:'late overwrite'}}})+'\n');
    await new Promise(resolve=>setImmediate(resolve));expect(events).toHaveLength(4);rpc.close();lines.close();
  });

  it('exports a digest for a provider tool call and never its raw opaque id',async()=>{
    const fromServer=new PassThrough(),toServer=new PassThrough();const events:any[]=[];const replies:any[]=[];
    const rpc=new HostCodexRpcSession({readable:fromServer,writable:toServer},async()=>({exitCode:0,stdout:'ok',stderr:'private',enforcement:'appcontainer'}),{onEvent:event=>events.push(event)});
    const lines=createInterface({input:toServer});
    lines.on('line',line=>{const message=JSON.parse(line);replies.push(message);
      if(message.method==='initialize')fromServer.write(JSON.stringify({id:message.id,result:{}})+'\n');
      else if(message.method==='thread/start')fromServer.write(JSON.stringify({id:message.id,result:{thread:{id:'thread-safe'}}})+'\n');
      else if(message.method==='turn/start'){fromServer.write(JSON.stringify({id:message.id,result:{turn:{id:'turn-safe'}}})+'\n');
        fromServer.write(JSON.stringify({method:'item/tool/call',id:7,params:{threadId:'thread-safe',turnId:'turn-safe',callId:'secret-token-123',namespace:null,tool:'cue_workspace',arguments:{program:'cmd.exe',args:[]}}})+'\n');}
      else if(message.id===7){fromServer.write(JSON.stringify({method:'turn/completed',params:{threadId:'thread-safe',turn:{id:'turn-safe',status:'completed'}}})+'\n');}}
    );
    await rpc.run({cwd:'C:\\controller',workspaceCwd:'C:\\work',goal:'test'});
    expect(events).toEqual([
      expect.objectContaining({kind:'input',method:'thread/start',sha256:expect.stringMatching(/^[a-f0-9]{64}$/u)}),
      expect.objectContaining({kind:'input',method:'turn/start',sha256:expect.stringMatching(/^[a-f0-9]{64}$/u)}),
      expect.objectContaining({kind:'tool',callRef:expect.stringMatching(/^call:[a-f0-9]{64}$/u),status:'started'}),
      expect.objectContaining({kind:'tool',callRef:expect.stringMatching(/^call:[a-f0-9]{64}$/u),status:'completed'}),
      {kind:'terminal',status:'completed'},
    ]);
    for(const event of events.filter(e=>e.kind==='input')){
      const message=replies.find(m=>m.method===event.method);
      const bytes=Buffer.from(`${JSON.stringify(message)}\n`,'utf8');
      expect(event.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
      expect(event.byteLength).toBe(bytes.length);
      expect(event.executedInputVerified).toBe(false);
    }
    expect(JSON.stringify(events)).not.toMatch(/secret-token|private|C:\\\\work/iu);
    expect(replies.find(message=>message.id===7)?.result.success).toBe(true);rpc.close();lines.close();
  });

  it.each([
    ['thread', '/private/secret'],
    ['thread', 'x'.repeat(257)],
    ['turn', 'bad turn'],
    ['turn', 'x'.repeat(257)],
  ])('rejects malformed or oversized %s ids before terminal authority',async(kind,id)=>{
    const fromServer=new PassThrough(),toServer=new PassThrough();const events:any[]=[];
    const rpc=new HostCodexRpcSession({readable:fromServer,writable:toServer},async()=>({exitCode:0,stdout:'',stderr:'',enforcement:'appcontainer'}),{onEvent:event=>events.push(event)});
    const lines=createInterface({input:toServer});
    lines.on('line',line=>{const message=JSON.parse(line);
      if(message.method==='initialize')fromServer.write(JSON.stringify({id:message.id,result:{}})+'\n');
      else if(message.method==='thread/start')fromServer.write(JSON.stringify({id:message.id,result:{thread:{id:kind==='thread'?id:'thread-safe'}}})+'\n');
      else if(message.method==='turn/start')fromServer.write(JSON.stringify({id:message.id,result:{turn:{id}}})+'\n');
    });
    await expect(rpc.run({cwd:'C:\\work',goal:'test'})).rejects.toThrow();
    expect(events.map(event=>event.method)).toEqual(kind==='thread'?[]:['thread/start']);rpc.close();lines.close();
  });

  it('does not record a turn input acknowledgement when app-server rejects the request',async()=>{
    const fromServer=new PassThrough(),toServer=new PassThrough(),events:any[]=[];
    const rpc=new HostCodexRpcSession({readable:fromServer,writable:toServer},async()=>({exitCode:0,stdout:'',stderr:'',enforcement:'appcontainer'}),{onEvent:event=>events.push(event)});
    const lines=createInterface({input:toServer});
    lines.on('line',line=>{const message=JSON.parse(line);
      if(message.method==='initialize')fromServer.write(JSON.stringify({id:message.id,result:{}})+'\n');
      else if(message.method==='thread/start')fromServer.write(JSON.stringify({id:message.id,result:{thread:{id:'thread'}}})+'\n');
      else if(message.method==='turn/start')fromServer.write(JSON.stringify({id:message.id,error:{message:'rejected'}})+'\n');
    });
    await expect(rpc.run({cwd:'C:\\work',goal:'private goal'})).rejects.toThrow('rejected');
    expect(events.map(event=>event.method)).toEqual(['thread/start']);
    expect(JSON.stringify(events)).not.toContain('private goal');rpc.close();lines.close();
  });

  it('turns a throwing activity sink into run failure instead of success',async()=>{
    const fromServer=new PassThrough(),toServer=new PassThrough();
    const rpc=new HostCodexRpcSession({readable:fromServer,writable:toServer},async()=>({exitCode:0,stdout:'',stderr:'',enforcement:'appcontainer'}),{onEvent:()=>{throw Error('sink secret');}});
    const lines=createInterface({input:toServer});
    lines.on('line',line=>{const message=JSON.parse(line);
      if(message.method==='initialize')fromServer.write(JSON.stringify({id:message.id,result:{}})+'\n');
      else if(message.method==='thread/start')fromServer.write(JSON.stringify({id:message.id,result:{thread:{id:'thread'}}})+'\n');
      else if(message.method==='turn/start'){fromServer.write(JSON.stringify({id:message.id,result:{turn:{id:'turn'}}})+'\n');
        fromServer.write(JSON.stringify({method:'item/completed',params:{threadId:'thread',turnId:'turn',item:{type:'agentMessage',text:'false success'}}})+'\n');}}
    );
    await expect(rpc.run({cwd:'C:\\work',goal:'test'})).rejects.toThrow('activity sink failed');
    rpc.close();lines.close();
  });
});
