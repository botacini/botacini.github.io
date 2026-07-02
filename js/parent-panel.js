/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — Painel dos Pais (REFATORADO)
   ════════════════════════════════════════════════════════════ */

import {
  state,
  getTodayMissions,
  saveConfig,
  DAY_FULL
} from './state.js';

import { resetAllData } from './storage.js';
import { renderMissions, renderMembersBar } from './render.js';
import { updateHeaderStars, finalizeDay } from './missions.js';

/* ───────────────────────────────────────────────────────────
   STATE LOCAL
   ─────────────────────────────────────────────────────────── */

let currentEditDay = new Date().getDay();
let activeSubTab = 'membros';

let copySourceDay = null;
let copyTargetDays = new Set();

/* ───────────────────────────────────────────────────────────
   UTIL
   ─────────────────────────────────────────────────────────── */

function refreshAfterConfigChange() {
  saveConfig(state.config);

  state.missions = getTodayMissions();

  state.config.members.forEach(m => {
    if (!(m.id in state.memberStars)) {
      state.memberStars[m.id] = 0;
    }
  });

  renderMembersBar();
  renderMissions();
  updateHeaderStars();
}

/* ───────────────────────────────────────────────────────────
   ABERTURA / FECHAMENTO
   ─────────────────────────────────────────────────────────── */

export function openParentPanel() {
  activeSubTab = 'membros';
  currentEditDay = new Date().getDay();
  copySourceDay = null;
  copyTargetDays = new Set();

  renderParentPanel();
  document.getElementById('parent-panel-overlay').style.display = 'flex';
}

export function closeParentPanel() {
  document.getElementById('parent-panel-overlay').style.display = 'none';
}

/* ───────────────────────────────────────────────────────────
   RENDER PRINCIPAL
   ─────────────────────────────────────────────────────────── */

function renderParentPanel() {
  const body = document.getElementById('parent-panel-body');

  document.querySelectorAll('.pp-subtab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sub === activeSubTab);
  });

  if (activeSubTab === 'membros') body.innerHTML = membrosHTML();
  if (activeSubTab === 'tarefas') body.innerHTML = tarefasHTML();
  if (activeSubTab === 'ajustes') body.innerHTML = ajustesHTML();
}

/* ───────────────────────────────────────────────────────────
   HTML — MEMBROS
   ─────────────────────────────────────────────────────────── */

function membrosHTML() {
  return `
    <div class="pp-section-title">
      FAMÍLIA (${state.config.members.length})
    </div>

    ${state.config.members.map(m => `
      <div class="pp-member-row" data-member-id="${m.id}">
        <input class="pp-input" data-mfield="avatar" value="${m.avatar}" maxlength="2">
        <input class="pp-input" data-mfield="name" value="${m.name}">
        <select class="pp-input" data-mfield="role">
          <option value="pai" ${m.role === 'pai' ? 'selected' : ''}>PAI</option>
          <option value="mae" ${m.role === 'mae' ? 'selected' : ''}>MÃE</option>
          <option value="crianca" ${m.role === 'crianca' ? 'selected' : ''}>CRIANÇA</option>
        </select>
        <button data-remove-member>✕</button>
      </div>
    `).join('')}

    <button data-add-member>+ ADICIONAR MEMBRO</button>
  `;
}

/* ───────────────────────────────────────────────────────────
   HTML — TAREFAS
   ─────────────────────────────────────────────────────────── */

function tarefasHTML() {
  const missions = state.config.missions[currentEditDay] || [];

  const copyMode = copySourceDay !== null;

  return `
    <div class="pp-day-selector">
      ${DAY_FULL.map((d, i) => `
        <button
          class="pp-day-btn ${
            i === currentEditDay ? 'active' : ''
          } ${
            i === copySourceDay ? 'copy-source' : ''
          } ${
            copyTargetDays.has(i) ? 'copy-target' : ''
          }"
          data-day="${i}">
          ${d.slice(0,3).toUpperCase()}
        </button>
      `).join('')}
    </div>

    ${copyMode ? `
      <div class="pp-copy-banner">
        Origem: <b>${DAY_FULL[copySourceDay]}</b><br>
        Destinos: <b>${[...copyTargetDays].map(d => DAY_FULL[d]).join(', ') || 'nenhum'}</b>

        <button data-confirm-copy>CONFIRMAR</button>
        <button data-cancel-copy>CANCELAR</button>
      </div>
    ` : `
      <button data-start-copy>📋 COPIAR TAREFAS</button>
    `}

    <div class="pp-section-title">
      TAREFAS (${missions.length})
    </div>

    ${missions.map((m, i) => `
      <div data-mission="${i}">
        <input data-ms="start" type="time" value="${m.start}">
        <input data-ms="end" type="time" value="${m.end}">
        <input data-ms="emoji" value="${m.emoji}">
        <input data-ms="title" value="${m.title}">
        <input data-ms="desc" value="${m.desc}">

        <select data-ms="assignee">
          <option value="compartilhada" ${m.assignee === 'compartilhada' ? 'selected':''}>
            🤝 COMPARTILHADA
          </option>

          ${state.config.members.map(mem => `
            <option value="${mem.id}" ${m.assignee === mem.id ? 'selected':''}>
              ${mem.avatar} ${mem.name}
            </option>
          `).join('')}
        </select>

        <button data-remove-mission>✕</button>
      </div>
    `).join('')}

    <button data-add-mission>+ ADICIONAR</button>
  `;
}

/* ───────────────────────────────────────────────────────────
   HTML — AJUSTES (mantido simples)
   ─────────────────────────────────────────────────────────── */

function ajustesHTML() {
  return `
    <div>SEGURANÇA</div>

    <input id="pp-pin-input" value="${state.config.pin}">
    <button id="pp-save-pin">SALVAR</button>

    <label>
      <input type="checkbox" id="pp-require-approval"
        ${state.config.requireApproval ? 'checked' : ''}>
      exigir PIN
    </label>

    <button id="pp-reset-data">ZERAR DADOS</button>
  `;
}

/* ───────────────────────────────────────────────────────────
   EVENTOS (UNIFICADO)
   ─────────────────────────────────────────────────────────── */

export function wireParentPanelEvents() {
  const body = document.getElementById('parent-panel-body');

  body.addEventListener('click', (e) => {

    /* ───────── SUBTABS / MEMBROS / MISSÕES ───────── */

    if (e.target.matches('[data-add-member]')) {
      state.config.members.push({
        id: 'm_' + Date.now().toString(36),
        name: 'NOVO',
        avatar: '🧒',
        role: 'crianca'
      });
      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

    if (e.target.matches('[data-remove-member]')) {
      const id = e.target.closest('[data-member-id]').dataset.memberId;
      state.config.members = state.config.members.filter(m => m.id !== id);
      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

    if (e.target.matches('[data-add-mission]')) {
      state.config.missions[currentEditDay] ??= [];
      state.config.missions[currentEditDay].push({
        start:'08:00', end:'08:30',
        emoji:'⭐', title:'NOVA', desc:'', assignee:'compartilhada'
      });
      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

    if (e.target.matches('[data-remove-mission]')) {
      const idx = Number(e.target.closest('[data-mission]').dataset.mission);
      state.config.missions[currentEditDay].splice(idx,1);
      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

    /* ───────── COPY FLOW ───────── */

    if (e.target.matches('[data-start-copy]')) {
      copySourceDay = currentEditDay;
      copyTargetDays = new Set();
      renderParentPanel();
      return;
    }

    if (e.target.matches('[data-day]')) {
      const day = Number(e.target.dataset.day);

      if (copySourceDay === null) {
        currentEditDay = day;
      } else {
        if (day === copySourceDay) {
          copySourceDay = null;
          copyTargetDays = new Set();
        } else {
          copyTargetDays.has(day)
            ? copyTargetDays.delete(day)
            : copyTargetDays.add(day);
        }
      }

      renderParentPanel();
      return;
    }

    if (e.target.matches('[data-confirm-copy]')) {
      const src = state.config.missions[copySourceDay];

      copyTargetDays.forEach(d => {
        state.config.missions[d] = structuredClone(src);
      });

      copySourceDay = null;
      copyTargetDays = new Set();

      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

    if (e.target.matches('[data-cancel-copy]')) {
      copySourceDay = null;
      copyTargetDays = new Set();
      renderParentPanel();
      return;
    }

    /* ───────── AJUSTES ───────── */

    if (e.target.id === 'pp-save-pin') {
      state.config.pin = document.getElementById('pp-pin-input').value;
      refreshAfterConfigChange();
      return;
    }

    if (e.target.id === 'pp-reset-data') {
      if (confirm('ZERAR TUDO?')) {
        resetAllData();
        location.reload();
      }
      return;
    }
  });

  body.addEventListener('input', (e) => {
    const row = e.target.closest('[data-member-id]');
    if (row && e.target.dataset.mfield) {
      const m = state.config.members.find(x => x.id === row.dataset.memberId);
      m[e.target.dataset.mfield] = e.target.value;
      refreshAfterConfigChange();
    }

    const mission = e.target.closest('[data-mission]');
    if (mission && e.target.dataset.ms) {
      const idx = Number(mission.dataset.mission);
      state.config.missions[currentEditDay][idx][e.target.dataset.ms] = e.target.value;
      refreshAfterConfigChange();
    }
  });
}
