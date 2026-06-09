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