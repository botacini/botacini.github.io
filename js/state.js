/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — state.js
   ════════════════════════════════════════════════════════════
   Estado global centralizado da aplicação. Todos os outros
   módulos (render.js, missions.js, parent-panel.js, main.js)
   leem e mutam o objeto `state` exportado daqui — nenhum deles
   mantém cópia própria de dados, e nenhum deles fala com
   localStorage diretamente (isso é trabalho exclusivo de
   storage.js).
   ════════════════════════════════════════════════════════════ */

import {
  loadConfig, saveConfig as storageSaveConfig,
  loadDayState, saveDayState,
  loadWeekState, saveWeekState,
  loadBadges, saveBadges,
  loadTotals, saveTotals,
  loadBonusLog, saveBonusLog,
} from './storage.js';
import { getCurrentFamilyName } from './auth.js';

/* ════════════════ CONSTANTES ════════════════ */
export const DAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
export const DAY_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Paleta de cores por membro — cada família ganha uma "cor de equipe"
// (como nas escuderias de F1). Usada nas colunas do quadro, nos pills
// da barra de membros e nos cartões de tarefa.
export const MEMBER_COLOR_PALETTE = ['#378add', '#e879c9', '#5cb832', '#e8b800', '#cb3232', '#8a5cf6', '#38b6ce', '#f2884b'];

export function nextMemberColor(members) {
  const used = new Set((members || []).map(m => m.color).filter(Boolean));
  const free = MEMBER_COLOR_PALETTE.find(c => !used.has(c));
  return free || MEMBER_COLOR_PALETTE[(members || []).length % MEMBER_COLOR_PALETTE.length];
}

export const ALL_BADGES = [
  { id: 'primeira-corrida', icon: '🏁', name: 'PRIMEIRA CORRIDA', desc: 'Complete seu primeiro dia' },
  { id: 'sem-erros', icon: '💯', name: 'SEM ERROS', desc: 'Termine um dia sem nenhuma falha' },
  { id: 'capricho-total', icon: '✨', name: 'CAPRICHO TOTAL', desc: 'Ganhe 10 estrelas de bônus no total' },
  { id: 'semana-completa', icon: '🏆', name: 'SEMANA COMPLETA', desc: 'Finalize os 7 dias da semana' },
];

/* ════════════════ UTILITÁRIOS DE DATA/HORA ════════════════ */
function pad2(n) { return String(n).padStart(2, '0'); }

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function weekKeyOf(d = new Date()) {
  const day = new Date(d);
  const diffToMonday = (day.getDay() + 6) % 7; // 0=segunda
  day.setDate(day.getDate() - diffToMonday);
  return todayKey(day);
}

export function dateFromKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

export function weekKeyOfDateKey(dateKey) {
  return weekKeyOf(dateFromKey(dateKey));
}

export function shiftDateKey(dateKey, deltaDays) {
  const day = dateFromKey(dateKey);
  day.setDate(day.getDate() + deltaDays);
  return todayKey(day);
}

export function isSelectedDateToday() {
  return state.selectedDate === state.today;
}

export function timeToMin(t) {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ════════════════ ASSIGNEE (RESPONSÁVEIS DE UMA TAREFA) ════════════════
   `mission.assignee` pode assumir 3 formatos, de propósito, para nunca
   forçar migração destrutiva de dados antigos:
   - 'compartilhada'  → todos os membros ATUAIS (dinâmico; inclui quem
                          for cadastrado depois — comportamento antigo)
   - array de ids      → tarefa dividida entre membros específicos
                          (pode ter 1 ou vários — "feita em conjunto")
   - string de 1 id     → formato legado (pré multi-atribuição)
   Todo o resto do app lê o responsável SEMPRE através desta função —
   nunca comparando `assignee` diretamente. */
export function assigneeIds(mission, members) {
  const list = members || (state.config && state.config.members) || [];
  const a = mission.assignee;
  if (a === 'compartilhada') return list.map(mem => mem.id);
  if (Array.isArray(a)) return a;
  if (typeof a === 'string' && a) return [a];
  return [];
}

/* ════════════════ VALORES PADRÃO (primeira execução) ════════════════ */
function defaultMembers() {
  return [
    { id: genId('mem'), name: 'PAPAI', avatar: '👨', role: 'pai', color: MEMBER_COLOR_PALETTE[0] },
    { id: genId('mem'), name: 'MAMÃE', avatar: '👩', role: 'mae', color: MEMBER_COLOR_PALETTE[1] },
    { id: genId('mem'), name: 'FILHO', avatar: '🧒', role: 'crianca', color: MEMBER_COLOR_PALETTE[2] },
  ];
}

function m(start, end, emoji, title, desc, assignee) {
  return { id: genId('ms'), start, end, emoji, title, desc, assignee };
}

function defaultMissionsByDay() {
  const diaUtil = () => [
    m('07:00', '07:30', '🛏️', 'ARRUMAR A CAMA', 'Deixar o quarto organizado', 'compartilhada'),
    m('07:30', '08:00', '🦷', 'HIGIENE MATINAL', 'Escovar os dentes e se arrumar', 'compartilhada'),
    m('16:00', '17:00', '📚', 'TAREFA DA ESCOLA', 'Fazer o dever de casa', 'compartilhada'),
    m('20:00', '20:30', '🧹', 'ARRUMAR OS BRINQUEDOS', 'Guardar tudo no lugar', 'compartilhada'),
  ];
  const fimDeSemana = () => [
    m('08:30', '09:00', '🛏️', 'ARRUMAR A CAMA', 'Deixar o quarto organizado', 'compartilhada'),
    m('10:00', '11:00', '🏡', 'AJUDAR EM CASA', 'Uma tarefa doméstica simples', 'compartilhada'),
  ];
  return {
    0: fimDeSemana(), 1: diaUtil(), 2: diaUtil(), 3: diaUtil(),
    4: diaUtil(), 5: diaUtil(), 6: fimDeSemana(),
  };
}

function defaultConfig() {
  return {
    members: defaultMembers(),
    missionsByDay: defaultMissionsByDay(),
    pin: '1234',
    requireApproval: false,
    skipParentPanelPin: false,
    teamStarsGoal: 20,
    customGoals: [], // metas/troféus personalizados criados pelos pais
  };
}

function zeroStarsByMember() {
  const z = {};
  state.config.members.forEach(mem => { z[mem.id] = 0; });
  return z;
}

function newWeekState() {
  return { weekKey: weekKeyOf(), days: {}, finalized: false };
}

/* ════════════════ ESTADO GLOBAL ════════════════ */
export const state = {
  config: null,          // { members, missionsByDay, pin, requireApproval, teamStarsGoal }
  today: null,            // 'YYYY-MM-DD' do dia carregado
  selectedDate: null,      // 'YYYY-MM-DD' da data em navegação
  missions: [],            // tarefas de hoje, já ordenadas por horário
  missionStatus: {},        // { [missionId]: { status:'done'|'fail', stars:number, bonus:{...} } }
  memberStars: {},           // estrelas DE HOJE por membro { [memberId]: number }
  totals: {},                 // estrelas históricas acumuladas por membro
  badgesUnlocked: [],          // ids de conquistas (fixas + metas personalizadas) já desbloqueadas
  weekState: null,               // { weekKey, days:{ [dateKey]: {done,total,pct,stars} }, finalized }
  bonusLog: [],                   // histórico de bônus manuais dados pelos pais (fora da agenda)
  bonusPending: null,             // id da missão aguardando o checklist de bônus
  pinMode: null,                   // 'panel' | 'approve'
  pinBuffer: '',
};

/* ════════════════ TAREFAS DE HOJE (derivadas da config) ════════════════ */
export function getTodayMissions() {
  const baseDate = dateFromKey(state.selectedDate || state.today || todayKey());
  const dow = baseDate.getDay();
  const list = (state.config.missionsByDay[dow] || []).map(x => ({ ...x }));
  list.sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  return list;
}

export async function loadDateContext(dateKey) {
  const normalized = dateKey || todayKey();
  state.selectedDate = normalized;
  state.missions = getTodayMissions();

  const day = await loadDayState(normalized);
  state.missionStatus = (day && day.missionStatus) || {};
  state.memberStars = (day && day.memberStars) || zeroStarsByMember();

  const week = await loadWeekState(weekKeyOfDateKey(normalized));
  state.weekState = week || { weekKey: weekKeyOfDateKey(normalized), days: {}, finalized: false };
}

/* ════════════════ CARREGAMENTO INICIAL ════════════════
   Chamado uma vez por main.js antes do primeiro render. */
export async function loadState() {
  let config = await loadConfig();
  if (!config) {
    config = defaultConfig();
    await storageSaveConfig(config);
  }
  state.config = config;

  // Auto-cura de dados legados: configs salvas antes de existirem cor por
  // membro, opção de abrir o painel sem PIN e campos novos das metas
  // personalizadas não têm esses campos — preenche com valores padrão e
  // regrava, sem tocar em mais nada (nunca destrutivo).
  let needsResave = false;

  // Garante que familyName está sincronizado com o localStorage
  if (!state.config.familyName) {
    state.config.familyName = getCurrentFamilyName();
    needsResave = true;
  }
  if (!Array.isArray(state.config.customGoals)) {
    state.config.customGoals = [];
    needsResave = true;
  }
  if (typeof state.config.skipParentPanelPin !== 'boolean') {
    state.config.skipParentPanelPin = false;
    needsResave = true;
  }
  state.config.members.forEach(mem => {
    if (!mem.color) {
      mem.color = nextMemberColor(state.config.members);
      needsResave = true;
    }
  });
  state.config.customGoals.forEach(goal => {
    if (typeof goal.redeemed !== 'boolean') {
      goal.redeemed = false;
      needsResave = true;
    }
    if (typeof goal.claimedStars !== 'number') {
      goal.claimedStars = 0;
      needsResave = true;
    }
  });
  if (needsResave) await storageSaveConfig(state.config);

  state.today = todayKey();
  await loadDateContext(state.today);

  state.totals = (await loadTotals()) || {};
  state.badgesUnlocked = (await loadBadges()) || [];
  state.bonusLog = (await loadBonusLog()) || [];
}

/* ════════════════ PERSISTÊNCIA DE MUDANÇAS ════════════════
   Wrappers finos: sempre persistem o `state` atual através de
   storage.js. Nenhum outro módulo grava no localStorage. */
export async function saveConfig() {
  return storageSaveConfig(state.config);
}

export async function persistDayState() {
  return saveDayState(state.selectedDate || state.today, {
    missionStatus: state.missionStatus,
    memberStars: state.memberStars,
  });
}

export async function persistTotals() {
  return saveTotals(state.totals);
}

export async function persistBadges() {
  return saveBadges(state.badgesUnlocked);
}

export async function persistBonusLog() {
  return saveBonusLog(state.bonusLog);
}

export async function persistWeekState() {
  return saveWeekState(state.weekState.weekKey, state.weekState);
}
