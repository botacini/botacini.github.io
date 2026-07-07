/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — storage.js
   ════════════════════════════════════════════════════════════
   ÚNICO arquivo do projeto que sabe onde os dados são
   persistidos. Todo o resto da aplicação (state.js e, através
   dele, os demais módulos) só conhece esta API — nunca acessa
   o banco ou localStorage diretamente.

   A API é assíncrona (Promises) de propósito: a troca de
   backend (ex: localStorage → Supabase) exige mudanças
   SOMENTE aqui dentro — nenhum outro módulo precisa saber.

   BACKEND: Supabase
   Tabela: family_config
   Campos: family_id (text, PK) | config (jsonb)

   O campo `config` é um objeto JSON com todas as chaves que
   antes iam para o localStorage, ex:
   {
     "config": {...},
     "day:2026-07-06": {...},
     "week:2026-06-30": {...},
     "totals": {...},
     "badges": [...],
     "bonusLog": [...]
   }
   ════════════════════════════════════════════════════════════ */

/* ════════════════ CONFIGURAÇÃO DO SUPABASE ════════════════
   Preencha SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY com os
   valores do seu projeto em https://supabase.com/dashboard.
   SUPABASE_URL  → Settings → API → Project URL
   SUPABASE_PUBLISHABLE_KEY → Settings → API → anon / public  */

const SUPABASE_URL = 'https://yomngetgdfnjipfdckzp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2mtzblJVo_4mIS_rB82C9w_4X3ozk50';

/* ════════════════ IDENTIFICADOR DA FAMÍLIA ════════════════
   Atualmente fixo — será substituído por URL ou login futuramente. */
const CURRENT_FAMILY = 'familia_a';

/* ════════════════ CLIENTE SUPABASE (SINGLETON) ════════════════
   Criado uma única vez na primeira chamada e reutilizado sempre.
   Evita o aviso "Multiple GoTrueClient instances detected"
   que aparece quando createClient() é chamado mais de uma vez
   no mesmo contexto de browser. */
let _client = null;
function getClient() {
  if (_client) return _client;
  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    throw new Error('[storage] Supabase SDK não encontrado. Verifique se o CDN foi carregado no index.html.');
  }
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return _client;
}

// Cache em memória do blob JSON da família, para evitar múltiplos
// roundtrips ao Supabase em operações sequenciais dentro da mesma sessão.
let _configCache = null;

/* ════════════════ PRIMITIVAS DE LEITURA / ESCRITA ════════════════ */

/**
 * Carrega o blob JSON completo da família do Supabase.
 * Mantém _configCache atualizado para uso em writeRaw.
 * @returns {Object} O objeto JSON armazenado em config, ou {} se ainda não existe.
 */
async function fetchFamilyBlob() {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('family_config')
      .select('config')
      .eq('family_id', CURRENT_FAMILY)
      .maybeSingle();

    if (error) {
      console.error('[storage] falha ao buscar dados da família:', error);
      return _configCache || {};
    }

    _configCache = (data && data.config) ? data.config : {};
    return _configCache;
  } catch (e) {
    console.error('[storage] erro inesperado em fetchFamilyBlob:', e);
    return _configCache || {};
  }
}

/**
 * Lê uma chave individual do blob JSON da família.
 * @param {string} key - Chave no formato usado antes (ex: 'config', 'day:2026-07-06').
 * @returns {*} Valor armazenado, ou null se não existir.
 */
async function readRaw(key) {
  try {
    const blob = await fetchFamilyBlob();
    const value = blob[key];
    return value !== undefined ? value : null;
  } catch (e) {
    console.error('[storage] falha ao ler "%s":', key, e);
    return null;
  }
}

/**
 * Grava uma chave individual no blob JSON da família via upsert.
 * Não apaga outras chaves — faz merge no objeto existente.
 * @param {string} key - Chave a gravar.
 * @param {*} value - Valor a gravar.
 * @returns {boolean} true se sucesso, false se erro.
 */
async function writeRaw(key, value) {
  try {
    const client = getClient();

    // Carrega o blob atual (usa cache se disponível, busca se não)
    const current = _configCache !== null ? _configCache : await fetchFamilyBlob();

    // Atualiza apenas a chave solicitada
    const updated = { ...current, [key]: value };
    _configCache = updated;

    const { error } = await client
      .from('family_config')
      .upsert(
        { family_id: CURRENT_FAMILY, config: updated },
        { onConflict: 'family_id' }
      );

    if (error) {
      console.error('[storage] falha ao salvar "%s":', key, error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[storage] erro inesperado em writeRaw "%s":', key, e);
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
  return (await readRaw('badges')) || [];
}
export async function saveBadges(badgeIds) {
  return writeRaw('badges', badgeIds);
}

/* ════════════════ TOTAIS HISTÓRICOS DE ESTRELAS ════════════════
   Soma de estrelas por membro, acumulada dia após dia (usada
   para o critério de algumas conquistas). */
export async function loadTotals() {
  return (await readRaw('totals')) || {};
}
export async function saveTotals(totals) {
  return writeRaw('totals', totals);
}

/* ════════════════ HISTÓRICO DE BÔNUS MANUAL ════════════════
   Registro de estrelas dadas pelos pais fora da agenda (ex: o filho
   ajudou sem ter sido pedido). Serve de histórico/auditoria — não
   afeta as regras de missões. */
export async function loadBonusLog() {
  return (await readRaw('bonusLog')) || [];
}
export async function saveBonusLog(log) {
  return writeRaw('bonusLog', log);
}

/* ════════════════ EXPORTAR / IMPORTAR TUDO ════════════════
   Backup manual: o usuário baixa um .json com tudo que está
   salvo (config, dias, semanas, badges, totais) e pode
   restaurar depois — no mesmo navegador ou em outro
   dispositivo. */
export async function exportAllData() {
  try {
    const blob = await fetchFamilyBlob();
    // Retorna uma cópia para não expor a referência interna
    return { ...blob };
  } catch (e) {
    console.error('[storage] falha ao exportar dados:', e);
    return {};
  }
}

export async function importAllData(data) {
  if (!data || typeof data !== 'object') return false;
  try {
    const client = getClient();
    // Substitui o blob inteiro pelos dados importados
    _configCache = { ...data };
    const { error } = await client
      .from('family_config')
      .upsert(
        { family_id: CURRENT_FAMILY, config: _configCache },
        { onConflict: 'family_id' }
      );
    if (error) {
      console.error('[storage] falha ao importar dados:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[storage] falha ao importar dados:', e);
    return false;
  }
}

/* ════════════════ RESET COMPLETO ════════════════ */
export async function resetAllData() {
  try {
    const client = getClient();
    _configCache = {};
    const { error } = await client
      .from('family_config')
      .upsert(
        { family_id: CURRENT_FAMILY, config: {} },
        { onConflict: 'family_id' }
      );
    if (error) {
      console.error('[storage] falha ao resetar dados:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[storage] falha ao resetar dados:', e);
    return false;
  }
}
