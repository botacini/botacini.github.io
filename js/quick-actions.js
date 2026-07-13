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
   1. NOVA TAREFA / EDITAR TAREFA
   ════════════════════════════════════════════════════════════ */
let _newTaskMemberId = null;
let _editTaskId = null;      // null = modo criação; string = modo edição
let _editTaskSourceDow = null; // dia de origem da tarefa editada

/**
 * Abre popup no modo criação (memberId obrigatório) ou edição (mission obrigatório).
 * Chamada de criação:  openNewTaskPopup(memberId, null, dateKey)
 * Chamada de edição:   openNewTaskPopup(memberId, mission)
 */
export function openNewTaskPopup(memberId, missionToEdit, targetDateKey) {
  _newTaskMemberId = memberId;
  _editTaskId = missionToEdit ? missionToEdit.id : null;

  const member = state.config.members.find(m => m.id === memberId);
  const labelEl = document.getElementById('qa-task-member-label');
  const confirmBtn = document.getElementById('btn-qa-task-confirm');
  const editIdEl = document.getElementById('qa-task-edit-id');

  if (missionToEdit) {
    // ── MODO EDIÇÃO ──────────────────────────────────────
    if (labelEl) labelEl.textContent = `EDITAR TAREFA${member ? ` DE ${member.name}` : ''}`;
    if (confirmBtn) confirmBtn.textContent = 'ATUALIZAR ✓';
    if (editIdEl) editIdEl.value = missionToEdit.id;

    // Descobre em quais dias esta tarefa já existe (pelo id)
    const existingDows = [];
    for (let d = 0; d < 7; d++) {
      if ((state.config.missionsByDay[d] || []).some(m => m.id === missionToEdit.id)) {
        existingDows.push(d);
        if (_editTaskSourceDow === null) _editTaskSourceDow = d;
      }
    }
    // Descobre o dia de origem pelo dateKey ou pelo primeiro dow encontrado
    const originDow = targetDateKey
      ? dateFromKey(targetDateKey).getDay()
      : (existingDows[0] ?? currentDow());
    _editTaskSourceDow = originDow;

    document.getElementById('qa-task-name').value = missionToEdit.title || '';
    document.getElementById('qa-task-start').value = missionToEdit.start || '08:00';
    document.getElementById('qa-task-end').value = missionToEdit.end || '08:30';
    document.getElementById('qa-task-emoji').value = missionToEdit.emoji || '⭐';

    // Marca os dias onde a tarefa já existe
    document.querySelectorAll('.qa-day-checkbox').forEach(cb => {
      cb.checked = existingDows.includes(Number(cb.value));
    });
  } else {
    // ── MODO CRIAÇÃO ─────────────────────────────────────
    _editTaskSourceDow = null;
    if (labelEl) labelEl.textContent = member ? `TAREFA PARA ${member.name}` : 'NOVA TAREFA';
    if (confirmBtn) confirmBtn.textContent = 'SALVAR ✓';
    if (editIdEl) editIdEl.value = '';

    document.getElementById('qa-task-name').value = '';
    document.getElementById('qa-task-start').value = '08:00';
    document.getElementById('qa-task-end').value = '08:30';
    document.getElementById('qa-task-emoji').value = '⭐';

    // Marca o dia do dateKey fornecido (pode ser dia passado/futuro)
    const dow = targetDateKey ? dateFromKey(targetDateKey).getDay() : currentDow();
    document.querySelectorAll('.qa-day-checkbox').forEach(cb => {
      cb.checked = Number(cb.value) === dow;
    });
  }

  overlayShow('qa-task-overlay');
  document.getElementById('qa-task-name')?.focus();
}

export function closeNewTaskPopup() {
  overlayHide('qa-task-overlay');
  _newTaskMemberId = null;
  _editTaskId = null;
  _editTaskSourceDow = null;
}

export async function confirmNewTask() {
  const name = document.getElementById('qa-task-name')?.value.trim() || '';
  if (!name) { alert('Digite o nome da tarefa.'); return; }

  const start  = document.getElementById('qa-task-start')?.value  || '08:00';
  const end    = document.getElementById('qa-task-end')?.value    || '08:30';
  const emoji  = document.getElementById('qa-task-emoji')?.value  || '⭐';
  const editId = document.getElementById('qa-task-edit-id')?.value || '';

  const selectedDays = Array.from(document.querySelectorAll('.qa-day-checkbox:checked'))
    .map(cb => Number(cb.value));
  const daysToUse = selectedDays.length > 0 ? selectedDays : [currentDow()];

  if (editId) {
    // ── MODO EDIÇÃO ──────────────────────────────────────
    // Para cada dia marcado: atualiza a missão se existir lá, ou adiciona nova cópia
    // Para dias NÃO marcados onde ela existia: remove
    for (let d = 0; d < 7; d++) {
      const list = state.config.missionsByDay[d] || [];
      const idx = list.findIndex(m => m.id === editId);
      if (daysToUse.includes(d)) {
        if (idx >= 0) {
          // Atualiza no lugar
          list[idx] = { ...list[idx], start, end, emoji, title: name.toUpperCase() };
        } else {
          // Adiciona neste dia (nova cópia com id novo, exceto no dia de origem)
          list.push({
            id: d === _editTaskSourceDow ? editId : genId('ms'),
            start, end, emoji,
            title: name.toUpperCase(),
            desc: list.find(m => m.id === editId)?.desc || '',
            assignee: _newTaskMemberId,
          });
          state.config.missionsByDay[d] = list;
        }
        list.sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
      } else if (idx >= 0) {
        // Remove dos dias desmarcados
        list.splice(idx, 1);
        state.config.missionsByDay[d] = list;
      }
    }
    showToast('✏️ Tarefa atualizada.');
  } else {
    // ── MODO CRIAÇÃO ─────────────────────────────────────
    daysToUse.forEach(dow => {
      state.config.missionsByDay[dow] = state.config.missionsByDay[dow] || [];
      state.config.missionsByDay[dow].push({
        id: genId('ms'),
        start, end, emoji,
        title: name.toUpperCase(),
        desc: '',
        assignee: _newTaskMemberId,
      });
      state.config.missionsByDay[dow].sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
    });
  }

  await commitMissionsChange();
  closeNewTaskPopup();
  renderDashboard();
}

/**
 * Abre o popup no modo edição a partir de um missionId e do dateKey do dia exibido.
 */
export function openEditTaskPopup(missionId, dateKey) {
  const dow = dateFromKey(dateKey || state.selectedDate || state.today || todayKey()).getDay();
  const mission = (state.config.missionsByDay[dow] || []).find(m => m.id === missionId);
  if (!mission) return;

  // Determina o memberId: assignee pode ser string, array ou 'compartilhada'
  let memberId = null;
  if (mission.assignee !== 'compartilhada') {
    memberId = Array.isArray(mission.assignee) ? mission.assignee[0] : mission.assignee;
  }

  openNewTaskPopup(memberId, mission, dateKey);
}

export async function deleteTask(missionId) {
  if (!confirm('Remover esta tarefa?')) return;

  // Busca a missão no dia atualmente exibido
  const dow = dateFromKey(state.selectedDate || state.today || todayKey()).getDay();
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

  // Remove apenas do dia exibido (tarefa pode existir em outros dias)
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
