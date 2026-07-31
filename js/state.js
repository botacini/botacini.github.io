import {
  loadConfig, saveFamilySettings, loadDateState, loadWeekState, saveWeekState,
  loadTotals, loadBadges, saveBadges, loadBonusLog, saveBonusLog, loadFamilyWallet
} from './storage.js';

export const DAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
export const DAY_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const MEMBER_COLOR_PALETTE = ['#378add', '#e879c9', '#5cb832', '#e8b800', '#cb3232', '#8a5cf6', '#38b6ce', '#f2884b'];
export const DEFAULT_TASK_CATEGORIES = [
  { id: 'domesticos', name: 'Serviços domésticos', color: '#f2884b' },
  { id: 'homeschool', name: 'Homeschool', color: '#8a5cf6' },
  { id: 'trabalho', name: 'Trabalho', color: '#378add' },
  { id: 'igreja', name: 'Igreja', color: '#e8b800' },
  { id: 'alimentacao', name: 'Alimentação', color: '#5cb832' },
  { id: 'lazer', name: 'Lazer', color: '#38b6ce' },
  { id: 'saude', name: 'Saúde', color: '#cb3232' },
  { id: 'sono', name: 'Sono', color: '#52627a' },
  { id: 'higiene', name: 'Higiene', color: '#4ba6a6' },
  { id: 'transporte', name: 'Transporte', color: '#b56bd6' },
  { id: 'outros', name: 'Outros', color: '#74777f' }
];
export const TASK_CATEGORIES = DEFAULT_TASK_CATEGORIES.map(category => ({ ...category }));

const CATEGORY_MARKER = /^\[categoria:([a-z0-9_-]+)\]\s*/i;
function validCategoryId(value) {
  return /^[a-z0-9_-]{2,40}$/.test(String(value || ''));
}

function validColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ''));
}

export function normalizeTaskCategories(categories) {
  const source = Array.isArray(categories) && categories.length ? categories : DEFAULT_TASK_CATEGORIES;
  const seen = new Set();
  const normalized = [];
  source.forEach(category => {
    const id = String(category?.id || '').trim().toLowerCase();
    const name = String(category?.name || '').trim();
    const color = String(category?.color || '').trim();
    if (!validCategoryId(id) || !name || !validColor(color) || seen.has(id)) return;
    seen.add(id);
    normalized.push({ id, name: name.slice(0, 60), color });
  });
  return normalized.length ? normalized : DEFAULT_TASK_CATEGORIES.map(category => ({ ...category }));
}

export function setTaskCategories(categories) {
  TASK_CATEGORIES.splice(0, TASK_CATEGORIES.length, ...normalizeTaskCategories(categories));
}

export function makeCategoryId(name, categories = TASK_CATEGORIES) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'categoria';
  const used = new Set(categories.map(category => category.id));
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function taskCategoryFromDescription(description) {
  const id = String(description || '').match(CATEGORY_MARKER)?.[1]?.toLowerCase() || 'outros';
  if (TASK_CATEGORIES.some(category => category.id === id)) return id;
  return TASK_CATEGORIES.some(category => category.id === 'outros') ? 'outros' : TASK_CATEGORIES[0]?.id || 'outros';
}
export function taskDescriptionWithCategory(categoryId, description = '') {
  const fallback = TASK_CATEGORIES.some(category => category.id === 'outros') ? 'outros' : TASK_CATEGORIES[0]?.id || 'outros';
  const validId = TASK_CATEGORIES.some(category => category.id === categoryId) ? categoryId : fallback;
  return `[categoria:${validId}] ${String(description || '').replace(CATEGORY_MARKER, '').trim()}`.trim();
}

export function nextMemberColor(members) {
  const used = new Set((members || []).map(member => member.color).filter(Boolean));
  return MEMBER_COLOR_PALETTE.find(color => !used.has(color)) || MEMBER_COLOR_PALETTE[(members || []).length % MEMBER_COLOR_PALETTE.length];
}

export const ALL_BADGES = [
  { id: 'primeira-corrida', icon: '🏁', name: 'PRIMEIRA CORRIDA', desc: 'Complete seu primeiro dia' },
  { id: 'sem-erros', icon: '✅', name: 'SEM ERROS', desc: 'Termine um dia sem nenhuma falha' },
  { id: 'capricho-total', icon: '✨', name: 'CAPRICHO TOTAL', desc: 'Ganhe 10 estrelas de bônus no total' },
  { id: 'semana-completa', icon: '🏆', name: 'SEMANA COMPLETA', desc: 'Finalize os 7 dias da semana' }
];

function pad2(value) { return String(value).padStart(2, '0'); }
export function todayKey(date = new Date()) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; }
export function dateFromKey(dateKey) { return new Date(`${dateKey}T00:00:00`); }
export function weekKeyOf(date = new Date()) {
  const local = new Date(date);
  local.setDate(local.getDate() - ((local.getDay() + 6) % 7));
  return todayKey(local);
}
export function weekKeyOfDateKey(dateKey) { return weekKeyOf(dateFromKey(dateKey)); }
export function shiftDateKey(dateKey, deltaDays) {
  const local = dateFromKey(dateKey);
  local.setDate(local.getDate() + deltaDays);
  return todayKey(local);
}
export function isSelectedDateToday() { return state.selectedDate === state.today; }
export function timeToMin(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function assigneeIds(mission, members) {
  const assignee = mission.assignee;
  if (assignee === 'compartilhada') return (members || state.config?.members || []).map(member => member.id);
  if (Array.isArray(assignee)) return assignee;
  return typeof assignee === 'string' && assignee ? [assignee] : [];
}

export const state = {
  config: null,
  today: null,
  selectedDate: null,
  missions: [],
  missionStatus: {},
  memberStars: {},
  familyWallet: { earned: 0, spent: 0, balance: 0 },
  totals: {},
  badgesUnlocked: [],
  weekState: null,
  bonusLog: [],
  bonusPending: null,
  pinMode: null,
  pinBuffer: ''
};

// Kept as a synchronous compatibility helper for renderers. Occurrences are
// resolved remotely by loadDateContext(), never derived from a weekday bucket.
export function getTodayMissions() { return [...state.missions]; }

export async function loadDateContext(dateKey) {
  const normalized = dateKey || todayKey();
  state.selectedDate = normalized;
  const [dateState, week, bonusLog, familyWallet] = await Promise.all([
    loadDateState(normalized, state.config.members),
    loadWeekState(weekKeyOfDateKey(normalized)),
    loadBonusLog(),
    loadFamilyWallet()
  ]);
  state.missions = dateState.missions.sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  state.missionStatus = dateState.missionStatus;
  state.memberStars = dateState.memberStars;
  state.weekState = week;
  state.bonusLog = bonusLog;
  state.familyWallet = familyWallet;
}

export async function loadState() {
  state.config = await loadConfig();
  setTaskCategories(state.config.taskCategories);
  state.config.taskCategories = TASK_CATEGORIES.map(category => ({ ...category }));
  state.today = todayKey();
  const [totals, badges, bonusLog] = await Promise.all([loadTotals(), loadBadges(), loadBonusLog()]);
  state.totals = totals;
  state.badgesUnlocked = badges;
  state.bonusLog = bonusLog;
  await loadDateContext(state.today);
}

export async function saveConfig() { return saveFamilySettings(state.config); }
// State is already persisted by specific task/status operations. These exports
// remain only for non-task callers during the incremental UI migration.
export async function persistDayState() {}
export async function persistTotals() { state.totals = await loadTotals(); }
export async function persistBadges() { return saveBadges(state.badgesUnlocked); }
export async function persistBonusLog() { state.bonusLog = await loadBonusLog(); return saveBonusLog(); }
export async function persistWeekState() { return saveWeekState(state.weekState.weekKey, state.weekState); }
