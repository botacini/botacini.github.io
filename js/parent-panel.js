/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — parent-panel.js
   ════════════════════════════════════════════════════════════
   Painel dos pais: PIN de acesso, cadastro de membros, cadastro
   de tarefas por dia da semana (com ordenação automática por
   horário e cópia entre dias), PIN, aprovação e reset geral.

   Só fala com state.js, storage.js e render.js — nunca com
   missions.js. A aprovação de PIN para finalizar o dia é feita
   por eventos (gp:request-pin-approve / gp:pin-approved), para
   não acoplar este módulo às regras de negócio do dia. Quem
   liga as duas pontas é o main.js.
   ════════════════════════════════════════════════════════════ */

import { state, saveConfig, getTodayMissions, persistDayState, persistTotals, timeToMin, DAY_FULL } from './state.js';
import { resetAllData } from './storage.js';
import { renderMembersBar, renderMissions } from './render.js';

let currentEditDay = new Date().getDay();
let activeSubTab = 'membros'; // 'membros' | 'tarefas' | 'ajustes'
let copyTargets = new Set();

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayDow() {
  return new Date().getDay();
}

/* ════════════════════════════════════════════════════════════
   PIN — teclado numérico
   ════════════════════════════════════════════════════════════ */
export function openPinOverlay(mode) {
  state.pinMode = mode; // 'panel' (abrir painel) ou 'approve' (aprovar finalização do dia)
  state.pinBuffer = '';
  const title = document.getElementById('pin-title');
  if (title) title.textContent = mode === 'approve' ? 'PIN DOS PAIS PARA APROVAR' : 'PIN DOS PAIS';
  renderPinDots();
  const overlay = document.getElementById('pin-overlay');
  if (overlay) overlay.style.display = 'flex';
}

export function closePinOverlay() {
  state.pinBuffer = '';
  const overlay = document.getElementById('pin-overlay');
  if (overlay) overlay.style.display = 'none';
}

function renderPinDots() {
  const pinLen = String(state.config.pin || '1234').length;
  const dotsEl = document.getElementById('pin-dots');
  if (!dotsEl) return;
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
  if (state.pinBuffer.length !== pin.length) return;

  if (state.pinBuffer === pin) {
    const mode = state.pinMode;
    closePinOverlay();
    if (mode === 'panel') {
      openParentPanel();
    } else if (mode === 'approve') {
      window.dispatchEvent(new CustomEvent('gp:pin-approved'));
    }
  } else {
    const dotsEl = document.getElementById('pin-dots');
    if (dotsEl) dotsEl.classList.add('pin-error');
    setTimeout(() => {
      if (dotsEl) dotsEl.classList.remove('pin-error');
      state.pinBuffer = '';
      renderPinDots();
    }, 380);
  }
}

export function pressPinBackspace() {
  state.pinBuffer = state.pinBuffer.slice(0, -1);
  renderPinDots();
}

/* ════════════════════════════════════════════════════════════
   COMMIT — ponto único que persiste mudanças de config e, se o
   dia de hoje foi afetado, mantém missionStatus/memberStars
   coerentes (sem depender de posição — só de `id`).
   ════════════════════════════════════════════════════════════ */
function commitMembersChange() {
  saveConfig();
  state.config.members.forEach(mem => {
    if (!(mem.id in state.memberStars)) state.memberStars[mem.id] = 0;
  });
  persistDayState();
  renderMembersBar();
  renderMissions();
}

// Espelha a lógica de reversão de estrelas de missions.js. Duplicada de
// propósito (poucas linhas) para não acoplar este módulo a missions.js.
function revokeStarsLocal(mission, stars) {
  if (stars <= 0) return;
  const ids = mission.assignee === 'compartilhada' ? state.config.members.map(m => m.id) : [mission.assignee];
  ids.forEach(id => {
    state.memberStars[id] = Math.max(0, (state.memberStars[id] || 0) - stars);
    state.totals[id] = Math.max(0, (state.totals[id] || 0) - stars);
  });
}

function commitMissionsChange() {
  const oldMissions = state.missions; // snapshot de hoje antes da mudança
  saveConfig();
  state.missions = getTodayMissions(); // já vem ordenado por horário

  const newIds = new Set(state.missions.map(mi => mi.id));
  let statusChanged = false;
  oldMissions.forEach(oldMs => {
    if (newIds.has(oldMs.id)) return; // continua existindo hoje, nada a fazer
    const st = state.missionStatus[oldMs.id];
    if (!st) return;
    if (st.status === 'done' && st.stars) revokeStarsLocal(oldMs, st.stars);
    delete state.missionStatus[oldMs.id];
    statusChanged = true;
  });

  if (statusChanged) {
    persistDayState();
    persistTotals();
  }
  renderMembersBar();
  renderMissions();
}

function sortDay(dow) {
  const list = state.config.missionsByDay[dow];
  if (list) list.sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
}

/* ════════════════════════════════════════════════════════════
   PAINEL DOS PAIS
   ════════════════════════════════════════════════════════════ */
export function openParentPanel() {
  activeSubTab = 'membros';
  currentEditDay = todayDow();
  copyTargets = new Set();
  renderParentPanel();
  const overlay = document.getElementById('parent-panel-overlay');
  if (overlay) overlay.style.display = 'flex';
}

export function closeParentPanel() {
  const overlay = document.getElementById('parent-panel-overlay');
  if (overlay) overlay.style.display = 'none';
}

function renderParentPanel() {
  document.querySelectorAll('.pp-subtab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sub === activeSubTab);
  });
  const body = document.getElementById('parent-panel-body');
  if (!body) return;
  if (activeSubTab === 'membros') body.innerHTML = membrosHTML();
  else if (activeSubTab === 'tarefas') body.innerHTML = tarefasHTML();
  else body.innerHTML = ajustesHTML();
}

/* ── MEMBROS ─────────────────────────────────────────────── */
function membrosHTML() {
  const rows = state.config.members.map(mem => `
    <div class="pp-member-row" data-member-id="${mem.id}">
      <input class="pp-input pp-avatar-input" maxlength="2" data-mfield="avatar" value="${mem.avatar}">
      <input class="pp-input pp-name-input" data-mfield="name" value="${mem.name}">
      <select class="pp-input pp-role-select" data-mfield="role">
        <option value="pai" ${mem.role === 'pai' ? 'selected' : ''}>PAI</option>
        <option value="mae" ${mem.role === 'mae' ? 'selected' : ''}>MÃE</option>
        <option value="crianca" ${mem.role === 'crianca' ? 'selected' : ''}>CRIANÇA</option>
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

  const dayMissions = state.config.missionsByDay[currentEditDay] || [];
  const memberOptions = assignee => {
    let opts = `<option value="compartilhada" ${assignee === 'compartilhada' ? 'selected' : ''}>🤝 COMPARTILHADA</option>`;
    state.config.members.forEach(mem => {
      opts += `<option value="${mem.id}" ${assignee === mem.id ? 'selected' : ''}>${mem.avatar} ${mem.name}</option>`;
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

  const copyCheckboxes = DAY_FULL.map((name, i) => {
    if (i === currentEditDay) return '';
    return `
      <label class="pp-copy-check">
        <input type="checkbox" data-copy-target="${i}" ${copyTargets.has(i) ? 'checked' : ''}>
        ${name.slice(0, 3).toUpperCase()}
      </label>`;
  }).join('');

  return `
    <div class="pp-day-selector">${dayBtns}</div>
    <div class="pp-section-title">TAREFAS DE ${DAY_FULL[currentEditDay].toUpperCase()} (${dayMissions.length}) — ordenadas por horário</div>
    ${rows || '<div class="pp-empty">NENHUMA TAREFA CADASTRADA</div>'}
    <button class="pp-btn-add" data-add-mission>+ ADICIONAR TAREFA</button>

    <div class="pp-section-title" style="margin-top:18px">📋 COPIAR TAREFAS DE ${DAY_FULL[currentEditDay].slice(0, 3).toUpperCase()} PARA:</div>
    <div class="pp-copy-grid">${copyCheckboxes}</div>
    <button class="pp-btn-add" id="pp-copy-confirm">COPIAR TAREFAS SELECIONADAS</button>
    <div class="pp-hint">⚠️ Copiar substitui totalmente as tarefas dos dias marcados.</div>`;
}

/* ── AJUSTES ─────────────────────────────────────────────── */
function ajustesHTML() {
  return `
    <div class="pp-section-title">SEGURANÇA</div>
    <label class="pp-field-label">PIN DOS PAIS (4 a 8 dígitos)</label>
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
   EVENTOS (delegação — registrados uma única vez em main.js)
   ════════════════════════════════════════════════════════════ */
export function wireParentPanelEvents() {
  document.querySelectorAll('.pp-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSubTab = btn.dataset.sub;
      copyTargets = new Set();
      renderParentPanel();
    });
  });

  const body = document.getElementById('parent-panel-body');
  if (!body) return;

  body.addEventListener('click', (e) => {
    if (e.target.matches('[data-add-member]')) {
      const id = genId('mem');
      state.config.members.push({ id, name: 'NOVO MEMBRO', avatar: '🧒', role: 'crianca' });
      commitMembersChange();
      renderParentPanel();
    } else if (e.target.matches('[data-remove-member]')) {
      const id = e.target.closest('[data-member-id]').dataset.memberId;
      if (state.config.members.length <= 1) { alert('Precisa ter ao menos 1 membro.'); return; }
      if (!confirm('Remover este membro da família?')) return;
      state.config.members = state.config.members.filter(mem => mem.id !== id);
      delete state.memberStars[id];
      commitMembersChange();
      renderParentPanel();
    } else if (e.target.matches('[data-day-select]')) {
      currentEditDay = Number(e.target.dataset.daySelect);
      copyTargets = new Set();
      renderParentPanel();
    } else if (e.target.matches('[data-add-mission]')) {
      state.config.missionsByDay[currentEditDay] = state.config.missionsByDay[currentEditDay] || [];
      state.config.missionsByDay[currentEditDay].push({
        id: genId('ms'), start: '08:00', end: '08:30', emoji: '⭐',
        title: 'NOVA TAREFA', desc: 'DESCRIÇÃO', assignee: 'compartilhada',
      });
      sortDay(currentEditDay);
      commitMissionsChange();
      renderParentPanel();
    } else if (e.target.matches('[data-remove-mission]')) {
      const idx = Number(e.target.closest('[data-mission-idx]').dataset.missionIdx);
      state.config.missionsByDay[currentEditDay].splice(idx, 1);
      commitMissionsChange();
      renderParentPanel();
    } else if (e.target.id === 'pp-copy-confirm') {
      if (copyTargets.size === 0) { alert('Marque ao menos um dia de destino.'); return; }
      const names = [...copyTargets].map(d => DAY_FULL[d]).join(', ');
      if (!confirm(`Copiar as tarefas de ${DAY_FULL[currentEditDay]} para: ${names}? Isso substitui as tarefas desses dias.`)) return;
      const source = state.config.missionsByDay[currentEditDay] || [];
      copyTargets.forEach(dow => {
        state.config.missionsByDay[dow] = source.map(ms => ({ ...ms, id: genId('ms') }));
        sortDay(dow);
      });
      copyTargets = new Set();
      commitMissionsChange();
      renderParentPanel();
    } else if (e.target.id === 'pp-save-pin') {
      const val = document.getElementById('pp-pin-input').value.trim();
      if (!/^\d{4,8}$/.test(val)) { alert('O PIN deve ter de 4 a 8 números.'); return; }
      state.config.pin = val;
      saveConfig();
      alert('PIN atualizado!');
    } else if (e.target.id === 'pp-reset-data') {
      if (confirm('Isso vai apagar TODOS os dados salvos (membros, tarefas, estrelas, conquistas). Tem certeza?')) {
        resetAllData().then(() => location.reload());
      }
    }
  });

  body.addEventListener('input', (e) => {
    if (!e.target.matches('[data-mfield]')) return;
    const id = e.target.closest('[data-member-id]').dataset.memberId;
    const mem = state.config.members.find(x => x.id === id);
    if (mem) {
      mem[e.target.dataset.mfield] = e.target.value;
      commitMembersChange();
    }
  });

  body.addEventListener('change', (e) => {
    if (e.target.matches('[data-mfield]')) {
      const id = e.target.closest('[data-member-id]').dataset.memberId;
      const mem = state.config.members.find(x => x.id === id);
      if (mem) {
        mem[e.target.dataset.mfield] = e.target.value;
        commitMembersChange();
      }
    } else if (e.target.matches('[data-msfield]')) {
      const idx = Number(e.target.closest('[data-mission-idx]').dataset.missionIdx);
      const mission = state.config.missionsByDay[currentEditDay][idx];
      if (mission) {
        mission[e.target.dataset.msfield] = e.target.value;
        sortDay(currentEditDay);
        commitMissionsChange();
        renderParentPanel();
      }
    } else if (e.target.matches('[data-copy-target]')) {
      const dow = Number(e.target.dataset.copyTarget);
      if (e.target.checked) copyTargets.add(dow); else copyTargets.delete(dow);
    } else if (e.target.id === 'pp-require-approval') {
      state.config.requireApproval = e.target.checked;
      saveConfig();
    }
  });
}
