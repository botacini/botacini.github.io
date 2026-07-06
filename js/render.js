/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — render.js
   ════════════════════════════════════════════════════════════
   Responsabilidade única: pintar a interface a partir do que
   está em `state` (state.js). Não decide nada, não persiste
   nada, não muda estrelas nem status — só lê e desenha. As
   únicas mutações de estado feitas aqui são as puramente
   visuais (ex: qual aba está ativa), que não precisam ser
   persistidas.
   ════════════════════════════════════════════════════════════ */

import { state, DAY_FULL, ALL_BADGES, timeToMin, assigneeIds } from './state.js';

/* ════════════════ RELÓGIO ════════════════ */
export function updateClock() {
  const el = document.getElementById('live-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
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

/* ════════════════ BARRA DE MEMBROS (HEADER) ════════════════
   Mostra apenas as estrelas de hoje de cada um — sem filtro,
   já que o kanban mostra todas as colunas de uma vez. */
export function renderMembersBar() {
  const bar = document.getElementById('members-bar');
  if (!bar) return;
  bar.innerHTML = state.config.members.map(mem => `
    <div class="member-pill" style="border-color:${mem.color};background:${mem.color}22">
      <span class="pill-avatar">${mem.avatar}</span>
      <span class="pill-name">${mem.name}</span>
      <span class="pill-stars">⭐${state.memberStars[mem.id] || 0}</span>
    </div>`).join('');
}

/* ════════════════ QUADRO DE TAREFAS (NOVO: KANBAN POR MEMBRO) ════════════════ */
export function renderMissions() {
  const container = document.getElementById('mission-list');
  if (!container) return;

  updateProgress();
  updateHeaderStarsDisplay();

  if (state.missions.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">🏁</span>Nenhuma tarefa para hoje.</div>`;
    return;
  }

  // Quadro kanban: coluna por membro
  const html = `
    <div class="missions-board">
      ${state.config.members.map(mem => renderMemberColumn(mem)).join('')}
    </div>`;
  container.innerHTML = html;
}

function renderMemberColumn(member) {
  const currentId = getCurrentMissionId();
  // Tarefas que envolvem este membro (atribuídas a ele ou compartilhadas)
  const memberMissions = state.missions.filter(ms => 
    assigneeIds(ms).includes(member.id)
  );

  const rows = memberMissions.map((ms, idx) => {
    const st = state.missionStatus[ms.id];
    const doneClass = st?.status === 'done' ? ' done' : '';
    const failClass = st?.status === 'fail' ? ' fail' : '';
    const currentClass = currentId === ms.id && !st ? ' current' : '';
    const sharedMemberIds = assigneeIds(ms);
    const isShared = sharedMemberIds.length > 1;

    return `
      <div class="task-cell${doneClass}${failClass}${currentClass}${isShared ? ' shared-task' : ''}" data-mission-id="${ms.id}">
        <div class="task-time">
          <span class="task-start">${ms.start}</span>
          <span class="task-end">${ms.end}</span>
        </div>
        <div class="task-emoji">${ms.emoji}</div>
        <div class="task-body">
          <div class="task-title">${ms.title}</div>
          <div class="task-desc">${ms.desc}</div>
        </div>
        <div class="task-actions">
          <button class="task-btn task-done${st?.status === 'done' ? ' active' : ''}" data-mission-action="done" data-mission-id="${ms.id}">✓</button>
          <button class="task-btn task-fail${st?.status === 'fail' ? ' active' : ''}" data-mission-action="fail" data-mission-id="${ms.id}">✕</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="board-column" style="--member-color:${member.color || '#ccc'}">
      <div class="column-header">
        <span class="column-avatar">${member.avatar}</span>
        <span class="column-name">${member.name}</span>
        <span class="column-stars">⭐${state.memberStars[member.id] || 0}</span>
      </div>
      <div class="column-tasks">
        ${rows || '<div class="column-empty">— sem tarefas hoje</div>'}
      </div>
    </div>`;
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
      <div class="member-star-avatar">${mem.avatar}</div>
      <div class="member-star-name">${mem.name}</div>
      <div class="member-star-count">⭐ ${state.memberStars[mem.id] || 0}</div>
      <div class="member-star-sub">HOJE</div>
    </div>`).join('');
}

/* ════════════════ ABA TIME ════════════════ */
const ROLE_LABEL = { pai: 'PAI', mae: 'MÃE', crianca: 'CRIANÇA' };

export function renderTeamTab() {
  const container = document.getElementById('team-cards');
  if (!container) return;

  container.innerHTML = state.config.members.map(mem => {
    const doneCount = state.missions.filter(ms =>
      assigneeIds(ms).includes(mem.id) &&
      state.missionStatus[ms.id]?.status === 'done'
    ).length;
    return `
      <div class="team-member-card" style="border-left:4px solid ${mem.color}">
        <span class="team-member-avatar">${mem.avatar}</span>
        <div class="team-member-info">
          <div class="team-member-name">${mem.name}</div>
          <span class="role-badge role-${mem.role}">${ROLE_LABEL[mem.role] || mem.role.toUpperCase()}</span>
        </div>
        <div class="team-member-stats">
          <div class="team-member-stars">⭐ ${state.memberStars[mem.id] || 0}</div>
          <div class="team-member-done">${doneCount} TAREFAS HOJE</div>
        </div>
      </div>`;
  }).join('');
}

/* ════════════════ ABA CONQUISTAS (FIXAS + METAS PERSONALIZADAS) ════════════════ */
export function renderBadges() {
  const grid = document.getElementById('badge-grid');
  if (!grid) return;

  // Todas as conquistas: fixas (ALL_BADGES) + personalizadas (customGoals)
  const allGoals = [
    ...ALL_BADGES,
    ...(state.config.customGoals || [])
  ];

  grid.innerHTML = allGoals.map(goal => {
    const unlocked = state.badgesUnlocked.includes(goal.id);
    const progress = goal.type === 'member_stars'
      ? (state.totals[goal.memberId] || 0)
      : Object.values(state.totals).reduce((a, b) => a + b, 0);
    const pct = goal.target ? Math.round((progress / goal.target) * 100) : 0;

    return `
      <div class="badge-card${unlocked ? ' unlocked' : ''}">
        <div class="badge-icon">${goal.icon}</div>
        <div class="badge-name">${goal.name}</div>
        <div class="badge-desc">${goal.desc}</div>
        ${goal.target ? `<div class="badge-progress">${progress}/${goal.target}</div>` : ''}
      </div>`;
  }).join('');
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
    if (pct !== null && pct !== undefined) { pctSum += pct; pctCount++; }

    rows += `
      <div class="day-row">
        <span class="day-name">${DAY_FULL[dow].slice(0, 3).toUpperCase()}</span>
        <div class="progress-track" style="flex:1">
          <div class="progress-fill" style="width:${pct ?? 0}%"></div>
        </div>
        <span style="font-size:11px;color:var(--muted);min-width:36px;text-align:right">${pct !== null && pct !== undefined ? pct + '%' : '—'}</span>
      </div>`;
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
  missions: () => { renderMembersBar(); renderMissions(); },
  stars: renderStarsTab,
  team: renderTeamTab,
  badges: renderBadges,
  week: renderWeek,
};

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
