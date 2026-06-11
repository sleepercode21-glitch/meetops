import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Group, Poll, Session, Suggestion, User, UserRole } from "@/types/domain";

type ApiEnvelope<T> = { data: T };
type ApiListEnvelope<T> = { data: T[]; page: { limit: number; offset: number; total: number } };
type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor({
    status,
    code,
    message,
    details = {},
  }: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type ApiMe = {
  user_id: number;
  email: string;
  firstname: string | null;
  lastname: string | null;
  profile_photo: string | null;
  timezone: string;
};

export type ApiGoogleStatus = {
  provider: "google";
  connected: boolean;
  calendar_events_scope_granted: boolean;
  access_token_expires_at: string | null;
};

export type ApiGroupSummary = {
  group_id: number;
  name: string;
  description: string | null;
  is_admin: boolean;
  member_count: number;
  default_meeting_owner: number | null;
  created_at: string;
};

export type ApiGroupDetail = {
  group_id: number;
  name: string;
  description: string | null;
  invite_code?: string | null;
  invite_enabled: boolean;
  invite_max_uses: number;
  invite_used_count: number;
  invite_code_expires_at: string | null;
  default_meeting_owner: {
    user_id: number;
    email: string;
    firstname: string | null;
    lastname: string | null;
    calendar_connected: boolean;
    calendar_events_scope_granted: boolean;
  } | null;
  current_user_membership: {
    is_admin: boolean;
    joined_at: string;
  };
};

export type ApiMember = {
  user_id: number;
  email: string;
  firstname: string | null;
  lastname: string | null;
  profile_photo: string | null;
  joined_at: string;
  is_admin: boolean;
  calendar_connected: boolean;
  calendar_events_scope_granted: boolean;
};

export type ApiSessionSummary = {
  session_id: number;
  group_id: number;
  topic: string | null;
  description: string | null;
  status: Session["status"];
  calendar_invite_policy: Session["calendarInvitePolicy"];
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  meet_link: string | null;
  host: {
    user_id: number;
    email: string;
    firstname: string | null;
    lastname: string | null;
  };
  current_user_can_manage: boolean;
  created_at: string;
};

export type ApiPollOption = {
  option_id: number;
  poll_id: number;
  label: string;
  start_at: string | null;
  end_at: string | null;
  vote_count: number | null;
  created_at?: string;
  updated_at?: string;
};

export type ApiSuggestion = {
  suggestion_id: number;
  poll_id: number;
  suggestion: string;
  suggested_by:
    | number
    | {
        user_id: number;
        firstname: string | null;
        lastname: string | null;
      };
  created_at: string;
};

export type ApiPoll = {
  poll_id: number;
  session_id: number;
  type: Poll["type"];
  status: Poll["status"];
  multi_choice: boolean;
  deadline: string | null;
  current_user_votes: (number | null)[];
  results_visible?: boolean;
  options: ApiPollOption[];
  suggestions?: ApiSuggestion[];
  current_user_can_manage?: boolean;
};

export type ApiAuditLog = {
  audit_log_id: number;
  user_id: number | null;
  group_id: number | null;
  session_id: number | null;
  poll_id: number | null;
  action: string;
  metadata: unknown;
  created_at: string;
};

export type ApiSessionDetail = ApiSessionSummary & {
  calendar_event_id: string | null;
  google_calendar_id: string;
  selected_option_id: number | null;
  scheduling_error: string | null;
  scheduling_attempt_count: number;
  last_scheduling_attempt_at: string | null;
  meeting_owner: {
    user_id: number;
    email: string;
    firstname: string | null;
    lastname: string | null;
  } | null;
  polls: {
    poll_id: number;
    type: Poll["type"];
    status: Poll["status"];
    deadline: string | null;
  }[];
  updated_at: string;
};

export async function apiGet<T>(path: string) {
  const cookieStore = await cookies();
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    headers: {
      cookie: cookieStore.toString(),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/");
  }

  if (!response.ok) {
    throw await apiRequestError(response, path);
  }

  return (await response.json()) as ApiEnvelope<T>;
}

export async function apiList<T>(path: string) {
  const cookieStore = await cookies();
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    headers: {
      cookie: cookieStore.toString(),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/");
  }

  if (!response.ok) {
    throw await apiRequestError(response, path);
  }

  return (await response.json()) as ApiListEnvelope<T>;
}

export async function getCurrentUser() {
  const [{ data: me }, { data: google }] = await Promise.all([
    apiGet<ApiMe>("/api/v1/me"),
    apiGet<ApiGoogleStatus>("/api/v1/me/oauth/google/status"),
  ]);

  return toUser(me, google);
}

export async function getGroups() {
  const { data } = await apiGet<ApiGroupSummary[]>("/api/v1/groups");
  return data.map(toGroup);
}

export async function getGroupDetail(groupId: string) {
  const { data } = await apiGet<ApiGroupDetail>(`/api/v1/groups/${groupId}`);
  return data;
}

export async function getGroupMembers(groupId: string) {
  const { data, page } = await apiList<ApiMember>(
    `/api/v1/groups/${groupId}/members?limit=100&offset=0&role=all`,
  );
  return { members: data, page };
}

export async function getGroupSessions(groupId: string) {
  const { data, page } = await apiList<ApiSessionSummary>(
    `/api/v1/groups/${groupId}/sessions?limit=50&offset=0&status=all`,
  );
  return { sessions: data.map(toSession), page };
}

export async function getGroupSessionsByStatus(
  groupId: string,
  status: Session["status"] | "all",
) {
  const { data, page } = await apiList<ApiSessionSummary>(
    `/api/v1/groups/${groupId}/sessions?limit=50&offset=0&status=${status}`,
  );
  return { sessions: data.map(toSession), page };
}

export async function getUpcomingGroupSessions(groupId: string) {
  const { data, page } = await apiList<ApiSessionSummary>(
    `/api/v1/groups/${groupId}/sessions?limit=50&offset=0&status=all&upcoming=true`,
  );
  return { sessions: data.map(toSession), page };
}

export async function getAllUserSessions() {
  const groups = await getGroups();
  const sessionLists = await Promise.all(
    groups.map(async (group) => {
      const { sessions } = await getGroupSessions(group.id);
      return sessions;
    }),
  );
  return sessionLists.flat();
}

export async function getSessionDetail(sessionId: string) {
  const { data } = await apiGet<ApiSessionDetail>(`/api/v1/sessions/${sessionId}`);
  return toSession(data);
}

export async function getSessionPolls(sessionId: string) {
  const { data } = await apiGet<ApiPoll[]>(`/api/v1/sessions/${sessionId}/polls`);
  return data.map(toPoll);
}

export async function getPollDetail(pollId: string) {
  const { data } = await apiGet<ApiPoll>(`/api/v1/polls/${pollId}`);
  return toPoll(data);
}

export async function getGroupAuditLogs(groupId: string) {
  const { data, page } = await apiList<ApiAuditLog>(
    `/api/v1/groups/${groupId}/audit-logs?limit=100&offset=0`,
  );
  return { logs: data, page };
}

export function toUser(me: ApiMe, google: ApiGoogleStatus): User {
  const name = [me.firstname, me.lastname].filter(Boolean).join(" ") || me.email;
  return {
    id: String(me.user_id),
    name,
    email: me.email,
    timezone: me.timezone,
    avatarInitials: initials(name),
    hasCalendarScope: google.calendar_events_scope_granted,
  };
}

export function toGroup(group: ApiGroupSummary): Group {
  return {
    id: String(group.group_id),
    name: group.name,
    description: group.description ?? "",
    role: group.is_admin ? "admin" : "member",
    memberCount: group.member_count,
    adminCount: group.is_admin ? 1 : 0,
    upcomingSessionCount: 0,
    activePollCount: 0,
    inviteCode: "",
    inviteEnabled: true,
    inviteMaxUses: 0,
    inviteUsedCount: 0,
    createdAt: group.created_at,
    meetingOwnerId: group.default_meeting_owner
      ? String(group.default_meeting_owner)
      : undefined,
  };
}

export function groupRole(isAdmin: boolean): UserRole {
  return isAdmin ? "admin" : "member";
}

export function toSession(session: ApiSessionSummary): Session {
  const detail = isApiSessionDetail(session) ? session : null;
  const hostName = [session.host.firstname, session.host.lastname]
    .filter(Boolean)
    .join(" ") || session.host.email;
  return {
    id: String(session.session_id),
    groupId: String(session.group_id),
    hostId: String(session.host.user_id),
    hostName,
    topic: session.topic ?? undefined,
    description: session.description ?? undefined,
    status: session.status,
    calendarInvitePolicy: session.calendar_invite_policy,
    scheduledStartTime: session.scheduled_start_time ?? undefined,
    scheduledEndTime: session.scheduled_end_time ?? undefined,
    meetLink: session.meet_link ?? undefined,
    currentUserCanManage: session.current_user_can_manage,
    selectedOptionId: detail?.selected_option_id
      ? String(detail.selected_option_id)
      : undefined,
    schedulingAttemptCount: 0,
    schedulingError: detail?.scheduling_error ?? undefined,
    lastSchedulingAttemptAt: detail?.last_scheduling_attempt_at ?? undefined,
    createdAt: session.created_at,
    updatedAt: detail?.updated_at ?? session.created_at,
  };
}

function isApiSessionDetail(session: ApiSessionSummary): session is ApiSessionDetail {
  return "updated_at" in session;
}

export function toPoll(poll: ApiPoll): Poll {
  return {
    id: String(poll.poll_id),
    sessionId: String(poll.session_id),
    type: poll.type,
    status: poll.status,
    multiChoice: poll.multi_choice,
    deadline: poll.deadline ?? undefined,
    currentUserVoteIds: poll.current_user_votes
      .filter((id): id is number => id !== null)
      .map(String),
    acceptsSuggestions: poll.status === "draft" || poll.status === "active",
    resultsVisible: Boolean(poll.results_visible),
    currentUserCanManage: Boolean(poll.current_user_can_manage),
    suggestions: (poll.suggestions ?? []).map(toSuggestion),
    options: poll.options.map((option) => ({
      id: String(option.option_id),
      label: option.label,
      startAt: option.start_at ?? undefined,
      endAt: option.end_at ?? undefined,
      voteCount: option.vote_count ?? 0,
    })),
  };
}

export function toSuggestion(suggestion: ApiSuggestion): Suggestion {
  const author =
    typeof suggestion.suggested_by === "number"
      ? "Member"
      : [suggestion.suggested_by.firstname, suggestion.suggested_by.lastname]
          .filter(Boolean)
          .join(" ") || "Member";
  return {
    id: String(suggestion.suggestion_id),
    pollId: String(suggestion.poll_id),
    authorName: author,
    text: suggestion.suggestion,
    createdAt: suggestion.created_at,
  };
}

function apiBaseUrl() {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "");
}

async function apiRequestError(response: Response, path: string) {
  const body = (await response.json().catch(() => ({}))) as ApiErrorEnvelope;
  return new ApiRequestError({
    status: response.status,
    code: body.error?.code ?? "REQUEST_FAILED",
    message:
      body.error?.message ??
      `API request failed: ${path} (${response.status})`,
    details: body.error?.details,
  });
}
