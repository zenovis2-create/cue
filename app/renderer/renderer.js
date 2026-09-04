const form = document.querySelector('#goal-form');
const approve = document.querySelector('#approve');
let pending = null;

form.addEventListener('submit', async event => {
  event.preventDefault();
  const autonomy = Number(document.querySelector('input[name="autonomy"]:checked').value);
  pending = await window.cue.prepare({ goal: document.querySelector('#goal').value, autonomy });
  const [what, extent, excluded] = pending.threeLines;
  document.querySelector('#what').textContent = what.replace(/^무엇을:\s*/, '');
  document.querySelector('#extent').textContent = extent.replace(/^어디까지:\s*/, '');
  document.querySelector('#excluded').textContent = excluded.replace(/^안 건드릴 것:\s*/, '');
  document.querySelector('#envelope').textContent = `${pending.envelope.allowed_actions.join(', ')} · 네트워크 없음`;
  approve.disabled = false;
});

approve.addEventListener('click', async () => {
  approve.disabled = true;
  await window.cue.approve({ runId: pending.runId });
  const card = await window.cue.execute({ runId: pending.runId });
  document.querySelector('#quiet').hidden = true;
  document.querySelector('#result').hidden = false;
  document.querySelector('#approval-summary').textContent = card.approvalSummary;
  document.querySelector('#autonomy-summary').textContent = card.autonomySummary;
});
