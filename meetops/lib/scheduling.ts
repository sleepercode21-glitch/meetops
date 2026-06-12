import crypto from "node:crypto";
import type { PollOption, Session } from "@prisma/client";
import { calendarScopeGranted, toId, toIso } from "@/lib/api/formatters";
import { prisma } from "@/lib/prisma";

type SchedulingSource =
  | "final_timing_poll_closed"
  | "manual_host_selection"
  | "retry"
  | "reschedule";

type ScheduleSessionInput = {
  sessionId: bigint;
  source: SchedulingSource;
  pollId?: bigint;
  selectedOptionId?: bigint | null;
  explicitStartAt?: Date | null;
  explicitEndAt?: Date | null;
  explicitLabel?: string | null;
  actorUserId?: bigint | null;
};

type CancelCalendarEventInput = {
  sessionId: bigint;
  actorUserId?: bigint | null;
  reason?: string | null;
};

type CalendarEventResponse = {
  id?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

type ReadyTiming = {
  outcome: "ready";
  selectedOptionId: bigint | null;
  startAt: Date;
  endAt: Date;
  label?: string | null;
};

type ScheduleServiceResult =
  | { outcome: "needs_host_decision"; reason: "tie" | "no_votes"; tied_option_ids: (number | null)[]; poll_id: number | null }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; code: string; message: string }
  | {
      outcome: "scheduled";
      session_id: number | null;
      status: string;
      selected_option_id: number | null;
      scheduled_start_time: string | null;
      scheduled_end_time: string | null;
      meeting_owner: number | null;
      calendar_event_id: string | null;
      meet_link: string | null;
};

type ResolveTimingResult = ReadyTiming | Exclude<ScheduleServiceResult, { outcome: "scheduled"; session_id: number | null; status: string; selected_option_id: number | null; scheduled_start_time: string | null; scheduled_end_time: string | null; meeting_owner: number | null; calendar_event_id: string | null; meet_link: string | null }>;

export async function scheduleSession(input: ScheduleSessionInput): Promise<ScheduleServiceResult> {
  const resolved = input.pollId
    ? await resolveFinalTimingWinner(input.sessionId, input.pollId)
    : await resolveManualTiming(input);

  if (resolved.outcome !== "ready") {
    return resolved;
  }

  const owner = await selectMeetingOwner(input.sessionId);
  if (owner.outcome !== "ready") {
    return failScheduling(input, owner.code, owner.message, owner.meetingOwner);
  }

  const claimed = await prisma.session.updateMany({
    where: {
      sessionId: input.sessionId,
      status: {
        in: [
          "draft",
          "polling",
          "needs_host_decision",
          "rescheduling",
          "scheduling_failed",
        ],
      },
    },
    data: {
      status: "scheduling",
      meetingOwnerId: owner.meetingOwner,
      selectedOptionId: resolved.selectedOptionId,
      scheduledStartTime: resolved.startAt,
      scheduledEndTime: resolved.endAt,
      schedulingAttemptCount: { increment: 1 },
      lastSchedulingAttemptAt: new Date(),
      schedulingError: null,
    },
  });

  if (claimed.count !== 1) {
    return { outcome: "skipped", reason: "invalid_session_status" };
  }

  try {
    const session = await prisma.session.findUniqueOrThrow({
      where: { sessionId: input.sessionId },
      include: { group: true },
    });
    const attendees = await selectCalendarAttendees(session);
    const event = await upsertCalendarEvent({
      accessToken: owner.accessToken,
      calendarId: session.googleCalendarId,
      eventId: session.calendarEventId,
      summary: `TechUp Session: ${session.topic ?? resolved.label ?? "Session"}`,
      description: session.description ?? "",
      startAt: resolved.startAt,
      endAt: resolved.endAt,
      attendeeEmails: attendees,
      sendUpdates: session.calendarInvitePolicy !== "app_only",
      requestId: `session-${session.sessionId}-${crypto.randomUUID()}`,
    });

    const meetLink = extractMeetLink(event);
    if (!event.id || !meetLink) {
      return failScheduling(
        input,
        "GOOGLE_MEET_LINK_MISSING",
        "Google Calendar did not return a Meet link.",
        owner.meetingOwner,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const scheduled = await tx.session.update({
        where: { sessionId: input.sessionId },
        data: {
          status: "scheduled",
          meetingOwnerId: owner.meetingOwner,
          selectedOptionId: resolved.selectedOptionId,
          scheduledStartTime: resolved.startAt,
          scheduledEndTime: resolved.endAt,
          calendarEventId: event.id,
          googleCalendarId: session.googleCalendarId,
          meetLink,
          schedulingError: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: input.actorUserId,
          groupId: session.groupId,
          sessionId: input.sessionId,
          pollId: input.pollId,
          action: session.calendarEventId
            ? "calendar_event_updated"
            : "calendar_event_created",
          metadata: { source: input.source, attendee_count: attendees.length },
        },
      });
      if (attendees.length > 0) {
        await tx.auditLog.create({
          data: {
            userId: input.actorUserId,
            groupId: session.groupId,
            sessionId: input.sessionId,
            pollId: input.pollId,
            action: "calendar_attendees_updated",
            metadata: { attendee_count: attendees.length },
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: input.actorUserId,
          groupId: session.groupId,
          sessionId: input.sessionId,
          pollId: input.pollId,
          action: "session_scheduled",
          metadata: {
            source: input.source,
            selected_option_id: toId(resolved.selectedOptionId),
          },
        },
      });

      return scheduled;
    });

    return {
      outcome: "scheduled",
      session_id: toId(updated.sessionId),
      status: updated.status,
      selected_option_id: toId(updated.selectedOptionId),
      scheduled_start_time: toIso(updated.scheduledStartTime),
      scheduled_end_time: toIso(updated.scheduledEndTime),
      meeting_owner: toId(updated.meetingOwnerId),
      calendar_event_id: updated.calendarEventId,
      meet_link: updated.meetLink,
    };
  } catch (error) {
    return failScheduling(
      input,
      "GOOGLE_CALENDAR_CREATE_FAILED",
      error instanceof Error ? error.message : "Google Calendar failed.",
      owner.meetingOwner,
    );
  }
}

export async function cancelCalendarEventForSession(input: CancelCalendarEventInput): Promise<
  | { outcome: "cancelled"; calendar_event_id: string }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; message: string }
> {
  const session = await prisma.session.findUniqueOrThrow({
    where: { sessionId: input.sessionId },
    include: { group: true },
  });

  if (!session.calendarEventId) {
    return { outcome: "skipped", reason: "no_calendar_event" };
  }

  const meetingOwner = session.meetingOwnerId ?? session.group.defaultMeetingOwner ?? session.hostId;
  const account = await prisma.oAuthAccount.findUnique({
    where: { userId_provider: { userId: meetingOwner, provider: "google" } },
  });

  if (!account?.accessToken || !calendarScopeGranted(account)) {
    return { outcome: "failed", message: "The meeting owner must reconnect Google Calendar before cancelling the calendar event." };
  }

  let accessToken = account.accessToken;
  if (account.accessTokenExpiresAt && account.accessTokenExpiresAt.getTime() < Date.now() + 60_000) {
    const refreshed = await refreshGoogleToken(account.refreshToken);
    if (!refreshed) {
      return { outcome: "failed", message: "The meeting owner must reconnect Google Calendar before cancelling the calendar event." };
    }
    await prisma.oAuthAccount.update({
      where: { oauthAccountId: account.oauthAccountId },
      data: {
        accessToken: refreshed.accessToken,
        accessTokenExpiresAt: refreshed.expiresAt,
      },
    });
    accessToken = refreshed.accessToken;
  }

  const response = await deleteCalendarEvent({
    accessToken,
    calendarId: session.googleCalendarId,
    eventId: session.calendarEventId,
    sendUpdates: session.calendarInvitePolicy !== "app_only",
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    return { outcome: "failed", message: `Google Calendar returned ${response.status} while cancelling the event.` };
  }

  await prisma.auditLog.create({
    data: {
      userId: input.actorUserId,
      groupId: session.groupId,
      sessionId: input.sessionId,
      action: "calendar_event_cancelled",
      metadata: {
        reason: input.reason,
        calendar_event_id: session.calendarEventId,
        meeting_owner: toId(meetingOwner),
        already_missing: response.status === 404 || response.status === 410,
      },
    },
  });

  return { outcome: "cancelled", calendar_event_id: session.calendarEventId };
}

async function resolveFinalTimingWinner(sessionId: bigint, pollId: bigint): Promise<ResolveTimingResult> {
  const poll = await prisma.poll.findUniqueOrThrow({
    where: { pollId },
    include: {
      options: {
        include: { _count: { select: { votes: true } } },
        orderBy: { optionId: "asc" },
      },
    },
  });

  if (poll.type !== "final_timing" || poll.sessionId !== sessionId) {
    return { outcome: "skipped", reason: "invalid_session_status" };
  }
  if (!poll.options.length) {
    return failDecision(sessionId, pollId, "no_votes", []);
  }

  const maxVotes = Math.max(...poll.options.map((option) => option._count.votes));
  if (maxVotes === 0) {
    return failDecision(sessionId, pollId, "no_votes", []);
  }

  const winners = poll.options.filter((option) => option._count.votes === maxVotes);
  if (winners.length > 1) {
    return failDecision(sessionId, pollId, "tie", winners.map((winner) => winner.optionId));
  }

  const winner = winners[0];
  if (!winner.startAt || !winner.endAt) {
    return { outcome: "failed", code: "INVALID_POLL_OPTION", message: "Winning option is missing start or end time." };
  }

  return {
    outcome: "ready",
    selectedOptionId: winner.optionId,
    startAt: winner.startAt,
    endAt: winner.endAt,
    label: winner.label,
  };
}

async function failDecision(
  sessionId: bigint,
  pollId: bigint,
  reason: "tie" | "no_votes",
  tiedOptionIds: bigint[],
): Promise<Extract<ScheduleServiceResult, { outcome: "needs_host_decision" }>> {
  await prisma.session.update({
    where: { sessionId },
    data: { status: "needs_host_decision" },
  });
  return {
    outcome: "needs_host_decision",
    reason,
    tied_option_ids: tiedOptionIds.map(toId),
    poll_id: toId(pollId),
  };
}

async function resolveManualTiming(input: ScheduleSessionInput): Promise<ReadyTiming | { outcome: "failed"; code: string; message: string }> {
  if (input.selectedOptionId) {
    const option = await prisma.pollOption.findUniqueOrThrow({
      where: { optionId: input.selectedOptionId },
      include: { poll: true },
    });
    if (option.poll.sessionId !== input.sessionId || option.poll.type !== "final_timing") {
      return { outcome: "failed", code: "INVALID_POLL_OPTION", message: "Selected option does not belong to this final timing session." };
    }
    if (!option.startAt || !option.endAt) {
      return { outcome: "failed", code: "INVALID_POLL_OPTION", message: "Selected option is missing start or end time." };
    }
    return readyFromOption(option);
  }

  if (!input.explicitStartAt || !input.explicitEndAt || input.explicitEndAt <= input.explicitStartAt) {
    return { outcome: "failed", code: "VALIDATION_ERROR", message: "A valid start_at and end_at are required." };
  }

  return {
    outcome: "ready",
    selectedOptionId: null,
    startAt: input.explicitStartAt,
    endAt: input.explicitEndAt,
    label: input.explicitLabel,
  };
}

function readyFromOption(option: PollOption): ReadyTiming {
  return {
    outcome: "ready",
    selectedOptionId: option.optionId,
    startAt: option.startAt as Date,
    endAt: option.endAt as Date,
    label: option.label,
  };
}

async function selectMeetingOwner(sessionId: bigint): Promise<
  | { outcome: "ready"; meetingOwner: bigint; accessToken: string }
  | { outcome: "failed"; code: string; message: string; meetingOwner: bigint }
> {
  const session = await prisma.session.findUniqueOrThrow({
    where: { sessionId },
    include: { group: true },
  });
  const meetingOwner = session.meetingOwnerId ?? session.group.defaultMeetingOwner ?? session.hostId;
  const member = await prisma.member.findUnique({
    where: { groupId_userId: { groupId: session.groupId, userId: meetingOwner } },
  });
  if (!member) {
    return { outcome: "failed", code: "NO_VALID_MEETING_OWNER", message: "Meeting owner is not a group member.", meetingOwner };
  }
  const account = await prisma.oAuthAccount.findUnique({
    where: { userId_provider: { userId: meetingOwner, provider: "google" } },
  });
  if (!account?.accessToken) {
    return { outcome: "failed", code: "GOOGLE_TOKEN_MISSING", message: "The selected meeting owner must connect Google Calendar.", meetingOwner };
  }
  if (!calendarScopeGranted(account)) {
    return { outcome: "failed", code: "NO_VALID_MEETING_OWNER", message: "The selected meeting owner has not granted Calendar access.", meetingOwner };
  }
  if (account.accessTokenExpiresAt && account.accessTokenExpiresAt.getTime() < Date.now() + 60_000) {
    const refreshed = await refreshGoogleToken(account.refreshToken);
    if (!refreshed) {
      return { outcome: "failed", code: "GOOGLE_TOKEN_REFRESH_FAILED", message: "The selected meeting owner must reconnect Google Calendar.", meetingOwner };
    }
    await prisma.oAuthAccount.update({
      where: { oauthAccountId: account.oauthAccountId },
      data: {
        accessToken: refreshed.accessToken,
        accessTokenExpiresAt: refreshed.expiresAt,
      },
    });
    return { outcome: "ready", meetingOwner, accessToken: refreshed.accessToken };
  }
  return { outcome: "ready", meetingOwner, accessToken: account.accessToken };
}

async function refreshGoogleToken(refreshToken: string | null) {
  if (!refreshToken) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { access_token: string; expires_in?: number };
  return {
    accessToken: data.access_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
  };
}

async function selectCalendarAttendees(session: Pick<Session, "sessionId" | "groupId" | "calendarInvitePolicy">) {
  if (session.calendarInvitePolicy === "app_only") return [];
  if (session.calendarInvitePolicy === "all_members") {
    const members = await prisma.member.findMany({
      where: { groupId: session.groupId },
      include: { user: true },
    });
    return uniqueEmails(members.map((member) => member.user.email));
  }
  return interestedMemberEmails(session.sessionId);
}

async function interestedMemberEmails(sessionId: bigint) {
  const votes = await prisma.pollVote.findMany({
    where: {
      poll: {
        sessionId,
        type: "interest",
        status: { in: ["active", "closed"] },
      },
      option: {
        label: { in: ["Interested", "Attending", "Yes", "Yes, interested", "I can attend"], mode: "insensitive" },
      },
    },
    include: { user: true },
  });
  return uniqueEmails(votes.map((vote) => vote.user.email));
}

function uniqueEmails(emails: string[]) {
  return [...new Map(emails.map((email) => [email.toLowerCase(), email])).values()];
}

async function upsertCalendarEvent({
  accessToken,
  calendarId,
  eventId,
  summary,
  description,
  startAt,
  endAt,
  attendeeEmails,
  sendUpdates,
  requestId,
}: {
  accessToken: string;
  calendarId: string;
  eventId: string | null;
  summary: string;
  description: string;
  startAt: Date;
  endAt: Date;
  attendeeEmails: string[];
  sendUpdates: boolean;
  requestId: string;
}) {
  const body = {
    summary,
    description,
    start: { dateTime: startAt.toISOString() },
    end: { dateTime: endAt.toISOString() },
    attendees: attendeeEmails.map((email) => ({ email })),
    conferenceData: { createRequest: { requestId } },
  };
  const encodedCalendarId = encodeURIComponent(calendarId);
  const query = `conferenceDataVersion=1&sendUpdates=${sendUpdates ? "all" : "none"}`;
  const url = eventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodeURIComponent(eventId)}?${query}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?${query}`;
  const response = await fetch(url, {
    method: eventId ? "PATCH" : "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Google Calendar returned ${response.status}.`);
  }
  return (await response.json()) as CalendarEventResponse;
}

function deleteCalendarEvent({
  accessToken,
  calendarId,
  eventId,
  sendUpdates,
}: {
  accessToken: string;
  calendarId: string;
  eventId: string;
  sendUpdates: boolean;
}) {
  const encodedCalendarId = encodeURIComponent(calendarId);
  const encodedEventId = encodeURIComponent(eventId);
  const query = `sendUpdates=${sendUpdates ? "all" : "none"}`;
  return fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodedEventId}?${query}`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );
}

function extractMeetLink(event: CalendarEventResponse) {
  return (
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
    null
  );
}

async function failScheduling(
  input: ScheduleSessionInput,
  code: string,
  message: string,
  meetingOwner?: bigint,
): Promise<Extract<ScheduleServiceResult, { outcome: "failed" }>> {
  const session = await prisma.session.findUniqueOrThrow({
    where: { sessionId: input.sessionId },
  });
  await prisma.$transaction([
    prisma.session.update({
      where: { sessionId: input.sessionId },
      data: {
        status: "scheduling_failed",
        schedulingError: message,
        schedulingAttemptCount: { increment: session.status === "scheduling" ? 0 : 1 },
        lastSchedulingAttemptAt: new Date(),
        meetingOwnerId: meetingOwner,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: input.actorUserId,
        groupId: session.groupId,
        sessionId: input.sessionId,
        pollId: input.pollId,
        action: "scheduling_failed",
        metadata: {
          code,
          message,
          source: input.source,
          meeting_owner: toId(meetingOwner),
          selected_option_id: toId(input.selectedOptionId),
        },
      },
    }),
  ]);
  return { outcome: "failed", code, message };
}
