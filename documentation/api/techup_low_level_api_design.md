# TechUp Session Coordination Tool — Low-Level API Design

## 0. Purpose

This document is a low-level backend API contract for building the TechUp Session Coordination Tool.

The product is an internal coordination app for private developer communities. It replaces WhatsApp-based manual planning with a structured workflow for creating sessions, collecting interest, collecting topic/availability suggestions, publishing polls, voting on final timing options, and automatically creating Google Calendar events and Google Meet links.

This document is written so an implementation agent can build the product without guessing business rules.

## 1. Core Product Rules

### 1.1 MVP scope

The MVP includes:

- Google OAuth authentication only.
- Private groups.
- Invite-code based group joining.
- Group admins and regular members.
- Group-level default meeting owner.
- Session creation.
- Interest, topic, availability, and final timing polls.
- Draft, active, closed, cancelled, and superseded poll lifecycle.
- Poll-level suggestions.
- Official poll options.
- Single-choice and multi-choice voting.
- Automatic poll closing through a scheduled job.
- Final timing selection.
- Tie and no-vote handling.
- Google Calendar event creation.
- Google Meet link generation.
- Calendar invitation policies.
- Audit logs.

The MVP excludes:

- In-app notification inbox.
- Notification read/unread state.
- Custom reminder jobs.
- WhatsApp automation.
- SMS reminders.
- Email reminders.
- Attendance tracking.
- Recurring sessions.
- AI topic recommendations.
- Full calendar availability sync.
- Reading members' calendars.
- Automatic session summaries.
- Advanced analytics.

Calendar reminders are delegated to Google Calendar when members are added as event attendees.

### 1.2 Meeting owner vs session host

The session host is the user who manages the session inside the application.

The meeting owner is the Google account used to create the Google Calendar event and Google Meet link.

These may be different users. This matters because a group may have one admin or premium Google Meet account, while another member actually hosts the session.

Meeting owner selection order:

1. Use `groups.default_meeting_owner` when configured.
2. Otherwise use `sessions.host`.
3. If the selected user has no valid Google OAuth Calendar token, scheduling fails.

### 1.3 Calendar invitation policies

`sessions.calendar_invite_policy` controls event attendees.

Supported values:

- `all_members`: add all active group members as Google Calendar attendees.
- `interested_members`: add only users who selected an Interested/Attending option in an interest poll.
- `app_only`: create event under meeting owner account, generate Meet link, but do not add group members as attendees.

Members do not need to grant Calendar permission to be added as attendees. Only the meeting owner needs Google Calendar permission.

### 1.4 Suggestions are not votes

`suggested_options` are raw member-submitted ideas attached to a poll.

They are not voteable. They are never counted in poll results.

Only rows in `poll_options` are official voteable options.

For MVP, there is no approval/rejection workflow. Host/admin manually copies useful suggestions into `poll_options` while the poll is still in draft.

### 1.5 Final timing poll is the only automatic scheduling trigger

Only a closed `final_timing` poll can trigger scheduling.

Interest, topic, and availability polls collect information but never create Calendar events.

### 1.6 Source of truth

PostgreSQL is the source of truth for users, OAuth accounts, groups, members, sessions, polls, poll options, poll votes, suggestions, and audit logs.

Google Calendar is an external dependency. The local database decides lifecycle state.

A session is considered scheduled only when all these are set:

- `sessions.status = 'scheduled'`
- `sessions.scheduled_start_time` is not null
- `sessions.scheduled_end_time` is not null
- `sessions.meeting_owner` is not null
- `sessions.calendar_event_id` is not null
- `sessions.meet_link` is not null

## 2. Recommended Implementation Stack

This section is implementation guidance. The API contract below remains valid even if the exact framework changes.

Recommended one-week MVP stack:

- Frontend: Next.js App Router.
- Backend: Next.js route handlers or serverless functions.
- Database: PostgreSQL.
- ORM/query builder: Prisma, Drizzle, or direct SQL.
- Auth: NextAuth/Auth.js with Google provider, or custom Google OAuth.
- Cron: Vercel Cron, GitHub Actions scheduled job, Supabase scheduled function, or equivalent.
- Google APIs: Google OAuth + Google Calendar API.
- Deployment: Vercel/Render/Fly frontend/backend + managed Postgres.

All API routes below assume JSON request/response.

## 3. Naming and API Conventions

### 3.1 Base URL

Use:

```text
/api/v1
```

All protected routes require an authenticated Google session.

### 3.2 IDs

Current DBML uses integer IDs:

- `user_id`
- `group_id`
- `session_id`
- `poll_id`
- `option_id`
- `poll_vote_id`
- `suggestion_id`
- `audit_log_id`

Path parameters use the same resource names:

```text
/groups/:groupId
/sessions/:sessionId
/polls/:pollId
/options/:optionId
```

### 3.3 Timestamp handling

Store timestamps in UTC.

API responses should return ISO-8601 UTC timestamps:

```json
"2026-06-09T21:30:00.000Z"
```

Frontend converts to the viewer's IANA timezone from `users.timezone`.

Do not store ambiguous timezone abbreviations such as `CST`.

### 3.4 Standard success response shape

For single-resource responses:

```json
{
  "data": {}
}
```

For list responses:

```json
{
  "data": [],
  "page": {
    "limit": 20,
    "offset": 0,
    "total": 100
  }
}
```

For action responses:

```json
{
  "data": {
    "success": true
  }
}
```

### 3.5 Standard error response shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Poll must have at least one option before publishing.",
    "details": {}
  }
}
```

Use stable machine-readable `code` values.

Recommended HTTP mappings:

- `400`: validation error.
- `401`: not authenticated.
- `403`: authenticated but not authorized.
- `404`: resource not found or inaccessible.
- `409`: state conflict, duplicate action, stale state.
- `422`: semantically invalid request.
- `500`: unexpected server error.
- `502`: Google API failure.
- `503`: temporary external dependency failure.

### 3.6 Standard error codes

Use these consistently:

```text
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
INVALID_INVITE_CODE
INVITE_DISABLED
INVITE_EXPIRED
INVITE_MAX_USES_REACHED
ALREADY_MEMBER
NOT_GROUP_MEMBER
HOST_OR_ADMIN_REQUIRED
GROUP_ADMIN_REQUIRED
INVALID_SESSION_STATUS
INVALID_POLL_STATUS
POLL_EXPIRED
POLL_HAS_NO_OPTIONS
INVALID_POLL_OPTION
DUPLICATE_VOTE
SCHEDULING_ALREADY_IN_PROGRESS
NO_VALID_MEETING_OWNER
GOOGLE_TOKEN_MISSING
GOOGLE_TOKEN_REFRESH_FAILED
GOOGLE_CALENDAR_CREATE_FAILED
GOOGLE_CALENDAR_UPDATE_FAILED
GOOGLE_MEET_LINK_MISSING
DATABASE_ERROR
```

## 4. Database Model Used by the API

The API should be implemented against these tables:

- `users`
- `oauth_accounts`
- `groups`
- `members`
- `sessions`
- `polls`
- `poll_options`
- `poll_votes`
- `suggested_options`
- `audit_logs`

### 4.1 Users

Fields:

```text
user_id integer primary key
email varchar(255) unique not null
firstname varchar(60)
lastname varchar(60)
profile_photo varchar(500)
timezone varchar(80) not null default 'America/Los_Angeles'
joined_at timestamp
updated_at timestamp
```

Rules:

- Created/updated after Google OAuth login.
- Email must be unique.
- Passwords are never stored.
- `timezone` must be a valid IANA timezone.

### 4.2 OAuth accounts

Fields:

```text
oauth_account_id integer primary key
user_id integer not null
provider varchar(50) not null
provider_account_id varchar(255) not null
access_token text
refresh_token text
access_token_expires_at timestamp
scope text
token_type varchar(50)
created_at timestamp
updated_at timestamp
```

Constraints:

- Unique `(provider, provider_account_id)`.
- Unique `(user_id, provider)`.

Rules:

- For MVP, provider is `google`.
- Tokens are backend-only.
- Access/refresh tokens must never appear in API responses.
- Scope must include Google Calendar event permission for meeting-owner scheduling.

### 4.3 Groups

Fields:

```text
group_id integer primary key
name varchar(60) not null
description varchar(500)
invite_code varchar(20) unique
invite_code_expires_at timestamp
invite_enabled bool default true
invite_max_uses integer default 50
invite_used_count integer default 0
default_meeting_owner integer references users.user_id
created_at timestamp
updated_at timestamp
created_by integer not null references users.user_id
```

Rules:

- `created_by` should automatically become an admin member.
- `default_meeting_owner`, when set, must be an active group member.
- Prefer requiring `default_meeting_owner` to be a group admin for MVP simplicity.
- Invite code joins must be atomic to prevent overuse race conditions.

### 4.4 Members

Fields:

```text
group_id integer not null
user_id integer not null
joined_at timestamp
is_admin bool default false
primary key (group_id, user_id)
```

Rules:

- Composite primary key prevents duplicate membership.
- Only group members can view group content.
- Only admins can manage group settings, invite codes, member roles, and member removals.

### 4.5 Sessions

Fields:

```text
session_id integer primary key
topic varchar(100)
description varchar(1000)
created_at timestamp
updated_at timestamp
host integer not null references users.user_id
group_id integer not null references groups.group_id
meeting_owner integer references users.user_id
calendar_invite_policy enum not null default 'app_only'
scheduled_start_time timestamp
scheduled_end_time timestamp
calendar_event_id varchar(255)
google_calendar_id varchar(255) default 'primary'
meet_link varchar(500)
selected_option_id integer references poll_options.option_id
scheduling_error varchar(1000)
scheduling_attempt_count integer default 0
last_scheduling_attempt_at timestamp
status enum not null default 'draft'
```

Session statuses:

```text
draft
interest_check
topic_selection
availability_collection
polling
needs_host_decision
scheduling
scheduled
scheduling_failed
rescheduling
cancelled
completed
```

Rules:

- Host is the creating user.
- Host must be a group member.
- New sessions start as `draft`.
- Cancelled/completed sessions reject new polls, votes, scheduling actions, and rescheduling actions.
- `meeting_owner` is stored when scheduling starts or succeeds.
- `calendar_event_id` must be reused during rescheduling.

### 4.6 Polls

Fields:

```text
poll_id integer primary key
session_id integer not null references sessions.session_id
created_by integer not null references users.user_id
deadline timestamp
type enum not null
status enum not null default 'draft'
multi_choice bool default false
created_at timestamp
updated_at timestamp
published_at timestamp
closed_at timestamp
```

Poll types:

```text
interest
topic
availability
final_timing
```

Poll statuses:

```text
draft
active
closed
cancelled
superseded
```

Rules:

- New polls start as `draft`.
- Only host/admin can create polls.
- Members cannot vote on draft polls.
- Only active polls accept votes.
- Closed/cancelled/superseded polls do not accept votes.
- `final_timing` polls require time-based options with `start_at` and `end_at`.

### 4.7 Poll options

Fields:

```text
option_id integer primary key
poll_id integer not null references polls.poll_id
label varchar(255) not null
start_at timestamp
end_at timestamp
created_at timestamp
updated_at timestamp
```

Rules:

- Only rows in this table are voteable.
- Can be created/updated/deleted only while parent poll is `draft`.
- For `availability` and `final_timing` polls, `start_at` and `end_at` are required and `end_at > start_at`.
- For `interest` and `topic` polls, `start_at` and `end_at` should normally be null.

### 4.8 Poll votes

Fields:

```text
poll_vote_id integer primary key
user_id integer not null references users.user_id
poll_id integer not null references polls.poll_id
option_id integer not null references poll_options.option_id
created_at timestamp
updated_at timestamp
```

Constraints:

- Unique `(poll_id, option_id, user_id)`.
- Index `(poll_id, user_id)` for replacing single-choice votes.

Rules:

- User must be an active member of the session's group.
- Parent poll must be active.
- Deadline must not have passed.
- Option must belong to the poll.
- Single-choice polls replace the user's existing vote.
- Multi-choice polls allow multiple option rows.
- Duplicate clicks should not create duplicate rows.

### 4.9 Suggested options

Fields:

```text
suggestion_id integer primary key
suggestion varchar(255) not null
poll_id integer not null references polls.poll_id
suggested_by integer not null references users.user_id
created_at timestamp
```

Rules:

- User must be an active group member.
- Parent poll must belong to a visible session.
- Suggested options are not voteable.
- Host/admin may manually copy suggestion text into official `poll_options`.

### 4.10 Audit logs

Fields:

```text
audit_log_id integer primary key
user_id integer
group_id integer
session_id integer
poll_id integer
action enum not null
metadata json
created_at timestamp
```

Audit actions:

```text
session_created
poll_created
poll_option_created
poll_option_updated
poll_option_deleted
poll_published
poll_closed
vote_submitted
vote_changed
topic_suggested
session_scheduled
session_cancelled
session_rescheduled
scheduling_failed
calendar_event_created
calendar_event_updated
calendar_event_cancelled
calendar_attendees_updated
member_removed
member_role_updated
```

Rules:

- Write audit logs for all lifecycle-changing operations.
- Regular members do not need audit-log visibility in MVP.
- Admin-only audit views may be added now or later.

## 5. Authorization Matrix

### 5.1 Roles

The API derives roles from `members`.

A user can be:

- Anonymous.
- Authenticated but not a group member.
- Group member.
- Session host.
- Group admin.

### 5.2 Permission rules

| Action | Required permission |
|---|---|
| View own profile | Authenticated user |
| Update own timezone | Authenticated user |
| Create group | Authenticated user |
| Join group by invite | Authenticated user |
| View group | Group member |
| View group sessions | Group member |
| View group members | Group member |
| Update group settings | Group admin |
| Configure meeting owner | Group admin |
| Remove member | Group admin |
| Create session | Group member |
| Update session draft details | Session host or group admin |
| Cancel session | Session host or group admin |
| Complete session | Session host or group admin |
| Reschedule session | Session host or group admin |
| Create poll | Session host or group admin |
| Add/edit/delete poll options | Session host or group admin, draft poll only |
| Publish poll | Session host or group admin |
| Close poll | Session host or group admin |
| Submit suggestion | Group member |
| Vote | Group member |
| Retry scheduling | Session host or group admin |
| View audit logs | Group admin |

### 5.3 Backend helper functions

Implement these reusable guards:

```ts
requireAuth(request): AuthUser
requireGroupMember(userId, groupId): Member
requireGroupAdmin(userId, groupId): Member
requireSessionAccess(userId, sessionId): SessionWithMember
requireHostOrAdmin(userId, sessionId): SessionWithMember
requirePollAccess(userId, pollId): PollWithSessionAndMember
requirePollManager(userId, pollId): PollWithSessionAndMember
assertSessionMutable(session)
assertPollDraft(poll)
assertPollActiveAndOpen(poll)
```

Never trust frontend role checks.

## 6. API Endpoints

## 6.1 Auth and user APIs

### GET `/api/v1/me`

Returns the authenticated user profile.

Auth: required.

Response:

```json
{
  "data": {
    "user_id": 1,
    "email": "sai@example.com",
    "firstname": "Sai",
    "lastname": "Krishnan",
    "profile_photo": "https://...",
    "timezone": "America/Phoenix",
    "joined_at": "2026-06-09T20:00:00.000Z",
    "updated_at": "2026-06-09T20:00:00.000Z"
  }
}
```

Notes:

- Never return OAuth access tokens or refresh tokens.

### PATCH `/api/v1/me`

Updates the authenticated user's profile fields allowed by MVP.

Auth: required.

Request:

```json
{
  "firstname": "Sai",
  "lastname": "Krishnan",
  "timezone": "America/Phoenix"
}
```

Validation:

- `firstname`: optional, max 60.
- `lastname`: optional, max 60.
- `timezone`: optional, valid IANA timezone.

Response:

```json
{
  "data": {
    "user_id": 1,
    "email": "sai@example.com",
    "firstname": "Sai",
    "lastname": "Krishnan",
    "profile_photo": "https://...",
    "timezone": "America/Phoenix"
  }
}
```

### GET `/api/v1/me/oauth/google/status`

Returns whether the user has Google Calendar permission.

Auth: required.

Response:

```json
{
  "data": {
    "provider": "google",
    "connected": true,
    "calendar_events_scope_granted": true,
    "access_token_expires_at": "2026-06-09T21:00:00.000Z"
  }
}
```

Do not return token values.

## 6.2 Group APIs

### POST `/api/v1/groups`

Creates a private group.

Auth: required.

Request:

```json
{
  "name": "TechUp Programmers",
  "description": "Private developer community sessions",
  "invite_enabled": true,
  "invite_max_uses": 50,
  "invite_code_expires_at": "2026-07-09T00:00:00.000Z"
}
```

Validation:

- `name` required, 1-60 chars.
- `description` optional, max 500 chars.
- `invite_max_uses` integer, min 1, max 10000.
- `invite_code_expires_at` optional UTC timestamp in the future.

Backend behavior:

1. Require auth.
2. Generate unique invite code if invite enabled.
3. Insert group with `created_by = current_user.user_id`.
4. Insert member row for creator with `is_admin = true`.
5. Return group.

Transaction: yes.

Response:

```json
{
  "data": {
    "group_id": 1,
    "name": "TechUp Programmers",
    "description": "Private developer community sessions",
    "invite_code": "TECHUP7H2K",
    "invite_enabled": true,
    "invite_max_uses": 50,
    "invite_used_count": 0,
    "default_meeting_owner": null,
    "created_by": 1,
    "created_at": "2026-06-09T20:00:00.000Z"
  }
}
```

### GET `/api/v1/groups`

Lists groups where the current user is a member.

Auth: required.

Response:

```json
{
  "data": [
    {
      "group_id": 1,
      "name": "TechUp Programmers",
      "description": "Private developer community sessions",
      "is_admin": true,
      "member_count": 42,
      "default_meeting_owner": 1,
      "created_at": "2026-06-09T20:00:00.000Z"
    }
  ]
}
```

### GET `/api/v1/groups/:groupId`

Returns group details.

Auth: group member.

Response:

```json
{
  "data": {
    "group_id": 1,
    "name": "TechUp Programmers",
    "description": "Private developer community sessions",
    "invite_enabled": true,
    "invite_max_uses": 50,
    "invite_used_count": 12,
    "invite_code_expires_at": "2026-07-09T00:00:00.000Z",
    "default_meeting_owner": {
      "user_id": 1,
      "email": "admin@example.com",
      "firstname": "Admin",
      "lastname": "User",
      "calendar_connected": true
    },
    "current_user_membership": {
      "is_admin": true,
      "joined_at": "2026-06-09T20:00:00.000Z"
    }
  }
}
```

Regular members may see basic group details. If you want to hide invite code from regular members, return `invite_code` only for admins.

### PATCH `/api/v1/groups/:groupId`

Updates group details.

Auth: group admin.

Request:

```json
{
  "name": "TechUp Programmers",
  "description": "Developer sessions and interview prep"
}
```

Validation:

- `name`: optional, 1-60 chars.
- `description`: optional, max 500 chars.

Response:

```json
{
  "data": {
    "group_id": 1,
    "name": "TechUp Programmers",
    "description": "Developer sessions and interview prep",
    "updated_at": "2026-06-09T20:30:00.000Z"
  }
}
```

### POST `/api/v1/groups/join`

Joins a group using an invite code.

Auth: required.

Request:

```json
{
  "invite_code": "TECHUP7H2K"
}
```

Validation:

- Invite code required.
- Trim whitespace.
- Normalize to uppercase if invite code generation uses uppercase.

Backend behavior:

1. Require auth.
2. Find group by invite code.
3. Reject if missing.
4. Reject if `invite_enabled = false`.
5. Reject if expired.
6. Reject if used count >= max uses.
7. Reject if user already member.
8. Insert member.
9. Increment invite usage count.
10. Return group membership.

Transaction: yes.

Use row lock or atomic update to avoid exceeding max uses.

Response:

```json
{
  "data": {
    "group_id": 1,
    "name": "TechUp Programmers",
    "joined_at": "2026-06-09T20:30:00.000Z",
    "is_admin": false
  }
}
```

Errors:

- `INVALID_INVITE_CODE`
- `INVITE_DISABLED`
- `INVITE_EXPIRED`
- `INVITE_MAX_USES_REACHED`
- `ALREADY_MEMBER`

### GET `/api/v1/groups/:groupId/members`

Lists members of a group.

Auth: group member.

Query params:

```text
limit=50
offset=0
role=admin|member|all
```

Response:

```json
{
  "data": [
    {
      "user_id": 1,
      "email": "admin@example.com",
      "firstname": "Admin",
      "lastname": "User",
      "profile_photo": "https://...",
      "joined_at": "2026-06-09T20:00:00.000Z",
      "is_admin": true,
      "calendar_connected": true
    }
  ],
  "page": {
    "limit": 50,
    "offset": 0,
    "total": 42
  }
}
```

### PATCH `/api/v1/groups/:groupId/members/:userId`

Updates member role.

Auth: group admin.

Request:

```json
{
  "is_admin": true
}
```

Validation:

- Cannot remove admin from the last remaining admin.
- Target user must be member.

Backend behavior:

1. Require group admin.
2. Update `members.is_admin`.
3. Write audit log `member_role_updated`.

Response:

```json
{
  "data": {
    "group_id": 1,
    "user_id": 2,
    "is_admin": true
  }
}
```

### DELETE `/api/v1/groups/:groupId/members/:userId`

Removes a member.

Auth: group admin.

Rules:

- Target user must be member.
- Cannot remove last admin.
- Removing member prevents future access to group sessions, polls, votes, and details.
- Existing historical votes may remain for audit/history unless hard-delete is explicitly desired.

Backend behavior:

1. Require group admin.
2. Delete member row.
3. Write audit log `member_removed`.

Response:

```json
{
  "data": {
    "success": true
  }
}
```

### PATCH `/api/v1/groups/:groupId/invite`

Updates invite settings.

Auth: group admin.

Request:

```json
{
  "invite_enabled": true,
  "invite_max_uses": 100,
  "invite_code_expires_at": "2026-08-01T00:00:00.000Z",
  "regenerate_invite_code": false
}
```

Validation:

- `invite_max_uses >= invite_used_count`.
- Expiration optional; if provided, should be future timestamp.

Response:

```json
{
  "data": {
    "invite_code": "TECHUP7H2K",
    "invite_enabled": true,
    "invite_max_uses": 100,
    "invite_used_count": 12,
    "invite_code_expires_at": "2026-08-01T00:00:00.000Z"
  }
}
```

### PATCH `/api/v1/groups/:groupId/meeting-owner`

Sets the group's default meeting owner.

Auth: group admin.

Request:

```json
{
  "default_meeting_owner": 1
}
```

Validation:

- User must be a group member.
- Recommended for MVP: user must be group admin.
- User must have Google OAuth account connected.
- User should have Calendar event scope.

Backend behavior:

1. Require group admin.
2. Validate target meeting owner membership.
3. Validate OAuth account status.
4. Update `groups.default_meeting_owner`.
5. Return group.

Response:

```json
{
  "data": {
    "group_id": 1,
    "default_meeting_owner": {
      "user_id": 1,
      "email": "admin@example.com",
      "calendar_connected": true,
      "calendar_events_scope_granted": true
    }
  }
}
```

## 6.3 Session APIs

### POST `/api/v1/groups/:groupId/sessions`

Creates a session inside a group.

Auth: group member.

Request:

```json
{
  "topic": "System Design: Monitoring and Logging",
  "description": "Community session on metrics, logs, alerts, and dashboards.",
  "calendar_invite_policy": "interested_members"
}
```

Validation:

- `topic`: optional, max 100.
- `description`: optional, max 1000.
- `calendar_invite_policy`: one of `all_members`, `interested_members`, `app_only`.

Backend behavior:

1. Require current user is group member.
2. Insert session:
   - `host = current_user.user_id`
   - `group_id = groupId`
   - `status = 'draft'`
   - `calendar_invite_policy = request policy or 'app_only'`
3. Write audit log `session_created`.

Transaction: yes.

Response:

```json
{
  "data": {
    "session_id": 100,
    "group_id": 1,
    "host": {
      "user_id": 1,
      "firstname": "Sai",
      "lastname": "Krishnan",
      "email": "sai@example.com"
    },
    "topic": "System Design: Monitoring and Logging",
    "description": "Community session on metrics, logs, alerts, and dashboards.",
    "calendar_invite_policy": "interested_members",
    "status": "draft",
    "created_at": "2026-06-09T20:00:00.000Z"
  }
}
```

### GET `/api/v1/groups/:groupId/sessions`

Lists sessions in a group.

Auth: group member.

Query params:

```text
status=draft|polling|scheduled|cancelled|needs_host_decision|all
mine=true|false
upcoming=true|false
limit=20
offset=0
```

Response:

```json
{
  "data": [
    {
      "session_id": 100,
      "topic": "System Design: Monitoring and Logging",
      "description": "Community session on metrics, logs, alerts, and dashboards.",
      "status": "scheduled",
      "calendar_invite_policy": "interested_members",
      "scheduled_start_time": "2026-06-15T02:00:00.000Z",
      "scheduled_end_time": "2026-06-15T03:00:00.000Z",
      "meet_link": "https://meet.google.com/abc-defg-hij",
      "host": {
        "user_id": 1,
        "firstname": "Sai",
        "lastname": "Krishnan"
      },
      "current_user_can_manage": true,
      "created_at": "2026-06-09T20:00:00.000Z"
    }
  ],
  "page": {
    "limit": 20,
    "offset": 0,
    "total": 1
  }
}
```

### GET `/api/v1/sessions/:sessionId`

Returns session detail.

Auth: group member.

Response:

```json
{
  "data": {
    "session_id": 100,
    "group_id": 1,
    "topic": "System Design: Monitoring and Logging",
    "description": "Community session on metrics, logs, alerts, and dashboards.",
    "status": "needs_host_decision",
    "calendar_invite_policy": "interested_members",
    "scheduled_start_time": null,
    "scheduled_end_time": null,
    "meet_link": null,
    "calendar_event_id": null,
    "google_calendar_id": "primary",
    "selected_option_id": null,
    "scheduling_error": null,
    "scheduling_attempt_count": 0,
    "last_scheduling_attempt_at": null,
    "host": {
      "user_id": 1,
      "email": "sai@example.com",
      "firstname": "Sai",
      "lastname": "Krishnan"
    },
    "meeting_owner": null,
    "current_user_can_manage": true,
    "polls": [
      {
        "poll_id": 200,
        "type": "final_timing",
        "status": "closed",
        "deadline": "2026-06-10T00:00:00.000Z"
      }
    ]
  }
}
```

### PATCH `/api/v1/sessions/:sessionId`

Updates mutable session fields.

Auth: session host or group admin.

Allowed statuses:

- `draft`
- `interest_check`
- `topic_selection`
- `availability_collection`
- `polling`
- `needs_host_decision`
- `scheduling_failed`

Rejected statuses:

- `scheduling`
- `scheduled`, except limited description/policy updates if desired.
- `cancelled`
- `completed`

Request:

```json
{
  "topic": "System Design: Metrics, Logs, and Alerts",
  "description": "Updated description",
  "calendar_invite_policy": "all_members"
}
```

Validation:

- `topic`: optional, max 100.
- `description`: optional, max 1000.
- `calendar_invite_policy`: optional enum.
- Do not allow invite policy changes while `status = scheduling`.

Response:

```json
{
  "data": {
    "session_id": 100,
    "topic": "System Design: Metrics, Logs, and Alerts",
    "description": "Updated description",
    "calendar_invite_policy": "all_members",
    "status": "draft",
    "updated_at": "2026-06-09T20:15:00.000Z"
  }
}
```

### POST `/api/v1/sessions/:sessionId/cancel`

Cancels a session.

Auth: session host or group admin.

Request:

```json
{
  "reason": "Host unavailable"
}
```

Allowed source statuses:

- `draft`
- `interest_check`
- `topic_selection`
- `availability_collection`
- `polling`
- `needs_host_decision`
- `scheduling_failed`
- `rescheduling`
- `scheduled`

Rejected source statuses:

- `cancelled`
- `completed`
- `scheduling`, unless you intentionally support cancellation during scheduling with careful locking.

Backend behavior:

1. Require host/admin.
2. Update session to `cancelled`.
3. Cancel active polls or leave them visible but non-voteable. Recommended: set active/draft polls to `cancelled`.
4. If `calendar_event_id` exists, best-effort cancel/update Google Calendar event.
5. Write audit logs:
   - `session_cancelled`
   - `calendar_event_cancelled` on success
   - `scheduling_failed` or metadata on Calendar cancel failure if needed.

Do not block DB cancellation solely because Google Calendar cancellation failed.

Response:

```json
{
  "data": {
    "session_id": 100,
    "status": "cancelled"
  }
}
```

### POST `/api/v1/sessions/:sessionId/complete`

Marks a scheduled session as completed.

Auth: session host or group admin.

Allowed source status:

- `scheduled`

Request:

```json
{}
```

Response:

```json
{
  "data": {
    "session_id": 100,
    "status": "completed"
  }
}
```

### POST `/api/v1/sessions/:sessionId/reschedule`

Starts rescheduling flow.

Auth: session host or group admin.

Allowed source statuses:

- `scheduled`
- `scheduling_failed`

Request:

```json
{
  "reason": "Need a new time"
}
```

Backend behavior:

1. Require host/admin.
2. Set session status to `rescheduling`.
3. Keep existing `calendar_event_id`.
4. Write audit log `session_rescheduled`.

Response:

```json
{
  "data": {
    "session_id": 100,
    "status": "rescheduling",
    "calendar_event_id": "abc123"
  }
}
```

## 6.4 Poll APIs

### POST `/api/v1/sessions/:sessionId/polls`

Creates a draft poll.

Auth: session host or group admin.

Request:

```json
{
  "type": "final_timing",
  "multi_choice": false,
  "deadline": "2026-06-12T03:00:00.000Z"
}
```

Validation:

- `type`: required enum: `interest`, `topic`, `availability`, `final_timing`.
- `multi_choice`: optional boolean.
- `deadline`: optional for draft, required before publishing.
- Deadline must be in the future when poll is published.
- Session must not be `cancelled` or `completed`.

Backend behavior:

1. Require host/admin.
2. Insert poll with `status = 'draft'`.
3. Optionally update session status based on poll type:
   - `interest` -> `interest_check`
   - `topic` -> `topic_selection`
   - `availability` -> `availability_collection`
   - `final_timing` -> `polling`
4. Write audit log `poll_created`.

Response:

```json
{
  "data": {
    "poll_id": 200,
    "session_id": 100,
    "type": "final_timing",
    "status": "draft",
    "multi_choice": false,
    "deadline": "2026-06-12T03:00:00.000Z",
    "created_by": 1,
    "created_at": "2026-06-09T20:00:00.000Z"
  }
}
```

### GET `/api/v1/sessions/:sessionId/polls`

Lists polls for a session.

Auth: group member.

Response:

```json
{
  "data": [
    {
      "poll_id": 200,
      "type": "final_timing",
      "status": "active",
      "multi_choice": false,
      "deadline": "2026-06-12T03:00:00.000Z",
      "published_at": "2026-06-09T20:30:00.000Z",
      "closed_at": null,
      "current_user_votes": [301],
      "options": [
        {
          "option_id": 301,
          "label": "Sunday 8 PM EST",
          "start_at": "2026-06-15T00:00:00.000Z",
          "end_at": "2026-06-15T01:00:00.000Z",
          "vote_count": null
        }
      ]
    }
  ]
}
```

Result visibility rule:

- For active interest/topic/availability polls, MVP may hide aggregated vote counts until closed.
- For active final timing polls, prefer hiding results until closed to reduce vote bias.
- Always show the current user's own selected options.

### GET `/api/v1/polls/:pollId`

Returns poll detail.

Auth: group member.

Response:

```json
{
  "data": {
    "poll_id": 200,
    "session_id": 100,
    "type": "final_timing",
    "status": "active",
    "multi_choice": false,
    "deadline": "2026-06-12T03:00:00.000Z",
    "created_by": 1,
    "published_at": "2026-06-09T20:30:00.000Z",
    "closed_at": null,
    "current_user_votes": [301],
    "results_visible": false,
    "options": [
      {
        "option_id": 301,
        "label": "Sunday 8 PM EST",
        "start_at": "2026-06-15T00:00:00.000Z",
        "end_at": "2026-06-15T01:00:00.000Z",
        "vote_count": null
      }
    ],
    "suggestions": [
      {
        "suggestion_id": 501,
        "suggestion": "Saturday evening",
        "suggested_by": {
          "user_id": 5,
          "firstname": "Anuj"
        },
        "created_at": "2026-06-09T20:45:00.000Z"
      }
    ],
    "current_user_can_manage": true
  }
}
```

### PATCH `/api/v1/polls/:pollId`

Updates a draft poll.

Auth: session host or group admin.

Allowed parent poll status:

- `draft`

Request:

```json
{
  "deadline": "2026-06-12T03:00:00.000Z",
  "multi_choice": false
}
```

Validation:

- Deadline should be future timestamp when set.
- `type` should not be changed after creation. If needed, cancel and recreate.

Response:

```json
{
  "data": {
    "poll_id": 200,
    "deadline": "2026-06-12T03:00:00.000Z",
    "multi_choice": false,
    "status": "draft",
    "updated_at": "2026-06-09T20:10:00.000Z"
  }
}
```

### POST `/api/v1/polls/:pollId/publish`

Publishes a draft poll.

Auth: session host or group admin.

Request:

```json
{}
```

Validation:

- Poll status must be `draft`.
- Poll must have at least one official option.
- Deadline must exist and be in the future.
- For `availability` and `final_timing`, all options require valid `start_at` and `end_at`.
- Parent session must not be `cancelled` or `completed`.

Backend behavior:

1. Require poll manager.
2. Load poll + session + options.
3. Validate.
4. Update poll:
   - `status = 'active'`
   - `published_at = now`
5. Update session status based on poll type:
   - `interest` -> `interest_check`
   - `topic` -> `topic_selection`
   - `availability` -> `availability_collection`
   - `final_timing` -> `polling`
6. Write audit log `poll_published`.

Transaction: yes.

Response:

```json
{
  "data": {
    "poll_id": 200,
    "status": "active",
    "published_at": "2026-06-09T20:30:00.000Z"
  }
}
```

### POST `/api/v1/polls/:pollId/close`

Manually closes a poll.

Auth: session host or group admin.

Request:

```json
{}
```

Allowed source status:

- `active`

Backend behavior:

1. Require poll manager.
2. Atomic update poll from `active` to `closed`.
3. Set `closed_at = now`.
4. Write audit log `poll_closed`.
5. If poll type is `final_timing`, call scheduling service.
6. Return poll and scheduling result.

Response for non-final poll:

```json
{
  "data": {
    "poll_id": 200,
    "status": "closed",
    "closed_at": "2026-06-12T03:00:00.000Z",
    "scheduling_triggered": false
  }
}
```

Response for final timing poll with clear winner:

```json
{
  "data": {
    "poll_id": 200,
    "status": "closed",
    "closed_at": "2026-06-12T03:00:00.000Z",
    "scheduling_triggered": true,
    "session": {
      "session_id": 100,
      "status": "scheduled",
      "selected_option_id": 301,
      "scheduled_start_time": "2026-06-15T00:00:00.000Z",
      "scheduled_end_time": "2026-06-15T01:00:00.000Z",
      "meet_link": "https://meet.google.com/abc-defg-hij"
    }
  }
}
```

Response for tie/no-vote:

```json
{
  "data": {
    "poll_id": 200,
    "status": "closed",
    "scheduling_triggered": true,
    "session": {
      "session_id": 100,
      "status": "needs_host_decision",
      "reason": "tie",
      "tied_option_ids": [301, 302]
    }
  }
}
```

### POST `/api/v1/polls/:pollId/cancel`

Cancels a poll.

Auth: session host or group admin.

Allowed source statuses:

- `draft`
- `active`

Request:

```json
{
  "reason": "Need to rebuild options"
}
```

Response:

```json
{
  "data": {
    "poll_id": 200,
    "status": "cancelled"
  }
}
```

### POST `/api/v1/polls/:pollId/supersede`

Marks a poll as superseded.

Auth: session host or group admin.

Allowed source statuses:

- `active`
- `closed`

Request:

```json
{
  "reason": "Replaced by a newer poll"
}
```

Rules:

- Superseded final timing polls are ignored by scheduling.
- Historical votes remain.

Response:

```json
{
  "data": {
    "poll_id": 200,
    "status": "superseded"
  }
}
```

## 6.5 Poll option APIs

### POST `/api/v1/polls/:pollId/options`

Adds an official voteable option to a draft poll.

Auth: session host or group admin.

Request for topic/interest poll:

```json
{
  "label": "Monitoring and Logging"
}
```

Request for availability/final timing poll:

```json
{
  "label": "Sunday 8 PM EST",
  "start_at": "2026-06-15T00:00:00.000Z",
  "end_at": "2026-06-15T01:00:00.000Z"
}
```

Validation:

- Parent poll status must be `draft`.
- `label` required, max 255.
- For `availability` and `final_timing`, `start_at` and `end_at` required.
- `end_at > start_at`.
- For `interest` and `topic`, ignore or reject `start_at`/`end_at`; recommended: allow null only.

Backend behavior:

1. Require poll manager.
2. Validate draft status.
3. Insert option.
4. Write audit log `poll_option_created`.

Response:

```json
{
  "data": {
    "option_id": 301,
    "poll_id": 200,
    "label": "Sunday 8 PM EST",
    "start_at": "2026-06-15T00:00:00.000Z",
    "end_at": "2026-06-15T01:00:00.000Z",
    "created_at": "2026-06-09T20:20:00.000Z"
  }
}
```

### PATCH `/api/v1/poll-options/:optionId`

Updates an official option.

Auth: session host or group admin.

Allowed parent poll status:

- `draft`

Request:

```json
{
  "label": "Sunday 8:30 PM EST",
  "start_at": "2026-06-15T00:30:00.000Z",
  "end_at": "2026-06-15T01:30:00.000Z"
}
```

Backend behavior:

1. Require option manager through parent poll/session.
2. Validate poll is draft.
3. Update option.
4. Write audit log `poll_option_updated`.

Response:

```json
{
  "data": {
    "option_id": 301,
    "label": "Sunday 8:30 PM EST",
    "start_at": "2026-06-15T00:30:00.000Z",
    "end_at": "2026-06-15T01:30:00.000Z",
    "updated_at": "2026-06-09T20:25:00.000Z"
  }
}
```

### DELETE `/api/v1/poll-options/:optionId`

Deletes an official option.

Auth: session host or group admin.

Allowed parent poll status:

- `draft`

Rules:

- If the poll is active/closed, reject deletion.
- Since votes cannot exist on draft polls, deleting draft options is safe.

Response:

```json
{
  "data": {
    "success": true
  }
}
```

## 6.6 Suggestion APIs

### POST `/api/v1/polls/:pollId/suggestions`

Creates a member suggestion under a poll.

Auth: group member.

Request:

```json
{
  "suggestion": "System design for cron jobs"
}
```

Validation:

- User must be a group member.
- Poll must belong to a session in the user's group.
- `suggestion` required, max 255.
- Parent poll status can be `draft` or `active`. Recommended MVP: allow suggestions only while draft or active, reject closed/cancelled/superseded.

Backend behavior:

1. Require poll access.
2. Insert suggestion.
3. Write audit log `topic_suggested`.

Response:

```json
{
  "data": {
    "suggestion_id": 501,
    "poll_id": 200,
    "suggestion": "System design for cron jobs",
    "suggested_by": 5,
    "created_at": "2026-06-09T20:45:00.000Z"
  }
}
```

### GET `/api/v1/polls/:pollId/suggestions`

Lists suggestions for a poll.

Auth: group member.

Response:

```json
{
  "data": [
    {
      "suggestion_id": 501,
      "suggestion": "System design for cron jobs",
      "suggested_by": {
        "user_id": 5,
        "firstname": "Anuj",
        "lastname": "Kapoor"
      },
      "created_at": "2026-06-09T20:45:00.000Z"
    }
  ]
}
```

### POST `/api/v1/suggestions/:suggestionId/convert-to-option`

Creates an official poll option from a suggestion.

Auth: session host or group admin.

Request:

```json
{
  "label": "System design for cron jobs",
  "start_at": null,
  "end_at": null
}
```

Validation:

- Parent poll must be `draft`.
- Suggestion belongs to parent poll.
- For availability/final timing polls, start/end are required even if suggestion text came from a user.
- Do not delete the suggestion. Keep it for history.

Backend behavior:

1. Require manager.
2. Validate parent poll draft.
3. Insert `poll_options` row.
4. Write audit log `poll_option_created` with metadata `{ "source_suggestion_id": 501 }`.

Response:

```json
{
  "data": {
    "option_id": 302,
    "poll_id": 200,
    "label": "System design for cron jobs"
  }
}
```

## 6.7 Voting APIs

### PUT `/api/v1/polls/:pollId/vote`

Replaces the current user's vote selection for a poll.

This is the recommended single endpoint for both single-choice and multi-choice polls because it makes client state simple and idempotent.

Auth: group member.

Request for single-choice poll:

```json
{
  "option_ids": [301]
}
```

Request for multi-choice poll:

```json
{
  "option_ids": [301, 302, 303]
}
```

Validation:

- Poll status must be `active`.
- Current time must be <= `deadline`.
- Parent session must not be `cancelled` or `completed`.
- User must be a group member.
- All option IDs must belong to the poll.
- If `multi_choice = false`, exactly one `option_id` required.
- If `multi_choice = true`, at least one `option_id` required.
- De-duplicate incoming option IDs.

Backend behavior:

1. Require poll access.
2. Load poll, session, options.
3. Validate status/deadline/options.
4. In a transaction:
   - Load previous votes for `(poll_id, user_id)`.
   - Delete votes not in requested `option_ids`.
   - Insert missing votes.
   - Leave existing matching votes unchanged.
5. Write audit log:
   - `vote_submitted` if no previous vote.
   - `vote_changed` if selection changed.

Response:

```json
{
  "data": {
    "poll_id": 200,
    "user_id": 5,
    "option_ids": [301],
    "updated_at": "2026-06-09T21:00:00.000Z"
  }
}
```

### DELETE `/api/v1/polls/:pollId/vote`

Clears the current user's votes for a poll.

Auth: group member.

Validation:

- Poll must be active.
- Deadline must not have passed.
- User must have access.

Response:

```json
{
  "data": {
    "poll_id": 200,
    "user_id": 5,
    "option_ids": []
  }
}
```

### GET `/api/v1/polls/:pollId/results`

Returns poll results.

Auth: group member.

Visibility:

- If poll is `closed`, show counts.
- If current user is host/admin, show counts even while active if you choose. Recommended MVP: host/admin can see active counts.
- Regular members should not see aggregate counts until closed.

Response:

```json
{
  "data": {
    "poll_id": 200,
    "type": "final_timing",
    "status": "closed",
    "results_visible": true,
    "total_voters": 12,
    "options": [
      {
        "option_id": 301,
        "label": "Sunday 8 PM EST",
        "start_at": "2026-06-15T00:00:00.000Z",
        "end_at": "2026-06-15T01:00:00.000Z",
        "vote_count": 7
      },
      {
        "option_id": 302,
        "label": "Monday 8 PM EST",
        "start_at": "2026-06-16T00:00:00.000Z",
        "end_at": "2026-06-16T01:00:00.000Z",
        "vote_count": 5
      }
    ],
    "current_user_votes": [301]
  }
}
```

## 6.8 Scheduling APIs

### POST `/api/v1/sessions/:sessionId/manual-schedule`

Allows host/admin to manually choose a final time.

Used for tie/no-vote cases or direct scheduling.

Auth: session host or group admin.

Request using an existing final timing option:

```json
{
  "selected_option_id": 301
}
```

Alternative request using explicit time:

```json
{
  "start_at": "2026-06-15T00:00:00.000Z",
  "end_at": "2026-06-15T01:00:00.000Z",
  "label": "Sunday 8 PM EST"
}
```

Validation:

- Session status must be one of:
  - `needs_host_decision`
  - `draft`
  - `polling`
  - `rescheduling`
  - `scheduling_failed`
- If `selected_option_id` is provided:
  - Option must belong to a `final_timing` poll for this session.
  - Option must have valid start/end.
- If explicit time is provided:
  - `start_at` and `end_at` required.
  - `end_at > start_at`.
- Session must not be `cancelled` or `completed`.

Backend behavior:

1. Require host/admin.
2. Resolve selected time.
3. Call centralized scheduling service with source `manual`.
4. Scheduling service applies meeting owner selection, attendee selection, Google Calendar create/update, Meet link extraction, and DB update.

Response success:

```json
{
  "data": {
    "session_id": 100,
    "status": "scheduled",
    "selected_option_id": 301,
    "scheduled_start_time": "2026-06-15T00:00:00.000Z",
    "scheduled_end_time": "2026-06-15T01:00:00.000Z",
    "meeting_owner": 1,
    "calendar_event_id": "google-event-id",
    "meet_link": "https://meet.google.com/abc-defg-hij"
  }
}
```

Response tie/no-vote cannot happen here because host selected time.

### POST `/api/v1/sessions/:sessionId/retry-scheduling`

Retries a failed scheduling operation.

Auth: session host or group admin.

Allowed source status:

- `scheduling_failed`

Request:

```json
{}
```

Backend behavior:

1. Require host/admin.
2. Use previous selected option or scheduled time fields.
3. Re-select meeting owner using current group config unless `sessions.meeting_owner` is already stored and should be reused.
4. If `calendar_event_id` exists, update existing event.
5. If not, create event.
6. Update session to scheduled or scheduling_failed.

Response success:

```json
{
  "data": {
    "session_id": 100,
    "status": "scheduled",
    "meet_link": "https://meet.google.com/abc-defg-hij"
  }
}
```

Response failure:

```json
{
  "error": {
    "code": "GOOGLE_TOKEN_REFRESH_FAILED",
    "message": "The selected meeting owner must reconnect Google Calendar.",
    "details": {
      "meeting_owner": 1,
      "scheduling_attempt_count": 2
    }
  }
}
```

## 6.9 Audit APIs

### GET `/api/v1/groups/:groupId/audit-logs`

Lists group audit logs.

Auth: group admin.

Query params:

```text
session_id=100
poll_id=200
action=scheduling_failed
limit=50
offset=0
```

Response:

```json
{
  "data": [
    {
      "audit_log_id": 900,
      "user_id": 1,
      "group_id": 1,
      "session_id": 100,
      "poll_id": 200,
      "action": "scheduling_failed",
      "metadata": {
        "reason": "GOOGLE_TOKEN_REFRESH_FAILED",
        "meeting_owner": 1
      },
      "created_at": "2026-06-09T21:30:00.000Z"
    }
  ],
  "page": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

### GET `/api/v1/sessions/:sessionId/audit-logs`

Lists audit logs for a session.

Auth: group admin.

Response:

```json
{
  "data": [
    {
      "audit_log_id": 901,
      "action": "poll_published",
      "user_id": 1,
      "poll_id": 200,
      "metadata": {
        "poll_type": "final_timing"
      },
      "created_at": "2026-06-09T20:30:00.000Z"
    }
  ]
}
```

## 6.10 Background job APIs

### POST `/api/v1/jobs/close-expired-polls`

Closes expired polls.

Auth: job secret, not user session.

Headers:

```text
Authorization: Bearer <CRON_SECRET>
```

Request:

```json
{
  "limit": 50
}
```

Validation:

- `limit`: optional, default 50, max 500.

Backend behavior:

1. Verify cron secret.
2. Find active polls where `deadline <= now`.
3. Process in small batches.
4. For each poll:
   - Attempt atomic update from `active` to `closed`.
   - If update affects zero rows, skip.
   - Write `poll_closed`.
   - If poll type is `final_timing`, call scheduling service.
   - If session is cancelled/completed/scheduled/scheduling, skip scheduling as appropriate.
5. Return processed counts.

Response:

```json
{
  "data": {
    "processed": 10,
    "closed": 8,
    "skipped": 2,
    "final_timing_processed": 3,
    "scheduled": 1,
    "needs_host_decision": 1,
    "scheduling_failed": 1
  }
}
```

## 7. Scheduling Service Low-Level Design

Implement scheduling once and call it from:

- Manual poll close endpoint.
- Cron close-expired-polls job.
- Manual schedule endpoint.
- Retry scheduling endpoint.
- Rescheduling final timing close.

### 7.1 Function signature

```ts
type SchedulingSource =
  | "final_timing_poll_closed"
  | "manual_host_selection"
  | "retry"
  | "reschedule";

type ScheduleSessionInput = {
  sessionId: number;
  source: SchedulingSource;
  pollId?: number;
  selectedOptionId?: number;
  explicitStartAt?: Date;
  explicitEndAt?: Date;
  explicitLabel?: string;
  actorUserId?: number | null;
};

type ScheduleSessionResult =
  | {
      outcome: "scheduled";
      sessionId: number;
      selectedOptionId: number | null;
      scheduledStartTime: Date;
      scheduledEndTime: Date;
      meetingOwner: number;
      calendarEventId: string;
      meetLink: string;
    }
  | {
      outcome: "needs_host_decision";
      reason: "tie" | "no_votes";
      tiedOptionIds?: number[];
    }
  | {
      outcome: "skipped";
      reason: "already_scheduling" | "already_scheduled" | "invalid_session_status";
    }
  | {
      outcome: "failed";
      code: string;
      message: string;
    };
```

### 7.2 Final timing winner calculation

For a closed `final_timing` poll:

SQL-style aggregation:

```sql
SELECT
  po.option_id,
  po.start_at,
  po.end_at,
  COUNT(pv.poll_vote_id) AS vote_count
FROM poll_options po
LEFT JOIN poll_votes pv ON pv.option_id = po.option_id
WHERE po.poll_id = $1
GROUP BY po.option_id
ORDER BY vote_count DESC, po.option_id ASC;
```

Algorithm:

1. Load all options.
2. If no options, fail with validation/state error.
3. Count votes for each option.
4. Let `maxVotes = highest vote_count`.
5. If `maxVotes = 0`, update session to `needs_host_decision`, metadata reason `no_votes`.
6. Let `winners = options where vote_count = maxVotes`.
7. If `winners.length > 1`, update session to `needs_host_decision`, metadata reason `tie`, metadata tied option IDs.
8. If one winner, schedule with winner's `start_at` and `end_at`.

Tie/no-vote update:

```sql
UPDATE sessions
SET
  status = 'needs_host_decision',
  updated_at = now()
WHERE session_id = $1
  AND status IN ('polling', 'rescheduling');
```

### 7.3 Atomic scheduling ownership guard

Before calling Google Calendar, claim scheduling ownership.

```sql
UPDATE sessions
SET
  status = 'scheduling',
  meeting_owner = $selectedMeetingOwner,
  selected_option_id = $selectedOptionId,
  scheduled_start_time = $startAt,
  scheduled_end_time = $endAt,
  scheduling_attempt_count = scheduling_attempt_count + 1,
  last_scheduling_attempt_at = now(),
  scheduling_error = null,
  updated_at = now()
WHERE session_id = $sessionId
  AND status IN ('draft', 'polling', 'needs_host_decision', 'rescheduling', 'scheduling_failed')
  AND (
    calendar_event_id IS NULL
    OR status IN ('rescheduling', 'scheduling_failed')
  );
```

If zero rows affected, return skipped. Another request/job may already own scheduling.

Do not hold a DB transaction while calling Google Calendar.

### 7.4 Meeting owner selection

Function:

```ts
async function selectMeetingOwner(sessionId: number): Promise<number>
```

Logic:

1. Load session + group.
2. If `groups.default_meeting_owner` is set:
   - Use that user ID.
3. Else:
   - Use `sessions.host`.
4. Validate selected user is group member.
5. Load `oauth_accounts` for selected user where provider = `google`.
6. Validate account exists.
7. Validate scope contains Calendar event permission.
8. Refresh access token if expired.
9. Return meeting owner user ID and valid access token.

Failure cases:

- No OAuth account: `GOOGLE_TOKEN_MISSING`.
- Missing Calendar scope: `NO_VALID_MEETING_OWNER`.
- Refresh failed: `GOOGLE_TOKEN_REFRESH_FAILED`.

### 7.5 Attendee selection

Function:

```ts
async function selectCalendarAttendees(sessionId: number): Promise<string[]>
```

Policy logic:

If `calendar_invite_policy = 'app_only'`:

```ts
return [];
```

If `calendar_invite_policy = 'all_members'`:

```sql
SELECT u.email
FROM members m
JOIN users u ON u.user_id = m.user_id
WHERE m.group_id = $groupId;
```

If `calendar_invite_policy = 'interested_members'`:

Recommended MVP approach:

1. Find latest non-cancelled interest poll for the session.
2. Find options whose label is semantically one of:
   - `Interested`
   - `Attending`
   - `Yes`
3. Load users who voted for those options.
4. Return their emails.

For lower ambiguity, seed interest polls with normalized options:

- `interested`
- `not_interested`
- `maybe`

If using free-text labels only, create a helper:

```ts
function isInterestedOption(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return ["interested", "attending", "yes", "yes, interested", "i can attend"].includes(normalized);
}
```

SQL sketch:

```sql
SELECT DISTINCT u.email
FROM polls p
JOIN poll_options po ON po.poll_id = p.poll_id
JOIN poll_votes pv ON pv.option_id = po.option_id
JOIN users u ON u.user_id = pv.user_id
WHERE p.session_id = $sessionId
  AND p.type = 'interest'
  AND p.status IN ('active', 'closed')
  AND lower(po.label) IN ('interested', 'attending', 'yes', 'yes, interested', 'i can attend');
```

### 7.6 Google Calendar event create

Input:

```ts
type CreateCalendarEventInput = {
  accessToken: string;
  calendarId: string; // default 'primary'
  summary: string;
  description: string;
  startAt: Date;
  endAt: Date;
  attendeeEmails: string[];
};
```

Calendar event body:

```json
{
  "summary": "TechUp Session: System Design: Monitoring and Logging",
  "description": "Community session on metrics, logs, alerts, and dashboards.",
  "start": {
    "dateTime": "2026-06-15T00:00:00.000Z"
  },
  "end": {
    "dateTime": "2026-06-15T01:00:00.000Z"
  },
  "attendees": [
    {
      "email": "member@example.com"
    }
  ],
  "conferenceData": {
    "createRequest": {
      "requestId": "session-100-attempt-1"
    }
  }
}
```

When using Google Calendar API, include conference data version in request parameters.

Pseudo-call:

```text
POST https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all
```

For app-only policy with no attendees, `sendUpdates` may be omitted or set to `none`.

Extract Meet link from one of:

- `event.hangoutLink`
- `event.conferenceData.entryPoints[].uri` where `entryPointType = 'video'`

If no Meet link exists, mark scheduling failed.

### 7.7 Google Calendar event update for rescheduling

If `sessions.calendar_event_id` exists:

- Use update/patch event instead of create.
- Preserve or update attendees based on current policy.
- Preserve Meet link if Google Calendar keeps the conference.
- If Meet link missing after update, request conference data again if possible.

Pseudo-call:

```text
PATCH https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId}?conferenceDataVersion=1&sendUpdates=all
```

### 7.8 Scheduling success DB update

After Google Calendar succeeds:

```sql
UPDATE sessions
SET
  status = 'scheduled',
  meeting_owner = $meetingOwner,
  selected_option_id = $selectedOptionId,
  scheduled_start_time = $startAt,
  scheduled_end_time = $endAt,
  calendar_event_id = $calendarEventId,
  google_calendar_id = $calendarId,
  meet_link = $meetLink,
  scheduling_error = null,
  updated_at = now()
WHERE session_id = $sessionId
  AND status = 'scheduling';
```

Then write audit logs:

- `calendar_event_created` or `calendar_event_updated`
- `calendar_attendees_updated` if attendees were included/changed
- `session_scheduled`

### 7.9 Scheduling failure DB update

On failure:

```sql
UPDATE sessions
SET
  status = 'scheduling_failed',
  scheduling_error = $errorMessage,
  updated_at = now()
WHERE session_id = $sessionId
  AND status = 'scheduling';
```

Write audit log:

```text
scheduling_failed
```

Metadata example:

```json
{
  "code": "GOOGLE_TOKEN_REFRESH_FAILED",
  "message": "Refresh token expired or revoked.",
  "meeting_owner": 1,
  "source": "final_timing_poll_closed",
  "selected_option_id": 301,
  "calendar_invite_policy": "interested_members"
}
```

## 8. Transactions and Idempotency

### 8.1 Use transactions for these operations

Use DB transactions for:

- Group creation + creator membership.
- Invite join + invite usage count increment.
- Session creation + audit log.
- Poll creation + session status update + audit log.
- Poll option create/update/delete + audit log.
- Poll publish + session status update + audit log.
- Vote replacement + audit log.
- Poll close + audit log.
- Member removal + audit log.

Do not keep a transaction open while calling Google Calendar.

### 8.2 Idempotency rules

Duplicate vote clicks:

- Unique `(poll_id, option_id, user_id)` prevents duplicates.
- Vote endpoint replaces current selection.

Duplicate poll-closing job:

- Only process polls with `status = 'active'`.
- Atomic update active -> closed.
- If update returns zero rows, skip.

Duplicate scheduling:

- Claim session by atomic update to `scheduling`.
- If zero rows, skip.
- If `calendar_event_id` exists, update/reuse event.

Duplicate Calendar attendees:

- Build unique email list before sending.
- Use distinct query.
- De-duplicate case-insensitively.

Retry scheduling:

- If `calendar_event_id` exists, update existing event.
- If no event ID, create event.
- Never create a second event for a session that already has `calendar_event_id`.

## 9. State Machines

### 9.1 Session lifecycle

Allowed transitions:

```text
draft -> interest_check
draft -> topic_selection
draft -> availability_collection
draft -> polling
draft -> scheduling
draft -> cancelled

interest_check -> topic_selection
interest_check -> availability_collection
interest_check -> polling
interest_check -> cancelled

topic_selection -> availability_collection
topic_selection -> polling
topic_selection -> cancelled

availability_collection -> polling
availability_collection -> cancelled

polling -> needs_host_decision
polling -> scheduling
polling -> cancelled

needs_host_decision -> scheduling
needs_host_decision -> polling
needs_host_decision -> availability_collection
needs_host_decision -> cancelled

scheduling -> scheduled
scheduling -> scheduling_failed

scheduling_failed -> scheduling
scheduling_failed -> cancelled

scheduled -> rescheduling
scheduled -> completed
scheduled -> cancelled

rescheduling -> polling
rescheduling -> scheduling
rescheduling -> scheduled
rescheduling -> cancelled
```

Terminal states:

```text
cancelled
completed
```

### 9.2 Poll lifecycle

Allowed transitions:

```text
draft -> active
draft -> cancelled

active -> closed
active -> cancelled
active -> superseded

closed -> superseded
```

Rules:

- Draft polls are editable.
- Active polls accept votes.
- Closed polls do not accept votes.
- Cancelled polls are ignored.
- Superseded polls are preserved but ignored for scheduling.
- Only closed final timing polls trigger scheduling.

## 10. Validation Details

### 10.1 Session validation

Topic:

- Optional.
- Max 100.
- Trim whitespace.
- Empty string becomes null.

Description:

- Optional.
- Max 1000.
- Trim whitespace.
- Empty string becomes null.

Calendar invite policy:

- Required on create only if custom; default `app_only`.
- Must be one of `all_members`, `interested_members`, `app_only`.

### 10.2 Poll validation

Type:

- Required.
- Must be one of `interest`, `topic`, `availability`, `final_timing`.

Deadline:

- Required at publish time.
- Must be in future at publish time.
- Poll is expired if `deadline <= now`.

Multi-choice:

- Boolean.
- Interest poll can be single-choice.
- Topic poll can be single or multi-choice.
- Availability poll is commonly multi-choice.
- Final timing poll should usually be single-choice, but the DB supports multi-choice. Product recommendation: use single-choice for final timing.

### 10.3 Poll option validation

Label:

- Required.
- Max 255.
- Trim whitespace.

Time options:

- Required for `availability` and `final_timing`.
- `end_at > start_at`.
- Store UTC timestamps.
- Optional product constraint: duration should be reasonable, e.g. 15 minutes to 8 hours.

### 10.4 Vote validation

- User must be group member.
- Poll status must be active.
- Deadline must not have passed.
- Option IDs must belong to poll.
- No duplicate option IDs.
- For single-choice, exactly one option ID.
- For multi-choice, at least one option ID.

## 11. Frontend Page Contract

This section defines what data the frontend needs from the APIs.

### 11.1 Dashboard

Needs:

- Current user.
- Groups user belongs to.
- Upcoming scheduled sessions.
- Sessions needing host decision where current user is host/admin.
- Scheduling failures where current user is host/admin.

APIs:

```text
GET /api/v1/me
GET /api/v1/groups
GET /api/v1/groups/:groupId/sessions?upcoming=true
GET /api/v1/groups/:groupId/sessions?status=needs_host_decision&mine=true
GET /api/v1/groups/:groupId/sessions?status=scheduling_failed&mine=true
```

### 11.2 Group page

Needs:

- Group details.
- Member list.
- Session list.
- Current user admin flag.

APIs:

```text
GET /api/v1/groups/:groupId
GET /api/v1/groups/:groupId/members
GET /api/v1/groups/:groupId/sessions
```

### 11.3 Session page

Needs:

- Session details.
- Poll list with current user's votes.
- Scheduled Meet link if scheduled.
- Host/admin action state.

APIs:

```text
GET /api/v1/sessions/:sessionId
GET /api/v1/sessions/:sessionId/polls
```

### 11.4 Poll builder page

Host/admin only.

Needs:

- Poll details.
- Official options.
- Suggestions.
- Publish validation errors.

APIs:

```text
GET /api/v1/polls/:pollId
POST /api/v1/polls/:pollId/options
PATCH /api/v1/poll-options/:optionId
DELETE /api/v1/poll-options/:optionId
POST /api/v1/suggestions/:suggestionId/convert-to-option
POST /api/v1/polls/:pollId/publish
```

### 11.5 Active poll voting UI

Needs:

- Poll detail.
- Current user's selected options.
- Whether results visible.

APIs:

```text
GET /api/v1/polls/:pollId
PUT /api/v1/polls/:pollId/vote
DELETE /api/v1/polls/:pollId/vote
```

### 11.6 Host decision UI

Shown when session status is `needs_host_decision`.

Needs:

- Closed final timing poll.
- Results and tied options.
- Manual schedule action.
- Create new poll action.
- Cancel action.

APIs:

```text
GET /api/v1/sessions/:sessionId
GET /api/v1/polls/:pollId/results
POST /api/v1/sessions/:sessionId/manual-schedule
POST /api/v1/sessions/:sessionId/polls
POST /api/v1/sessions/:sessionId/cancel
```

## 12. Minimal Seed Data

For a clean MVP demo, seed one group:

```json
{
  "group": {
    "name": "TechUp Programmers",
    "description": "Private developer community sessions",
    "invite_enabled": true,
    "invite_max_uses": 50
  }
}
```

Recommended default interest poll options:

```json
[
  { "label": "Interested" },
  { "label": "Maybe" },
  { "label": "Not interested" }
]
```

Recommended final timing option labels:

```text
Sunday 8:00 PM America/New_York
Monday 8:00 PM America/New_York
Tuesday 8:00 PM America/New_York
```

Store actual `start_at` and `end_at` in UTC.

## 13. Environment Variables

Recommended:

```text
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_CALENDAR_SCOPES=openid email profile https://www.googleapis.com/auth/calendar.events
SESSION_SECRET=
CRON_SECRET=
APP_BASE_URL=
NODE_ENV=
```

Never expose:

- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`
- `CRON_SECRET`
- OAuth access tokens
- OAuth refresh tokens

## 14. Google OAuth Requirements

Request scopes:

```text
openid
email
profile
https://www.googleapis.com/auth/calendar.events
```

Behavior:

- On login, upsert `users`.
- Upsert `oauth_accounts`.
- Store refresh token if provided.
- If Google does not return a refresh token on repeated login, preserve existing refresh token unless the user explicitly reconnects.

Token refresh:

1. If `access_token_expires_at > now + safetyWindow`, use current access token.
2. Else refresh using refresh token.
3. Update `oauth_accounts.access_token`, `access_token_expires_at`, and `updated_at`.
4. If refresh fails, scheduling fails with `GOOGLE_TOKEN_REFRESH_FAILED`.

## 15. Security Requirements

- Never expose access tokens or refresh tokens to frontend.
- Every protected API route must call `requireAuth`.
- Every group-scoped route must verify membership.
- Every manager action must verify host/admin or group admin.
- Do not rely on frontend role checks.
- Store timestamps in UTC.
- Validate all path IDs are integers.
- Validate request bodies using a schema validator such as Zod.
- Do not allow SQL injection. Use parameterized queries or ORM.
- Do not allow users to access groups after membership removal.
- Do not read members' Google Calendars in MVP.
- Use `calendar.events` permission only for creating/updating events.
- Return generic external API errors to users, but store detailed error metadata in audit logs.

## 16. Testing Checklist

### 16.1 Auth

- Google login creates user.
- Google login updates existing user.
- OAuth tokens are stored.
- Tokens are not returned from `/me`.
- Calendar scope status works.

### 16.2 Groups

- Create group creates admin membership.
- Join valid invite succeeds.
- Invalid invite rejected.
- Disabled invite rejected.
- Expired invite rejected.
- Max-used invite rejected.
- Duplicate membership rejected.
- Admin can update group.
- Regular member cannot update group.
- Admin can set meeting owner.
- Non-member cannot be meeting owner.

### 16.3 Sessions

- Member can create session.
- Non-member cannot create session.
- Host can edit session.
- Admin can edit session.
- Regular non-host member cannot edit session.
- Cancelled session rejects new polls/votes.

### 16.4 Polls

- Host can create draft poll.
- Regular member cannot create poll.
- Draft poll cannot be voted on.
- Poll without options cannot be published.
- Final timing poll without start/end options cannot be published.
- Active poll accepts votes.
- Closed poll rejects votes.
- Expired poll rejects votes.
- Cancelled/superseded poll ignored.

### 16.5 Poll options

- Host can add options to draft poll.
- Host can edit draft options.
- Host can delete draft options.
- Active poll options cannot be edited/deleted.
- Availability/final timing options require start/end.

### 16.6 Suggestions

- Member can suggest option under accessible poll.
- Suggestion is not voteable.
- Host can convert suggestion to option while poll draft.
- Host cannot convert suggestion after poll active.

### 16.7 Voting

- Single-choice vote replaces old vote.
- Multi-choice vote stores multiple options.
- Duplicate click does not duplicate row.
- Option from another poll rejected.
- Non-member vote rejected.
- Current user votes returned correctly.

### 16.8 Scheduling

- Final timing poll clear winner schedules session.
- Tie moves session to `needs_host_decision`.
- No votes moves session to `needs_host_decision`.
- Meeting owner from group default is used.
- Host fallback is used if group default is null.
- Missing token moves session to `scheduling_failed`.
- Google Calendar failure moves session to `scheduling_failed`.
- Meet link missing moves session to `scheduling_failed`.
- Retry scheduling works.
- Duplicate cron job does not create duplicate Calendar event.
- Rescheduling updates existing Calendar event.
- App-only policy creates no attendees.
- All-members policy adds all group member emails.
- Interested-members policy adds interested/attending voters.

### 16.9 Audit logs

- Session creation logged.
- Poll creation logged.
- Option changes logged.
- Publishing logged.
- Vote submitted/changed logged.
- Poll closing logged.
- Scheduling success/failure logged.
- Member removal logged.
- Role update logged.

## 17. Build Order for Codex

Implement in this order:

1. Database migrations and enums.
2. Auth setup with Google OAuth.
3. User upsert and OAuth account token storage.
4. Shared auth/authorization helpers.
5. Group create/list/detail/join APIs.
6. Member list/role/remove APIs.
7. Meeting owner configuration.
8. Session create/list/detail/update/cancel APIs.
9. Poll create/list/detail/update APIs.
10. Poll option CRUD APIs.
11. Suggestion APIs.
12. Vote replacement API.
13. Poll result aggregation.
14. Poll publishing and closing.
15. Scheduling service without Google API, using mocks.
16. Google token refresh service.
17. Google Calendar create/update/cancel service.
18. Connect scheduling service to Google Calendar.
19. Cron endpoint for expired poll closing.
20. Audit log APIs.
21. Frontend pages.
22. End-to-end test flows.

## 18. Implementation Warnings

Do not implement notifications in the MVP. There is no notifications table in the schema.

Do not make suggestions voteable. Only `poll_options` can receive votes.

Do not skip `poll_votes`. It is central to the voting feature.

Do not create Calendar events from interest, topic, or availability polls. Only final timing polls schedule sessions.

Do not assume host equals meeting owner.

Do not expose OAuth tokens.

Do not keep DB transactions open while calling Google APIs.

Do not mark a session scheduled until the Calendar event ID and Meet link are stored.

Do not create duplicate Calendar events on retry or cron overlap.

Do not allow voting on draft, closed, cancelled, superseded, or expired polls.

Do not allow poll option edits after publishing.

Do not add custom reminder jobs. Google Calendar handles reminders for invited attendees.

## 19. Open Questions to Decide Before Coding

These can be decided quickly before implementation:

1. Should invite codes be visible to all members or admins only? Recommended: admins only.
2. Should active poll aggregate results be visible to regular members? Recommended: no, show after closed.
3. Should `interested_members` use normalized option labels or a dedicated option metadata field? Recommended future improvement: add metadata. MVP can use labels.
4. Should removed members' historical votes remain? Recommended: keep for historical poll integrity.
5. Should `default_meeting_owner` require admin role? Recommended: yes for MVP.
6. Should manual scheduling without a final timing poll be allowed? Recommended: yes for host/admin, because no-vote cases need recovery.
7. Should Google Calendar cancellation failure block app cancellation? Recommended: no, app cancellation should succeed and log Calendar failure.
