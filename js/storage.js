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

/* ════════════════ CONFIGURAÇÃO DO SUPABASE ════════════════ */
const SUPABASE_URL = 'https://yomngetgdfnjipfdckzp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2mtzblJVo_4mIS_rB82C9w_4X3ozk50';

import { getCurrentFamilyId, clearCurrentFamilyFromIndex } from './auth.js';

/* ════════════════ CLIENTE SUPABASE (SINGLETON) ════════════════ */
let _client = null;
function getClient() {
  if (_client) return _client;
  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    throw new Error('[storage] Supabase SDK não encontrado. Verifique se o CDN foi carregado no index.html.');
  }
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return _client;
}

// Cache em memória do blob JSON da família
let _configCache = null;

/* ════════════════ PRIMITIVAS DE LEITURA / ESCRITA ════════════════ */

async function fetchFamilyBlob() {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('family_config')
      .select('config')
      .eq('family_id', getCurrentFamilyId())
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

async function writeRaw(key, value) {
  try {
    const client = getClient();
    const current = _configCache !== null ? _configCache : await fetchFamilyBlob();
    const updated = { ...current, [key]: value };
    _configCache = updated;

    const { error } = await client
      .from('family_config')
      .upsert(
        { family_id: getCurrentFamilyId(), config: updated },
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

/* ════════════════ CONFIGURAÇÃO ════════════════ */
export async function loadConfig() {
  return readRaw('config');
}
export async function saveConfig(config) {
  return writeRaw('config', config);
}

/* ════════════════ ESTADO DO DIA ════════════════ */
export async function loadDayState(dateKey) {
  return readRaw('day:' + dateKey);
}
export async function saveDayState(dateKey, dayState) {
  return writeRaw('day:' + dateKey, dayState);
}

/* ════════════════ ESTADO DA SEMANA ════════════════ */
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

/* ════════════════ TOTAIS HISTÓRICOS DE ESTRELAS ════════════════ */
export async function loadTotals() {
  return (await readRaw('totals')) || {};
}
export async function saveTotals(totals) {
  return writeRaw('totals', totals);
}

/* ════════════════ HISTÓRICO DE BÔNUS MANUAL ════════════════ */
export async function loadBonusLog() {
  return (await readRaw('bonusLog')) || [];
}
export async function saveBonusLog(log) {
  return writeRaw('bonusLog', log);
}

/* ════════════════ EXPORTAR / IMPORTAR TUDO ════════════════ */
export async function exportAllData() {
  try {
    const blob = await fetchFamilyBlob();
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
    _configCache = { ...data };
    const { error } = await client
      .from('family_config')
      .upsert(
        { family_id: getCurrentFamilyId(), config: _configCache },
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

/* ════════════════ RESET COMPLETO ════════════════
   Apaga TUDO: dados no Supabase + cache em memória +
   sessão/família no localStorage (via auth.js).
   Após o reset, o app volta à tela de onboarding. */
export async function resetAllData() {
  try {
    const client = getClient();

    // 1. Apaga o blob no Supabase (substitui por objeto vazio)
    const { error } = await client
      .from('family_config')
      .upsert(
        { family_id: getCurrentFamilyId(), config: {} },
        { onConflict: 'family_id' }
      );

    if (error) {
      console.error('[storage] falha ao resetar dados no Supabase:', error);
      // Mesmo com erro no Supabase, limpa localmente para não travar o usuário
    }

    // 2. Limpa o cache em memória
    _configCache = {};

    // 3. Remove a família do índice local e limpa a sessão no localStorage
    //    Isso garante que o popup de onboarding apareça no próximo carregamento
    clearCurrentFamilyFromIndex();

    return true;
  } catch (e) {
    console.error('[storage] falha ao resetar dados:', e);
    // Tenta ao menos limpar a sessão local
    try { clearCurrentFamilyFromIndex(); } catch (_) { /* ignora */ }
    return false;
  }
}
