create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Authentication principals allowed to access a family. This is deliberately
-- separate from household participants, who may not have a login.
create table if not exists public.family_access (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role text not null default 'owner' check (access_role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  avatar text not null default '👤' check (char_length(avatar) between 1 and 16),
  role text not null default 'crianca' check (role in ('pai', 'mae', 'crianca')),
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_settings (
  family_id uuid primary key references public.families(id) on delete cascade,
  pin text not null default '1234' check (pin ~ '^[0-9]{4,8}$'),
  require_approval boolean not null default false,
  skip_parent_panel_pin boolean not null default true,
  team_stars_goal smallint not null default 20 check (team_stars_goal > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_custom_goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  goal_type text not null default 'family_stars' check (goal_type in ('family_stars', 'member_stars')),
  member_id uuid references public.family_members(id) on delete set null,
  icon text not null default '🏆' check (char_length(icon) between 1 and 16),
  name text not null check (char_length(trim(name)) between 1 and 80),
  target integer not null check (target > 0),
  description text not null default '',
  redeemed boolean not null default false,
  claimed_stars integer not null default 0 check (claimed_stars >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((goal_type = 'family_stars' and member_id is null) or goal_type = 'member_stars')
);

create table if not exists public.family_badges (
  family_id uuid not null references public.families(id) on delete cascade,
  badge_id text not null check (char_length(trim(badge_id)) between 1 and 80),
  unlocked_at timestamptz not null default now(),
  primary key (family_id, badge_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text not null default '',
  emoji text not null default '⭐' check (char_length(emoji) between 1 and 16),
  start_time time not null,
  end_time time not null,
  base_stars smallint not null default 0 check (base_stars >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (task_id, member_id)
);

create table if not exists public.task_schedules (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  schedule_type text not null check (schedule_type in ('once', 'weekly')),
  once_date date,
  start_date date,
  end_date date,
  weekdays smallint[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (schedule_type = 'once' and once_date is not null and weekdays is null)
    or
    (schedule_type = 'weekly' and once_date is null and weekdays is not null and cardinality(weekdays) between 1 and 7)
  ),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.task_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.task_schedules(id) on delete cascade,
  occurrence_date date not null,
  override_type text not null check (override_type in ('skip', 'override')),
  override_patch jsonb not null default '{}'::jsonb check (jsonb_typeof(override_patch) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, occurrence_date),
  check ((override_type = 'skip' and override_patch = '{}'::jsonb) or override_type = 'override')
);

create table if not exists public.task_occurrence_status (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.task_schedules(id) on delete cascade,
  occurrence_date date not null,
  status text not null check (status in ('done', 'fail')),
  stars_granted smallint not null default 0 check (stars_granted >= 0),
  bonus jsonb not null default '{}'::jsonb check (jsonb_typeof(bonus) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, occurrence_date)
);

create table if not exists public.manual_star_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete restrict,
  event_date date not null,
  stars integer not null check (stars <> 0),
  reason text not null check (char_length(trim(reason)) between 1 and 120),
  source text not null default 'manual' check (source in ('manual', 'custom_goal')),
  source_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_summaries (
  family_id uuid not null references public.families(id) on delete cascade,
  summary_date date not null,
  done_count integer not null default 0 check (done_count >= 0),
  total_count integer not null default 0 check (total_count >= 0),
  completion_pct smallint not null default 0 check (completion_pct between 0 and 100),
  stars integer not null default 0,
  finalized_at timestamptz not null default now(),
  primary key (family_id, summary_date)
);

create table if not exists public.weekly_summaries (
  family_id uuid not null references public.families(id) on delete cascade,
  week_start date not null,
  finalized_at timestamptz,
  primary key (family_id, week_start)
);
