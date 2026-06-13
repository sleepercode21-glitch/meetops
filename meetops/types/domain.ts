export type UserRole = "admin" | "member";

export type SessionStatus =
  | "draft"
  | "interest_check"
  | "topic_selection"
  | "availability_collection"
  | "polling"
  | "needs_host_decision"
  | "scheduling"
  | "scheduled"
  | "scheduling_failed"
  | "rescheduling"
  | "cancelled"
  | "completed";

export type CalendarInvitePolicy =
  | "all_members"
  | "interested_members"
  | "app_only";

export type PollStatus =
  | "draft"
  | "active"
  | "closed"
  | "cancelled"
  | "superseded";

export type PollType = "interest" | "topic" | "availability" | "final_timing";

export type User = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  avatarInitials: string;
  hasCalendarScope: boolean;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  role: UserRole;
  memberCount: number;
  adminCount: number;
  upcomingSessionCount: number;
  activePollCount: number;
  inviteCode: string;
  inviteEnabled: boolean;
  inviteMaxUses: number;
  inviteUsedCount: number;
  createdAt: string;
  meetingOwnerId?: string;
};

export type PollOption = {
  id: string;
  label: string;
  startAt?: string;
  endAt?: string;
  voteCount: number;
};

export type Poll = {
  id: string;
  sessionId: string;
  type: PollType;
  status: PollStatus;
  multiChoice: boolean;
  deadline?: string;
  options: PollOption[];
  currentUserVoteIds: string[];
  suggestions: Suggestion[];
  acceptsSuggestions: boolean;
  resultsVisible: boolean;
  currentUserCanManage: boolean;
};

export type Suggestion = {
  id: string;
  pollId: string;
  authorName: string;
  text: string;
  createdAt: string;
};

export type Session = {
  id: string;
  groupId: string;
  hostId: string;
  hostName?: string;
  hostTimezone?: string;
  topic?: string;
  description?: string;
  status: SessionStatus;
  calendarInvitePolicy: CalendarInvitePolicy;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  meetLink?: string;
  calendarEventUrl?: string;
  meetingOwnerId?: string;
  meetingOwnerName?: string;
  selectedOptionId?: string;
  schedulingAttemptCount: number;
  lastSchedulingAttemptAt?: string;
  schedulingError?: string;
  currentUserCanManage?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuditEvent = {
  id: string;
  groupId: string;
  action: string;
  actorName: string;
  createdAt: string;
  relatedLabel: string;
  metadata: Record<string, string | number | boolean>;
};
