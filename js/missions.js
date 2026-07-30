/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — missions.js
   ════════════════════════════════════════════════════════════
   Regras de negócio: marcar tarefa, checklist de bônus
   (capricho / pontualidade / sem reclamar), finalizar o dia,
   finalizar a semana e desbloquear conquistas.

   Só fala com state.js (estado + persistência), render.js
   (para atualizar a tela depois de mudar algo) e effects.js
   (som/vibração/confete/toast). Não manipula localStorage
   diretamente em nenhum momento.
   ════════════════════════════════════════════════════════════ */

import {
  state, ALL_BADGES, assigneeIds,
  persistWeekState, persistBadges,
  isSelectedDateToday, loadDateContext, shiftDateKey,
} from './state.js';
import { setOccurrenceStatus, clearOccurrenceStatus } from './storage.js';
import { renderMembersBar, renderMissions, renderWeek, renderDashboard, calculateProgress } from './render.js';
import { playSound, vibrate, showToast, showBadgeUnlockPopup, startConfetti } from './effects.js';

/* ════════════════ ESTRELAS: CONCEDER / REVOGAR ════════════════ */
export function awardStars(mission, stars) {
  if (stars <= 0) return;
  assigneeIds(mission).forEach(id => {
    state.memberStars[id] = (state.memberStars[id] || 0) + stars;
    state.totals[id] = (state.totals[id] || 0) + stars;
  });
  state.familyWallet.earned += stars;
  state.familyWallet.balance += stars;
}

export function revokeStars(mission, stars) {
  if (stars <= 0) return;
  assigneeIds(mission).forEach(id => {
    state.memberStars[id] = Math.max(0, (state.memberStars[id] || 0) - stars);
    state.totals[id] = Math.max(0, (state.totals[id] || 0) - stars);
  });
  state.familyWallet.earned = Math.max(0, state.familyWallet.earned - stars);
  state.familyWallet.balance = Math.max(0, state.familyWallet.balance - stars);
}

/* ════════════════ MARCAR / DESMARCAR TAREFA ════════════════ */
export function handleMissionAction(missionId, action) {
  if (!isSelectedDateToday()) return;
  const prev = state.missionStatus[missionId];
  if (action === 'done') {
    if (prev && prev.status === 'done') unmarkMission(missionId);
    else openBonusPopup(missionId);
  } else if (action === 'fail') {
    if (prev && prev.status === 'fail') unmarkMission(missionId);
    else markFail(missionId);
  }
}

function findMission(missionId) {
  return state.missions.find(ms => ms.id === missionId) || null;
}

function markFail(missionId) {
  if (!isSelectedDateToday()) return;
  const mission = findMission(missionId);
  if (!mission) return;
  const prev = state.missionStatus[missionId];
  if (prev && prev.status === 'done' && prev.stars) revokeStars(mission, prev.stars);

  state.missionStatus[missionId] = { status: 'fail', stars: 0 };
  void setOccurrenceStatus(mission, state.missionStatus[missionId]).catch(error => {
    console.error('[missions] falha ao salvar status:', error);
    showToast('Falha ao salvar. Recarregue a página.');
  });
  playSound('fail');
  vibrate([80]);
  renderMembersBar();
  renderMissions();
}

export function unmarkMission(missionId) {
  if (!isSelectedDateToday()) return;
  const mission = findMission(missionId);
  const prev = state.missionStatus[missionId];
  if (!mission || !prev) return;
  if (prev.status === 'done' && prev.stars) revokeStars(mission, prev.stars);

  delete state.missionStatus[missionId];
  void clearOccurrenceStatus(mission).catch(error => {
    console.error('[missions] falha ao limpar status:', error);
    showToast('Falha ao salvar. Recarregue a página.');
  });
  renderMembersBar();
  renderMissions();
}

function setDoneWithBonus(missionId, bonusFlags) {
  if (!isSelectedDateToday()) return;
  const mission = findMission(missionId);
  if (!mission) return;
  const stars = ['capricho', 'pontual', 'semreclamar'].filter(k => bonusFlags[k]).length;

  const prev = state.missionStatus[missionId];
  if (prev && prev.status === 'done' && prev.stars) revokeStars(mission, prev.stars);

  state.missionStatus[missionId] = { status: 'done', stars, bonus: { ...bonusFlags } };
  awardStars(mission, stars);

  void setOccurrenceStatus(mission, state.missionStatus[missionId]).catch(error => {
    console.error('[missions] falha ao salvar status:', error);
    showToast('Falha ao salvar. Recarregue a página.');
  });
  playSound('done');
  vibrate([30, 30, 60]);
  renderMembersBar();
  renderMissions();
  checkAndUnlockBadges();

  if (allMissionsDone()) {
    startConfetti();
    showToast('🏁 TODAS AS TAREFAS CONCLUÍDAS!');
  }
}

function allMissionsDone() {
  return state.missions.length > 0
    && state.missions.every(ms => state.missionStatus[ms.id]?.status === 'done');
}

/* ════════════════ POPUP DE BÔNUS ════════════════ */
export function openBonusPopup(missionId) {
  if (!isSelectedDateToday()) return;
  const mission = findMission(missionId);
  if (!mission) return;
  state.bonusPending = { missionId, capricho: false, pontual: false, semreclamar: false };

  const emojiEl = document.getElementById('bonus-emoji');
  const nameEl = document.getElementById('bonus-mission-name');
  if (emojiEl) emojiEl.textContent = mission.emoji;
  if (nameEl) nameEl.textContent = mission.title;

  renderBonusChecklist();
  const overlay = document.getElementById('bonus-overlay');
  if (overlay) overlay.style.display = 'flex';
}

function renderBonusChecklist() {
  if (!state.bonusPending) return;
  ['capricho', 'pontual', 'semreclamar'].forEach(key => {
    const item = document.getElementById('bci-' + key);
    const box = document.getElementById('bcb-' + key);
    const checked = !!state.bonusPending[key];
    if (item) item.classList.toggle('checked', checked);
    if (box) box.textContent = checked ? '✓' : '';
  });
  const count = ['capricho', 'pontual', 'semreclamar'].filter(k => state.bonusPending[k]).length;
  const preview = document.getElementById('bonus-star-preview');
  if (preview) {
    preview.textContent = count > 0
      ? `⭐ +${count} ESTRELA${count > 1 ? 'S' : ''} PARA O TIME!`
      : 'MARQUE OS CRITÉRIOS ATENDIDOS';
  }
}

export function toggleBonus(key) {
  if (!isSelectedDateToday()) return;
  if (!state.bonusPending) return;
  state.bonusPending[key] = !state.bonusPending[key];
  renderBonusChecklist();
}

export function cancelBonus() {
  state.bonusPending = null;
  const overlay = document.getElementById('bonus-overlay');
  if (overlay) overlay.style.display = 'none';
}

export function confirmBonus() {
  if (!isSelectedDateToday()) return;
  if (!state.bonusPending) return;
  const { missionId, ...flags } = state.bonusPending;
  setDoneWithBonus(missionId, flags);
  state.bonusPending = null;
  const overlay = document.getElementById('bonus-overlay');
  if (overlay) overlay.style.display = 'none';
}

/* ════════════════ FINALIZAR O DIA ════════════════ */
export function tryFinalizeDay() {
  if (!isSelectedDateToday()) return;
  const pending = state.missions.filter(ms => !state.missionStatus[ms.id]);
  if (pending.length > 0) {
    const ok = confirm(`Ainda tem ${pending.length} tarefa(s) sem marcar. Finalizar o dia mesmo assim?`);
    if (!ok) return;
  }
  if (state.config.requireApproval) {
    window.dispatchEvent(new CustomEvent('gp:request-pin-approve'));
  } else {
    finalizeDay();
  }
}

export async function finalizeDay() {
  if (!isSelectedDateToday()) return;
  const currentDate = state.selectedDate || state.today;
  const nextDate = shiftDateKey(currentDate, 1);
  try {
    const { familyPct } = calculateProgress();
    const done = state.missions.filter(mission => state.missionStatus[mission.id]?.status === 'done').length;
    const taskStars = state.missions.reduce(
      (sum, mission) => sum + (state.missionStatus[mission.id]?.status === 'done' ? Number(state.missionStatus[mission.id]?.stars || 0) : 0),
      0
    );
    const manualStars = state.bonusLog
      .filter(event => event.date === currentDate)
      .reduce((sum, event) => sum + Number(event.stars || 0), 0);
    state.weekState.days[currentDate] = {
      done,
      total: state.missions.length,
      pct: familyPct,
      stars: taskStars + manualStars
    };
    await persistWeekState();
    await loadDateContext(nextDate);
    renderDashboard();
    showToast('🏁 DIA ENCERRADO. AGENDA AVANÇADA.');
  } catch (error) {
    console.error('[missions] falha ao avançar dia:', error);
    showToast('Não foi possível abrir o próximo dia.');
  }
}

/* ════════════════ FINALIZAR A SEMANA ════════════════ */
export function tryFinalizeWeek() {
  if (!isSelectedDateToday()) return;
  const daysLogged = Object.keys(state.weekState.days).length;
  if (daysLogged === 0) {
    showToast('AINDA NÃO HÁ NENHUM DIA FINALIZADO NESTA SEMANA');
    return;
  }
  if (state.weekState.finalized) {
    showToast('ESSA SEMANA JÁ FOI FINALIZADA');
    return;
  }
  const ok = confirm(`Finalizar a semana com ${daysLogged} dia(s) registrado(s)?`);
  if (!ok) return;
  finalizeWeek();
}

export function finalizeWeek() {
  if (!isSelectedDateToday()) return;
  state.weekState.finalized = true;
  persistWeekState();
  checkAndUnlockBadges();

  const pcts = Object.values(state.weekState.days).map(d => d.pct);
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  showToast(`🏆 SEMANA FINALIZADA! MÉDIA: ${avg}%`);
  playSound('badge');
  vibrate([40, 40, 40, 80]);
  renderWeek();
}

/* ════════════════ CONQUISTAS (FIXAS + METAS PERSONALIZADAS) ════════════════
   Exportada porque também precisa ser checada depois de um bônus manual
   dado pelo painel dos pais (que não conhece missions.js — ver a ponte
   de eventos 'gp:check-goals' em main.js). */
export function checkAndUnlockBadges() {
  if (!state.badgesUnlocked.includes('primeira-corrida') && Object.keys(state.weekState.days).length >= 1) {
    unlockGoal(ALL_BADGES.find(b => b.id === 'primeira-corrida'));
  }

  const todayInfo = state.weekState.days[state.today];
  if (todayInfo && todayInfo.total > 0 && todayInfo.done === todayInfo.total
    && !state.badgesUnlocked.includes('sem-erros')) {
    unlockGoal(ALL_BADGES.find(b => b.id === 'sem-erros'));
  }

  const totalStarsEver = Object.values(state.totals).reduce((a, b) => a + b, 0);
  if (totalStarsEver >= 10 && !state.badgesUnlocked.includes('capricho-total')) {
    unlockGoal(ALL_BADGES.find(b => b.id === 'capricho-total'));
  }

  if (state.weekState.finalized && Object.keys(state.weekState.days).length >= 7
    && !state.badgesUnlocked.includes('semana-completa')) {
    unlockGoal(ALL_BADGES.find(b => b.id === 'semana-completa'));
  }

}

function unlockGoal(goal) {
  if (!goal || state.badgesUnlocked.includes(goal.id)) return;
  state.badgesUnlocked.push(goal.id);
  persistBadges();
  showBadgeUnlockPopup(goal);
}
