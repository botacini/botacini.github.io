/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — quick-actions.js
   ════════════════════════════════════════════════════════════
   Popups rápidos para criar/remover tarefas, conquistas e
   membros sem abrir o Painel dos Pais. Não duplica regras de
   negócio — reutiliza funções de state.js e missions.js.
   ════════════════════════════════════════════════════════════ */

import {
  state, saveConfig, getTodayMissions, persistDayState, persistTotals,
  timeToMin, nextMemberColor, dateFromKey, todayKey, persistBonusLog,
} from './state.js';
import { renderDashboard, renderMissions, renderTeamTab, renderBadges } from './render.js';
import { revokeStars, awardStars } from './missions.js';
import { showToast } from './effects.js';

/* ════════════════ UTILITÁRIOS INTERNOS ════════════════ */
function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function currentDow() {
  return dateFromKey(state.selectedDate || state.today || todayKey()).getDay();
}

function overlayShow(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function overlayHide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

/* ════════════════ COMMIT MISSIONS ════════════════ */
async function commitMissionsChange() {
  const oldMissions = [...state.missions];
  await saveConfig();
  state.missions = getTodayMissions();
  const newIds = new Set(state.missions.map(m => m.id));
  let changed = false;
  for (const old of oldMissions) {
    if (newIds.has(old.id)) continue;
    const st = state.missionStatus[old.id];
    if (!st) continue;
    if (st.status === 'done' && st.stars) {
      const ids = old.assignee === 'compartilhada'
        ? state.config.members.map(m => m.id)
        : Array.isArray(old.assignee) ? old.assignee : [old.assignee];
      ids.forEach(id => {
        state.memberStars[id] = Math.max(0, (state.memberStars[id] || 0) - st.stars);
        state.totals[id] = Math.max(0, (state.totals[id] || 0) - st.stars);
      });
    }
    delete state.missionStatus[old.id];
    changed = true;
  }
  if (changed) {
    await persistDayState();
    await persistTotals();
  }
}

/* ════════════════════════════════════════════════════════════
   1. NOVA TAREFA
   ════════════════════════════════════════════════════════════ */
let _newTaskMemberId = null;

export function openNewTaskPopup(memberId) {
  _newTaskMemberId = memberId;
  const member = state.config.members.find(m => m.id === memberId);
  const labelEl = document.getElementById('qa-task-member-label');
  if (labelEl) labelEl.textContent = member ? `TAREFA PARA ${member.name}` : 'NOVA TAREFA';

  const nameEl = document.getElementById('qa-task-name');
  const startEl = document.getElementById('qa-task-start');
  const endEl = document.getElementById('qa-task-end');
  if (nameEl) nameEl.value = '';
  if (startEl) startEl.value = '08:00';
  if (endEl) endEl.value = '08:30';

  // Marca o dia atual como selecionado nos checkboxes
  const dow = currentDow();
  document.querySelectorAll('.qa-day-checkbox').forEach(cb => {
    cb.checked = Number(cb.value) === dow;
  });

  overlayShow('qa-task-overlay');
  if (nameEl) nameEl.focus();
}

export function closeNewTaskPopup() {
  overlayHide('qa-task-overlay');
  _newTaskMemberId = null;
}

export async function confirmNewTask() {
  const nameEl = document.getElementById('qa-task-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { alert('Digite o nome da tarefa.'); return; }

  const start = document.getElementById('qa-task-start')?.value || '08:00';
  const end = document.getElementById('qa-task-end')?.value || '08:30';

  // Coleta dias selecionados (frontend only — backend mantém estrutura atual)
  const selectedDays = Array.from(document.querySelectorAll('.qa-day-checkbox:checked'))
    .map(cb => Number(cb.value));

  // Garante ao menos o dia atual se nenhum foi marcado
  const daysToAdd = selectedDays.length > 0 ? selectedDays : [currentDow()];

  daysToAdd.forEach(dow => {
    state.config.missionsByDay[dow] = state.config.missionsByDay[dow] || [];
    state.config.missionsByDay[dow].push({
      id: genId('ms'),
      start,
      end,
      emoji: '⭐',
      title: name.toUpperCase(),
      desc: '',
      assignee: _newTaskMemberId,
    });
    state.config.missionsByDay[dow].sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  });

  await commitMissionsChange();
  closeNewTaskPopup();
  renderDashboard();
}

export async function deleteTask(missionId) {
  if (!confirm('Remover esta tarefa?')) return;
  const dow = currentDow();
  const mission = (state.config.missionsByDay[dow] || []).find(m => m.id === missionId);

  if (mission) {
    const st = state.missionStatus[missionId];
    if (st && st.status === 'done' && st.stars > 0) {
      revokeStars(mission, st.stars);
      delete state.missionStatus[missionId];
      await persistDayState();
      await persistTotals();
    }
  }

  state.config.missionsByDay[dow] = (state.config.missionsByDay[dow] || []).filter(m => m.id !== missionId);
  await saveConfig();
  state.missions = getTodayMissions();
  renderDashboard();
  showToast('🗑️ Tarefa removida.');
}

/* ════════════════════════════════════════════════════════════
   2. NOVA CONQUISTA
   ════════════════════════════════════════════════════════════ */
export function openNewGoalPopup() {
  const nameEl = document.getElementById('qa-goal-name');
  const iconEl = document.getElementById('qa-goal-icon');
  const targetEl = document.getElementById('qa-goal-target');
  if (nameEl) nameEl.value = '';
  if (iconEl) iconEl.value = '🏆';
  if (targetEl) targetEl.value = '50';

  overlayShow('qa-goal-overlay');
  if (nameEl) nameEl.focus();
}

export function closeNewGoalPopup() {
  overlayHide('qa-goal-overlay');
}

export async function confirmNewGoal() {
  const nameEl = document.getElementById('qa-goal-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { alert('Digite o nome da conquista.'); return; }

  const icon = document.getElementById('qa-goal-icon')?.value || '🏆';
  const target = Math.max(1, parseInt(document.getElementById('qa-goal-target')?.value || '50', 10));

  state.config.customGoals = state.config.customGoals || [];
  state.config.customGoals.push({
    id: genId('goal'),
    type: 'family_stars',
    memberId: null,
    icon,
    name: name.toUpperCase(),
    target,
    desc: 'Meta personalizada',
    redeemed: false,
    claimedStars: 0,
  });

  await saveConfig();
  closeNewGoalPopup();
  renderBadges();
}

export async function deleteGoal(goalId) {
  if (!confirm('Remover esta conquista?')) return;
  const goal = (state.config.customGoals || []).find(g => g.id === goalId);

  if (goal && goal.redeemed) {
    const rewardStars = Number(goal.claimedStars || goal.target || 0);
    if (rewardStars > 0) {
      revokeStars({ assignee: goal.type === 'member_stars' ? goal.memberId : 'compartilhada' }, rewardStars);
      await persistDayState();
      await persistTotals();
    }
  }

  state.config.customGoals = (state.config.customGoals || []).filter(g => g.id !== goalId);
  await saveConfig();
  renderBadges();
  renderMissions();
  showToast('🗑️ Conquista removida.');
}

/* ════════════════════════════════════════════════════════════
   3. NOVO MEMBRO
   ════════════════════════════════════════════════════════════ */
export function openNewMemberPopup() {
  const nameEl = document.getElementById('qa-member-name');
  const avatarEl = document.getElementById('qa-member-avatar');
  const roleEl = document.getElementById('qa-member-role');
  if (nameEl) nameEl.value = '';
  if (avatarEl) avatarEl.value = '🧒';
  if (roleEl) roleEl.value = 'crianca';

  overlayShow('qa-member-overlay');
  if (nameEl) nameEl.focus();
}

export function closeNewMemberPopup() {
  overlayHide('qa-member-overlay');
}

export async function confirmNewMember() {
  const nameEl = document.getElementById('qa-member-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { alert('Digite o nome do membro.'); return; }

  const avatar = document.getElementById('qa-member-avatar')?.value || '🧒';
  const role = document.getElementById('qa-member-role')?.value || 'crianca';
  const id = genId('mem');
  const color = nextMemberColor(state.config.members);

  state.config.members.push({ id, name: name.toUpperCase(), avatar, role, color });
  state.memberStars[id] = 0;

  await saveConfig();
  await persistDayState();
  closeNewMemberPopup();
  renderDashboard();
}

/* ════════════════════════════════════════════════════════════
   4. BÔNUS / PENALIDADE
   ════════════════════════════════════════════════════════════ */

// 'bonus' | 'penalty'
let _bonusPenaltyMode = 'bonus';

export function openBonusPenaltyPopup() {
  _bonusPenaltyMode = 'bonus';

  // Popula o select de membros
  const memberSelect = document.getElementById('qa-bp-member');
  if (memberSelect) {
    memberSelect.innerHTML = `<option value="">— Escolha um membro —</option>` +
      state.config.members.map(m =>
        `<option value="${m.id}">${m.avatar} ${m.name}</option>`
      ).join('');
  }

  // Reseta campos
  const starsEl = document.getElementById('qa-bp-stars');
  const reasonEl = document.getElementById('qa-bp-reason');
  if (starsEl) starsEl.value = '1';
  if (reasonEl) reasonEl.value = '';

  // Reseta botões de modo
  _updateBonusPenaltyModeUI();

  overlayShow('qa-bp-overlay');
  if (memberSelect) memberSelect.focus();
}

export function closeBonusPenaltyPopup() {
  overlayHide('qa-bp-overlay');
}

export function setBonusPenaltyMode(mode) {
  _bonusPenaltyMode = mode;
  _updateBonusPenaltyModeUI();
}

function _updateBonusPenaltyModeUI() {
  const bonusBtn = document.getElementById('qa-bp-btn-bonus');
  const penaltyBtn = document.getElementById('qa-bp-btn-penalty');
  if (bonusBtn) {
    bonusBtn.classList.toggle('active-bonus', _bonusPenaltyMode === 'bonus');
    bonusBtn.classList.remove('active-penalty');
  }
  if (penaltyBtn) {
    penaltyBtn.classList.toggle('active-penalty', _bonusPenaltyMode === 'penalty');
    penaltyBtn.classList.remove('active-bonus');
  }

  // Atualiza label e cor do botão confirmar
  const confirmBtn = document.getElementById('btn-qa-bp-confirm');
  if (confirmBtn) {
    if (_bonusPenaltyMode === 'bonus') {
      confirmBtn.textContent = '✨ CONCEDER BÔNUS';
      confirmBtn.style.background = 'var(--green)';
      confirmBtn.style.color = '#06280a';
    } else {
      confirmBtn.textContent = '⚡ APLICAR PENALIDADE';
      confirmBtn.style.background = 'var(--red)';
      confirmBtn.style.color = '#fff';
    }
  }
}

export async function confirmBonusPenalty() {
  const memberId = document.getElementById('qa-bp-member')?.value;
  const starsVal = Number(document.getElementById('qa-bp-stars')?.value || 1);
  const reason = document.getElementById('qa-bp-reason')?.value.trim() || '';

  if (!memberId) { alert('Escolha um membro.'); return; }
  if (starsVal < 1) { alert('Mínimo 1 estrela.'); return; }
  if (!reason) { alert('Descreva o motivo.'); return; }

  const member = state.config.members.find(m => m.id === memberId);

  if (_bonusPenaltyMode === 'bonus') {
    // Concede estrelas
    state.memberStars[memberId] = (state.memberStars[memberId] || 0) + starsVal;
    state.totals[memberId] = (state.totals[memberId] || 0) + starsVal;

    // Registra no histórico
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    state.bonusLog = state.bonusLog || [];
    state.bonusLog.push({
      date: dateKey,
      memberId,
      stars: starsVal,
      reason,
      type: 'bonus',
      timestamp: new Date().toISOString(),
    });

    await persistDayState();
    await persistTotals();
    await persistBonusLog();

    showToast(`✨ +${starsVal} ⭐ para ${member?.name || memberId}!`);
  } else {
    // Aplica penalidade
    const current = state.memberStars[memberId] || 0;
    const deduct = Math.min(starsVal, current); // não vai abaixo de zero
    state.memberStars[memberId] = current - deduct;
    state.totals[memberId] = Math.max(0, (state.totals[memberId] || 0) - deduct);

    // Registra no histórico
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    state.bonusLog = state.bonusLog || [];
    state.bonusLog.push({
      date: dateKey,
      memberId,
      stars: -deduct,
      reason,
      type: 'penalty',
      timestamp: new Date().toISOString(),
    });

    await persistDayState();
    await persistTotals();
    await persistBonusLog();

    showToast(`⚡ -${deduct} ⭐ de ${member?.name || memberId}.`);
  }

  closeBonusPenaltyPopup();
  renderDashboard();
}
