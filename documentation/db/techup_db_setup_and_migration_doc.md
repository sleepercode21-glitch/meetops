# TechUp Session Coordination Tool — Database Setup and Usable Schema Guide

This document is meant to be fed directly to Codex or another coding agent so it can set up a working PostgreSQL database for the TechUp session coordination product.

The goal is not just to mirror the DBML. The goal is to convert the DBML into a usable production-style PostgreSQL schema with enums, primary keys, foreign keys, defaults, indexes, timestamps, constraints, seed data, verification queries, and implementation rules.

Source schema includes these core tables: `users`, `oauth_accounts`, `groups`, `members`, `sessions`, `polls`, `poll_options`, `poll_votes`, `suggested_options`, and `audit_logs`.

---

## 1. Recommended Stack

Use this database setup for the MVP:

- Database: PostgreSQL 15+
- Primary hosted provider: Neon Postgres
- Alternative hosted providers: Supabase Postgres, Railway Postgres, Render Postgres, Fly Postgres, or another managed PostgreSQL 15+ service
- ORM option: Prisma, Drizzle, or raw SQL
- Migration source of truth: SQL migrations or ORM migrations generated from the schema below
- Timestamp storage: UTC only
- Application timezone display: convert UTC timestamps to the viewer's IANA timezone in the app layer

Do not use SQLite for this product because the app needs PostgreSQL enums, JSON metadata, transactional behavior, foreign keys, composite constraints, and reliable scheduled-job queries.

For Neon:

- Create a Neon project and database for this app.
- Copy the pooled connection string for normal app/serverless traffic.
- Copy the direct connection string for migrations if you want to keep migrations separate from pooled runtime traffic.
- Neon connection strings should include SSL, for example `sslmode=require&channel_binding=require`.
- Use Neon branches for disposable development or preview databases instead of dropping schemas in a shared database.

---

## 2. Required Environment Variables

The backend should load these environment variables:

```env
DATABASE_URL=postgresql://USER:PASSWORD@EP-EXAMPLE-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require
DATABASE_MIGRATION_URL=postgresql://USER:PASSWORD@EP-EXAMPLE.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require

GOOGLE_CLIENT_ID=replace_me
GOOGLE_CLIENT_SECRET=replace_me
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

APP_BASE_URL=http://localhost:3000
CRON_SECRET=replace_me_for_poll_closing_job

NODE_ENV=development
```

Never hardcode database credentials in source code. Store hosted database URLs in environment variables in local shells, deployment settings, or a secret manager.

---

## 3. Hosted PostgreSQL Setup

### 3.1 Neon Postgres

1. Create a Neon project.
2. Create/select a database such as `techup`.
3. Open the Neon project dashboard and click `Connect`.
4. Copy the pooled connection string into `DATABASE_URL`.
5. Copy the direct connection string into `DATABASE_MIGRATION_URL` if available.
6. Run the migration and seed SQL through Prisma from the `meetops/` package.

Example:

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@EP-EXAMPLE-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require"
export DATABASE_MIGRATION_URL="postgresql://USER:PASSWORD@EP-EXAMPLE.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require"
```

### 3.2 Supabase Postgres or Similar Managed Postgres

Supabase, Railway, Render, and Fly Postgres can also work if they provide a PostgreSQL 15+ connection string.

For Supabase specifically:

- Use a direct connection string for migrations, backups, and `psql`.
- Use a pooler connection string for serverless or high-concurrency runtime traffic.
- Keep SSL enabled when your provider requires it.

---

## 4. Migration File Structure

Use this folder structure:

```text
db/
  migrations/
    001_init_schema.sql
    002_seed_dev_data.sql
  queries/
    verification_queries.sql
```

Run migrations manually:

```bash
cd meetops
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
```

Run verification:

```bash
pnpm db:verify
```

---

## 5. Important Database Design Fixes from DBML to PostgreSQL

The DBML is conceptually correct, but executable PostgreSQL should add several details:

1. Use `bigserial` or `generated always as identity` for numeric primary keys.
2. Use `timestamptz`, not plain `timestamp`, for all timestamps.
3. Store all timestamps in UTC.
4. Use PostgreSQL enums for session status, poll status, poll type, calendar invite policy, and audit action.
5. Add foreign-key `ON DELETE` behavior intentionally.
6. Add check constraints for deadlines, option time ranges, invite counts, and scheduling attempts.
7. Add partial unique indexes where product behavior requires only one active poll of a type per session.
8. Add `jsonb`, not `json`, for audit metadata.
9. Add updated-at trigger support.
10. Add indexes that match the API query patterns.

---

## 6. Executable PostgreSQL Schema

Create `db/migrations/001_init_schema.sql` with the following SQL.

```sql
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
```

---

## 7. Application-Level Constraints That the DB Alone Should Not Handle

Some rules must be enforced in backend service code, not only through SQL constraints.

### 7.1 Membership and Ownership Rules

Backend must check:

- User must be logged in for all protected routes.
- User must be a member of the group to view group data.
- User must be host or group admin to edit a session.
- User must be host or group admin to create, edit, publish, close, cancel, or supersede polls.
- User must be a group admin to update group settings or default meeting owner.
- User must be a member to vote.
- Removed users cannot view future session details for that group.

### 7.2 Poll Option Rules

Backend must check:

- Poll options can only be created, edited, or deleted while the poll is `draft`.
- Members cannot vote on draft polls.
- Active poll options should not normally be edited.
- Availability and final timing poll options must have both `start_at` and `end_at`.
- Interest/topic poll options should not need `start_at` or `end_at`.

### 7.3 Voting Rules

Backend must check:

- Poll must be `active`.
- Poll deadline must not be in the past.
- Option must belong to the poll.
- User must belong to the session's group.
- Single-choice polls replace the user's previous vote.
- Multi-choice polls allow multiple selected options.
- Duplicate votes must not create duplicate rows.

### 7.4 Scheduling Rules

Backend must check:

- Only `final_timing` polls trigger automatic scheduling.
- Ties move the session to `needs_host_decision`.
- No-vote final timing polls move the session to `needs_host_decision`.
- One clear winner moves the session to `scheduling` before any Google Calendar call.
- Session becomes `scheduled` only after calendar event ID and Meet link are stored.
- If Google Calendar fails, session becomes `scheduling_failed`.
- Rescheduling must reuse existing `calendar_event_id` if present.

---

## 8. Seed Data for Local Development

Create `db/migrations/002_seed_dev_data.sql`:

```sql
begin;

-- Users
insert into users (email, firstname, lastname, profile_photo, timezone)
values
  ('admin@techup.dev', 'TechUp', 'Admin', null, 'America/Phoenix'),
  ('host@techup.dev', 'Session', 'Host', null, 'America/Phoenix'),
  ('member1@techup.dev', 'Member', 'One', null, 'America/New_York'),
  ('member2@techup.dev', 'Member', 'Two', null, 'America/Los_Angeles')
on conflict (email) do nothing;

-- OAuth accounts for admin and host.
-- Tokens are fake placeholders. Do not use these for real Google Calendar calls.
insert into oauth_accounts (
  user_id,
  provider,
  provider_account_id,
  access_token,
  refresh_token,
  access_token_expires_at,
  scope,
  token_type
)
select user_id, 'google', 'google-' || user_id, 'fake-access-token', 'fake-refresh-token', now() + interval '1 hour',
       'openid email profile https://www.googleapis.com/auth/calendar.events', 'Bearer'
from users
where email in ('admin@techup.dev', 'host@techup.dev')
on conflict (user_id, provider) do nothing;

-- Group
insert into groups (
  name,
  description,
  invite_code,
  invite_code_expires_at,
  invite_enabled,
  invite_max_uses,
  invite_used_count,
  default_meeting_owner,
  created_by
)
select
  'TechUp Programmers',
  'Private developer community session coordination group',
  'TECHUP2026',
  now() + interval '90 days',
  true,
  50,
  4,
  admin.user_id,
  admin.user_id
from users admin
where admin.email = 'admin@techup.dev'
on conflict (invite_code) do nothing;

-- Members
insert into members (group_id, user_id, is_admin)
select g.group_id, u.user_id, (u.email = 'admin@techup.dev')
from groups g
cross join users u
where g.invite_code = 'TECHUP2026'
  and u.email in ('admin@techup.dev', 'host@techup.dev', 'member1@techup.dev', 'member2@techup.dev')
on conflict (group_id, user_id) do nothing;

-- Session
insert into sessions (
  topic,
  description,
  host,
  group_id,
  calendar_invite_policy,
  status
)
select
  'System Design: Monitoring and Logging',
  'Community session to explain metrics, logs, time-series databases, and alerting pipelines.',
  host.user_id,
  g.group_id,
  'interested_members',
  'polling'
from users host
join groups g on g.invite_code = 'TECHUP2026'
where host.email = 'host@techup.dev'
  and not exists (
    select 1 from sessions s
    where s.group_id = g.group_id
      and s.topic = 'System Design: Monitoring and Logging'
  );

-- Interest poll
insert into polls (session_id, created_by, deadline, type, status, multi_choice, published_at)
select
  s.session_id,
  s.host,
  now() + interval '2 days',
  'interest',
  'active',
  false,
  now()
from sessions s
where s.topic = 'System Design: Monitoring and Logging'
  and not exists (
    select 1 from polls p where p.session_id = s.session_id and p.type = 'interest'
  );

insert into poll_options (poll_id, label)
select p.poll_id, x.label
from polls p
cross join (values ('Interested'), ('Not interested')) as x(label)
join sessions s on s.session_id = p.session_id
where s.topic = 'System Design: Monitoring and Logging'
  and p.type = 'interest'
  and not exists (
    select 1 from poll_options po where po.poll_id = p.poll_id and po.label = x.label
  );

-- Final timing poll
insert into polls (session_id, created_by, deadline, type, status, multi_choice, published_at)
select
  s.session_id,
  s.host,
  now() + interval '3 days',
  'final_timing',
  'active',
  false,
  now()
from sessions s
where s.topic = 'System Design: Monitoring and Logging'
  and not exists (
    select 1 from polls p where p.session_id = s.session_id and p.type = 'final_timing'
  );

insert into poll_options (poll_id, label, start_at, end_at)
select p.poll_id, x.label, x.start_at, x.end_at
from polls p
cross join (
  values
    ('Saturday 8 PM Phoenix Time', date_trunc('hour', now()) + interval '5 days 20 hours', date_trunc('hour', now()) + interval '5 days 21 hours'),
    ('Sunday 8 PM Phoenix Time', date_trunc('hour', now()) + interval '6 days 20 hours', date_trunc('hour', now()) + interval '6 days 21 hours')
) as x(label, start_at, end_at)
join sessions s on s.session_id = p.session_id
where s.topic = 'System Design: Monitoring and Logging'
  and p.type = 'final_timing'
  and not exists (
    select 1 from poll_options po where po.poll_id = p.poll_id and po.label = x.label
  );

commit;
```

Run seed data:

```bash
cd meetops
pnpm db:seed
```

---

## 9. Verification Queries

Create `db/queries/verification_queries.sql`:

```sql
-- 1. Confirm tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2. Confirm enum values
select typname as enum_name, enumlabel as enum_value
from pg_type t
join pg_enum e on t.oid = e.enumtypid
where typname in ('session_status', 'calendar_invite_policy', 'poll_status', 'poll_type', 'audit_action')
order by enum_name, e.enumsortorder;

-- 3. Dashboard: groups current user belongs to
select g.group_id, g.name, m.is_admin, m.joined_at
from groups g
join members m on m.group_id = g.group_id
join users u on u.user_id = m.user_id
where u.email = 'host@techup.dev'
order by g.created_at desc;

-- 4. Group sessions
select s.session_id, s.topic, s.status, s.calendar_invite_policy, s.scheduled_start_time, s.meet_link
from sessions s
join groups g on g.group_id = s.group_id
where g.invite_code = 'TECHUP2026'
order by s.created_at desc;

-- 5. Polls under a session
select p.poll_id, p.type, p.status, p.deadline, p.multi_choice, count(po.option_id) as option_count
from polls p
left join poll_options po on po.poll_id = p.poll_id
group by p.poll_id
order by p.created_at;

-- 6. Vote counts for a poll
select
  p.poll_id,
  p.type,
  po.option_id,
  po.label,
  count(pv.poll_vote_id) as vote_count
from polls p
join poll_options po on po.poll_id = p.poll_id
left join poll_votes pv on pv.option_id = po.option_id
group by p.poll_id, p.type, po.option_id, po.label
order by p.poll_id, vote_count desc, po.option_id;

-- 7. Expired active polls for cron job
select poll_id, session_id, type, deadline
from polls
where status = 'active'
  and deadline is not null
  and deadline <= now()
order by deadline asc;

-- 8. Sessions needing host action
select session_id, topic, status, scheduling_error
from sessions
where status in ('needs_host_decision', 'scheduling_failed')
order by updated_at desc;

-- 9. Confirm scheduled sessions are valid
select session_id, topic, status, scheduled_start_time, scheduled_end_time, meeting_owner, calendar_event_id, meet_link
from sessions
where status = 'scheduled';

-- 10. Audit trail for a session
select al.created_at, al.action, al.metadata
from audit_logs al
where al.session_id = 1
order by al.created_at asc;
```

Run verification:

```bash
cd meetops
pnpm db:verify
```

---

## 10. Backend Database Access Rules

The backend should use a database module with these repository functions.

### 10.1 User Repository

Required functions:

```ts
upsertUserFromGoogleProfile(profile): Promise<User>
upsertOAuthAccount(userId, googleTokenPayload): Promise<OAuthAccount>
getUserById(userId): Promise<User | null>
getUserByEmail(email): Promise<User | null>
getOAuthAccountForUser(userId, provider = 'google'): Promise<OAuthAccount | null>
```

Implementation rules:

- Use `users.email` as unique identity for the app user.
- Use `(provider, provider_account_id)` as unique identity for the OAuth account.
- Never return `access_token` or `refresh_token` to the frontend.

### 10.2 Group Repository

Required functions:

```ts
createGroup({ name, description, createdBy, inviteCode }): Promise<Group>
joinGroupByInviteCode({ userId, inviteCode }): Promise<Member>
getGroupsForUser(userId): Promise<GroupSummary[]>
getGroupByIdForUser(groupId, userId): Promise<GroupDetails | null>
assertGroupMember(groupId, userId): Promise<void>
assertGroupAdmin(groupId, userId): Promise<void>
setDefaultMeetingOwner(groupId, meetingOwnerUserId, actorUserId): Promise<Group>
removeMember(groupId, targetUserId, actorUserId): Promise<void>
```

`joinGroupByInviteCode` must run in a transaction:

1. Lock group row using `for update`.
2. Validate invite code exists.
3. Validate `invite_enabled = true`.
4. Validate `invite_code_expires_at is null or invite_code_expires_at > now()`.
5. Validate `invite_used_count < invite_max_uses`.
6. Insert into `members`.
7. Increment `invite_used_count` only if a new member row was inserted.
8. Commit.

### 10.3 Session Repository

Required functions:

```ts
createSession({ groupId, hostUserId, topic, description, calendarInvitePolicy }): Promise<Session>
getSessionForMember(sessionId, userId): Promise<SessionDetails | null>
listSessionsForGroup(groupId, userId, filters): Promise<SessionSummary[]>
updateSessionDraft(sessionId, actorUserId, patch): Promise<Session>
cancelSession(sessionId, actorUserId): Promise<Session>
markSessionCompleted(sessionId, actorUserId): Promise<Session>
startRescheduling(sessionId, actorUserId): Promise<Session>
```

Implementation rules:

- On create, insert `sessions.status = 'draft'`.
- Creator becomes `sessions.host`.
- User must be group member.
- Only host/admin can update session.
- Cancelled/completed sessions reject new polls and votes.

### 10.4 Poll Repository

Required functions:

```ts
createPoll({ sessionId, actorUserId, type, deadline, multiChoice }): Promise<Poll>
addPollOption({ pollId, actorUserId, label, startAt, endAt }): Promise<PollOption>
updatePollOption({ optionId, actorUserId, label, startAt, endAt }): Promise<PollOption>
deletePollOption({ optionId, actorUserId }): Promise<void>
publishPoll({ pollId, actorUserId }): Promise<Poll>
closePoll({ pollId, actorUserId, closeReason }): Promise<Poll>
listPollsForSession(sessionId, userId): Promise<PollWithOptions[]>
```

`publishPoll` must run in a transaction:

1. Lock poll row with `for update`.
2. Validate actor is host/admin.
3. Validate poll status is `draft`.
4. Validate poll has at least one option.
5. If poll type is `availability` or `final_timing`, validate every option has `start_at` and `end_at`.
6. Update poll to `active`, set `published_at = now()`.
7. Update session status according to poll type:
   - `interest` -> `interest_check`
   - `topic` -> `topic_selection`
   - `availability` -> `availability_collection`
   - `final_timing` -> `polling`
8. Insert `audit_logs.poll_published`.
9. Commit.

### 10.5 Vote Repository

Required functions:

```ts
submitVote({ pollId, optionIds, userId }): Promise<VoteResult>
getPollResults(pollId, userId): Promise<PollResults>
getUserVotesForPoll(pollId, userId): Promise<PollVote[]>
```

Single-choice vote transaction:

1. Lock poll row.
2. Validate poll is active.
3. Validate deadline is not expired.
4. Validate user is group member.
5. Validate exactly one option ID was submitted.
6. Validate option belongs to poll.
7. Load old vote IDs for `(poll_id, user_id)`.
8. Delete old votes for `(poll_id, user_id)`.
9. Insert new vote.
10. Audit as `vote_submitted` if no old vote; otherwise `vote_changed`.
11. Commit.

Multi-choice vote transaction:

1. Lock poll row.
2. Validate poll is active.
3. Validate deadline is not expired.
4. Validate user is group member.
5. Validate all option IDs belong to poll.
6. Delete old votes for `(poll_id, user_id)`.
7. Insert one row per selected option.
8. Use `on conflict do nothing` for duplicate client clicks.
9. Audit as `vote_submitted` or `vote_changed`.
10. Commit.

### 10.6 Suggestion Repository

Required functions:

```ts
createSuggestion({ pollId, userId, suggestion }): Promise<SuggestedOption>
listSuggestionsForPoll(pollId, actorUserId): Promise<SuggestedOption[]>
```

Rules:

- Suggestions belong to a poll.
- Suggestions are not voteable.
- Suggestions do not appear in `poll_options` unless host/admin manually creates a poll option.
- Any member can suggest under a poll if session is not cancelled/completed.
- MVP does not need approve/reject status.

### 10.7 Scheduling Repository

Required functions:

```ts
closeExpiredPolls(): Promise<JobResult>
handleFinalTimingPollClosed(pollId): Promise<SchedulingResult>
calculateWinningOption(pollId): Promise<WinningOptionResult>
startSchedulingSession(sessionId, selectedOptionId): Promise<Session | null>
markSessionScheduled(payload): Promise<Session>
markSchedulingFailed(sessionId, error): Promise<Session>
retryScheduling(sessionId, actorUserId): Promise<Session>
manualSelectFinalTime({ sessionId, actorUserId, optionId }): Promise<Session>
```

Important: never hold a DB transaction open while calling Google Calendar.

Correct scheduling pattern:

1. In a short transaction, close the poll and calculate the winner.
2. If tie/no votes, update session to `needs_host_decision`.
3. If clear winner, atomically update session to `scheduling` with `selected_option_id`.
4. Commit.
5. Call Google Calendar outside transaction.
6. In a new short transaction, store calendar event ID, Meet link, scheduled times, meeting owner, and status `scheduled`.
7. If Google fails, store error and status `scheduling_failed`.

---

## 11. Critical SQL Patterns for the Backend

### 11.1 Atomic Scheduling Lock

Use this before Google Calendar calls:

```sql
update sessions
set
  status = 'scheduling',
  selected_option_id = $2,
  scheduling_attempt_count = scheduling_attempt_count + 1,
  last_scheduling_attempt_at = now(),
  scheduling_error = null,
  updated_at = now()
where session_id = $1
  and status in ('polling', 'needs_host_decision', 'rescheduling', 'scheduling_failed')
  and (
    calendar_event_id is null
    or status in ('rescheduling', 'scheduling_failed')
  )
returning *;
```

If this returns zero rows, another request or cron job already owns scheduling.

### 11.2 Cron Query for Expired Polls

```sql
select p.*
from polls p
join sessions s on s.session_id = p.session_id
where p.status = 'active'
  and p.deadline is not null
  and p.deadline <= now()
  and s.status not in ('cancelled', 'completed', 'scheduled', 'scheduling')
order by p.deadline asc
limit 50;
```

### 11.3 Final Timing Winner Query

```sql
with vote_counts as (
  select
    po.option_id,
    po.poll_id,
    po.label,
    po.start_at,
    po.end_at,
    count(pv.poll_vote_id) as vote_count
  from poll_options po
  left join poll_votes pv on pv.option_id = po.option_id
  where po.poll_id = $1
  group by po.option_id
), ranked as (
  select
    *,
    rank() over (order by vote_count desc) as vote_rank
  from vote_counts
)
select *
from ranked
where vote_rank = 1;
```

Backend interpretation:

- If top row count is zero and `vote_count = 0`, no-vote case.
- If more than one row has `vote_rank = 1` and `vote_count > 0`, tie case.
- If exactly one row has `vote_rank = 1` and `vote_count > 0`, clear winner.

### 11.4 All Group Members as Calendar Attendees

```sql
select u.email
from members m
join users u on u.user_id = m.user_id
where m.group_id = $1
order by u.email;
```

### 11.5 Interested Members as Calendar Attendees

For MVP, define interested members as users who selected an interest poll option whose label is `Interested` or `Attending`.

```sql
select distinct u.email
from sessions s
join polls p on p.session_id = s.session_id
join poll_options po on po.poll_id = p.poll_id
join poll_votes pv on pv.option_id = po.option_id
join users u on u.user_id = pv.user_id
where s.session_id = $1
  and p.type = 'interest'
  and po.label in ('Interested', 'Attending')
order by u.email;
```

### 11.6 Check Whether User Is Group Admin

```sql
select exists (
  select 1
  from members
  where group_id = $1
    and user_id = $2
    and is_admin = true
) as is_admin;
```

### 11.7 Check Whether User Is Session Host or Group Admin

```sql
select exists (
  select 1
  from sessions s
  join members m on m.group_id = s.group_id and m.user_id = $2
  where s.session_id = $1
    and (s.host = $2 or m.is_admin = true)
) as can_manage;
```

---

## 12. Recommended API-to-DB Transaction Boundaries

Use transactions for:

- OAuth profile + OAuth account upsert
- Group creation + creator membership insert
- Joining group + invite count increment
- Session creation + audit log insert
- Poll creation + audit log insert
- Poll option create/update/delete + audit log insert
- Poll publishing + session status update + audit log insert
- Vote replacement + audit log insert
- Poll closing + scheduling decision update
- Manual final time selection + scheduling state update
- Cancellation + audit log insert
- Member removal + audit log insert

Do not keep transactions open during:

- Google Calendar event creation
- Google Calendar event update
- Google token refresh call if it requires network access
- Any external API call

---

## 13. Google OAuth and Calendar Token Storage

The `oauth_accounts` table stores the selected user's Google token data.

Rules:

- Backend only reads and writes token fields.
- Frontend never receives token fields.
- `scope` must include `https://www.googleapis.com/auth/calendar.events` for the meeting owner.
- If refresh token is missing or invalid, scheduling must fail with `scheduling_failed`.
- Group default meeting owner must be a user who has an OAuth account with Calendar event scope.

Query to check a valid meeting owner candidate:

```sql
select u.user_id, u.email, oa.scope, oa.refresh_token is not null as has_refresh_token
from users u
join oauth_accounts oa on oa.user_id = u.user_id
where u.user_id = $1
  and oa.provider = 'google'
  and oa.scope like '%https://www.googleapis.com/auth/calendar.events%';
```

---

## 14. Minimal Prisma Model Mapping Notes

If using Prisma instead of raw SQL, map enums and relations carefully.

Important notes:

- Use `BigInt` for IDs if SQL uses `bigserial`.
- Use `DateTime` for `timestamptz`.
- Prisma does not directly create every advanced check constraint. Keep raw SQL migration for constraints.
- Use `Json` for `audit_logs.metadata`.
- Composite primary key for `members` must be represented using `@@id([groupId, userId])`.
- Unique vote constraint must be represented using `@@unique([pollId, optionId, userId])`.
- Keep DB as source of truth for constraints and indexes.

---

## 15. Development Build Order

Use this order so Codex does not build random pieces out of sequence.

1. Provision a managed PostgreSQL 15+ database, preferably Neon Postgres.
2. Add `.env.example` with `DATABASE_URL`, optional `DATABASE_MIGRATION_URL`, and Google OAuth placeholders.
3. Add `db/migrations/001_init_schema.sql`.
4. Add `db/migrations/002_seed_dev_data.sql`.
5. Add `db/queries/verification_queries.sql`.
6. Add a database connection module.
7. Add repository functions for users and OAuth.
8. Add repository functions for groups and memberships.
9. Add repository functions for sessions.
10. Add repository functions for polls and poll options.
11. Add repository functions for votes.
12. Add repository functions for suggestions.
13. Add repository functions for scheduling.
14. Add audit log helper.
15. Add integration tests around transaction-heavy flows.
16. Add Google Calendar implementation after DB tests pass.
17. Add cron job after poll closing works manually.

---

## 16. Minimum Test Cases

### 16.1 Schema Tests

- All tables are created.
- All enums are created.
- Foreign keys work.
- Duplicate user email fails.
- Duplicate group invite code fails.
- Duplicate membership fails.
- Duplicate poll vote for same user, poll, and option fails.
- Scheduled session without Meet link fails.
- Poll option with end time before start time fails.

### 16.2 Group Tests

- User can create group.
- Group creator becomes admin.
- User can join group with valid invite code.
- Disabled invite code is rejected.
- Expired invite code is rejected.
- Maxed-out invite code is rejected.
- Duplicate join does not increment invite count twice.

### 16.3 Poll Tests

- Host can create draft poll.
- Member cannot vote on draft poll.
- Host can add options to draft poll.
- Host cannot publish poll with no options.
- Time poll cannot publish if options do not have valid start/end times.
- Published poll becomes active.
- Active poll accepts votes.
- Closed poll rejects votes.

### 16.4 Vote Tests

- Single-choice vote inserts one vote.
- Single-choice vote replacement deletes old vote and inserts new vote.
- Multi-choice vote inserts multiple options.
- Duplicate click does not duplicate votes.
- User outside group cannot vote.
- Option from another poll is rejected.

### 16.5 Scheduling Tests

- Final timing poll with clear winner moves session to scheduling.
- Tie moves session to needs_host_decision.
- No-vote moves session to needs_host_decision.
- Scheduling failure stores scheduling error.
- Retry scheduling increments attempt count.
- Rescheduling uses existing calendar_event_id.
- Duplicate cron execution does not create duplicate scheduling action.

---

## 17. Common Mistakes to Avoid

Do not create a notifications table for MVP. Calendar reminders are handled through Google Calendar attendees.

Do not make suggestions voteable. Suggestions are separate from official poll options.

Do not use the session host automatically as the Google Calendar event creator if the group has `default_meeting_owner` configured.

Do not schedule from interest, topic, or availability polls. Only final timing polls schedule sessions.

Do not expose Google OAuth tokens through API responses.

Do not call Google Calendar inside a long database transaction.

Do not mark a session as scheduled until all required scheduling fields exist.

Do not create a new Calendar event during rescheduling if `calendar_event_id` already exists.

Do not forget `poll_votes`. It is central to voting, result aggregation, and attendee selection for interested-member invitation policy.

---

## 18. Definition of Done for Database Setup

Database setup is complete when:

- A managed PostgreSQL database exists, preferably in Neon.
- `DATABASE_URL` points at hosted Postgres with SSL enabled.
- `DATABASE_MIGRATION_URL` points at a direct/admin-capable hosted Postgres connection when available.
- `001_init_schema.sql` runs without errors against the hosted database.
- `002_seed_dev_data.sql` runs without errors against the hosted database.
- Verification queries return users, group, members, sessions, polls, and options.
- Duplicate membership is prevented.
- Duplicate vote for the same poll option is prevented.
- Final timing poll options support `start_at` and `end_at`.
- Session cannot be marked `scheduled` unless scheduled time, meeting owner, calendar event ID, and Meet link are present.
- Backend can query expired active polls for the cron job.
- Backend can aggregate poll vote counts.
- Backend can select Calendar attendees using `all_members`, `interested_members`, or `app_only` policy.
```
