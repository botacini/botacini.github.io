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
// Evita múltiplas leituras de localStorage e fornece a base
// para quando a sessão vier de uma fonte assíncrona (Supabase).
let _session = null;

function buildSession() {
  const familyId   = localStorage.getItem(LS_FAMILY_ID)   || null;
  const familyName = localStorage.getItem(LS_FAMILY_NAME) || '';
  return {
    authenticated: false,   // false até existir Supabase Auth
    user:          null,     // será { id, email } quando autenticado
    familyId:      familyId || 'familia_a',
    familyName,
  };
}

/* ════════════════ API PÚBLICA ════════════════ */

/**
 * Inicializa a sessão. Deve ser aguardado antes de qualquer
 * acesso à sessão. Hoje é síncrono via localStorage; no futuro
 * fará await supabase.auth.getSession().
 * Retorna true se houver sessão válida (família definida).
 */
export async function initialize() {
  _session = buildSession();
  return hasSession();
}

/**
 * Retorna true se existe uma família/sessão ativa.
 */
export function hasSession() {
  // Há sessão se o family_id foi explicitamente gravado pelo usuário.
  // Não depende do valor do cache — lê direto da fonte para ser seguro
  // mesmo se chamado antes de initialize().
  return !!localStorage.getItem(LS_FAMILY_ID);
}

/**
 * Retorna o objeto de sessão completo.
 * Estrutura estável — não muda quando o backend mudar:
 * { authenticated, user, familyId, familyName }
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
 * Atualiza o cache de sessão imediatamente.
 */
export function setCurrentFamily(rawName) {
  const id = slugify(rawName);
  if (!id) return false;
  localStorage.setItem(LS_FAMILY_ID,   id);
  localStorage.setItem(LS_FAMILY_NAME, rawName.trim());
  _session = buildSession();
  return id;
}

/**
 * Remove a sessão ativa (localStorage + cache).
 * Usar para trocar de família ou encerrar a sessão local.
 */
export function clearSession() {
  localStorage.removeItem(LS_FAMILY_ID);
  localStorage.removeItem(LS_FAMILY_NAME);
  _session = null;
}

/**
 * Alias semântico de clearSession para quando vier autenticação real.
 * No futuro fará também supabase.auth.signOut().
 */
export async function logout() {
  clearSession();
}
