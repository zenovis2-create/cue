import {describe, expect, test} from 'vitest';
import {createClaudeCliDecoder, CLAUDE_CLI_LIMITS} from '../src/adapters/claude-cli-protocol.js';

const sid = '2b9e1035-62b5-4dd1-a56e-b1f862537311';
const init = {type:'system',subtype:'init',session_id:sid,uuid:'init-1',claude_code_version:'2.1.274',model:'claude-sonnet-5',cwd:'C:\\work',tools:['Read','Edit'],mcp_servers:[],permissionMode:'dontAsk',apiKeySource:'none',capabilities:['future-capability']};
const delta = (text:string) => ({type:'stream_event',session_id:sid,uuid:'delta-1',parent_tool_use_id:null,event:{type:'content_block_delta',index:0,delta:{type:'text_delta',text}}});
const assistant = (content: unknown[]) => ({type:'assistant',session_id:sid,uuid:'assistant-1',parent_tool_use_id:null,message:{id:'msg_1',model:'claude-sonnet-5',role:'assistant',content,stop_reason:null,usage:{input_tokens:10,output_tokens:2}}});
const result = {type:'result',subtype:'success',session_id:sid,uuid:'result-1',is_error:false,result:'hello',stop_reason:'end_turn',duration_ms:100,duration_api_ms:80,num_turns:1,total_cost_usd:0.02,usage:{},modelUsage:{'claude-sonnet-5':{inputTokens:10,outputTokens:2,costUSD:0.02,cacheReadInputTokens:0,cacheCreationInputTokens:0,webSearchRequests:0,contextWindow:1000,maxOutputTokens:100}},permission_denials:[]};
const wire = (...frames: unknown[]) => Buffer.from(frames.map(f=>JSON.stringify(f)+'\n').join(''));

describe('documentation and SDK type mapped Claude CLI subset', () => {
  test('frames UTF-8 split input, keeps provisional and complete text distinct, and reads terminal estimate', () => {
    const decoder = createClaudeCliDecoder();
    const bytes = wire(init,delta('한😀'),assistant([{type:'text',text:'한😀'}]),result);
    const chunks = [bytes.subarray(0,23),bytes.subarray(23,bytes.length-4),bytes.subarray(bytes.length-4)];
    const projected = chunks.flatMap(chunk=>decoder.push(chunk));
    expect(projected.map(e=>e.kind)).toEqual(['init','delta','assistant']);
    expect(projected[0]).toMatchObject({model:'claude-sonnet-5',claudeCodeVersion:'2.1.274',cwd:'C:\\work',sessionId:sid});
    expect(projected.slice(1).map(e=>e.text)).toEqual(['한😀','한😀']);
    expect(decoder.finish()).toMatchObject({outcome:'success',text:'hello',estimatedCostUsd:0.02,permissionDenials:0,modelUsage:{'claude-sonnet-5':{inputTokens:10,outputTokens:2}}});
  });
  test('tool and subagent messages do not become primary assistant text', () => {
    const decoder=createClaudeCliDecoder();
    const sub={...assistant([{type:'text',text:'child'}]),uuid:'sub-1',parent_tool_use_id:'toolu_1'};
    const events=decoder.push(wire(init,assistant([{type:'tool_use',id:'toolu_1',name:'Read',input:{}}]),sub,result));
    expect(events.map(e=>e.kind)).toEqual(['init','tool','subagent']);
    expect(events[1]).toMatchObject({toolUseId:'toolu_1',toolName:'Read',blockIndex:0});
    expect(events[2]).toMatchObject({parentToolUseId:'toolu_1',text:'child'});
    expect(decoder.finish().outcome).toBe('success');
  });
  test('error and permission denial never project success', () => {
    for(const variant of [{...result,is_error:true},{...result,permission_denials:[{tool_name:'Edit',tool_use_id:'toolu_1',tool_input:{}}]},{...result,subtype:'error_max_turns',is_error:true}]) {
      const decoder=createClaudeCliDecoder(); decoder.push(wire(init,variant)); expect(decoder.finish().outcome).toBe('error');
    }
  });
  test('allows documented informational system event after terminal but fences abort and later output', () => {
    const decoder=createClaudeCliDecoder();
    decoder.push(wire(init,result,{type:'system',subtype:'status',session_id:sid,uuid:'status-1',status:null}));
    expect(decoder.finish().outcome).toBe('success');
    const aborted=createClaudeCliDecoder(); aborted.push(wire(init)); aborted.abort();
    expect(()=>aborted.push(wire(result))).toThrow('closed');
    expect(()=>aborted.finish()).toThrow('closed');
  });
  test('preserves identical blocks with distinct wrapper identity and rejects conflicting replay', () => {
    const decoder=createClaudeCliDecoder();
    const a=assistant([{type:'text',text:'same'}]);
    const b={...a,uuid:'assistant-2'};
    const events=decoder.push(wire(init,a,a,b,result));
    expect(events.filter(e=>e.kind==='assistant').map(e=>e.text)).toEqual(['same','same']);
    expect(decoder.finish().outcome).toBe('success');
    const changed=createClaudeCliDecoder(); changed.push(wire(init,a));
    expect(()=>changed.push(wire({...a,message:{...a.message,content:[{type:'text',text:'changed'}]}}))).toThrow();
  });
  test('rejects malformed, truncated, duplicate, wrong session, unknown terminal, bad usage and oversized frames', () => {
    const invalid=[
      wire(init,result,result), wire(init,{...result,session_id:'other'}), wire(init,{...result,subtype:'unexpected'}),
      wire(init,{...result,modelUsage:{model:{inputTokens:-1,outputTokens:1,costUSD:0}}}),
      wire(init,{...result,modelUsage:{model:{inputTokens:1.5,outputTokens:1,costUSD:0}}}),
      wire(init,{...result,modelUsage:{model:{inputTokens:Number.MAX_SAFE_INTEGER+1,outputTokens:1,costUSD:0}}}),
      Buffer.from('{bad}\n'), Buffer.from('x'.repeat(CLAUDE_CLI_LIMITS.lineBytes+1)),
    ];
    for(const bytes of invalid) expect(()=>createClaudeCliDecoder().push(bytes)).toThrow();
    for(const bytes of [wire(init),wire(init,result).subarray(0,-1),Buffer.from([0xe2])]) {
      const decoder=createClaudeCliDecoder(); decoder.push(bytes); expect(()=>decoder.finish()).toThrow();
    }
  });
});
