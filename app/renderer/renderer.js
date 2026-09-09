const form = document.querySelector('#goal-form');
const goalInput = document.querySelector('#goal');
const approve = document.querySelector('#approve');
const stop = document.querySelector('#stop');
const result = document.querySelector('#result');
const quiet = document.querySelector('#quiet');
const transportError = document.querySelector('#transport-error');
let pending = null;
let pollGeneration = 0;
let lastLedgerCard = null;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function showTransportError(error) {
  transportError.textContent = `연결 오류: ${error instanceof Error ? error.message : String(error)} · 원장 상태를 유지하고 다시 시도합니다.`;
  transportError.hidden = false;
}

function clearTransportError() {
  transportError.hidden = true;
  transportError.textContent = '';
}

function renderCard(card) {
  lastLedgerCard = card;
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
  title.textContent = labels[card.state] ?? card.state;
  result.dataset.state = card.state;
  document.querySelector('#stage').textContent = `${card.status} · ${card.stage}`;
  document.querySelector('#approval-summary').textContent = card.approvalSummary;
  document.querySelector('#autonomy-summary').textContent = card.autonomySummary;
  document.querySelector('#tool-summary').textContent = `격리 도구 ${card.isolatedToolCalls ?? 0}회${card.workerPids?.length ? ` · PID ${card.workerPids.join(', ')}` : ''}`;
  const summary = card.resultSummary || card.blockedReason || (card.state === 'running' ? '승인된 범위 안에서 실행 중입니다.' : '기록된 결과가 없습니다.');
  document.querySelector('#result-summary').textContent = summary;
  const running = card.state === 'running';
  stop.hidden = !running;
  stop.disabled = !running;
  goalInput.disabled = running;
  form.querySelector('button[type="submit"]').disabled = running;
}

async function pollStatus(taskId, generation) {
  while (generation === pollGeneration) {
    try {
      const card = await window.cue.execute({ operation: 'status', taskId });
      renderCard(card);
      if (card.state !== 'running') return;
    } catch (error) {
      showTransportError(error);
    }
    await delay(400);
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  pollGeneration += 1;
  approve.disabled = true;
  try {
    const autonomy = Number(document.querySelector('input[name="autonomy"]:checked').value);
    pending = await window.cue.prepare({ goal: goalInput.value, autonomy });
    const [what, extent, excluded] = pending.threeLines;
    document.querySelector('#what').textContent = what.replace(/^무엇을:\s*/, '');
    document.querySelector('#extent').textContent = extent.replace(/^어디까지:\s*/, '');
    document.querySelector('#excluded').textContent = excluded.replace(/^안 건드릴 것:\s*/, '');
    const expiry = new Date(pending.envelope.expires_at).toLocaleString();
    document.querySelector('#envelope').textContent = `워크스페이스: ${pending.envelope.worktree_realpath} · 만료: ${expiry} · ${pending.envelope.allowed_actions.join(' · ')} · 네트워크 없음`;
    result.hidden = true;
    quiet.hidden = false;
    quiet.textContent = '실행 봉투를 확인한 뒤 한 번만 승인하세요.';
    approve.disabled = false;
  } catch (error) {
    pending = null;
    quiet.hidden = false;
    quiet.textContent = error instanceof Error ? error.message : String(error);
  }
});

approve.addEventListener('click', async () => {
  if (!pending) return;
  approve.disabled = true;
  try {
    await window.cue.approve({ runId: pending.runId });
    const card = await window.cue.execute({ runId: pending.runId });
    renderCard(card);
    const generation = ++pollGeneration;
    if (card.state === 'running') await pollStatus(pending.taskId, generation);
  } catch (error) {
    showTransportError(error);
    if (!lastLedgerCard) {
      quiet.hidden = false;
      quiet.textContent = '실행 상태를 원장에서 확인하지 못했습니다.';
    }
  }
});

stop.addEventListener('click', async () => {
  if (!pending) return;
  stop.disabled = true;
  try {
    await window.cue.stop({ runId: pending.runId });
    const generation = ++pollGeneration;
    try {
      const card = await window.cue.execute({ operation: 'status', taskId: pending.taskId });
      renderCard(card);
      if (card.state === 'running') void pollStatus(pending.taskId, generation);
    } catch (error) {
      showTransportError(error);
      if (lastLedgerCard?.state === 'running') {
        stop.disabled = false;
        void pollStatus(pending.taskId, generation);
      }
    }
  } catch (error) {
    showTransportError(error);
    stop.disabled = lastLedgerCard?.state !== 'running';
  }
});
