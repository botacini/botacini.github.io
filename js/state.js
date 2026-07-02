import {
  loadConfig, saveConfig,
  loadWeek, saveDay,
  loadBadges, saveBadges,
  loadTotalStars, saveTotalStars,
  loadTodayState, saveTodayState
} from './storage.js';

/* ════════════════════════════════════════════════════════════
   DEFAULTS — copiados 1:1 do arquivo original, sem nenhuma
   mudança de conteúdo, só de localização.
   ════════════════════════════════════════════════════════════ */
export const DEFAULT_MEMBERS = [
  { id: 'pai',    name: 'PAI',   avatar: '👨', role: 'pai' },
  { id: 'mae',    name: 'MÃE',   avatar: '👩', role: 'mae' },
  { id: 'filho1', name: 'FILHO', avatar: '🧒', role: 'crianca' }
];

export const DEFAULT_MISSIONS_TEMPLATE = [
  { start: "08:00", end: "08:15", emoji: "☀️", title: "ACORDAR!", desc: "HORA DE LEVANTAR!", assignee: "compartilhada" },
  { start: "08:15", end: "08:30", emoji: "🙏", title: "ORAÇÃO EM FAMÍLIA", desc: "FALAR COM DEUS JUNTOS", assignee: "compartilhada" },
  { start: "08:30", end: "09:10", emoji: "🥛", title: "CAFÉ DA MANHÃ", desc: "COMER BEM PARA O DIA!", assignee: "compartilhada" },
  { start: "09:10", end: "10:10", emoji: "✏️", title: "ESTUDO / ESCOLA", desc: "APRENDER COISAS LEGAIS!", assignee: "filho1" },
  { start: "10:30", end: "11:10", emoji: "🧹", title: "ARRUMAR A CASA", desc: "CADA UM NO SEU CANTO!", assignee: "compartilhada" },
  { start: "11:30", end: "13:30", emoji: "🎮", title: "TEMPO LIVRE", desc: "DESCANSO E BRINCADEIRA!", assignee: "filho1" },
  { start: "13:30", end: "14:30", emoji: "🍗", title: "ALMOÇO", desc: "HORA DE COMER JUNTOS!", assignee: "compartilhada" },
  { start: "17:00", end: "17:40", emoji: "🍰", title: "LANCHE", desc: "LANCHINHO GOSTOSO!", assignee: "compartilhada" },
  { start: "19:00", end: "19:40", emoji: "🍜", title: "JANTAR", desc: "JANTAR EM FAMÍLIA!", assignee: "compartilhada" },
  { start: "19:40", end: "20:00", emoji: "🛁", title: "BANHO!", desc: "FICANDO LIMPINHO!", assignee: "filho1" },
  { start: "20:00", end: "20:30", emoji: "📚", title: "LER UMA HISTÓRIA", desc: "HISTÓRIA NA CAMINHA!", assignee: "compartilhada" },
  { start: "20:30", end: "21:00", emoji: "🌙", title: "ORAR E DORMIR", desc: "SONO GOSTOSO!", assignee: "compartilhada" }
];

export function buildDefaultDayMissions() {
  const days = {};
  for (let d = 0; d < 7; d++) {
    if (d === 0 || d === 6) {
      days[d] = [
        { start: "09:00", end: "09:30", emoji: "☀️", title: "ACORDAR!", desc: "BOM DIA FAMÍLIA!", assignee: "compartilhada" },
        { start: "09:30", end: "10:00", emoji: "🥛", title: "CAFÉ DA MANHÃ", desc: "CAFÉ REFORÇADO JUNTOS!", assignee: "compartilhada" },
        { start: "10:00", end: "12:00", emoji: "🎮", title: "TEMPO LIVRE", desc: "DIVERSÃO TOTAL!", assignee: "compartilhada" },
        { start: "12:00", end: "13:00", emoji: "🍗", title: "ALMOÇO", desc: "MESA DA FAMÍLIA!", assignee: "compartilhada" },
        { start: "14:00", end: "17:00", emoji: "🏰", title: "PASSEIO OU PARQUE", desc: "APROVEITAR O FINAL DE SEMANA!", assignee: "compartilhada" },
        { start: "19:30", end: "20:00", emoji: "🍜", title: "JANTAR", desc: "JANTAR EM FAMÍLIA!", assignee: "compartilhada" },
        { start: "20:30", end: "21:00", emoji: "📚", title: "HISTÓRIA E DORMIR", desc: "FIM DE DIA PERFEITO!", assignee: "compartilhada" }
      ];
    } else {
      days[d] = DEFAULT_MISSIONS_TEMPLATE.map(m => ({ ...m }));
    }
  }
  return days;
}

export const ALL_BADGES = [
  { id: 'first_done',   icon: '🌟', name: 'PRIMEIRA TAREFA',    desc: 'Completou a 1ª tarefa do dia' },
  { id: 'perfect_day',  icon: '🏆', name: 'DIA PERFEITO',       desc: '100% das tarefas concluídas' },
  { id: 'podium',       icon: '🥇', name: 'NO PÓDIO',           desc: '90%+ num dia' },
  { id: 'streak3',      icon: '🔥', name: 'SEQUÊNCIA 3',        desc: '3 dias seguidos no pódio' },
  { id: 'streak7',      icon: '💎', name: 'UMA SEMANA SHOW',    desc: '7 dias seguidos no pódio' },
  { id: 'team_bonus',   icon: '⭐', name: 'TIME PERFEITO',      desc: 'Todos os bônus de um dia' },
  { id: 'missions_all', icon: '🚀', name: 'MISSÃO COMPLETA',    desc: 'Todas as tarefas concluídas' },
  { id: 'collector',    icon: '🎖️', name: 'COLECIONADOR',       desc: '5 conquistas desbloqueadas' },
  { id: 'stars10',      icon: '💫', name: '10 ESTRELAS',        desc: '10 estrelas num dia' },
  { id: 'stars50',      icon: '🌠', name: '50 ESTRELAS',        desc: '50 estrelas no total' },
  { id: 'family_week',  icon: '👨‍👩‍👧‍👦', name: 'FAMÍLIA UNIDA', desc: 'Semana completa em família' }
];

export const DAY_NAMES = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
export const DAY_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/* ════════════════════════════════════════════════════════════
   MISSION ID GUARANTOR — Data Integrity Layer
   ════════════════════════════════════════════════════════════
   Ensures every mission in the system has a stable, unique ID.
   
   - If mission.id is missing or invalid (falsy), generates a new one
   - Uses crypto.randomUUID() when available, fallback to timestamp + random
   - Does NOT modify existing IDs if already present (stable across reloads)
   - Returns updated array without mutating originals during the copy process
   
   This prevents:
   - Missions without IDs
   - missionStatus desync (can't rely on index alone)
   - Index-based fallback bugs
   ════════════════════════════════════════════════════════════ */
function generateMissionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para ambientes sem crypto.randomUUID
  return `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function ensureMissionIds(missions) {
  if (!missions || !Array.isArray(missions)) {
    return missions;
  }
  
  return missions.map(mission => {
    if (!mission.id || typeof mission.id !== 'string' || mission.id.trim() === '') {
      // Mission missing or has invalid ID: assign a stable unique one
      return {
        ...mission,
        id: generateMissionId()
      };
    }
    // Mission already has a valid ID: keep it (stable across reloads)
    return mission;
  });
}

/* ════════════════════════════════════════════════════════════
   Integration: ensures all day missions get IDs
   ════════════════════════════════════════════════════════════ */
function ensureMissionIdsInAllDays(missionsByDay) {
  if (!missionsByDay || typeof missionsByDay !== 'object') {
    return missionsByDay;
  }
  
  const result = {};
  for (const day in missionsByDay) {
    result[day] = ensureMissionIds(missionsByDay[day]);
  }
  return result;
}

const DEFAULT_CONFIG = {
  pin: '1234',
  requireApproval: false,
  members: DEFAULT_MEMBERS.map(m => ({ ...m })),
  missions: buildDefaultDayMissions()
};

/* ════════════════════════════════════════════════════════════
   ESTADO — um único objeto mutável, exportado por referência.
   Todo o resto do app importa `state` e lê/escreve nos campos
   dele (ex: `state.missionStatus[idx] = ...`), exatamente como
   antes se lia/escrevia nas variáveis soltas `missionStatus`,
   `memberStars` etc.
   ════════════════════════════════════════════════════════════ */
export const state = {
  config: loadConfig(DEFAULT_CONFIG),
  missions: [],
  missionStatus: {},   // { missionIdx: { status:'done'|'fail', stars, bonusCapricho, ... } }
  weekData: loadWeek(),
  unlockedBadges: loadBadges(),
  memberStars: {},     // { memberId: totalStarsHoje }
  filterMember: 'all', // 'all' ou memberId
  bonusPending: null,  // missionIdx aguardando confirmação do popup de bônus
  bonusChecks: { capricho: false, pontual: false, semreclamar: false },
  pinBuffer: '',
  pinMode: 'parent'
};

// Ensure all missions in config have IDs
state.config.missions = ensureMissionIdsInAllDays(state.config.missions);

export function getTodayMissions() {
  const dow = new Date().getDay();
  const dayMs = state.config.missions[dow];
  const missions = dayMs ? dayMs.map(m => ({ ...m })) : DEFAULT_MISSIONS_TEMPLATE.map(m => ({ ...m }));
  // Guarantee IDs on today's missions
  return ensureMissionIds(missions);
}
state.missions = getTodayMissions();

/* ════════════════════════════════════════════════════════════
   INICIALIZAÇÃO DO ESTADO DO DIA — A CORREÇÃO DO BUG
   ════════════════════════════════════════════════════════════
   Antes: `missionStatus = {}` e `memberStars = {}` (via
   initMemberStars()) sempre começavam vazios, mesmo que o
   usuário só tivesse dado F5 no meio do dia.

   Agora: tenta recuperar o que foi salvo hoje pelo storage.js.
   Só começa do zero se não houver nada salvo (primeira vez no
   dia) ou se o que está salvo for de um dia anterior — nesse
   caso o comportamento de "novo dia reseta" continua igual. */
export function initDayState() {
  const saved = loadTodayState();
  if (saved) {
    state.missionStatus = saved.missionStatus;
    state.memberStars = saved.memberStars;
  } else {
    state.missionStatus = {};
    state.memberStars = {};
  }
  // Garante que todo membro atual tenha uma entrada de estrelas,
  // mesmo que tenha sido adicionado no painel dos pais depois do
  // último salvamento do dia.
  state.config.members.forEach(m => {
    if (!(m.id in state.memberStars)) state.memberStars[m.id] = 0;
  });
}

/* Chamar sempre que `state.missionStatus` ou `state.memberStars`
   mudarem — é isto que faltava no app original. */
export function persistDayState() {
  saveTodayState(state.missionStatus, state.memberStars);
}

/* ════════════════════════════════════════════════════════════
   Re-exports de conveniência: o resto do app importa tudo que
   precisa (defaults + persistência) direto daqui, sem precisar
   saber que storage.js existe.
   ════════════════════════════════════════════════════════════ */
export { saveConfig, saveDay, saveBadges, loadTotalStars, saveTotalStars };
