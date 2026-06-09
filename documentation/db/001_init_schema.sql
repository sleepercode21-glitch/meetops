-- 001_init_schema.sql
-- TechUp Session Coordination Tool
-- PostgreSQL 15+

begin;

-- Optional but useful for case-insensitive email uniqueness.
create extension if not exists citext;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

do $$ begin
  create type session_status as enum (
    'draft',
    'interest_check',
    'topic_selection',
    'availability_collection',
    'polling',
    'needs_host_decision',
    'scheduling',
    'scheduled',
    'scheduling_failed',
    'rescheduling',
    'cancelled',
    'completed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type calendar_invite_policy as enum (
    'all_members',
    'interested_members',
    'app_only'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type poll_status as enum (
    'draft',
    'active',
    'closed',
    'cancelled',
    'superseded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type poll_type as enum (
    'interest',
    'topic',
    'availability',
    'final_timing'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type audit_action as enum (
    'session_created',
    'poll_created',
    'poll_option_created',
    'poll_option_updated',
    'poll_option_deleted',
    'poll_published',
    'poll_closed',
    'vote_submitted',
    'vote_changed',
    'topic_suggested',
    'session_scheduled',
    'session_cancelled',
    'session_rescheduled',
    'scheduling_failed',
    'calendar_event_created',
    'calendar_event_updated',
    'calendar_event_cancelled',
    'calendar_attendees_updated',
    'member_removed',
    'member_role_updated'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------

create table if not exists users (
  user_id bigserial primary key,
  email citext unique not null,
  firstname varchar(60),
  lastname varchar(60),
  profile_photo varchar(500),
  timezone varchar(80) not null default 'America/Los_Angeles',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint users_email_not_blank check (length(trim(email::text)) > 0),
  constraint users_timezone_not_blank check (length(trim(timezone)) > 0)
);

create trigger trg_users_updated_at
before update on users
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- oauth_accounts
-- ---------------------------------------------------------------------

create table if not exists oauth_accounts (
  oauth_account_id bigserial primary key,
  user_id bigint not null references users(user_id) on delete cascade,
  provider varchar(50) not null,
  provider_account_id varchar(255) not null,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  scope text,
  token_type varchar(50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint oauth_provider_not_blank check (length(trim(provider)) > 0),
  constraint oauth_provider_account_id_not_blank check (length(trim(provider_account_id)) > 0),
  constraint oauth_provider_supported check (provider in ('google'))
);

create unique index if not exists ux_oauth_provider_provider_account
  on oauth_accounts(provider, provider_account_id);

create unique index if not exists ux_oauth_user_provider
  on oauth_accounts(user_id, provider);

create trigger trg_oauth_accounts_updated_at
before update on oauth_accounts
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------

create table if not exists groups (
  group_id bigserial primary key,
  name varchar(60) not null,
  description varchar(500),
  invite_code varchar(20) unique,
  invite_code_expires_at timestamptz,
  invite_enabled boolean not null default true,
  invite_max_uses integer not null default 50,
  invite_used_count integer not null default 0,
  default_meeting_owner bigint references users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by bigint not null references users(user_id) on delete restrict,

  constraint groups_name_not_blank check (length(trim(name)) > 0),
  constraint groups_invite_max_uses_positive check (invite_max_uses > 0),
  constraint groups_invite_used_count_nonnegative check (invite_used_count >= 0),
  constraint groups_invite_used_not_above_max check (invite_used_count <= invite_max_uses)
);

create index if not exists idx_groups_invite_code on groups(invite_code);
create index if not exists idx_groups_created_by on groups(created_by);
create index if not exists idx_groups_default_meeting_owner on groups(default_meeting_owner);

create trigger trg_groups_updated_at
before update on groups
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------

create table if not exists members (
  group_id bigint not null references groups(group_id) on delete cascade,
  user_id bigint not null references users(user_id) on delete cascade,
  joined_at timestamptz not null default now(),
  is_admin boolean not null default false,
  primary key (group_id, user_id)
);

create index if not exists idx_members_user_id on members(user_id);
create index if not exists idx_members_group_id on members(group_id);
create index if not exists idx_members_group_admin on members(group_id, is_admin);

-- ---------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------

create table if not exists sessions (
  session_id bigserial primary key,
  topic varchar(100),
  description varchar(1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  host bigint not null references users(user_id) on delete restrict,
  group_id bigint not null references groups(group_id) on delete cascade,
  meeting_owner bigint references users(user_id) on delete set null,
  calendar_invite_policy calendar_invite_policy not null default 'app_only',
  scheduled_start_time timestamptz,
  scheduled_end_time timestamptz,
  calendar_event_id varchar(255),
  google_calendar_id varchar(255) not null default 'primary',
  meet_link varchar(500),
  selected_option_id bigint,
  scheduling_error varchar(1000),
  scheduling_attempt_count integer not null default 0,
  last_scheduling_attempt_at timestamptz,
  status session_status not null default 'draft',

  constraint sessions_topic_not_blank_if_present check (topic is null or length(trim(topic)) > 0),
  constraint sessions_schedule_time_order check (
    scheduled_start_time is null
    or scheduled_end_time is null
    or scheduled_end_time > scheduled_start_time
  ),
  constraint sessions_scheduling_attempt_count_nonnegative check (scheduling_attempt_count >= 0),
  constraint sessions_scheduled_requires_fields check (
    status <> 'scheduled'
    or (
      scheduled_start_time is not null
      and scheduled_end_time is not null
      and meeting_owner is not null
      and calendar_event_id is not null
      and meet_link is not null
    )
  )
);

create index if not exists idx_sessions_group_id on sessions(group_id);
create index if not exists idx_sessions_host on sessions(host);
create index if not exists idx_sessions_meeting_owner on sessions(meeting_owner);
create index if not exists idx_sessions_status on sessions(status);
create index if not exists idx_sessions_scheduled_start_time on sessions(scheduled_start_time);
create index if not exists idx_sessions_calendar_event_id on sessions(calendar_event_id);
create index if not exists idx_sessions_calendar_invite_policy on sessions(calendar_invite_policy);
create index if not exists idx_sessions_group_status_start on sessions(group_id, status, scheduled_start_time);

create trigger trg_sessions_updated_at
before update on sessions
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- polls
-- ---------------------------------------------------------------------

create table if not exists polls (
  poll_id bigserial primary key,
  session_id bigint not null references sessions(session_id) on delete cascade,
  created_by bigint not null references users(user_id) on delete restrict,
  deadline timestamptz,
  type poll_type not null,
  status poll_status not null default 'draft',
  multi_choice boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  closed_at timestamptz,

  constraint polls_publish_timestamp_valid check (
    (status = 'active' and published_at is not null)
    or status <> 'active'
  ),
  constraint polls_closed_timestamp_valid check (
    (status = 'closed' and closed_at is not null)
    or status <> 'closed'
  )
);

create index if not exists idx_polls_session_id on polls(session_id);
create index if not exists idx_polls_created_by on polls(created_by);
create index if not exists idx_polls_status on polls(status);
create index if not exists idx_polls_deadline on polls(deadline);
create index if not exists idx_polls_type on polls(type);
create index if not exists idx_polls_status_deadline on polls(status, deadline);
create index if not exists idx_polls_session_type_status on polls(session_id, type, status);

-- Optional but strongly recommended for MVP clarity:
-- only one active poll of each type per session.
create unique index if not exists ux_one_active_poll_per_session_type
  on polls(session_id, type)
  where status = 'active';

create trigger trg_polls_updated_at
before update on polls
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- poll_options
-- ---------------------------------------------------------------------

create table if not exists poll_options (
  option_id bigserial primary key,
  poll_id bigint not null references polls(poll_id) on delete cascade,
  label varchar(255) not null,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint poll_options_label_not_blank check (length(trim(label)) > 0),
  constraint poll_options_time_order check (
    start_at is null
    or end_at is null
    or end_at > start_at
  )
);

create index if not exists idx_poll_options_poll_id on poll_options(poll_id);
create index if not exists idx_poll_options_start_at on poll_options(start_at);
create index if not exists idx_poll_options_poll_start on poll_options(poll_id, start_at);

create trigger trg_poll_options_updated_at
before update on poll_options
for each row execute function set_updated_at();

-- Add selected_option_id foreign key after poll_options exists.
alter table sessions
  add constraint fk_sessions_selected_option
  foreign key (selected_option_id)
  references poll_options(option_id)
  on delete set null;

-- ---------------------------------------------------------------------
-- poll_votes
-- ---------------------------------------------------------------------

create table if not exists poll_votes (
  poll_vote_id bigserial primary key,
  user_id bigint not null references users(user_id) on delete cascade,
  poll_id bigint not null references polls(poll_id) on delete cascade,
  option_id bigint not null references poll_options(option_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_poll_votes_poll_option_user
  on poll_votes(poll_id, option_id, user_id);

create index if not exists idx_poll_votes_poll_user on poll_votes(poll_id, user_id);
create index if not exists idx_poll_votes_poll_id on poll_votes(poll_id);
create index if not exists idx_poll_votes_option_id on poll_votes(option_id);
create index if not exists idx_poll_votes_user_id on poll_votes(user_id);

create trigger trg_poll_votes_updated_at
before update on poll_votes
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- suggested_options
-- ---------------------------------------------------------------------

create table if not exists suggested_options (
  suggestion_id bigserial primary key,
  suggestion varchar(255) not null,
  poll_id bigint not null references polls(poll_id) on delete cascade,
  suggested_by bigint not null references users(user_id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint suggested_options_suggestion_not_blank check (length(trim(suggestion)) > 0)
);

create index if not exists idx_suggested_options_poll_id on suggested_options(poll_id);
create index if not exists idx_suggested_options_suggested_by on suggested_options(suggested_by);

-- ---------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------

create table if not exists audit_logs (
  audit_log_id bigserial primary key,
  user_id bigint references users(user_id) on delete set null,
  group_id bigint references groups(group_id) on delete cascade,
  session_id bigint references sessions(session_id) on delete cascade,
  poll_id bigint references polls(poll_id) on delete cascade,
  action audit_action not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_user_id on audit_logs(user_id);
create index if not exists idx_audit_logs_group_id on audit_logs(group_id);
create index if not exists idx_audit_logs_session_id on audit_logs(session_id);
create index if not exists idx_audit_logs_poll_id on audit_logs(poll_id);
create index if not exists idx_audit_logs_action on audit_logs(action);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);
create index if not exists idx_audit_logs_metadata_gin on audit_logs using gin(metadata);

commit;