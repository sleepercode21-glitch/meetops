-- operational_queries.sql
-- Copy/adapt these query patterns in backend repository functions.
-- Parameters are shown as PostgreSQL placeholders for prepared statements.

-- ---------------------------------------------------------------------
-- Expired active polls for cron processing
-- ---------------------------------------------------------------------

select p.*
from polls p
join sessions s on s.session_id = p.session_id
where p.status = 'active'
  and p.deadline is not null
  and p.deadline <= now()
  and s.status not in ('cancelled', 'completed', 'scheduled', 'scheduling')
order by p.deadline asc
limit 50;

-- ---------------------------------------------------------------------
-- Final timing winner calculation
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- Atomic scheduling lock
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- Attendee selection
-- ---------------------------------------------------------------------

-- all_members policy
select u.email
from members m
join users u on u.user_id = m.user_id
where m.group_id = $1
order by u.email;

-- interested_members policy
select distinct u.email
from poll_votes pv
join poll_options po on po.option_id = pv.option_id
join polls p on p.poll_id = pv.poll_id
join sessions s on s.session_id = p.session_id
join users u on u.user_id = pv.user_id
where s.session_id = $1
  and p.type = 'interest'
  and po.label in ('Interested', 'Attending')
order by u.email;

-- ---------------------------------------------------------------------
-- Session detail composed payload building blocks
-- ---------------------------------------------------------------------

select
  s.*,
  g.name as group_name,
  host.email as host_email,
  owner.email as meeting_owner_email
from sessions s
join groups g on g.group_id = s.group_id
join users host on host.user_id = s.host
left join users owner on owner.user_id = coalesce(s.meeting_owner, g.default_meeting_owner)
where s.session_id = $1;

select
  p.*,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'option_id', po.option_id,
        'label', po.label,
        'start_at', po.start_at,
        'end_at', po.end_at
      )
      order by po.start_at nulls last, po.option_id
    ) filter (where po.option_id is not null),
    '[]'::jsonb
  ) as options
from polls p
left join poll_options po on po.poll_id = p.poll_id
where p.session_id = $1
group by p.poll_id
order by p.created_at;
