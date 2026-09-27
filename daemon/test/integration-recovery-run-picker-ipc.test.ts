import { expect, test, vi } from 'vitest';
import { registerIpcHandlers } from '../../app/ipc.mjs';
const row={runId:'run-a',state:'blocked',recordedAttemptCount:1,identityRecordCount:0,missingIdentityAttemptCount:1,missingStageLinkCount:1,recordStatus:'lineage-incomplete'};
const listing=()=>({version:'cue-native-recovery-runs-v1',authority:'observation-only',records:[row],truncated:false,scanTruncated:false});
test('exact trusted runs operation never invokes other recovery or execution methods',async()=>{
  const handlers=new Map<string,Function>(), sender={},core={listRecoveryRuns:vi.fn(()=>listing()),listNativeIdentities:vi.fn(),observeNativeRecovery:vi.fn(),execute:vi.fn()};
  const api=registerIpcHandlers({handle:(c,h)=>{handlers.set(c,h);}},core as never,{isTrustedSender:e=>e===sender});
  expect(()=>handlers.get('cue:native-recovery')!({}, {operation:'runs'})).toThrow('sender denied');
  expect(await handlers.get('cue:native-recovery')!(sender,{operation:'runs'})).toMatchObject({available:true,value:{records:[row]}});
  let touched=0;const getter=Object.defineProperty({},'operation',{enumerable:true,get(){touched++;return 'runs';}});
  for(const input of [getter,new Proxy({operation:'runs'},{}),{operation:'runs',runId:'other'},{operation:'runs',limit:500},null]) await expect(api.invoke('cue:native-recovery',input)).rejects.toThrow();
  expect(touched).toBe(0);expect(core.listRecoveryRuns).toHaveBeenCalledWith({});expect(core.listNativeIdentities).not.toHaveBeenCalled();expect(core.observeNativeRecovery).not.toHaveBeenCalled();expect(core.execute).not.toHaveBeenCalled();
});
test('unavailable, sparse/getter or unsafe response remains unavailable without leaking errors or metadata',async()=>{
  const core={listRecoveryRuns:vi.fn<()=>any>(()=>listing())}, api=registerIpcHandlers({handle:vi.fn()},core as never);
  let touched=0;const getter=Object.defineProperty({},'runId',{enumerable:true,get(){touched++;return 'secret';}});
  for(const value of [{...listing(),secret:'C:/PRIVATE'},{...listing(),records:[{...row,pid:123}]},{...listing(),records:[{...row,runId:'C:/PRIVATE'}]},
    {...listing(),records:[{...row,missingStageLinkCount:9}]},{...listing(),records:Array(1)},{...listing(),records:[getter]},{...listing(),records:[row,row]}]) {
    core.listRecoveryRuns.mockReturnValueOnce(value);expect(await api.invoke('cue:native-recovery',{operation:'runs'})).toEqual({available:false,reason:'native-recovery-unavailable'});
  }
  core.listRecoveryRuns.mockImplementationOnce(()=>{throw Error('C:/PRIVATE auth');});expect(JSON.stringify(await api.invoke('cue:native-recovery',{operation:'runs'}))).not.toContain('PRIVATE');expect(touched).toBe(0);
});
