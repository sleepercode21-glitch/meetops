-- 002_seed_dev_data.sql
-- Idempotent local development data for the TechUp Session Coordination Tool.

begin;

-- ---------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------

insert into users (email, firstname, lastname, profile_photo, timezone)
values
  ('admin@techup.dev', 'TechUp', 'Admin', null, 'America/Phoenix'),
  ('host@techup.dev', 'Session', 'Host', null, 'America/Phoenix'),
  ('owner@techup.dev', 'Meeting', 'Owner', null, 'America/Phoenix'),
  ('member1@techup.dev', 'Member', 'One', null, 'America/New_York'),
  ('member2@techup.dev', 'Member', 'Two', null, 'America/Los_Angeles'),
  ('lowlevel@techup.dev', 'Low', 'Level', null, 'America/Chicago')
on conflict (email) do update
set
  firstname = excluded.firstname,
  lastname = excluded.lastname,
  timezone = excluded.timezone;

-- OAuth accounts for users who can own Google Calendar events.
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
select
  user_id,
  'google',
  'google-' || user_id,
  'fake-access-token',
  'fake-refresh-token',
  now() + interval '1 hour',
  'openid email profile https://www.googleapis.com/auth/calendar.events',
  'Bearer'
from users
where email in ('admin@techup.dev', 'host@techup.dev', 'owner@techup.dev')
on conflict (user_id, provider) do update
set
  access_token = excluded.access_token,
  refresh_token = excluded.refresh_token,
  access_token_expires_at = excluded.access_token_expires_at,
  scope = excluded.scope,
  token_type = excluded.token_type;

-- ---------------------------------------------------------------------
-- Groups and members
-- ---------------------------------------------------------------------

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
  'Private developer community session coordination group.',
  'TECHUP2026',
  now() + interval '90 days',
  true,
  50,
  4,
  owner.user_id,
  admin.user_id
from users admin
join users owner on owner.email = 'owner@techup.dev'
where admin.email = 'admin@techup.dev'
on conflict (invite_code) do update
set
  name = excluded.name,
  description = excluded.description,
  invite_enabled = excluded.invite_enabled,
  invite_max_uses = excluded.invite_max_uses,
  default_meeting_owner = excluded.default_meeting_owner;

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
  'Low Level Club',
  'Operating systems, networking, compilers, and database internals study group.',
  'LOWLEVEL',
  now() + interval '60 days',
  true,
  25,
  3,
  host.user_id,
  host.user_id
from users host
where host.email = 'host@techup.dev'
on conflict (invite_code) do update
set
  name = excluded.name,
  description = excluded.description,
  invite_enabled = excluded.invite_enabled,
  invite_max_uses = excluded.invite_max_uses,
  default_meeting_owner = excluded.default_meeting_owner;

insert into members (group_id, user_id, is_admin)
select g.group_id, u.user_id, u.email in ('admin@techup.dev', 'owner@techup.dev')
from groups g
cross join users u
where g.invite_code = 'TECHUP2026'
  and u.email in (
    'admin@techup.dev',
    'host@techup.dev',
    'owner@techup.dev',
    'member1@techup.dev',
    'member2@techup.dev'
  )
on conflict (group_id, user_id) do update
set is_admin = excluded.is_admin;

insert into members (group_id, user_id, is_admin)
select g.group_id, u.user_id, u.email = 'host@techup.dev'
from groups g
cross join users u
where g.invite_code = 'LOWLEVEL'
  and u.email in ('host@techup.dev', 'lowlevel@techup.dev', 'member1@techup.dev')
on conflict (group_id, user_id) do update
set is_admin = excluded.is_admin;

-- ---------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------

insert into sessions (
  topic,
  description,
  host,
  group_id,
  meeting_owner,
  calendar_invite_policy,
  scheduled_start_time,
  scheduled_end_time,
  calendar_event_id,
  google_calendar_id,
  meet_link,
  status
)
select
  'System Design: Monitoring and Logging',
  'Learn metrics, logs, alerts, and practical observability tradeoffs.',
  host.user_id,
  g.group_id,
  owner.user_id,
  'interested_members',
  now() + interval '7 days',
  now() + interval '7 days 90 minutes',
  'calendar-event-monitoring-demo',
  'primary',
  'https://meet.google.com/abc-defg-hij',
  'scheduled'
from groups g
join users host on host.email = 'host@techup.dev'
join users owner on owner.email = 'owner@techup.dev'
where g.invite_code = 'TECHUP2026'
  and not exists (
    select 1
    from sessions s
    where s.group_id = g.group_id
      and s.topic = 'System Design: Monitoring and Logging'
  );

insert into sessions (topic, description, host, group_id, meeting_owner, calendar_invite_policy, status)
select
  'Frontend State Machines',
  'Collecting final timing votes for a practical state modeling workshop.',
  host.user_id,
  g.group_id,
  owner.user_id,
  'app_only',
  'polling'
from groups g
join users host on host.email = 'host@techup.dev'
join users owner on owner.email = 'owner@techup.dev'
where g.invite_code = 'TECHUP2026'
  and not exists (
    select 1 from sessions s
    where s.group_id = g.group_id
      and s.topic = 'Frontend State Machines'
  );

insert into sessions (topic, description, host, group_id, meeting_owner, calendar_invite_policy, status)
select
  'Postgres Indexing Clinic',
  'The final timing poll tied. A host or admin needs to choose the winning time.',
  host.user_id,
  g.group_id,
  owner.user_id,
  'all_members',
  'needs_host_decision'
from groups g
join users host on host.email = 'host@techup.dev'
join users owner on owner.email = 'owner@techup.dev'
where g.invite_code = 'TECHUP2026'
  and not exists (
    select 1 from sessions s
    where s.group_id = g.group_id
      and s.topic = 'Postgres Indexing Clinic'
  );

insert into sessions (
  topic,
  description,
  host,
  group_id,
  meeting_owner,
  calendar_invite_policy,
  scheduling_error,
  scheduling_attempt_count,
  last_scheduling_attempt_at,
  status
)
select
  'TCP From First Principles',
  'A low-level session on reliable transport, congestion, and packet traces.',
  host.user_id,
  g.group_id,
  lowlevel.user_id,
  'app_only',
  'Google Calendar permission missing for selected meeting owner.',
  2,
  now() - interval '6 hours',
  'scheduling_failed'
from groups g
join users host on host.email = 'host@techup.dev'
join users lowlevel on lowlevel.email = 'lowlevel@techup.dev'
where g.invite_code = 'LOWLEVEL'
  and not exists (
    select 1 from sessions s
    where s.group_id = g.group_id
      and s.topic = 'TCP From First Principles'
  );

insert into sessions (topic, description, host, group_id, calendar_invite_policy, status)
select
  null,
  'The host is collecting topic suggestions before publishing a poll.',
  host.user_id,
  g.group_id,
  'app_only',
  'draft'
from groups g
join users host on host.email = 'host@techup.dev'
where g.invite_code = 'TECHUP2026'
  and not exists (
    select 1 from sessions s
    where s.group_id = g.group_id
      and s.description = 'The host is collecting topic suggestions before publishing a poll.'
  );

-- ---------------------------------------------------------------------
-- Polls and official options
-- ---------------------------------------------------------------------

insert into polls (session_id, created_by, deadline, type, status, multi_choice, published_at, closed_at)
select s.session_id, s.host, now() - interval '1 day', 'final_timing', 'closed', false, now() - interval '5 days', now() - interval '1 day'
from sessions s
where s.topic = 'System Design: Monitoring and Logging'
  and not exists (select 1 from polls p where p.session_id = s.session_id and p.type = 'final_timing');

insert into polls (session_id, created_by, deadline, type, status, multi_choice, published_at)
select s.session_id, s.host, now() + interval '3 days', 'final_timing', 'active', false, now() - interval '1 day'
from sessions s
where s.topic = 'Frontend State Machines'
  and not exists (select 1 from polls p where p.session_id = s.session_id and p.type = 'final_timing');

insert into polls (session_id, created_by, deadline, type, status, multi_choice, published_at, closed_at)
select s.session_id, s.host, now() - interval '2 hours', 'final_timing', 'closed', false, now() - interval '4 days', now() - interval '2 hours'
from sessions s
where s.topic = 'Postgres Indexing Clinic'
  and not exists (select 1 from polls p where p.session_id = s.session_id and p.type = 'final_timing');

insert into polls (session_id, created_by, deadline, type, status, multi_choice, published_at, closed_at)
select s.session_id, s.host, now() - interval '8 hours', 'final_timing', 'closed', false, now() - interval '2 days', now() - interval '8 hours'
from sessions s
where s.topic = 'TCP From First Principles'
  and not exists (select 1 from polls p where p.session_id = s.session_id and p.type = 'final_timing');

insert into polls (session_id, created_by, deadline, type, status, multi_choice)
select s.session_id, s.host, now() + interval '5 days', 'topic', 'draft', false
from sessions s
where s.topic is null
  and s.description = 'The host is collecting topic suggestions before publishing a poll.'
  and not exists (select 1 from polls p where p.session_id = s.session_id and p.type = 'topic');

insert into poll_options (poll_id, label, start_at, end_at)
select p.poll_id, x.label, x.start_at, x.end_at
from polls p
join sessions s on s.session_id = p.session_id
cross join lateral (
  values
    ('Tuesday evening', now() + interval '7 days', now() + interval '7 days 90 minutes'),
    ('Wednesday evening', now() + interval '8 days', now() + interval '8 days 90 minutes')
) as x(label, start_at, end_at)
where s.topic = 'System Design: Monitoring and Logging'
  and p.type = 'final_timing'
on conflict (poll_id, label) do nothing;

insert into poll_options (poll_id, label, start_at, end_at)
select p.poll_id, x.label, x.start_at, x.end_at
from polls p
join sessions s on s.session_id = p.session_id
cross join lateral (
  values
    ('Thursday evening', now() + interval '10 days', now() + interval '10 days 60 minutes'),
    ('Saturday morning', now() + interval '12 days', now() + interval '12 days 60 minutes')
) as x(label, start_at, end_at)
where s.topic = 'Frontend State Machines'
  and p.type = 'final_timing'
on conflict (poll_id, label) do nothing;

insert into poll_options (poll_id, label, start_at, end_at)
select p.poll_id, x.label, x.start_at, x.end_at
from polls p
join sessions s on s.session_id = p.session_id
cross join lateral (
  values
    ('Monday evening', now() + interval '14 days', now() + interval '14 days 60 minutes'),
    ('Tuesday evening', now() + interval '15 days', now() + interval '15 days 60 minutes')
) as x(label, start_at, end_at)
where s.topic = 'Postgres Indexing Clinic'
  and p.type = 'final_timing'
on conflict (poll_id, label) do nothing;

insert into poll_options (poll_id, label, start_at, end_at)
select p.poll_id, 'Friday deep dive', now() + interval '4 days', now() + interval '4 days 90 minutes'
from polls p
join sessions s on s.session_id = p.session_id
where s.topic = 'TCP From First Principles'
  and p.type = 'final_timing'
on conflict (poll_id, label) do nothing;

-- Set selected options after poll options exist.
update sessions s
set selected_option_id = po.option_id
from polls p
join poll_options po on po.poll_id = p.poll_id
where p.session_id = s.session_id
  and s.topic = 'System Design: Monitoring and Logging'
  and po.label = 'Tuesday evening'
  and s.selected_option_id is null;

update sessions s
set selected_option_id = po.option_id
from polls p
join poll_options po on po.poll_id = p.poll_id
where p.session_id = s.session_id
  and s.topic = 'TCP From First Principles'
  and po.label = 'Friday deep dive'
  and s.selected_option_id is null;

-- ---------------------------------------------------------------------
-- Votes
-- ---------------------------------------------------------------------

insert into poll_votes (user_id, poll_id, option_id)
select u.user_id, p.poll_id, po.option_id
from users u
join polls p on true
join sessions s on s.session_id = p.session_id
join poll_options po on po.poll_id = p.poll_id
where s.topic = 'System Design: Monitoring and Logging'
  and p.type = 'final_timing'
  and po.label = 'Tuesday evening'
  and u.email in ('admin@techup.dev', 'host@techup.dev', 'member1@techup.dev')
on conflict (poll_id, option_id, user_id) do nothing;

insert into poll_votes (user_id, poll_id, option_id)
select u.user_id, p.poll_id, po.option_id
from users u
join polls p on true
join sessions s on s.session_id = p.session_id
join poll_options po on po.poll_id = p.poll_id
where s.topic = 'System Design: Monitoring and Logging'
  and p.type = 'final_timing'
  and po.label = 'Wednesday evening'
  and u.email in ('member2@techup.dev')
on conflict (poll_id, option_id, user_id) do nothing;

insert into poll_votes (user_id, poll_id, option_id)
select u.user_id, p.poll_id, po.option_id
from users u
join polls p on true
join sessions s on s.session_id = p.session_id
join poll_options po on po.poll_id = p.poll_id
where s.topic = 'Postgres Indexing Clinic'
  and p.type = 'final_timing'
  and (
    (po.label = 'Monday evening' and u.email in ('admin@techup.dev', 'member1@techup.dev'))
    or
    (po.label = 'Tuesday evening' and u.email in ('host@techup.dev', 'member2@techup.dev'))
  )
on conflict (poll_id, option_id, user_id) do nothing;

-- ---------------------------------------------------------------------
-- Suggestions
-- ---------------------------------------------------------------------

insert into suggested_options (suggestion, poll_id, suggested_by)
select 'Distributed tracing basics', p.poll_id, u.user_id
from polls p
join sessions s on s.session_id = p.session_id
join users u on u.email = 'member1@techup.dev'
where s.topic is null
  and s.description = 'The host is collecting topic suggestions before publishing a poll.'
  and p.type = 'topic'
  and not exists (
    select 1 from suggested_options so
    where so.poll_id = p.poll_id
      and so.suggestion = 'Distributed tracing basics'
  );

insert into suggested_options (suggestion, poll_id, suggested_by)
select 'Add one lunchtime option for Eastern time.', p.poll_id, u.user_id
from polls p
join sessions s on s.session_id = p.session_id
join users u on u.email = 'member2@techup.dev'
where s.topic = 'Frontend State Machines'
  and p.type = 'final_timing'
  and not exists (
    select 1 from suggested_options so
    where so.poll_id = p.poll_id
      and so.suggestion = 'Add one lunchtime option for Eastern time.'
  );

-- ---------------------------------------------------------------------
-- Audit logs
-- ---------------------------------------------------------------------

insert into audit_logs (user_id, group_id, session_id, poll_id, action, metadata)
select s.host, s.group_id, s.session_id, null, 'session_created', jsonb_build_object('topic', s.topic)
from sessions s
where s.topic in (
  'System Design: Monitoring and Logging',
  'Frontend State Machines',
  'Postgres Indexing Clinic',
  'TCP From First Principles'
)
  and not exists (
    select 1 from audit_logs al
    where al.session_id = s.session_id
      and al.action = 'session_created'
  );

insert into audit_logs (user_id, group_id, session_id, poll_id, action, metadata)
select p.created_by, s.group_id, s.session_id, p.poll_id, 'poll_published', jsonb_build_object('type', p.type)
from polls p
join sessions s on s.session_id = p.session_id
where p.published_at is not null
  and not exists (
    select 1 from audit_logs al
    where al.poll_id = p.poll_id
      and al.action = 'poll_published'
  );

insert into audit_logs (user_id, group_id, session_id, poll_id, action, metadata)
select s.host, s.group_id, s.session_id, p.poll_id, 'scheduling_failed', jsonb_build_object('error', s.scheduling_error)
from sessions s
join polls p on p.session_id = s.session_id and p.type = 'final_timing'
where s.status = 'scheduling_failed'
  and not exists (
    select 1 from audit_logs al
    where al.session_id = s.session_id
      and al.action = 'scheduling_failed'
  );

commit;
