import { state, saveConfig, loadDateContext, nextMemberColor, todayKey } from './state.js';
import {
  createFamilyMember, updateFamilyMember, deleteFamilyMember,
  updateCustomGoal, deleteCustomGoal, addManualStarEvent, deleteManualStarEventsBySource,
  exportAllData, importAllData, resetAllData
} from './storage.js';
import { getSession } from './auth.js';
import { renderDashboard } from './render.js';
import { checkAndUnlockBadges } from './missions.js';

let activeSubTab = 'membros';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function openPinOverlay(mode) {
  state.pinMode = mode;
  state.pinBuffer = '';
  const title = document.getElementById('pin-title');
  if (title) title.textContent = mode === 'approve' ? 'PIN DOS PAIS PARA APROVAR' : 'PIN DOS PAIS';
  renderPinDots();
  document.getElementById('pin-overlay').style.display = 'flex';
}

export function closePinOverlay() {
  state.pinBuffer = '';
  document.getElementById('pin-overlay').style.display = 'none';
}

function renderPinDots() {
  const dots = document.getElementById('pin-dots');
  if (!dots) return;
  const length = String(state.config?.pin || '1234').length;
  dots.innerHTML = Array.from({ length }, (_, index) => `<span class="pin-dot${index < state.pinBuffer.length ? ' filled' : ''}"></span>`).join('');
}

export function pressPinDigit(digit) {
  const pin = String(state.config?.pin || '1234');
  if (state.pinBuffer.length >= pin.length) return;
  state.pinBuffer += String(digit);
  renderPinDots();
  if (state.pinBuffer.length !== pin.length) return;
  if (state.pinBuffer === pin) {
    const mode = state.pinMode;
    closePinOverlay();
    if (mode === 'panel') openParentPanel();
    if (mode === 'approve') window.dispatchEvent(new CustomEvent('gp:pin-approved'));
    return;
  }
  const dots = document.getElementById('pin-dots');
  dots?.classList.add('pin-error');
  setTimeout(() => { dots?.classList.remove('pin-error'); state.pinBuffer = ''; renderPinDots(); }, 380);
}

export function pressPinBackspace() {
  state.pinBuffer = state.pinBuffer.slice(0, -1);
  renderPinDots();
}

export function openParentPanel() { openParentPanelOnTab('membros'); }
export function openParentPanelOnTab(tab) {
  activeSubTab = tab;
  renderParentPanel();
  document.getElementById('parent-panel-overlay').style.display = 'flex';
}
export function closeParentPanel() { document.getElementById('parent-panel-overlay').style.display = 'none'; }

function membrosHTML() {
  return `
    <div class="pp-section-title">FAMÍLIA (${state.config.members.length})</div>
    ${state.config.members.map(member => `
      <div class="pp-member-row" data-member-id="${member.id}">
        <input class="pp-input pp-avatar-input" maxlength="2" data-member-field="avatar" value="${escapeHtml(member.avatar)}">
        <input class="pp-input pp-name-input" data-member-field="name" value="${escapeHtml(member.name)}">
        <select class="pp-input pp-role-select" data-member-field="role">
          <option value="pai" ${member.role === 'pai' ? 'selected' : ''}>PAI</option>
          <option value="mae" ${member.role === 'mae' ? 'selected' : ''}>MÃE</option>
          <option value="crianca" ${member.role === 'crianca' ? 'selected' : ''}>CRIANÇA</option>
        </select>
        <button class="pp-btn-remove" data-remove-member>✕</button>
      </div>`).join('')}
    <button class="pp-btn-add" data-add-member>+ ADICIONAR MEMBRO</button>`;
}

function tarefasHTML() {
  return `
    <div class="pp-section-title">AGENDA RELACIONAL</div>
    <div class="pp-hint">As tarefas são resolvidas por data a partir de séries e exceções. Use o botão “Adicionar tarefa” no quadro e o menu ⋯ do cartão para editar; não há mais cópia de listas por dia da semana.</div>
    <div class="pp-section-title" style="margin-top:12px">OCORRÊNCIAS EM ${escapeHtml(state.selectedDate || state.today)}</div>
    ${state.missions.map(mission => `<div class="pp-bonus-entry"><span>${escapeHtml(mission.emoji)} ${escapeHtml(mission.title)}</span><span>${escapeHtml(mission.start)}–${escapeHtml(mission.end)}</span></div>`).join('') || '<div class="pp-empty">NENHUMA TAREFA NESTA DATA</div>'}`;
}

function extrasHTML() {
  const goals = state.config.customGoals || [];
  return `
    <div class="pp-section-title">🏆 METAS PERSONALIZADAS</div>
    ${goals.map(goal => `
      <div class="pp-goal-row" data-goal-id="${goal.id}">
        <div class="pp-goal-info">
          <input class="pp-input" style="width:60px" data-goal-field="icon" value="${escapeHtml(goal.icon)}" maxlength="2">
          <input class="pp-input" style="flex:1" data-goal-field="name" value="${escapeHtml(goal.name)}">
          <input class="pp-input" style="width:80px" type="number" data-goal-field="target" value="${goal.target}">
          <button class="pp-btn-remove" data-remove-goal>✕</button>
        </div>
      </div>`).join('') || '<div class="pp-empty">Nenhuma meta personalizada.</div>'}`;
}

function bonusHTML() {
  const date = state.selectedDate || state.today;
  const events = (state.bonusLog || []).filter(event => event.date === date);
  return `
    <div class="pp-section-title">🌟 BÔNUS EXTRAS</div>
    <select id="pp-bonus-member" class="pp-input"><option value="">— Escolha um membro —</option>${state.config.members.map(member => `<option value="${member.id}">${escapeHtml(member.avatar)} ${escapeHtml(member.name)}</option>`).join('')}</select>
    <input id="pp-bonus-stars" class="pp-input" type="number" min="1" max="20" value="1">
    <input id="pp-bonus-reason" class="pp-input" maxlength="120" placeholder="Motivo">
    <button class="pp-btn-add" id="pp-bonus-give">✨ CONCEDER BÔNUS</button>
    <div class="pp-section-title" style="margin-top:16px">HISTÓRICO DA DATA (${events.length})</div>
    ${events.map(event => `<div class="pp-bonus-entry"><span>${event.stars > 0 ? '+' : ''}${event.stars} ⭐</span><span>${escapeHtml(event.reason)}</span></div>`).join('') || '<div class="pp-empty">Nenhum bônus nesta data.</div>'}`;
}

function ajustesHTML() {
  const email = getSession()?.user?.email || '';
  return `
    <div class="pp-section-title">CONTA</div>
    <div class="pp-toggle-row"><span>EMAIL DA CONTA</span><span>${escapeHtml(email || '—')}</span></div>
    <div class="pp-section-title" style="margin-top:12px">SEGURANÇA</div>
    <input id="pp-pin-input" class="pp-input" maxlength="8" inputmode="numeric" value="${escapeHtml(state.config.pin)}">
    <button class="pp-btn-add" id="pp-save-pin">SALVAR PIN</button>
    <div class="pp-toggle-row"><span>SOLICITAR PIN PARA ABRIR O PAINEL</span><input type="checkbox" id="pp-skip-parent-pin" ${!state.config.skipParentPanelPin ? 'checked' : ''}></div>
    <div class="pp-toggle-row"><span>EXIGIR PIN PARA FINALIZAR O DIA</span><input type="checkbox" id="pp-require-approval" ${state.config.requireApproval ? 'checked' : ''}></div>
    <div class="pp-section-title" style="margin-top:18px">BACKUP RELACIONAL</div>
    <button class="pp-btn-add" id="pp-export-data">📤 EXPORTAR DADOS (.json)</button>
    <button class="pp-btn-add" id="pp-import-data">📥 IMPORTAR DADOS (.json)</button>
    <input type="file" id="pp-import-file" accept="application/json,.json" style="display:none">
    <div class="pp-hint">Backups JSONB antigos não são compatíveis. A restauração relacional depende da RPC operacional documentada.</div>
    <div class="pp-section-title" style="margin-top:18px;color:var(--red)">ZONA DE PERIGO</div>
    <button class="pp-btn-danger" id="pp-logout">🚪 SAIR DA CONTA</button>
    <button class="pp-btn-danger" style="margin-top:8px" id="pp-reset-data">🗑️ ZERAR TODOS OS DADOS</button>`;
}

function renderParentPanel() {
  document.querySelectorAll('.pp-subtab').forEach(button => button.classList.toggle('active', button.dataset.sub === activeSubTab));
  const body = document.getElementById('parent-panel-body');
  if (!body) return;
  if (activeSubTab === 'tarefas') body.innerHTML = tarefasHTML();
  else if (activeSubTab === 'extras') body.innerHTML = extrasHTML();
  else if (activeSubTab === 'bonus') body.innerHTML = bonusHTML();
  else if (activeSubTab === 'ajustes') body.innerHTML = ajustesHTML();
  else body.innerHTML = membrosHTML();
}

async function refreshAfterChange() {
  await loadDateContext(state.selectedDate || state.today);
  renderDashboard();
  renderParentPanel();
}

export async function toggleCustomGoalReward(goalId) {
  const goal = state.config.customGoals.find(item => item.id === goalId);
  if (!goal) return;
  try {
    if (goal.redeemed) {
      await deleteManualStarEventsBySource('custom_goal', goal.id);
      goal.redeemed = false;
      goal.claimedStars = 0;
    } else {
      const recipients = goal.type === 'member_stars' ? [goal.memberId] : state.config.members.map(member => member.id);
      await Promise.all(recipients.map(memberId => addManualStarEvent({ memberId, date: state.selectedDate || state.today, stars: goal.target, reason: `Meta: ${goal.name}`, source: 'custom_goal', sourceId: goal.id })));
      goal.redeemed = true;
      goal.claimedStars = goal.target;
    }
    await updateCustomGoal(goal);
    await refreshAfterChange();
    checkAndUnlockBadges();
  } catch (error) { alert(error.message || 'Não foi possível atualizar a meta.'); }
}

export function wireParentPanelEvents() {
  document.querySelectorAll('.pp-subtab').forEach(button => button.addEventListener('click', () => { activeSubTab = button.dataset.sub; renderParentPanel(); }));
  const body = document.getElementById('parent-panel-body');
  if (!body) return;
  body.addEventListener('click', async event => {
    try {
      if (event.target.matches('[data-add-member]')) {
        const member = await createFamilyMember({ name: 'NOVO MEMBRO', avatar: '🧒', role: 'crianca', color: nextMemberColor(state.config.members) });
        state.config.members.push(member);
        await refreshAfterChange();
      } else if (event.target.matches('[data-remove-member]')) {
        const id = event.target.closest('[data-member-id]').dataset.memberId;
        if (!confirm('Remover este membro da família?')) return;
        await deleteFamilyMember(id);
        state.config.members = state.config.members.filter(member => member.id !== id);
        await refreshAfterChange();
      } else if (event.target.matches('[data-remove-goal]')) {
        const id = event.target.closest('[data-goal-id]').dataset.goalId;
        const goal = state.config.customGoals.find(item => item.id === id);
        if (!goal || !confirm('Remover esta meta?')) return;
        if (goal.redeemed) await deleteManualStarEventsBySource('custom_goal', goal.id);
        await deleteCustomGoal(goal.id);
        state.config.customGoals = state.config.customGoals.filter(item => item.id !== id);
        await refreshAfterChange();
      } else if (event.target.id === 'pp-save-pin') {
        const pin = document.getElementById('pp-pin-input').value.trim();
        if (!/^\d{4,8}$/.test(pin)) { alert('O PIN deve ter de 4 a 8 números.'); return; }
        state.config.pin = pin; await saveConfig(); alert('PIN atualizado.');
      } else if (event.target.id === 'pp-bonus-give') {
        const memberId = document.getElementById('pp-bonus-member').value;
        const stars = Number(document.getElementById('pp-bonus-stars').value);
        const reason = document.getElementById('pp-bonus-reason').value.trim();
        if (!memberId || stars < 1 || !reason) { alert('Preencha membro, estrelas e motivo.'); return; }
        await addManualStarEvent({ memberId, date: state.selectedDate || todayKey(), stars, reason });
        await refreshAfterChange();
      } else if (event.target.id === 'pp-export-data') {
        const backup = await exportAllData();
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const link = document.createElement('a');
        link.href = url; link.download = `gp-da-familia-backup-${todayKey()}.json`; link.click(); URL.revokeObjectURL(url);
      } else if (event.target.id === 'pp-import-data') {
        document.getElementById('pp-import-file')?.click();
      } else if (event.target.id === 'pp-logout') {
        window.dispatchEvent(new CustomEvent('gp:logout'));
      } else if (event.target.id === 'pp-reset-data') {
        if (!confirm('O reset remoto está bloqueado nesta versão. Consulte SUPABASE_SETUP.md.')) return;
        await resetAllData();
      }
    } catch (error) { alert(error.message || 'Não foi possível concluir a operação.'); }
  });
  body.addEventListener('change', async event => {
    try {
      if (event.target.matches('[data-member-field]')) {
        const id = event.target.closest('[data-member-id]').dataset.memberId;
        const member = state.config.members.find(item => item.id === id);
        const field = event.target.dataset.memberField;
        member[field] = event.target.value;
        await updateFamilyMember(id, { [field]: event.target.value });
      } else if (event.target.matches('[data-goal-field]')) {
        const goal = state.config.customGoals.find(item => item.id === event.target.closest('[data-goal-id]').dataset.goalId);
        const field = event.target.dataset.goalField;
        goal[field] = field === 'target' ? Number(event.target.value) : event.target.value;
        await updateCustomGoal(goal);
      } else if (event.target.id === 'pp-skip-parent-pin') {
        state.config.skipParentPanelPin = !event.target.checked; await saveConfig();
      } else if (event.target.id === 'pp-require-approval') {
        state.config.requireApproval = event.target.checked; await saveConfig();
      } else if (event.target.id === 'pp-import-file') {
        const file = event.target.files[0]; if (!file) return;
        const parsed = JSON.parse(await file.text());
        if (parsed?.format !== 'gp-da-familia-relational-backup' || parsed.version !== 1) throw new Error('Backup incompatível. Backups JSONB antigos não são aceitos.');
        await importAllData(parsed);
      }
    } catch (error) { alert(error.message || 'Não foi possível salvar a alteração.'); }
  });
}
