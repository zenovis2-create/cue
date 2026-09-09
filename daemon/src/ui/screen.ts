import type { Ledger } from '../ledger.js';
import { readTaskCard, type TaskCardModel } from './model.js';

export interface ScreenController {
  openCapture(): void;
  refresh(): void;
  destroy(): void;
}

function node<K extends keyof HTMLElementTagNameMap>(document: Document, tag: K, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
  return element;
}

function renderTaskCard(document: Document, model: TaskCardModel, onStop: () => void): HTMLElement {
  const card = node(document, 'article', {'data-task-card': model.taskId});
  const heading = node(document, 'h2'); heading.textContent = '현재 작업'; card.append(heading);
  const status = node(document, 'p', {'data-progress-status': ''}); status.textContent = model.status; card.append(status);
  const stage = node(document, 'p', {'data-stage': ''}); stage.textContent = model.stage; card.append(stage);
  const stop = node(document, 'button', {'type': 'button', 'data-stop': ''}); stop.textContent = '중단'; stop.addEventListener('click', onStop); card.append(stop);
  if (model.orphanCount > 0) {
    const badge = node(document, 'span', {'data-orphan-badge': ''}); badge.textContent = `고아 ${model.orphanCount}건`; card.append(badge);
  }
  if (model.state === 'completed' || model.state === 'blocked' || model.state === 'failed') {
    const summary = node(document, 'p', {'data-approval-summary': ''});
    summary.append(document.createTextNode(`자동 승인 ${model.accepted}건 · 거부 ${model.declined}건 · `));
    const detailButton = node(document, 'button', {'type': 'button', 'data-detail-button': ''}); detailButton.textContent = '자세히';
    detailButton.addEventListener('click', () => {
      if (card.querySelector('[data-task-detail]')) return;
      const detail = node(document, 'section', {'data-task-detail': ''});
      detail.textContent = `작업 ${model.taskId} · 실행 ${model.runId ?? '없음'}`;
      card.append(detail);
    });
    summary.append(detailButton); card.append(summary);
  }
  if (model.autonomyLevel !== null) {
    const autonomy = node(document, 'p', {'data-autonomy-summary': ''});
    autonomy.textContent = `자율성: ${'①②③'[model.autonomyLevel - 1]} · 자동 복구 ${model.recoveryAttempts}회`;
    card.append(autonomy);
  }
  return card;
}

export function mountScreen(root: HTMLElement, db: Ledger, taskId: string, onStop: () => void): ScreenController {
  const document = root.ownerDocument;
  root.replaceChildren();
  root.setAttribute('data-cue-screen', '');
  const style = node(document, 'style');
  style.textContent = `[data-cue-screen]{display:grid;grid-template-columns:minmax(0,1fr) 20rem;min-height:100vh;background:#fff;color:#172033;font:15px/1.5 system-ui,sans-serif}[data-main]{padding:2rem;background:#f8fbff}[data-current-work]{padding:2rem;border-left:1px solid #dfe7f1;background:#fff}[data-task-card]{display:grid;gap:.75rem}[data-orphan-badge]{color:#8a3a12}[data-stop],[data-detail-button]{font:600 14px/1.2 system-ui,sans-serif}`;
  root.append(style);
  const main = node(document, 'main', {'data-main': '', 'data-view': 'conversation'});
  const conversation = node(document, 'section', {'data-conversation': ''});
  const conversationHeading = node(document, 'h1'); conversationHeading.textContent = '대화'; conversation.append(conversationHeading); main.append(conversation);
  const rail = node(document, 'aside', {'data-current-work': ''});
  root.append(main, rail);

  const refresh = () => rail.replaceChildren(renderTaskCard(document, readTaskCard(db, taskId), onStop));
  refresh();
  return {
    openCapture() {
      const canvas = node(document, 'section', {'data-annotation-canvas': ''});
      const heading = node(document, 'h1'); heading.textContent = '주석 캔버스'; canvas.append(heading);
      main.setAttribute('data-view', 'capture'); main.replaceChildren(canvas);
    },
    refresh,
    destroy() { root.replaceChildren(); },
  };
}
