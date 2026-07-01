
/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — Camada de Persistência
   ════════════════════════════════════════════════════════════
   Hoje: localStorage.
   Amanhã: se quiser trocar por IndexedDB, basta reimplementar
   os 3 métodos do objeto `Storage` abaixo (get/set/remove).
   Nenhum outro arquivo do app precisa mudar, porque todo mundo
   só conversa com as funções exportadas aqui embaixo — nunca
   com localStorage diretamente.
   ════════════════════════════════════════════════════════════ */

export const Storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn(`[Storage] Falha ao ler "${key}":`, e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`[Storage] Falha ao gravar "${key}":`, e);
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn(`[Storage] Falha ao remover "${key}":`, e);
      return false;
    }
  }
};

/* ── Chaves usadas pelo app ──────────────────────────────────
   As 4 primeiras são EXATAMENTE as chaves que o app original já
   usa — mantidas assim de propósito para não perder nenhum dado
   já salvo no navegador dos usuários atuais.
   A última (KEY_TODAY_STATE) é NOVA: é ela que corrige o bug. */
const KEY_CONFIG = 'gpfamilia_config';
const KEY_BADGES = 'gpfamilia_badges';
const KEY_TOTAL_STARS = 'gpfamilia_totalstars';
const KEY_TODAY_STATE = 'gpfamilia_today_state';

function getWeekKey() {
  const n = new Date(), dw = n.getDay(), m = new Date(n);
  m.setDate(n.getDate() - (dw === 0 ? 6 : dw - 1));
  return `gpfamilia_week_${m.getFullYear()}_${m.getMonth()}_${m.getDate()}`;
}

function getTodayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${n.getMonth()}-${n.getDate()}`;
}

/* ── CONFIG (membros, missões cadastradas, PIN, aprovação) ── */
export function loadConfig(defaults) {
  const saved = Storage.get(KEY_CONFIG, null);
  return saved ? { ...defaults, ...saved } : defaults;
}
export function saveConfig(config) {
  Storage.set(KEY_CONFIG, config);
}

/* ── SEMANA (histórico de pontuação por dia) ─────────────── */
export function loadWeek() {
  return Storage.get(getWeekKey(), {});
}
export function saveDay(weekData, score) {
  weekData[getTodayKey()] = score;
  Storage.set(getWeekKey(), weekData);
  return weekData;
}

/* ── CONQUISTAS (badges desbloqueados) ───────────────────── */
export function loadBadges() {
  return Storage.get(KEY_BADGES, []);
}
export function saveBadges(unlockedBadges) {
  Storage.set(KEY_BADGES, unlockedBadges);
}

/* ── ESTRELAS TOTAIS (acumulado histórico, não é o do dia) ── */
export function loadTotalStars() {
  return Storage.get(KEY_TOTAL_STARS, { total: 0, byMember: {} });
}
export function saveTotalStars(data) {
  Storage.set(KEY_TOTAL_STARS, data);
}

/* ── ESTADO DO DIA — A CORREÇÃO DO BUG ───────────────────────
   Antes, `missionStatus` e `memberStars` só existiam em
   variáveis JS na memória: qualquer F5 apagava tudo.
   Agora eles são salvos aqui, junto com a data em que foram
   salvos. Isso permite diferenciar "recarreguei a página hoje
   às 15h" (deve continuar de onde parou) de "abri o app num
   dia novo" (deve começar zerado, como já era o comportamento
   esperado ao virar o dia). */
export function loadTodayState() {
  const saved = Storage.get(KEY_TODAY_STATE, null);
  if (saved && saved.dateKey === getTodayKey()) {
    return {
      missionStatus: saved.missionStatus || {},
      memberStars: saved.memberStars || {}
    };
  }
  return null; // nada salvo de hoje -> quem chamar deve inicializar do zero
}

export function saveTodayState(missionStatus, memberStars) {
  Storage.set(KEY_TODAY_STATE, {
    dateKey: getTodayKey(),
    missionStatus,
    memberStars
  });
}

export function clearTodayState() {
  Storage.remove(KEY_TODAY_STATE);
}

/* ── ZERAR TUDO (botão "🗑️ ZERAR TODOS OS DADOS") ─────────── */
export function resetAllData() {
  Storage.remove(KEY_CONFIG);
  Storage.remove(KEY_BADGES);
  Storage.remove(KEY_TOTAL_STARS);
  Storage.remove(KEY_TODAY_STATE);
  Storage.remove(getWeekKey());
}
