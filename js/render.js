import { state, ALL_BADGES, DAY_NAMES } from './state.js';
import { getMemberById, getTotalTeamStars, setMissionStatus } from './missions.js';

/* ════════════════════════════════════════════════════════════
   RELÓGIO
   ════════════════════════════════════════════════════════════ */
export function updateClock() {
  const n = new Date();
  document.getElementById('live-clock').textContent =
    String(n.getHours()).padStart(2, '0') + ':' +
    String(n.getMinutes()).padStart(2, '0');
}

export function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function getCurrentIdx() {
  const n = new Date();
  const cur = n.getHours() * 60 + n.getMinutes();

  for (let i = 0; i < state.missions.length; i++) {
    if (
      cur >= timeToMin(state.missions[i].start) &&
      cur < timeToMin(state.missions[i].end)
    ) {
      return i;
    }
  }

  if (state.missions.length > 0 && cur < timeToMin(state.missions[0].start))
    return 0;

  return state.missions.length - 1;
}

/* ════════════════════════════════════════════════════════════
   ABAS
   ════════════════════════════════════════════════════════════ */

export function switchTab(tab) {
  ['missions', 'stars', 'team', 'badges', 'week'].forEach(t => {
    const p = document.getElementById('panel-' + t);
    const b = document.getElementById('tab-' + t);

    if (p) p.style.display = t === tab ? '' : 'none';
    if (b) b.classList.toggle('active', t === tab);
  });

  if (tab === 'week') renderWeek();
  if (tab === 'badges') renderBadges();
  if (tab === 'stars') renderStarsTab();
  if (tab === 'team') renderTeamTab();
}

window.addEventListener('gp:switch-tab', e => switchTab(e.detail));

/* ════════════════════════════════════════════════════════════
   BARRA DE MEMBROS
   ════════════════════════════════════════════════════════════ */

export function renderMembersBar() {
  const bar = document.getElementById('members-bar');
  bar.innerHTML = '';

  const allPill = document.createElement('div');
  allPill.className =
    'member-pill member-all-pill' +
    (state.filterMember === 'all' ? ' active' : '');

  allPill.onclick = () => {
    state.filterMember = 'all';
    renderMembersBar();
    renderMissions();
  };

  allPill.innerHTML = `
    <span class="pill-avatar">👨‍👩‍👧‍👦</span>
    <span class="pill-name">TODOS</span>
    <span class="pill-stars">⭐ ${getTotalTeamStars()}</span>
  `;

  bar.appendChild(allPill);

  state.config.members.forEach(member => {
    const pill = document.createElement('div');

    pill.className =
      'member-pill' +
      (state.filterMember === member.id ? ' active' : '');

    pill.onclick = () => {
      state.filterMember = member.id;
      renderMembersBar();
      renderMissions();
    };

    pill.innerHTML = `
      <span class="pill-avatar">${member.avatar}</span>
      <span class="pill-name">${member.name}</span>
      <span class="pill-stars">⭐ ${state.memberStars[member.id] || 0}</span>
    `;

    bar.appendChild(pill);
  });
}

/* ════════════════════════════════════════════════════════════
   LISTA DE MISSÕES
   ════════════════════════════════════════════════════════════ */

export function renderMissions() {

  const curIdx = getCurrentIdx();

  const total = state.missions.length;

  const done = state.missions.filter(
    mission =>
      state.missionStatus[mission.id] &&
      state.missionStatus[mission.id].status === 'done'
  ).length;

  const pct =
    total > 0
      ? Math.round(done / total * 100)
      : 0;

  document.getElementById('prog-label').textContent =
    `${done} DE ${total} TAREFAS ✅`;

  document.getElementById('prog-pct').textContent =
    `${pct}%`;

  document.getElementById('prog-bar').style.width =
    Math.max(pct, 3) + '%';

  const firstMember = state.config.members[0];

  document.getElementById('car-avatar').textContent =
    firstMember ? firstMember.avatar : '🏎️';

  const list = document.getElementById('mission-list');
  list.innerHTML = '';

  let visible = state.missions.map((mission, index) => ({
    mission,
    index
  }));

  if (state.filterMember !== 'all') {
    visible = visible.filter(({ mission }) =>
      mission.assignee === state.filterMember ||
      mission.assignee === 'compartilhada'
    );
  }

  if (!visible.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🔍</span>
        NENHUMA TAREFA<br>PARA ESTE MEMBRO HOJE
      </div>`;
    return;
  }

  visible.forEach(({ mission, index }) => {

    const st = state.missionStatus[mission.id];
    const status = st?.status ?? null;

    const member = getMemberById(mission.assignee);
    const isShared = mission.assignee === 'compartilhada';
    const isCurrent = index === curIdx;

    const card = document.createElement('div');

    let cls = 'mission-card';

    if (status === 'done')
      cls += ' done';
    else if (status === 'fail')
      cls += ' fail';
    else if (isShared)
      cls += ' shared';

    if (isCurrent && !status)
      cls += ' current';

    card.className = cls;

    const stars =
      st && st.stars > 0
        ? `<div style="font-size:10px;color:var(--gold);margin-top:3px;font-weight:900">
             ⭐ +${st.stars} estrela${st.stars > 1 ? 's' : ''}
           </div>`
        : '';

    const assignee =
      isShared
        ? `<span class="assignee-tag shared-tag">🤝 COMPARTILHADA</span>`
        : `<span class="assignee-tag">${member.avatar} ${member.name}</span>`;

    card.innerHTML = `
      <div class="time-col">
        <span class="t-start">${mission.start}</span>
        <span class="t-end">${mission.end}</span>
      </div>

      <div class="m-emoji">${mission.emoji}</div>

      <div class="m-info">
        <div class="m-title">${mission.title}</div>
        <div class="m-desc">${mission.desc}</div>
        <div class="m-assignee">${assignee}</div>
        ${stars}
      </div>

      <div class="btn-group">
        <button class="btn-check btn-done ${status === 'done' ? 'active' : ''}">
          ✓
        </button>

        <button class="btn-check btn-fail ${status === 'fail' ? 'active' : ''}">
          ✗
        </button>
      </div>
    `;

    card
      .querySelector('.btn-done')
      .addEventListener('click', () => setMissionStatus(mission.id, 'done'));

    card
      .querySelector('.btn-fail')
      .addEventListener('click', () => setMissionStatus(mission.id, 'fail'));

    list.appendChild(card);
  });

}


/* ════════════════════════════════════════════════════════════
   ABA ESTRELAS
   ════════════════════════════════════════════════════════════ */

export function renderStarsTab() {

  const total = getTotalTeamStars();
  const maxPossible = state.missions.length * 4;
  const pct = Math.min(
    100,
    Math.round(total / Math.max(maxPossible, 1) * 100)
  );

  document.getElementById('team-stars-count').textContent = total;
  document.getElementById('stars-goal-bar').style.width = pct + '%';

  const done = state.missions.filter(
    mission =>
      state.missionStatus[mission.id] &&
      state.missionStatus[mission.id].status === 'done'
  ).length;

  document.getElementById('team-stars-goal').textContent =
    done === state.missions.length
      ? `🏁 DIA COMPLETO! ${total} ESTRELAS DO TIME!`
      : `META: COMPLETAR ${state.missions.length - done} TAREFAS AINDA!`;

  const grid = document.getElementById('member-stars-grid');
  grid.innerHTML = '';

  state.config.members.forEach(member => {

    const stars = state.memberStars[member.id] || 0;

    const card = document.createElement('div');
    card.className = 'member-star-card';

    const roleLabel =
      member.role === 'pai'
        ? '👨 PAI'
        : member.role === 'mae'
        ? '👩 MÃE'
        : '🧒 CRIANÇA';

    card.innerHTML = `
      <span class="member-star-avatar">${member.avatar}</span>
      <div class="member-star-name">${member.name}</div>
      <div class="member-star-count">${stars}</div>
      <div class="member-star-sub">${roleLabel}</div>
    `;

    grid.appendChild(card);

  });

}

/* ════════════════════════════════════════════════════════════
   ABA TIME
   ════════════════════════════════════════════════════════════ */

export function renderTeamTab() {

  const container = document.getElementById('team-cards');
  container.innerHTML = '';

  state.config.members.forEach(member => {

    const stars = state.memberStars[member.id] || 0;

    const myMissions = state.missions.filter(
      mission =>
        mission.assignee === member.id ||
        mission.assignee === 'compartilhada'
    );

    const myDone = myMissions.filter(
      mission =>
        state.missionStatus[mission.id] &&
        state.missionStatus[mission.id].status === 'done'
    ).length;

    const roleLbl =
      member.role === 'pai'
        ? 'PAI'
        : member.role === 'mae'
        ? 'MÃE'
        : 'FILHO(A)';

    const roleCls =
      member.role === 'pai'
        ? 'role-pai'
        : member.role === 'mae'
        ? 'role-mae'
        : 'role-crianca';

    const card = document.createElement('div');
    card.className = 'team-member-card';

    card.innerHTML = `
      <div class="team-member-avatar">${member.avatar}</div>

      <div class="team-member-info">
        <div class="team-member-name">${member.name}</div>

        <span class="role-badge ${roleCls}">
          ${roleLbl}
        </span>

        <div
          class="team-member-done"
          style="margin-top:6px;color:#666;font-size:10px;font-weight:900"
        >
          ${myDone} TAREFAS CONCLUÍDAS
        </div>
      </div>

      <div class="team-member-stats">
        <div class="team-member-stars">
          ⭐ ${stars}
        </div>

        <div class="team-member-done">
          ESTRELAS HOJE
        </div>
      </div>
    `;

    container.appendChild(card);

  });

}

/* ════════════════════════════════════════════════════════════
   ABA CONQUISTAS
   ════════════════════════════════════════════════════════════ */

export function renderBadges() {

  const grid = document.getElementById('badge-grid');
  grid.innerHTML = '';

  ALL_BADGES.forEach(badge => {

    const unlocked =
      state.unlockedBadges.includes(badge.id);

    const card = document.createElement('div');

    card.className =
      'badge-card' +
      (unlocked ? ' unlocked' : '');

    card.innerHTML = `
      <span class="badge-icon">${badge.icon}</span>

      <div class="badge-name">
        ${badge.name}
      </div>

      <div class="badge-desc">
        ${unlocked ? badge.desc : '???'}
      </div>
    `;

    grid.appendChild(card);

  });

}

/* ════════════════════════════════════════════════════════════
   ABA SEMANA
   ════════════════════════════════════════════════════════════ */

export function renderWeek() {

  const now = new Date();
  const dow = now.getDay();

  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));

  const container = document.getElementById('week-days');
  container.innerHTML = '';

  let sum = 0;
  let count = 0;

  for (let i = 0; i < 7; i++) {

    const d = new Date(mon);
    d.setDate(mon.getDate() + i);

    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    const score = state.weekData[key];
    const isToday = d.toDateString() === now.toDateString();

    if (score !== undefined) {
      sum += score;
      count++;
    }

    const barCol =
      score === undefined ? '#333' :
      score >= 90 ? '#5cb832' :
      score >= 70 ? '#e8b800' :
      score >= 50 ? '#378ADD' :
      '#cb3232';

    const flag =
      score === 100 ? '🏆' :
      score >= 90 ? '🥇' :
      score >= 70 ? '🥈' :
      score >= 50 ? '🏅' :
      score !== undefined ? '🚗' : '';

    const sc =
      score !== undefined
        ? score + '%'
        : isToday
        ? 'HOJE'
        : '--';

    const scCol =
      score >= 90 ? '#e8b800' :
      score >= 70 ? '#5cb832' :
      score !== undefined ? '#aaa' :
      '#555';

    const row = document.createElement('div');
    row.className = 'day-row';

    if (isToday) {
      row.style.cssText =
        'display:flex;align-items:center;gap:8px;background:#1a2d1a;border:2px solid var(--gold);border-radius:14px;padding:10px 12px;margin-bottom:6px;';
    }

    row.innerHTML = `
      <span class="day-name" style="${isToday ? 'color:var(--gold);' : ''}">
        ${DAY_NAMES[d.getDay()]}
      </span>

      <div style="flex:1;background:var(--card2);border-radius:6px;height:14px;overflow:hidden;border:1px solid #222;">
        <div style="height:100%;width:${score || 0}%;background:${barCol};border-radius:6px;transition:width .6s;"></div>
      </div>

      <span style="font-size:13px;font-weight:900;min-width:46px;text-align:right;color:${scCol}">
        ${sc}
      </span>

      <span style="font-size:16px">
        ${flag}
      </span>
    `;

    container.appendChild(row);
  }

  const avgBox = document.getElementById('week-avg-box');

  if (count > 0) {

    const avg = Math.round(sum / count);

    avgBox.style.display = '';

    document.getElementById('week-avg-num').textContent =
      avg + '%';

    document.getElementById('week-avg-sub').textContent =
      avg === 100 ? '🏆 SEMANA PERFEITA!' :
      avg >= 90 ? '🥇 SEMANA INCRÍVEL!' :
      avg >= 70 ? '🥈 BOA SEMANA!' :
      avg >= 50 ? '🏅 CHEGANDO LÁ!' :
      '🚦 TREINANDO!';

  } else {

    avgBox.style.display = 'none';

  }

}

/* ════════════════════════════════════════════════════════════
   RELATÓRIO DE FIM DE DIA
   ════════════════════════════════════════════════════════════ */

export function renderReport(pct, totalStars, done, total) {

  const emojis =
    pct === 100 ? '🏆' :
    pct >= 90 ? '🥇' :
    pct >= 70 ? '🥈' :
    pct >= 50 ? '🏅' :
    '🚗';

  const titles =
    pct === 100 ? 'DIA PERFEITO DO TIME!' :
    pct >= 90 ? 'TIME NO PÓDIO!' :
    pct >= 70 ? 'MUITO BEM, FAMÍLIA!' :
    pct >= 50 ? 'CHEGANDO LÁ!' :
    'AMANHÃ A GENTE TREINA!';

  const msgs =
    pct === 100
      ? 'FAMÍLIA INCRÍVEL! DIA PERFEITO! 🏆'
      : pct >= 90
      ? 'QUE DIA INCRÍVEL, FAMÍLIA! ARRASARAM! 🚀'
      : pct >= 70
      ? 'BOA CORRIDA EM EQUIPE! QUASE NO TOPO! 💪'
      : 'TODO DIA É NOVO COMEÇO! AMANHÃ VOCÊS CONSEGUEM! 💫';

  document.getElementById('rep-emoji').textContent = emojis;
  document.getElementById('rep-title').textContent = titles;
  document.getElementById('rep-score').textContent = pct;
  document.getElementById('rep-msg').textContent = msgs;
  document.getElementById('rep-stars-val').textContent = '+' + totalStars;

  let membersHtml =
    `<div style="font-size:12px;font-weight:900;color:var(--gold);margin-bottom:8px">
      ⭐ ESTRELAS POR MEMBRO
    </div>`;

  state.config.members.forEach(member => {

    membersHtml += `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:13px;color:#ddd;">
        <span>${member.avatar} ${member.name}</span>
        <span style="color:var(--gold);font-weight:900">
          ⭐ ${state.memberStars[member.id] || 0}
        </span>
      </div>
    `;

  });

  document.getElementById('rep-member-box').innerHTML =
    membersHtml;

  const doneM = state.missions.filter(
    mission =>
      state.missionStatus[mission.id] &&
      state.missionStatus[mission.id].status === 'done'
  );

  const failM = state.missions.filter(
    mission =>
      state.missionStatus[mission.id] &&
      state.missionStatus[mission.id].status === 'fail'
  );

  let detailsHtml =
    `<div style="font-size:12px;font-weight:900;color:var(--gold);margin-bottom:8px">
      🏎️ TAREFAS: ${done}/${total}
    </div>`;

  if (doneM.length) {

    detailsHtml += `
      <div style="color:#5cb832;font-size:12px;margin-bottom:4px">
        ✅ CONCLUÍDAS:
        ${doneM.map(m => `${m.emoji} ${m.title}`).join(', ')}
      </div>
    `;

  }

  if (failM.length) {

    detailsHtml += `
      <div style="color:var(--red);font-size:12px">
        ❌ PERDIDAS:
        ${failM.map(m => `${m.emoji} ${m.title}`).join(', ')}
      </div>
    `;

  }

  document.getElementById('rep-details').innerHTML =
    detailsHtml;

  document.getElementById('report-overlay').style.display =
    'flex';

}
