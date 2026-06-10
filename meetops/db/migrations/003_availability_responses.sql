create table if not exists availability_responses (
  availability_response_id bigserial primary key,
  poll_id bigint not null references polls(poll_id) on delete cascade,
  option_id bigint not null references poll_options(option_id) on delete cascade,
  user_id bigint not null references users(user_id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ux_availability_responses_option_user unique (option_id, user_id),
  constraint ck_availability_responses_range check (end_at > start_at)
);

create index if not exists idx_availability_responses_poll_id
  on availability_responses(poll_id);

create index if not exists idx_availability_responses_option_id
  on availability_responses(option_id);

create index if not exists idx_availability_responses_user_id
  on availability_responses(user_id);

create index if not exists idx_availability_responses_poll_range
  on availability_responses(poll_id, start_at, end_at);
