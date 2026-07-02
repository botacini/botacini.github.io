import {
  state, getTodayMissions, persistDayState,
  saveDay, saveBadges, loadTotalStars, saveTotalStars, ALL_BADGES
} from './state.js';
import { clearTodayState } from './storage.js';
import { renderMissions, renderMembersBar, renderReport } from './render.js';
import { playSound, vibrate, showToast, showBadgeUnlockPopup, startConfetti, stopConfetti } from './effects.js';
/* ════════════════════════════════════════════════════════════
   MISSÕES — marcar feita/perdida
   ════════════════════════════════════════════════════════════ */
export function getMemberById(id) {
  if (id === 'compartilhada') return { name: 'COMPARTILHADA', avatar: '🤝', role: 'shared' };
  return state.config.members.find(m => m.id === id) || { name: '?', avatar: '❓', role: 'crianca' };
}

export function getTotalTeamStars() {
  return Object.values(state.memberStars).reduce((a, b) => a + b, 0);
}

function getMissionById(missionId) {
  return state.missions.find(m => m.id === missionId);
}

function getMissionIndexById(missionId) {
  return state.missions.findIndex(m => m.id === missionId);
}

export function setMissionStatus(missionId, val) {
  const idx = getMissionIndexById(missionId);
  if (idx === -1) return;

  const m = state.missions[idx];
  const prev = state.missionStatus[missionId];

  if (prev && prev.status === val) {
    // Toggle off
    if (prev.status === 'done') {
      const starsToRemove = prev.stars || 1;

      if (m.assignee === 'compartilhada') {
        state.config.members.forEach(mem => {
          state.memberStars[mem.id] = Math.max(
            0,
            (state.memberStars[mem.id] || 0) - starsToRemove
          );
        });
      } else {
        state.memberStars[m.assignee] = Math.max(
          0,
          (state.memberStars[m.assignee] || 0) - starsToRemove
        );
      }
    }

    state.missionStatus[missionId] = null;

    persistDayState();
    renderMissions();
    renderMembersBar();
    updateHeaderStars();
    return;
  }

  if (val === 'done') {
    openBonusPopup(idx);
  } else {
    if (prev && prev.status === 'done') {
      const m = state.missions[idx];
      const starsToRemove = prev.stars || 1;
      if (m.assignee === 'compartilhada') {
        state.config.members.forEach(mem => { state.memberStars[mem.id] = Math.max(0, (state.memberStars[mem.id] || 0) - starsToRemove); });
      } else {
        state.memberStars[m.assignee] = Math.max(0, (state.memberStars[m.assignee] || 0) - starsToRemove);
      }
    }
    state.missionStatus[idx] = { status: 'fail', stars: 0 };
    persistDayState();
    renderMissions(); renderMembersBar(); updateHeaderStars();
  }
}

/* ════════════════════════════════════════════════════════════
   POPUP DE BÔNUS
   ════════════════════════════════════════════════════════════ */
export function openBonusPopup(idx) {
  state.bonusPending = idx;
  state.bonusChecks = { capricho: false, pontual: false, semreclamar: false };
  renderBonusPopup(idx);
  document.getElementById('bonus-overlay').style.display = 'flex';
}

export function renderBonusPopup(idx) {
  const m = state.missions[idx];
  document.getElementById('bonus-emoji').textContent = m.emoji;
  document.getElementById('bonus-mission-name').textContent = m.title;
  ['capricho', 'pontual', 'semreclamar'].forEach(k => {
    document.getElementById('bci-' + k).classList.remove('checked');
    document.getElementById('bcb-' + k).textContent = '';
  });
  updateBonusPreview();
}

export function toggleBonus(key) {
  state.bonusChecks[key] = !state.bonusChecks[key];
  const item = document.getElementById('bci-' + key);
  const box = document.getElementById('bcb-' + key);
  item.classList.toggle('checked', state.bonusChecks[key]);
  box.textContent = state.bonusChecks[key] ? '✓' : '';
  updateBonusPreview();
}

export function updateBonusPreview() {
  const bonusCount = Object.values(state.bonusChecks).filter(Boolean).length;
  const total = 1 + bonusCount;
  document.getElementById('bonus-star-preview').textContent = `⭐ +${total} ESTRELA${total > 1 ? 'S' : ''} PARA O TIME!`;
}

export function confirmBonus() {
  const idx = state.bonusPending;
  if (idx === null || idx === undefined) return;
  const m = state.missions[idx];
  const bonusCount = Object.values(state.bonusChecks).filter(Boolean).length;
  const stars = 1 + bonusCount;

  state.missionStatus[idx] = {
    status: 'done', stars,
    capricho: state.bonusChecks.capricho,
    pontual: state.bonusChecks.pontual,
    semreclamar: state.bonusChecks.semreclamar
  };

  if (m.assignee === 'compartilhada') {
    state.config.members.forEach(mem => { state.memberStars[mem.id] = (state.memberStars[mem.id] || 0) + stars; });
  } else {
    state.memberStars[m.assignee] = (state.memberStars[m.assignee] || 0) + stars;
  }

  persistDayState(); // ← chamada que faltava no app original

  document.getElementById('bonus-overlay').style.display = 'none';
  state.bonusPending = null;

  playSound('done');
  vibrate([30, 30, 60]);

  if (Object.keys(state.missionStatus).filter(k => state.missionStatus[k] && state.missionStatus[k].status === 'done').length === 1) checkBadge('first_done');
  const allDone = state.missions.every((_, i) => state.missionStatus[i] && state.missionStatus[i].status === 'done');
  if (allDone) checkBadge('missions_all');
  const todayStars = getTotalTeamStars();
  if (todayStars >= 10) checkBadge('stars10');

  renderMissions(); renderMembersBar(); updateHeaderStars();
  showToast(`⭐ +${stars} ESTRELA${stars > 1 ? 'S' : ''}! ARRASOU!`);
}

export function updateHeaderStars() {
  document.getElementById('header-team-stars').textContent = getTotalTeamStars();
}

/* ════════════════════════════════════════════════════════════
   FINALIZAR O DIA
   ════════════════════════════════════════════════════════════ */
export function tryFinalize() {
  if (state.config.requireApproval) {
    // openPinOverlay('approve') fica no módulo do painel dos pais (fora do escopo deste arquivo)
    window.dispatchEvent(new CustomEvent('gp:request-pin-approve'));
  } else {
    finalizeDay();
  }
}

export function finalizeDay() {
  const done = state.missions.filter((_, i) => state.missionStatus[i] && state.missionStatus[i].status === 'done').length;
  const total = state.missions.length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const totalStars = getTotalTeamStars();

  const stored = loadTotalStars();
  stored.total = (stored.total || 0) + totalStars;
  state.config.members.forEach(m => {
    stored.byMember[m.id] = (stored.byMember[m.id] || 0) + (state.memberStars[m.id] || 0);
  });
  saveTotalStars(stored);

  saveDay(state.weekData, pct);
  checkAllBadges(pct, totalStars, stored.total);

  renderReport(pct, totalStars, done, total);

  if (pct === 100) setTimeout(startConfetti, 400);
}

/* ════════════════════════════════════════════════════════════
   BADGES
   ════════════════════════════════════════════════════════════ */
export function checkBadge(id) {
  if (state.unlockedBadges.includes(id)) return;
  state.unlockedBadges.push(id);
  saveBadges(state.unlockedBadges);
  const badge = ALL_BADGES.find(b => b.id === id);
  if (badge) showBadgeUnlockPopup(badge);
  if (state.unlockedBadges.length >= 5) setTimeout(() => checkBadge('collector'), 400);
}

export function checkAllBadges(pct, todayStars, totalStars) {
  if (pct === 100) checkBadge('perfect_day');
  if (pct >= 90) checkBadge('podium');
  if (todayStars >= 10) checkBadge('stars10');
  if (totalStars >= 50) checkBadge('stars50');
  const hasPerfect = Object.values(state.missionStatus).some(s => s && s.capricho && s.pontual && s.semreclamar);
  if (hasPerfect) checkBadge('team_bonus');
  checkStreaks();
}

export function checkStreaks() {
  const now = new Date();
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (state.weekData[key] !== undefined && state.weekData[key] >= 90) streak++;
    else break;
  }
  if (streak >= 3) checkBadge('streak3');
  if (streak >= 7) checkBadge('streak7');
}

/* ════════════════════════════════════════════════════════════
   NOVO DIA — reset intencional (NÃO é o bug; isto é um reset
   proposital pedido pelo usuário/pai, então aqui SIM devemos
   limpar o estado salvo, não recuperá-lo).
   ════════════════════════════════════════════════════════════ */
export function restartDay() {
  stopConfetti();
  state.missions = getTodayMissions();
  state.missionStatus = {};
  state.memberStars = {};
  state.config.members.forEach(m => { state.memberStars[m.id] = 0; });
  clearTodayState(); // apaga o "estado de hoje" salvo — é um novo dia de verdade
  document.getElementById('report-overlay').style.display = 'none';
  renderMissions();
  renderMembersBar();
  updateHeaderStars();
  window.dispatchEvent(new CustomEvent('gp:switch-tab', { detail: 'missions' }));
    }

