/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — main.js
   ════════════════════════════════════════════════════════════
   Único responsável por:
   - inicializar a aplicação
   - carregar os dados persistidos (via state.js -> storage.js)
   - chamar o primeiro render (via render.js)
   - conectar os eventos da interface às funções de missions.js
   - garantir que toda alteração de estado seja re-renderizada
     e persistida

   Nenhuma lógica de negócio mora aqui — apenas orquestração e
   ligação de eventos DOM às funções já expostas pelos módulos
   existentes.
   ════════════════════════════════════════════════════════════ */

import { state, initDayState } from './state.js';
import {
  renderMissions, renderMembersBar, updateClock, switchTab
} from './render.js';
import {
  tryFinalize, restartDay,
  toggleBonus, confirmBonus, updateHeaderStars
} from './missions.js';
import {
  openPinOverlay, closePinOverlay, pressPinDigit, pressPinBackspace,
  closeParentPanel, wireParentPanelEvents
} from './parent-panel.js';

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
   ════════════════════════════════════════════════════════════ */
function init() {
  // 1. Carrega o estado de hoje já salvo (missionStatus/memberStars),
  //    ou zera se for a primeira vez no dia. state.config e
  //    state.missions já foram carregados na importação de state.js.
  initDayState();

  // 2. Primeiro render
  renderMembersBar();
  renderMissions();
  updateHeaderStars();
  updateClock();
  switchTab('missions');

  // 3. Relógio e destaque da missão atual — atualiza a cada 30s
  setInterval(() => {
    updateClock();
    renderMissions();
  }, 30000);

  // 4. Eventos da interface
  wireTabBar();
  wireFinalizeButton();
  wireBonusPopup();
  wireReportPopup();
  wireBadgePopup();
  wirePinApproval();
  wireParentPanelAccess();
  wireParentPanelEvents();
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
  if (btn) btn.addEventListener('click', tryFinalize);
}

/* ════════════════════════════════════════════════════════════
   POPUP DE BÔNUS (checklist de capricho/pontualidade/sem reclamar)
   ════════════════════════════════════════════════════════════ */
function wireBonusPopup() {
  ['capricho', 'pontual', 'semreclamar'].forEach(key => {
    const item = document.getElementById('bci-' + key);
    if (item) item.addEventListener('click', () => toggleBonus(key));
  });

  const confirmBtn = document.getElementById('btn-bonus-confirm');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmBonus);

  const cancelBtn = document.getElementById('btn-bonus-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      state.bonusPending = null;
      document.getElementById('bonus-overlay').style.display = 'none';
    });
  }
}

/* ════════════════════════════════════════════════════════════
   RELATÓRIO DE FIM DE DIA
   ════════════════════════════════════════════════════════════ */
function wireReportPopup() {
  const restartBtn = document.getElementById('btn-restart-day');
  if (restartBtn) restartBtn.addEventListener('click', restartDay);
}

/* ════════════════════════════════════════════════════════════
   POPUP DE CONQUISTA DESBLOQUEADA
   ════════════════════════════════════════════════════════════ */
function wireBadgePopup() {
  const closeBtn = document.getElementById('btn-badge-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('badge-popup-overlay').style.display = 'none';
    });
  }
}

/* ════════════════════════════════════════════════════════════
   APROVAÇÃO POR PIN
   ════════════════════════════════════════════════════════════
   missions.js dispara 'gp:request-pin-approve' quando
   state.config.requireApproval é true. Agora isso abre o
   teclado de PIN de verdade (parent-panel.js); ao acertar o
   PIN, o próprio parent-panel.js chama finalizeDay(). */
function wirePinApproval() {
  window.addEventListener('gp:request-pin-approve', () => {
    openPinOverlay('approve');
  });
}

/* ════════════════════════════════════════════════════════════
   ACESSO AO PAINEL DOS PAIS (botão de engrenagem no cabeçalho)
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
   START
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);
