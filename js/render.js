/* ════════════════════════════════════════════════════════════ GP DA FAMÍLIA — render.js ════════════════════════════════════════════════════════════
   Responsabilidade única: pintar a interface a partir do que está em `state`
   (state.js). Não decide nada, não persiste nada, não muda estrelas nem status —
   só lê e desenha. As únicas mutações de estado feitas aqui são as puramente
   visuais (ex: qual aba está ativa), que não precisam ser persistidas.
   ════════════════════════════════════════════════════════════ */
import {
  state,
  DAY_FULL,
  DAY_NAMES,
  ALL_BADGES,
  timeToMin,
  assigneeIds,
  dateFromKey,
  todayKey,
  isSelectedDateToday,
} from './state.js';

/* ════════════════ RELÓGIO ════════════════ */
export function updateClock() {
  const el = document.getElementById('live-clock');
  if (!el) return;
  const now = new Date();
  el.textContent =
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');
}

function nowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function getCurrentMissionId() {
  const n = nowMin();
  let current = null;
  state.missions.forEach(ms => {
    if (n >= timeToMin(ms.start) && n < timeToMin(ms.end)) current = ms.id;
  });
  return current;
}

function selectedDateKey() {
  return state.selectedDate || state.today || todayKey();
}

function selectedDateLabel() {
  const day = dateFromKey(selectedDateKey()).getDay();
  return DAY_FULL[day].toUpperCase();
}

function renderDateNav() {
  const selected = dateFromKey(selectedDateKey());
  const sunday = new Date(selected);
  sunday.setDate(selected.getDate() - selected.getDay());
  return `
    <div class="date-nav">
      ${DAY_NAMES.map((label, index) => {
        const day = new Date(sunday);
        day.setDate(sunday.getDate() + index);
        const key = todayKey(day);
        const active = key === selectedDateKey();
        return `<button class="date-nav-btn${active ? ' active' : ''}" data-date-key="${key}">${label}</button>`;
      }).join('')}
    </div>
  `;
}

function renderDayBanner() {
  return `
    <div class="day-banner">
      <span>${selectedDateLabel()}</span>
    </div>
  `;
}

/* ════════════════ BARRA DE MEMBROS (HEADER) ════════════════
   Mostra apenas as estrelas de hoje de cada um — sem filtro, já que o kanban
   mostra todas as colunas de uma vez. */
export function renderMembersBar() {
  const bar = document.getElementById('members-bar');
  if (!bar) return;
  bar.innerHTML = state.config.members.map(mem => `
    <div class="member-pill">
      ${mem.avatar} ${mem.name} ⭐${state.memberStars[mem.id] || 0}
    </div>
  `).join('');
}

/* ════════════════ QUADRO DE TAREFAS (KANBAN POR MEMBRO) ════════════════ */
export function renderMissions() {
  const container = document.getElementById('mission-list');
  if (!container) return;
  updateProgress();
  updateHeaderStarsDisplay();
  const readonly = !isSelectedDateToday();

  // CORREÇÃO: SEMPRE exibe a estrutura do board, mesmo sem membros ou tarefas
  const members = state.config.members || [];
  const boardHTML = `
    <div class="mission-board">
      ${members.length === 0
        ? `<div class="empty-members-message">👨‍👩‍👧‍👦 Adicione os membros da família para lhes atribuir tarefas.</div>`
        : members.map(mem => renderMemberColumn(mem)).join('')
      }
    </div>
  `;

  container.innerHTML = `
    ${renderDateNav()}
    ${renderDayBanner()}
    ${boardHTML}
  `;
}

function renderMemberColumn(member) {
  const currentId = getCurrentMissionId();
  const readonly = !isSelectedDateToday();

  // Filtra as tarefas deste membro
  const memberMissions = state.missions.filter(ms =>
    assigneeIds(ms).includes(member.id)
  );

  // Linhas de tarefas (ou mensagem de vazio)
  const rows = memberMissions.length === 0
    ? `<div class="no-tasks-message">— sem tarefas hoje</div>`
    : memberMissions.map((ms) => {
        const st = state.missionStatus[ms.id];
        const doneClass = st?.status === 'done' ? ' done' : '';
        const failClass = st?.status === 'fail' ? ' fail' : '';
        const currentClass = currentId === ms.id && !st ? ' current' : '';
        const sharedMemberIds = assigneeIds(ms);
        const isShared = sharedMemberIds.length > 1;
        return `
          <div class="mission-row${doneClass}${failClass}${currentClass}" data-mission-id="${ms.id}">
            <div class="mission-time">${ms.start} - ${ms.end}</div>
            <div class="mission-actions">
              ${!isShared && !readonly ? `<button class="mission-delete" data-delete-mission="${ms.id}">✕</button>` : ''}
            </div>
            <div class="mission-content">
              <span class="mission-emoji">${ms.emoji}</span>
              <span class="mission-title">${ms.title}</span>
              <span class="mission-desc">${ms.desc}</span>
            </div>
            <div class="mission-status-buttons">
              <button class="mission-done" data-mission-action="done" data-mission-id="${ms.id}">✓</button>
              <button class="mission-fail" data-mission-action="fail" data-mission-id="${ms.id}">✕</button>
            </div>
          </div>
        `;
      }).join('');

  // CORREÇÃO: botão "Adicionar tarefa" SEMPRE visível, mas desabilitado se não houver membros
  const addBtnDisabled = state.config.members.length === 0 ? 'disabled' : '';
  const addBtnTitle = state.config.members.length === 0
    ? 'Adicione membros antes de criar tarefas'
    : '';

  return `
    <div class="member-column">
      <div class="member-column-header">
        <span class="member-avatar">${member.avatar}</span>
        <span class="member-name">${member.name}</span>
        <span class="member-stars">⭐${state.memberStars[member.id] || 0}</span>
      </div>
      <div class="member-column-body">
        ${rows}
        ${!readonly ? `
          <button class="add-task-btn" data-add-task-member="${member.id}" ${addBtnDisabled} title="${addBtnTitle}">
            ➕ Adicionar tarefa
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function updateProgress() {
  const total = state.missions.length;
  const done = state.missions.filter(ms => state.missionStatus[ms.id]?.status === 'done').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const label = document.getElementById('prog-label');
  const pctEl = document.getElementById('prog-pct');
  const bar = document.getElementById('prog-bar');
  if (label) label.textContent = `${done} DE ${total} TAREFAS ✅`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (bar) bar.style.width = pct + '%';
  const car = document.getElementById('car-avatar');
  if (car) car.style.left = pct + '%';
  const finalizeBtn = document.getElementById('btn-finalize');
  if (finalizeBtn) finalizeBtn.disabled = !isSelectedDateToday();
  if (finalizeBtn) finalizeBtn.classList.toggle('is-readonly', !isSelectedDateToday());
  const weekBtn = document.getElementById('btn-finalize-week');
  if (weekBtn) weekBtn.disabled = !isSelectedDateToday();
  if (weekBtn) weekBtn.classList.toggle('is-readonly', !isSelectedDateToday());
}

function updateHeaderStarsDisplay() {
  const el = document.getElementById('header-team-stars');
  if (!el) return;
  const total = Object.values(state.memberStars).reduce((a, b) => a + b, 0);
  el.textContent = total;
}

/* ════════════════ ABA ESTRELAS ════════════════ */
export function renderStarsTab() {
  const totalEl = document.getElementById('team-stars-count');
  const barEl = document.getElementById('stars-goal-bar');
  const goalEl = document.getElementById('team-stars-goal');
  const grid = document.getElementById('member-stars-grid');
  if (!totalEl || !grid) return;
  const total = Object.values(state.memberStars).reduce((a, b) => a + b, 0);
  const goal = state.config.teamStarsGoal || 20;
  totalEl.textContent = total;
  if (barEl) barEl.style.width = Math.min(100, Math.round((total / goal) * 100)) + '%';
  if (goalEl) goalEl.textContent = `META DA SEMANA: ${goal} ⭐`;
  grid.innerHTML = state.config.members.map(mem => `
    <div class="member-star-card">
      <span class="member-avatar">${mem.avatar}</span>
      <span class="member-name">${mem.name}</span>
      <span class="member-stars">⭐ ${state.memberStars[mem.id] || 0}</span>
      <span class="member-day-label">${isSelectedDateToday() ? 'HOJE' : selectedDateLabel()}</span>
    </div>
  `).join('');

  // Botão de atalho fora do grid
  const starsPanel = document.getElementById('panel-stars');
  if (starsPanel) {
    let shortcutBtn = document.getElementById('btn-bonus-shortcut');
    if (!shortcutBtn) {
      shortcutBtn = document.createElement('button');
      shortcutBtn.id = 'btn-bonus-shortcut';
      shortcutBtn.className = 'btn-finalize-week';
      shortcutBtn.style.marginTop = '14px';
      shortcutBtn.textContent = '⭐ CONCEDER BÔNUS / PENALIDADE';
      starsPanel.appendChild(shortcutBtn);
    }
  }
}

/* ════════════════ ABA TIME ════════════════ */
const ROLE_LABEL = { pai: 'PAI', mae: 'MÃE', crianca: 'CRIANÇA' };

export function renderTeamTab() {
  const container = document.getElementById('team-cards');
  if (!container) return;

  const memberCards = state.config.members.map(mem => {
    const doneCount = state.missions.filter(ms =>
      assigneeIds(ms).includes(mem.id) &&
      state.missionStatus[ms.id]?.status === 'done'
    ).length;
    return `
      <div class="team-card">
        <span class="member-avatar">${mem.avatar}</span>
        <span class="member-name">${mem.name}</span>
        <span class="member-role">${ROLE_LABEL[mem.role] || mem.role.toUpperCase()}</span>
        <span class="member-stars">⭐ ${state.memberStars[mem.id] || 0}</span>
        <span class="member-tasks">${doneCount} TAREFAS ${isSelectedDateToday() ? 'HOJE' : 'NO DIA'}</span>
      </div>
    `;
  }).join('');

  container.innerHTML = memberCards + `
    <button class="add-member-btn" id="btn-add-member-shortcut">
      ➕ ADICIONAR MEMBRO
    </button>
  `;
}

/* ════════════════ ABA CONQUISTAS (FIXAS + METAS PERSONALIZADAS) ════════════════ */
export function renderBadges() {
  const grid = document.getElementById('badge-grid');
  if (!grid) return;

  const fixedBadgesHTML = ALL_BADGES.map(goal => {
    const unlocked = state.badgesUnlocked.includes(goal.id);
    return `
      <div class="badge-card${unlocked ? ' unlocked' : ' locked'}">
        <span class="badge-icon">${goal.icon}</span>
        <span class="badge-name">${goal.name}</span>
        <span class="badge-desc">${goal.desc}</span>
        <span class="badge-status">${unlocked ? '✅ DESBLOQUEADA' : '🔒 BLOQUEADA'}</span>
      </div>
    `;
  }).join('');

  const customGoalsHTML = (state.config.customGoals || []).map(goal => {
    const redeemed = !!goal.redeemed;
    const label = redeemed ? 'Cancelar conquista' : 'Resgatar conquista';
    return `
      <div class="badge-card custom-goal${redeemed ? ' redeemed' : ''}">
        <button class="badge-delete" data-delete-goal="${goal.id}">✕</button>
        <span class="badge-icon">${goal.icon}</span>
        <span class="badge-name">${goal.name}</span>
        <span class="badge-desc">${goal.desc || 'Meta personalizada'}</span>
        <span class="badge-status">${redeemed ? 'RESGATADA' : 'NÃO RESGATADA'}</span>
        <button class="badge-redeem" data-goal-action="${goal.id}">${label}</button>
      </div>
    `;
  }).join('');

  grid.innerHTML = fixedBadgesHTML + customGoalsHTML;

  // Botão de atalho fora do grid
  const badgesPanel = document.getElementById('panel-badges');
  if (badgesPanel) {
    let shortcutBtn = document.getElementById('btn-add-goal-shortcut');
    if (!shortcutBtn) {
      shortcutBtn = document.createElement('button');
      shortcutBtn.id = 'btn-add-goal-shortcut';
      shortcutBtn.className = 'btn-finalize-week';
      shortcutBtn.style.marginTop = '14px';
      shortcutBtn.textContent = '🏆 CRIAR NOVA CONQUISTA';
      badgesPanel.appendChild(shortcutBtn);
    }
  }
}

/* ════════════════ ABA SEMANA ════════════════ */
export function renderWeek() {
  const daysEl = document.getElementById('week-days');
  const avgBox = document.getElementById('week-avg-box');
  const avgNum = document.getElementById('week-avg-num');
  const avgSub = document.getElementById('week-avg-sub');
  if (!daysEl) return;

  const days = state.weekState?.days || {};
  const monday = new Date(state.weekState.weekKey + 'T00:00:00');
  let rows = '';
  let pctSum = 0;
  let pctCount = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dow = d.getDay();
    const info = days[key];
    const pct = info ? info.pct : null;
    if (pct !== null && pct !== undefined) {
      pctSum += pct;
      pctCount++;
    }
    rows += `
      <div class="week-day">
        <span class="week-day-label">${DAY_FULL[dow].slice(0, 3).toUpperCase()}</span>
        <span class="week-day-pct">${pct !== null && pct !== undefined ? pct + '%' : '—'}</span>
      </div>
    `;
  }

  daysEl.innerHTML = rows;

  if (pctCount > 0 && avgBox && avgNum && avgSub) {
    avgBox.style.display = 'block';
    avgNum.textContent = Math.round(pctSum / pctCount) + '%';
    avgSub.textContent = state.weekState.finalized ? 'SEMANA FINALIZADA' : 'MÉDIA DA SEMANA ATÉ AGORA';
  } else if (avgBox) {
    avgBox.style.display = 'none';
  }
}

/* ════════════════ TROCA DE ABAS ════════════════ */
const TAB_RENDERERS = {
  missions: () => {
    renderMembersBar();
    renderMissions();
  },
  stars: renderStarsTab,
  team: renderTeamTab,
  badges: renderBadges,
  week: renderWeek,
};

export function renderDashboard() {
  renderMembersBar();
  renderMissions();
  renderStarsTab();
  renderTeamTab();
  renderBadges();
  renderWeek();
}

export function switchTab(tab) {
  Object.keys(TAB_RENDERERS).forEach(t => {
    const panel = document.getElementById('panel-' + t);
    const btn = document.getElementById('tab-' + t);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', t === tab);
  });
  const renderer = TAB_RENDERERS[tab];
  if (renderer) renderer();
}

window.addEventListener('gp:switch-tab', (e) => switchTab(e.detail));