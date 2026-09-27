import {mkdirSync,mkdtempSync,realpathSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createClaudeConfigurationResolver,type ClaudeConfigurationEnvironment,type ClaudeConfigurationRequest,type ClaudeAuthorizedSession} from '../../../app/claude-configuration.mjs';
import type {ProviderInstallationDescriptor} from '../../../app/provider-installation.mjs';

/** Filesystem-only fixture. Installation assertions must be mocked by callers;
 * this never identifies or authenticates an installed provider. */
export function claudeConfigurationFixture(executablePath=process.execPath) {
  const root=realpathSync.native(mkdtempSync(join(tmpdir(),'cue-claude-config-')));
  const directory=(name:string)=>{const path=join(root,name);mkdirSync(path,{recursive:true});return realpathSync.native(path);};
  const home=directory('home'),system=directory('system'),temp=directory('home/temp');
  const environment:ClaudeConfigurationEnvironment={SystemRoot:system,WINDIR:system,USERPROFILE:home,HOME:home,
    APPDATA:directory('home/roaming'),LOCALAPPDATA:directory('home/local'),TEMP:temp,TMP:temp,CLAUDE_CONFIG_DIR:directory('home/config')};
  const authProfilePath=join(home,'.claude.json');writeFileSync(authProfilePath,'fixture-not-a-credential');
  const stat=statSync(authProfilePath);
  const installation:ProviderInstallationDescriptor={provider:'claude',version:{kind:'pe-file',value:'2.1.274'},executablePath,
    executable:{sha256:'a'.repeat(64),size:1,dev:'fixture',ino:'fixture',mtimeMs:0,ctimeMs:0,signerSubject:'fixture',signerThumbprint:'b'.repeat(40)},
    authProfiles:[{path:authProfilePath,dev:String(stat.dev),ino:String(stat.ino),size:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs}],
    status:'unqualified',authenticated:false,entitled:false,qualified:false};
  let now=100;
  const session=(request:ClaudeConfigurationRequest):ClaudeAuthorizedSession=>({request,authProfilePath,environment,observedAtMs:100,validUntilMs:200});
  const resolver=(resolveAuthorizedSession:(request:ClaudeConfigurationRequest)=>ClaudeAuthorizedSession|null|Promise<ClaudeAuthorizedSession|null>=session)=>
    createClaudeConfigurationResolver({installation,now:()=>now,maxAgeMs:100,resolveAuthorizedSession});
  return {root,environment,authProfilePath,installation,session,resolver,setNow:(value:number)=>{now=value;},cleanup:()=>rmSync(root,{recursive:true,force:true})};
}
