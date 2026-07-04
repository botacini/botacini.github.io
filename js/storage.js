/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — storage.js
   ════════════════════════════════════════════════════════════
   ÚNICO arquivo do projeto que sabe que existe localStorage.
   Todo o resto da aplicação (state.js e, através dele, os
   demais módulos) só conhece esta API — nunca chama
   localStorage diretamente.

   A API é assíncrona (Promises) de propósito, mesmo o
   localStorage sendo síncrono: assim, no dia em que isso virar
   uma chamada de rede para um backend (ex: Supabase), NENHUM
   outro arquivo do projeto precisa mudar — só o corpo das
   funções aqui dentro.
   ════════════════════════════════════════════════════════════ */

const PREFIX = 'gpFamilia:';

function readRaw(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('[storage] falha ao ler "%s":', key, e);
    return null;
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('[storage] falha ao salvar "%s":', key, e);
    return false;
  }
}

/* ════════════════ CONFIGURAÇÃO ════════════════
   Membros, tarefas por dia da semana, PIN, meta de estrelas. */
export async function loadConfig() {
  return readRaw('config');
}
export async function saveConfig(config) {
  return writeRaw('config', config);
}

/* ════════════════ ESTADO DO DIA ════════════════
   Progresso de hoje: status de cada tarefa + estrelas do dia
   por membro. Uma chave por data (YYYY-MM-DD). */
export async function loadDayState(dateKey) {
  return readRaw('day:' + dateKey);
}
export async function saveDayState(dateKey, dayState) {
  return writeRaw('day:' + dateKey, dayState);
}

/* ════════════════ ESTADO DA SEMANA ════════════════
   Resumo dos 7 dias da semana corrente, usado no painel
   "Semana" e na finalização da semana. Uma chave por semana
   (data da segunda-feira daquela semana). */
export async function loadWeekState(weekKey) {
  return readRaw('week:' + weekKey);
}
export async function saveWeekState(weekKey, weekState) {
  return writeRaw('week:' + weekKey, weekState);
}

/* ════════════════ CONQUISTAS DESBLOQUEADAS ════════════════ */
export async function loadBadges() {
  return readRaw('badges') || [];
}
export async function saveBadges(badgeIds) {
  return writeRaw('badges', badgeIds);
}

/* ════════════════ TOTAIS HISTÓRICOS DE ESTRELAS ════════════════
   Soma de estrelas por membro, acumulada dia após dia (usada
   para o critério de algumas conquistas). */
export async function loadTotals() {
  return readRaw('totals') || {};
}
export async function saveTotals(totals) {
  return writeRaw('totals', totals);
}

/* ════════════════ EXPORTAR / IMPORTAR TUDO ════════════════
   Backup manual: o usuário baixa um .json com tudo que está
   salvo (config, dias, semanas, badges, totais) e pode
   restaurar depois — no mesmo navegador ou em outro
   dispositivo. Cobre qualquer chave já gravada, sem precisar
   saber de antemão quantos dias/semanas existem no histórico. */
export async function exportAllData() {
  const data = {};
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => {
        const suffix = k.slice(PREFIX.length);
        try {
          data[suffix] = JSON.parse(localStorage.getItem(k));
        } catch (e) {
          // entrada individual corrompida: ignora e segue o backup
        }
      });
  } catch (e) {
    console.error('[storage] falha ao exportar dados:', e);
  }
  return data;
}

export async function importAllData(data) {
  if (!data || typeof data !== 'object') return false;
  try {
    Object.entries(data).forEach(([suffix, value]) => writeRaw(suffix, value));
    return true;
  } catch (e) {
    console.error('[storage] falha ao importar dados:', e);
    return false;
  }
}

/* ════════════════ RESET COMPLETO ════════════════ */
export async function resetAllData() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
    return true;
  } catch (e) {
    console.error('[storage] falha ao resetar dados:', e);
    return false;
  }
}
