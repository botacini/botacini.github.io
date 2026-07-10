/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — auth.js
   ════════════════════════════════════════════════════════════
   Única fonte de verdade sobre a sessão atual da aplicação:
   qual família está ativa, quem é o usuário (hoje sempre null)
   e se existe sessão válida.

   Implementação atual: localStorage.
   Futuramente: substituir apenas este arquivo por Supabase Auth
   sem tocar em nenhum outro módulo.

   NENHUM outro arquivo deve:
   - acessar localStorage para dados de família/sessão
   - conhecer as chaves 'gp_family_id' / 'gp_family_name'
   - chamar slugify diretamente
   ════════════════════════════════════════════════════════════ */

const LS_FAMILY_ID   = 'gp_family_id';
const LS_FAMILY_NAME = 'gp_family_name';

// Chave que guarda o índice de todas as famílias já criadas neste browser
// Formato: [{ id: 'slug', name: 'Nome Bonito' }, ...]
const LS_FAMILY_INDEX = 'gp_family_index';

/* ── Utilidade privada ──────────────────────────────────── */

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ── Cache de sessão em memória ─────────────────────────── */
let _session = null;

function buildSession() {
  const familyId   = localStorage.getItem(LS_FAMILY_ID)   || null;
  const familyName = localStorage.getItem(LS_FAMILY_NAME) || '';
  return {
    authenticated: false,
    user:          null,
    familyId:      familyId || 'familia_a',
    familyName,
  };
}

/* ════════════════ ÍNDICE DE FAMÍLIAS ════════════════
   Mantém no localStorage a lista de todas as famílias
   já criadas neste browser, para o popup de seleção. */

/**
 * Retorna todas as famílias registradas neste browser.
 * @returns {Array<{id:string, name:string}>}
 */
export function listFamilies() {
  try {
    const raw = localStorage.getItem(LS_FAMILY_INDEX);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Registra (ou atualiza) uma família no índice local.
 * Chamado internamente por setCurrentFamily.
 */
function registerFamily(id, name) {
  const list = listFamilies();
  const existing = list.findIndex(f => f.id === id);
  if (existing >= 0) {
    list[existing].name = name;
  } else {
    list.push({ id, name });
  }
  localStorage.setItem(LS_FAMILY_INDEX, JSON.stringify(list));
}

/**
 * Remove uma família do índice local (mas NÃO apaga os dados
 * do Supabase — isso é responsabilidade de storage.resetAllData).
 */
function unregisterFamily(id) {
  const list = listFamilies().filter(f => f.id !== id);
  localStorage.setItem(LS_FAMILY_INDEX, JSON.stringify(list));
}

/* ════════════════ API PÚBLICA ════════════════ */

/**
 * Inicializa a sessão. Deve ser aguardado antes de qualquer
 * acesso à sessão.
 */
export async function initialize() {
  _session = buildSession();
  return hasSession();
}

/**
 * Retorna true se existe uma família/sessão ativa.
 */
export function hasSession() {
  return !!localStorage.getItem(LS_FAMILY_ID);
}

/**
 * Retorna o objeto de sessão completo.
 */
export function getSession() {
  if (!_session) _session = buildSession();
  return { ..._session };
}

/**
 * Retorna o family_id (slug) da sessão atual.
 */
export function getCurrentFamilyId() {
  if (!_session) _session = buildSession();
  return _session.familyId;
}

/**
 * Retorna o nome amigável da família.
 */
export function getCurrentFamilyName() {
  if (!_session) _session = buildSession();
  return _session.familyName;
}

/**
 * Define a família a partir do nome digitado pelo usuário.
 * Gera o slug internamente; retorna false se o nome for inválido.
 */
export function setCurrentFamily(rawName) {
  const id = slugify(rawName);
  if (!id) return false;
  localStorage.setItem(LS_FAMILY_ID,   id);
  localStorage.setItem(LS_FAMILY_NAME, rawName.trim());
  _session = buildSession();
  registerFamily(id, rawName.trim());
  return id;
}

/**
 * Seleciona uma família já existente pelo seu id (slug).
 * Usado no popup de seleção de família.
 */
export function selectFamily(id) {
  const list = listFamilies();
  const found = list.find(f => f.id === id);
  if (!found) return false;
  localStorage.setItem(LS_FAMILY_ID,   found.id);
  localStorage.setItem(LS_FAMILY_NAME, found.name);
  _session = buildSession();
  return true;
}

/**
 * Remove a sessão ativa (localStorage + cache).
 */
export function clearSession() {
  localStorage.removeItem(LS_FAMILY_ID);
  localStorage.removeItem(LS_FAMILY_NAME);
  _session = null;
}

/**
 * Remove completamente a família atual do índice e da sessão.
 * Chamado por storage.resetAllData() para garantir reset total.
 */
export function clearCurrentFamilyFromIndex() {
  const id = getCurrentFamilyId();
  if (id) unregisterFamily(id);
  clearSession();
}

/**
 * Alias semântico de clearSession para quando vier autenticação real.
 */
export async function logout() {
  clearSession();
}
