export interface ProjectView {readonly projectId:string;readonly root:string;readonly name:string;readonly archived:boolean;readonly current:boolean}
export interface UserSessionView {readonly sessionId:string;readonly title:string;readonly createdAt:string;readonly archived:boolean;readonly runCount:number;readonly lastRunId:string|null;readonly lastState:string|null}
export function canonicalProjectRoot(root:string,protectedRoots?:string[]):string;
export function createWorkspaceManagement(db:any,currentRoot:string,protectedRoots?:string[]):{
  projects():{version:'cue-projects-v1';authority:'registered-roots-only-no-execution';records:readonly ProjectView[]};
  register(root:string):ProjectView;target(id:string):ProjectView;archiveProject(id:string):ProjectView;
  assertOpenSession(id:string):true;
  createSession():UserSessionView;
  listSessions(input:{limit:number;cursor:number|null;archived?:boolean;query?:string|null}):{version:'cue-user-sessions-v1';authority:'metadata-only-no-execution';archived:boolean;records:readonly UserSessionView[];nextCursor:number|null;complete:boolean};
  searchSessions(input:{limit:number;cursor:number|null;archived:boolean;query:string}):{version:'cue-user-sessions-v1';authority:'metadata-only-no-execution';archived:boolean;records:readonly UserSessionView[];nextCursor:number|null;complete:boolean};
  readSession(input:{sessionId:string;limit?:number;cursor?:number|null}):{version:'cue-user-session-v1';authority:'historical-links-only-no-resume';sessionId:string;title:string;archived:boolean;records:readonly {runId:string;state:string;startedAt:string;goal:string|null}[];nextCursor:number|null;complete:boolean};
  attachRun(input:{sessionId:string;runId:string}):{sessionId:string;runId:string;authority:'link-only-no-execution'};
  renameSession(input:{sessionId:string;expectedTitle:string;title:string}):{sessionId:string;title:string;authority:'metadata-only-no-execution'};
  archiveSession(id:string):{sessionId:string;archived:true};
};
export function activateProjectConfig(userDataPath:string,expected:{version:number;worktreeRoot:string;ledgerPath:string},targetRoot:string):void;
