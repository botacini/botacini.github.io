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

import {
  state, DAY_FULL, DAY_NAMES, ALL_BADGES,
  timeToMin, assigneeIds, dateFromKey, todayKey, isSelectedDateToday,
  TASK_CATEGORIES, taskCategoryFromDescription,
} from './state.js';
import { escapeHtml, safeCssColor, safeNumber } from './html.js';

/* ════════════════ NOME DA FAMÍLIA ════════════════ */
export function updateFamilyName() {
  const el = document.getElementById('header-family-name');
  if (!el) return;
  const name = state.config?.familyName || '';
  el.textContent = name ? ` · ${name}` : '';
}

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

function selectedDateKey() {
  return state.selectedDate || state.today || todayKey();
}

function selectedDateLabel() {
  const day = dateFromKey(selectedDateKey()).getDay();
  return DAY_FULL[day].toUpperCase();
}

function dayMonthLabel(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function renderDateNav() {
  const selected = dateFromKey(selectedDateKey());
  const sunday = new Date(selected);
  sunday.setDate(selected.getDate() - selected.getDay());

  return `
    <div class="day-nav" aria-label="Navegação por data">
        <button class="week-nav-btn" data-week-shift="-7" aria-label="Semana anterior">‹</button>
        ${DAY_NAMES.map((label, index) => {
          const day = new Date(sunday);
          day.setDate(sunday.getDate() + index);
          const key = todayKey(day);
          const active = key === selectedDateKey();
          return `<button class="day-nav-btn${active ? ' active' : ''}" data-date-key="${key}" aria-pressed="${active ? 'true' : 'false'}">
            <span class="day-nav-date">${dayMonthLabel(day)}</span>
            <span class="day-nav-name">${label}</span>
          </button>`;
        }).join('')}
        <button class="week-nav-btn" data-week-shift="7" aria-label="Próxima semana">›</button>
    </div>`;
}

function renderDayBanner() {
  return `<div class="day-banner">${selectedDateLabel()}</div>`;
}

/* ════════════════ BARRA DE MEMBROS (HEADER) ════════════════ */
export function renderMembersBar() {
  const bar = document.getElementById('members-bar');
  if (!bar) return;
  const progressByMember = new Map(calculateProgress().individual.map(item => [item.memberId, item.pct]));
  bar.innerHTML = state.config.members.map(mem => `
    <div class="member-pill" style="border-color:${safeCssColor(mem.color)};background:${safeCssColor(mem.color)}22">
      <span class="pill-avatar">${escapeHtml(mem.avatar)}</span>
      <span class="pill-name">${escapeHtml(mem.name)}</span>
      <span class="pill-progress">${progressByMember.get(mem.id) === null ? '—' : `${progressByMember.get(mem.id)}%`}</span>
    </div>`).join('');
}

const TIMELINE_DEFAULT_START = 6 * 60;
const TIMELINE_DEFAULT_END = 22 * 60;
const TIMELINE_STEP = 5;

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function calculateProgress() {
  const members = state.config?.members || [];
  const individual = members.map(member => {
    const missions = state.missions.filter(mission => assigneeIds(mission).includes(member.id));
    const done = missions.filter(mission => state.missionStatus[mission.id]?.status === 'done').length;
    return {
      memberId: member.id,
      done,
      total: missions.length,
      pct: missions.length ? Math.round((done / missions.length) * 100) : null
    };
  });
  const active = individual.filter(item => item.pct !== null);
  const familyPct = active.length
    ? Math.round(active.reduce((sum, item) => sum + item.pct, 0) / active.length)
    : 0;
  return { individual, familyPct };
}

/* ════════════════ AGENDA COMPARTILHADA POR TEMPO ════════════════ */
export function renderMissions() {
  const container = document.getElementById('mission-list');
  if (!container) return;

  updateProgress();
  updateHeaderStarsDisplay();

  const readonly = !isSelectedDateToday();
  const members = state.config.members;

  let boardHTML;
  if (members.length === 0) {
    boardHTML = `<div class="empty-state">
      <span class="empty-state-icon">👨‍👩‍👧‍👦</span>
      Adicione os membros da família na aba <strong>TIME</strong> para começar.
    </div>`;
  } else {
    boardHTML = renderTimelineBoard(members, readonly);
  }

  container.innerHTML = `
    ${renderDateNav()}
    ${renderDayBanner()}
    ${boardHTML}
  `;
}

export function refreshMissionStatus(missionId) {
  updateProgress();
  updateHeaderStarsDisplay();
  renderMembersBar();

  const status = state.missionStatus[missionId]?.status;
  const currentId = getCurrentMissionId();
  document.querySelectorAll('.timeline-task').forEach(card => {
    if (card.dataset.missionId !== missionId) return;
    card.classList.toggle('done', status === 'done');
    card.classList.toggle('fail', status === 'fail');
    card.classList.toggle('current', currentId === missionId && !status);
    card.querySelector('.task-done')?.classList.toggle('active', status === 'done');
    card.querySelector('.task-fail')?.classList.toggle('active', status === 'fail');
  });
}

function renderTimelineBoard(members, readonly) {
  const currentId = getCurrentMissionId();
  const starts = state.missions.map(mission => timeToMin(mission.start));
  const ends = state.missions.map(mission => timeToMin(mission.end));
  const timelineStart = starts.length ? Math.floor(Math.min(...starts) / TIMELINE_STEP) * TIMELINE_STEP : TIMELINE_DEFAULT_START;
  const timelineEnd = ends.length ? Math.ceil(Math.max(...ends) / TIMELINE_STEP) * TIMELINE_STEP : TIMELINE_DEFAULT_END;
  const slotCount = Math.max(1, Math.ceil((timelineEnd - timelineStart) / TIMELINE_STEP));
  const headers = members.map(member => `
    <div class="timeline-member-header" style="--member-color:${safeCssColor(member.color)}">
      <span>${escapeHtml(member.avatar)}</span>
      <strong>${escapeHtml(member.name)}</strong>
      <button class="timeline-add-btn" data-add-task-member="${escapeHtml(member.id)}" data-add-task-date="${escapeHtml(selectedDateKey())}" aria-label="Adicionar tarefa para ${escapeHtml(member.name)}">＋</button>
    </div>`).join('');
  const timeLabels = Array.from({ length: slotCount + 1 }, (_, slot) => {
    const minute = timelineStart + slot * TIMELINE_STEP;
    return `<div class="timeline-time-label" style="grid-row:${slot + 2}">${formatMinutes(minute)}</div>`;
  }).join('');
  const cards = state.missions.flatMap(ms => {
    const participantIds = assigneeIds(ms);
    const participantIndexes = participantIds
      .map(id => members.findIndex(member => member.id === id))
      .filter(index => index >= 0)
      .sort((a, b) => a - b);
    if (!participantIndexes.length) return [];
    const startSlot = Math.max(0, Math.floor((timeToMin(ms.start) - timelineStart) / TIMELINE_STEP));
    const durationMinutes = Math.max(0, timeToMin(ms.end) - timeToMin(ms.start));
    const durationSlots = Math.max(1, Math.ceil(durationMinutes / TIMELINE_STEP));
    const densityClass = durationMinutes === 15
      ? ' timeline-task--compact'
      : durationMinutes < 15
        ? ' timeline-task--ultra'
        : '';
    const st = state.missionStatus[ms.id];
    const doneClass = st?.status === 'done' ? ' done' : '';
    const failClass = st?.status === 'fail' ? ' fail' : '';
    const currentClass = currentId === ms.id && !st ? ' current' : '';
    const isShared = participantIds.length > 1;
    const category = TASK_CATEGORIES.find(item => item.id === taskCategoryFromDescription(ms.desc))
      || TASK_CATEGORIES[TASK_CATEGORIES.length - 1];

    const missionId = escapeHtml(ms.id);
    const menuId = `task-menu-${missionId}`;
    return participantIndexes.map((participantIndex, cardIndex) => `
      <div class="task-cell timeline-task${densityClass}${doneClass}${failClass}${currentClass}${isShared ? ' shared-task' : ''}"
        style="--category-color:${safeCssColor(category.color)};grid-column:${participantIndex + 2};grid-row:${startSlot + 2}/span ${durationSlots}"
        data-mission-id="${missionId}" data-duration-minutes="${durationMinutes}" data-duration-slots="${durationSlots}">
        <div class="task-header">
          <span class="task-time">${escapeHtml(ms.start)}–${escapeHtml(ms.end)}</span>
          ${cardIndex === 0 ? `<div class="task-menu-wrapper">
            <button class="task-menu-btn" data-open-task-menu="${missionId}" title="Opções">⋯</button>
            <div class="task-dropdown" id="${menuId}">
              <button class="task-dropdown-item" data-edit-mission="${missionId}">✏️ Editar</button>
              <button class="task-dropdown-item danger" data-delete-mission="${missionId}" data-delete-scope="occurrence">✕ Excluir esta ocorrência</button>
              <button class="task-dropdown-item danger" data-delete-mission="${missionId}" data-delete-scope="series">✕ Excluir série</button>
            </div>
          </div>` : ''}
        </div>
        <div class="task-content">
          <div class="task-emoji">${escapeHtml(ms.emoji)}</div>
          <div class="task-body">
            <div class="task-title">${escapeHtml(ms.title)}</div>
            <div class="task-meta">
              <span class="task-category">${escapeHtml(category.name)}</span>
              ${isShared ? `<span class="task-shared-label">◉ ${participantIds.length}</span>` : ''}
            </div>
          </div>
          <div class="task-actions">
            <button class="task-btn task-done${st?.status === 'done' ? ' active' : ''}" data-mission-action="done" data-mission-id="${missionId}" ${readonly ? 'disabled aria-disabled="true"' : ''}>✓</button>
            <button class="task-btn task-fail${st?.status === 'fail' ? ' active' : ''}" data-mission-action="fail" data-mission-id="${missionId}" ${readonly ? 'disabled aria-disabled="true"' : ''}>✕</button>
          </div>
        </div>
      </div>`);
  }).join('');
  return `
    <div class="timeline-scroll">
      <div class="timeline-board${readonly ? ' consultation-mode' : ''}"
        style="--member-count:${members.length};--slot-count:${slotCount}">
        <div class="timeline-corner">HORA</div>
        ${headers}
        <div class="timeline-grid-bg"></div>
        ${timeLabels}
        ${cards}
      </div>
    </div>`;
}

function updateProgress() {
  const { individual, familyPct } = calculateProgress();

  const label = document.getElementById('prog-label');
  const pctEl = document.getElementById('prog-pct');
  if (label) label.textContent = familyPct === 100 ? 'FAMÍLIA NA LINHA DE CHEGADA!' : 'PROGRESSO DA FAMÍLIA';
  if (pctEl) pctEl.textContent = `${familyPct}%`;

  const car = document.getElementById('car-avatar');
  if (car) car.style.left = `calc(${familyPct}% - ${familyPct * 0.28}px)`;
  const individualEl = document.getElementById('individual-progress');
  if (individualEl) {
    individualEl.innerHTML = individual.map(item => {
      const member = state.config.members.find(candidate => candidate.id === item.memberId);
      const pct = item.pct ?? 0;
      return `<div class="individual-progress-row">
        <span>${escapeHtml(member?.avatar || '👤')} ${escapeHtml(member?.name || '')}</span>
        <div class="mini-progress-track"><span style="width:${pct}%"></span></div>
        <strong>${item.pct === null ? '—' : `${item.pct}%`}</strong>
      </div>`;
    }).join('');
  }

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
  el.textContent = safeNumber(state.familyWallet?.balance);
}

/* ════════════════ ABA ESTRELAS ════════════════ */
export function renderStarsTab() {
  const totalEl = document.getElementById('team-stars-count');
  const barEl = document.getElementById('stars-goal-bar');
  const goalEl = document.getElementById('team-stars-goal');
  const grid = document.getElementById('member-stars-grid');
  if (!totalEl || !grid) return;

  const total = safeNumber(state.familyWallet?.balance);
  const goal = state.config.teamStarsGoal || 20;
  totalEl.textContent = total;
  if (barEl) barEl.style.width = Math.min(100, Math.round((total / goal) * 100)) + '%';
  if (goalEl) goalEl.textContent = `META DA SEMANA: ${goal} ⭐`;

  grid.innerHTML = state.config.members.map(mem => `
      <div class="member-star-card">
      <div class="member-star-avatar">${escapeHtml(mem.avatar)}</div>
      <div class="member-star-name">${escapeHtml(mem.name)}</div>
      <div class="member-star-count">⭐ ${safeNumber(state.memberStars[mem.id])}</div>
      <div class="member-star-sub">CONTRIBUIÇÃO · ${isSelectedDateToday() ? 'HOJE' : selectedDateLabel()}</div>
    </div>`).join('');

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
  const progressByMember = new Map(calculateProgress().individual.map(item => [item.memberId, item]));

  const memberCards = state.config.members.map(mem => {
    const progress = progressByMember.get(mem.id) || { done: 0, total: 0, pct: null };
    return `
      <div class="team-member-card" style="border-left:4px solid ${safeCssColor(mem.color)}">
        <span class="team-member-avatar">${escapeHtml(mem.avatar)}</span>
        <div class="team-member-info">
          <div class="team-member-name">${escapeHtml(mem.name)}</div>
          <span class="role-badge role-${ROLE_LABEL[mem.role] ? mem.role : 'crianca'}">${ROLE_LABEL[mem.role] || 'MEMBRO'}</span>
        </div>
        <div class="team-member-stats">
          <div class="team-member-progress">${progress.pct === null ? '—' : `${progress.pct}%`}</div>
          <div class="team-member-done">${progress.done}/${progress.total} CONCLUÍDAS</div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = memberCards + `
    <button id="btn-add-member-shortcut" class="team-member-card team-add-card">
      <span class="team-member-avatar">➕</span>
      <div class="team-member-info"><div class="team-member-name">ADICIONAR MEMBRO</div></div>
    </button>`;
}

/* ════════════════ ABA CONQUISTAS (FIXAS + METAS PERSONALIZADAS) ════════════════ */
export function renderBadges() {
  const grid = document.getElementById('badge-grid');
  if (!grid) return;

  const fixedBadgesHTML = ALL_BADGES.map(goal => {
    const unlocked = state.badgesUnlocked.includes(goal.id);
    return `
      <div class="badge-card${unlocked ? ' unlocked' : ''}">
        <div class="badge-icon">${goal.icon}</div>
        <div class="badge-name">${goal.name}</div>
        <div class="badge-desc">${goal.desc}</div>
      </div>`;
  }).join('');

  const customGoalsHTML = (state.config.customGoals || []).map(goal => {
    const redeemed = !!goal.redeemed;
    const label = redeemed ? 'Cancelar conquista' : 'Resgatar conquista';

    return `
      <div class="badge-card custom-goal ${redeemed ? 'claimed' : 'pending'}">
        <button class="badge-delete-btn" data-delete-goal="${escapeHtml(goal.id)}" title="Remover conquista">✕</button>
        <div class="badge-icon">${escapeHtml(goal.icon)}</div>
        <div class="badge-name">${escapeHtml(goal.name)}</div>
        <div class="badge-desc">${escapeHtml(goal.desc || 'Meta personalizada')}</div>
        <div class="badge-state">${redeemed ? 'RESGATADA' : 'NÃO RESGATADA'}</div>
        <button class="badge-action" data-goal-action="toggle" data-goal-id="${escapeHtml(goal.id)}">${label}</button>
      </div>`;
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
    const pct = info ? safeNumber(info.pct, null) : null;
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
