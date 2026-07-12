/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — main.js
   ════════════════════════════════════════════════════════════
   Único ponto de entrada. Responsabilidades:
   - Verificar sessão (auth.js) e exibir tela de login/cadastro
     se necessário, ou iniciar o app se já autenticado.
   - Inicializar o estado (state.js) e disparar o primeiro render.
   - Ligar todos os eventos de interface aos módulos corretos.
   - Fazer a ponte PIN entre missions.js e parent-panel.js.
   ════════════════════════════════════════════════════════════ */

import { loadState, loadDateContext, state } from './state.js';
import { renderDashboard, renderMissions, updateClock, switchTab } from './render.js';
import {
  handleMissionAction, toggleBonus, confirmBonus, cancelBonus,
  tryFinalizeDay, finalizeDay, restartDay, tryFinalizeWeek,
} from './missions.js';
import {
  openPinOverlay, closePinOverlay, pressPinDigit, pressPinBackspace,
  openParentPanel, openParentPanelOnTab, toggleCustomGoalReward,
  closeParentPanel, wireParentPanelEvents,
} from './parent-panel.js';
import {
  openNewTaskPopup, closeNewTaskPopup, confirmNewTask, deleteTask,
  openNewGoalPopup, closeNewGoalPopup, confirmNewGoal, deleteGoal,
  openNewMemberPopup, closeNewMemberPopup, confirmNewMember,
  openBonusPenaltyPopup, closeBonusPenaltyPopup,
  setBonusPenaltyMode, confirmBonusPenalty,
} from './quick-actions.js';
import {
  initialize, onAuthStateChange, hasSession,
  signIn, signUp, logout,
} from './auth.js';
import { invalidateCache } from './storage.js';

/* ════════════════════════════════════════════════════════════
   TELA DE AUTENTICAÇÃO (Login / Cadastro)
   ════════════════════════════════════════════════════════════ */

function showAuthScreen() {
  document.getElementById('auth-overlay').style.display = 'flex';
  showAuthTab('login');
}

function hideAuthScreen() {
  document.getElementById('auth-overlay').style.display = 'none';
}

function showAuthTab(tab) {
  // Alterna abas login / cadastro
  document.getElementById('auth-tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('auth-tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('auth-form-login').style.display  = tab === 'login'  ? 'block' : 'none';
  document.getElementById('auth-form-signup').style.display = tab === 'signup' ? 'block' : 'none';
  setAuthError('');
}

function setAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}

function setAuthLoading(loading) {
  const btns = document.querySelectorAll('.auth-submit-btn');
  btns.forEach(btn => {
    btn.disabled = loading;
    btn.textContent = loading ? 'AGUARDE...' : btn.dataset.label;
  });
}

async function handleLogin() {
  const email    = document.getElementById('auth-login-email').value.trim();
  const password = document.getElementById('auth-login-password').value;
  if (!email || !password) { setAuthError('Preencha email e senha.'); return; }

  setAuthLoading(true);
  const result = await signIn(email, password);
  setAuthLoading(false);

  if (!result.ok) { setAuthError(result.error); return; }

  invalidateCache();
  hideAuthScreen();
  await startApp();
}

async function handleSignup() {
  const familyName = document.getElementById('auth-signup-family').value.trim();
  const email      = document.getElementById('auth-signup-email').value.trim();
  const password   = document.getElementById('auth-signup-password').value;
  const confirm    = document.getElementById('auth-signup-confirm').value;

  if (!familyName)        { setAuthError('Digite o nome da sua família.');     return; }
  if (!email)             { setAuthError('Digite seu email.');                  return; }
  if (password.length < 6){ setAuthError('A senha deve ter pelo menos 6 caracteres.'); return; }
  if (password !== confirm){ setAuthError('As senhas não coincidem.');           return; }

  setAuthLoading(true);
  const result = await signUp(email, password, familyName);
  setAuthLoading(false);

  if (!result.ok) { setAuthError(result.error); return; }

  if (result.needsConfirmation) {
    // Supabase enviou email de confirmação — informa o usuário
    setAuthError('');
    document.getElementById('auth-form-signup').style.display = 'none';
    document.getElementById('auth-confirmation-msg').style.display = 'block';
    return;
  }

  invalidateCache();
  hideAuthScreen();
  await startApp();
}

function wireAuthScreen() {
  document.getElementById('auth-tab-login') ?.addEventListener('click', () => showAuthTab('login'));
  document.getElementById('auth-tab-signup')?.addEventListener('click', () => showAuthTab('signup'));

  document.getElementById('btn-auth-login') ?.addEventListener('click', handleLogin);
  document.getElementById('btn-auth-signup')?.addEventListener('click', handleSignup);

  // Enter nos campos de senha
  document.getElementById('auth-login-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('auth-signup-confirm')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSignup();
  });
}

/* ════════════════════════════════════════════════════════════
   LOGOUT (botão no painel dos pais / ajustes)
   ════════════════════════════════════════════════════════════ */
async function handleLogout() {
  if (!confirm('Sair da conta? Você precisará fazer login novamente.')) return;
  await logout();
  invalidateCache();
  // Recarrega a página — garante estado completamente limpo
  location.reload();
}

// Expõe para parent-panel.js acessar via evento customizado
window.addEventListener('gp:logout', handleLogout);

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO DO APP (após autenticação bem-sucedida)
   ════════════════════════════════════════════════════════════ */
async function startApp() {
  await loadState();
  renderDashboard();
  updateClock();

  const members = state.config?.members || [];
  switchTab(members.length === 0 ? 'team' : 'missions');

  setInterval(() => { updateClock(); renderMissions(); }, 30000);

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

/* ════════════════════════════════════════════════════════════
   INIT — ponto de entrada
   ════════════════════════════════════════════════════════════ */
async function init() {
  wireAuthScreen();

  const authenticated = await initialize();

  // Monitora mudanças de sessão (logout em outra aba, token expirado).
  // ATENÇÃO: o Supabase dispara INITIAL_SESSION imediatamente ao registrar
  // o listener — inclusive com session=null quando não há usuário logado.
  // Ignoramos esse evento inicial para não causar loop de reload.
  onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return; // ignora disparo automático
    if (!session.authenticated) {
      invalidateCache();
      location.reload();
    }
  });

  if (!authenticated) {
    showAuthScreen();
    return;
  }

  await startApp();
}

/* ════════════════════════════════════════════════════════════
   LISTA DE MISSÕES
   ════════════════════════════════════════════════════════════ */
function wireMissionList() {
  const list = document.getElementById('mission-list');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const dateBtn = e.target.closest('[data-date-key]');
    if (dateBtn) { void selectDashboardDate(dateBtn.dataset.dateKey); return; }
    const btn = e.target.closest('[data-mission-action]');
    if (!btn) return;
    handleMissionAction(btn.dataset.missionId, btn.dataset.missionAction);
  });
}

/* ════════════════════════════════════════════════════════════
   BOTÕES DE ATALHO
   ════════════════════════════════════════════════════════════ */
function wireShortcutButtons() {
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('#btn-add-goal-shortcut'))   { openNewGoalPopup();      return; }
    if (e.target.closest('#btn-bonus-shortcut'))       { openBonusPenaltyPopup(); return; }
    if (e.target.closest('#btn-add-member-shortcut'))  { openNewMemberPopup();    return; }

    const addTaskBtn = e.target.closest('[data-add-task-member]');
    if (addTaskBtn) { openNewTaskPopup(addTaskBtn.dataset.addTaskMember); return; }

    const delTaskBtn = e.target.closest('[data-delete-mission]');
    if (delTaskBtn) { deleteTask(delTaskBtn.dataset.deleteMission); return; }

    const delGoalBtn = e.target.closest('[data-delete-goal]');
    if (delGoalBtn) { deleteGoal(delGoalBtn.dataset.deleteGoal); return; }
  });
}

async function selectDashboardDate(dateKey) {
  await loadDateContext(dateKey);
  renderDashboard();
}

/* ════════════════════════════════════════════════════════════
   ABAS
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
  document.getElementById('btn-finalize')?.addEventListener('click', tryFinalizeDay);
}

/* ════════════════════════════════════════════════════════════
   POPUP DE BÔNUS
   ════════════════════════════════════════════════════════════ */
function wireBonusPopup() {
  ['capricho', 'pontual', 'semreclamar'].forEach(key => {
    document.getElementById('bci-' + key)?.addEventListener('click', () => toggleBonus(key));
  });
  document.getElementById('btn-bonus-confirm')?.addEventListener('click', confirmBonus);
  document.getElementById('btn-bonus-cancel') ?.addEventListener('click', cancelBonus);
}

/* ════════════════════════════════════════════════════════════
   RELATÓRIO DE FIM DE DIA
   ════════════════════════════════════════════════════════════ */
function wireReportPopup() {
  document.getElementById('btn-restart-day')?.addEventListener('click', restartDay);
}

/* ════════════════════════════════════════════════════════════
   FINALIZAR A SEMANA
   ════════════════════════════════════════════════════════════ */
function wireWeekPanel() {
  document.getElementById('btn-finalize-week')?.addEventListener('click', tryFinalizeWeek);
}

/* ════════════════════════════════════════════════════════════
   POPUP DE CONQUISTA
   ════════════════════════════════════════════════════════════ */
function wireBadgePopup() {
  document.getElementById('btn-badge-close')?.addEventListener('click', () => {
    document.getElementById('badge-popup-overlay').style.display = 'none';
  });
}

function wireBadgeActions() {
  const grid = document.getElementById('badge-grid');
  if (!grid) return;
  grid.addEventListener('click', (e) => {
    const delBtn = e.target.closest('[data-delete-goal]');
    if (delBtn) { deleteGoal(delBtn.dataset.deleteGoal); return; }
    const btn = e.target.closest('[data-goal-action]');
    if (!btn) return;
    void toggleCustomGoalReward(btn.dataset.goalId);
  });
}

/* ════════════════════════════════════════════════════════════
   ACESSO AO PAINEL DOS PAIS
   ════════════════════════════════════════════════════════════ */
function wireParentPanelAccess() {
  document.getElementById('btn-parent-panel')?.addEventListener('click', () => {
    if (state.config?.skipParentPanelPin) openParentPanel();
    else openPinOverlay('panel');
  });
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('btn-pin-cancel')    ?.addEventListener('click', closePinOverlay);
  document.getElementById('btn-pin-backspace') ?.addEventListener('click', pressPinBackspace);
  document.querySelectorAll('.pin-key[data-digit]').forEach(key => {
    key.addEventListener('click', () => pressPinDigit(key.dataset.digit));
  });
  document.getElementById('btn-parent-panel-close')?.addEventListener('click', closeParentPanel);
}

/* ════════════════════════════════════════════════════════════
   PONTE DE APROVAÇÃO POR PIN
   ════════════════════════════════════════════════════════════ */
function wirePinApprovalBridge() {
  window.addEventListener('gp:request-pin-approve', () => openPinOverlay('approve'));
  window.addEventListener('gp:pin-approved', () => finalizeDay());
}

/* ════════════════════════════════════════════════════════════
   QUICK ACTIONS
   ════════════════════════════════════════════════════════════ */
function wireQuickActionsPopups() {
  document.getElementById('btn-qa-task-confirm')  ?.addEventListener('click', confirmNewTask);
  document.getElementById('btn-qa-task-cancel')   ?.addEventListener('click', closeNewTaskPopup);
  document.getElementById('btn-qa-goal-confirm')  ?.addEventListener('click', confirmNewGoal);
  document.getElementById('btn-qa-goal-cancel')   ?.addEventListener('click', closeNewGoalPopup);
  document.getElementById('btn-qa-member-confirm')?.addEventListener('click', confirmNewMember);
  document.getElementById('btn-qa-member-cancel') ?.addEventListener('click', closeNewMemberPopup);
  document.getElementById('qa-bp-btn-bonus')      ?.addEventListener('click', () => setBonusPenaltyMode('bonus'));
  document.getElementById('qa-bp-btn-penalty')    ?.addEventListener('click', () => setBonusPenaltyMode('penalty'));
  document.getElementById('btn-qa-bp-confirm')    ?.addEventListener('click', confirmBonusPenalty);
  document.getElementById('btn-qa-bp-cancel')     ?.addEventListener('click', closeBonusPenaltyPopup);
}

/* ════════════════════════════════════════════════════════════
   START
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);
