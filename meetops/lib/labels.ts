import type {
  CalendarInvitePolicy,
  PollStatus,
  PollType,
  SessionStatus,
  UserRole,
} from "@/types/domain";

export const sessionStatusLabels: Record<SessionStatus, string> = {
  draft: "Draft",
  interest_check: "Interest check",
  topic_selection: "Topic selection",
  availability_collection: "Availability",
  polling: "Polling",
  needs_host_decision: "Needs host decision",
  scheduling: "Scheduling",
  scheduled: "Scheduled",
  scheduling_failed: "Scheduling failed",
  rescheduling: "Rescheduling",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const pollStatusLabels: Record<PollStatus, string> = {
  draft: "Draft",
  active: "Active",
  closed: "Closed",
  cancelled: "Cancelled",
  superseded: "Superseded",
};

export const pollTypeLabels: Record<PollType, string> = {
  interest: "Interest poll",
  topic: "Topic poll",
  availability: "Availability poll",
  final_timing: "Final timing poll",
};

export const calendarInvitePolicyLabels: Record<CalendarInvitePolicy, string> = {
  all_members: "Invite all group members",
  interested_members: "Invite interested/attending members",
  app_only: "App link only",
};

export const calendarInvitePolicyDescriptions: Record<
  CalendarInvitePolicy,
  string
> = {
  all_members: "Every active group member is added as a Google Calendar attendee.",
  interested_members:
    "Only members who selected Interested or Attending are added as attendees.",
  app_only: "Create a Meet link but do not add members to Google Calendar.",
};

export const roleLabels: Record<UserRole | "host" | "meeting_owner", string> = {
  owner: "Platform owner",
  admin: "Admin",
  member: "Member",
  host: "Host",
  meeting_owner: "Meeting owner",
};

export const auditActionLabels: Record<string, string> = {
  group_created: "Group created",
  session_created: "Session created",
  poll_published: "Poll published",
  vote_submitted: "Vote submitted",
  scheduling_failed: "Scheduling failed",
  meeting_owner_changed: "Meeting owner changed",
};
