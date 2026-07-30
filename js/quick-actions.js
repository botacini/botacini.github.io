import {
  state, saveConfig, loadDateContext, nextMemberColor, dateFromKey, todayKey,
  TASK_CATEGORIES, taskCategoryFromDescription, taskDescriptionWithCategory
} from './state.js';
import {
  createTaskWithSchedule, updateTaskSeries, splitTaskScheduleForFuture,
  setOccurrenceOverride, deleteTaskSchedule, createFamilyMember,
  createCustomGoal, deleteCustomGoal, addManualStarEvent, findTaskScheduleConflict
} from './storage.js';
import { renderDashboard, renderTeamTab, renderBadges } from './render.js';
import { showToast } from './effects.js';

let newTaskMemberId = null;
let editingMission = null;
let bonusPenaltyMode = 'bonus';

function selectedDate() { return state.selectedDate || state.today || todayKey(); }
function selectedDow() { return dateFromKey(selectedDate()).getDay(); }
function show(id) { const element = document.getElementById(id); if (element) element.style.display = 'flex'; }
function hide(id) { const element = document.getElementById(id); if (element) element.style.display = 'none'; }
function setValue(id, value) { const element = document.getElementById(id); if (element) element.value = value ?? ''; }
function selectedDays() {
  return Array.from(document.querySelectorAll('.qa-day-checkbox:checked')).map(input => Number(input.value));
}
function taskPayload() {
  const category = document.getElementById('qa-task-category')?.value || 'outros';
  return {
    title: document.getElementById('qa-task-name')?.value.trim() || '',
    start: document.getElementById('qa-task-start')?.value || '08:00',
    end: document.getElementById('qa-task-end')?.value || '08:30',
    emoji: document.getElementById('qa-task-emoji')?.value || '⭐',
    description: taskDescriptionWithCategory(category)
  };
}
function schedulePayload() {
  const type = document.getElementById('qa-task-schedule-type')?.value || 'weekly';
  const date = document.getElementById('qa-task-date')?.value || selectedDate();
  return type === 'once'
    ? { type: 'once', date }
    : { type: 'weekly', startDate: date || null, endDate: null, weekdays: selectedDays().length ? selectedDays() : [selectedDow()] };
}
function occurrencePatch(task) {
  return { title: task.title.toUpperCase(), start: task.start, end: task.end, emoji: task.emoji, description: task.description || '' };
}

function renderAssigneeOptions(selectedIds, primaryId) {
  const container = document.getElementById('qa-task-assignees');
  if (!container) return;
  const selected = new Set(selectedIds || []);
  if (primaryId) selected.add(primaryId);
  container.replaceChildren(...state.config.members.map(member => {
    const label = document.createElement('label');
    label.className = 'qa-assignee-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'qa-assignee-checkbox';
    input.value = member.id;
    input.checked = selected.has(member.id);
    input.disabled = member.id === primaryId;
    const avatar = document.createElement('span');
    avatar.className = 'qa-assignee-avatar';
    avatar.textContent = member.avatar || '👤';
    const name = document.createElement('span');
    name.className = 'qa-assignee-name';
    name.textContent = member.name;
    const role = document.createElement('span');
    role.className = 'qa-assignee-role';
    role.textContent = member.id === primaryId ? 'RESPONSÁVEL' : 'PARTICIPANTE';
    label.append(input, avatar, name, role);
    return label;
  }));
}

function renderCategoryOptions(selectedId = 'outros') {
  const select = document.getElementById('qa-task-category');
  if (!select) return;
  select.replaceChildren(...TASK_CATEGORIES.map(category => {
    const option = new Option(category.name, category.id);
    option.dataset.color = category.color;
    return option;
  }));
  select.value = selectedId;
}

function selectedAssigneeIds() {
  return Array.from(document.querySelectorAll('.qa-assignee-checkbox:checked')).map(input => input.value);
}

function isFiveMinuteTime(value) {
  const parts = String(value).split(':').map(Number);
  return parts.length === 2 && Number.isInteger(parts[0]) && Number.isInteger(parts[1])
    && parts[0] >= 0 && parts[0] <= 23 && parts[1] >= 0 && parts[1] < 60 && parts[1] % 5 === 0;
}

export function openNewTaskPopup(memberId, missionToEdit = null, targetDateKey = null) {
  newTaskMemberId = memberId;
  editingMission = missionToEdit;
  const date = missionToEdit?.schedule?.date || missionToEdit?.schedule?.startDate || targetDateKey || missionToEdit?.date || selectedDate();
  const scope = document.getElementById('qa-task-edit-scope');
  const confirm = document.getElementById('btn-qa-task-confirm');
  const label = document.getElementById('qa-task-member-label');
  const isEdit = !!missionToEdit;

  if (label) label.textContent = isEdit ? 'EDITAR TAREFA' : 'NOVA TAREFA';
  if (confirm) confirm.textContent = isEdit ? 'ATUALIZAR ✓' : 'SALVAR ✓';
  if (scope) scope.style.display = isEdit ? 'block' : 'none';
  setValue('qa-task-edit-id', missionToEdit?.id || '');
  setValue('qa-task-name', missionToEdit?.title || '');
  setValue('qa-task-start', missionToEdit?.start || '08:00');
  setValue('qa-task-end', missionToEdit?.end || '08:30');
  setValue('qa-task-emoji', missionToEdit?.emoji || '⭐');
  renderCategoryOptions(taskCategoryFromDescription(missionToEdit?.desc));
  setValue('qa-task-date', date);
  setValue('qa-task-schedule-type', missionToEdit?.schedule?.type || 'weekly');
  setValue('qa-task-edit-scope', 'series');
  const weeklyDays = missionToEdit?.schedule?.weekdays || [dateFromKey(date).getDay()];
  document.querySelectorAll('.qa-day-checkbox').forEach(input => { input.checked = weeklyDays.includes(Number(input.value)); });
  renderAssigneeOptions(missionToEdit?.assignee || [memberId], missionToEdit?.assignee?.[0] || memberId);
  show('qa-task-overlay');
  document.getElementById('qa-task-name')?.focus();
}

export function closeNewTaskPopup() {
  hide('qa-task-overlay');
  newTaskMemberId = null;
  editingMission = null;
}

export async function confirmNewTask() {
  const task = taskPayload();
  if (!task.title) { alert('Digite o nome da tarefa.'); return; }
  if (!isFiveMinuteTime(task.start) || !isFiveMinuteTime(task.end)) {
    alert('Use horários em intervalos de 5 minutos.');
    return;
  }
  if (task.end <= task.start) { alert('O horário final deve ser após o inicial.'); return; }
  const schedule = schedulePayload();
  try {
    const assigneeIds = selectedAssigneeIds();
    if (!assigneeIds.length) {
      alert('Selecione ao menos um participante.');
      return;
    }
    const validationSchedule = editingMission
      && document.getElementById('qa-task-edit-scope')?.value === 'occurrence'
      ? { type: 'once', date: editingMission.date }
      : schedule;
    const conflictTitle = await findTaskScheduleConflict(
      task, validationSchedule, assigneeIds, editingMission?.scheduleId || null
    );
    if (conflictTitle) {
      alert(`Conflito de horário: a tarefa "${conflictTitle}" já ocupa este horário.`);
      return;
    }
    if (!editingMission) {
      await createTaskWithSchedule(task, schedule, assigneeIds);
      showToast('✓ Tarefa criada.');
    } else {
      const scope = document.getElementById('qa-task-edit-scope')?.value || 'series';
      if (scope === 'occurrence') {
        const assigneesChanged = assigneeIds.length !== editingMission.assignee.length
          || assigneeIds.some(id => !editingMission.assignee.includes(id));
        if (assigneesChanged) {
          alert('Para alterar participantes, edite a série ou esta e as próximas ocorrências.');
          return;
        }
        await setOccurrenceOverride(editingMission.scheduleId, editingMission.date, 'override', occurrencePatch(task));
      } else if (scope === 'future') {
        if (editingMission.schedule?.type !== 'weekly') {
          alert('Uma tarefa de data única não possui próximas ocorrências.');
          return;
        }
        await splitTaskScheduleForFuture(editingMission.scheduleId, editingMission.date, task, schedule, assigneeIds);
      } else {
        await updateTaskSeries(editingMission.taskId, editingMission.scheduleId, task, schedule, assigneeIds);
      }
      showToast('✏️ Tarefa atualizada.');
    }
    await loadDateContext(selectedDate());
    closeNewTaskPopup();
    renderDashboard();
  } catch (error) {
    alert(error.message || 'Não foi possível salvar a tarefa.');
  }
}

export function openEditTaskPopup(missionId, dateKey) {
  const mission = state.missions.find(item => item.id === missionId);
  if (!mission) return;
  openNewTaskPopup(mission.assignee[0] || null, mission, dateKey || mission.date);
}

// A remoção individual cria apenas uma exceção skip. O scheduleId permanece
// estável, mantendo edição e exclusão disponíveis nas demais ocorrências.
export async function deleteTask(missionId, scope = 'series') {
  const mission = state.missions.find(item => item.id === missionId);
  if (!mission) return;
  const message = scope === 'occurrence' ? 'Remover somente esta ocorrência?' : 'Remover toda a série desta tarefa?';
  if (!confirm(message)) return;
  try {
    if (scope === 'occurrence') await setOccurrenceOverride(mission.scheduleId, mission.date, 'skip');
    else await deleteTaskSchedule(mission.scheduleId);
    await loadDateContext(selectedDate());
    renderDashboard();
    showToast('🗑️ Tarefa removida.');
  } catch (error) {
    alert(error.message || 'Não foi possível remover a tarefa.');
  }
}

export function openNewGoalPopup() {
  setValue('qa-goal-name', ''); setValue('qa-goal-icon', '🏆'); setValue('qa-goal-target', 50); show('qa-goal-overlay');
}
export function closeNewGoalPopup() { hide('qa-goal-overlay'); }
export async function confirmNewGoal() {
  const name = document.getElementById('qa-goal-name')?.value.trim() || '';
  const target = Number(document.getElementById('qa-goal-target')?.value || 0);
  if (!name || target < 1) { alert('Informe nome e meta válida.'); return; }
  try {
    const goal = await createCustomGoal({ name, target, icon: document.getElementById('qa-goal-icon')?.value || '🏆' });
    state.config.customGoals.push({ id: goal.id, type: goal.goal_type, memberId: goal.member_id, icon: goal.icon, name: goal.name, target: goal.target, desc: goal.description, redeemed: goal.redeemed, claimedStars: goal.claimed_stars });
    closeNewGoalPopup(); renderBadges(); showToast('🏆 Meta criada.');
  } catch (error) { alert(error.message || 'Não foi possível criar a meta.'); }
}
export async function deleteGoal(goalId) {
  if (!confirm('Remover esta meta?')) return;
  try {
    await deleteCustomGoal(goalId);
    state.config.customGoals = state.config.customGoals.filter(goal => goal.id !== goalId);
    renderBadges();
  } catch (error) { alert(error.message || 'Não foi possível remover a meta.'); }
}

export function openNewMemberPopup() { setValue('qa-member-name', ''); setValue('qa-member-avatar', '🧒'); setValue('qa-member-role', 'crianca'); show('qa-member-overlay'); }
export function closeNewMemberPopup() { hide('qa-member-overlay'); }
export async function confirmNewMember() {
  const name = document.getElementById('qa-member-name')?.value.trim() || '';
  if (!name) { alert('Digite o nome.'); return; }
  try {
    const member = await createFamilyMember({ name: name.toUpperCase(), avatar: document.getElementById('qa-member-avatar')?.value || '🧒', role: document.getElementById('qa-member-role')?.value || 'crianca', color: nextMemberColor(state.config.members) });
    state.config.members.push(member);
    state.memberStars[member.id] = 0;
    closeNewMemberPopup(); renderTeamTab(); renderDashboard(); showToast('👤 Membro adicionado.');
  } catch (error) { alert(error.message || 'Não foi possível criar o membro.'); }
}

export function openBonusPenaltyPopup() {
  const select = document.getElementById('qa-bp-member');
  if (select) {
    select.replaceChildren(new Option('— Escolha um membro —', ''));
    state.config.members.forEach(member => {
      select.appendChild(new Option(`${member.avatar || ''} ${member.name || ''}`.trim(), member.id));
    });
  }
  setValue('qa-bp-stars', 1); setValue('qa-bp-reason', ''); bonusPenaltyMode = 'bonus'; updateBonusPenaltyModeUI(); show('qa-bp-overlay');
}
export function closeBonusPenaltyPopup() { hide('qa-bp-overlay'); }
export function setBonusPenaltyMode(mode) { bonusPenaltyMode = mode; updateBonusPenaltyModeUI(); }
function updateBonusPenaltyModeUI() {
  const bonus = document.getElementById('qa-bp-btn-bonus'); const penalty = document.getElementById('qa-bp-btn-penalty');
  const confirm = document.getElementById('btn-qa-bp-confirm');
  const isPenalty = bonusPenaltyMode === 'penalty';
  bonus?.classList.toggle('active-bonus', !isPenalty);
  penalty?.classList.toggle('active-penalty', isPenalty);
  confirm?.classList.toggle('bonus-mode', !isPenalty);
  confirm?.classList.toggle('penalty-mode', isPenalty);
  if (confirm) confirm.textContent = isPenalty ? '⚡ APLICAR PENALIDADE' : '✨ CONCEDER BÔNUS';
}
export async function confirmBonusPenalty() {
  const memberId = document.getElementById('qa-bp-member')?.value;
  const value = Number(document.getElementById('qa-bp-stars')?.value || 0);
  const reason = document.getElementById('qa-bp-reason')?.value.trim() || '';
  if (!memberId || value < 1 || !reason) { alert('Preencha membro, estrelas e motivo.'); return; }
  try {
    await addManualStarEvent({ memberId, date: selectedDate(), stars: bonusPenaltyMode === 'bonus' ? value : -value, reason });
    await loadDateContext(selectedDate());
    closeBonusPenaltyPopup(); renderDashboard(); showToast('⭐ Bônus atualizado.');
  } catch (error) { alert(error.message || 'Não foi possível registrar o bônus.'); }
}
