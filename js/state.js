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
} from './storage.js';

/* ════════════════ CONSTANTES ════════════════ */
export const DAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
export const DAY_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

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

export function timeToMin(t) {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ════════════════ VALORES PADRÃO (primeira execução) ════════════════ */
function defaultMembers() {
  return [
    { id: genId('mem'), name: 'PAPAI', avatar: '👨', role: 'pai' },
    { id: genId('mem'), name: 'MAMÃE', avatar: '👩', role: 'mae' },
    { id: genId('mem'), name: 'FILHO', avatar: '🧒', role: 'crianca' },
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
    teamStarsGoal: 20,
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
  missions: [],            // tarefas de hoje, já ordenadas por horário
  missionStatus: {},        // { [missionId]: { status:'done'|'fail', stars:number, bonus:{...} } }
  memberStars: {},           // estrelas DE HOJE por membro { [memberId]: number }
  totals: {},                 // estrelas históricas acumuladas por membro
  badgesUnlocked: [],          // ids de conquistas já desbloqueadas
  weekState: null,               // { weekKey, days:{ [dateKey]: {done,total,pct,stars} }, finalized }
  bonusPending: null,             // id da missão aguardando o checklist de bônus
  pinMode: null,                   // 'panel' | 'approve'
  pinBuffer: '',
};

/* ════════════════ TAREFAS DE HOJE (derivadas da config) ════════════════ */
export function getTodayMissions() {
  const dow = new Date().getDay();
  const list = (state.config.missionsByDay[dow] || []).map(x => ({ ...x }));
  list.sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  return list;
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

  state.today = todayKey();
  state.missions = getTodayMissions();

  const day = await loadDayState(state.today);
  state.missionStatus = (day && day.missionStatus) || {};
  state.memberStars = (day && day.memberStars) || zeroStarsByMember();

  state.totals = (await loadTotals()) || {};
  state.badgesUnlocked = (await loadBadges()) || [];

  const week = await loadWeekState(weekKeyOf());
  state.weekState = week || newWeekState();
}

/* ════════════════ PERSISTÊNCIA DE MUDANÇAS ════════════════
   Wrappers finos: sempre persistem o `state` atual através de
   storage.js. Nenhum outro módulo grava no localStorage. */
export async function saveConfig() {
  return storageSaveConfig(state.config);
}

export async function persistDayState() {
  return saveDayState(state.today, {
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

export async function persistWeekState() {
  return saveWeekState(state.weekState.weekKey, state.weekState);
}
