-- Session-level comments
-- Comments belong to the whole coordination flow, not to a specific poll.

create table if not exists session_comments (
  session_comment_id bigserial primary key,
  session_id bigint not null references sessions(session_id) on delete cascade,
  user_id bigint not null references users(user_id) on delete cascade,
  body varchar(1000) not null,
  created_at timestamptz not null default now(),
  constraint session_comments_body_not_blank check (length(trim(body)) > 0)
);

create index if not exists idx_session_comments_session_created_at
  on session_comments(session_id, created_at);

create index if not exists idx_session_comments_user_id
  on session_comments(user_id);
