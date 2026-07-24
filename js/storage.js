/* Persistencia relacional do GP da Familia.
   Nenhuma funcao deste modulo le ou grava family_config JSONB. */
import { getCurrentFamilyName } from './auth.js';

let client = null;
let currentFamilyId = null;

function getRuntimeConfig() {
  const config = window.GP_SUPABASE_CONFIG || {};
  if (!config.url || !config.publishableKey) {
    throw new Error('Configuracao do Supabase ausente. Copie js/supabase-config.example.js.');
  }
  return config;
}

function getClient() {
  if (client) return client;
  if (!window.supabase?.createClient) throw new Error('Supabase SDK nao encontrado.');
  const config = getRuntimeConfig();
  client = window.supabase.createClient(config.url, config.publishableKey);
  return client;
}

function fail(context, error) {
  console.error(`[storage] ${context}:`, error);
  throw new Error(error?.message || `Falha ao ${context}.`);
}

function timeValue(value) {
  return typeof value === 'string' ? value.slice(0, 5) : value;
}

export function invalidateCache() {
  currentFamilyId = null;
}

export async function ensureFamily() {
  if (currentFamilyId) return currentFamilyId;
  const { data, error } = await getClient().rpc('bootstrap_current_family', {
    p_family_name: getCurrentFamilyName() || 'Minha Familia'
  });
  if (error) fail('preparar familia', error);
  currentFamilyId = data;
  return currentFamilyId;
}

export async function loadConfig() {
  const familyId = await ensureFamily();
  const db = getClient();
  const [familyResult, settingsResult, membersResult, goalsResult] = await Promise.all([
    db.from('families').select('id,name').eq('id', familyId).single(),
    db.from('family_settings').select('*').eq('family_id', familyId).single(),
    db.from('family_members').select('*').eq('family_id', familyId).order('created_at'),
    db.from('family_custom_goals').select('*').eq('family_id', familyId).order('created_at')
  ]);
  if (familyResult.error) fail('carregar familia', familyResult.error);
  if (settingsResult.error) fail('carregar configuracoes', settingsResult.error);
  if (membersResult.error) fail('carregar membros', membersResult.error);
  if (goalsResult.error) fail('carregar metas', goalsResult.error);

  return {
    familyId,
    familyName: familyResult.data.name,
    members: membersResult.data.map(member => ({ ...member })),
    pin: settingsResult.data.pin,
    requireApproval: settingsResult.data.require_approval,
    skipParentPanelPin: settingsResult.data.skip_parent_panel_pin,
    teamStarsGoal: settingsResult.data.team_stars_goal,
    customGoals: goalsResult.data.map(goal => ({
      id: goal.id,
      type: goal.goal_type,
      memberId: goal.member_id,
      icon: goal.icon,
      name: goal.name,
      target: goal.target,
      desc: goal.description,
      redeemed: goal.redeemed,
      claimedStars: goal.claimed_stars
    }))
  };
}

export async function saveFamilySettings(settings) {
  const familyId = await ensureFamily();
  const { error } = await getClient().from('family_settings').update({
    pin: settings.pin,
    require_approval: !!settings.requireApproval,
    skip_parent_panel_pin: !!settings.skipParentPanelPin,
    team_stars_goal: Number(settings.teamStarsGoal) || 20
  }).eq('family_id', familyId);
  if (error) fail('salvar configuracoes', error);
}

export async function createFamilyMember(member) {
  const familyId = await ensureFamily();
  const { data, error } = await getClient().from('family_members').insert({
    family_id: familyId,
    name: member.name,
    avatar: member.avatar || '👤',
    role: member.role || 'crianca',
    color: member.color || null
  }).select().single();
  if (error) fail('criar membro', error);
  return data;
}

export async function updateFamilyMember(memberId, patch) {
  const payload = {};
  if ('name' in patch) payload.name = patch.name;
  if ('avatar' in patch) payload.avatar = patch.avatar;
  if ('role' in patch) payload.role = patch.role;
  if ('color' in patch) payload.color = patch.color;
  const { data, error } = await getClient().from('family_members').update(payload).eq('id', memberId).select().single();
  if (error) fail('atualizar membro', error);
  return data;
}

export async function deleteFamilyMember(memberId) {
  const { error } = await getClient().from('family_members').delete().eq('id', memberId);
  if (error) fail('remover membro', error);
}

function mapOccurrence(row) {
  return {
    id: row.occurrence_id,
    occurrenceId: row.occurrence_id,
    scheduleId: row.schedule_id,
    taskId: row.task_id,
    date: row.occurrence_date,
    title: row.title,
    desc: row.description || '',
    emoji: row.emoji,
    start: timeValue(row.start_time),
    end: timeValue(row.end_time),
    baseStars: row.base_stars || 0,
    assignee: row.assignee_ids || [],
    schedule: {
      type: row.schedule_type,
      date: row.once_date,
      startDate: row.start_date,
      endDate: row.end_date,
      weekdays: row.weekdays || []
    },
    status: row.occurrence_status
      ? { status: row.occurrence_status, stars: row.stars_granted || 0, bonus: row.bonus || {} }
      : null
  };
}

export async function loadDateState(dateKey, members) {
  const db = getClient();
  const [occurrencesResult, manualResult] = await Promise.all([
    db.rpc('get_occurrences_for_date', { p_occurrence_date: dateKey }),
    db.from('manual_star_events').select('member_id,stars').eq('event_date', dateKey)
  ]);
  if (occurrencesResult.error) fail('resolver ocorrencias', occurrencesResult.error);
  if (manualResult.error) fail('carregar bonus do dia', manualResult.error);

  const missions = occurrencesResult.data.map(mapOccurrence);
  const missionStatus = {};
  const memberStars = Object.fromEntries((members || []).map(member => [member.id, 0]));
  missions.forEach(mission => {
    if (!mission.status) return;
    missionStatus[mission.id] = mission.status;
    if (mission.status.status === 'done' && mission.status.stars) {
      mission.assignee.forEach(memberId => {
        memberStars[memberId] = (memberStars[memberId] || 0) + mission.status.stars;
      });
    }
  });
  manualResult.data.forEach(event => {
    memberStars[event.member_id] = (memberStars[event.member_id] || 0) + event.stars;
  });
  return { missions, missionStatus, memberStars };
}

export async function createTaskWithSchedule(task, schedule, assigneeIds) {
  const familyId = await ensureFamily();
  const { data, error } = await getClient().rpc('create_task_with_schedule', {
    p_family_id: familyId,
    p_task: task,
    p_schedule: schedule,
    p_assignee_ids: assigneeIds || []
  });
  if (error) fail('criar tarefa', error);
  return data?.[0] || null;
}

export async function updateTaskSeries(taskId, scheduleId, task, schedule, assigneeIds) {
  const { error } = await getClient().rpc('update_task_series', {
    p_task_id: taskId,
    p_schedule_id: scheduleId,
    p_task: task,
    p_schedule: schedule,
    p_assignee_ids: assigneeIds || []
  });
  if (error) fail('atualizar serie', error);
}

export async function splitTaskScheduleForFuture(scheduleId, fromDate, task, schedule, assigneeIds) {
  const { data, error } = await getClient().rpc('split_task_schedule_for_future', {
    p_schedule_id: scheduleId,
    p_from_date: fromDate,
    p_task: task,
    p_schedule: schedule,
    p_assignee_ids: assigneeIds || []
  });
  if (error) fail('dividir serie', error);
  return data?.[0] || null;
}

export async function setOccurrenceOverride(scheduleId, dateKey, type, patch = {}) {
  const { error } = await getClient().rpc('set_task_occurrence_override', {
    p_schedule_id: scheduleId,
    p_occurrence_date: dateKey,
    p_override_type: type,
    p_override_patch: patch
  });
  if (error) fail('salvar excecao', error);
}

export async function deleteTaskSchedule(scheduleId) {
  const { error } = await getClient().rpc('delete_task_schedule', { p_schedule_id: scheduleId });
  if (error) fail('remover serie', error);
}

export async function setOccurrenceStatus(mission, status) {
  const { error } = await getClient().rpc('set_task_occurrence_status', {
    p_schedule_id: mission.scheduleId,
    p_occurrence_date: mission.date,
    p_status: status.status,
    p_stars_granted: status.stars || 0,
    p_bonus: status.bonus || {}
  });
  if (error) fail('salvar status', error);
}

export async function clearOccurrenceStatus(mission) {
  const { error } = await getClient().rpc('clear_task_occurrence_status', {
    p_schedule_id: mission.scheduleId,
    p_occurrence_date: mission.date
  });
  if (error) fail('limpar status', error);
}

export async function loadTotals() {
  const familyId = await ensureFamily();
  const { data, error } = await getClient().rpc('get_family_star_totals', { p_family_id: familyId });
  if (error) fail('carregar totais', error);
  return Object.fromEntries((data || []).map(row => [row.member_id, Number(row.stars) || 0]));
}

export async function addManualStarEvent({ memberId, date, stars, reason, source = 'manual', sourceId = null }) {
  const familyId = await ensureFamily();
  const { error } = await getClient().from('manual_star_events').insert({
    family_id: familyId,
    member_id: memberId,
    event_date: date,
    stars,
    reason,
    source,
    source_id: sourceId
  });
  if (error) fail('registrar bonus', error);
}

export async function deleteManualStarEventsBySource(source, sourceId) {
  const { error } = await getClient().from('manual_star_events').delete().eq('source', source).eq('source_id', sourceId);
  if (error) fail('remover eventos de estrelas', error);
}

export async function loadBadges() {
  const familyId = await ensureFamily();
  const { data, error } = await getClient().from('family_badges').select('badge_id').eq('family_id', familyId);
  if (error) fail('carregar conquistas', error);
  return data.map(row => row.badge_id);
}

export async function saveBadges(badgeIds) {
  const familyId = await ensureFamily();
  const rows = [...new Set(badgeIds || [])].map(badgeId => ({ family_id: familyId, badge_id: badgeId }));
  if (!rows.length) return;
  const { error } = await getClient().from('family_badges').upsert(rows, { onConflict: 'family_id,badge_id', ignoreDuplicates: true });
  if (error) fail('salvar conquistas', error);
}

export async function loadWeekState(weekKey) {
  const familyId = await ensureFamily();
  const start = new Date(`${weekKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const { data, error } = await getClient().from('daily_summaries')
    .select('*').eq('family_id', familyId)
    .gte('summary_date', weekKey)
    .lte('summary_date', `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`);
  if (error) fail('carregar resumo semanal', error);
  const weekly = await getClient().from('weekly_summaries').select('*').eq('family_id', familyId).eq('week_start', weekKey).maybeSingle();
  if (weekly.error) fail('carregar fechamento semanal', weekly.error);
  return {
    weekKey,
    days: Object.fromEntries(data.map(day => [day.summary_date, {
      done: day.done_count,
      total: day.total_count,
      pct: day.completion_pct,
      stars: day.stars
    }])),
    finalized: !!weekly.data?.finalized_at
  };
}

export async function saveWeekState(weekKey, weekState) {
  const familyId = await ensureFamily();
  const dailyRows = Object.entries(weekState.days || {}).map(([date, day]) => ({
    family_id: familyId,
    summary_date: date,
    done_count: day.done,
    total_count: day.total,
    completion_pct: day.pct,
    stars: day.stars
  }));
  if (dailyRows.length) {
    const { error } = await getClient().from('daily_summaries').upsert(dailyRows, { onConflict: 'family_id,summary_date' });
    if (error) fail('salvar resumo diario', error);
  }
  if (weekState.finalized) {
    const { error } = await getClient().from('weekly_summaries').upsert({
      family_id: familyId,
      week_start: weekKey,
      finalized_at: new Date().toISOString()
    }, { onConflict: 'family_id,week_start' });
    if (error) fail('salvar fechamento semanal', error);
  }
}

export async function loadBonusLog() {
  const familyId = await ensureFamily();
  const { data, error } = await getClient().from('manual_star_events').select('*').eq('family_id', familyId).order('created_at', { ascending: false });
  if (error) fail('carregar historico de bonus', error);
  return data.map(event => ({
    id: event.id,
    date: event.event_date,
    memberId: event.member_id,
    stars: event.stars,
    reason: event.reason,
    type: event.stars > 0 ? 'bonus' : 'penalty',
    timestamp: event.created_at
  }));
}

export async function saveBonusLog() {}

export async function createCustomGoal(goal) {
  const familyId = await ensureFamily();
  const { data, error } = await getClient().from('family_custom_goals').insert({
    family_id: familyId,
    goal_type: goal.type || 'family_stars',
    member_id: goal.memberId || null,
    icon: goal.icon || '🏆',
    name: goal.name,
    target: goal.target,
    description: goal.desc || '',
    redeemed: !!goal.redeemed,
    claimed_stars: goal.claimedStars || 0
  }).select().single();
  if (error) fail('criar meta', error);
  return data;
}

export async function updateCustomGoal(goal) {
  const { error } = await getClient().from('family_custom_goals').update({
    goal_type: goal.type,
    member_id: goal.memberId || null,
    icon: goal.icon,
    name: goal.name,
    target: goal.target,
    description: goal.desc || '',
    redeemed: !!goal.redeemed,
    claimed_stars: goal.claimedStars || 0
  }).eq('id', goal.id);
  if (error) fail('atualizar meta', error);
}

export async function deleteCustomGoal(goalId) {
  const { error } = await getClient().from('family_custom_goals').delete().eq('id', goalId);
  if (error) fail('remover meta', error);
}

export async function exportAllData() {
  const familyId = await ensureFamily();
  const db = getClient();
  const [family, settings, members, goals, badges, tasks, assignees, schedules, overrides, statuses, events, dailySummaries, weeklySummaries] = await Promise.all([
    db.from('families').select('*').eq('id', familyId).single(),
    db.from('family_settings').select('*').eq('family_id', familyId).single(),
    db.from('family_members').select('*').eq('family_id', familyId),
    db.from('family_custom_goals').select('*').eq('family_id', familyId),
    db.from('family_badges').select('*').eq('family_id', familyId),
    db.from('tasks').select('*').eq('family_id', familyId),
    db.from('task_assignees').select('task_id,member_id'),
    db.from('task_schedules').select('*'),
    db.from('task_schedule_overrides').select('*'),
    db.from('task_occurrence_status').select('*'),
    db.from('manual_star_events').select('*').eq('family_id', familyId),
    db.from('daily_summaries').select('*').eq('family_id', familyId),
    db.from('weekly_summaries').select('*').eq('family_id', familyId)
  ]);
  const results = [family, settings, members, goals, badges, tasks, assignees, schedules, overrides, statuses, events, dailySummaries, weeklySummaries];
  const failed = results.find(result => result.error);
  if (failed) fail('exportar backup', failed.error);
  const taskIds = new Set(tasks.data.map(task => task.id));
  const scheduleIds = new Set(schedules.data.filter(schedule => taskIds.has(schedule.task_id)).map(schedule => schedule.id));
  return {
    format: 'gp-da-familia-relational-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    family: family.data,
    settings: settings.data,
    members: members.data,
    customGoals: goals.data,
    badges: badges.data,
    tasks: tasks.data,
    taskAssignees: assignees.data.filter(row => taskIds.has(row.task_id)),
    schedules: schedules.data.filter(row => scheduleIds.has(row.id)),
    overrides: overrides.data.filter(row => scheduleIds.has(row.schedule_id)),
    occurrenceStatuses: statuses.data.filter(row => scheduleIds.has(row.schedule_id)),
    manualStarEvents: events.data,
    dailySummaries: dailySummaries.data,
    weeklySummaries: weeklySummaries.data
  };
}

// Importacao restrita ao formato relacional versionado; a RPC substitui tudo
// em uma unica transacao, sem montar gravacoes parciais no navegador.
export async function importAllData(data) {
  if (data?.format !== 'gp-da-familia-relational-backup' || data.version !== 1) {
    throw new Error('Backup incompatível. Backups JSONB antigos não são aceitos.');
  }
  const { error } = await getClient().rpc('restore_family_backup', { p_backup: data });
  if (error) fail('importar backup', error);
}

export async function resetAllData() {
  throw new Error('Reset remoto nao esta disponivel nesta versao para evitar exclusao acidental de dados relacionais.');
}
