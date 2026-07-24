/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — auth.js
   ════════════════════════════════════════════════════════════
   Única fonte de verdade sobre a sessão atual da aplicação.

   A autorização de família não depende de metadata: storage.js cria e
   consulta a relação family_access(user_id = auth.uid()).

   NENHUM outro arquivo deve:
   - chamar supabase.auth diretamente
   - conhecer 'user_metadata' ou 'family_id'
   - ler/gravar localStorage para dados de sessão
   ════════════════════════════════════════════════════════════ */

/* ── Supabase SDK (singleton compartilhado com storage.js) ─ */
function getRuntimeConfig() {
  const config = window.GP_SUPABASE_CONFIG || {};
  if (!config.url || !config.publishableKey) {
    throw new Error('[auth] configura\u00e7\u00e3o do Supabase ausente.');
  }
  return config;
}

let _client = null;
function getClient() {
  if (_client) return _client;
  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    throw new Error('[auth] Supabase SDK não encontrado.');
  }
  const config = getRuntimeConfig();
  _client = window.supabase.createClient(config.url, config.publishableKey);
  return _client;
}

/* ── Cache de sessão em memória ─────────────────────────── */
// Estrutura estável — não muda quando o backend mudar.
// Todos os outros módulos dependem SOMENTE desta forma.
let _session = null;

function buildSession(supabaseSession) {
  if (!supabaseSession) {
    return { authenticated: false, user: null, familyId: null, familyName: '', role: null };
  }
  const meta = supabaseSession.user.user_metadata || {};
  return {
    authenticated: true,
    user: {
      id:    supabaseSession.user.id,
      email: supabaseSession.user.email,
    },
    // Metadados legados n\u00e3o participam de autoriza\u00e7\u00e3o: storage.js obt\u00e9m
    // a fam\u00edlia relacional atrav\u00e9s de auth.uid() e family_access.
    familyId:   null,
    familyName: meta.family_name || '',
    role:       meta.role        || 'admin',   // 'admin' | 'member' (Fase 2)
  };
}

/* ════════════════ API PÚBLICA ════════════════ */

/**
 * Inicializa a sessão a partir do Supabase Auth.
 * Deve ser aguardado antes de qualquer acesso à sessão.
 * Retorna true se há sessão válida (usuário logado).
 */
export async function initialize() {
  try {
    const client = getClient();
    const { data } = await client.auth.getSession();
    _session = buildSession(data?.session ?? null);
    return hasSession();
  } catch (e) {
    console.error('[auth] erro ao inicializar sessão:', e);
    _session = buildSession(null);
    return false;
  }
}

/**
 * Registra listener para mudanças de estado de autenticação.
 * Útil para detectar logout em outra aba, expiração de token, etc.
 * callback(session) recebe null quando deslogado.
 */
export function onAuthStateChange(callback) {
  try {
    getClient().auth.onAuthStateChange((event, session) => {
      _session = buildSession(session);
      callback(event, _session);
    });
  } catch (e) {
    console.error('[auth] erro ao registrar listener de auth:', e);
  }
}

/**
 * Retorna true se há sessão autenticada ativa.
 */
export function hasSession() {
  return !!(_session && _session.authenticated);
}

/**
 * Retorna o objeto de sessão completo (cópia, não referência).
 * { authenticated, user, familyId, familyName, role }
 */
export function getSession() {
  if (!_session) return buildSession(null);
  return { ..._session };
}

/**
 * Retorna o family_id da sessão atual.
 * Usado por storage.js como chave primária no Supabase.
 */
export function getCurrentFamilyId() {
  if (!_session) return null;
  return _session.familyId;
}

/**
 * Retorna o nome amigável da família.
 * Usado por state.js para exibir no header.
 */
export function getCurrentFamilyName() {
  if (!_session) return '';
  return _session.familyName;
}

/**
 * Retorna o role do usuário logado.
 * 'admin' = pai/mãe | 'member' = filho (Fase 2)
 */
export function getCurrentRole() {
  if (!_session) return null;
  return _session.role;
}

/* ════════════════ AUTENTICAÇÃO ════════════════ */

/**
 * Cria uma nova conta + família.
 * A família relacional é criada no primeiro carregamento autenticado.
 * Retorna { ok: true } ou { ok: false, error: string }.
 */
export async function signUp(email, password, familyName) {
  try {
    const client  = getClient();
    const trimmed  = (familyName || '').trim();

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          family_name: trimmed,
        },
      },
    });

    if (error) return { ok: false, error: _translateError(error) };

    // Se o Supabase não exigir confirmação de email, a sessão já vem pronta
    if (data.session) {
      _session = buildSession(data.session);
    }

    return { ok: true, needsConfirmation: !data.session };
  } catch (e) {
    console.error('[auth] signUp:', e);
    return { ok: false, error: 'Erro inesperado. Tente novamente.' };
  }
}

/**
 * Faz login com email e senha.
 * Retorna { ok: true } ou { ok: false, error: string }.
 */
export async function signIn(email, password) {
  try {
    const client = getClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) return { ok: false, error: _translateError(error) };

    _session = buildSession(data.session);
    return { ok: true };
  } catch (e) {
    console.error('[auth] signIn:', e);
    return { ok: false, error: 'Erro inesperado. Tente novamente.' };
  }
}

/**
 * Encerra a sessão atual.
 */
export async function logout() {
  try {
    await getClient().auth.signOut();
  } catch (e) {
    console.error('[auth] logout:', e);
  } finally {
    _session = buildSession(null);
  }
}

/* ════════════════ UTILITÁRIOS INTERNOS ════════════════ */

/**
 * Traduz mensagens de erro do Supabase Auth para português.
 */
function _translateError(error) {
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials'))
    return 'Email ou senha incorretos.';
  if (msg.includes('email not confirmed'))
    return 'Confirme seu email antes de entrar.';
  if (msg.includes('user already registered') || msg.includes('already registered'))
    return 'Este email já está cadastrado.';
  if (msg.includes('password should be at least'))
    return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('unable to validate email address') || msg.includes('invalid email'))
    return 'Email inválido.';
  if (msg.includes('email rate limit'))
    return 'Muitas tentativas. Aguarde alguns minutos.';
  return error.message || 'Erro desconhecido.';
}

/* ════════════════ COMPATIBILIDADE (Fase 1 → Fase 2) ════════════════
   Funções mantidas para não quebrar chamadas que existiam no auth.js
   anterior. Retornam valores seguros mas não fazem mais nada com
   localStorage. */

/** @deprecated Não necessário com Supabase Auth */
export function clearSession() {
  _session = buildSession(null);
}

/** @deprecated Não necessário com Supabase Auth */
export function clearCurrentFamilyFromIndex() {
  _session = buildSession(null);
}

/** @deprecated Não necessário com Supabase Auth */
export function listFamilies() { return []; }

/** @deprecated Não necessário com Supabase Auth */
export function selectFamily() { return false; }

/** @deprecated Usar signUp() */
export function setCurrentFamily() { return null; }
