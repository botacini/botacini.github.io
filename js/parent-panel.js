/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — Painel dos Pais
   ════════════════════════════════════════════════════════════
   Módulo novo (v2). Usa apenas o que já existe:
   - state.js:   state, getTodayMissions, saveConfig, ALL_BADGES*
   - storage.js: resetAllData
   - render.js:  renderMissions, renderMembersBar
   - missions.js: updateHeaderStars

   Não altera nenhum módulo existente. Guarda o rascunho de
   edição em `state.pinBuffer` / `state.pinMode`, que já
   existiam em state.js mas não eram usados por ninguém.
   ════════════════════════════════════════════════════════════ */

import { state, getTodayMissions, saveConfig, DAY_FULL } from './state.js';
import { resetAllData } from './storage.js';
import { renderMissions, renderMembersBar } from './render.js';
import { updateHeaderStars, finalizeDay } from './missions.js';

let currentEditDay = new Date().getDay();
let activeSubTab = 'membros'; // 'membros' | 'tarefas' | 'ajustes'
let copySourceDay = null; // Day selected for copying tasks

/* ════════════════════════════════════════════════════════════
   PIN — teclado numérico
   ════════════════════════════════════════════════════════════ */
export function openPinOverlay(mode) {
  state.pinMode = mode; // 'panel' (abrir painel) ou 'approve' (aprovar fim de dia)
  state.pinBuffer = '';
  document.getElementById('pin-title').textContent =
    mode === 'approve' ? 'PIN DOS PAIS PARA APROVAR' : 'PIN DOS PAIS';
  renderPinDots();
  document.getElementById('pin-overlay').style.display = 'flex';
}

export function closePinOverlay() {
  state.pinBuffer = '';
  document.getElementById('pin-overlay').style.display = 'none';
}

function renderPinDots() {
  const pinLen = String(state.config.pin || '1234').length;
  const dotsEl = document.getElementById('pin-dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < pinLen; i++) {
    const dot = document.createElement('span');
    dot.className = 'pin-dot' + (i < state.pinBuffer.length ? ' filled' : '');
    dotsEl.appendChild(dot);
  }
}

export function pressPinDigit(d) {
  const pin = String(state.config.pin || '1234');
  if (state.pinBuffer.length >= pin.length) return;
  state.pinBuffer += String(d);
  renderPinDots();
  if (state.pinBuffer.length === pin.length) {
    if (state.pinBuffer === pin) {
      const mode = state.pinMode;
      closePinOverlay();
      if (mode === 'approve') {
        finalizeDay();
      } else {
        openParentPanel();
      }
    } else {
      const dotsEl = document.getElementById('pin-dots');
      dotsEl.classList.add('pin-error');
      setTimeout(() => {
        dotsEl.classList.remove('pin-error');
        state.pinBuffer = '';
        renderPinDots();
      }, 380);
    }
  }
}

export function pressPinBackspace() {
  state.pinBuffer = state.pinBuffer.slice(0, -1);
  renderPinDots();
}

/* ════════════════════════════════════════════════════════════
   PAINEL DOS PAIS
   ════════════════════════════════════════════════════════════ */
export function openParentPanel() {
  activeSubTab = 'membros';
  currentEditDay = new Date().getDay();
  copySourceDay = null;
  renderParentPanel();
  document.getElementById('parent-panel-overlay').style.display = 'flex';
}

export function closeParentPanel() {
  document.getElementById('parent-panel-overlay').style.display = 'none';
}

function refreshAfterConfigChange() {
  saveConfig(state.config);
  state.missions = getTodayMissions();
  state.config.members.forEach(m => {
    if (!(m.id in state.memberStars)) state.memberStars[m.id] = 0;
  });
  renderMembersBar();
  renderMissions();
  updateHeaderStars();
}

function renderParentPanel() {
  const body = document.getElementById('parent-panel-body');
  document.querySelectorAll('.pp-subtab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sub === activeSubTab);
  });

  if (activeSubTab === 'membros') body.innerHTML = membrosHTML();
  else if (activeSubTab === 'tarefas') body.innerHTML = tarefasHTML();
  else body.innerHTML = ajustesHTML();
}

/* ── MEMBROS ─────────────────────────────────────────────── */
function membrosHTML() {
  const rows = state.config.members.map(m => `
    <div class="pp-member-row" data-member-id="${m.id}">
      <input class="pp-input pp-avatar-input" maxlength="2" data-mfield="avatar" value="${m.avatar}">
      <input class="pp-input pp-name-input" data-mfield="name" value="${m.name}">
      <select class="pp-input pp-role-select" data-mfield="role">
        <option value="pai" ${m.role === 'pai' ? 'selected' : ''}>PAI</option>
        <option value="mae" ${m.role === 'mae' ? 'selected' : ''}>MÃE</option>
        <option value="crianca" ${m.role === 'crianca' ? 'selected' : ''}>CRIANÇA</option>
      </select>
      <button class="pp-btn-remove" data-remove-member>✕</button>
    </div>`).join('');
  return `
    <div class="pp-section-title">FAMÍLIA (${state.config.members.length})</div>
    ${rows}
    <button class="pp-btn-add" data-add-member>+ ADICIONAR MEMBRO</button>`;
}

/* ── TAREFAS ─────────────────────────────────────────────── */
function tarefasHTML() {
  const dayBtns = DAY_FULL.map((name, i) => `
    <button class="pp-day-btn ${i === currentEditDay ? 'active' : ''}" data-day-select="${i}">${name.slice(0, 3).toUpperCase()}</button>
  `).join('');

  const dayMissions = state.config.missions[currentEditDay] || [];
  const memberOptions = m => {
    let opts = `<option value="compartilhada" ${m === 'compartilhada' ? 'selected' : ''}>🤝 COMPARTILHADA</option>`;
    state.config.members.forEach(mem => {
      opts += `<option value="${mem.id}" ${m === mem.id ? 'selected' : ''}>${mem.avatar} ${mem.name}</option>`;
    });
    return opts;
  };

  const rows = dayMissions.map((ms, idx) => `
    <div class="pp-mission-row" data-mission-idx="${idx}">
      <div class="pp-mission-row-top">
        <input class="pp-input pp-time-input" type="time" data-msfield="start" value="${ms.start}">
        <input class="pp-input pp-time-input" type="time" data-msfield="end" value="${ms.end}">
        <input class="pp-input pp-emoji-input" maxlength="2" data-msfield="emoji" value="${ms.emoji}">
        <button class="pp-btn-remove" data-remove-mission>✕</button>
      </div>
      <input class="pp-input pp-title-input" data-msfield="title" value="${ms.title}" placeholder="TÍTULO">
      <input class="pp-input pp-desc-input" data-msfield="desc" value="${ms.desc}" placeholder="DESCRIÇÃO">
      <select class="pp-input pp-assignee-select" data-msfield="assignee">${memberOptions(ms.assignee)}</select>
    </div>`).join('');

  const copyModeClass = copySourceDay !== null ? 'pp-copy-mode-active' : '';
  const copyModeUI = copySourceDay !== null ? `
    <div class="pp-copy-mode-banner">
      📋 Modo copiar ativado: Selecionado <strong>${DAY_FULL[copySourceDay]}</strong>
      <button class="pp-btn-copy-cancel" data-cancel-copy>✕ Cancelar</button>
    </div>
  ` : '';

  return `
    <div class="pp-day-selector ${copyModeClass}">${dayBtns}</div>
    ${copyModeUI}
    <div class="pp-section-title">TAREFAS DE ${DAY_FULL[currentEditDay].toUpperCase()} (${dayMissions.length})</div>
    ${rows || '<div class="pp-empty">NENHUMA TAREFA CADASTRADA</div>'}
    <button class="pp-btn-add" data-add-mission>+ ADICIONAR TAREFA</button>
    <button class="pp-btn-secondary" data-copy-from-day>📋 COPIAR TAREFAS DE OUTRO DIA</button>
    <div class="pp-hint">⚠️ Editar as tarefas de hoje enquanto alguma já foi marcada pode bagunçar o progresso do dia. Prefira editar antes do dia começar, ou use "NOVO DIA" depois.</div>`;
}

/* ── AJUSTES ─────────────────────────────────────────────── */
function ajustesHTML() {
  return `
    <div class="pp-section-title">SEGURANÇA</div>
    <label class="pp-field-label">PIN DOS PAIS (4 dígitos)</label>
    <input id="pp-pin-input" class="pp-input" maxlength="8" inputmode="numeric" value="${state.config.pin}">
    <button class="pp-btn-add" id="pp-save-pin">SALVAR PIN</button>

    <div class="pp-toggle-row">
      <span>EXIGIR PIN PARA FINALIZAR O DIA</span>
      <input type="checkbox" id="pp-require-approval" ${state.config.requireApproval ? 'checked' : ''}>
    </div>

    <div class="pp-section-title" style="margin-top:18px;color:var(--red)">ZONA DE PERIGO</div>
    <button class="pp-btn-danger" id="pp-reset-data">🗑️ ZERAR TODOS OS DADOS</button>`;
}

/* ════════════════════════════════════════════════════════════
   EVENTOS (delegação — um único listener por container)
   ════════════════════════════════════════════════════════════ */
export function wireParentPanelEvents() {
  document.querySelectorAll('.pp-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSubTab = btn.dataset.sub;
      renderParentPanel();
    });
  });

  const body = document.getElementById('parent-panel-body');

  // Cliques (adicionar/remover/selecionar dia)
  body.addEventListener('click', (e) => {
    if (e.target.matches('[data-add-member]')) {
      const id = 'm_' + Date.now().toString(36);
      state.config.members.push({ id, name: 'NOVO MEMBRO', avatar: '🧒', role: 'crianca' });
      refreshAfterConfigChange();
      renderParentPanel();
    } else if (e.target.matches('[data-remove-member]')) {
      const row = e.target.closest('[data-member-id]');
      const id = row.dataset.memberId;
      if (state.config.members.length <= 1) { alert('Precisa ter ao menos 1 membro.'); return; }
      if (!confirm('Remover este membro da família?')) return;
      state.config.members = state.config.members.filter(m => m.id !== id);
      delete state.memberStars[id];
      refreshAfterConfigChange();
      renderParentPanel();
    } else if (e.target.matches('[data-day-select]')) {
      const selectedDay = Number(e.target.dataset.daySelect);
      // If in copy mode, handle the selection differently
      if (copySourceDay !== null) {
        if (selectedDay === copySourceDay) {
          // Deselect
          copySourceDay = null;
        } else {
          // Copy tasks from copySourceDay to selectedDay
          copTasksFromDay(copySourceDay, selectedDay);
          copySourceDay = null;
          currentEditDay = selectedDay;
        }
      } else {
        currentEditDay = selectedDay;
      }
      renderParentPanel();
    } else if (e.target.matches('[data-add-mission]')) {
      state.config.missions[currentEditDay] = state.config.missions[currentEditDay] || [];
      state.config.missions[currentEditDay].push({
        start: '08:00', end: '08:30', emoji: '⭐', title: 'NOVA TAREFA', desc: 'DESCRIÇÃO', assignee: 'compartilhada'
      });
      refreshAfterConfigChange();
      renderParentPanel();
    } else if (e.target.matches('[data-remove-mission]')) {
      const row = e.target.closest('[data-mission-idx]');
      const idx = Number(row.dataset.missionIdx);
      state.config.missions[currentEditDay].splice(idx, 1);
      refreshAfterConfigChange();
      renderParentPanel();
    } else if (e.target.matches('[data-copy-from-day]')) {
      // Enter copy mode
      if (copySourceDay === null) {
        copySourceDay = currentEditDay;
      } else {
        copySourceDay = null;
      }
      renderParentPanel();
    } else if (e.target.matches('[data-cancel-copy]')) {
      // Cancel copy mode
      copySourceDay = null;
      renderParentPanel();
    }
  });

  // Edição de campos (sem re-render completo, pra não perder o foco)
  body.addEventListener('input', (e) => {
    if (e.target.matches('[data-mfield]')) {
      const row = e.target.closest('[data-member-id]');
      const id = row.dataset.memberId;
      const member = state.config.members.find(m => m.id === id);
      if (member) {
        member[e.target.dataset.mfield] = e.target.value;
        refreshAfterConfigChange();
      }
    } else if (e.target.matches('[data-msfield]')) {
      const row = e.target.closest('[data-mission-idx]');
      const idx = Number(row.dataset.missionIdx);
      const mission = state.config.missions[currentEditDay][idx];
      if (mission) {
        mission[e.target.dataset.msfield] = e.target.value;
        refreshAfterConfigChange();
      }
    }
  });

  body.addEventListener('change', (e) => {
    if (e.target.id === 'pp-require-approval') {
      state.config.requireApproval = e.target.checked;
      refreshAfterConfigChange();
    }
  });

  body.addEventListener('click', (e) => {
    if (e.target.id === 'pp-save-pin') {
      const val = document.getElementById('pp-pin-input').value.trim();
      if (!/^\d{4,8}$/.test(val)) { alert('O PIN deve ter de 4 a 8 números.'); return; }
      state.config.pin = val;
      refreshAfterConfigChange();
      alert('PIN atualizado!');
    } else if (e.target.id === 'pp-reset-data') {
      if (confirm('Isso vai apagar TODOS os dados salvos (membros, tarefas, estrelas, conquistas). Tem certeza?')) {
        resetAllData();
        location.reload();
      }
    }
  });
}

/* ════════════════════════════════════════════════════════════
   COPY TASKS FROM ANOTHER DAY
   ════════════════════════════════════════════════════════════ */
function copTasksFromDay(sourceDay, targetDay) {
  const sourceMissions = state.config.missions[sourceDay];
  if (!sourceMissions || sourceMissions.length === 0) {
    alert(`Nenhuma tarefa em ${DAY_FULL[sourceDay]} para copiar.`);
    return;
  }

  // Deep copy missions (without their IDs, so new ones are generated)
  const copiedMissions = sourceMissions.map(m => ({
    start: m.start,
    end: m.end,
    emoji: m.emoji,
    title: m.title,
    desc: m.desc,
    assignee: m.assignee
    // Note: NOT copying the ID, so ensureMissionIds will generate new ones
  }));

  state.config.missions[targetDay] = state.config.missions[targetDay] || [];
  state.config.missions[targetDay].push(...copiedMissions);

  refreshAfterConfigChange();
  alert(`✓ ${copiedMissions.length} tarefa(s) copiada(s) de ${DAY_FULL[sourceDay]} para ${DAY_FULL[targetDay]}!`);
}
