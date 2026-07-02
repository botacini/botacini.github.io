/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — Painel dos Pais
   ════════════════════════════════════════════════════════════
   Módulo do painel dos pais.
   ════════════════════════════════════════════════════════════ */

import { state, getTodayMissions, saveConfig, DAY_FULL } from './state.js';
import { resetAllData } from './storage.js';
import { renderMissions, renderMembersBar } from './render.js';
import { updateHeaderStars, finalizeDay } from './missions.js';

let currentEditDay = new Date().getDay();
let activeSubTab = 'membros'; // membros | tarefas | ajustes
let copySourceDay = null;
let copyTargetDays = new Set();

/* ════════════════════════════════════════════════════════════
   PIN — teclado numérico
   ════════════════════════════════════════════════════════════ */

export function openPinOverlay(mode) {
  state.pinMode = mode;
  state.pinBuffer = '';

  document.getElementById('pin-title').textContent =
    mode === 'approve'
      ? 'PIN DOS PAIS PARA APROVAR'
      : 'PIN DOS PAIS';

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
    dot.className =
      'pin-dot' + (i < state.pinBuffer.length ? ' filled' : '');
    dotsEl.appendChild(dot);
  }
}

export function pressPinDigit(d) {
  const pin = String(state.config.pin || '1234');

  if (state.pinBuffer.length >= pin.length) return;

  state.pinBuffer += String(d);
  renderPinDots();

  if (state.pinBuffer.length !== pin.length) return;

  if (state.pinBuffer === pin) {
    const mode = state.pinMode;

    closePinOverlay();

    if (mode === 'approve') {
      finalizeDay();
    } else {
      openParentPanel();
    }

    return;
  }

  const dotsEl = document.getElementById('pin-dots');
  dotsEl.classList.add('pin-error');

  setTimeout(() => {
    dotsEl.classList.remove('pin-error');
    state.pinBuffer = '';
    renderPinDots();
  }, 380);
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

  state.config.members.forEach(member => {
    if (!(member.id in state.memberStars)) {
      state.memberStars[member.id] = 0;
    }
  });

  renderMembersBar();
  renderMissions();
  updateHeaderStars();
}

function renderParentPanel() {
  const body = document.getElementById('parent-panel-body');

  document.querySelectorAll('.pp-subtab').forEach(btn => {
    btn.classList.toggle(
      'active',
      btn.dataset.sub === activeSubTab
    );
  });

  switch (activeSubTab) {
    case 'membros':
      body.innerHTML = membrosHTML();
      break;

    case 'tarefas':
      body.innerHTML = tarefasHTML();
      break;

    case 'ajustes':
      body.innerHTML = ajustesHTML();
      break;
  }
}

/* ───────────────────────────────────────────────────────────
   MEMBROS
   ─────────────────────────────────────────────────────────── */

function membrosHTML() {
  const rows = state.config.members.map(member => `
    <div class="pp-member-row" data-member-id="${member.id}">
      <input
        class="pp-input pp-avatar-input"
        maxlength="2"
        data-mfield="avatar"
        value="${member.avatar}">

      <input
        class="pp-input pp-name-input"
        data-mfield="name"
        value="${member.name}">

      <select
        class="pp-input pp-role-select"
        data-mfield="role">

        <option value="pai" ${member.role === 'pai' ? 'selected' : ''}>
          PAI
        </option>

        <option value="mae" ${member.role === 'mae' ? 'selected' : ''}>
          MÃE
        </option>

        <option value="crianca" ${member.role === 'crianca' ? 'selected' : ''}>
          CRIANÇA
        </option>

      </select>

      <button class="pp-btn-remove" data-remove-member>
        ✕
      </button>
    </div>
  `).join('');

  return `
    <div class="pp-section-title">
      FAMÍLIA (${state.config.members.length})
    </div>

    ${rows}

    <button class="pp-btn-add" data-add-member>
      + ADICIONAR MEMBRO
    </button>
  `;
}

/* ───────────────────────────────────────────────────────────
   TAREFAS
   ─────────────────────────────────────────────────────────── */

function tarefasHTML() {
  const dayBtns = DAY_FULL.map((name, i) => {
    const isSource = copySourceDay === i;
    const isTarget = copyTargetDays?.has(i);

    let cls = 'pp-day-btn';
    if (i === currentEditDay) cls += ' active';
    if (isSource) cls += ' copy-source';
    if (isTarget) cls += ' copy-target';

    return `
      <button class="${cls}" data-day-select="${i}">
        ${name.slice(0, 3).toUpperCase()}
      </button>
    `;
  }).join('');

  const dayMissions = state.config.missions[currentEditDay] || [];

  const memberOptions = (m) => {
    let opts = `<option value="compartilhada" ${m === 'compartilhada' ? 'selected' : ''}>🤝 COMPARTILHADA</option>`;
    state.config.members.forEach(mem => {
      opts += `<option value="${mem.id}" ${m === mem.id ? 'selected' : ''}>
        ${mem.avatar} ${mem.name}
      </option>`;
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

      <select class="pp-input pp-assignee-select" data-msfield="assignee">
        ${memberOptions(ms.assignee)}
      </select>
    </div>
  `).join('');

  const copyModeUI = copySourceDay !== null ? `
    <div class="pp-copy-mode-banner">
      📋 Origem: <strong>${DAY_FULL[copySourceDay]}</strong><br>

      Destinos:
      <strong>
        ${[...copyTargetDays].map(d => DAY_FULL[d]).join(', ') || 'nenhum'}
      </strong>

      <div style="margin-top:10px; display:flex; gap:8px;">
        <button class="pp-btn-add" data-confirm-copy>
          ✔ CONFIRMAR CÓPIA (OVERWRITE)
        </button>

        <button class="pp-btn-remove" data-cancel-copy>
          CANCELAR
        </button>
      </div>
    </div>
  ` : `
    <button class="pp-btn-secondary" data-start-copy>
      📋 COPIAR TAREFAS DE OUTRO DIA
    </button>
  `;

  return `
    <div class="pp-day-selector">
      ${dayBtns}
    </div>

    ${copyModeUI}

    <div class="pp-section-title">
      TAREFAS DE ${DAY_FULL[currentEditDay].toUpperCase()} (${dayMissions.length})
    </div>

    ${rows || '<div class="pp-empty">NENHUMA TAREFA CADASTRADA</div>'}

    <button class="pp-btn-add" data-add-mission>
      + ADICIONAR TAREFA
    </button>

    <div class="pp-hint">
      ⚠️ Alterações em tarefas já concluídas podem afetar o progresso do dia.
    </div>
  `;
}

/* ───────────────────────────────────────────────────────────
   AJUSTES
   ─────────────────────────────────────────────────────────── */

function ajustesHTML() {
  return `
    <div class="pp-section-title">
      SEGURANÇA
    </div>

    <label class="pp-field-label">
      PIN DOS PAIS (4 a 8 dígitos)
    </label>

    <input
      id="pp-pin-input"
      class="pp-input"
      maxlength="8"
      inputmode="numeric"
      value="${state.config.pin}">

    <button
      class="pp-btn-add"
      id="pp-save-pin">

      SALVAR PIN

    </button>

    <div class="pp-toggle-row">
      <span>EXIGIR PIN PARA FINALIZAR O DIA</span>

      <input
        type="checkbox"
        id="pp-require-approval"
        ${state.config.requireApproval ? 'checked' : ''}>
    </div>

    <div
      class="pp-section-title"
      style="margin-top:18px;color:var(--red)">

      ZONA DE PERIGO

    </div>

    <button
      class="pp-btn-danger"
      id="pp-reset-data">

      🗑️ ZERAR TODOS OS DADOS

    </button>
  `;
}
/* ════════════════════════════════════════════════════════════
   EVENTOS (delegação)
   ════════════════════════════════════════════════════════════ */

export function wireParentPanelEvents() {

  document.querySelectorAll('.pp-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSubTab = btn.dataset.sub;
      renderParentPanel();
    });
  });

  const body = document.getElementById('parent-panel-body');

  /* ---------------------------------------------------------
     CLIQUES
     --------------------------------------------------------- */

  body.addEventListener('click', (e) => {
     
     if (e.target.matches('[data-start-copy]')) {
  copySourceDay = currentEditDay;
  copyTargetDays = new Set();
  renderParentPanel();
  return;
}

    /* ---------- adicionar membro ---------- */

    if (e.target.matches('[data-add-member]')) {

      const id = 'm_' + Date.now().toString(36);

      state.config.members.push({
        id,
        name: 'NOVO MEMBRO',
        avatar: '🧒',
        role: 'crianca'
      });

      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

    /* ---------- remover membro ---------- */

    if (e.target.matches('[data-remove-member]')) {

      const row = e.target.closest('[data-member-id]');
      const id = row.dataset.memberId;

      if (state.config.members.length <= 1) {
        alert('Precisa existir ao menos um membro.');
        return;
      }

      if (!confirm('Remover este membro da família?')) {
        return;
      }

      state.config.members =
        state.config.members.filter(m => m.id !== id);

      delete state.memberStars[id];

      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

  
     /* ---------- adicionar missão ---------- */

    if (e.target.matches('[data-add-mission]')) {

      state.config.missions[currentEditDay] ??= [];

      state.config.missions[currentEditDay].push({

        start: '08:00',
        end: '08:30',
        emoji: '⭐',
        title: 'NOVA TAREFA',
        desc: 'DESCRIÇÃO',
        assignee: 'compartilhada'

      });

      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

    /* ---------- remover missão ---------- */

    if (e.target.matches('[data-remove-mission]')) {

      const row =
        e.target.closest('[data-mission-idx]');

      const idx =
        Number(row.dataset.missionIdx);

      state.config.missions[currentEditDay]
        .splice(idx, 1);

      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

    /* ---------- copiar tarefas ---------- */

    if (e.target.matches('[data-copy-from-day]')) {

      copySourceDay = currentEditDay;

      alert(
        `Agora escolha o dia que receberá as tarefas de ${DAY_FULL[currentEditDay]}.`
      );

      renderParentPanel();
      return;
    }

    if (e.target.matches('[data-cancel-copy]')) {

      copySourceDay = null;
      renderParentPanel();
      return;
    }

  });

  /* ---------------------------------------------------------
     INPUT
     --------------------------------------------------------- */

  body.addEventListener('input', (e) => {

    if (e.target.matches('[data-mfield]')) {

      const row =
        e.target.closest('[data-member-id]');

      const id = row.dataset.memberId;

      const member =
        state.config.members.find(m => m.id === id);

      if (!member) return;

      member[e.target.dataset.mfield] = e.target.value;

      refreshAfterConfigChange();
      return;
    }

    if (e.target.matches('[data-msfield]')) {

      const row =
        e.target.closest('[data-mission-idx]');

      const idx =
        Number(row.dataset.missionIdx);

      const mission =
        state.config.missions[currentEditDay][idx];

      if (!mission) return;

      mission[e.target.dataset.msfield] =
        e.target.value;

      refreshAfterConfigChange();
    }

  });

  /* ---------------------------------------------------------
     CHANGE
     --------------------------------------------------------- */

  body.addEventListener('change', (e) => {

    if (e.target.id === 'pp-require-approval') {

      state.config.requireApproval =
        e.target.checked;

      refreshAfterConfigChange();
    }

  });

  /* ---------------------------------------------------------
     BOTÕES
     --------------------------------------------------------- */

body.addEventListener('click', (e) => {

  /* ─────────────────────────────
     PIN / RESET
     ───────────────────────────── */

  if (e.target.id === 'pp-save-pin') {

    const value = document.getElementById('pp-pin-input').value.trim();

    if (!/^\d{4,8}$/.test(value)) {
      alert('O PIN deve conter de 4 a 8 números.');
      return;
    }

    state.config.pin = value;
    refreshAfterConfigChange();

    alert('PIN atualizado!');
    return;
  }

  if (e.target.id === 'pp-reset-data') {

    if (!confirm('Isso apagará TODOS os dados salvos. Continuar?')) {
      return;
    }

    resetAllData();
    location.reload();
    return;
  }

  /* ─────────────────────────────
     MEMBROS
     ───────────────────────────── */

  if (e.target.matches('[data-add-member]')) {

    const id = 'm_' + Date.now().toString(36);

    state.config.members.push({
      id,
      name: 'NOVO MEMBRO',
      avatar: '🧒',
      role: 'crianca'
    });

    refreshAfterConfigChange();
    renderParentPanel();
    return;
  }

  if (e.target.matches('[data-remove-member]')) {

    const row = e.target.closest('[data-member-id]');
    const id = row.dataset.memberId;

    if (state.config.members.length <= 1) {
      alert('Precisa existir ao menos um membro.');
      return;
    }

    if (!confirm('Remover este membro da família?')) {
      return;
    }

    state.config.members =
      state.config.members.filter(m => m.id !== id);

    delete state.memberStars[id];

    refreshAfterConfigChange();
    renderParentPanel();
    return;
  }

  /* ─────────────────────────────
     MISSÕES
     ───────────────────────────── */

  if (e.target.matches('[data-add-mission]')) {

    state.config.missions[currentEditDay] ??= [];

    state.config.missions[currentEditDay].push({
      start: '08:00',
      end: '08:30',
      emoji: '⭐',
      title: 'NOVA TAREFA',
      desc: 'DESCRIÇÃO',
      assignee: 'compartilhada'
    });

    refreshAfterConfigChange();
    renderParentPanel();
    return;
  }

  if (e.target.matches('[data-remove-mission]')) {

    const row = e.target.closest('[data-mission-idx]');
    const idx = Number(row.dataset.missionIdx);

    state.config.missions[currentEditDay].splice(idx, 1);

    refreshAfterConfigChange();
    renderParentPanel();
    return;
  }

  /* ─────────────────────────────
     COPY FLOW (NOVO)
     ───────────────────────────── */

  if (e.target.matches('[data-day-select]')) {

    const selectedDay = Number(e.target.dataset.daySelect);

    if (copySourceDay === null) {
      currentEditDay = selectedDay;
      renderParentPanel();
      return;
    }

    if (selectedDay === copySourceDay) {
      copySourceDay = null;
      copyTargetDays = new Set();
      renderParentPanel();
      return;
    }

    if (copyTargetDays.has(selectedDay)) {
      copyTargetDays.delete(selectedDay);
    } else {
      copyTargetDays.add(selectedDay);
    }

    renderParentPanel();
    return;
  }

  if (e.target.matches('[data-confirm-copy]')) {

    if (copySourceDay === null) {
      alert('Nenhum dia de origem selecionado.');
      return;
    }

    if (!copyTargetDays || copyTargetDays.size === 0) {
      alert('Selecione pelo menos um dia de destino.');
      return;
    }

    const source = state.config.missions[copySourceDay];

    if (!source || source.length === 0) {
      alert('Dia de origem não possui tarefas.');
      return;
    }

    const confirmed = confirm(
      `Copiar ${source.length} tarefa(s) de ${DAY_FULL[copySourceDay]} para ${copyTargetDays.size} dia(s)?`
    );

    if (!confirmed) return;

    copyTargetDays.forEach(day => {

      const cloned = source.map(m => ({
        start: m.start,
        end: m.end,
        emoji: m.emoji,
        title: m.title,
        desc: m.desc,
        assignee: m.assignee
      }));

      state.config.missions[day] = cloned;
    });

    copySourceDay = null;
    copyTargetDays = new Set();

    refreshAfterConfigChange();
    renderParentPanel();

    alert('✔ Tarefas copiadas com sucesso!');
    return;
  }

  if (e.target.matches('[data-cancel-copy]')) {
    copySourceDay = null;
    copyTargetDays = new Set();
    renderParentPanel();
    return;
  }
});
