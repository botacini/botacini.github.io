/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — storage.js
   ════════════════════════════════════════════════════════════
   ÚNICO arquivo do projeto que sabe onde os dados são
   persistidos. Todo o resto da aplicação só conhece esta API.

   BACKEND: Supabase
   Tabela:  family_config
   Campos:  family_id (text, PK) | config (jsonb)

   O campo `config` é um objeto JSON com todas as sub-chaves:
   {
     "config": {...},
     "day:2026-07-06": {...},
     "week:2026-06-30": {...},
     "totals": {...},
     "badges": [...],
     "bonusLog": [...]
   }

   NOTA: O cliente Supabase aqui é o MESMO singleton criado em
   auth.js — ambos apontam para a mesma URL/key, então o SDK
   detecta que já existe uma instância e a reutiliza.
   ════════════════════════════════════════════════════════════ */

const SUPABASE_URL  = 'https://yomngetgdfnjipfdckzp.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_2mtzblJVo_4mIS_rB82C9w_4X3ozk50';

import { getCurrentFamilyId } from './auth.js';

/* ════════════════ CLIENTE SUPABASE (SINGLETON) ════════════════ */
let _client = null;
function getClient() {
  if (_client) return _client;
  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    throw new Error('[storage] Supabase SDK não encontrado.');
  }
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
}

/* ── Cache em memória ──────────────────────────────────────── */
let _configCache = null;

// Invalida o cache quando a família mudar (ex: logout + login com outra conta)
export function invalidateCache() {
  _configCache = null;
}

/* ════════════════ PRIMITIVAS ════════════════ */

async function fetchFamilyBlob() {
  const familyId = getCurrentFamilyId();
  if (!familyId) return _configCache || {};

  try {
    const client = getClient();
    const { data, error } = await client
      .from('family_config')
      .select('config')
      .eq('family_id', familyId)
      .maybeSingle();

    if (error) {
      console.error('[storage] falha ao buscar dados:', error);
      return _configCache || {};
    }

    _configCache = (data && data.config) ? data.config : {};
    return _configCache;
  } catch (e) {
    console.error('[storage] erro em fetchFamilyBlob:', e);
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
  const familyId = getCurrentFamilyId();
  if (!familyId) {
    console.warn('[storage] writeRaw ignorado: sem familyId na sessão');
    return false;
  }

  try {
    const client  = getClient();
    const current = _configCache !== null ? _configCache : await fetchFamilyBlob();
    const updated = { ...current, [key]: value };
    _configCache  = updated;

    const { error } = await client
      .from('family_config')
      .upsert(
        { family_id: familyId, config: updated },
        { onConflict: 'family_id' }
      );

    if (error) {
      console.error('[storage] falha ao salvar "%s":', key, error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[storage] erro em writeRaw "%s":', key, e);
    return false;
  }
}

/* ════════════════ CONFIGURAÇÃO ════════════════ */
export async function loadConfig()       { return readRaw('config'); }
export async function saveConfig(config) { return writeRaw('config', config); }

/* ════════════════ ESTADO DO DIA ════════════════ */
export async function loadDayState(dateKey)          { return readRaw('day:' + dateKey); }
export async function saveDayState(dateKey, dayState) { return writeRaw('day:' + dateKey, dayState); }

/* ════════════════ ESTADO DA SEMANA ════════════════ */
export async function loadWeekState(weekKey)           { return readRaw('week:' + weekKey); }
export async function saveWeekState(weekKey, weekState) { return writeRaw('week:' + weekKey, weekState); }

/* ════════════════ CONQUISTAS ════════════════ */
export async function loadBadges()          { return (await readRaw('badges'))   || []; }
export async function saveBadges(badgeIds)  { return writeRaw('badges', badgeIds); }

/* ════════════════ TOTAIS ════════════════ */
export async function loadTotals()       { return (await readRaw('totals')) || {}; }
export async function saveTotals(totals) { return writeRaw('totals', totals); }

/* ════════════════ HISTÓRICO DE BÔNUS ════════════════ */
export async function loadBonusLog()    { return (await readRaw('bonusLog')) || []; }
export async function saveBonusLog(log) { return writeRaw('bonusLog', log); }

/* ════════════════ EXPORTAR / IMPORTAR ════════════════ */
export async function exportAllData() {
  try {
    const blob = await fetchFamilyBlob();
    return { ...blob };
  } catch (e) {
    console.error('[storage] falha ao exportar:', e);
    return {};
  }
}

export async function importAllData(data) {
  if (!data || typeof data !== 'object') return false;
  const familyId = getCurrentFamilyId();
  if (!familyId) return false;

  try {
    const client = getClient();
    _configCache = { ...data };
    const { error } = await client
      .from('family_config')
      .upsert(
        { family_id: familyId, config: _configCache },
        { onConflict: 'family_id' }
      );
    if (error) {
      console.error('[storage] falha ao importar:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[storage] falha ao importar:', e);
    return false;
  }
}

/* ════════════════ RESET COMPLETO ════════════════
   Limpa APENAS os dados da família no Supabase.
   Logout e limpeza de sessão ficam em auth.logout(). */
export async function resetAllData() {
  const familyId = getCurrentFamilyId();
  if (!familyId) return false;

  try {
    const client = getClient();
    const { error } = await client
      .from('family_config')
      .upsert(
        { family_id: familyId, config: {} },
        { onConflict: 'family_id' }
      );

    if (error) console.error('[storage] falha ao resetar no Supabase:', error);

    _configCache = {};
    return true;
  } catch (e) {
    console.error('[storage] falha ao resetar:', e);
    return false;
  }
}
