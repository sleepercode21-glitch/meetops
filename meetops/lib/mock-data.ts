import type {
  AuditEvent,
  Group,
  Poll,
  Session,
  Suggestion,
  User,
} from "@/types/domain";

export const currentUser: User = {
  id: "u1",
  name: "Avery Stone",
  email: "avery@techup.dev",
  timezone: "America/Phoenix",
  avatarInitials: "AS",
  hasCalendarScope: true,
};

export const users: User[] = [
  currentUser,
  {
    id: "u2",
    name: "Mina Park",
    email: "mina@techup.dev",
    timezone: "America/Los_Angeles",
    avatarInitials: "MP",
    hasCalendarScope: true,
  },
  {
    id: "u3",
    name: "Diego Ramos",
    email: "diego@techup.dev",
    timezone: "America/Chicago",
    avatarInitials: "DR",
    hasCalendarScope: false,
  },
];

export const groups: Group[] = [
  {
    id: "g1",
    name: "TechUp Programmers",
    description: "Private developer community for backend, frontend, and systems sessions.",
    role: "admin",
    memberCount: 38,
    adminCount: 3,
    upcomingSessionCount: 2,
    activePollCount: 2,
    inviteCode: "TECHUP-2026",
    inviteEnabled: true,
    inviteMaxUses: 50,
    inviteUsedCount: 12,
    createdAt: "2026-05-12T17:30:00.000Z",
    meetingOwnerId: "u2",
  },
  {
    id: "g2",
    name: "Low Level Club",
    description: "A smaller group for operating systems, compilers, and networking study.",
    role: "member",
    memberCount: 14,
    adminCount: 1,
    upcomingSessionCount: 1,
    activePollCount: 1,
    inviteCode: "LOWLEVEL",
    inviteEnabled: true,
    inviteMaxUses: 25,
    inviteUsedCount: 9,
    createdAt: "2026-04-28T15:00:00.000Z",
    meetingOwnerId: "u1",
  },
];

export const sessions: Session[] = [
  {
    id: "s1",
    groupId: "g1",
    hostId: "u1",
    topic: "System Design: Monitoring and Logging",
    description: "Learn metrics, logs, alerts, and practical observability tradeoffs.",
    status: "scheduled",
    calendarInvitePolicy: "interested_members",
    scheduledStartTime: "2026-06-16T02:00:00.000Z",
    scheduledEndTime: "2026-06-16T03:30:00.000Z",
    meetLink: "https://meet.google.com/abc-defg-hij",
    calendarEventUrl: "https://calendar.google.com/calendar/event?eid=demo",
    meetingOwnerId: "u2",
    selectedOptionId: "po1",
    schedulingAttemptCount: 1,
    lastSchedulingAttemptAt: "2026-06-08T19:15:00.000Z",
    createdAt: "2026-06-02T18:00:00.000Z",
    updatedAt: "2026-06-08T19:15:00.000Z",
  },
  {
    id: "s2",
    groupId: "g1",
    hostId: "u1",
    topic: "Frontend State Machines",
    description: "Collecting final timing votes for a practical state modeling workshop.",
    status: "polling",
    calendarInvitePolicy: "app_only",
    meetingOwnerId: "u2",
    schedulingAttemptCount: 0,
    createdAt: "2026-06-04T16:00:00.000Z",
    updatedAt: "2026-06-07T20:30:00.000Z",
  },
  {
    id: "s3",
    groupId: "g1",
    hostId: "u3",
    topic: "Postgres Indexing Clinic",
    description: "The final timing poll tied. A host or admin needs to choose the winning time.",
    status: "needs_host_decision",
    calendarInvitePolicy: "all_members",
    meetingOwnerId: "u2",
    schedulingAttemptCount: 0,
    createdAt: "2026-06-01T18:00:00.000Z",
    updatedAt: "2026-06-08T18:00:00.000Z",
  },
  {
    id: "s4",
    groupId: "g2",
    hostId: "u1",
    topic: "TCP From First Principles",
    description: "A low-level session on reliable transport, congestion, and packet traces.",
    status: "scheduling_failed",
    calendarInvitePolicy: "app_only",
    meetingOwnerId: "u3",
    selectedOptionId: "po7",
    schedulingAttemptCount: 2,
    lastSchedulingAttemptAt: "2026-06-08T22:00:00.000Z",
    schedulingError: "Google Calendar permission missing for selected meeting owner.",
    createdAt: "2026-05-30T18:00:00.000Z",
    updatedAt: "2026-06-08T22:00:00.000Z",
  },
  {
    id: "s5",
    groupId: "g1",
    hostId: "u1",
    topic: undefined,
    description: "The host is collecting topic suggestions before publishing a poll.",
    status: "draft",
    calendarInvitePolicy: "app_only",
    schedulingAttemptCount: 0,
    createdAt: "2026-06-09T15:00:00.000Z",
    updatedAt: "2026-06-09T15:00:00.000Z",
  },
];

export const polls: Poll[] = [
  {
    id: "p1",
    sessionId: "s1",
    type: "final_timing",
    status: "closed",
    multiChoice: false,
    deadline: "2026-06-08T18:00:00.000Z",
    currentUserVoteIds: ["po1"],
    acceptsSuggestions: false,
    options: [
      {
        id: "po1",
        label: "Tuesday evening",
        startAt: "2026-06-16T02:00:00.000Z",
        endAt: "2026-06-16T03:30:00.000Z",
        voteCount: 11,
      },
      {
        id: "po2",
        label: "Wednesday evening",
        startAt: "2026-06-17T02:00:00.000Z",
        endAt: "2026-06-17T03:30:00.000Z",
        voteCount: 7,
      },
    ],
  },
  {
    id: "p2",
    sessionId: "s2",
    type: "final_timing",
    status: "active",
    multiChoice: false,
    deadline: "2026-06-12T03:00:00.000Z",
    currentUserVoteIds: [],
    acceptsSuggestions: true,
    options: [
      {
        id: "po3",
        label: "Thursday evening",
        startAt: "2026-06-19T02:00:00.000Z",
        endAt: "2026-06-19T03:00:00.000Z",
        voteCount: 4,
      },
      {
        id: "po4",
        label: "Saturday morning",
        startAt: "2026-06-20T16:00:00.000Z",
        endAt: "2026-06-20T17:00:00.000Z",
        voteCount: 3,
      },
    ],
  },
  {
    id: "p3",
    sessionId: "s3",
    type: "final_timing",
    status: "closed",
    multiChoice: false,
    deadline: "2026-06-08T17:00:00.000Z",
    currentUserVoteIds: ["po5"],
    acceptsSuggestions: false,
    options: [
      {
        id: "po5",
        label: "Monday evening",
        startAt: "2026-06-23T02:00:00.000Z",
        endAt: "2026-06-23T03:00:00.000Z",
        voteCount: 6,
      },
      {
        id: "po6",
        label: "Tuesday evening",
        startAt: "2026-06-24T02:00:00.000Z",
        endAt: "2026-06-24T03:00:00.000Z",
        voteCount: 6,
      },
    ],
  },
  {
    id: "p4",
    sessionId: "s4",
    type: "final_timing",
    status: "closed",
    multiChoice: false,
    deadline: "2026-06-08T21:00:00.000Z",
    currentUserVoteIds: ["po7"],
    acceptsSuggestions: false,
    options: [
      {
        id: "po7",
        label: "Friday deep dive",
        startAt: "2026-06-13T01:00:00.000Z",
        endAt: "2026-06-13T02:30:00.000Z",
        voteCount: 8,
      },
    ],
  },
  {
    id: "p5",
    sessionId: "s5",
    type: "topic",
    status: "draft",
    multiChoice: false,
    deadline: "2026-06-15T03:00:00.000Z",
    currentUserVoteIds: [],
    acceptsSuggestions: true,
    options: [],
  },
];

export const suggestions: Suggestion[] = [
  {
    id: "sg1",
    pollId: "p2",
    authorName: "Mina Park",
    text: "Add one lunchtime option for folks in Eastern time.",
    createdAt: "2026-06-08T17:30:00.000Z",
  },
  {
    id: "sg2",
    pollId: "p5",
    authorName: "Diego Ramos",
    text: "Distributed tracing basics",
    createdAt: "2026-06-09T16:00:00.000Z",
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "a1",
    groupId: "g1",
    action: "session_created",
    actorName: "Avery Stone",
    relatedLabel: "Frontend State Machines",
    createdAt: "2026-06-04T16:00:00.000Z",
    metadata: { session_id: "s2", status: "draft" },
  },
  {
    id: "a2",
    groupId: "g1",
    action: "poll_published",
    actorName: "Avery Stone",
    relatedLabel: "Final timing poll",
    createdAt: "2026-06-07T20:30:00.000Z",
    metadata: { poll_id: "p2", option_count: 2 },
  },
  {
    id: "a3",
    groupId: "g1",
    action: "meeting_owner_changed",
    actorName: "Mina Park",
    relatedLabel: "TechUp Programmers",
    createdAt: "2026-06-03T18:30:00.000Z",
    metadata: { meeting_owner_id: "u2" },
  },
];

export function getGroup(groupId: string) {
  return groups.find((group) => group.id === groupId);
}

export function getSession(sessionId: string) {
  return sessions.find((session) => session.id === sessionId);
}

export function getUser(userId?: string) {
  return users.find((user) => user.id === userId);
}

export function getPoll(pollId: string) {
  return polls.find((poll) => poll.id === pollId);
}

export function getSessionPolls(sessionId: string) {
  return polls.filter((poll) => poll.sessionId === sessionId);
}

export function getPollSuggestions(pollId: string) {
  return suggestions.filter((suggestion) => suggestion.pollId === pollId);
}

export function getGroupSessions(groupId: string) {
  return sessions.filter((session) => session.groupId === groupId);
}
