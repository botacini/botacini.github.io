/* ════════════════════════════════════════════════════════════ GP DA FAMÍLIA — main.js ════════════════════════════════════════════════════════════
   Único ponto de entrada. Não contém regra de negócio nem lógica de renderização
   própria — só:
   - verifica se há família cadastrada (onboarding)
   - inicializa a aplicação (carrega o estado via state.js)
   - dispara o primeiro render (via render.js)
   - liga os eventos de interface às funções corretas de missions.js e parent-panel.js
   - faz a ponte por eventos entre missions.js (que pede PIN) e parent-panel.js
     (que sabe conferir PIN), sem que esses dois módulos precisem se importar um ao outro.
   ════════════════════════════════════════════════════════════ */
import {
  loadState,
  loadDateContext,
  state,
} from './state.js';
import {
  renderDashboard,
  renderMissions,
  updateClock,
  switchTab,
} from './render.js';
import {
  handleMissionAction,
  toggleBonus,
  confirmBonus,
  cancelBonus,
  tryFinalizeDay,
  finalizeDay,
  restartDay,
  tryFinalizeWeek,
} from './missions.js';
import {
  openPinOverlay,
  closePinOverlay,
  pressPinDigit,
  pressPinBackspace,
  openParentPanel,
  openParentPanelOnTab,
  toggleCustomGoalReward,
  closeParentPanel,
  wireParentPanelEvents,
} from './parent-panel.js';
import {
  openNewTaskPopup,
  closeNewTaskPopup,
  confirmNewTask,
  deleteTask,
  openNewGoalPopup,
  closeNewGoalPopup,
  confirmNewGoal,
  deleteGoal,
  openNewMemberPopup,
  closeNewMemberPopup,
  confirmNewMember,
  openBonusPenaltyPopup,
  closeBonusPenaltyPopup,
  setBonusPenaltyMode,
  confirmBonusPenalty,
} from './quick-actions.js';
import {
  hasSession,
  setCurrentFamily,
  selectFamily,
  listFamilies,
} from './auth.js';

/* ════════════════════════════════════════════════════════════ ONBOARDING — popup de seleção / criação de família ════════════════════════════════════════════════════════════ */
function showOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.style.display = 'flex';
  renderOnboardingFamilyList();
}

function hideOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.style.display = 'none';
}

function renderOnboardingFamilyList() {
  const families = listFamilies();
  const listEl = document.getElementById('onboarding-family-list');
  const sectionEl = document.getElementById('onboarding-existing-section');
  if (!listEl || !sectionEl) return;

  if (families.length === 0) {
    sectionEl.style.display = 'none';
    return;
  }
  sectionEl.style.display = 'block';
  listEl.innerHTML = families.map(f => `
    <button class="onboarding-family-btn" data-family-id="${f.id}">
      👨‍👩‍👧‍👦 ${f.name} →
    </button>
  `).join('');

  listEl.querySelectorAll('[data-family-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      selectFamily(btn.dataset.familyId);
      hideOnboarding();
      await startApp();
    });
  });
}

async function handleOnboardingSubmit() {
  const input = document.getElementById('onboarding-family-name');
  const rawName = input ? input.value.trim() : '';
  if (!rawName) {
    input.classList.add('onboarding-input-error');
    input.placeholder = 'Digite o nome da sua família!';
    setTimeout(() => input.classList.remove('onboarding-input-error'), 800);
    return;
  }
  const id = setCurrentFamily(rawName);
  if (!id) {
    alert('Nome inválido. Use apenas letras e espaços.');
    return;
  }
  hideOnboarding();
  await startApp();
}

function wireOnboarding() {
  const confirmBtn = document.getElementById('btn-onboarding-confirm');
  if (confirmBtn) confirmBtn.addEventListener('click', handleOnboardingSubmit);
  const input = document.getElementById('onboarding-family-name');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleOnboardingSubmit();
    });
  }
}

/* ════════════════════════════════════════════════════════════ INICIALIZAÇÃO DO APP (após onboarding) ════════════════════════════════════════════════════════════ */
async function startApp() {
  await loadState();
  renderDashboard();
  updateClock();

  // CORREÇÃO: se não houver membros, redireciona automaticamente para a aba "Time"
  const members = state.config?.members || [];
  if (members.length === 0) {
    switchTab('team');
  } else {
    switchTab('missions');
  }

  setInterval(() => {
    updateClock();
    renderMissions();
  }, 30000);

  wireMissionList();
  wireTabBar();
  wireFinalizeButton();
  wireShortcutButtons();
  wireBonusPopup();
  wireReportPopup();
  wireWeekPanel();
  wireBadgePopup();
  wireBadgeActions();
  wireParentPanelAccess();
  wirePinApprovalBridge();
  wireParentPanelEvents();
  wireQuickActionsPopups();
}

/* ════════════════════════════════════════════════════════════ INIT — ponto de entrada ════════════════════════════════════════════════════════════ */
async function init() {
  wireOnboarding();
  if (!hasSession()) {
    showOnboarding();
    return; // app só inicia após o onboarding
  }
  await startApp();
}

/* ════════════════════════════════════════════════════════════ LISTA DE MISSÕES ════════════════════════════════════════════════════════════ */
function wireMissionList() {
  const list = document.getElementById('mission-list');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const dateBtn = e.target.closest('[data-date-key]');
    if (dateBtn) {
      void selectDashboardDate(dateBtn.dataset.dateKey);
      return;
    }
    const btn = e.target.closest('[data-mission-action]');
    if (!btn) return;
    handleMissionAction(btn.dataset.missionId, btn.dataset.missionAction);
  });
}

/* ════════════════════════════════════════════════════════════ BOTÕES DE ATALHO ════════════════════════════════════════════════════════════ */
function wireShortcutButtons() {
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('#btn-add-goal-shortcut')) {
      openNewGoalPopup();
      return;
    }
    if (e.target.closest('#btn-bonus-shortcut')) {
      openBonusPenaltyPopup();
      return;
    }
    if (e.target.closest('#btn-add-member-shortcut')) {
      openNewMemberPopup();
      return;
    }
    const addTaskBtn = e.target.closest('[data-add-task-member]');
    if (addTaskBtn) {
      openNewTaskPopup(addTaskBtn.dataset.addTaskMember);
      return;
    }
    const delTaskBtn = e.target.closest('[data-delete-mission]');
    if (delTaskBtn) {
      deleteTask(delTaskBtn.dataset.deleteMission);
      return;
    }
    const delGoalBtn = e.target.closest('[data-delete-goal]');
    if (delGoalBtn) {
      deleteGoal(delGoalBtn.dataset.deleteGoal);
      return;
    }
  });
}

async function selectDashboardDate(dateKey) {
  await loadDateContext(dateKey);
  renderDashboard();
}

/* ════════════════════════════════════════════════════════════ ABAS ════════════════════════════════════════════════════════════ */
function wireTabBar() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

/* ════════════════════════════════════════════════════════════ FINALIZAR O DIA ════════════════════════════════════════════════════════════ */
function wireFinalizeButton() {
  const btn = document.getElementById('btn-finalize');
  if (btn) btn.addEventListener('click', tryFinalizeDay);
}

/* ════════════════════════════════════════════════════════════ POPUP DE BÔNUS ════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════ RELATÓRIO DE FIM DE DIA ════════════════════════════════════════════════════════════ */
function wireReportPopup() {
  const restartBtn = document.getElementById('btn-restart-day');
  if (restartBtn) restartBtn.addEventListener('click', restartDay);
}

/* ════════════════════════════════════════════════════════════ FINALIZAR A SEMANA ════════════════════════════════════════════════════════════ */
function wireWeekPanel() {
  const btn = document.getElementById('btn-finalize-week');
  if (btn) btn.addEventListener('click', tryFinalizeWeek);
}

/* ════════════════════════════════════════════════════════════ POPUP DE CONQUISTA ════════════════════════════════════════════════════════════ */
function wireBadgePopup() {
  const closeBtn = document.getElementById('btn-badge-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const overlay = document.getElementById('badge-popup-overlay');
      if (overlay) overlay.style.display = 'none';
    });
  }
}

function wireBadgeActions() {
  const grid = document.getElementById('badge-grid');
  if (!grid) return;
  grid.addEventListener('click', (e) => {
    const delBtn = e.target.closest('[data-delete-goal]');
    if (delBtn) {
      deleteGoal(delBtn.dataset.deleteGoal);
      return;
    }
    const btn = e.target.closest('[data-goal-action]');
    if (!btn) return;
    const goalId = btn.dataset.goalId;
    void toggleCustomGoalReward(goalId);
  });
}

/* ════════════════════════════════════════════════════════════ ACESSO AO PAINEL DOS PAIS ════════════════════════════════════════════════════════════ */
function wireParentPanelAccess() {
  const gearBtn = document.getElementById('btn-parent-panel');
  if (gearBtn) gearBtn.addEventListener('click', () => {
    if (state.config?.skipParentPanelPin) openParentPanel();
    else openPinOverlay('panel');
  });
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

/* ════════════════════════════════════════════════════════════ PONTE DE APROVAÇÃO POR PIN ════════════════════════════════════════════════════════════ */
function wirePinApprovalBridge() {
  window.addEventListener('gp:request-pin-approve', () => openPinOverlay('approve'));
  window.addEventListener('gp:pin-approved', () => finalizeDay());
}

/* ════════════════════════════════════════════════════════════ QUICK ACTIONS — POPUPS ════════════════════════════════════════════════════════════ */
function wireQuickActionsPopups() {
  document.getElementById('btn-qa-task-confirm')?.addEventListener('click', confirmNewTask);
  document.getElementById('btn-qa-task-cancel')?.addEventListener('click', closeNewTaskPopup);
  document.getElementById('btn-qa-goal-confirm')?.addEventListener('click', confirmNewGoal);
  document.getElementById('btn-qa-goal-cancel')?.addEventListener('click', closeNewGoalPopup);
  document.getElementById('btn-qa-member-confirm')?.addEventListener('click', confirmNewMember);
  document.getElementById('btn-qa-member-cancel')?.addEventListener('click', closeNewMemberPopup);
  document.getElementById('qa-bp-btn-bonus')?.addEventListener('click', () => setBonusPenaltyMode('bonus'));
  document.getElementById('qa-bp-btn-penalty')?.addEventListener('click', () => setBonusPenaltyMode('penalty'));
  document.getElementById('btn-qa-bp-confirm')?.addEventListener('click', confirmBonusPenalty);
  document.getElementById('btn-qa-bp-cancel')?.addEventListener('click', closeBonusPenaltyPopup);
}

/* ════════════════════════════════════════════════════════════ START ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);