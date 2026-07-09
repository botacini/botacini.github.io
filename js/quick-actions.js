/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — quick-actions.js
   ════════════════════════════════════════════════════════════
   Popups rápidos para criar/remover tarefas, conquistas e
   membros sem abrir o Painel dos Pais. Não duplica regras de
   negócio — reutiliza funções de state.js e missions.js.
   ════════════════════════════════════════════════════════════ */

import {
  state, saveConfig, getTodayMissions, persistDayState, persistTotals,
  timeToMin, nextMemberColor, dateFromKey, todayKey,
} from './state.js';
import { renderDashboard, renderMissions, renderTeamTab, renderBadges } from './render.js';
import { revokeStars } from './missions.js';
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
  const dow = currentDow();

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
