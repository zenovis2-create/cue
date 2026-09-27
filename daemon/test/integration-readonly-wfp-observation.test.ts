import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runProcessSync } from '../src/process-launch.js';

const fixture = mkdtempSync(join(tmpdir(), 'cue-wfp-observation-'));
afterAll(() => { const base=`${resolve(tmpdir())}\\`,target=resolve(fixture);if(!target.startsWith(base)||!target.slice(base.length).startsWith('cue-wfp-observation-'))throw new Error('unsafe cleanup');rmSync(target,{recursive:true,force:true}); });
const launcher=readFileSync(resolve('src/readonly-verifier-launch.ps1'),'utf8');
const embeddedMatch=launcher.match(/Add-Type -TypeDefinition @'\r?\n([\s\S]*?)\r?\n'@/);
if(!embeddedMatch)throw new Error('launcher C# missing');
const embedded=embeddedMatch[1]!;
const collector=readFileSync(resolve('../scripts/reuse/native/readonly-wfp-collector.cs'),'utf8');
const adapter=readFileSync(resolve('src/readonly-wfp-observation.cs'),'utf8');
const harness=String.raw`
public sealed class FakeObservationNative : IWfpNative {
 public string mode,order="";public int resumes,terminates,waits;public WeakReference callback;
 public uint Open(out IntPtr e){order+="open,";e=mode=="openfail"?IntPtr.Zero:(IntPtr)1;return mode=="openfail"?5u:0u;}
 public uint GetCollection(IntPtr e,out int value){order+="get,";value=mode=="disabled"?0:1;return mode=="getfail"?5u:0u;}
 public uint GetAppId(string p,out IntPtr a,out byte[] b){order+="app,";a=mode=="appfail"?IntPtr.Zero:(IntPtr)2;b=mode=="appfail"?null:new byte[]{1};return mode=="appfail"?5u:0u;}
 public uint Subscribe(IntPtr e,WfpRequest r,byte[] a,Action<WfpEvent> cb,out IntPtr s,out object root){order+="subscribe,";callback=new WeakReference(cb);root=cb;if(mode=="null")cb(null);if(mode=="emit"||mode=="overflow"){int count=mode=="overflow"?65:1;for(int i=0;i<count;i++)cb(new WfpEvent{Timestamp=(ulong)i,PackageSid="S-1-15-2-1",AppId=new byte[]{4}});}if(mode=="wire")cb(new WfpEvent{Timestamp=ulong.MaxValue,Flags=uint.MaxValue,IpVersion=1,Protocol=6,RemoteAddress=2130706433,RemotePort=48193,PackageSid="S-1-15-2-1",AppId=new byte[]{0,255},Capability=-1,FilterId=ulong.MaxValue,IsLoopback=true});s=(mode=="subfail")?IntPtr.Zero:(IntPtr)3;return (mode=="subfail"||mode=="ambiguous")?5u:0u;}
 public uint Unsubscribe(IntPtr e,IntPtr s){order+="unsubscribe,";GC.Collect();if(callback==null||!callback.IsAlive)throw new Exception("callback-unrooted");return mode=="unsubfail"?5u:0u;}
 public void Free(ref IntPtr p){order+="free,";if(mode=="freefail")throw new Exception("free");p=IntPtr.Zero;}
 public uint Close(IntPtr e){order+="close,";return mode=="closefail"?5u:0u;}
 public void Wait(int ms){throw new Exception("unused");}
}
public static class WfpObservationHarness {
 public static string Run(string mode){var n=new FakeObservationNative{mode=mode};var request=new WfpRequest{ExecutablePath="C:\\node.exe",PackageSid="S-1-15-2-1",RemotePort=48193,DurationMs=1};if(mode=="invalid")request.ExecutablePath="\\\\server\\node.exe";uint waitResult=mode=="deathunknown"?0x102u:0u;var provider=CueWfpObservationLeaseFactory.CreateProvider(n,request,h=>{n.waits++;if(h!=(IntPtr)7)throw new Exception("handle");return waitResult;});if(mode=="mutated")request.ExecutablePath="\\\\server\\changed.exe";var lease=(CueWfpObservationLease)provider((IntPtr)7,(IntPtr)8);var owner=new CueObservationLeaseOwner(lease,(IntPtr)7,(IntPtr)8);string outcome="ok";bool foreign=false,repeatChanged=false;int blockedOpen=-1,releasedOpen=-1;try{owner.PrepareAndResume(()=>{n.resumes++;return 0;},()=>{n.terminates++;},()=>5);if(mode=="foreign")foreign=lease.ObserveProcessDeath((IntPtr)9);if(mode=="crossguard"){var blocked=new FakeObservationNative();ReadonlyWfpCollector.Collect(request,blocked);blockedOpen=blocked.order.StartsWith("open,")?1:0;}CueAppContainer.FinalizeObservationOrThrow(owner,true,()=>{n.terminates++;});if(mode=="crossguard"){var released=new FakeObservationNative();ReadonlyWfpCollector.Collect(request,released);releasedOpen=released.order.StartsWith("open,")?1:0;}}catch(Exception e){outcome=e.GetType().Name;}if(mode=="unsubfail"||mode=="freefail"||mode=="closefail"){string before=n.order;try{lease.Dispose();}catch{}repeatChanged=before!=n.order;}var diagnostic=lease.ReadDiagnostic();ulong first=diagnostic.Events.Length==0?999:diagnostic.Events[0].Timestamp;if(diagnostic.Events.Length>0){diagnostic.Events[0].Timestamp=77;if(diagnostic.Events[0].AppId!=null)diagnostic.Events[0].AppId[0]=9;}var again=lease.ReadDiagnostic();ulong second=again.Events.Length==0?999:again.Events[0].Timestamp;return outcome+"|"+n.resumes+"|"+n.terminates+"|"+n.waits+"|"+n.order+"|"+diagnostic.State+"|"+diagnostic.Events.Length+"|"+diagnostic.Overflow+"|"+foreign+"|"+first+"|"+second+"|"+blockedOpen+"|"+releasedOpen+"|"+repeatChanged;}
 public static string ActualFactory(){var request=new WfpRequest{ExecutablePath="C:\\node.exe",PackageSid="S-1-15-2-1",RemotePort=48193,DurationMs=1};var provider=CueWfpObservationLeaseFactory.CreateProvider(request);return provider((IntPtr)7,(IntPtr)8).GetType().Name;}
}`;
function run(mode:string){const declarations=(value:string)=>value.replace(/^using .*;\r?$/gm,'');const source=`using System;\nusing System.Collections.Generic;\nusing System.ComponentModel;\nusing System.Runtime.InteropServices;\nusing System.Security.Principal;\nusing System.Threading;\n${declarations(embedded)}\n${declarations(collector)}\n${declarations(adapter)}\n${harness}`,encoded=Buffer.from(source,'utf16le').toString('base64'),path=join(fixture,`${mode}.ps1`),invoke=mode==='actual'?'[WfpObservationHarness]::ActualFactory()':`[WfpObservationHarness]::Run('${mode}')`;writeFileSync(path,`$ErrorActionPreference='Stop';$s=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'));Add-Type -TypeDefinition $s;${invoke}`,'utf8');const r=runProcessSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path],{encoding:'utf8',windowsHide:true,timeout:20_000,maxBuffer:65_536});expect(r.status,r.stderr).toBe(0);expect(r.stderr).toBe('');return r.stdout.trim();}

describe('WFP observation lease adapter',()=>{
 it('subscribes before resume and cleans only after exact process death',()=>{expect(run('success')).toBe('ok|1|0|1|open,get,app,subscribe,unsubscribe,free,close,|captured|0|False|False|999|999|-1|-1|False');});
 it.each(['openfail','getfail','disabled','appfail','subfail'])('%s refuses with zero resume and observes suspended death',(mode)=>{const x=run(mode).split('|');expect(x[1]).toBe('0');expect(x[2]).toBe('1');expect(x[3]).toBe('1');expect(x[4]).not.toContain('unsubscribe');});
 it('an ambiguous subscription handle fails closed without cleanup or resume',()=>{const x=run('ambiguous').split('|');expect(x.slice(0,4)).toEqual(['InvalidOperationException','0','1','0']);expect(x[4]).toBe('open,get,app,subscribe,');});
 it('unknown exact-handle death retains subscription and never cleans',()=>{const x=run('deathunknown').split('|');expect(x.slice(0,4)).toEqual(['InvalidOperationException','1','0','1']);expect(x[4]).toBe('open,get,app,subscribe,');});
 it.each(['unsubfail','freefail','closefail'])('%s poisons after death and cannot report success',(mode)=>{const x=run(mode).split('|');expect(x[0]).toBe('InvalidOperationException');expect(x[1]).toBe('1');expect(x[3]).toBe('1');expect(x[13]).toBe('False');});
 it('rejects invalid frozen requests before native calls and ignores later caller mutation',()=>{let x=run('invalid').split('|');expect(x[1]).toBe('0');expect(x[4]).toBe('');x=run('mutated').split('|');expect(x[0]).toBe('ok');expect(x[4]).toContain('subscribe');});
 it('rejects a foreign process handle before wait',()=>{const x=run('foreign').split('|');expect(x[3]).toBe('1');expect(x[8]).toBe('False');});
 it('deep-copies bounded events and reports callback loss as unknown',()=>{let x=run('emit').split('|');expect(x.slice(5,8)).toEqual(['captured','1','False']);expect(x.slice(9,11)).toEqual(['0','0']);for(const mode of ['null','overflow']){x=run(mode).split('|');expect(x[5]).toBe('unknown');expect(x[7]).toBe('True');}});
 it('constructs the concrete NativeWfp provider inertly',()=>{expect(run('actual')).toBe('CueWfpObservationLease');});
 it('shares one native lifetime guard with the collector and releases it after safe disposal',()=>{const x=run('crossguard').split('|');expect(x.slice(11,13)).toEqual(['0','1']);});
 it('keeps default launcher provider null and exposes no payload authority',()=>{expect(launcher).toContain('cancelMarker,null);');expect(launcher).not.toMatch(/\$payload\.(wfp|observation|lease)/i);});
});
