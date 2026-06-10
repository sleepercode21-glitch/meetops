import type {
  Group,
  Member,
  OAuthAccount,
  Poll,
  Session,
  User,
} from "@prisma/client";

export function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function toId(value: bigint | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export function calendarScopeGranted(account: Pick<OAuthAccount, "scope"> | null) {
  return Boolean(
    account?.scope
      ?.split(/\s+/)
      .includes("https://www.googleapis.com/auth/calendar.events"),
  );
}

export function publicUser(
  user: Pick<
    User,
    | "userId"
    | "email"
    | "firstname"
    | "lastname"
    | "profilePhoto"
    | "timezone"
    | "joinedAt"
    | "updatedAt"
  >,
) {
  return {
    user_id: toId(user.userId),
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    profile_photo: user.profilePhoto,
    timezone: user.timezone,
    joined_at: user.joinedAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}

export function groupSummary(
  group: Pick<
    Group,
    | "groupId"
    | "name"
    | "description"
    | "defaultMeetingOwner"
    | "createdAt"
  > & {
    members?: unknown[];
    _count?: { members: number };
  },
  membership: Pick<Member, "isAdmin">,
) {
  return {
    group_id: toId(group.groupId),
    name: group.name,
    description: group.description,
    is_admin: membership.isAdmin,
    member_count: group._count?.members ?? group.members?.length ?? 0,
    default_meeting_owner: toId(group.defaultMeetingOwner),
    created_at: group.createdAt.toISOString(),
  };
}

type SessionUser = Pick<User, "userId" | "email" | "firstname" | "lastname">;

export function sessionHost(user: SessionUser) {
  return {
    user_id: toId(user.userId),
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
  };
}

export function sessionSummary(
  session: Pick<
    Session,
    | "sessionId"
    | "groupId"
    | "topic"
    | "description"
    | "status"
    | "calendarInvitePolicy"
    | "scheduledStartTime"
    | "scheduledEndTime"
    | "meetLink"
    | "hostId"
    | "createdAt"
  > & { host: SessionUser },
  currentUserCanManage: boolean,
) {
  return {
    session_id: toId(session.sessionId),
    group_id: toId(session.groupId),
    topic: session.topic,
    description: session.description,
    status: session.status,
    calendar_invite_policy: session.calendarInvitePolicy,
    scheduled_start_time: toIso(session.scheduledStartTime),
    scheduled_end_time: toIso(session.scheduledEndTime),
    meet_link: session.meetLink,
    host: sessionHost(session.host),
    current_user_can_manage: currentUserCanManage,
    created_at: session.createdAt.toISOString(),
  };
}

export function sessionDetail(
  session: Pick<
    Session,
    | "sessionId"
    | "groupId"
    | "topic"
    | "description"
    | "status"
    | "calendarInvitePolicy"
    | "scheduledStartTime"
    | "scheduledEndTime"
    | "meetLink"
    | "calendarEventId"
    | "googleCalendarId"
    | "selectedOptionId"
    | "schedulingError"
    | "schedulingAttemptCount"
    | "lastSchedulingAttemptAt"
    | "hostId"
    | "meetingOwnerId"
    | "createdAt"
    | "updatedAt"
  > & {
    host: SessionUser;
    meetingOwner: SessionUser | null;
    polls: Pick<Poll, "pollId" | "type" | "status" | "deadline">[];
  },
  currentUserCanManage: boolean,
) {
  return {
    session_id: toId(session.sessionId),
    group_id: toId(session.groupId),
    topic: session.topic,
    description: session.description,
    status: session.status,
    calendar_invite_policy: session.calendarInvitePolicy,
    scheduled_start_time: toIso(session.scheduledStartTime),
    scheduled_end_time: toIso(session.scheduledEndTime),
    meet_link: session.meetLink,
    calendar_event_id: session.calendarEventId,
    google_calendar_id: session.googleCalendarId,
    selected_option_id: toId(session.selectedOptionId),
    scheduling_error: session.schedulingError,
    scheduling_attempt_count: session.schedulingAttemptCount,
    last_scheduling_attempt_at: toIso(session.lastSchedulingAttemptAt),
    host: sessionHost(session.host),
    meeting_owner: session.meetingOwner ? sessionHost(session.meetingOwner) : null,
    current_user_can_manage: currentUserCanManage,
    polls: session.polls.map((poll) => ({
      poll_id: toId(poll.pollId),
      type: poll.type,
      status: poll.status,
      deadline: toIso(poll.deadline),
    })),
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
  };
}
