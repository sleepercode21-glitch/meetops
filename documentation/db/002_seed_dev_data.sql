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