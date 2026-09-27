// Keep advanced tools out of the goal/approval path without changing their IDs or IPC contracts.
const workspaceTools=document.querySelector('#workspace-tools');
for(const id of ['local-json-setup','local-planning-setup','resource-manager','native-recovery','candidate-inventory','retrospective-panel'])workspaceTools.append(document.getElementById(id));
const workspaceEvaluation=document.querySelector('#workspace-evaluation');
workspaceEvaluation.append(document.querySelector('#evaluation-panel'));
let workspaceSessionGeneration=0,workspaceSessionDetailGeneration=0,workspaceSessionCursor=null,workspaceSelectedRun=null;
function showWorkspaceView(view,focus=false){
  let active;
  for(const [name,id] of [['work','workspace-work'],['history','workspace-history'],['evaluation','workspace-evaluation'],['tools','workspace-tools']]){
    const element=document.getElementById(id);element.hidden=name!==view;if(name===view)active=element;
  }
  document.querySelector('#workspace-skip').href=`#${active.id}`;
  for(const button of document.querySelectorAll('.workspace-nav button')){
    if(button.dataset.view===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
  if(view==='evaluation')document.querySelector('#workspace-evaluation-unavailable').hidden=!document.querySelector('#evaluation-panel').hidden;
  if(focus)active.focus();
}
for(const button of document.querySelectorAll('.workspace-nav button'))button.addEventListener('click',()=>showWorkspaceView(button.dataset.view,true));
const workspaceList=document.querySelector('#workspace-session-list'),workspaceStatus=document.querySelector('#workspace-session-status'),workspaceNext=document.querySelector('#workspace-session-next');
const workspaceStates={queued:'기록상 대기',running:'기록상 실행 중',awaiting_approval:'기록상 승인 대기',blocked:'기록상 막힘',completed:'실행 종료 · 인수 별도',failed:'실패 기록'};
let userSessionId=null,userSessionGeneration=0,userSessionDetailGeneration=0,userSessionCursor=null,userSessionRunCursor=null,sessionCreating=null,showArchivedSessions=false,userSessionQuery=null;
const conversationList=document.querySelector('#workspace-conversation-list'),conversationStatus=document.querySelector('#workspace-conversation-status');
const activeSessionLabel=document.querySelector('#workspace-active-session');
function setUserSession(id,title){userSessionId=id;activeSessionLabel.textContent=id?`Cue 세션: ${title} · 다음 목표도 새 범위와 별도 승인이 필요합니다.`:'새 Cue 세션에서 목표를 시작합니다. 각 실행은 별도 범위 승인이 필요합니다.';}
async function loadProjects(){
  const status=document.querySelector('#workspace-project-status'),list=document.querySelector('#workspace-project-list');
  if(typeof window.cue?.projects!=='function'){status.textContent='프로젝트 관리 기능을 사용할 수 없습니다.';return;}
  try{
    const response=await window.cue.projects({operation:'list'});
    if(response?.version!=='cue-projects-v1'||response.authority!=='registered-roots-only-no-execution')throw Error('unavailable');
    list.replaceChildren();
    for(const row of response.records){if(row.archived)continue;
      const item=document.createElement('li'),button=document.createElement('button'),name=document.createElement('span'),path=document.createElement('small');
      button.type='button';button.disabled=row.current;name.textContent=row.name+(row.current?' · 현재':'');path.textContent=row.root;
      button.append(name,path);button.addEventListener('click',async()=>{
        status.textContent='전환 확인 후 현재 Core를 안전하게 닫습니다.';
        try{await window.cue.projects({operation:'switch',projectId:row.projectId});status.textContent='앱을 재시작합니다.';}
        catch{status.textContent='전환되지 않았습니다. 현재 작업과 소유권 상태를 확인하세요.';}
      });item.append(button);list.append(item);
    }
    status.textContent=`등록된 프로젝트 ${response.records.filter(row=>!row.archived).length}개 · 전환 시 앱 재시작`;
  }catch{status.textContent='프로젝트 목록을 읽을 수 없습니다.';}
}
document.querySelector('#workspace-project-add').addEventListener('click',async()=>{
  const status=document.querySelector('#workspace-project-status');
  try{const value=await window.cue.projects({operation:'add'});status.textContent=value.status==='cancelled'?'폴더 선택을 취소했습니다.':'프로젝트를 추가했습니다. 전환은 별도 확인이 필요합니다.';void loadProjects();}
  catch{status.textContent='폴더를 등록하지 못했습니다. 보호 경로·중첩 프로젝트를 확인하세요.';}
});
async function loadUserSessions(cursor=null){
  const generation=++userSessionGeneration,next=document.querySelector('#workspace-conversation-next');
  if(cursor===null){conversationList.replaceChildren();userSessionCursor=null;}next.disabled=true;
  if(typeof window.cue?.userSessions!=='function'){conversationStatus.textContent='Cue 세션 관리를 사용할 수 없습니다. 실행 기록은 아래에서 읽을 수 있습니다.';return;}
  conversationStatus.textContent='저장된 Cue 세션을 읽는 중입니다.';
  try{const value=await window.cue.userSessions(userSessionQuery?{operation:'search',limit:20,cursor,archived:showArchivedSessions,query:userSessionQuery}
      :{operation:'list',limit:20,cursor,archived:showArchivedSessions});
    if(generation!==userSessionGeneration)return;
    if(value?.version!=='cue-user-sessions-v1'||value.authority!=='metadata-only-no-execution'||value.archived!==showArchivedSessions||value.complete!==(value.nextCursor===null))throw Error('unavailable');
    for(const row of value.records){
      const item=document.createElement('li'),button=document.createElement('button'),title=document.createElement('span'),meta=document.createElement('small');
      button.type='button';title.textContent=row.title;meta.textContent=`${row.runCount}개 실행 · ${row.lastState?workspaceStates[row.lastState]??'상태 미확인':'새 세션'}`;
      button.append(title,meta);button.addEventListener('click',()=>{void readUserSession(row.sessionId);});item.append(button);conversationList.append(item);
    }
    userSessionCursor=value.nextCursor;next.disabled=userSessionCursor===null;
    conversationStatus.textContent=userSessionQuery?`검색 결과 현재 페이지 ${value.records.length}개 · 선택은 읽기 전용입니다.`
      :value.records.length?'세션 선택은 읽기 전용입니다. 새 목표는 다시 승인합니다.':showArchivedSessions?'보관된 세션이 없습니다.':'아직 Cue 세션이 없습니다.';
  }catch{if(generation===userSessionGeneration)conversationStatus.textContent='Cue 세션을 읽을 수 없습니다.';}
}
async function readUserSession(id,cursor=null){
  const generation=++userSessionDetailGeneration,detail=document.querySelector('#workspace-conversation-detail'),runs=document.querySelector('#workspace-conversation-runs');
  if(cursor===null){runs.replaceChildren();userSessionRunCursor=null;}showWorkspaceView('history');detail.hidden=false;document.querySelector('#workspace-session-detail').hidden=true;
  conversationStatus.textContent='세션 실행 기록을 읽는 중입니다.';
  try{const value=await window.cue.userSessions({operation:'read',sessionId:id,limit:20,cursor});
    if(generation!==userSessionDetailGeneration)return;
    if(value?.version!=='cue-user-session-v1'||value.authority!=='historical-links-only-no-resume'||value.sessionId!==id||value.complete!==(value.nextCursor===null))throw Error('unavailable');
    const heading=document.querySelector('#workspace-conversation-title');heading.textContent=value.title;heading.focus();
    const renameForm=document.querySelector('#workspace-conversation-rename-form');renameForm.dataset.sessionId=id;renameForm.dataset.expectedTitle=value.title;
    renameForm.querySelector('input').value=value.title;renameForm.querySelector('input').disabled=value.archived;
    renameForm.querySelector('button').disabled=value.archived;
    for(const row of value.records){const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=`${workspaceStates[row.state]??'상태 미확인'} · ${row.goal??'목표 기록 없음'}`;
      button.addEventListener('click',()=>{void readWorkspaceSession(row.runId);});li.append(button);runs.append(li);}
    userSessionRunCursor=value.nextCursor;document.querySelector('#workspace-conversation-more').disabled=userSessionRunCursor===null;
    const continueButton=document.querySelector('#workspace-conversation-continue');continueButton.disabled=value.archived;continueButton.dataset.sessionId=id;continueButton.dataset.title=value.title;
    const archiveButton=document.querySelector('#workspace-conversation-archive');archiveButton.disabled=value.archived;archiveButton.dataset.sessionId=id;
    conversationStatus.textContent=value.archived?'보관된 세션입니다. 실행을 재개하지 않습니다.':'새 목표로 이어가면 새 실행 범위를 별도 승인해야 합니다.';
  }catch{if(generation===userSessionDetailGeneration)conversationStatus.textContent='현재 프로젝트의 세션만 읽을 수 있습니다.';}
}
document.querySelector('#workspace-conversation-rename-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,id=form.dataset.sessionId,title=form.querySelector('input').value.trim(),expectedTitle=form.dataset.expectedTitle,generation=userSessionDetailGeneration;
  if(!id||form.closest('#workspace-conversation-detail').hidden)return;
  const button=form.querySelector('button');button.disabled=true;
  try{
    const value=await window.cue.userSessions({operation:'rename',sessionId:id,expectedTitle,title});
    if(generation!==userSessionDetailGeneration||form.dataset.sessionId!==id||form.closest('#workspace-conversation-detail').hidden)return;
    if(value?.sessionId!==id||value.authority!=='metadata-only-no-execution'||value.title!==title)throw Error('unavailable');
    form.dataset.expectedTitle=title;form.querySelector('input').value=title;
    document.querySelector('#workspace-conversation-title').textContent=title;
    document.querySelector('#workspace-conversation-continue').dataset.title=title;
    if(userSessionId===id)setUserSession(id,title);
    conversationStatus.textContent='세션 이름을 저장했습니다. 실행 범위와 승인은 변경되지 않았습니다.';void loadUserSessions(null);
  }catch{conversationStatus.textContent='이름을 저장하지 못했습니다. 세션 상태와 최신 이름을 다시 확인하세요.';}
  finally{if(generation===userSessionDetailGeneration&&form.dataset.sessionId===id)button.disabled=form.querySelector('input').disabled;}
});
document.querySelector('#workspace-conversation-search-form').addEventListener('submit',event=>{
  event.preventDefault();userSessionQuery=document.querySelector('#workspace-conversation-query').value.trim().slice(0,100)||null;void loadUserSessions(null);
});
document.querySelector('#workspace-conversation-search-clear').addEventListener('click',()=>{
  document.querySelector('#workspace-conversation-query').value='';userSessionQuery=null;void loadUserSessions(null);
});
document.querySelector('#workspace-conversation-next').addEventListener('click',()=>{if(userSessionCursor!==null)void loadUserSessions(userSessionCursor);});
document.querySelector('#workspace-conversation-archived').addEventListener('click',event=>{
  showArchivedSessions=!showArchivedSessions;const button=event.currentTarget;button.setAttribute('aria-pressed',String(showArchivedSessions));
  button.textContent=showArchivedSessions?'현재 세션 보기':'보관된 세션 보기';void loadUserSessions(null);
});
document.querySelector('#workspace-conversation-more').addEventListener('click',()=>{const id=document.querySelector('#workspace-conversation-continue').dataset.sessionId;if(id&&userSessionRunCursor!==null)void readUserSession(id,userSessionRunCursor);});
document.querySelector('#workspace-conversation-continue').addEventListener('click',event=>{
  if(activeExecution||lastLedgerCard?.state==='running'||pending&&(pending.runId!==lastLedgerCard?.runId||!['completed','failed','blocked'].includes(lastLedgerCard?.state))){conversationStatus.textContent='진행 중이거나 승인 대기 중인 작업을 먼저 확인하세요.';return;}
  const button=event.currentTarget;setUserSession(button.dataset.sessionId,button.dataset.title);++userSessionDetailGeneration;++workspaceSessionDetailGeneration;
  clearPreparation();goalInput.value='';showWorkspaceView('work');goalInput.focus();
});
document.querySelector('#workspace-conversation-archive').addEventListener('click',async event=>{
  const id=event.currentTarget.dataset.sessionId;
  try{await window.cue.userSessions({operation:'archive',sessionId:id});if(userSessionId===id)setUserSession(null,'');document.querySelector('#workspace-conversation-detail').hidden=true;
    conversationStatus.textContent='세션을 보관했습니다. 원장 실행은 보존됩니다.';conversationStatus.focus();void loadUserSessions(null);}
  catch{conversationStatus.textContent='세션을 보관할 수 없습니다. 진행 중인 실행을 확인하세요.';}
});
async function ensureUserSession(){
  if(userSessionId||typeof window.cue?.userSessions!=='function')return userSessionId;
  if(!sessionCreating)sessionCreating=window.cue.userSessions({operation:'create'}).then(value=>{
    if(!value?.sessionId||value.archived!==false)throw Error('session unavailable');setUserSession(value.sessionId,value.title);void loadUserSessions(null);return value.sessionId;
  }).finally(()=>{sessionCreating=null;});
  return sessionCreating;
}
void loadProjects();void loadUserSessions(null);
async function loadWorkspaceSessions(cursor=null){
  const generation=++workspaceSessionGeneration;
  if(cursor===null){workspaceList.replaceChildren();workspaceSessionCursor=null;}
  workspaceNext.disabled=true;
  if(typeof window.cue?.workspaceSessions!=='function'){workspaceStatus.textContent='이 앱은 세션 목록을 지원하지 않습니다.';return;}
  workspaceStatus.textContent='현재 프로젝트의 저장된 실행을 읽는 중입니다.';
  try{
    const value=await window.cue.workspaceSessions({operation:'list',limit:20,cursor});
    if(generation!==workspaceSessionGeneration)return;
    if(value?.version!=='cue-workspace-sessions-v1'||value.authority!=='historical-ledger-index-only'||!Array.isArray(value.records)||value.records.length>20||value.complete!==(value.nextCursor===null))throw Error('unavailable');
    const project=document.querySelector('#workspace-project');project.replaceChildren();
    const name=document.createElement('span'),root=document.createElement('small');name.textContent=value.project.name;root.textContent=value.project.root;project.append(name,root);
    for(const row of value.records){
      if(!Object.hasOwn(workspaceStates,row.state))throw Error('unavailable');
      const item=document.createElement('li'),button=document.createElement('button'),title=document.createElement('span'),meta=document.createElement('small');
      button.type='button';button.dataset.runId=row.runId;title.textContent=row.title;meta.textContent=`${workspaceStates[row.state]} · ${row.startedAt}`;
      button.append(title,meta);button.setAttribute('aria-label',`${row.title} 세션 기록 열기`);
      if(workspaceSelectedRun===row.runId)button.setAttribute('aria-current','true');
      button.addEventListener('click',()=>{void readWorkspaceSession(row.runId);});item.append(button);workspaceList.append(item);
    }
    workspaceSessionCursor=value.nextCursor;workspaceNext.disabled=workspaceSessionCursor===null;
    workspaceStatus.textContent=value.records.length?`${value.records.length}개 기록 · 저장 당시 상태이며 현재 실행·정리를 증명하지 않습니다.`:'저장된 실행이 없습니다.';
  }catch{if(generation===workspaceSessionGeneration){workspaceSessionCursor=null;workspaceNext.disabled=true;workspaceStatus.textContent='세션 기록을 읽을 수 없습니다. 현재 프로젝트의 원장을 확인하세요.';}}
}
async function readWorkspaceSession(runId){
  const generation=++workspaceSessionDetailGeneration,detail=document.querySelector('#workspace-session-detail');
  workspaceSelectedRun=runId;showWorkspaceView('history');document.querySelector('#workspace-conversation-detail').hidden=true;detail.hidden=false;detail.textContent='저장된 실행을 읽는 중입니다.';
  try{
    const value=await window.cue.workspaceSessions({operation:'read',runId});
    if(generation!==workspaceSessionDetailGeneration)return;
    if(value?.version!=='cue-workspace-session-v1'||value.authority!=='historical-ledger-read-only'||value.limitation!=='stored-run-only-no-reconnect-or-execution-authority'||value.session?.runId!==runId||!Object.hasOwn(workspaceStates,value.session.state))throw Error('unavailable');
    detail.replaceChildren();const heading=document.createElement('h2'),goal=document.createElement('p'),meta=document.createElement('p'),notice=document.createElement('p');
    heading.textContent=value.session.title;goal.textContent=value.session.goal??'목표 원문 기록 없음';
    meta.className='quiet';meta.textContent=`${workspaceStates[value.session.state]} · 저장 시각 ${value.session.startedAt} · 실행 ${runId}`;
    notice.className='quiet';notice.textContent='읽기 전용 원장 기록입니다. 현재 OS 상태·원격 종료·청구를 확인하지 않았으며, 이 화면에서 실행을 재개하지 않습니다.';
    heading.tabIndex=-1;detail.append(heading,goal,meta,notice);heading.focus();
    for(const button of workspaceList.querySelectorAll('button')){if(button.dataset.runId===runId)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');}
  }catch{if(generation===workspaceSessionDetailGeneration)detail.textContent='이 세션을 읽을 수 없습니다. 현재 프로젝트의 기록만 열 수 있습니다.';}
}
document.querySelector('#workspace-session-refresh').addEventListener('click',()=>{void loadWorkspaceSessions(null);});
workspaceNext.addEventListener('click',()=>{if(workspaceSessionCursor!==null)void loadWorkspaceSessions(workspaceSessionCursor);});
document.querySelector('#workspace-new-session').addEventListener('click',async()=>{
  if(activeExecution||lastLedgerCard?.state==='running'||pending&&(pending.runId!==lastLedgerCard?.runId||!['completed','failed','blocked'].includes(lastLedgerCard?.state))){
    workspaceStatus.textContent='진행 중이거나 승인 대기 중인 작업이 있습니다. 먼저 해당 작업을 확인하세요.';return;
  }
  if(typeof window.cue?.userSessions==='function'){
    try{const value=await window.cue.userSessions({operation:'create'});if(!value?.sessionId||value.archived)throw Error('unavailable');setUserSession(value.sessionId,value.title);
      userSessionQuery=null;document.querySelector('#workspace-conversation-query').value='';void loadUserSessions(null);}
    catch{workspaceStatus.textContent='새 Cue 세션을 만들 수 없습니다.';return;}
  }else setUserSession(null,'');
  ++userSessionDetailGeneration;++workspaceSessionDetailGeneration;workspaceSelectedRun=null;clearPreparation();
  result.hidden=true;quiet.hidden=false;quiet.textContent='새 목표를 입력하고 범위를 확인하세요.';
  goalInput.value='';showWorkspaceView('work');goalInput.focus();
});
const form = document.querySelector('#goal-form');
const goalInput = document.querySelector('#goal');
const taskTemplate = document.querySelector('#task-template');
const jsonInput = document.querySelector('#json-input');
const planFirst = document.querySelector('#plan-first');
const planningAvailabilityStatus = document.querySelector('#planning-availability');
const prepareFromPlanning = document.querySelector('#prepare-from-planning');
const planningTransition = document.querySelector('#planning-transition');
let planningAvailable = false;
let completedPlanningRunId = null;
let preparationGeneration = 0;
let setupRevision = null;
let setupReady = typeof window.cue?.localJsonSetup !== 'function';
let setupBusy = false;
let setupRestart = false;
let planningSetupRevision = null;
let planningSetupReady = false;
let planningSetupBusy = false;
let activeExecution = null;
let executionLaunching = false;
const setupFields = ['maxInvocations', 'timeoutMs', 'maxOutputBytes', 'maxOutputTokens'];
function syncSetupControls() {
  const running = Boolean(activeExecution) || lastLedgerCard?.state === 'running';
  const blocked = !setupReady || setupBusy || setupRestart;
  form.querySelector('button[type="submit"]').disabled = running || blocked;
  selectionMode.disabled = selectionSave.disabled = running || blocked || !selectionAvailable;
  document.querySelector('#local-json-save').disabled = running || setupBusy || !setupReady;
  document.querySelector('#local-planning-save').disabled = running || planningSetupBusy || !planningSetupReady;
  taskTemplate.disabled = running;
  planFirst.disabled = running || blocked || !planningAvailable || taskTemplate.value !== 'general';
}
async function loadPlanningAvailability() {
  if (typeof window.cue?.planningAvailability !== 'function' || typeof window.cue?.preparePlanning !== 'function'
      || typeof window.cue?.prepareFromPlanning !== 'function') {
    planningAvailabilityStatus.textContent = '기획 경로를 사용할 수 없습니다.';
    return;
  }
  try {
    const availability = await window.cue.planningAvailability();
    planningAvailable = availability?.available === true;
    if (!planningAvailable) planFirst.checked = false;
    planningAvailabilityStatus.textContent = planningAvailable ? '기획 실행과 실행 범위를 각각 승인합니다.'
      : `기획 경로를 사용할 수 없습니다. ${Array.isArray(availability?.reasons) ? availability.reasons.join(', ') : ''}`;
  } catch { planningAvailable = false; planFirst.checked = false; planningAvailabilityStatus.textContent = '기획 경로를 확인하지 못했습니다.'; }
  syncSetupControls();
}
async function loadLocalJsonSetup() {
  if (typeof window.cue?.localJsonSetup !== 'function') return;
  document.querySelector('#local-json-setup').hidden = false;
  syncSetupControls();
  try {
    const value = await window.cue.localJsonSetup({ operation: 'read' });
    showLocalJsonSetup(value);
  } catch {
    document.querySelector('#local-json-status').textContent = '로컬 설정을 확인하지 못했습니다. 앱을 다시 열어 확인하세요.';
  }
  syncSetupControls();
}
function showLocalJsonSetup(value) {
  if (!value || (value.revision !== null && (!Number.isSafeInteger(value.revision) || value.revision < 1)) || typeof value.restartRequired !== 'boolean') throw Error('설정 응답 미확인');
  setupRevision = value.revision; setupRestart ||= value.restartRequired; setupReady = true;
  document.querySelector('#local-json-enabled').checked = value.enabled === true;
  for (const field of setupFields) if (Number.isSafeInteger(value.limits?.[field])) document.querySelector(`#local-json-${field}`).value = String(value.limits[field]);
  document.querySelector('#local-json-identity').textContent = `고정 모델: ${value.modelId} · 고정 엔드포인트: ${value.endpoint}`;
  document.querySelector('#local-json-status').textContent = `${value.configured ? '설정 저장됨' : '설정 미등록'} · 실행 자격은 별도 검증합니다. ${setupRestart ? '변경 적용을 위해 앱을 재시작하세요. 새 실행 준비는 중지됩니다.' : value.available ? '현재 호스트 사용 가능' : '현재 호스트 사용 불가'}`;
  if (setupRestart && !activeExecution && lastLedgerCard?.state !== 'running') clearPreparation();
}
async function loadLocalPlanningSetup() {
  if (typeof window.cue?.localPlanningSetup !== 'function') return;
  document.querySelector('#local-planning-setup').hidden = false;
  try {
    showLocalPlanningSetup(await window.cue.localPlanningSetup({ operation: 'read' }));
  } catch {
    document.querySelector('#local-planning-status').textContent = '기획 설정을 확인하지 못했습니다. 앱을 다시 열어 확인하세요.';
  }
  syncSetupControls();
}
function showLocalPlanningSetup(value) {
  if (!value || value.templateId !== 'goal-planning-v1' || value.settingsId !== 'goal-planning-default'
      || (value.revision !== null && (!Number.isSafeInteger(value.revision) || value.revision < 1))
      || typeof value.restartRequired !== 'boolean') throw Error('기획 설정 응답 미확인');
  planningSetupRevision = value.revision;
  planningSetupReady = true;
  setupRestart ||= value.restartRequired;
  document.querySelector('#local-planning-enabled').checked = value.enabled === true;
  for (const field of setupFields) if (Number.isSafeInteger(value.limits?.[field])) document.querySelector(`#local-planning-${field}`).value = String(value.limits[field]);
  document.querySelector('#local-planning-identity').textContent = `고정 모델: ${value.modelId} · 고정 엔드포인트: ${value.endpoint}`;
  document.querySelector('#local-planning-status').textContent = `${value.configured ? '기획 설정 저장됨' : '기획 설정 미등록'} · ${setupRestart ? '변경 적용을 위해 앱을 재시작하세요. 새 실행 준비는 중지됩니다.' : value.available ? '현재 기획 호스트 사용 가능' : '현재 기획 호스트 사용 불가'}`;
  if (setupRestart && !activeExecution && lastLedgerCard?.state !== 'running') clearPreparation();
}
const approve = document.querySelector('#approve');
const stop = document.querySelector('#stop');
const result = document.querySelector('#result');
const quiet = document.querySelector('#quiet');
const explorationConsent = document.querySelector('#exploration-consent');
const allowExploration = document.querySelector('#allow-exploration');
const explorationConsentCopy = document.querySelector('#exploration-consent-copy');
const transportError = document.querySelector('#transport-error');
const selectionControls = document.querySelector('#selection-controls');
const selectionMode = document.querySelector('#selection-mode');
const selectionSave = document.querySelector('#selection-save');
const selectionStatus = document.querySelector('#selection-status');
const selectionLabels = { efficiency: '효율', performance: '고성능', value: '가성비', speed: '속도' };
const selectionDescriptions = { efficiency: '요구 품질 안에서 시간과 비용의 균형을 고려합니다.', performance: '결과 품질과 정확도를 우선합니다.', value: '검증된 완료까지의 총비용을 우선합니다.', speed: '요구 품질 안에서 완료 시간을 우선합니다.' };
let selectionAvailable = false;
let selectionReady = true;
let preferenceRevision = 0;
let pending = null;
let pollGeneration = 0;
let lastLedgerCard = null;
let nativeRecoveryRun = null, nativeRecoveryGeneration = 0, nativeRecoveryBusy = false;
let nativeRecoveryCurrent = null, nativeRecoveryHistorical = false, nativeRecoveryRunsGeneration = 0, nativeRecoveryRunsBusy = false;
const recoveryElement = suffix => document.querySelector(`#native-recovery-${suffix}`);
function syncNativeRecoveryControls() {
  const unavailable = typeof window.cue?.nativeRecovery !== 'function';
  recoveryElement('list').disabled = unavailable || !nativeRecoveryRun || nativeRecoveryBusy;
  recoveryElement('runs').disabled = unavailable || nativeRecoveryRunsBusy;
  recoveryElement('follow').disabled = !nativeRecoveryHistorical;
  for (const button of recoveryElement('records').querySelectorAll('button')) button.disabled = unavailable || nativeRecoveryBusy;
}
function selectNativeRecoveryRun(runId) {
  nativeRecoveryCurrent = runId;
  if (!nativeRecoveryHistorical) setNativeRecoveryTarget(runId);
}
function setNativeRecoveryTarget(runId, force = false) {
  if (nativeRecoveryRun === runId && !force) return;
  nativeRecoveryRun = runId; nativeRecoveryGeneration++; nativeRecoveryBusy = false;
  nativeRecoveryRunsGeneration++; nativeRecoveryRunsBusy = false;
  recoveryElement('runs-list').replaceChildren(); recoveryElement('runs-status').textContent = '';
  recoveryElement('records').replaceChildren(); recoveryElement('observation').hidden = true;
  recoveryElement('states').replaceChildren(); recoveryElement('time').textContent = ''; recoveryElement('provenance').textContent = '';
  recoveryElement('journal').textContent = '';
  recoveryElement('current').textContent = runId ? `${nativeRecoveryHistorical ? '과거 실행 관측 대상' : '현재 실행 따라가기'}: ${runId}` : '현재 실행을 먼저 준비하세요.';
  recoveryElement('status').textContent = typeof window.cue?.nativeRecovery === 'function' ? '' : '현재 호스트에서는 실행 상태 관측을 사용할 수 없습니다.';
  syncNativeRecoveryControls();
}
async function requestNativeRecoveryRuns() {
  if (nativeRecoveryRunsBusy || typeof window.cue?.nativeRecovery !== 'function') return;
  const generation = ++nativeRecoveryRunsGeneration, targetGeneration = nativeRecoveryGeneration;
  const current = () => generation === nativeRecoveryRunsGeneration && targetGeneration === nativeRecoveryGeneration;
  nativeRecoveryRunsBusy = true; syncNativeRecoveryControls();
  recoveryElement('runs-list').replaceChildren(); recoveryElement('runs-status').textContent = '현재 작업공간의 저장된 실행 목록을 읽는 중입니다.';
  try {
    const reply = await window.cue.nativeRecovery({operation:'runs'});
    if (!current()) return;
    const value = reply?.value;
    if (!reply.available || reply.operation !== 'runs' || value?.authority !== 'observation-only' || value.version !== 'cue-native-recovery-runs-v1' || !Array.isArray(value.records) || value.records.length > 50) throw Error('unavailable');
    const labels = { 'recorded-unverified':'기록 있음 · 신원 미검증', 'no-recorded-identities':'신원 기록 없음', 'lineage-incomplete':'연결 기록 불완전' };
    for (const row of value.records) {
      const item = document.createElement('li'), button = document.createElement('button');
      item.textContent = `${row.runId} · 저장 상태 ${row.state} · 시도 ${row.recordedAttemptCount}개 · 신원 ${row.identityRecordCount}개 · 신원 없는 시도 ${row.missingIdentityAttemptCount}개 · 단계 연결 누락 ${row.missingStageLinkCount}개 · ${Object.hasOwn(labels,row.recordStatus) ? labels[row.recordStatus] : '기록 상태 미확인'} `;
      button.type = 'button'; button.textContent = '이 실행을 관측 대상으로 선택';
      button.addEventListener('click', () => { if (!current()) return; nativeRecoveryHistorical = true; setNativeRecoveryTarget(row.runId, true); });
      item.append(button); recoveryElement('runs-list').append(item);
    }
    recoveryElement('runs-status').textContent = `${value.records.length ? `${value.records.length}개 표시 · 저장된 메타데이터이며 현재 신원을 검증한 결과가 아닙니다.` : '조회 범위에 표시할 실행이 없습니다.'}${value.truncated ? ' 일부 실행 생략 (최대 50개).' : ''}${value.scanTruncated ? ' 최근 1,000개까지만 검색하여 전체 실행을 확인하지 못했습니다.' : ''}`;
  } catch {
    if (current()) { recoveryElement('runs-list').replaceChildren(); recoveryElement('runs-status').textContent = '실행 목록을 읽을 수 없습니다. 호스트와 기록 상태를 확인하세요.'; }
  } finally { if (current()) { nativeRecoveryRunsBusy = false; syncNativeRecoveryControls(); } }
}
async function requestNativeRecovery(operation, record) {
  if (!nativeRecoveryRun || nativeRecoveryBusy || typeof window.cue?.nativeRecovery !== 'function') return;
  const runId = nativeRecoveryRun, generation = nativeRecoveryGeneration;
  const command = operation === 'list' ? { operation, runId } : { operation, runId, attemptId: record.attemptId, identityRef: record.identityRef };
  nativeRecoveryBusy = true; syncNativeRecoveryControls(); recoveryElement('status').textContent = operation === 'list' ? '저장된 신원을 읽는 중입니다.' : '현재 상태를 관측하는 중입니다. 설치 검증에 시간이 걸릴 수 있습니다.';
  recoveryElement('observation').hidden = true;
  recoveryElement('journal').textContent = '';
  try {
    const reply = await window.cue.nativeRecovery(command);
    if (generation !== nativeRecoveryGeneration || runId !== nativeRecoveryRun) return;
    if (!reply?.available || reply.operation !== operation || reply.value?.runId !== runId || reply.value.authority !== 'observation-only') throw Error('unavailable');
    const value = reply.value;
    if (operation === 'list') {
      if (!Array.isArray(value.records) || value.records.length > 64) throw Error('unavailable');
      recoveryElement('records').replaceChildren();
      for (const row of value.records) {
        const item = document.createElement('li'), text = document.createElement('span'), button = document.createElement('button');
        text.textContent = `${row.attemptId} · ${row.candidateId}`; button.type = 'button'; button.textContent = '이 기록의 현재 상태 관측';
        button.addEventListener('click', () => { if (generation === nativeRecoveryGeneration && runId === nativeRecoveryRun) void requestNativeRecovery('observe', row); });
        item.append(text, document.createTextNode(' '), button); recoveryElement('records').append(item);
      }
      recoveryElement('status').textContent = !value.records.length ? '이 실행에는 저장된 네이티브 신원이 없습니다. 신원 기록이 없는 실행은 관측할 수 없습니다.'
        : value.truncated ? '첫 64개 기록입니다. 일부 기록은 표시하지 않습니다. 관측할 기록을 선택하세요.' : '저장된 기록입니다. 현재 상태는 별도로 관측하세요.';
    } else {
      if (value.attemptId !== command.attemptId || value.identityRef !== command.identityRef) throw Error('unavailable');
      const processLabels = { 'matching-alive': '동일 신원 · 실행 중', 'matching-exited': '동일 신원 · 종료 상태', 'pid-reused': 'PID 재사용 · 다른 프로세스', absent: '없음', unknown: '확인 불가' };
      const pathLabels = { present: '잔여 항목 있음', absent: '없음', unknown: '확인 불가' };
      recoveryElement('states').replaceChildren();
      for (const [key, label] of [['launcher','실행기'],['client','클라이언트'],['guardian','정리 감시자']]) {
        const item = document.createElement('li'); item.textContent = `${label}: ${processLabels[value.processes?.[key]] ?? '확인 불가'}`; recoveryElement('states').append(item);
      }
      for (const [key, label] of [['taskRoot','작업 영역'],['profileRoot','프로필 영역'],['profilePath','격리 프로필']]) {
        const item = document.createElement('li'); item.textContent = `${label}: ${pathLabels[value.paths?.[key]] ?? '확인 불가'}`; recoveryElement('states').append(item);
      }
      recoveryElement('time').textContent = `관측 시각: ${value.observedAt} · ${value.sourceKind === 'fixture' ? '테스트 관측' : '호스트 관측'}`;
      recoveryElement('provenance').textContent = `경로 출처: ${value.pathProvenance === 'matched' ? '현재 호스트 위치와 일치' : '확인 불가'} · 관측 전용 · 정리 승인 및 소유권 변경 없음`;
      const journalLabels = { held: '보류 · 추가 확인 필요', 'eligible-for-disposition': '검토 자료 확인됨 · 별도 처분 필요', 'reconciled-stop': '중단 상태로 정리됨', unavailable: '확인 불가' };
      const journalReasons = { 'handoff-unavailable':'전달 기록 확인 불가', 'handoff-integrity-unavailable':'전달 기록 무결성 확인 불가', 'external-effect-authority-unavailable':'외부 작업 결과 확인 필요', 'cleanup-or-death-unverified':'정리 또는 종료 확인 불가', 'native-journal-observation-unavailable':'변경 기록 관측 불가' };
      const journalState = value.journal?.state;
      const reasonField = value.journal && typeof value.journal === 'object' ? Object.getOwnPropertyDescriptor(value.journal,'reasonCode') : null;
      const reasonCode = reasonField && Object.hasOwn(reasonField,'value') && typeof reasonField.value === 'string' ? reasonField.value : null;
      const reason = ['held','unavailable'].includes(journalState) && Object.hasOwn(journalReasons,reasonCode) ? ` · ${journalReasons[reasonCode]}` : '';
      recoveryElement('journal').textContent = `변경 기록 복구: ${Object.hasOwn(journalLabels, journalState) ? journalLabels[journalState] : journalLabels.unavailable}${reason} · 자동 재실행·복원 없음`;
      recoveryElement('observation').hidden = false; recoveryElement('status').textContent = '요청 시점의 관측 결과입니다. 이후 상태는 바뀔 수 있습니다.';
    }
  } catch {
    if (generation !== nativeRecoveryGeneration || runId !== nativeRecoveryRun) return;
    recoveryElement('observation').hidden = true;
    if (operation === 'list') recoveryElement('records').replaceChildren();
    recoveryElement('status').textContent = '관측을 사용할 수 없거나 확인에 실패했습니다. 기록과 앱 상태를 확인한 뒤 다시 요청하세요.';
  } finally {
    if (generation === nativeRecoveryGeneration && runId === nativeRecoveryRun) { nativeRecoveryBusy = false; syncNativeRecoveryControls(); }
  }
}
recoveryElement('list').addEventListener('click', () => { void requestNativeRecovery('list'); });
recoveryElement('runs').addEventListener('click', () => { void requestNativeRecoveryRuns(); });
recoveryElement('follow').addEventListener('click', () => { nativeRecoveryHistorical = false; setNativeRecoveryTarget(nativeRecoveryCurrent, true); });
if (typeof window.cue?.nativeRecovery !== 'function') recoveryElement('status').textContent = '현재 호스트에서는 실행 상태 관측을 사용할 수 없습니다.';
syncNativeRecoveryControls();
let evaluationRun = null, evaluationGeneration = 0, evaluationBusy = false, evaluationLocked = true, evaluationEnrollment = null, evaluationObservation = null, evaluationComparisonGeneration = 0, evaluationComparisonBusy = false, evaluationComparisonListGeneration=0, evaluationComparisonListBusy=false, evaluationComparisonListCursor=null, evaluationProjectionListGeneration=0, evaluationProjectionListBusy=false, evaluationProjectionListCursor=null, evaluationPickerSelected=new Set(), evaluationMeasuredFactGeneration=0, evaluationMeasuredFactBusy=false, evaluationMeasuredFactListGeneration=0, evaluationMeasuredFactListBusy=false, evaluationMeasuredFactListCursor=null;
const evaluationElement = id => document.querySelector(`#evaluation-${id}`);
let measuredComparisonGeneration=0,measuredComparisonBusy=false,measuredComparisonCursor=null;
const measuredElement=id=>evaluationElement(`measured-comparison-${id}`);
let localContractGeneration=0,localContractBusy=false,localContracts=null;
let evaluationDataset=null;
const evaluationDatasetFields=['datasetId','datasetRevision','evaluationCaseId','evaluationInputDigest','holdoutCaseId','holdoutInputDigest','caseKind','caseId'];
function resetEvaluationDataset(message){
  evaluationDataset=null;
  evaluationElement('dataset-case').replaceChildren(new Option('케이스를 명시적으로 선택하세요',''));
  evaluationElement('dataset-status').textContent=message;
  syncEvaluation();
}
evaluationElement('dataset-reset').addEventListener('click',()=>{
  if(evaluationBusy||evaluationRun&&evaluationLocked)return;
  resetEvaluationDataset('수동 2케이스 입력으로 전환했습니다. 기존 직접 입력은 유지됩니다.');
});
evaluationElement('dataset-import').addEventListener('click',()=>{
  if(evaluationBusy||evaluationRun&&evaluationLocked)return;
  try{
    const text=evaluationElement('dataset-json').value;if(!text.trim()||text.length>65536)throw Error('dataset');
    const raw=JSON.parse(text),packaged=(raw?.version==='cue-evaluation-preparation-v1'&&raw.authority==='input-materialization-only'
      ||raw?.version==='cue-evaluation-workload-v1'&&raw.authority==='workload-inventory-only')&&raw.executionAuthorized===false;
    const value=packaged?raw.dataset:raw;
    const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
    const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(v);
    if(!exact(value,['id','revision','cases'])||!id(value.id)||!id(value.revision)||!Array.isArray(value.cases)||value.cases.length<2||value.cases.length>64)throw Error('dataset');
    const cases=value.cases.map(row=>{
      if(!exact(row,['id','kind','inputDigest','split'])||!id(row.id)||!['code','research','document','external'].includes(row.kind)
        ||typeof row.inputDigest!=='string'||!/^[a-f0-9]{64}$/.test(row.inputDigest)||!['evaluation','holdout'].includes(row.split))throw Error('dataset');
      return Object.freeze({...row});
    });
    if(new Set(cases.map(row=>row.id)).size!==cases.length||new Set(cases.map(row=>row.inputDigest)).size!==cases.length||new Set(cases.map(row=>row.split)).size!==2)throw Error('dataset');
    evaluationDataset=Object.freeze({id:value.id,revision:value.revision,cases:Object.freeze(cases)});
    evaluationElement('dataset-case').replaceChildren(new Option('케이스를 명시적으로 선택하세요',''),...cases.map(row=>new Option(`${row.split==='holdout'?'홀드아웃':'평가'} · ${row.id}`,row.id)));
    evaluationElement('dataset-status').textContent=`${value.id} / ${value.revision} · 평가 ${cases.filter(row=>row.split==='evaluation').length}개 · 홀드아웃 ${cases.filter(row=>row.split==='holdout').length}개. 현재 실행의 케이스를 선택한 뒤 등록하세요. 입력 파일의 일치나 실행 자격은 검증하지 않습니다.`;
    syncEvaluation();
  }catch{resetEvaluationDataset('가져오기 실패: JSON 형식, 양쪽 split, 중복 ID/입력 지문, 64개 제한을 확인하세요. 이전 manifest 선택은 해제됐습니다.');}
});
function resetLocalContracts(){
  localContractGeneration++;localContractBusy=false;localContracts=null;
  evaluationElement('local-contract-output').hidden=true;evaluationElement('local-contract-output').textContent='';
  evaluationElement('local-contract-status').textContent='명시적으로 요청할 때만 로컬 계약을 저장합니다. 공급자 호출은 없습니다.';
}
evaluationElement('local-contract-capture').addEventListener('click',async()=>{
  if(localContractBusy)return;const generation=++localContractGeneration;localContractBusy=true;localContracts=null;
  evaluationElement('local-contract-output').hidden=true;evaluationElement('local-contract-output').textContent='';syncEvaluation();
  evaluationElement('local-contract-status').textContent='현재 로컬 관측과 검사 척도를 기록하고 있습니다.';
  try{
    const reply=await window.cue.evaluation({operation:'local-contract-capture'});if(generation!==localContractGeneration)return;const v=reply?.value;
    if(!reply?.available||reply.operation!=='local-contract-capture'||v?.version!=='cue-local-evaluation-contracts-v1'||v.authority!=='local-contract-registration-only'||v.environmentComplete!==false||v.scope!=='local-process-at-capture-only'||[v.qualityMeasured,v.executedInputVerified,v.trialReady,v.promotionEligible].some(x=>x!==false))throw Error('unavailable');
    localContracts=v;evaluationElement('local-contract-output').textContent=JSON.stringify({metric:v.metric,environment:v.environment,environmentComplete:false,missing:v.missing},null,2);evaluationElement('local-contract-output').hidden=false;
    evaluationElement('local-contract-status').textContent='로컬 계약 저장됨. 환경은 불완전하며 실행 당시 환경이 아닙니다. 품질 점수·계정 한도·가격·측정 trial은 없습니다. 복사는 등록/승인/실행하지 않습니다.';
  }catch{if(generation===localContractGeneration)evaluationElement('local-contract-status').textContent='로컬 계약을 기록할 수 없습니다. 일부 불변 계약만 저장됐을 수 있으며 자동 재시도/삭제하지 않습니다.';}
  finally{if(generation===localContractGeneration){localContractBusy=false;syncEvaluation();}}
});
evaluationElement('local-contract-copy').addEventListener('click',()=>{
  if(!localContracts||localContractBusy||!evaluationRun||evaluationLocked||evaluationBusy)return;
  const form=evaluationElement('enroll-form');for(const kind of ['metric','environment'])for(const [suffix,key] of [['Id','id'],['Revision','revision'],['Digest','digest']])form.elements.namedItem(kind+suffix).value=localContracts[kind][key];
  evaluationElement('local-contract-status').textContent='지표·불완전 환경 참조만 복사했습니다. 계정 한도는 채우지 않았습니다. 등록/승인/실행은 별도이며 이 환경만으로 측정 trial을 만들 수 없습니다.';
});
function resetMeasuredComparison(){
  measuredComparisonGeneration++;measuredComparisonBusy=false;measuredComparisonCursor=null;
  measuredElement('records').replaceChildren();clearMeasuredComparison();
  measuredElement('status').textContent='요청할 때만 읽습니다. 생성·재검사·실행을 자동 수행하지 않습니다.';
}
function clearMeasuredComparison(){
  measuredElement('output').hidden=true;
  for(const id of ['summary','criteria','splits','reasons','current'])measuredElement(id).replaceChildren();
}
function renderMeasuredComparison(value,snapshotId){
  if(value?.version!=='cue-measured-comparison-view-v1'||value.authority!=='historical-measured-cohort-descriptive-only'||value.snapshotId!==snapshotId||value.promotionEligible!==false||value.improvementProven!==false||value.statisticalQualification!=='not-performed')throw Error('unavailable');
  const withheld=value.numericInputs!=='complete-cohort',p=value.provenance;
  measuredElement('summary').textContent=`저장 당시 결과 · ${value.snapshotId} · 기록 시각 ${value.recordedAtMs} · ${value.dataset.id} (${value.dataset.revision}) · ${value.constraints.mode} · ${evaluationComparisonStatusLabels[value.status]} · ${withheld?'수치 비교 보류 — 불완전/호환되지 않는 코호트':'전체 코호트 수치'} · 오프라인 픽스처 ${p.fixture} / 호스트 관측 ${p.observed} / 출처 확인 불가 ${p.unavailable}${value.incompatibleMetric?' · 품질 지표 불일치':''}`;
  measuredElement('criteria').textContent=`저장 기준 (실측값 아님)\n${JSON.stringify(value.constraints,null,2)}`;
  const describe=a=>`분모 ${a.outcomeDenominator} / 기대 ${a.expectedCaseCount} · 등록 ${a.enrollmentCount} · 측정 ${a.trialCount} · 등록 누락 ${a.missingEnrollmentCount} / 관측 누락 ${a.missingObservationCount} / 사실 누락 ${a.missingFactCount} / 변환 불가 ${a.nonConvertibleCount} · 성공 ${a.outcomes.success} / 실패 ${a.outcomes.fail} / 취소 ${a.outcomes.cancelled} / 미확인 ${a.outcomes.unknown} / 사용 불가 ${a.outcomes.unavailable}`;
  measuredElement('splits').replaceChildren();
  for(const split of value.splits){
    const item=document.createElement('li');item.textContent=`${evaluationComparisonLabels[split.split]} · 기준군 ${describe(split.baseline)} · 후보군 ${describe(split.candidate)} · ${evaluationComparisonStatusLabels[split.status]} · 사유 ${split.reasons.map(r=>evaluationComparisonReasonLabels[r]??r).join(', ')||'없음'}`;
    if(!withheld&&split.numbers){const n=split.numbers,show=a=>`품질 평균 ${a.qualityMean??'미측정'} / 경과 평균 ${a.elapsedMeanMs??'미측정'}ms / 비용 평균 ${a.costMeanUnits??'미측정'} (${a.currency??'미확인'} ${a.unit??'단위 미확인'})`;item.textContent+=` · 저장 수치: 기준군 ${show(n.baseline)} · 후보군 ${show(n.candidate)} · 짝지은 목표 차이 평균 ${n.pairedImprovementMean??'미측정'}`;}
    measuredElement('splits').append(item);
  }
  measuredElement('reasons').textContent=`변환 제한 사유: ${Object.entries(value.reasonCounts).map(([r,n])=>`${r} ${n}`).join(', ')||'없음'} (비공개 세부 사유는 other-measurement-uncertainty로 합산)`;
  measuredElement('current').textContent='현재 증거: 재검사하지 않음. 저장 기록 읽기는 외부 증거를 확인하지 않습니다.';
  measuredElement('output').hidden=false;
}
async function requestMeasuredComparison(command){
  if(measuredComparisonBusy)return;
  const generation=++measuredComparisonGeneration;measuredComparisonBusy=true;clearMeasuredComparison();syncEvaluation();
  measuredElement('status').textContent='측정 비교 요청을 처리하고 있습니다.';
  try{
    const reply=await window.cue.evaluation(command);if(generation!==measuredComparisonGeneration)return;
    if(!reply?.available||reply.operation!==command.operation)throw Error('unavailable');const v=reply.value;
    if(command.operation==='measured-comparison-list'){
      if(v?.version!=='cue-measured-comparison-list-v1'||v.authority!=='bounded-workspace-descriptive-index'||!Array.isArray(v.records)||v.records.length>10||v.complete!==(v.nextCursor===null))throw Error('unavailable');
      measuredElement('records').replaceChildren();
      for(const row of v.records){if(row.promotionEligible!==false||row.improvementProven!==false)throw Error('unavailable');const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=`${row.snapshotId} · ${row.recordedAtMs} · ${row.dataset.id} · ${row.mode} · ${evaluationComparisonStatusLabels[row.status]} · ${row.measurementSource} · ${row.numericInputs}`;button.addEventListener('click',()=>{measuredElement('read-form').elements.snapshotId.value=row.snapshotId;void requestMeasuredComparison({operation:'measured-comparison-read',snapshotId:row.snapshotId});});li.append(button);measuredElement('records').append(li);}
      measuredComparisonCursor=v.nextCursor;measuredElement('status').textContent=`${v.records.length}개 표시. ${v.complete?'마지막 목록입니다.':'다음 목록이 있습니다 (필터링되어 빈 페이지일 수 있습니다).'} 저장 순서이며 기존 결과 전용/다른 작업공간/손상 기록은 제외됩니다.`;
    }else{
      renderMeasuredComparison(v.historical??v,command.snapshotId);
      if(command.operation==='measured-comparison-inspect'){
        if(v.current?.authority!=='evidence-revalidation-only'||v.promotionEligible!==false||v.improvementProven!==false||!['unchanged','changed','unavailable'].includes(v.current.status))throw Error('unavailable');
        const c=v.current.counts;measuredElement('current').textContent=`현재 증거 재검사: ${v.current.status} · 동일 ${c.unchanged} / 변경 ${c.changed} / 검사 불가 ${c.unavailable}. 현재 성능·가격 신선도·개선 판정이 아닙니다.`;
      }
      measuredElement('status').textContent=command.operation==='measured-comparison-create'?'측정 비교가 저장되었습니다. 동일 ID·요청은 저장 당시 기록을 재사용합니다.':'저장 당시 결과와 현재 검사 여부를 구분해 확인하세요.';
    }
  }catch{if(generation===measuredComparisonGeneration){clearMeasuredComparison();measuredComparisonCursor=null;measuredElement('records').replaceChildren();measuredElement('status').textContent='측정 비교를 사용할 수 없습니다. ID·등록 구성·정책·작업공간·측정 호스트를 확인하세요. 실제 모델 호출이나 자동 재시도는 하지 않습니다.';}}
  finally{if(generation===measuredComparisonGeneration){measuredComparisonBusy=false;syncEvaluation();}}
}
measuredElement('create-form').addEventListener('submit',event=>{
  event.preventDefault();if(measuredComparisonBusy)return;const data=new FormData(event.currentTarget),constraints={};
  for(const key of ['mode','baselinePolicyDigest','candidatePolicyDigest'])constraints[key]=String(data.get(key));
  for(const key of ['maxPriceAgeMs','minPairsPerSplit','qualityFloor','minSuccessRate','maxUnknownRate','costBasisUnits','timeBasisMs','minImprovement']){
    if(!String(data.get(key)).trim()){measuredElement('status').textContent='필수 비교 기준을 모두 입력하세요.';return;}constraints[key]=Number(data.get(key));
  }
  constraints.costLimitUnits=String(data.get('costLimitUnits')).trim()===''?null:Number(data.get('costLimitUnits'));
  if(constraints.mode==='performance'&&constraints.costLimitUnits===null){measuredElement('status').textContent='고성능 모드는 비용 상한이 필요합니다.';return;}
  const ids=key=>String(data.get(key)).split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  void requestMeasuredComparison({operation:'measured-comparison-create',snapshotId:String(data.get('snapshotId')),baselineEnrollmentIds:ids('baselineEnrollmentIds'),candidateEnrollmentIds:ids('candidateEnrollmentIds'),constraints});
});
measuredElement('read-form').addEventListener('submit',event=>{event.preventDefault();void requestMeasuredComparison({operation:'measured-comparison-read',snapshotId:measuredElement('read-form').elements.snapshotId.value});});
measuredElement('inspect').addEventListener('click',()=>{void requestMeasuredComparison({operation:'measured-comparison-inspect',snapshotId:measuredElement('read-form').elements.snapshotId.value});});
measuredElement('refresh').addEventListener('click',()=>{void requestMeasuredComparison({operation:'measured-comparison-list',limit:10,cursor:null});});
measuredElement('next').addEventListener('click',()=>{if(measuredComparisonCursor!==null)void requestMeasuredComparison({operation:'measured-comparison-list',limit:10,cursor:measuredComparisonCursor});});
function syncEvaluation() {
  const available = typeof window.cue?.evaluation === 'function';
  evaluationElement('panel').hidden = !available;
  evaluationElement('local-contract-capture').disabled=!available||localContractBusy;
  evaluationElement('local-contract-copy').disabled=!available||localContractBusy||!localContracts||!evaluationRun||evaluationLocked||evaluationBusy;
  for(const field of measuredElement('panel').querySelectorAll('input,textarea,select,button'))field.disabled=!available||measuredComparisonBusy;
  measuredElement('next').disabled=!available||measuredComparisonBusy||measuredComparisonCursor===null;
  for(const field of evaluationElement('comparison-form').elements)field.disabled=!available||evaluationComparisonBusy;
  for(const field of evaluationElement('comparison-create-form').elements)field.disabled=!available||evaluationComparisonBusy;
  for(const field of evaluationElement('measured-fact-form').elements)field.disabled=!available||evaluationMeasuredFactBusy||Boolean(evaluationRun&&evaluationLocked);
  evaluationElement('measured-fact-list-refresh').disabled=!available||evaluationMeasuredFactListBusy||Boolean(evaluationRun&&evaluationLocked);
  evaluationElement('measured-fact-list-next').disabled=!available||evaluationMeasuredFactListBusy||evaluationMeasuredFactListCursor===null||Boolean(evaluationRun&&evaluationLocked);
  evaluationElement('comparison-list-refresh').disabled=!available||evaluationComparisonListBusy;
  evaluationElement('comparison-list-next').disabled=!available||evaluationComparisonListBusy||evaluationComparisonListCursor===null;
  evaluationElement('projection-list-refresh').disabled=!available||evaluationProjectionListBusy;
  evaluationElement('projection-list-next').disabled=!available||evaluationProjectionListBusy||evaluationProjectionListCursor===null;
  evaluationElement('current').textContent = evaluationRun ? `현재 준비된 실행: ${evaluationRun}` : '현재 실행을 먼저 준비하세요.';
  for (const field of evaluationElement('enroll-form').elements) field.disabled = !available || !evaluationRun || evaluationLocked || evaluationBusy || Boolean(evaluationDataset&&evaluationDatasetFields.includes(field.name));
  const datasetLocked=!available||evaluationBusy||Boolean(evaluationRun&&evaluationLocked);
  for(const id of ['dataset-json','dataset-import','dataset-reset'])evaluationElement(id).disabled=datasetLocked;
  evaluationElement('dataset-case').disabled=datasetLocked||!evaluationDataset;
  for(const field of evaluationElement('baseline-form').elements)field.disabled=datasetLocked||!evaluationDataset||!evaluationRun;
  evaluationElement('observe-form').hidden = !evaluationEnrollment;
  for (const field of evaluationElement('observe-form').elements) field.disabled = evaluationBusy;
  evaluationElement('projection').hidden = !evaluationObservation;
  evaluationElement('projection').disabled = evaluationBusy;
  evaluationElement('coverage').hidden = !evaluationObservation;
  evaluationElement('coverage').disabled = evaluationBusy;
}
function clearEvaluationComparison(message='비교 ID를 직접 입력해 저장된 비교 기록을 읽습니다. 자동 조회하지 않습니다.'){
  evaluationElement('comparison-output').hidden=true;evaluationElement('comparison-summary').textContent='';evaluationElement('comparison-criteria').textContent='';evaluationElement('comparison-splits').replaceChildren();evaluationElement('comparison-limit').textContent='';evaluationElement('comparison-status').textContent=message;
}
function clearEvaluationMeasuredFact(message='사실 ID를 직접 입력해 저장된 근거만 읽습니다. 자동 조회하지 않습니다.'){
  evaluationElement('measured-fact-output').hidden=true;evaluationElement('measured-fact-summary').textContent='';evaluationElement('measured-fact-attempts').replaceChildren();evaluationElement('measured-fact-measurements').textContent='';evaluationElement('measured-fact-limit').textContent='';evaluationElement('measured-fact-status').textContent=message;
}
function selectEvaluationRun(runId) {
  if (evaluationRun === runId) return;
  evaluationElement('dataset-case').value='';
  resetMeasuredComparison();resetLocalContracts();
  evaluationRun = runId; evaluationGeneration++; evaluationComparisonGeneration++; evaluationComparisonListGeneration++; evaluationProjectionListGeneration++; evaluationMeasuredFactGeneration++; evaluationMeasuredFactListGeneration++; evaluationBusy = false; evaluationComparisonBusy=false; evaluationComparisonListBusy=false; evaluationComparisonListCursor=null; evaluationProjectionListBusy=false; evaluationProjectionListCursor=null; evaluationMeasuredFactBusy=false; evaluationMeasuredFactListBusy=false; evaluationMeasuredFactListCursor=null; evaluationPickerSelected.clear(); evaluationLocked = !runId; evaluationEnrollment = null; evaluationObservation = null;
  clearEvaluationComparison();
  clearEvaluationMeasuredFact();
  evaluationElement('measured-fact-list-records').replaceChildren();evaluationElement('measured-fact-list-status').textContent='저장 사실 목록은 요청할 때만 읽습니다.';
  evaluationElement('comparison-create-status').textContent='저장된 비교용 기록 ID를 직접 입력해야 하며 자동으로 비교를 만들지 않습니다.';
  evaluationElement('comparison-list-records').replaceChildren();evaluationElement('comparison-list-status').textContent='저장 목록은 요청할 때만 읽습니다.';
  evaluationElement('projection-list-records').replaceChildren();evaluationElement('projection-list-status').textContent='비교용 기록은 요청할 때만 읽으며 선택해도 자동으로 비교를 만들지 않습니다.';
  evaluationElement('status').textContent = ''; evaluationElement('observation').hidden = true; evaluationElement('observation').replaceChildren(); evaluationElement('projection-output').hidden=true;evaluationElement('projection-output').replaceChildren();
  evaluationElement('coverage-output').hidden = true; evaluationElement('coverage-output').replaceChildren(); syncEvaluation();
}
const evaluationComparisonLabels=Object.freeze({evaluation:'평가셋',holdout:'별도 홀드아웃'}),evaluationComparisonStatusLabels=Object.freeze({insufficient:'측정 근거 부족', 'observed-improvement':'저장 관측상 개선', 'no-observed-improvement':'저장 관측상 개선 확인 안 됨'}),evaluationComparisonReasonLabels=Object.freeze({'incomplete-paired-coverage':'짝지은 커버리지 부족','insufficient-sample':'표본 부족','mixed-measurement-provenance':'측정 출처 혼합','policy-revision-conflict':'정책 개정 불일치','future-trial':'기록 시각 이후 측정','unmatched-environment':'환경 불일치','unknown-quality':'품질 미측정','unknown-time':'시간 미측정','unknown-cost':'비용 미측정','incompatible-cost-units':'비용 단위 불일치','unverified-or-stale-price':'가격 근거 미확인','quality-floor':'품질 기준 미달','success-rate-floor':'성공률 기준 미달','unknown-rate-limit':'미확인 비율 기준 초과','quality-regression':'품질 저하','per-trial-budget-limit':'측정별 예산 기준 초과'});
function renderEvaluationComparison(value,snapshotId){
  if(value?.version!=='cue-evaluation-comparison-view-v1'||value.authority!=='immutable-descriptive-replay-only'||value.snapshotId!==snapshotId||!Object.hasOwn(evaluationComparisonStatusLabels,value.status)||value.promotionEligible!==false||value.statisticalQualification!=='not-performed')throw Error('unavailable');
  const availability=new Map(value.availability.splits.map(item=>[item.split,item]));
  evaluationElement('comparison-summary').textContent=`저장 ID ${value.snapshotId} · 기록 시각 ${value.recordedAtMs} · 데이터셋 ${value.dataset.id} (${value.dataset.revision}) · ${value.mode==='efficiency'?'효율':value.mode==='performance'?'고성능':value.mode==='value'?'가성비':'속도'} 모드`;
  const c=value.criteria;if(!c||Reflect.ownKeys(c).length!==9)throw Error('unavailable');
  evaluationElement('comparison-criteria').textContent=`저장 기준 · 가격 근거 최대 나이 ${c.maxPriceAgeMs}밀리초 · 분할별 최소 ${c.minPairsPerSplit}쌍 · 품질 하한 ${c.qualityFloor} · 성공률 하한 ${c.minSuccessRate} · 미확인 비율 상한 ${c.maxUnknownRate} · 측정별 비용 상한 ${c.costLimitUnits===null?'없음':`${c.costLimitUnits} 저장 비용 단위`} · 비용 계산 기준 ${c.costBasisUnits} 저장 비용 단위 · 시간 계산 기준 ${c.timeBasisMs}밀리초 · 최소 개선값 ${c.minImprovement} 목표값 절대 차이`;
  evaluationElement('comparison-splits').replaceChildren();
  for(const split of value.splits){const counts=availability.get(split.split);if(!counts)throw Error('unavailable');const item=document.createElement('li'),reasonText=split.reasons.length?split.reasons.map(reason=>evaluationComparisonReasonLabels[reason]).join(', '):'추가 제한 사유 없음';item.textContent=`${evaluationComparisonLabels[split.split]} · ${evaluationComparisonStatusLabels[split.status]} · 기준군 저장 기록 ${counts.baseline.projectionCount}건 / 측정 ${counts.baseline.trialCount}건 / 기록 누락 ${counts.baseline.missingProjectionCount}건 / 측정 없음 ${counts.baseline.missingTrialCount}건 / 결과 성공 ${counts.baseline.outcomes.success}·실패 ${counts.baseline.outcomes.fail}·취소 ${counts.baseline.outcomes.cancelled}·미확인 ${counts.baseline.outcomes.unknown}·사용 불가 ${counts.baseline.outcomes.unavailable} · 후보군 저장 기록 ${counts.candidate.projectionCount}건 / 측정 ${counts.candidate.trialCount}건 / 기록 누락 ${counts.candidate.missingProjectionCount}건 / 측정 없음 ${counts.candidate.missingTrialCount}건 / 결과 성공 ${counts.candidate.outcomes.success}·실패 ${counts.candidate.outcomes.fail}·취소 ${counts.candidate.outcomes.cancelled}·미확인 ${counts.candidate.outcomes.unknown}·사용 불가 ${counts.candidate.outcomes.unavailable} · 제한 사유 ${reasonText}`;evaluationElement('comparison-splits').append(item);}
  evaluationElement('comparison-limit').textContent=`전체 상태: ${evaluationComparisonStatusLabels[value.status]}. 저장된 기술 기록의 설명이며 통계 검정을 수행하지 않았고 정책 승격은 허용되지 않습니다.`;
  evaluationElement('comparison-output').hidden=false;evaluationElement('comparison-status').textContent='저장 당시의 설명용 기록입니다. 현재 성능이나 개선을 뜻하지 않습니다.';
}
evaluationElement('comparison-create-form').addEventListener('submit',async event=>{
  event.preventDefault();if(evaluationComparisonBusy)return;
  const data=new FormData(event.currentTarget),parse=name=>String(data.get(name)).split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
  const snapshotId=String(data.get('snapshotId')),baselineProjectionIds=parse('baselineProjectionIds'),candidateProjectionIds=parse('candidateProjectionIds'),mode=String(data.get('mode')),generation=++evaluationComparisonGeneration;
  const required=['maxPriceAgeMs','minPairsPerSplit','qualityFloor','minSuccessRate','maxUnknownRate','costBasisUnits','timeBasisMs','minImprovement'];if(required.some(name=>String(data.get(name)).trim()==='')||(mode==='performance'&&String(data.get('costLimitUnits')).trim()==='')){evaluationElement('comparison-create-status').textContent=mode==='performance'?'고성능 모드는 측정별 비용 상한을 입력해야 합니다.':'모든 필수 비교 기준을 입력하세요.';return;}
  const criteria=Object.fromEntries(required.map(name=>[name,Number(data.get(name))]));criteria.costLimitUnits=String(data.get('costLimitUnits')).trim()===''?null:Number(data.get('costLimitUnits'));
  if(baselineProjectionIds.length<1||candidateProjectionIds.length<1||baselineProjectionIds.length>64||candidateProjectionIds.length>64||new Set([...baselineProjectionIds,...candidateProjectionIds]).size!==baselineProjectionIds.length+candidateProjectionIds.length){evaluationElement('comparison-create-status').textContent='각 목록에 서로 다른 비교용 기록 ID를 1개 이상, 최대 64개까지 입력하세요.';return;}
  evaluationComparisonBusy=true;syncEvaluation();clearEvaluationComparison('설명용 비교를 저장하고 있습니다.');evaluationElement('comparison-create-status').textContent='저장 중입니다.';
  try{const reply=await window.cue.evaluation({operation:'comparison-create',snapshotId,baselineProjectionIds,candidateProjectionIds,mode,criteria});if(generation!==evaluationComparisonGeneration)return;if(!reply?.available||reply.operation!=='comparison-create')throw Error('unavailable');renderEvaluationComparison(reply.value,snapshotId);evaluationElement('comparison-create-status').textContent='설명용 비교가 저장되었습니다. 같은 요청은 같은 기록을 다시 보여 줍니다.';}
  catch{if(generation===evaluationComparisonGeneration){clearEvaluationComparison('비교를 저장할 수 없습니다. 저장 ID, 수동 기준선, 후보 모드와 현재 작업공간을 확인하세요.');evaluationElement('comparison-create-status').textContent='설명용 비교를 저장할 수 없습니다.';}}
  finally{if(generation===evaluationComparisonGeneration){evaluationComparisonBusy=false;syncEvaluation();}}
});
async function loadEvaluationComparisonList(cursor=null){
  if(evaluationComparisonListBusy)return;const generation=++evaluationComparisonListGeneration;evaluationComparisonListBusy=true;syncEvaluation();evaluationElement('comparison-list-records').replaceChildren();evaluationElement('comparison-list-status').textContent='저장 목록을 읽고 있습니다.';
  try{const reply=await window.cue.evaluation({operation:'comparison-list',limit:10,cursor});if(generation!==evaluationComparisonListGeneration)return;const value=reply?.value;if(!reply?.available||reply.operation!=='comparison-list'||value?.version!=='cue-evaluation-comparison-list-v1'||value.authority!=='bounded-workspace-descriptive-index'||value.order!=='sqlite-insertion-desc'||!Array.isArray(value.records)||value.records.length>10||value.complete!==(value.nextCursor===null))throw Error('unavailable');
    for(const row of value.records){if(row.promotionEligible!==false||!Object.hasOwn(evaluationComparisonStatusLabels,row.status))throw Error('unavailable');const item=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=`${row.snapshotId} · 기록 시각 ${row.recordedAtMs} · 데이터셋 ${row.dataset.id} (${row.dataset.revision}) · ${evaluationComparisonStatusLabels[row.status]} · 저장 순서`;button.addEventListener('click',()=>{evaluationElement('comparison-form').elements.snapshotId.value=row.snapshotId;evaluationElement('comparison-form').dispatchEvent(new Event('submit',{cancelable:true}));});item.append(button);evaluationElement('comparison-list-records').append(item);}
    evaluationComparisonListCursor=value.nextCursor;evaluationElement('comparison-list-status').textContent=value.records.length?`${value.records.length}개의 현재 작업공간 저장 기록입니다. 저장 순서로 표시하며 선택하면 다시 검증해 읽습니다.${value.complete?' 마지막 목록입니다.':' 다음 목록이 있습니다.'}`:'현재 작업공간에서 표시할 저장 기록이 없습니다.';
  }catch{if(generation===evaluationComparisonListGeneration){evaluationComparisonListCursor=null;evaluationElement('comparison-list-records').replaceChildren();evaluationElement('comparison-list-status').textContent='저장 목록을 사용할 수 없습니다. 다시 요청하세요.';}}
  finally{if(generation===evaluationComparisonListGeneration){evaluationComparisonListBusy=false;syncEvaluation();}}
}
evaluationElement('comparison-list-refresh').addEventListener('click',()=>{void loadEvaluationComparisonList(null);});
evaluationElement('comparison-list-next').addEventListener('click',()=>{if(evaluationComparisonListCursor!==null)void loadEvaluationComparisonList(evaluationComparisonListCursor);});
function addEvaluationProjection(row,target){
  const form=evaluationElement('comparison-create-form'),baseline=form.elements.baselineProjectionIds,candidate=form.elements.candidateProjectionIds,mode=form.elements.mode;
  const parse=field=>field.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean),baselineIds=parse(baseline),candidateIds=parse(candidate);
  if(baselineIds.includes(row.projectionId)||candidateIds.includes(row.projectionId)){evaluationElement('projection-list-status').textContent='이미 선택했거나 직접 입력한 비교용 기록입니다.';return;}
  const selected=target==='baseline'?baselineIds:candidateIds;if(selected.length>=64){evaluationElement('projection-list-status').textContent='각 목록에는 비교용 기록을 최대 64개까지 넣을 수 있습니다.';return;}
  if(target==='baseline'&&row.arm!=='manual-baseline'){evaluationElement('projection-list-status').textContent='기준군에는 저장된 수동 기준선 기록만 선택할 수 있습니다.';return;}
  if(target==='candidate'){
    if(row.arm==='manual-baseline'){evaluationElement('projection-list-status').textContent='수동 기준선 기록은 후보군에 선택할 수 없습니다.';return;}
    if(candidateIds.length===0)mode.value=row.arm;else if(mode.value!==row.arm){evaluationElement('projection-list-status').textContent='후보 모드가 현재 비교 폼의 모드와 다릅니다.';return;}
  }
  const field=target==='baseline'?baseline:candidate;field.value=[...selected,row.projectionId].join('\n');evaluationPickerSelected.add(row.projectionId);evaluationElement('projection-list-status').textContent=`${target==='baseline'?'기준군':'후보군'}에 기록을 선택했습니다. 설명용 비교는 저장 버튼을 눌러야 만듭니다.`;
}
async function loadEvaluationProjectionList(cursor=null){
  if(evaluationProjectionListBusy)return;const generation=++evaluationProjectionListGeneration;evaluationProjectionListBusy=true;syncEvaluation();evaluationElement('projection-list-records').replaceChildren();evaluationElement('projection-list-status').textContent='비교용 기록을 읽고 있습니다.';
  try{const reply=await window.cue.evaluation({operation:'projection-list',limit:10,cursor});if(generation!==evaluationProjectionListGeneration)return;const value=reply?.value;if(!reply?.available||reply.operation!=='projection-list'||value?.version!=='cue-evaluation-projection-list-v1'||value.authority!=='bounded-workspace-descriptive-index'||value.order!=='sqlite-insertion-desc'||!Array.isArray(value.records)||value.records.length>10||value.complete!==(value.nextCursor===null))throw Error('unavailable');
    for(const row of value.records){if(row.trialReady!==false||row.promotionEligible!==false||!['evaluation','holdout'].includes(row.split)||!['manual-baseline','efficiency','performance','value','speed'].includes(row.arm)||!['recorded','unavailable'].includes(row.outcomeAvailability))throw Error('unavailable');const item=document.createElement('li'),summary=document.createElement('span');summary.textContent=`${row.projectionId} · ${row.dataset.id} (${row.dataset.revision}) · ${row.caseId} · ${evaluationComparisonLabels[row.split]} · ${row.arm==='manual-baseline'?'수동 기준선':row.arm} · 기록 시각 ${row.observedAtMs} · 결과 ${row.outcomeAvailability==='recorded'?row.outcome:'미측정(null)'} · 측정 trial 없음`;item.append(summary);const button=document.createElement('button');button.type='button';if(row.arm==='manual-baseline'){button.textContent='기준군에 선택';button.addEventListener('click',()=>addEvaluationProjection(row,'baseline'));}else{button.textContent='후보군에 선택';button.addEventListener('click',()=>addEvaluationProjection(row,'candidate'));}item.append(button);evaluationElement('projection-list-records').append(item);}
    evaluationProjectionListCursor=value.nextCursor;evaluationElement('projection-list-status').textContent=value.records.length?`${value.records.length}개의 현재 작업공간 비교용 기록입니다.${value.complete?' 마지막 목록입니다.':' 다음 목록이 있습니다.'} 선택해도 자동 저장되지 않습니다.`:`표시할 기록이 없습니다.${value.complete?' 마지막 목록입니다.':' 다음 목록에서 계속 확인할 수 있습니다.'}`;
  }catch{if(generation===evaluationProjectionListGeneration){evaluationProjectionListCursor=null;evaluationPickerSelected.clear();evaluationElement('projection-list-records').replaceChildren();evaluationElement('projection-list-status').textContent='비교용 기록 목록을 사용할 수 없습니다. 직접 입력한 ID는 유지되며 다시 요청할 수 있습니다.';}}
  finally{if(generation===evaluationProjectionListGeneration){evaluationProjectionListBusy=false;syncEvaluation();}}
}
evaluationElement('projection-list-refresh').addEventListener('click',()=>{evaluationPickerSelected.clear();void loadEvaluationProjectionList(null);});
evaluationElement('projection-list-next').addEventListener('click',()=>{if(evaluationProjectionListCursor!==null)void loadEvaluationProjectionList(evaluationProjectionListCursor);});
evaluationElement('comparison-form').addEventListener('submit',async event=>{
  event.preventDefault();if(evaluationComparisonBusy)return;
  const snapshotId=new FormData(event.currentTarget).get('snapshotId'),generation=++evaluationComparisonGeneration;
  evaluationComparisonBusy=true;syncEvaluation();clearEvaluationComparison('저장된 비교 기록을 읽고 있습니다.');
  try{
    const reply=await window.cue.evaluation({operation:'comparison-read',snapshotId});if(generation!==evaluationComparisonGeneration)return;
    const value=reply?.value;if(!reply?.available||reply.operation!=='comparison-read')throw Error('unavailable');renderEvaluationComparison(value,snapshotId);
  }catch{if(generation===evaluationComparisonGeneration)clearEvaluationComparison('저장된 비교 기록을 사용할 수 없습니다. 비교 ID와 현재 작업공간을 확인하세요.');}
  finally{if(generation===evaluationComparisonGeneration){evaluationComparisonBusy=false;syncEvaluation();}}
});
async function readEvaluationMeasuredFact(factId){
  if(evaluationRun&&evaluationLocked)return;const generation=++evaluationMeasuredFactGeneration;evaluationMeasuredFactBusy=true;syncEvaluation();clearEvaluationMeasuredFact('저장된 측정 근거를 읽고 있습니다.');
  try{const reply=await window.cue.evaluation({operation:'measured-fact-read',factId});if(generation!==evaluationMeasuredFactGeneration)return;const value=reply?.value;if(!reply?.available||reply.operation!=='measured-fact-read'||value?.version!=='cue-evaluation-measured-fact-evidence-v1'||value.authority!=='measured-fact-evidence-only'||value.factId!==factId||!['host-observed','offline-fixture'].includes(value.producer?.class)||value.trialReady!==false||value.promotionEligible!==false||!Array.isArray(value.attempts))throw Error('unavailable');
    evaluationElement('measured-fact-summary').textContent=`저장 사실 ${value.factId} · 생산자 ${value.producer.class==='host-observed'?'호스트 관측':'오프라인 픽스처'} · 개정 ${value.producer.revision} · 기록 시각 ${value.producer.recordedAtMs}`;for(const row of value.attempts){const item=document.createElement('li');item.textContent=`시도 ${row.attemptId} · 역할 ${row.role} · 상태 ${row.state} · 도구 ${row.toolId} (${row.toolRevision}) · 모델 ${row.modelId===null?'알 수 없음':`${row.modelId} (${row.modelRevision})`}`;evaluationElement('measured-fact-attempts').append(item);}const m=value.measurements;evaluationElement('measured-fact-measurements').textContent=`품질 ${m.quality.availability==='available'?'근거 있음':'알 수 없음'} · 시간 ${m.timing.availability==='available'?`${m.timing.elapsedMs}밀리초`:'알 수 없음'} · 회계 ${m.accounting.availability==='available'?m.accounting.kind:'알 수 없음'}`;evaluationElement('measured-fact-limit').textContent=`불확실성 ${value.uncertaintyCount}건(세부 사유 비공개) · 저장 근거의 설명이며 trial 준비나 정책 승격을 허용하지 않습니다.`;evaluationElement('measured-fact-output').hidden=false;evaluationElement('measured-fact-status').textContent='저장된 근거를 읽었습니다.';
  }catch{if(generation===evaluationMeasuredFactGeneration)clearEvaluationMeasuredFact('저장된 측정 근거를 사용할 수 없습니다. 사실 ID와 현재 작업공간을 확인하세요.');}
  finally{if(generation===evaluationMeasuredFactGeneration){evaluationMeasuredFactBusy=false;syncEvaluation();}}
}
evaluationElement('measured-fact-form').addEventListener('submit',event=>{
  event.preventDefault();void readEvaluationMeasuredFact(String(new FormData(event.currentTarget).get('factId')));
});
async function loadEvaluationMeasuredFactList(cursor=null){
  if(evaluationMeasuredFactListBusy||(evaluationRun&&evaluationLocked))return;const generation=++evaluationMeasuredFactListGeneration;evaluationMeasuredFactListBusy=true;syncEvaluation();evaluationElement('measured-fact-list-records').replaceChildren();evaluationElement('measured-fact-list-status').textContent='저장 사실 목록을 읽고 있습니다.';
  try{const reply=await window.cue.evaluation({operation:'measured-fact-list',limit:10,cursor});if(generation!==evaluationMeasuredFactListGeneration)return;const value=reply?.value;if(!reply?.available||reply.operation!=='measured-fact-list'||value?.version!=='cue-evaluation-measured-fact-list-v1'||value.authority!=='bounded-workspace-descriptive-index'||value.order!=='sqlite-insertion-desc'||!Array.isArray(value.records)||value.records.length>10||value.complete!==(value.nextCursor===null))throw Error('unavailable');
    for(const row of value.records){if(!['host-observed','offline-fixture'].includes(row.producer?.class)||row.trialReady!==false||row.promotionEligible!==false)throw Error('unavailable');const item=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=`${row.factId} · 생산자 ${row.producer.class==='host-observed'?'호스트 관측':'오프라인 픽스처'} · 개정 ${row.producer.revision} · 기록 시각 ${row.producer.recordedAtMs}`;button.addEventListener('click',()=>{evaluationElement('measured-fact-form').elements.factId.value=row.factId;void readEvaluationMeasuredFact(row.factId);});item.append(button);evaluationElement('measured-fact-list-records').append(item);}
    evaluationMeasuredFactListCursor=value.nextCursor;evaluationElement('measured-fact-list-status').textContent=value.records.length?`${value.records.length}개의 현재 작업공간 저장 사실입니다.${value.complete?' 마지막 목록입니다.':' 다음 목록이 있습니다.'} 선택하면 근거를 다시 검증해 읽습니다.`:`표시할 저장 사실이 없습니다.${value.complete?' 마지막 목록입니다.':' 다음 목록에서 계속 확인할 수 있습니다.'}`;
  }catch{if(generation===evaluationMeasuredFactListGeneration){evaluationMeasuredFactListCursor=null;evaluationElement('measured-fact-list-records').replaceChildren();evaluationMeasuredFactGeneration++;evaluationMeasuredFactBusy=false;clearEvaluationMeasuredFact();evaluationElement('measured-fact-list-status').textContent='저장 사실 목록을 사용할 수 없습니다. 직접 입력한 사실 ID는 유지됩니다.';}}
  finally{if(generation===evaluationMeasuredFactListGeneration){evaluationMeasuredFactListBusy=false;syncEvaluation();}}
}
evaluationElement('measured-fact-list-refresh').addEventListener('click',()=>{void loadEvaluationMeasuredFactList(null);});
evaluationElement('measured-fact-list-next').addEventListener('click',()=>{if(evaluationMeasuredFactListCursor!==null)void loadEvaluationMeasuredFactList(evaluationMeasuredFactListCursor);});
function clearEvaluationMeasuredFactList(){evaluationMeasuredFactListGeneration++;evaluationMeasuredFactListBusy=false;evaluationMeasuredFactListCursor=null;evaluationElement('measured-fact-list-records').replaceChildren();evaluationElement('measured-fact-list-status').textContent='저장 사실 목록은 요청할 때만 읽습니다.';}
function lockEvaluation() { resetMeasuredComparison(); resetLocalContracts(); evaluationLocked = true; evaluationGeneration++; evaluationBusy = false; evaluationMeasuredFactGeneration++; evaluationMeasuredFactBusy=false; clearEvaluationMeasuredFactList(); clearEvaluationMeasuredFact(); syncEvaluation(); }
function evaluationFailure(generation) {
  if (generation !== evaluationGeneration) return;
  evaluationElement('observation').hidden = true; evaluationElement('observation').replaceChildren(); evaluationElement('projection-output').hidden=true;evaluationElement('projection-output').replaceChildren(); evaluationElement('coverage-output').hidden = true; evaluationElement('coverage-output').replaceChildren();
  evaluationElement('status').textContent = '평가 기록을 사용할 수 없습니다. 현재 실행과 저장된 개정을 확인하세요.';
  clearEvaluationMeasuredFactList();clearEvaluationMeasuredFact();
}
evaluationElement('enroll-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!evaluationRun || evaluationLocked || evaluationBusy) return;
  const runId=evaluationRun,generation=evaluationGeneration,data=Object.fromEntries(new FormData(event.currentTarget));
  data.operation='enroll';data.policyRevision=Number(data.policyRevision);
  if(evaluationDataset){
    const selected=evaluationElement('dataset-case').value;
    if(!evaluationDataset.cases.some(row=>row.id===selected)){evaluationElement('status').textContent='현재 실행에 등록할 평가/홀드아웃 케이스를 명시적으로 선택하세요.';return;}
    for(const key of evaluationDatasetFields)delete data[key];
    data.dataset=evaluationDataset;data.caseId=selected;
  }else data.caseId=data.caseId==='evaluation'?data.evaluationCaseId:data.holdoutCaseId;
  evaluationBusy=true;syncEvaluation();evaluationElement('status').textContent='등록 중입니다.';
  try { const reply=await window.cue.evaluation(data); if(generation!==evaluationGeneration||runId!==evaluationRun)return;
    if(!reply?.available||reply.operation!=='enroll'||reply.value?.runId!==runId||reply.value.inputBinding!=='claimed-not-verified')throw Error('unavailable');
    if(data.dataset&&(reply.value.enrollmentId!==data.enrollmentId||reply.value.caseId!==data.caseId||reply.value.dataset?.id!==data.dataset.id||reply.value.dataset?.revision!==data.dataset.revision
      ||reply.value.inputDigest!==data.dataset.cases.find(row=>row.id===data.caseId)?.inputDigest))throw Error('unavailable');
    evaluationEnrollment=reply.value;evaluationObservation=null;evaluationLocked=true;evaluationElement('projection-output').hidden=true;evaluationElement('projection-output').replaceChildren();
    evaluationElement('status').textContent=`등록됨 · ${reply.value.enrollmentId} · ${reply.value.split} · 입력 연결 claimed-not-verified · 일반 모드 비교군`;syncEvaluation();
  } catch { evaluationFailure(generation); } finally { if(generation===evaluationGeneration&&runId===evaluationRun){evaluationBusy=false;syncEvaluation();} }
});
evaluationElement('baseline-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!evaluationDataset||!evaluationRun||evaluationLocked||evaluationBusy)return;
  const runId=evaluationRun,generation=evaluationGeneration,caseId=evaluationElement('dataset-case').value;
  if(!evaluationDataset.cases.some(row=>row.id===caseId)){evaluationElement('status').textContent='수동 기준선의 케이스를 명시적으로 선택하세요.';return;}
  const source=evaluationElement('enroll-form'),command={operation:'baseline',baselineId:new FormData(event.currentTarget).get('baselineId'),dataset:evaluationDataset,caseId};
  for(const name of ['enrollmentId','metricId','metricRevision','metricDigest','environmentId','environmentRevision','environmentDigest','accountLimitsId','accountLimitsRevision','accountLimitsDigest'])command[name]=source.elements.namedItem(name).value;
  if(Object.values(command).some(value=>typeof value==='string'&&!value.trim())){evaluationElement('status').textContent='기준선/등록 ID와 지표·환경·계정 한도 참조를 입력하세요.';return;}
  evaluationBusy=true;syncEvaluation();evaluationElement('status').textContent='고정 조합을 검사하고 시스템 확인을 기다립니다. 실행 승인이 아닙니다.';
  try{
    const reply=await window.cue.evaluation(command);if(generation!==evaluationGeneration||runId!==evaluationRun)return;
    const value=reply?.value,item=command.dataset.cases.find(row=>row.id===caseId);
    if(!reply?.available||reply.operation!=='baseline'||value?.runId!==runId||value.enrollmentId!==command.enrollmentId||value.caseId!==caseId
      ||value.arm!=='manual-baseline'||value.inputBinding!=='claimed-not-verified'||value.inputDigest!==item.inputDigest||value.dataset?.id!==command.dataset.id||value.dataset?.revision!==command.dataset.revision)throw Error('unavailable');
    evaluationEnrollment=value;evaluationObservation=null;evaluationLocked=true;
    evaluationElement('status').textContent=`수동 기준선 등록됨 · ${value.enrollmentId} · ${value.split} · 입력 연결 claimed-not-verified. 실행 승인과 실측은 별도입니다.`;
  }catch{if(generation===evaluationGeneration)evaluationElement('status').textContent='수동 기준선을 등록하지 못했습니다. 취소/만료 여부, 고정 구현·독립 검증 계획, 중복 등록과 현재 실행을 확인하세요.';}
  finally{if(generation===evaluationGeneration&&runId===evaluationRun){evaluationBusy=false;syncEvaluation();}}
});
evaluationElement('observe-form').addEventListener('submit', async event => {
  event.preventDefault(); if(!evaluationEnrollment||evaluationBusy)return;
  const runId=evaluationRun,generation=evaluationGeneration,observationId=new FormData(event.currentTarget).get('observationId');
  const command={operation:'observe',enrollmentId:evaluationEnrollment.enrollmentId,observationId,expectedPriorRevision:evaluationObservation?.revision??0};
  evaluationBusy=true;syncEvaluation();evaluationElement('status').textContent='요청 시점의 저장 상태를 관측 중입니다.';
  try {const reply=await window.cue.evaluation(command);if(generation!==evaluationGeneration||runId!==evaluationRun)return;
    if(!reply?.available||reply.operation!=='observe'||reply.value?.runId!==runId||reply.value.enrollmentId!==evaluationEnrollment.enrollmentId||reply.value.observationId!==observationId)throw Error('unavailable');
    evaluationObservation=reply.value;evaluationElement('projection-output').hidden=true;evaluationElement('projection-output').replaceChildren();const out=reply.value.outcome,label=out===null?'미관측':out.status==='unavailable'?'사용 불가':out.outcome??'unknown';
    evaluationElement('observation').textContent=`관측 ${reply.value.observationId} · 개정 ${reply.value.revision} · 결과 ${label} · 품질 ${out?.quality??'null'} · 경과 ${out?.elapsedMs??'null'} · 호스트 기록 시각 ${reply.value.recordedAtMs}`;
    evaluationElement('observation').hidden=false;evaluationElement('coverage-output').hidden=true;evaluationElement('status').textContent='별도 커밋 읽기의 저장 관측입니다. 성공이나 개선을 주장하지 않습니다.';
  }catch{evaluationFailure(generation);}finally{if(generation===evaluationGeneration&&runId===evaluationRun){evaluationBusy=false;syncEvaluation();}}
});
const evaluationProjectionReasonLabels=Object.freeze({'tool-revision-unavailable':'도구 개정 없음','model-revision-unavailable':'모델 개정 없음','quality-unavailable':'품질 측정 없음','elapsed-unavailable':'경과 시간 측정 없음','price-observed-at-unavailable':'가격 관측 시각 없음','price-source-unavailable':'가격 출처 없음','base-cost-unavailable':'기본 비용 측정 없음','retry-cost-unavailable':'재시도 비용 측정 없음','handoff-cost-unavailable':'인계 비용 측정 없음','verification-cost-unavailable':'검증 비용 측정 없음','outcome-unavailable':'결과 기록 없음','currency-unit-unavailable':'통화 단위 없음'});
evaluationElement('projection').addEventListener('click',async()=>{
  if(!evaluationEnrollment||!evaluationObservation||evaluationBusy)return;const runId=evaluationRun,generation=evaluationGeneration,enrollmentId=evaluationEnrollment.enrollmentId,observationId=evaluationObservation.observationId;
  evaluationBusy=true;syncEvaluation();evaluationElement('projection-output').hidden=true;evaluationElement('projection-output').replaceChildren();evaluationElement('status').textContent='저장된 관측에서 비교용 기록을 만들고 있습니다.';
  try{const reply=await window.cue.evaluation({operation:'projection',enrollmentId,observationId});if(generation!==evaluationGeneration||runId!==evaluationRun||evaluationObservation?.observationId!==observationId)return;
    const value=reply?.value;if(!reply?.available||reply.operation!=='projection'||value?.version!=='cue-evaluation-trial-projection-v1'||value.authority!=='stored-enrollment-observation-outcome-only'||value.enrollmentId!==enrollmentId||value.observationId!==observationId||value.trial!==null||value.promotionEligible!==false||value.limitation!=='current-outcome-contract-does-not-store-required-trial-measurements'||!Array.isArray(value.nonConvertibleReasons)||value.nonConvertibleReasons.some(reason=>!Object.hasOwn(evaluationProjectionReasonLabels,reason)))throw Error('unavailable');
    const reasons=value.nonConvertibleReasons.map(reason=>evaluationProjectionReasonLabels[reason]).join(', ');evaluationElement('projection-output').textContent=`비교용 기록 ID ${value.projectionId} · 저장 결과 ${value.outcome??'사용 불가'} · 측정 trial null · 변환 불가 사유 ${reasons}`;evaluationElement('projection-output').hidden=false;evaluationElement('status').textContent='기존 저장 관측에서 파생한 설명용 기록입니다. 새 측정이 아니며 정책 승격에 사용할 수 없습니다.';
  }catch{if(generation===evaluationGeneration&&runId===evaluationRun){evaluationElement('projection-output').hidden=true;evaluationElement('projection-output').replaceChildren();evaluationElement('status').textContent='비교용 기록을 저장할 수 없습니다. 현재 실행과 저장된 관측을 확인하세요.';}}
  finally{if(generation===evaluationGeneration&&runId===evaluationRun){evaluationBusy=false;syncEvaluation();}}
});
evaluationElement('coverage').addEventListener('click',async()=>{
  if(!evaluationEnrollment||!evaluationObservation||evaluationBusy)return;const runId=evaluationRun,generation=evaluationGeneration,cutoffId=evaluationObservation.observationId;
  evaluationBusy=true;syncEvaluation();evaluationElement('coverage-output').hidden=true;
  try{const reply=await window.cue.evaluation({operation:'coverage',enrollmentId:evaluationEnrollment.enrollmentId,cutoffId});if(generation!==evaluationGeneration||runId!==evaluationRun)return;
    const value=reply?.value;if(!reply?.available||reply.operation!=='coverage'||value?.cutoff?.observationId!==cutoffId||value.membershipRelation!=='current-enrollments-at-read')throw Error('unavailable');
    const rows=value.slots.map(slot=>`${slot.caseId} · ${slot.enrollmentId} · ${slot.observation===null?'미관측':slot.observation.outcome?.status==='recorded'?(slot.observation.outcome.outcome??'unknown'):'사용 불가'}`);
    evaluationElement('coverage-output').textContent=`현재 조회 시점 등록 구성 · 예상 ${value.expectedCases.length}건 · 등록 ${value.enrolledSlotCount}건\n${rows.join('\n')}`;evaluationElement('coverage-output').hidden=false;evaluationElement('status').textContent='마지막 저장 관측까지의 커버리지입니다. 현재 구성 공개이며 승격·시험·개선 판정이 아닙니다.';
  }catch{evaluationFailure(generation);}finally{if(generation===evaluationGeneration&&runId===evaluationRun){evaluationBusy=false;syncEvaluation();}}
});
syncEvaluation();
let candidateGeneration = 0;
async function loadCandidateInventory() {
  if (typeof window.cue?.candidateInventory !== 'function') return;
  document.querySelector('#candidate-inventory').hidden = false;
  const generation = ++candidateGeneration;
  const status = document.querySelector('#candidate-status');
  document.querySelector('#candidate-records').replaceChildren();
  document.querySelector('#candidate-selection').textContent = '';
  document.querySelector('#candidate-modes').textContent = '';
  document.querySelector('#candidate-policies').textContent = '';
  status.textContent = '등록 기록을 읽고 있습니다.';
  try {
    const inventory = await window.cue.candidateInventory({ operation: 'read' });
    if (generation !== candidateGeneration) return;
    if (inventory?.version !== 'cue-candidate-inventory-v1' || inventory.authority !== 'read-only-observation' || !Array.isArray(inventory.records) || inventory.records.length > 1024) throw Error('inventory mismatch');
    status.textContent = `${inventory.available ? `등록 후보 ${inventory.records.length}개` : `목록 사용 불가: ${inventory.unavailableReasons.join(', ')}`} · 조회 시각 ${inventory.readAt} · 다시 읽어도 관측 시각은 갱신되지 않습니다.`;
    document.querySelector('#candidate-selection').textContent = `설정 모드: ${inventory.selection.mode} · 설정 개정 ${inventory.selection.revision} · 모드 선택 ${inventory.selection.available ? '사용 가능' : '사용 불가'} · 실행 권한 부여 아님`;
    document.querySelector('#candidate-modes').textContent = inventory.configuration.modeComparison === 'fixed-pair-unmeasured'
      ? '현재 로컬 네 모드는 같은 고정 생성기·검사기 조합을 사용합니다. 모드별 성능·가성비 순위는 측정하지 않았습니다.' : '모드별 후보 조합과 측정 순위는 확인하지 않았습니다.';
    if (inventory.configuration.restartRequired) document.querySelector('#candidate-modes').textContent += ' 설정 적용을 위해 재시작이 필요합니다.';
    document.querySelector('#candidate-policies').textContent = JSON.stringify(inventory.configuration.policies, null, 2);
    for (const row of inventory.records) {
      const item = document.createElement('li');
      item.textContent = `${row.canonicalId} · 도구 ${row.toolId} · 종류 ${row.kind} · 설치 ${row.installation} · 프로토콜 ${row.protocol} · 목록 조건 ${row.catalogAvailable ? '충족' : '미충족'}${row.reasons.length ? ` (${row.reasons.join(', ')})` : ''} · 관측 ${row.observedAt} · 인증 확인 안 됨 · 실행 자격 확인 안 됨 · 이 목록은 실행 권한을 부여하지 않음`;
      document.querySelector('#candidate-records').append(item);
    }
  } catch {
    if (generation !== candidateGeneration) return;
    status.textContent = '등록 목록을 확인하지 못했습니다. 이전 목록으로 실행 가능 여부를 판단하지 않습니다.';
  }
}
document.querySelector('#candidate-refresh').addEventListener('click', () => { void loadCandidateInventory(); });
let retrospectiveRun = null;
let retrospectiveDraftId = null;
let retrospectiveGeneration = 0;
let retrospectiveBusy = false;
const retrospectiveElement = id => document.querySelector(`#retrospective-${id}`);
function syncRetrospective() {
  retrospectiveElement('panel').hidden = typeof window.cue?.retrospective !== 'function';
  retrospectiveElement('create').disabled = retrospectiveBusy || !retrospectiveRun;
  retrospectiveElement('new').disabled = retrospectiveBusy || !retrospectiveRun;
  retrospectiveElement('read').disabled = retrospectiveBusy;
  retrospectiveElement('draft-id').value = retrospectiveDraftId ?? '';
  retrospectiveElement('current').textContent = retrospectiveRun ? `현재 실행: ${retrospectiveRun}` : '현재 실행을 먼저 준비하세요.';
}
function invalidateRetrospective() {
  retrospectiveGeneration++;
  retrospectiveBusy = false;
  retrospectiveElement('output').hidden = true;
  retrospectiveElement('summary').textContent = '';
  retrospectiveElement('provenance').textContent = '';
  retrospectiveElement('status').textContent = '';
  syncRetrospective();
}
function selectRetrospectiveRun(runId) {
  if (retrospectiveRun === runId) return;
  retrospectiveRun = runId;
  retrospectiveDraftId = runId ? crypto.randomUUID() : null;
  invalidateRetrospective();
}
async function requestRetrospective(input) {
  if (retrospectiveBusy || typeof window.cue?.retrospective !== 'function') return;
  invalidateRetrospective();
  const generation = retrospectiveGeneration;
  retrospectiveBusy = true; syncRetrospective();
  retrospectiveElement('status').textContent = '고정 기록을 확인하고 있습니다.';
  try {
    const draft = await window.cue.retrospective(input);
    if (generation !== retrospectiveGeneration) return;
    if (!draft) { retrospectiveElement('status').textContent = '저장된 초안을 찾지 못했습니다.'; return; }
    if (draft.draftId !== input.draftId || (input.operation === 'create' && draft.runId !== input.runId) ||
        draft.version !== 'cue-retrospective-v1' || draft.scope !== 'local-only' || draft.authority !== 'reference-only' || draft.summary?.acceptance !== 'not-assessed') throw Error('draft mismatch');
    retrospectiveElement('summary').textContent = `초안 ${draft.draftId} · 실행 ${draft.runId} · 생성 당시 상태 ${draft.summary.observedTaskState} · 시도 ${draft.summary.totalAttempts}개 · 정리 미확인 ${draft.summary.unresolvedAttempts}개 · 인수 평가하지 않음`;
    retrospectiveElement('provenance').textContent = JSON.stringify({ digest: draft.digest, sourcesDigest: draft.sourcesDigest, sourceHashScope: draft.sourceHashScope, sources: draft.sources }, null, 2);
    retrospectiveElement('output').hidden = false;
    retrospectiveElement('status').textContent = '로컬 참고용 초안을 조회했습니다. 현재 실행 상태나 인수 판정을 대신하지 않습니다.';
  } catch {
    if (generation === retrospectiveGeneration) retrospectiveElement('status').textContent = '초안을 확인하지 못했습니다. 같은 ID로 다시 시도할 수 있습니다.';
  } finally {
    if (generation === retrospectiveGeneration) { retrospectiveBusy = false; syncRetrospective(); }
  }
}
retrospectiveElement('create').addEventListener('click', () => {
  if (retrospectiveRun) void requestRetrospective({ operation: 'create', draftId: retrospectiveDraftId, runId: retrospectiveRun });
});
retrospectiveElement('new').addEventListener('click', () => {
  if (!retrospectiveRun || retrospectiveBusy) return;
  retrospectiveDraftId = crypto.randomUUID(); invalidateRetrospective();
});
retrospectiveElement('lookup').addEventListener('input', invalidateRetrospective);
retrospectiveElement('read-form').addEventListener('submit', event => {
  event.preventDefault();
  const draftId = retrospectiveElement('lookup').value;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(draftId)) { retrospectiveElement('status').textContent = '저장된 초안 ID를 입력하세요.'; return; }
  void requestRetrospective({ operation: 'read', draftId });
});
syncRetrospective();
let resourceRun = null;
let resourceGeneration = 0;
const resourceStatus = document.querySelector('#resource-status');
const resourceQuery = document.querySelector('#resource-query');
const resourceSearch = document.querySelector('#resource-search');
const resourceResults = document.querySelector('#resource-results');

function resetResourcePin() {
  resourceGeneration++; resourceRun = null;
  resourceQuery.disabled = resourceSearch.disabled = true;
  resourceResults.replaceChildren();
  document.querySelector('#resource-pin').textContent = '먼저 범위 만들기로 실행을 준비하세요.';
  document.querySelector('#resource-search-status').textContent = '';
}
async function loadResourcePin(runId) {
  resetResourcePin();
  if (typeof window.cue?.resources !== 'function') return;
  const generation = resourceGeneration;
  try {
    const pin = await window.cue.resources({ operation: 'pin', runId });
    if (generation !== resourceGeneration) return;
    resourceRun = runId;
    document.querySelector('#resource-pin').textContent = `실행: ${pin.runId}\n고정 지문: ${pin.pinSha256}\n${pin.packages.map(p=>`${p.id} · ${p.version} · ${p.manifestSha256}`).join('\n') || '고정된 패키지가 없습니다. 자료를 가져온 뒤 새 범위를 만드세요.'}\n참고 자료 전용 · 실행 권한 없음`;
    resourceQuery.disabled = resourceSearch.disabled = pin.packages.length === 0;
  } catch {
    if (generation !== resourceGeneration) return;
    document.querySelector('#resource-pin').textContent = '이 실행의 고정 자료를 확인할 수 없습니다. 새 범위를 만든 뒤 다시 검색하세요. 현재 목록으로 대신 검색하지 않습니다.';
  }
}
async function loadResourcePackages() {
  if (typeof window.cue?.resources !== 'function') { resourceStatus.textContent = '현재 호스트는 리소스 관리를 지원하지 않습니다.'; return; }
  try {
    const packages = await window.cue.resources({ operation: 'list' });
    const list = document.querySelector('#resource-packages'); list.replaceChildren();
    for (const entry of packages) {
      const item = document.createElement('li'), text = document.createElement('p'), remove = document.createElement('button');
      text.textContent = `${entry.id} · ${entry.version}\n${entry.resourceCount}개 자료 · ${entry.totalBytes}바이트\n패키지 지문: ${entry.manifestSha256}\n참고 자료 전용`;
      remove.type = 'button'; remove.className = 'secondary'; remove.textContent = '목록에서 제거';
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try { await window.cue.resources({ operation: 'remove', id: entry.id }); await loadResourcePackages(); resourceStatus.textContent = '다음 실행의 목록에서 제거했습니다. 사용자 파일과 현재 실행의 고정 자료는 유지됩니다.'; }
        catch { resourceStatus.textContent = '제거하지 못했습니다. 목록을 다시 확인하세요.'; remove.disabled = false; }
      });
      item.append(text,remove); list.append(item);
    }
    document.querySelector('#resource-import').disabled = false;
    resourceStatus.textContent = packages.length ? '패키지 변경은 다음 범위 만들기부터 적용됩니다.' : '등록된 패키지가 없습니다.';
  } catch { resourceStatus.textContent = '리소스 목록을 확인하지 못했습니다.'; }
}
document.querySelector('#resource-import').addEventListener('click', async () => {
  const button = document.querySelector('#resource-import'); button.disabled = true;
  try {
    const result = await window.cue.resources({ operation: 'import' });
    if (result.status === 'cancelled') resourceStatus.textContent = '가져오기를 취소했습니다. 기존 자료를 유지합니다.';
    else { await loadResourcePackages(); resourceStatus.textContent = '패키지를 등록했습니다. 새 범위를 만들면 적용됩니다.'; }
  } catch { resourceStatus.textContent = '패키지를 가져오지 못했습니다. 폴더의 manifest·크기·해시를 확인하세요.'; }
  finally { button.disabled = false; }
});
document.querySelector('#resource-search-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!resourceRun || resourceSearch.disabled) return;
  const runId = resourceRun, generation = resourceGeneration, status = document.querySelector('#resource-search-status');
  resourceSearch.disabled = true; resourceResults.replaceChildren();
  try {
    const hits = await window.cue.resources({ operation: 'search', runId, query: resourceQuery.value, limit: 5 });
    if (generation !== resourceGeneration) return;
    for (const hit of hits) {
      const item = document.createElement('li'), citation = document.createElement('p'), excerpt = document.createElement('p');
      citation.textContent = `${hit.packageId} · ${hit.version} · ${hit.resourceId}\n파일: ${hit.path}\n출처 선언: ${hit.source}\nrevision: ${hit.revision}\n내용 SHA-256: ${hit.sha256}\n패키지 지문: ${hit.manifestSha256}\nUTF-8 바이트 ${hit.byteStart}–${hit.byteEnd}\n참고 자료 전용 · 원격 출처 진위 미검증 · 권한 없음`;
      excerpt.className = 'resource-excerpt'; excerpt.textContent = hit.excerpt; item.append(citation,excerpt); resourceResults.append(item);
    }
    status.textContent = hits.length ? `${hits.length}개 참고 결과입니다. 검증 증거로 자동 승격하지 않습니다.` : '고정된 지식 자료에서 결과를 찾지 못했습니다.';
  } catch {
    if (generation === resourceGeneration) status.textContent = '고정 자료를 검색하지 못했습니다. 실행과 검색어를 확인하거나 새 범위를 만드세요.';
  } finally { if (generation === resourceGeneration) resourceSearch.disabled = false; }
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function showTransportError(error) {
  transportError.textContent = `연결 오류: ${error instanceof Error ? error.message : String(error)} · 원장 상태를 유지하고 다시 시도합니다.`;
  transportError.hidden = false;
}

function clearTransportError() {
  transportError.hidden = true;
  transportError.textContent = '';
}

function updateSelectionDescription() {
  document.querySelector('#selection-description').textContent = selectionDescriptions[selectionMode.value] ?? '';
}

async function loadSelectionPreferences(preserveChoice = false) {
  if (typeof window.cue?.selectionPreferences !== 'function') {
    selectionStatus.textContent = '현재 실행 경로에서는 자동 모드 선택을 지원하지 않습니다.';
    return;
  }
  selectionReady = false;
  try {
    const saved = await window.cue.selectionPreferences();
    if (!saved || !Object.hasOwn(selectionLabels, saved.mode) || !Number.isSafeInteger(saved.revision) || saved.revision < 0) throw Error('설정 응답 미확인');
    selectionAvailable = saved.available === true;
    preferenceRevision = saved.revision;
    if (!preserveChoice) selectionMode.value = saved.mode;
    selectionControls.hidden = !selectionAvailable;
    selectionMode.disabled = selectionSave.disabled = !selectionAvailable || lastLedgerCard?.state === 'running';
    updateSelectionDescription();
    selectionStatus.textContent = selectionAvailable
      ? '선택한 모드는 다음 범위 만들기에 적용됩니다. 실제 도구 배치는 호스트의 자격 검사를 거칩니다.'
      : '현재 실행 경로에서는 자동 모드 선택을 지원하지 않습니다.';
  } catch {
    selectionAvailable = false;
    selectionControls.hidden = true;
    selectionMode.disabled = selectionSave.disabled = true;
    selectionStatus.textContent = '모드 설정을 확인하지 못했습니다. 현재 호스트의 기본 정책으로만 준비할 수 있습니다.';
  } finally { selectionReady = true; syncSetupControls(); }
}

selectionMode.addEventListener('change', () => {
  updateSelectionDescription();
  selectionStatus.textContent = pending ? '승인 대기 계획은 유지됩니다. 변경한 모드는 다음 범위 만들기에 적용됩니다.' : '변경한 모드는 다음 범위 만들기에 적용됩니다.';
});
selectionSave.addEventListener('click', async () => {
  if (!selectionAvailable || selectionSave.disabled) return;
  selectionSave.disabled = true;
  try {
    const saved = await window.cue.setSelectionPreference({ mode: selectionMode.value, expectedRevision: preferenceRevision });
    if (!saved?.available || !Object.hasOwn(selectionLabels, saved.mode) || !Number.isSafeInteger(saved.revision)) throw Error('저장 응답 미확인');
    preferenceRevision = saved.revision;
    selectionStatus.textContent = `기본 ${selectionLabels[saved.mode]} 모드를 저장했습니다. 승인 대기 계획은 유지됩니다.`;
  } catch {
    await loadSelectionPreferences(true);
    selectionStatus.textContent = '기본 모드를 저장하지 못했습니다. 최신 설정을 확인했으니 다시 선택해 저장하세요.';
  } finally { syncSetupControls(); }
});

function renderApprovalPlan(plan) {
  const panel = document.querySelector('#approval-plan');
  const stages = document.querySelector('#approval-plan-stages');
  const summary = document.querySelector('#approval-plan-summary');
  const limit = document.querySelector('#approval-plan-limit');
  const requirements = document.querySelector('#approval-requirements');
  const requirementsSummary = document.querySelector('#approval-requirements-summary');
  const retry = document.querySelector('#approval-retry');
  const generated = document.querySelector('#approval-generated');
  const generatedTargets = document.querySelector('#approval-generated-targets');
  const generatedLimit = document.querySelector('#approval-generated-limit');
  const changes = document.querySelector('#approval-changes');
  const changeTargets = document.querySelector('#approval-change-targets');
  allowExploration.checked = false;
  explorationConsent.hidden = true;
  explorationConsentCopy.textContent = '';
  changes.hidden = true; changeTargets.replaceChildren();
  stages.replaceChildren(); summary.textContent = ''; limit.textContent = '';
  requirements.replaceChildren(); requirementsSummary.textContent = '';
  retry.hidden = true; retry.textContent = '';
  generated.hidden = true; generatedTargets.replaceChildren(); generatedLimit.textContent = '';
  panel.hidden = !plan;
  if (!plan) return;
  if (plan.exploration !== undefined) {
    const exploration = plan.exploration;
    if (!exploration || typeof exploration.candidateId !== 'string' || exploration.candidateId.length < 1 || exploration.candidateId.length > 200
        || !Number.isSafeInteger(exploration.limitUnits) || exploration.limitUnits < 1 || typeof exploration.currency !== 'string' || exploration.currency.length < 1 || exploration.currency.length > 32
        || typeof exploration.unit !== 'string' || exploration.unit.length < 1 || exploration.unit.length > 32 || !Array.isArray(exploration.taskIds)
        || exploration.taskIds.length < 1 || exploration.taskIds.length > 256) throw Error('탐색 승인 범위를 확인할 수 없습니다.');
    explorationConsentCopy.textContent = `유료 탐색 후보 ${exploration.candidateId}를 대상 작업 ${exploration.taskIds.length}개에 허용합니다. 탐색 상한 ${exploration.limitUnits} ${exploration.currency}/${exploration.unit}은 위 전체 예산 상한에 포함됩니다.`;
    explorationConsent.hidden = false;
  }
  if (plan.changeTargets !== undefined) {
    if (!Array.isArray(plan.changeTargets) || plan.changeTargets.length < 1 || plan.changeTargets.length > 64) throw Error('변경 대상 목록을 확인할 수 없습니다.');
    for (const target of plan.changeTargets) {
      if (!target || !['taskId', 'targetId', 'relativePath'].every(key => typeof target[key] === 'string' && target[key].length > 0 && target[key].length <= 256)
          || !Number.isSafeInteger(target.maxBackupBytes) || target.maxBackupBytes < 1 || target.maxBackupBytes > 16 * 1024 * 1024
          || typeof target.rootContractDigest !== 'string' || !/^[a-f0-9]{64}$/.test(target.rootContractDigest)) throw Error('변경 대상 목록을 확인할 수 없습니다.');
      const item = document.createElement('li');
      item.textContent = `${target.relativePath} · 단계 ${target.taskId} · 원본 보관 한도 ${target.maxBackupBytes}바이트`;
      changeTargets.append(item);
    }
    changes.hidden = plan.changeTargets.length === 0;
  }
  const modes = { efficiency: '효율', performance: '고성능', value: '가성비', speed: '속도' };
  const roles = { planner: '기획', implementation: '구현', verifier: '검증', 'model-producer': '모델 출력 생성' };
  const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 128) : '미확인';
  const list = values => Array.isArray(values) && values.length
    ? values.slice(0, 256).map(text).join(', ') + (values.length > 256 ? ' · 나머지 생략' : '') : '없음';
  const accounting = plan.accountingKind === 'local-invocation'
    ? `실행 지시 상한 ${text(plan.limitInvocations)}회 · 제한 시간 ${text(plan.timeoutMs)}ms · 고정 조합(모드별 성능 차이 미검증) · 금전 비용 미측정`
    : `예산 ${text(plan.limitUnits)} (${text(plan.currency)}/${text(plan.unit)})`;
  summary.textContent = `${modes[plan.mode] ?? '미확인'} 모드 · 정책 ${text(plan.policyRevision)} · ${accounting} · ${text(plan.stageCount)}단계\n계획 지문 ${text(plan.planDigest)}`;
  const entries = Array.isArray(plan.stages) ? plan.stages : [];
  for (const stage of entries.slice(0, 256)) {
    const item = document.createElement('li');
    item.textContent = `${text(stage.id)} · ${roles[stage.role] ?? '역할 미확인'}\n선행 단계: ${list(stage.dependencyIds)}\n요구사항: ${list(stage.requirementIds)}\n허용 범위: ${list(stage.scopeIds)}\n후보: ${list(stage.candidateIds)}`;
    stages.append(item);
  }
  limit.textContent = entries.length > 256 ? '표시 한도: 256단계까지만 표시합니다.' : '';
  if (plan.retry) {
    retry.hidden = false;
    retry.textContent = `재시도 계약 · 최초 실행 포함 단계당 최대 ${text(plan.retry.maxAttemptsPerTask)}회 · 전체 최대 ${text(plan.retry.maxAttemptsTotal)}회\n기한: ${Number.isSafeInteger(plan.retry.deadlineMs) ? new Date(plan.retry.deadlineMs).toLocaleString() : '미확인'}\n계약 지문: ${text(plan.retry.contractDigest)}\n실패한 시도도 기록·비용에 포함되며, 이전 실행 정리와 새 자격 검사를 통과해야 재시도합니다.`;
  }
  const targets = Array.isArray(plan.generatedOutputs) ? plan.generatedOutputs : [];
  generated.hidden = targets.length === 0;
  for (const target of targets.slice(0, 128)) {
    const item = document.createElement('li');
    item.textContent = `결과물 대상: ${text(target.targetId)}\n요구사항: ${text(target.requirementId)} · 생성 단계: ${text(target.producerTaskId)}\n검사기: ${text(target.checkerId)} · 버전: ${text(target.checkerRevision)}\n입력 크기: ${text(target.inputByteLength)}바이트 · 출력 상한: ${text(target.maxBytes)}바이트\n입력 SHA-256: ${text(target.inputSha256)}\n검사 설정 지문: ${text(target.parametersDigest)}\n결과물 계약 지문: ${text(target.targetDigest)}`;
    generatedTargets.append(item);
  }
  generatedLimit.textContent = targets.length > 128 ? '표시 한도: 128개 결과물 계약까지만 표시합니다.' : '';
  const criteria = Array.isArray(plan.requirements) ? plan.requirements : [];
  if (!criteria.length || !plan.requirementsDigest) {
    requirementsSummary.textContent = '기준 미등록 · 최종 인수 미확인';
    return;
  }
  requirementsSummary.textContent = `기준 지문 ${text(plan.requirementsDigest)} · ${criteria.length}개 요구사항 · 최종 인수 미확인`;
  const kinds = { code: '코드', research: '조사', document: '문서', external: '외부 작업' };
  for (const requirement of criteria.slice(0, 256)) {
    const item = document.createElement('li');
    const heading = document.createElement('strong');
    heading.textContent = `${text(requirement.id)} · ${kinds[requirement.kind] ?? '종류 미확인'} · ${requirement.required === true ? '필수' : requirement.required === false ? '선택' : '필수 여부 미확인'}`;
    const body = document.createElement('p');
    body.className = 'requirement-text';
    body.textContent = typeof requirement.text === 'string' ? requirement.text.slice(0, 16384) : '원문 미확인';
    if (typeof requirement.text === 'string' && requirement.text.length > 16384) body.append(document.createTextNode('\n표시 한도를 넘는 원문이 생략되었습니다.'));
    const checks = document.createElement('ul');
    checks.className = 'requirement-checks';
    const checkEntries = Array.isArray(requirement.checks) ? requirement.checks : [];
    for (const check of checkEntries.slice(0, 32)) {
      const entry = document.createElement('li');
      const targets = Array.isArray(check.targetIds) ? check.targetIds : [];
      entry.textContent = `검사기: ${text(check.checkerId)} · 버전: ${text(check.revision)}\n대상: ${list(targets.slice(0, 128))}${targets.length > 128 ? ' · 나머지 생략' : ''}\n검사 설정 지문: ${text(check.parametersDigest)}`;
      checks.append(entry);
    }
    if (!checkEntries.length || checkEntries.length > 32) {
      const entry = document.createElement('li');
      entry.textContent = checkEntries.length > 32 ? '32개를 넘는 검사 기준은 생략되었습니다.' : '검사 기준 미등록';
      checks.append(entry);
    }
    item.append(heading, body, checks); requirements.append(item);
  }
  if (criteria.length > 256) requirementsSummary.append(document.createTextNode(' · 256개까지만 표시합니다.'));
}

function selectionExplanation(selection, hasAttempt, key, expanded) {
  const detail = document.createElement('details'); detail.className = 'selection-explanation';
  detail.dataset.selectionKey = key; detail.open = expanded.has(key);
  const heading = document.createElement('summary'); detail.append(heading);
  const states = { recorded: '저장된 선택 이유', 'legacy-not-recorded': '선택 이유 미기록 · 과거 기록', invalid: '선택 기록 검증 실패', 'not-started': '선택 전 · 아직 시작하지 않음' };
  const status = !selection ? (hasAttempt ? 'invalid' : 'not-started')
    : selection.authority === 'historical-explanation-only' && Object.hasOwn(states, selection.status) ? selection.status : 'invalid';
  heading.textContent = states[status];
  const note = document.createElement('p'); note.className = 'selection-note';
  note.textContent = '과거 선택을 설명하는 기록입니다. 현재 실행 자격, 실제 품질 또는 인수 승인을 증명하지 않습니다.'; detail.append(note);
  if (status !== 'recorded') return detail;
  const modes = { efficiency: '효율', performance: '고성능', value: '가성비', speed: '속도' };
  const reasons = { ranked: '저장된 정책 기준으로 비교해 선택', pinned: '사용자가 지정한 후보 선택', 'pin-unavailable': '지정 후보를 사용할 수 없어 선택하지 않음',
    'no-eligible-candidate': '당시 조건을 만족하는 후보 없음', 'fixed-pair-eligible': '승인된 고정 조합의 당시 조건 확인' };
  const exclusions = { 'not-allowed':'허용 목록 밖', eligible:'실행 조건 미충족', authenticated:'인증 미확인', compatible:'호환 조건 미충족', dataAllowed:'데이터 처리 조건 미충족', resourceAvailable:'자원 미확인', quotaAvailable:'사용 한도 미확인',
    'unknown-estimate':'추정값 없음', 'stale-estimate':'추정값 유효기간 초과', 'currency-mismatch':'통화 불일치', 'quality-floor':'정책의 품질 추정 기준 미달', 'unknown-cost-bound':'비용 상한 미확인', 'cost-limit':'비용 한도 초과',
    'unknown-time-bound':'시간 상한 미확인', 'time-limit':'시간 한도 초과', 'score-overflow':'정책 계산값 범위 초과' };
  const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) ? value : '식별자 비공개';
  const label = (labels, value, fallback) => typeof value === 'string' && Object.hasOwn(labels, value) ? labels[value] : fallback;
  const local = selection.kind === 'local-invocation', info = document.createElement('p'); info.className = 'selection-summary';
  info.textContent = `정책: ${local ? '로컬 호출 횟수' : selection.kind === 'monetary' ? '비용 기준' : '종류 미확인'} · ${label(modes, selection.mode, '모드 미확인')}\n선택 후보: ${selection.selectedId === null && ['pin-unavailable','no-eligible-candidate'].includes(selection.reason) ? '선택 없음' : identifier(selection.selectedId)}\n이유: ${label(reasons, selection.reason, '기록된 이유 미확인')}\n${local || selection.ranking === 'not-performed' ? '순위 평가 없음 · 고정 조합' : selection.ranking === 'scored' ? '저장된 정책의 비교 결과 · 품질 측정값 아님' : '순위 평가 미확인'}`;
  detail.append(info);
  const rows = Array.isArray(selection.assessments) ? selection.assessments.slice(0, 50) : [], count = document.createElement('p'); count.className = 'selection-count';
  const total = Number.isSafeInteger(selection.totalAssessments) && selection.totalAssessments >= rows.length ? selection.totalAssessments : null;
  count.textContent = `후보 평가 기록: ${total === null ? '전체 수 미확인' : `${total}개`} · ${rows.length}개 표시${selection.truncated || (total !== null && total > rows.length) ? ' · 일부 생략 (최대 50개)' : ''}`;
  detail.append(count);
  const list = document.createElement('ul'); list.className = 'selection-assessments';
  for (const row of rows) {
    const item = document.createElement('li'), excluded = Array.isArray(row.exclusions) ? row.exclusions.slice(0, 32) : [];
    item.textContent = `${identifier(row.id)} · ${excluded.length ? excluded.map(reason => label(exclusions, reason, '정책 조건 미확인')).join(', ') : '당시 정책 비교 대상'}`;
    list.append(item);
  }
  detail.append(list); return detail;
}

function costObservationText(value) {
  if (value?.status !== 'observed' || value.authority !== 'observation-only') return '비용 관측 미확인';
  const states = { actual: '실제 기록', estimated: '추정', unknown: '미확인' };
  const ages = { fresh: '유효 기간 내', stale: '유효 기간 경과', future: '관측 시각 불일치' };
  const dimensions = { api: 'API 금액', subscription: '구독 사용량', 'local-resource': '로컬 자원 사용량' };
  if (!Object.hasOwn(states, value.costState) || !Object.hasOwn(ages, value.freshness) || !Object.hasOwn(dimensions, value.costDimension)) return '비용 관측 미확인';
  let amount = value.costDimension === 'api' ? '금액 미확인' : '수량 미확인';
  if (value.costDimension === 'api' && Number.isSafeInteger(value.units) && value.units >= 0 && /^[A-Z][A-Z0-9]{2,11}$/.test(value.currency ?? '') && ['minor', 'micro'].includes(value.unit)) amount = `${value.units} ${value.currency}/${value.unit}`;
  if (value.costDimension === 'subscription' && Number.isSafeInteger(value.units) && value.units >= 0 && value.currency === null && value.unit === 'subscription-unit') amount = `${value.units} subscription-unit`;
  if (value.costDimension === 'local-resource' && Number.isSafeInteger(value.units) && value.units >= 0 && value.currency === null && value.unit === 'local-resource-unit') amount = `${value.units} local-resource-unit`;
  return `비용 관측 · ${dimensions[value.costDimension]} · ${states[value.costState]} · ${amount} · ${ages[value.freshness]} · 전체 작업의 최종 청구 확정 아님`;
}

function renderOrchestration(snapshot) {
  const panel = document.querySelector('#orchestration');
  const expanded = new Set([...panel.querySelectorAll('.selection-explanation[open]')].map(node => node.dataset.selectionKey));
  panel.hidden = !snapshot;
  if (!snapshot) return;
  const modes = { efficiency: '효율', performance: '고성능', value: '가성비', speed: '속도' };
  const states = { pending: '대기', running: '실행 중', completed: '실행 완료', failed: '실패', blocked: '막힘', unknown: '미확인' };
  const roles = { planner: '기획', implementation: '구현', verifier: '검증', 'model-producer': '모델 출력 생성' };
  const cleanups = { 'not-started': '실행 전', 'verified-clean': '정리 확인', unknown: '정리 미확인' };
  document.querySelector('#orchestration-policy').textContent = snapshot.policy
    ? `${modes[snapshot.policy.mode] ?? '미확인'} 모드 · 정책 r${snapshot.policy.revision} · ${snapshot.policy.digest.slice(0, 12)}`
    : '선택 정책 미확인';
  const accepted = snapshot.acceptance === 'verified' && snapshot.acceptanceRecord;
  const evaluation = snapshot.requirementEvaluation;
  const verdicts = { pass: '통과', fail: '실패', unknown: '미확인' };
  document.querySelector('#orchestration-acceptance').textContent = accepted
    ? `요구사항 인수 기록 확인 · ${new Date(accepted.acceptedAt).toLocaleString()} · 평가 ${accepted.evaluationId}\n저장된 판정이며 현재 파일을 다시 검사한 결과는 아닙니다.`
    : `요구사항 인수 검증: 미확인${evaluation ? ` · 최근 검사 ${verdicts[evaluation.verdict] ?? '미확인'} (인수 확정 아님)` : ''}`;
  const outcomes = document.querySelector('#orchestration-requirements');
  outcomes.replaceChildren();
  for (const outcome of evaluation ? evaluation.outcomes : []) {
    const item = document.createElement('li');
    item.textContent = `${outcome.requirementId} · ${outcome.required ? '필수' : '선택'} · ${verdicts[outcome.verdict] ?? '미확인'}`;
    outcomes.append(item);
  }
  const budget = snapshot.budget;
  const local = snapshot.localAccounting;
  document.querySelector('#orchestration-budget').textContent = local?.kind === 'local-invocation'
    ? local.status === 'recorded'
      ? `실행 지시 ${local.committed}/${local.limit}회 · 잔여 ${local.remaining}회 · 시작 실패 포함 · 공급자 요청 수와 금전 비용 미측정`
      : '실행 지시 횟수 미확인 · 금전 비용 미측정'
    : budget.status === 'recorded'
    ? `예약 기준 잔여 ${budget.remainingUnits} · 초과 ${budget.debtUnits} (${budget.currency ?? '통화 미확인'}/${budget.unit}) · ${budget.costStatus === 'final' ? `확정 비용 ${budget.actualUnits}` : '최종 비용 미확인'}`
    : '예산·최종 비용 미확인';
  const stages = document.querySelector('#orchestration-stages');
  stages.replaceChildren();
  for (const stage of snapshot.stages) {
    const item = document.createElement('li');
    item.dataset.state = stage.state;
    item.textContent = `${stage.taskId ?? '단계 미확인'} · ${roles[stage.role] ?? '역할 미확인'} · ${states[stage.state] ?? '미확인'}\n후보 ${stage.candidateId ?? '미배정'} · 최신 시도 ${stage.attemptId ?? '없음'}${Number.isSafeInteger(stage.attemptCount) ? ` · 총 ${stage.attemptCount}회 (실패 ${stage.failedAttemptCount}회)` : ''}\n${cleanups[stage.cleanup] ?? '정리 미확인'}${stage.modelId ? ` · 모델 ${stage.modelId}` : ''}${stage.toolId ? ` · 도구 ${stage.toolId}` : ''}`;
    const cost = document.createElement('p'); cost.className = 'cost-observation'; cost.textContent = costObservationText(stage.costObservation); item.append(cost);
    item.append(selectionExplanation(stage.selection, Boolean(stage.attemptId), JSON.stringify([snapshot.runId, 'stage', stage.taskId]), expanded)); stages.append(item);
  }
  document.querySelector('#orchestration-truncation').textContent = snapshot.stagesTruncated ? '단계 일부만 표시합니다.' : '';
  document.querySelector('#orchestration-attempt-count').textContent = Number.isSafeInteger(snapshot.attemptCount)
    ? `전체 시도 ${snapshot.attemptCount}회${snapshot.attemptHistoryTruncated ? ' · 최근 50개만 표시' : ''}` : '시도 수 미확인';
  const attempts = document.querySelector('#orchestration-attempts');
  attempts.replaceChildren();
  for (const attempt of snapshot.attemptHistory ?? []) {
    const item = document.createElement('li');
    item.textContent = `${attempt.taskId ?? '단계 미확인'} · ${attempt.attemptId ?? '시도 미확인'} · ${attempt.candidateId ?? '후보 미확인'}\n${states[attempt.state] ?? '미확인'} · ${cleanups[attempt.cleanup] ?? '정리 미확인'}`;
    const cost = document.createElement('p'); cost.className = 'cost-observation'; cost.textContent = costObservationText(attempt.costObservation); item.append(cost);
    item.append(selectionExplanation(attempt.selection, true, JSON.stringify([snapshot.runId, 'attempt', attempt.attemptId]), expanded)); attempts.append(item);
  }
  const activity = document.querySelector('#orchestration-activity');
  activity.replaceChildren();
  for (const event of snapshot.activity) {
    const item = document.createElement('li');
    const kinds = { heartbeat: '상태 신호', progress: '진행', tool: '도구', unknown: '종류 미확인' };
    item.textContent = `${event.observedAtMs === null ? '시각 미확인' : new Date(event.observedAtMs).toLocaleTimeString()} · ${kinds[event.kind] ?? '미확인'} · ${event.attemptId ?? '시도 미확인'} #${event.ordinal}`;
    activity.append(item);
  }
  if (!snapshot.activity.length || snapshot.activityTruncated) {
    const item = document.createElement('li');
    item.textContent = snapshot.activityTruncated ? '최근 20개 활동만 표시합니다.' : '기록된 활동이 없습니다.';
    activity.append(item);
  }
}

function renderCard(card) {
  if (!executionLaunching && activeExecution && card.taskId === activeExecution.taskId && card.runId === activeExecution.runId &&
      ['completed', 'failed', 'blocked'].includes(card.state) && card.executionOwnership?.status === 'released') activeExecution = null;
  const reportButton = document.querySelector('#report');
  reportButton.hidden = !card.orchestration?.runId;
  reportButton.dataset.runId = card.orchestration?.runId ?? '';
  const terminalChange=lastLedgerCard?.state!==card.state&&['completed','failed','blocked'].includes(card.state);
  lastLedgerCard = card;
  if(terminalChange)void loadWorkspaceSessions(null);
  completedPlanningRunId = card.phase === 'planning' && card.state === 'completed'
    && card.planning?.readyForExecution === true && card.executionOwnership?.status === 'released' ? card.runId : null;
  prepareFromPlanning.hidden = !completedPlanningRunId;
  prepareFromPlanning.disabled = !completedPlanningRunId || Boolean(activeExecution);
  planningTransition.textContent = card.phase === 'planning' && card.state !== 'running'
    ? completedPlanningRunId ? '기획이 완료되었습니다. 실행 범위를 별도로 만들고 승인하세요.' : card.planning?.reason ?? '기획 결과로 실행을 준비할 수 없습니다.' : '';
  if (card.runId && evaluationRun !== card.runId) selectEvaluationRun(card.runId);
  selectNativeRecoveryRun(card.runId ?? null);
  if (card.runId && (!activeExecution || activeExecution.runId === card.runId)) selectRetrospectiveRun(card.runId);
  clearTransportError();
  quiet.hidden = true;
  result.hidden = false;
  const labels = {
    running: '작업 중',
    completed: '완료',
    blocked: '막힘',
    failed: '실패',
    awaiting_approval: '승인 대기',
    queued: '대기',
  };
  const title = document.querySelector('#state-title');
  title.textContent = card.state === 'completed' && card.orchestration
    ? card.orchestration.acceptance === 'verified' && card.orchestration.acceptanceRecord
      ? '완료 · 인수 기록 확인' : '실행 완료 · 인수 미확인'
    : labels[card.state] ?? card.state;
  result.dataset.state = card.state;
  document.querySelector('#stage').textContent = `${card.status} · ${card.stage}`;
  document.querySelector('#approval-summary').textContent = card.approvalSummary;
  document.querySelector('#autonomy-summary').textContent = card.autonomySummary;
  document.querySelector('#tool-summary').textContent = `격리 도구 ${card.isolatedToolCalls ?? 0}회${card.workerPids?.length ? ` · PID ${card.workerPids.join(', ')}` : ''}`;
  const summary = card.resultSummary || card.blockedReason || (card.state === 'running' ? '승인된 범위 안에서 실행 중입니다.' : '기록된 결과가 없습니다.');
  document.querySelector('#result-summary').textContent = summary;
  renderOrchestration(card.orchestration);
  const running = card.state === 'running' || Boolean(activeExecution);
  stop.hidden = !running;
  stop.disabled = !running;
  taskTemplate.disabled = running;
  goalInput.disabled = running || taskTemplate.value !== 'general';
  jsonInput.disabled = running || taskTemplate.value !== 'generated-json-v1';
  form.querySelector('button[type="submit"]').disabled = running;
  selectionMode.disabled = selectionSave.disabled = running || !selectionAvailable;
  syncSetupControls();
}

async function pollStatus(taskId, generation) {
  while (generation === pollGeneration) {
    try {
      const card = await window.cue.execute({ operation: 'status', taskId });
      if (generation !== pollGeneration) return;
      renderCard(card);
      if (card.state !== 'running' && !activeExecution) return;
    } catch (error) {
      showTransportError(error);
    }
    await delay(400);
  }
}

function clearPreparation() {
  if (activeExecution) return;
  preparationGeneration++;
  selectRetrospectiveRun(null);
  selectNativeRecoveryRun(null);
  selectEvaluationRun(null);
  pending = null;
  completedPlanningRunId = null; prepareFromPlanning.hidden = true; prepareFromPlanning.disabled = true; planningTransition.textContent = '';
  approve.disabled = true;
  renderApprovalPlan(null);
  resetResourcePin();
  for (const id of ['what', 'extent', 'excluded', 'envelope']) document.querySelector(`#${id}`).textContent = '';
}

taskTemplate.addEventListener('change', () => {
  if (activeExecution) return;
  clearPreparation();
  const json = taskTemplate.value === 'generated-json-v1';
  document.querySelector('#json-input-section').hidden = !json;
  jsonInput.disabled = !json; jsonInput.required = json;
  goalInput.hidden = json; goalInput.disabled = json; goalInput.required = !json;
  if (json) planFirst.checked = false;
  syncSetupControls();
  quiet.hidden = false;
  quiet.textContent = '작업 종류가 변경되었습니다. 새 범위를 만드세요.';
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!setupReady || setupBusy || setupRestart || activeExecution) return;
  if (!selectionReady) { selectionStatus.textContent = '모드 설정 확인이 끝난 뒤 다시 시도하세요.'; return; }
  pollGeneration += 1;
  clearPreparation();
  const generation = preparationGeneration;
  try {
    const autonomy = Number(document.querySelector('input[name="autonomy"]:checked').value);
    const json = taskTemplate.value === 'generated-json-v1';
    const planning = !json && planFirst.checked;
    if (planning && !planningAvailable) throw Error('기획 경로를 사용할 수 없습니다.');
    if (json && typeof window.cue.prepareJson !== 'function') throw Error('현재 호스트는 JSON 템플릿을 지원하지 않습니다.');
    const sessionId=userSessionId||(typeof window.cue?.userSessions==='function'?await ensureUserSession():null);
    if(generation!==preparationGeneration)return;
    const sessionRef=sessionId?{sessionId}:{};
    const prepared = planning
      ? await window.cue.preparePlanning({goal:goalInput.value,autonomy,selectionMode:selectionMode.value,...sessionRef})
      : json
      ? await window.cue.prepareJson({ templateId: 'generated-json-v1', inputText: jsonInput.value, autonomy, selectionMode: selectionMode.value,...sessionRef })
      : await window.cue.prepare({ goal: goalInput.value, autonomy,
        ...(selectionAvailable ? { selectionMode: selectionMode.value } : {}),...sessionRef });
    if (generation !== preparationGeneration) return;
    if (planning && prepared?.phase !== 'planning') throw Error('기획 준비 응답을 확인할 수 없습니다.');
    pending = prepared;
    void loadWorkspaceSessions(null);void loadUserSessions(null);
    selectEvaluationRun(prepared.runId);
    selectRetrospectiveRun(prepared.runId);
    selectNativeRecoveryRun(prepared.runId);
    const [what, extent, excluded] = pending.threeLines;
    document.querySelector('#what').textContent = what.replace(/^무엇을:\s*/, '');
    document.querySelector('#extent').textContent = extent.replace(/^어디까지:\s*/, '');
    document.querySelector('#excluded').textContent = excluded.replace(/^안 건드릴 것:\s*/, '');
    const expiry = new Date(pending.envelope.expires_at).toLocaleString();
    const destinations = pending.envelope.egress;
    const networkSummary = Array.isArray(destinations) && destinations.length ? `허용 네트워크: ${destinations.join(', ')}` : '네트워크 없음';
    document.querySelector('#envelope').textContent = `워크스페이스: ${pending.envelope.worktree_realpath} · 만료: ${expiry} · ${pending.envelope.allowed_actions.join(' · ')} · ${networkSummary}`;
    renderApprovalPlan(pending.orchestration);
    void loadResourcePin(pending.runId);
    result.hidden = true;
    quiet.hidden = false;
    quiet.textContent = planning ? '기획 범위를 확인하고 기획 실행을 승인하세요. 실행은 나중에 따로 승인합니다.' : '실행 봉투를 확인한 뒤 한 번만 승인하세요.';
    approve.textContent = planning ? '기획 실행 승인' : '승인하고 시작';
    approve.disabled = false;
  } catch (error) {
    if (generation !== preparationGeneration) return;
    pending = null;
    renderApprovalPlan(null);
    quiet.hidden = false;
    quiet.textContent = error instanceof Error ? error.message : String(error);
  }
});

prepareFromPlanning.addEventListener('click', async () => {
  const planningRunId = completedPlanningRunId;
  if (!planningRunId || activeExecution || prepareFromPlanning.disabled) return;
  prepareFromPlanning.disabled = true;
  planningTransition.textContent = '저장된 기획 결과에서 실행 범위를 준비하는 중입니다.';
  const generation = ++preparationGeneration;
  try {
    const autonomy = Number(document.querySelector('input[name="autonomy"]:checked').value);
    const prepared = await window.cue.prepareFromPlanning({planningRunId,autonomy,selectionMode:selectionMode.value,...(userSessionId?{sessionId:userSessionId}:{})});
    if (generation !== preparationGeneration) return;
    if (prepared?.phase !== 'execution' || prepared.sourcePlanningRunId !== planningRunId) throw Error('실행 범위 연결을 확인할 수 없습니다.');
    pending = prepared;void loadUserSessions(null);
    completedPlanningRunId = null; prepareFromPlanning.hidden = true;
    selectEvaluationRun(prepared.runId); selectRetrospectiveRun(prepared.runId); selectNativeRecoveryRun(prepared.runId);
    const [what,extent,excluded] = prepared.threeLines;
    document.querySelector('#what').textContent = what.replace(/^무엇을:\s*/, '');
    document.querySelector('#extent').textContent = extent.replace(/^어디까지:\s*/, '');
    document.querySelector('#excluded').textContent = excluded.replace(/^안 건드릴 것:\s*/, '');
    const envelope = prepared.envelope;
    document.querySelector('#envelope').textContent = `워크스페이스: ${envelope.worktree_realpath} · 만료: ${new Date(envelope.expires_at).toLocaleString()} · ${envelope.allowed_actions.join(' · ')} · ${envelope.egress.length ? `허용 네트워크: ${envelope.egress.join(', ')}` : '네트워크 없음'}`;
    renderApprovalPlan(prepared.orchestration);
    void loadResourcePin(prepared.runId);
    approve.textContent = '실행 범위 승인하고 시작'; approve.disabled = false;
    planningTransition.textContent = '새 실행 범위를 확인한 뒤 별도로 승인하세요.';
  } catch (error) {
    if (generation !== preparationGeneration) return;
    prepareFromPlanning.disabled = false;
    planningTransition.textContent = error instanceof Error ? error.message : String(error);
  }
});

approve.addEventListener('click', async () => {
  if (!pending || activeExecution) return;
  const identity = Object.freeze({ runId: pending.runId, taskId: pending.taskId });
  const explorationApproved = pending.orchestration?.exploration !== undefined && allowExploration.checked === true;
  activeExecution = identity;
  lockEvaluation();
  executionLaunching = true;
  const generation = ++pollGeneration;
  approve.disabled = true;
  syncSetupControls();
  try {
    await window.cue.approve({ runId: identity.runId, ...(explorationApproved ? { allowExploration: true } : {}) });
    const card = await window.cue.execute({ runId: identity.runId });
    executionLaunching = false;
    if (generation !== pollGeneration) {
      if (activeExecution === identity) void pollStatus(identity.taskId, ++pollGeneration);
      return;
    }
    renderCard(card);
    if (activeExecution) await pollStatus(identity.taskId, generation);
  } catch (error) {
    executionLaunching = false;
    showTransportError(error);
    if (!lastLedgerCard || lastLedgerCard.taskId !== identity.taskId || lastLedgerCard.runId !== identity.runId) {
      result.hidden = false;
      result.dataset.state = 'unknown';
      document.querySelector('#state-title').textContent = '실행 상태 미확인';
      document.querySelector('#stage').textContent = '원장 응답을 기다리고 있습니다. 중지를 요청할 수 있습니다.';
      for (const id of ['approval-summary', 'autonomy-summary', 'tool-summary', 'result-summary']) document.querySelector(`#${id}`).textContent = '';
      renderOrchestration(null);
      document.querySelector('#report').hidden = true;
    }
    stop.hidden = false; stop.disabled = false;
    syncSetupControls();
    if (activeExecution === identity) void pollStatus(identity.taskId, ++pollGeneration);
    if (!lastLedgerCard) {
      quiet.hidden = false;
      quiet.textContent = '실행 상태를 원장에서 확인하지 못했습니다.';
    }
  }
});

document.querySelector('#report').addEventListener('click', async () => {
  const button = document.querySelector('#report');
  const runId = button.dataset.runId;
  if (!runId) return;
  button.disabled = true;
  const status = document.querySelector('#report-status');
  try { await window.cue.report({ runId }); status.textContent = '읽기 전용 원장 보고서를 열었습니다.'; }
  catch { status.textContent = '보고서를 열 수 없습니다. 원장과 저장 경로를 확인해 주세요.'; }
  finally { button.disabled = false; }
});

stop.addEventListener('click', async () => {
  const identity = activeExecution ?? pending;
  if (!identity) return;
  allowExploration.checked = false;
  explorationConsent.hidden = true;
  explorationConsentCopy.textContent = '';
  stop.disabled = true;
  try {
    await window.cue.stop({ runId: identity.runId });
    const generation = ++pollGeneration;
    try {
      const card = await window.cue.execute({ operation: 'status', taskId: identity.taskId });
      renderCard(card);
      if (card.state === 'running' || activeExecution) void pollStatus(identity.taskId, generation);
    } catch (error) {
      showTransportError(error);
      if (activeExecution || lastLedgerCard?.state === 'running') {
        stop.disabled = false;
        void pollStatus(identity.taskId, generation);
      }
    }
  } catch (error) {
    showTransportError(error);
    stop.disabled = !activeExecution && lastLedgerCard?.state !== 'running';
  }
});

document.querySelector('#local-json-setup-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!setupReady || setupBusy || activeExecution || lastLedgerCard?.state === 'running' || typeof window.cue?.localJsonSetup !== 'function') return;
  setupBusy = true;
  clearPreparation();
  syncSetupControls();
  try {
    const limits = Object.fromEntries(setupFields.map(field => [field, Number(document.querySelector(`#local-json-${field}`).value)]));
    const value = await window.cue.localJsonSetup({ operation: 'configure', expectedRevision: setupRevision,
      enabled: document.querySelector('#local-json-enabled').checked, limits });
    showLocalJsonSetup(value);
  } catch {
    setupReady = false;
    await loadLocalJsonSetup();
    document.querySelector('#local-json-status').textContent += ' 저장하지 못했습니다. 최신 설정을 확인하고 다시 저장하세요.';
  } finally { setupBusy = false; syncSetupControls(); }
});

document.querySelector('#local-planning-setup-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!planningSetupReady || planningSetupBusy || activeExecution || lastLedgerCard?.state === 'running' || typeof window.cue?.localPlanningSetup !== 'function') return;
  planningSetupBusy = true;
  clearPreparation();
  syncSetupControls();
  try {
    const limits = Object.fromEntries(setupFields.map(field => [field, Number(document.querySelector(`#local-planning-${field}`).value)]));
    showLocalPlanningSetup(await window.cue.localPlanningSetup({ operation: 'configure', expectedRevision: planningSetupRevision,
      enabled: document.querySelector('#local-planning-enabled').checked, limits }));
  } catch {
    planningSetupReady = false;
    await loadLocalPlanningSetup();
    document.querySelector('#local-planning-status').textContent += ' 저장하지 못했습니다. 최신 설정을 확인하고 다시 저장하세요.';
  } finally { planningSetupBusy = false; syncSetupControls(); }
});

void loadWorkspaceSessions(null);
void loadLocalJsonSetup();
void loadLocalPlanningSetup();
void loadPlanningAvailability();
void loadSelectionPreferences();
void loadResourcePackages();
void loadCandidateInventory();
