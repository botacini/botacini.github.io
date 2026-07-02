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

/*
 * Estado de cópia — agora explícito e único.
 * copyMode é a ÚNICA fonte de verdade sobre "estamos copiando?".
 * copySourceDay e copyTargetDays só têm significado quando copyMode === true.
 */
let copyMode = false;
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

function resetCopyState() {
  copyMode = false;
  copySourceDay = null;
  copyTargetDays = new Set();
}

function startCopyMode() {
  copyMode = true;
  copySourceDay = currentEditDay;
  copyTargetDays = new Set();
}

/* ───────────────────────────────────────────────────────────
   ABERTURA / FECHAMENTO
   ─────────────────────────────────────────────────────────── */

export function openParentPanel() {
  activeSubTab = 'membros';
  currentEditDay = new Date().getDay();
  resetCopyState();

  renderParentPanel();
  document.getElementById('parent-panel-overlay').style.display = 'flex';
}

export function closeParentPanel() {
  // Sair do painel sempre encerra qualquer cópia pendente,
  // evitando estado "fantasma" ao reabrir.
  resetCopyState();
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

  return `
    <div class="pp-day-selector ${copyMode ? 'pp-day-selector--copy' : ''}">
      ${DAY_FULL.map((d, i) => {
        const isSource = copyMode && i === copySourceDay;
        const isTarget = copyMode && copyTargetDays.has(i);
        const isCurrent = !copyMode && i === currentEditDay;

        return `
          <button
            class="pp-day-btn ${isCurrent ? 'active' : ''} ${isSource ? 'copy-source' : ''} ${isTarget ? 'copy-target' : ''}"
            data-day="${i}"
            ${isSource ? 'disabled' : ''}
            aria-pressed="${isTarget}">
            ${d.slice(0, 3).toUpperCase()}
          </button>
        `;
      }).join('')}
    </div>

    ${copyMode ? `
      <div class="pp-copy-banner">
        Origem: <b>${DAY_FULL[copySourceDay]}</b><br>
        Destinos: <b>${[...copyTargetDays].map(d => DAY_FULL[d]).join(', ') || 'nenhum'}</b>

        <button data-confirm-copy ${copyTargetDays.size === 0 ? 'disabled' : ''}>CONFIRMAR</button>
        <button data-cancel-copy>CANCELAR</button>
      </div>
    ` : `
      <button data-start-copy>📋 COPIAR TAREFAS DE OUTRO DIA</button>
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
          <option value="compartilhada" ${m.assignee === 'compartilhada' ? 'selected' : ''}>
            🤝 COMPARTILHADA
          </option>

          ${state.config.members.map(mem => `
            <option value="${mem.id}" ${m.assignee === mem.id ? 'selected' : ''}>
              ${mem.avatar} ${mem.name}
            </option>
          `).join('')}
        </select>

        <button data-remove-mission>✕</button>
      </div>
    `).join('')}

    <button data-add-mission ${copyMode ? 'disabled' : ''}>+ ADICIONAR</button>
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

  document.querySelectorAll('.pp-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      // Trocar de aba também encerra qualquer cópia pendente.
      if (activeSubTab === 'tarefas' && btn.dataset.sub !== 'tarefas') {
        resetCopyState();
      }
      activeSubTab = btn.dataset.sub;
      renderParentPanel();
    });
  });

  body.addEventListener('click', (e) => {

    /* ───────── MEMBROS / MISSÕES ───────── */

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
      // Não permite adicionar missão durante o fluxo de cópia,
      // evitando editar o dia de origem no meio da operação.
      if (copyMode) return;

      state.config.missions[currentEditDay] ??= [];
      state.config.missions[currentEditDay].push({
        start: '08:00', end: '08:30',
        emoji: '⭐', title: 'NOVA', desc: '', assignee: 'compartilhada'
      });
      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

    if (e.target.matches('[data-remove-mission]')) {
      if (copyMode) return;

      const idx = Number(e.target.closest('[data-mission]').dataset.mission);
      state.config.missions[currentEditDay].splice(idx, 1);
      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

    /* ───────── COPY FLOW ─────────
       Único ponto de entrada/saída do modo de cópia.
       Nenhuma outra parte do código altera copyMode diretamente. */

    if (e.target.matches('[data-start-copy]')) {
      startCopyMode();
      renderParentPanel();
      return;
    }

    if (e.target.matches('[data-day]')) {
      const day = Number(e.target.dataset.day);

      if (!copyMode) {
        // Modo normal: navegação simples entre dias.
        currentEditDay = day;
      } else {
        // Modo cópia: dias só funcionam como seleção de destino.
        // O dia de origem é ignorado (não pode ser destino de si mesmo)
        // e currentEditDay NUNCA muda enquanto copyMode estiver ativo.
        if (day === copySourceDay) {
          return;
        }

        copyTargetDays.has(day)
          ? copyTargetDays.delete(day)
          : copyTargetDays.add(day);
      }

      renderParentPanel();
      return;
    }

    if (e.target.matches('[data-confirm-copy]')) {
      if (!copyMode || copyTargetDays.size === 0) return;

      const src = state.config.missions[copySourceDay] || [];

      copyTargetDays.forEach(d => {
        state.config.missions[d] = structuredClone(src);
      });

      resetCopyState();

      refreshAfterConfigChange();
      renderParentPanel();
      return;
    }

    if (e.target.matches('[data-cancel-copy]')) {
      resetCopyState();
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

  body.addEventListener('change', (e) => {
    if (e.target.id === 'pp-require-approval') {
      state.config.requireApproval = e.target.checked;
      refreshAfterConfigChange();
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
