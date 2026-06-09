# TechUp Session Coordination Tool — Frontend Implementation Specification

## 1. Purpose

This document is a low-level frontend implementation specification for the TechUp Session Coordination Tool. It is written so an AI coding agent such as Codex can build the frontend without repeatedly guessing page structure, visual layout, route behavior, component behavior, or state handling.

The backend/API behavior is assumed to exist separately. This document focuses on what the user sees, what pages exist, how each page looks, what components are required, what states must be rendered, and what frontend behavior must happen for each user action.

The product is an internal web app for private developer communities to coordinate sessions. Members can join groups, view sessions, suggest topics, vote on polls, see final scheduled session details, and open Google Meet links. Hosts and group admins can create sessions, build draft polls, publish polls, close polls, handle tie/no-vote cases, configure meeting owner settings, retry scheduling failures, reschedule sessions, and cancel sessions.

The MVP intentionally does not include an in-app notification inbox, read/unread notification state, WhatsApp automation, SMS, email reminders, attendance tracking, recurring sessions, AI topic recommendations, or calendar availability sync.

## 2. Recommended Frontend Stack

Use this stack unless the existing repository already has a different approved stack.

- Framework: Next.js App Router
- Language: TypeScript
- Styling: Tailwind CSS
- Component layer: shadcn/ui-style components or equivalent local components
- Forms: React Hook Form
- Validation: Zod
- Data fetching: TanStack Query or server actions plus client revalidation
- Icons: lucide-react
- Dates: date-fns plus date-fns-tz or Luxon
- Toasts: sonner or shadcn toast
- Auth: Google OAuth session supplied by backend

The frontend must not store Google OAuth access tokens or refresh tokens. Tokens stay backend-only.

## 3. Design Principles

The app should feel like a clean internal operations dashboard, not a social media product.

Visual tone:

- Mostly white or neutral background.
- Soft gray borders.
- Rounded cards.
- Clear status badges.
- Obvious primary actions.
- Minimal color use except for status states.
- Dense enough for power users but not visually crowded.

Layout priorities:

- The dashboard must immediately show what needs action.
- A session page must show current status, next action, polls, Meet link, and host controls without searching.
- Poll pages must clearly separate official voteable options from member suggestions.
- Draft poll editing must make it obvious that members cannot vote yet.
- Scheduling failure and tie/no-vote states must be visually prominent.

Avoid:

- Hidden critical actions.
- Long pages with no sticky context.
- Modals for complex forms unless the form is short.
- Showing backend enum names directly without human labels.
- Confusing suggestions with voteable options.
- Showing Google token details to the user.

## 4. Global App Shell

### 4.1 Desktop Shell

Use a two-column layout after authentication.

Left sidebar width: 260px.
Main content: fluid width with max-width around 1180px centered inside content area.
Top header height: 64px.

Sidebar sections:

1. Product header
   - App name: `TechUp Sessions`
   - Small subtitle: `Community scheduling`

2. Primary navigation
   - Dashboard
   - Groups
   - My Hosted Sessions
   - Upcoming Sessions
   - Past Sessions

3. Current group switcher
   - Show selected group name.
   - Dropdown/list for groups the user belongs to.
   - Include `Join group` action.

4. Admin section, shown only if current user is admin in selected group
   - Group Settings
   - Members
   - Audit Log

5. User footer
   - Avatar
   - Name or email
   - Timezone display
   - Sign out button

Top header:

- Left: page title and optional breadcrumb.
- Right: primary action for the page.
- Example dashboard primary action: `Create session`.
- Example group settings primary action: `Save changes`, only when dirty.

### 4.2 Mobile Shell

Use a top navigation bar and bottom tab bar.

Top bar:

- App name or current page title.
- Group switcher button.
- Avatar button.

Bottom tabs:

- Dashboard
- Sessions
- Groups
- Hosted
- Settings if admin, otherwise Profile

On mobile, complex host/admin controls should collapse into an `Actions` button opening a bottom sheet.

## 5. Global UI Components

### 5.1 StatusBadge

Render enum statuses with human labels.

Session statuses:

- draft → `Draft`, gray
- interest_check → `Interest check`, blue
- topic_selection → `Topic selection`, purple
- availability_collection → `Availability`, indigo
- polling → `Polling`, blue
- needs_host_decision → `Needs host decision`, amber
- scheduling → `Scheduling`, amber with spinner icon
- scheduled → `Scheduled`, green
- scheduling_failed → `Scheduling failed`, red
- rescheduling → `Rescheduling`, amber
- cancelled → `Cancelled`, gray with strike style
- completed → `Completed`, neutral

Poll statuses:

- draft → `Draft`, gray
- active → `Active`, green
- closed → `Closed`, neutral
- cancelled → `Cancelled`, gray
- superseded → `Superseded`, neutral

### 5.2 RoleBadge

- Admin → `Admin`, filled dark badge
- Member → `Member`, outlined badge
- Host → `Host`, blue outlined badge
- Meeting owner → `Meeting owner`, purple outlined badge

### 5.3 EmptyState

Reusable centered card.

Elements:

- Icon
- Title
- Body text
- Primary action button
- Optional secondary action

Examples:

- No groups: `Join your first group`
- No sessions: `No sessions yet`
- No polls: `No polls created for this session`
- No suggestions: `No suggestions yet`

### 5.4 Loading Skeletons

Every page must have skeleton loading states.

Dashboard skeleton:

- Three stat card skeletons.
- Three session card skeletons.
- One table skeleton.

Session detail skeleton:

- Header skeleton.
- Status banner skeleton.
- Poll card skeleton.
- Sidebar metadata skeleton.

### 5.5 ErrorState

Reusable error card.

Elements:

- Red warning icon.
- Short title.
- Plain-language message.
- Retry button.

Do not expose raw stack traces. For scheduling failures, show a friendly summary and include raw Google error only in admin/host detail accordion.

### 5.6 ConfirmDialog

Use for destructive or irreversible actions:

- Delete draft poll option.
- Cancel poll.
- Cancel session.
- Remove member.
- Close poll early.
- Supersede poll.

Dialog structure:

- Title
- Explanation
- Consequence text
- Cancel button
- Destructive confirm button

### 5.7 PageHeader

Reusable page header.

Props:

- title
- subtitle
- badge
- breadcrumb
- primaryAction
- secondaryActions

Desktop: actions right aligned.
Mobile: actions stack under title or move into bottom sheet.

### 5.8 TimeDisplay

All dates/times must render in the viewer timezone.

Show:

- Short display: `Tue, Jun 16 · 7:00 PM`
- Range display: `Tue, Jun 16 · 7:00–8:30 PM`
- Timezone suffix: `America/Phoenix` or short human display like `MST`, but avoid relying only on ambiguous abbreviations.

Where space allows, show both:

`Tue, Jun 16 · 7:00–8:30 PM`  
`America/Phoenix`

### 5.9 ActionRequiredBanner

Used when the user must act.

States:

- Final timing poll tied.
- Final timing poll received no votes.
- Scheduling failed.
- Meeting owner missing calendar permission.
- Draft poll has no options and cannot publish.

Banner layout:

- Left: icon and explanation.
- Middle: recommended action.
- Right: action buttons.

Example for tie:

Title: `Host decision needed`
Body: `The final timing poll ended in a tie. Choose a winning time manually or create another poll.`
Buttons: `Choose time`, `Create new poll`, `Cancel session`

## 6. Route Map

Use these routes exactly unless backend routing constraints require minor changes.

Public routes:

- `/` landing/login page
- `/auth/callback` OAuth callback page
- `/join/[inviteCode]` invite landing page

Authenticated routes:

- `/dashboard`
- `/groups`
- `/groups/new`
- `/groups/join`
- `/groups/[groupId]`
- `/groups/[groupId]/settings`
- `/groups/[groupId]/members`
- `/groups/[groupId]/audit-log`
- `/sessions`
- `/sessions/new?groupId=...`
- `/sessions/[sessionId]`
- `/sessions/[sessionId]/edit`
- `/sessions/[sessionId]/polls/new`
- `/sessions/[sessionId]/polls/[pollId]/edit`
- `/sessions/[sessionId]/reschedule`
- `/profile`

Optional but useful:

- `/sessions/hosted`
- `/sessions/upcoming`
- `/sessions/past`

## 7. Authentication Pages

### 7.1 Landing / Login Page — `/`

Purpose: explain the product and let users sign in with Google.

Layout:

- Full-height centered layout.
- Left side hero copy on desktop.
- Right side login card.
- On mobile, stack vertically.

Hero content:

Title: `Coordinate community sessions without WhatsApp chaos.`
Subtitle: `Create sessions, collect topic ideas, vote on times, and generate Google Meet links from one shared workflow.`

Feature bullets:

- `Topic and timing polls`
- `Google Meet link generation`
- `Calendar invites when needed`
- `Host/admin decision handling`

Login card:

- App logo placeholder.
- Title: `Sign in to TechUp Sessions`
- Button: `Continue with Google`
- Small text: `Google is used for login and Calendar event creation. Tokens are never shown in the browser.`

Button action:

- Redirect to backend Google OAuth start endpoint.

### 7.2 OAuth Callback Page — `/auth/callback`

Purpose: transient page after Google login.

Visual:

- Centered spinner.
- Text: `Finishing sign in...`
- On success redirect to `/dashboard`.
- On failure show ErrorState with `Try again` button.

### 7.3 Invite Landing Page — `/join/[inviteCode]`

Purpose: let a user join a group from an invite code.

Unauthenticated state:

- Show group invite card if public validation endpoint allows it.
- Button: `Sign in with Google to join`.

Authenticated state:

Card layout:

- Group name
- Description
- Invite status
- Member count if available
- Button: `Join group`

Success state:

- Green success banner: `You joined [Group Name]`
- Button: `Go to group`

Failure states:

- Invalid code: `This invite link is invalid.`
- Disabled code: `This invite link is disabled.`
- Expired code: `This invite link has expired.`
- Max uses reached: `This invite link has reached its usage limit.`
- Already member: show `You are already a member` and `Go to group`.

## 8. Dashboard Page — `/dashboard`

Purpose: default authenticated homepage. Shows what the user needs to know now.

### 8.1 Desktop Layout

PageHeader:

- Title: `Dashboard`
- Subtitle: `Sessions, polls, and actions across your groups.`
- Primary button: `Create session`
- Secondary button: `Join group`

Top row: 4 stat cards in grid.

1. `Upcoming sessions`
2. `Active polls`
3. `Needs my action`
4. `Groups`

Each card:

- Count large.
- Small caption.
- Clickable where useful.

Main content grid:

Left column width: 65%.
Right column width: 35%.

Left column sections:

1. `Action required`
   - Show only if any sessions need host/admin action.
   - Cards for needs_host_decision, scheduling_failed, draft poll publish issues.

2. `Upcoming sessions`
   - Session cards sorted by soonest scheduled_start_time.

3. `Active polls`
   - Poll cards where current user can vote.

Right column sections:

1. `My groups`
   - Compact group list.

2. `My hosted sessions`
   - Sessions where current user is host.

3. `Recent activity`
   - Audit-like simple feed if endpoint exists; otherwise omit for MVP.

### 8.2 Session Card

Card header:

- Topic title
- StatusBadge
- Group name

Card body:

- Description snippet max 2 lines.
- Host avatar/name.
- TimeDisplay if scheduled.
- Meet link button if scheduled and visible.

Footer actions:

- `View session`
- If user is host/admin and status needs action: relevant CTA.

### 8.3 Active Poll Card

Card header:

- Poll type label: `Final timing poll`, `Topic poll`, etc.
- Deadline countdown: `Closes in 2h 14m` or `Closes today at 8:00 PM`.

Body:

- Session topic.
- Number of options.
- User vote state: `You voted` or `Not voted yet`.

Footer:

- `Vote now`

## 9. Groups List Page — `/groups`

Purpose: show all groups the user belongs to.

PageHeader:

- Title: `Groups`
- Subtitle: `Private communities you belong to.`
- Primary button: `Create group`
- Secondary button: `Join with code`

Layout:

- Grid of group cards.
- Each group card has name, description, role badge, member count, upcoming session count, active poll count.

Card actions:

- `Open group`
- Admin only: `Settings`

Empty state:

Title: `No groups yet`
Body: `Join a group with an invite code or create your own private group.`
Buttons: `Join group`, `Create group`

## 10. Create Group Page — `/groups/new`

Purpose: create a private group.

Page layout:

- Centered form card max-width 720px.

Fields:

1. Group name
   - Required
   - Max 60 chars
   - Placeholder: `TechUp Programmers`

2. Description
   - Optional
   - Max 500 chars
   - Textarea

3. Invite settings
   - Toggle: `Enable invite code`
   - Max uses number input default 50
   - Expiration date/time optional

4. Meeting owner
   - Info box: `The meeting owner is the Google account used to create Calendar events and Meet links.`
   - Default to current user.
   - If backend supports selecting another member later, create group first then configure in settings.

Submit:

- Button: `Create group`
- On success redirect to `/groups/[groupId]`.

## 11. Join Group Page — `/groups/join`

Purpose: manual invite code entry.

Layout:

- Centered card.

Fields:

- Invite code input
- Button: `Join group`

After validation:

- Show group preview before final join if endpoint supports preview.
- Otherwise join directly and show success/error.

## 12. Group Detail Page — `/groups/[groupId]`

Purpose: group home page with sessions, polls, members summary, and admin controls.

### 12.1 Header

PageHeader:

- Title: group name
- Subtitle: group description
- Badge: current role Admin/Member
- Primary action: `Create session`
- Admin secondary actions: `Settings`, `Members`

### 12.2 Layout

Desktop:

- Main left column: sessions and polls.
- Right sidebar: group metadata and quick actions.

Left sections:

1. `Upcoming sessions`
2. `Sessions needing action`
3. `Active polls`
4. `Recent sessions`

Right sidebar cards:

1. `Group info`
   - Member count
   - Admin count
   - Created date
   - Current user role

2. `Meeting owner`
   - Meeting owner name/email if configured
   - Status: `Calendar connected` or `Needs reconnect`
   - Admin button: `Configure`

3. `Invite code`
   - Admin only
   - Show invite code masked/visible toggle
   - Copy invite link button
   - Usage count: `12 / 50 used`

4. `Quick actions`
   - Create session
   - Create final timing poll only when relevant session selected? For group page keep to `Create session` and `Join settings`.

## 13. Group Settings Page — `/groups/[groupId]/settings`

Admin only.

Purpose: configure group metadata, invite code, meeting owner, and default calendar behavior.

### 13.1 Layout

Use tabs or stacked cards. Prefer stacked cards for clarity.

Cards:

1. `Group profile`
2. `Invite settings`
3. `Meeting owner`
4. `Calendar defaults`
5. `Danger zone`

### 13.2 Group Profile Card

Fields:

- Name
- Description

Buttons:

- `Save profile`

### 13.3 Invite Settings Card

Fields:

- Toggle: `Invite code enabled`
- Invite code display
- Button: `Copy invite link`
- Button: `Regenerate code`
- Max uses
- Expiration date/time
- Used count display

Regenerate code requires confirmation:

Title: `Regenerate invite code?`
Body: `The old invite link will stop working.`

### 13.4 Meeting Owner Card

Purpose: select the Google account used for Calendar events and Meet links.

Visual:

- Explanation block at top.
- Current meeting owner card with avatar, name, email.
- Calendar permission status.
- Select dropdown of group members who have connected Google OAuth with calendar scope.

Fields:

- `Default meeting owner` select.

States:

- No owner configured: amber warning `No default meeting owner configured. Sessions will fall back to the host account.`
- Owner missing Calendar permission: red warning `Selected meeting owner needs to reconnect Google Calendar permission.`
- Owner valid: green text `Calendar permission connected.`

Buttons:

- `Save meeting owner`
- If current user is selected owner and permission missing: `Reconnect Google Calendar`

### 13.5 Calendar Defaults Card

Fields:

- Default invite policy select:
  - `Invite all group members`
  - `Invite interested/attending members only`
  - `Do not invite members; show Meet link in app only`

Note: schema stores policy at session level. If backend does not store group default yet, frontend can show this only when supported or leave it out. For MVP, session creation must always ask for policy.

### 13.6 Danger Zone

Actions:

- `Disable invite code`
- Optional future: archive group. Do not implement delete group unless backend supports it.

## 14. Members Page — `/groups/[groupId]/members`

Admin only for management actions. Regular members may have read-only member list if product permits; otherwise restrict to admins.

PageHeader:

- Title: `Members`
- Subtitle: `Manage who belongs to this group.`
- Primary action: `Copy invite link`

Table columns:

- Member: avatar, name, email
- Role: Admin/Member
- Joined at
- Meeting owner marker if applicable
- Actions

Actions per row:

- Promote to admin
- Demote to member
- Remove member

Rules:

- Do not allow current user to remove themselves if they are the only admin.
- Do not allow demoting the only admin.
- Do not allow removing selected default meeting owner without warning.

Remove member confirmation:

Title: `Remove member?`
Body: `This user will lose access to the group’s sessions, polls, votes, and future session details.`
Button: `Remove member`

## 15. Audit Log Page — `/groups/[groupId]/audit-log`

Admin only.

Purpose: debugging and traceability.

Layout:

- Filter bar
- Table/list of audit events

Filters:

- Action type
- Session
- Poll
- User
- Date range

Event row:

- Icon based on action
- Action human label
- Actor name/email
- Timestamp
- Related session/poll link
- Metadata disclosure accordion

Metadata accordion:

- Render JSON pretty-printed.
- Collapse by default.

Do not show audit logs to regular members in MVP.

## 16. Sessions List Page — `/sessions`

Purpose: all sessions user can access.

PageHeader:

- Title: `Sessions`
- Subtitle: `Browse sessions across your groups.`
- Primary action: `Create session`

Filter bar:

- Group select
- Status select
- Date range
- Search by topic
- Checkbox: `Hosted by me`

Tabs:

- Upcoming
- Active planning
- Needs action
- Past
- Cancelled

Session display:

- Use list cards, not dense table, because session status and actions matter.

Each row/card:

- Topic
- Group
- StatusBadge
- Host
- Scheduled time or current planning phase
- Active poll count
- CTA: `Open`

## 17. Create Session Page — `/sessions/new?groupId=...`

Purpose: create a session proposal.

### 17.1 Layout

Centered form, max-width 800px.
Right side preview card on desktop.

PageHeader:

- Title: `Create session`
- Subtitle: `Start a session proposal and choose how Calendar invites should work.`

### 17.2 Form Fields

1. Group
   - Select from groups where user is member.
   - Required.
   - Preselect from query param.

2. Topic
   - Optional at DB level but recommended.
   - Max 100 chars.
   - Placeholder: `System Design: Monitoring and Logging`
   - Helper text: `Leave blank if you want members to help choose the topic.`

3. Description
   - Optional.
   - Max 1000 chars.
   - Textarea.
   - Placeholder: `What should members expect from this session?`

4. Calendar invitation policy
   - Required.
   - Radio cards, not a dropdown.

Radio card 1:

Title: `Invite all group members`
Description: `Best for official community-wide sessions.`
Value: `all_members`

Radio card 2:

Title: `Invite interested members only`
Description: `Only members who selected Interested/Attending are added to Calendar.`
Value: `interested_members`

Radio card 3:

Title: `App link only`
Description: `Create a Meet link but do not add members as Calendar attendees.`
Value: `app_only`
Default value: `app_only`

5. Initial planning flow
   - Optional radio group for what host wants to do next:
     - `Create topic poll`
     - `Create availability poll`
     - `Create final timing poll`
     - `Create session only`
   - This is frontend workflow only. On success redirect accordingly.

Submit buttons:

- Primary: `Create session`
- Secondary: `Cancel`

After create:

- If initial flow selected, redirect to `/sessions/[sessionId]/polls/new?type=...`
- Else redirect to `/sessions/[sessionId]`

## 18. Session Detail Page — `/sessions/[sessionId]`

This is the most important page in the app.

Purpose: single source of truth for one session. It must show current status, polls, suggestions, votes, scheduling state, Meet link, and host/admin actions.

### 18.1 Desktop Layout

Use a 12-column grid.

Main content: 8 columns.
Right sidebar: 4 columns.

Top PageHeader spans full width.

PageHeader:

- Breadcrumb: group name → sessions
- Title: session topic or `Untitled session`
- Subtitle: short description or `No description provided`
- Badge: StatusBadge
- Primary action varies by state and role.

Primary action logic:

- Member, scheduled: `Open Meet link`
- Member, active poll exists and not voted: `Vote now`
- Host/admin, draft/no polls: `Create poll`
- Host/admin, needs_host_decision: `Choose time`
- Host/admin, scheduling_failed: `Retry scheduling`
- Host/admin, scheduled: `Reschedule`

Secondary action menu for host/admin:

- Edit session
- Create poll
- Cancel session
- View audit log

### 18.2 Status Banner

Below PageHeader, show a contextual status banner.

Statuses:

Draft:

Title: `Session draft`
Body: `Create a poll to collect interest, topics, availability, or final timing votes.`
Actions for host/admin: `Create poll`, `Edit session`

Interest check:

Title: `Collecting interest`
Body: `Members can vote on whether they are interested or attending.`

Topic selection:

Title: `Choosing a topic`
Body: `Members can vote on official topic options. Suggestions may be reviewed by the host.`

Availability collection:

Title: `Collecting availability`
Body: `Members are sharing which time ranges work for them.`

Polling:

Title: `Poll in progress`
Body: `Voting is open. Results are final after the poll closes.`

Needs host decision:

Title: `Host decision needed`
Body: `The final timing poll ended in a tie or received no votes. Choose a time manually or create another poll.`
Actions: `Choose time`, `Create new poll`, `Cancel session`

Scheduling:

Title: `Scheduling session`
Body: `The app is creating a Google Calendar event and Meet link.`
Show spinner.

Scheduled:

Title: `Session scheduled`
Body: show date/time and Meet link.
Actions: `Open Meet`, `Add/view Calendar event` if URL exists.

Scheduling failed:

Title: `Scheduling failed`
Body: `The session could not be scheduled through Google Calendar.`
Actions host/admin: `Retry scheduling`, `Change meeting owner`, `View error`

Rescheduling:

Title: `Rescheduling in progress`
Body: `The existing Calendar event will be updated after a new time is selected.`

Cancelled:

Title: `Session cancelled`
Body: `This session is preserved for history and no longer accepts polls or votes.`

Completed:

Title: `Session completed`
Body: `This session is preserved for history.`

### 18.3 Main Column Sections

#### Section A: Scheduled Session Card

Show only when status is scheduled, completed, rescheduling, or cancelled with existing scheduled time.

Card fields:

- Date/time range
- Timezone
- Meet link
- Calendar invite policy
- Meeting owner
- Calendar event ID hidden from normal users; visible to host/admin in technical details accordion

Actions:

- `Open Meet link`
- Host/admin: `Reschedule`
- Host/admin: `Cancel session`

#### Section B: Active Polls

Show active polls first.

PollCard for each active poll.

PollCard header:

- Poll type human label
- StatusBadge
- Deadline countdown
- Multi-choice marker if applicable

PollCard body:

- Options list.
- For each option show radio/checkbox depending on poll.multi_choice.
- Time-based options show time range.
- Current vote selected state must be visible.

PollCard footer:

- Member action: `Submit vote` or `Update vote`
- Host/admin actions: `Close poll`, `View results`

Important:

- For single-choice poll, clicking a new option should replace old selection in UI before submit.
- For multi-choice poll, multiple options can be selected.
- Disable submit if no changes.

Result visibility:

- For active polls, show only `You voted` and option list unless backend says live results are allowed.
- For closed polls, show aggregated result bars.

#### Section C: Draft Polls

Visible to host/admin only.

Card text:

`Draft polls are not visible for voting until published.`

Each draft poll card:

- Poll type
- Option count
- Deadline
- Warning if no options
- Buttons: `Edit draft`, `Publish`, `Cancel`

Publish button disabled if:

- No options.
- Availability/final_timing option missing start/end.
- Deadline missing if required by backend.

#### Section D: Closed Polls / Poll History

Accordion list.

Each closed poll:

- Poll type
- Closed date
- Winning option if any
- Result bars
- `View details`

Final timing closed poll with tie:

- Show tied options with amber marker.

Superseded polls:

- Collapsed by default.
- Label `Superseded`.

#### Section E: Suggestions

Show if session has topic poll or any poll that accepts suggestions.

For members:

- Input: `Suggest an option`
- Button: `Submit suggestion`
- List of existing suggestions.

For host/admin:

- Suggestions list with actions:
  - `Add as official option`
  - `Copy text`

Important visual distinction:

- Suggestions must be in a separate card titled `Member suggestions`.
- They must not appear mixed into the official voting options.
- Each suggestion must have label `Suggestion`, not `Option`.

### 18.4 Right Sidebar Sections

#### Session Info Card

Fields:

- Group
- Host
- Created date
- Last updated
- Calendar invite policy
- Session status

#### Meeting Owner Card

Fields:

- Meeting owner name/email if scheduled or selected.
- If not selected yet, show default group meeting owner.
- Permission status if available.

Warnings:

- Missing owner.
- Missing calendar permission.

#### Host Actions Card

Visible to host/admin.

Actions vary by status:

Draft/planning:

- Create poll
- Edit session
- Cancel session

Active poll:

- Close active poll
- Create another poll
- Cancel session

Needs host decision:

- Choose winning time
- Create new final timing poll
- Return to availability collection
- Cancel session

Scheduling failed:

- Retry scheduling
- Change meeting owner
- Cancel session

Scheduled:

- Reschedule
- Cancel session
- Mark completed

#### Technical Details Accordion

Visible to host/admin only.

Fields:

- session_id
- group_id
- selected_option_id
- calendar_event_id
- google_calendar_id
- scheduling_attempt_count
- last_scheduling_attempt_at
- scheduling_error

Collapsed by default.

## 19. Create/Edit Poll Page — `/sessions/[sessionId]/polls/new` and `/sessions/[sessionId]/polls/[pollId]/edit`

Purpose: host/admin builds a draft poll and publishes it.

### 19.1 Page Layout

Two-column layout on desktop.

Left: poll form.
Right: live preview.

PageHeader:

- New: `Create poll`
- Edit: `Edit draft poll`
- Subtitle: session topic

### 19.2 Poll Metadata Form

Fields:

1. Poll type
   - Select/radio cards.
   - Values:
     - interest
     - topic
     - availability
     - final_timing
   - Disable editing type after poll has options unless backend supports conversion.

2. Voting mode
   - Toggle or radio:
     - Single choice
     - Multiple choice
   - Default by type:
     - interest: single choice unless options are “Interested/Attending/Not attending”
     - topic: single choice
     - availability: multi-choice
     - final_timing: single choice

3. Deadline
   - Date picker + time picker.
   - Required before publishing.
   - Must be future time.
   - Display timezone.

4. Poll instructions
   - Optional frontend-only text if backend supports description; current schema does not include poll description. Do not store unless API supports it.

### 19.3 Option Builder

This is the most important section on the poll page.

For interest poll:

Default options button:

- `Add default interest options`

Default options:

- `Interested`
- `Attending`
- `Not interested`

Option row fields:

- Label
- Delete button
- Drag handle if ordering exists. If backend has no position field, do not implement drag reorder.

For topic poll:

Option row fields:

- Label
- Delete button

Helper text:

`Members may submit suggestions separately. Only options added here are voteable.`

For availability poll:

Option row fields:

- Label optional but recommended.
- Start date/time.
- End date/time.
- Delete button.

Default label auto-generation:

If label is blank, render preview as `Tue, Jun 16 · 7:00–8:00 PM`.

For final timing poll:

Same as availability poll, but single-choice default.

Validation:

- Label required for non-time polls.
- start_at and end_at required for availability/final_timing.
- end_at must be after start_at.
- Options must belong to current poll.
- Need at least one option to publish.

Buttons:

- `Add option`
- For time polls: `Add time option`
- `Save draft`
- `Publish poll`

### 19.4 Suggestions Panel

If editing an existing draft poll, show suggestions panel on right or below.

Host/admin can:

- View member suggestions.
- Click `Add as official option`.
- This creates a poll_option with suggestion text.

Do not delete suggestions unless backend supports it.

### 19.5 Live Preview

Preview card shows exactly what members will see after publish.

Preview includes:

- Poll type
- Deadline
- Options as radio/checkbox list
- Message: `Draft preview — members cannot vote until published.`

### 19.6 Publish Behavior

When host clicks `Publish poll`:

- Validate client-side.
- Call publish endpoint.
- On success redirect to session detail and focus active poll section.

If backend rejects:

- Show inline errors where possible.
- Show toast for general failure.

## 20. Poll Voting UX

Voting usually happens inside Session Detail, not a separate page.

### 20.1 Single Choice

UI:

- Radio group.
- Selected option highlighted with border/background.
- If user previously voted, preselect current vote.
- Button text: `Submit vote` or `Update vote`.

After submit:

- Optimistically show `Vote saved` toast.
- Refetch poll.
- Show small label `You voted for this` next to selected option.

### 20.2 Multi Choice

UI:

- Checkbox list.
- Allow multiple selected.
- Show selected count.

Button:

- `Submit choices`

### 20.3 Vote Disabled Cases

Disable or hide vote form when:

- Poll is draft.
- Poll is closed.
- Poll is cancelled.
- Poll is superseded.
- Deadline has passed.
- Session is cancelled/completed.
- User is not group member.

Show reason:

- `Voting is closed.`
- `This poll is still a draft.`
- `This session has been cancelled.`

## 21. Poll Results UI

Closed polls show result bars.

For each option:

- Option label/time.
- Vote count.
- Percentage.
- Horizontal bar.
- Winner marker if highest count and not tied.
- Tie marker if tied.

For no votes:

- Empty result message: `No votes were submitted.`

For final timing poll:

- Clear winner: show `Selected for scheduling`.
- Tie/no votes: show `Host decision required`.

## 22. Host Decision Page / Modal

Route: can be modal from session detail or page `/sessions/[sessionId]/reschedule` / action panel.

Purpose: handle final timing tie or no-vote case.

### 22.1 Choose Winning Time

Page title: `Choose final session time`

Layout:

- Explanation banner.
- List of final timing poll options with vote counts.
- Radio select.
- Optional custom time form if backend supports manual custom time. If backend only supports selected_option_id, do not implement custom time.

Buttons:

- `Schedule with selected time`
- `Create new final timing poll`
- `Cancel session`

### 22.2 No-Vote Case

If no votes:

- Show all options with zero votes.
- Text: `No one voted. You can still choose a time manually or create a new poll.`

## 23. Reschedule Page — `/sessions/[sessionId]/reschedule`

Purpose: reschedule an existing scheduled session.

Layout:

- Current schedule summary card.
- Choice cards:
  1. `Create a new final timing poll`
  2. `Choose a new time directly` if backend supports manual selection
  3. `Return to availability collection`

Important copy:

`Because this session already has a Calendar event, the existing event will be updated instead of creating a duplicate.`

If creating new poll:

- Redirect to create poll page with type final_timing.
- Mark session rescheduling via backend before poll creation if required.

## 24. Edit Session Page — `/sessions/[sessionId]/edit`

Host/admin only.

Fields:

- Topic
- Description
- Calendar invitation policy

Display read-only fields:

- Group
- Host
- Status

Rules:

- Cannot edit if cancelled/completed except maybe description. For MVP, disable edits to terminal sessions.
- Changing calendar invitation policy after scheduled should warn that attendee updates may be needed. Only allow if backend supports updating attendees.

Buttons:

- `Save changes`
- `Cancel`

## 25. Session Cancellation UX

Use ConfirmDialog.

Dialog title: `Cancel session?`

Body:

`This session will remain visible for history, but it will no longer accept polls, votes, or scheduling actions.`

If scheduled:

`If a Google Calendar event exists, the app will try to cancel or update the Calendar event as a best-effort operation.`

Button:

- `Cancel session`

After success:

- Show cancelled status banner.
- Disable all poll/vote actions.

## 26. Scheduling Failed UX

This must be very clear.

Status banner:

Title: `Scheduling failed`
Body: `The app could not create or update the Google Calendar event and Meet link.`

Show likely causes list:

- Meeting owner has not granted Calendar permission.
- Google token refresh failed.
- Google Calendar API returned an error.
- Calendar attendee update failed.

Actions:

- `Retry scheduling`
- `Change meeting owner`
- `Reconnect Google Calendar` when current user is the meeting owner
- `View technical error`

Technical error accordion:

- scheduling_error
- attempt count
- last attempt time

Do not show scheduling_failed as a generic toast only. It must be persistent on the session page.

## 27. Calendar Invitation Policy UI

Use human labels everywhere.

Values:

### all_members

Label: `Invite all group members`
Description: `Every active group member is added as a Google Calendar attendee.`

### interested_members

Label: `Invite interested/attending members`
Description: `Only members who selected Interested or Attending are added as attendees.`

### app_only

Label: `App link only`
Description: `Create a Meet link but do not add members to Google Calendar.`

Show policy on:

- Create session page
- Edit session page
- Session detail sidebar
- Scheduled session card
- Scheduling confirmation screen

## 28. Meeting Owner UI

Meeting owner is separate from session host and must be visually clear.

Where to show:

- Group detail sidebar
- Group settings
- Session detail sidebar
- Scheduled session card
- Scheduling failed banner

Copy:

`The meeting owner is the Google account used to create the Google Calendar event and Google Meet link. This can be different from the session host.`

States:

- Configured and valid
- Configured but missing Calendar permission
- Not configured, fallback to host
- Scheduling used a specific meeting owner

Never expose access_token or refresh_token.

## 29. Suggested Options UI

Suggestions are not voteable.

Rules:

- Always render suggestions in a separate card.
- Label the section `Member suggestions`.
- Use helper text: `Suggestions are ideas for the host. They are not voteable until the host adds them as official poll options.`
- Host/admin sees `Add as official option` button.
- Regular members only see list and submit input.

Suggestion input:

- Max 255 chars.
- Placeholder by poll type:
  - Topic: `Suggest a topic, e.g. Kafka basics`
  - Timing: `Suggest a time idea, e.g. Sunday evening`
  - General: `Suggest an option`

After submit:

- Clear input.
- Add suggestion to list.
- Toast: `Suggestion submitted`.

## 30. Page Permissions

Frontend must hide unavailable actions, but backend remains source of truth.

### Regular Member

Can:

- View groups where member.
- View sessions in those groups.
- Vote on active polls.
- Submit suggestions.
- Open Meet link when visible.

Cannot:

- Create group settings changes.
- Manage members.
- Configure meeting owner.
- Publish/close/cancel polls.
- Schedule manually.
- Cancel sessions unless host/admin.

### Session Host

Can:

- Edit own session.
- Create polls for own session.
- Manage draft options.
- Publish polls.
- Close polls.
- Handle needs_host_decision.
- Retry scheduling for own session if allowed.
- Reschedule/cancel own session.

### Group Admin

Can:

- Manage all sessions in group.
- Manage members.
- Configure meeting owner.
- Manage invite code.
- View audit logs.
- Retry scheduling failures.

## 31. Data Fetching Requirements

### 31.1 Dashboard Data

Frontend needs an endpoint or composed queries for:

- Current user
- User groups
- Upcoming sessions
- Active polls requiring vote
- Sessions requiring host/admin action
- Hosted sessions

Avoid fetching every poll and every vote separately. Use backend summary endpoints where possible.

### 31.2 Session Detail Data

Session detail should fetch one composed payload:

- session
- group
- host
- meeting_owner
- current_user_permissions
- polls
- poll_options
- current_user_votes
- vote_counts for closed polls
- suggestions
- scheduling metadata for host/admin

This avoids frontend waterfall requests.

### 31.3 Query Keys

Use stable query keys:

- `['me']`
- `['groups']`
- `['group', groupId]`
- `['sessions', filters]`
- `['session', sessionId]`
- `['poll', pollId]`
- `['auditLog', groupId, filters]`

After mutations invalidate relevant keys.

## 32. Form Validation Rules

Use Zod schemas aligned with DB constraints.

User-facing constraints:

- group.name: required, max 60
- group.description: max 500
- session.topic: max 100
- session.description: max 1000
- poll.deadline: future datetime required for publish
- poll_option.label: max 255; required for non-time poll
- poll_option.start_at: required for availability/final_timing
- poll_option.end_at: required for availability/final_timing and after start_at
- suggestion: required, max 255
- invite_code: required, max 20

Client validation should reduce obvious mistakes. Backend validation still required.

## 33. Toasts and Inline Feedback

Use toasts for action completion:

- `Session created`
- `Poll saved as draft`
- `Poll published`
- `Vote saved`
- `Suggestion submitted`
- `Session cancelled`
- `Scheduling retry started`
- `Settings saved`

Use inline errors for form fields.

Use persistent banners for major states:

- scheduling_failed
- needs_host_decision
- cancelled
- no meeting owner
- missing Calendar permission

## 34. Empty States

### No Groups

Title: `No groups yet`
Body: `Join a private group with an invite code or create a group for your community.`
Actions: `Join group`, `Create group`

### No Sessions in Group

Title: `No sessions yet`
Body: `Create the first session proposal for this group.`
Action: `Create session`

### No Active Polls

Title: `No active polls`
Body: `There are no polls waiting for your vote.`

### No Suggestions

Title: `No suggestions yet`
Body: `Members can suggest ideas while the host builds the poll.`

### No Audit Logs

Title: `No audit events yet`
Body: `Important lifecycle events will appear here.`

## 35. Responsive Behavior

Breakpoints:

- Mobile: < 768px
- Tablet: 768–1024px
- Desktop: > 1024px

Mobile rules:

- Sidebar becomes drawer.
- Tables become cards.
- Session detail right sidebar stacks under main content.
- PageHeader actions move into vertical button group.
- Host/admin actions move into `Actions` bottom sheet.
- Poll options must be full-width tappable rows.
- Date/time pickers must be mobile-friendly.

Desktop rules:

- Use two-column layouts for dashboard, group detail, session detail, poll editor.
- Keep critical action banners full width.
- Keep host actions visible in right sidebar.

## 36. Accessibility Requirements

- All buttons must have accessible labels.
- Poll options must use real radio/checkbox controls or equivalent ARIA roles.
- Status badges cannot rely only on color.
- Form errors must be associated with inputs.
- Modals must trap focus.
- Keyboard users must be able to submit votes and manage forms.
- Meet link must be a real anchor element.

## 37. Frontend Component Structure

Recommended folder structure:

```txt
src/
  app/
    page.tsx
    auth/callback/page.tsx
    dashboard/page.tsx
    groups/page.tsx
    groups/new/page.tsx
    groups/join/page.tsx
    groups/[groupId]/page.tsx
    groups/[groupId]/settings/page.tsx
    groups/[groupId]/members/page.tsx
    groups/[groupId]/audit-log/page.tsx
    sessions/page.tsx
    sessions/new/page.tsx
    sessions/[sessionId]/page.tsx
    sessions/[sessionId]/edit/page.tsx
    sessions/[sessionId]/polls/new/page.tsx
    sessions/[sessionId]/polls/[pollId]/edit/page.tsx
    sessions/[sessionId]/reschedule/page.tsx
    profile/page.tsx
  components/
    app-shell/
      AppShell.tsx
      Sidebar.tsx
      TopHeader.tsx
      GroupSwitcher.tsx
      MobileNav.tsx
    common/
      PageHeader.tsx
      StatusBadge.tsx
      RoleBadge.tsx
      EmptyState.tsx
      ErrorState.tsx
      ConfirmDialog.tsx
      TimeDisplay.tsx
      ActionRequiredBanner.tsx
    groups/
      GroupCard.tsx
      GroupForm.tsx
      InviteSettingsCard.tsx
      MeetingOwnerCard.tsx
      MembersTable.tsx
    sessions/
      SessionCard.tsx
      SessionForm.tsx
      SessionStatusBanner.tsx
      SessionInfoCard.tsx
      ScheduledSessionCard.tsx
      HostActionsCard.tsx
      SchedulingFailureCard.tsx
    polls/
      PollCard.tsx
      PollOptionInput.tsx
      PollOptionBuilder.tsx
      PollResults.tsx
      VoteForm.tsx
      SuggestionPanel.tsx
      PollEditorPreview.tsx
  lib/
    api-client.ts
    auth.ts
    permissions.ts
    date-time.ts
    labels.ts
    query-keys.ts
    validation.ts
  types/
    api.ts
    domain.ts
```

## 38. Domain Type Definitions

Frontend should define types matching backend responses.

```ts
export type SessionStatus =
  | 'draft'
  | 'interest_check'
  | 'topic_selection'
  | 'availability_collection'
  | 'polling'
  | 'needs_host_decision'
  | 'scheduling'
  | 'scheduled'
  | 'scheduling_failed'
  | 'rescheduling'
  | 'cancelled'
  | 'completed';

export type CalendarInvitePolicy =
  | 'all_members'
  | 'interested_members'
  | 'app_only';

export type PollStatus =
  | 'draft'
  | 'active'
  | 'closed'
  | 'cancelled'
  | 'superseded';

export type PollType =
  | 'interest'
  | 'topic'
  | 'availability'
  | 'final_timing';
```

## 39. Human Label Maps

Create `labels.ts`.

Required maps:

- sessionStatusLabels
- pollStatusLabels
- pollTypeLabels
- calendarInvitePolicyLabels
- calendarInvitePolicyDescriptions
- auditActionLabels

Never render raw enum values directly.

## 40. Permission Helper Functions

Create `permissions.ts`.

Functions:

```ts
canManageGroup(user, groupMembership): boolean
canManageSession(user, session, groupMembership): boolean
canCreatePoll(user, session, groupMembership): boolean
canEditDraftPoll(user, poll, session, groupMembership): boolean
canPublishPoll(user, poll, session, groupMembership): boolean
canVote(user, poll, session, groupMembership): boolean
canSubmitSuggestion(user, poll, session, groupMembership): boolean
canHandleHostDecision(user, session, groupMembership): boolean
canRetryScheduling(user, session, groupMembership): boolean
canViewAuditLog(user, groupMembership): boolean
```

Frontend permissions only control UI display. Backend still enforces real authorization.

## 41. Important State Rendering Matrix

### Session draft

Member:

- View basic details.
- No special actions unless creator.

Host/admin:

- Show create poll CTA.
- Show edit/cancel actions.

### Session polling

Member:

- Show active poll vote form.

Host/admin:

- Show active poll management controls.
- Show close poll button.

### Session needs_host_decision

Member:

- Show message: `Waiting for host to choose final time.`

Host/admin:

- Show ActionRequiredBanner.
- Show choose time/new poll/cancel actions.

### Session scheduling

All:

- Show scheduling spinner banner.
- Disable duplicate schedule actions.

### Session scheduled

All:

- Show scheduled time.
- Show Meet link.

Host/admin:

- Show reschedule/cancel/mark completed.

### Session scheduling_failed

Member:

- Show `Scheduling failed. Waiting for host/admin to fix it.`

Host/admin:

- Show retry/change owner/view error.

### Session cancelled/completed

All:

- Show historical state.
- Disable polls/votes.

## 42. Visual Wireframe Descriptions

### 42.1 Dashboard Desktop

```txt
┌──────────────── Sidebar ────────────────┬──────────────────────── Main ────────────────────────┐
│ TechUp Sessions                          │ Dashboard                         [Create session]   │
│ Dashboard                                │ Sessions, polls, and actions across your groups      │
│ Groups                                   │ ┌───────┐ ┌───────┐ ┌────────┐ ┌───────┐             │
│ My Hosted Sessions                       │ │Upcoming│ │Polls  │ │Needs   │ │Groups │             │
│ Upcoming Sessions                        │ │   3   │ │  4    │ │Action 2│ │  2    │             │
│ Past Sessions                            │ └───────┘ └───────┘ └────────┘ └───────┘             │
│                                          │ ┌──────────── Action required ───────────────┐       │
│ Current group: TechUp                    │ │ Session card needing host decision          │       │
│                                          │ └────────────────────────────────────────────┘       │
│ Admin                                    │ ┌──────────── Upcoming sessions ─────────────┐       │
│ Settings                                 │ │ Session card                                │       │
│ Members                                  │ │ Session card                                │       │
│ Audit Log                                │ └────────────────────────────────────────────┘       │
│                                          │ Right column: My groups / hosted / activity          │
└──────────────────────────────────────────┴──────────────────────────────────────────────────────┘
```

### 42.2 Session Detail Desktop

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ Group > Sessions                                                             │
│ System Design: Monitoring and Logging        [Scheduled]      [Open Meet]    │
│ Learn metrics, logs, alerts, and practical design tradeoffs.                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Status banner: Session scheduled / Polling / Host decision needed            │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Main column                                   │ Right sidebar                 │
│ ┌ Scheduled session card ┐                    │ ┌ Session info ┐              │
│ └────────────────────────┘                    │ └──────────────┘              │
│ ┌ Active poll card ───────────────────────┐   │ ┌ Meeting owner ┐             │
│ │ Final timing poll                        │   │ └───────────────┘             │
│ │ ○ Tue 7 PM                               │   │ ┌ Host actions ┐              │
│ │ ○ Wed 8 PM                               │   │ └──────────────┘              │
│ │ [Submit vote]                            │   │ ┌ Technical details ┐         │
│ └─────────────────────────────────────────┘   │ └───────────────────┘         │
│ ┌ Member suggestions ─────────────────────┐   │                               │
│ └─────────────────────────────────────────┘   │                               │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

### 42.3 Poll Editor Desktop

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ Create poll                                               [Save] [Publish]   │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Poll form                                    │ Live preview                  │
│ Type: Final timing                           │ ┌ Final timing poll ┐          │
│ Voting mode: Single choice                   │ │ ○ Tue 7–8 PM       │          │
│ Deadline: Jun 14 8:00 PM                     │ │ ○ Wed 8–9 PM       │          │
│                                              │ │ Draft preview      │          │
│ Official options                             │ └────────────────────┘          │
│ [Label] [Start] [End] [Delete]               │                               │
│ [Add time option]                            │ Member suggestions             │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## 43. Build Order for Codex

Implement in this order to reduce rework.

1. App shell, routing, auth guard, global layout.
2. API client and TypeScript domain types.
3. Label maps, status badges, time display, empty/error/loading states.
4. Groups list, create group, join group.
5. Group detail, settings, members.
6. Sessions list and create session.
7. Session detail layout without mutations.
8. Poll cards and result rendering.
9. Poll create/edit page with option builder.
10. Vote form and suggestion panel.
11. Host/admin actions: publish, close, cancel, retry, reschedule.
12. Audit log page.
13. Mobile responsive pass.
14. Accessibility and empty/error state pass.

## 44. Acceptance Checklist

The frontend is acceptable when the following are true:

- A user can sign in with Google and land on dashboard.
- A user with no groups sees a clear empty state.
- A user can join a group by invite code.
- A user can create a group.
- An admin can configure invite settings and meeting owner.
- A user can create a session with calendar invitation policy.
- A host can create a draft poll.
- A host can add official poll options.
- Suggestions are visually separate from official options.
- A host cannot publish a poll with zero options.
- A member cannot vote on draft polls.
- A member can vote on active polls.
- Single-choice voting clearly replaces prior selection.
- Multi-choice voting supports multiple options.
- Closed polls show result bars.
- Final timing tie/no-vote shows persistent host decision UI.
- Scheduled sessions show time, timezone, Meet link, meeting owner, and invite policy.
- Scheduling failure shows persistent retry UI for host/admin.
- Cancelled/completed sessions do not expose vote or scheduling actions.
- Mobile layouts are usable and do not require horizontal scrolling.
- Raw enum names are never shown to users.
- Google tokens are never displayed in the UI.

## 45. Non-Goals for MVP Frontend

Do not build these in MVP:

- In-app notification inbox.
- Notification read/unread state.
- Reminder preferences.
- WhatsApp automation UI.
- SMS/email reminder UI.
- Attendance tracking.
- Recurring session UI.
- AI topic recommendation UI.
- Full Google Calendar availability sync.
- Member calendar-reading permission screens.
- Advanced analytics dashboards.

## 46. Final Instruction to Codex

Build the frontend as a state-driven dashboard application. Do not invent new product flows. Do not mix suggestions with voteable options. Do not hide host-required states behind small toasts. Do not expose Google tokens. Do not render backend enum values directly. Every important session state must have a visible page-level banner, and every role must see only the actions they can reasonably perform.

The Session Detail page is the core screen. Implement it carefully before polishing less important pages.
