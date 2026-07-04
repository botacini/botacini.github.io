/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — main.js
   ════════════════════════════════════════════════════════════
   Único ponto de entrada. Não contém regra de negócio nem
   lógica de renderização própria — só:
   - inicializa a aplicação (carrega o estado via state.js)
   - dispara o primeiro render (via render.js)
   - liga os eventos de interface às funções corretas de
     missions.js e parent-panel.js
   - faz a ponte por eventos entre missions.js (que pede PIN)
     e parent-panel.js (que sabe conferir PIN), sem que esses
     dois módulos precisem se importar um ao outro.
   ════════════════════════════════════════════════════════════ */

import { loadState } from './state.js';
import { renderMembersBar, renderMissions, updateClock, switchTab } from './render.js';
import {
  handleMissionAction, toggleBonus, confirmBonus, cancelBonus,
  tryFinalizeDay, finalizeDay, restartDay, tryFinalizeWeek,
} from './missions.js';
import {
  openPinOverlay, closePinOverlay, pressPinDigit, pressPinBackspace,
  closeParentPanel, wireParentPanelEvents,
} from './parent-panel.js';

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
   ════════════════════════════════════════════════════════════ */
async function init() {
  await loadState();

  renderMembersBar();
  renderMissions();
  updateClock();
  switchTab('missions');

  // Relógio e destaque da tarefa atual — atualiza a cada 30s
  setInterval(() => {
    updateClock();
    renderMissions();
  }, 30000);

  wireMissionList();
  wireTabBar();
  wireFinalizeButton();
  wireBonusPopup();
  wireReportPopup();
  wireWeekPanel();
  wireBadgePopup();
  wireParentPanelAccess();
  wirePinApprovalBridge();
  wireParentPanelEvents();
}

/* ════════════════════════════════════════════════════════════
   LISTA DE MISSÕES (delegação — a lista é reconstruída a cada
   render, então o listener fica no container, não nos botões)
   ════════════════════════════════════════════════════════════ */
function wireMissionList() {
  const list = document.getElementById('mission-list');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mission-action]');
    if (!btn) return;
    handleMissionAction(btn.dataset.missionId, btn.dataset.missionAction);
  });
}

/* ════════════════════════════════════════════════════════════
   ABAS (tab-bar inferior)
   ════════════════════════════════════════════════════════════ */
function wireTabBar() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

/* ════════════════════════════════════════════════════════════
   FINALIZAR O DIA
   ════════════════════════════════════════════════════════════ */
function wireFinalizeButton() {
  const btn = document.getElementById('btn-finalize');
  if (btn) btn.addEventListener('click', tryFinalizeDay);
}

/* ════════════════════════════════════════════════════════════
   POPUP DE BÔNUS
   ════════════════════════════════════════════════════════════ */
function wireBonusPopup() {
  ['capricho', 'pontual', 'semreclamar'].forEach(key => {
    const item = document.getElementById('bci-' + key);
    if (item) item.addEventListener('click', () => toggleBonus(key));
  });
  const confirmBtn = document.getElementById('btn-bonus-confirm');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmBonus);
  const cancelBtn = document.getElementById('btn-bonus-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelBonus);
}

/* ════════════════════════════════════════════════════════════
   RELATÓRIO DE FIM DE DIA
   ════════════════════════════════════════════════════════════ */
function wireReportPopup() {
  const restartBtn = document.getElementById('btn-restart-day');
  if (restartBtn) restartBtn.addEventListener('click', restartDay);
}

/* ════════════════════════════════════════════════════════════
   FINALIZAR A SEMANA (botão na aba "Semana")
   ════════════════════════════════════════════════════════════ */
function wireWeekPanel() {
  const btn = document.getElementById('btn-finalize-week');
  if (btn) btn.addEventListener('click', tryFinalizeWeek);
}

/* ════════════════════════════════════════════════════════════
   POPUP DE CONQUISTA DESBLOQUEADA
   ════════════════════════════════════════════════════════════ */
function wireBadgePopup() {
  const closeBtn = document.getElementById('btn-badge-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const overlay = document.getElementById('badge-popup-overlay');
      if (overlay) overlay.style.display = 'none';
    });
  }
}

/* ════════════════════════════════════════════════════════════
   ACESSO AO PAINEL DOS PAIS (engrenagem + teclado de PIN)
   ════════════════════════════════════════════════════════════ */
function wireParentPanelAccess() {
  const gearBtn = document.getElementById('btn-parent-panel');
  if (gearBtn) gearBtn.addEventListener('click', () => openPinOverlay('panel'));

  const pinCancelBtn = document.getElementById('btn-pin-cancel');
  if (pinCancelBtn) pinCancelBtn.addEventListener('click', closePinOverlay);

  const pinBackspaceBtn = document.getElementById('btn-pin-backspace');
  if (pinBackspaceBtn) pinBackspaceBtn.addEventListener('click', pressPinBackspace);

  document.querySelectorAll('.pin-key[data-digit]').forEach(key => {
    key.addEventListener('click', () => pressPinDigit(key.dataset.digit));
  });

  const closePanelBtn = document.getElementById('btn-parent-panel-close');
  if (closePanelBtn) closePanelBtn.addEventListener('click', closeParentPanel);
}

/* ════════════════════════════════════════════════════════════
   PONTE DE APROVAÇÃO POR PIN
   ════════════════════════════════════════════════════════════
   missions.js dispara 'gp:request-pin-approve' quando é
   preciso confirmar o PIN para finalizar o dia; parent-panel.js
   dispara 'gp:pin-approved' quando o PIN digitado está certo.
   main.js é o único que conhece as duas pontas — por isso
   missions.js e parent-panel.js nunca precisam se importar. */
function wirePinApprovalBridge() {
  window.addEventListener('gp:request-pin-approve', () => openPinOverlay('approve'));
  window.addEventListener('gp:pin-approved', () => finalizeDay());
}

/* ════════════════════════════════════════════════════════════
   START
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);
