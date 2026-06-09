# TechUp Database

PostgreSQL schema, seed data, and verification queries for the TechUp Session Coordination Tool.

## Recommended Provider

Use managed PostgreSQL. Neon is the primary recommendation for this project because it provides hosted Postgres, branching, pooled connection strings, and Prisma compatibility.

Good alternatives:

- Supabase Postgres
- Railway Postgres
- Render Postgres
- Fly Postgres

## Neon Setup

1. Create a Neon project.
2. Create or select a database, for example `techup`.
3. In the Neon console, click **Connect**.
4. Copy the pooled connection string for application traffic.
5. If available, also copy the direct connection string for migrations.

Your `.env` should look like this:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@EP-EXAMPLE-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require"
DATABASE_MIGRATION_URL="postgresql://USER:PASSWORD@EP-EXAMPLE.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require"
```

Use `DATABASE_MIGRATION_URL` for schema changes when set. Fall back to `DATABASE_URL` if you only have one connection string.

Run the database from the `meetops/` Next.js package:

```bash
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```

`db:migrate` and `db:seed` apply the raw SQL files through `prisma db execute`, so you do not need the `psql` CLI installed. `db:verify` uses Prisma Client to confirm counts and important workflow states.

There is intentionally no hosted `db:reset` script. Dropping the `public` schema against a cloud database is too easy to run against the wrong branch/project. Use Neon branching for disposable development databases.

## Notes

- `users`, OAuth accounts, groups, members, sessions, polls, poll options, votes, suggestions, and audit logs are all represented.
- Timestamps use `timestamptz`; application display should convert to the viewer's IANA timezone.
- Google OAuth tokens are stored only in `oauth_accounts` and must never be returned to the frontend.
- Suggestions live in `suggested_options`; they are not voteable unless a host/admin copies them into `poll_options`.
- The schema enforces core referential integrity, selected-option consistency, vote-option consistency, and scheduled-session required fields.
