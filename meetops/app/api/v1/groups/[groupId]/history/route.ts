import { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/lib/api/errors";
import { requireGroupMember } from "@/lib/api/guards";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { toId, toIso } from "@/lib/api/formatters";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ groupId: string }> };

type TimelineItem = {
  kind: "session" | "poll" | "comment" | "event";
  id: string;
  poll_id?: number | null;
  poll_type?: string;
  at: string;
  title: string;
  body: string | null;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { groupId: id } = await context.params;
    const groupId = parseBigIntParam(id, "groupId");
    await requireGroupMember(user.userId, groupId);

    const sessions = await prisma.session.findMany({
      where: { groupId },
      include: {
        host: { select: { userId: true, email: true, firstname: true, lastname: true } },
        polls: {
          orderBy: { createdAt: "asc" },
          select: {
            pollId: true,
            type: true,
            status: true,
            deadline: true,
            createdAt: true,
            publishedAt: true,
            closedAt: true,
            options: {
              select: { optionId: true, label: true, startAt: true, endAt: true, _count: { select: { votes: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        comments: {
          include: { user: { select: { userId: true, email: true, firstname: true, lastname: true } } },
          orderBy: { createdAt: "asc" },
        },
        auditLogs: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { email: true, firstname: true, lastname: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return dataResponse(sessions.map((session) => {
      const timeline = [
        {
          kind: "session" as const,
          id: `session-${session.sessionId}`,
          at: session.createdAt.toISOString(),
            title: "Session created",
            body: `${authorName(session.host)} created ${session.topic ?? "an untitled session"}${session.description ? `: ${session.description}` : "."}`,
          },
          ...session.polls.flatMap((poll) => [
            {
            kind: "poll" as const,
            id: `poll-created-${poll.pollId}`,
            poll_id: toId(poll.pollId),
            poll_type: poll.type,
            at: poll.createdAt.toISOString(),
            title: `${poll.type.replace("_", " ")} poll created`,
            body: [
              poll.deadline ? `Deadline ${poll.deadline.toLocaleString()}.` : null,
              poll.options.length
                ? `Options: ${poll.options.map(optionLabel).join(", ")}.`
                : "No options were added yet.",
            ].filter(Boolean).join(" "),
          },
          ...(poll.publishedAt ? [{
            kind: "poll" as const,
            id: `poll-published-${poll.pollId}`,
            poll_id: toId(poll.pollId),
            poll_type: poll.type,
            at: poll.publishedAt.toISOString(),
            title: `${poll.type.replace("_", " ")} poll opened`,
            body: `Voting opened with ${poll.options.length} option${poll.options.length === 1 ? "" : "s"}.`,
          }] : []),
          ...(poll.closedAt ? [{
            kind: "poll" as const,
            id: `poll-closed-${poll.pollId}`,
            poll_id: toId(poll.pollId),
            poll_type: poll.type,
            at: poll.closedAt.toISOString(),
            title: `${poll.type.replace("_", " ")} poll closed`,
            body: pollCloseSummary(poll.options),
          }] : []),
        ]),
        ...session.comments.map((comment) => ({
          kind: "comment" as const,
          id: `comment-${comment.sessionCommentId}`,
          at: comment.createdAt.toISOString(),
          title: authorName(comment.user),
          body: comment.body,
        })),
        ...session.auditLogs
          .flatMap((log) => auditTimelineItem(log, session.polls)),
      ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

      return {
        session_id: toId(session.sessionId),
        topic: session.topic,
        description: session.description,
        status: session.status,
        host_name: authorName(session.host),
        scheduled_start_time: toIso(session.scheduledStartTime),
        created_at: session.createdAt.toISOString(),
        polls: session.polls.map((poll) => ({
          poll_id: toId(poll.pollId),
          type: poll.type,
          status: poll.status,
          created_at: poll.createdAt.toISOString(),
          closed_at: toIso(poll.closedAt),
        })),
        comment_count: session.comments.length,
        timeline,
      };
    }));
  } catch (error) {
    return errorResponse(error);
  }
}

function authorName(user: { firstname: string | null; lastname: string | null; email: string }) {
  return [user.firstname, user.lastname].filter(Boolean).join(" ") || user.email;
}

function optionLabel(option: { label: string; startAt: Date | null; endAt: Date | null }) {
  if (!option.startAt || !option.endAt) return option.label;
  return `${option.startAt.toLocaleString()} - ${option.endAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function pollCloseSummary(options: { label: string; startAt: Date | null; endAt: Date | null; _count: { votes: number } }[]) {
  if (!options.length) return "The poll closed with no options.";
  const ranked = [...options].sort((a, b) => b._count.votes - a._count.votes);
  const top = ranked[0];
  const total = ranked.reduce((sum, option) => sum + option._count.votes, 0);
  if (!total) return "The poll closed with no votes.";
  return `Top result: ${optionLabel(top)} with ${top._count.votes} vote${top._count.votes === 1 ? "" : "s"}.`;
}

function auditTimelineItem(
  log: {
    auditLogId: bigint;
    action: string;
    pollId: bigint | null;
    metadata: unknown;
    createdAt: Date;
    user: { email: string; firstname: string | null; lastname: string | null } | null;
  },
  polls: {
    pollId: bigint;
    type: string;
    options: { optionId: bigint; label: string; startAt: Date | null; endAt: Date | null }[];
  }[],
): TimelineItem[] {
  if (["session_created", "poll_created", "poll_published", "poll_closed", "poll_option_created"].includes(log.action)) {
    return [];
  }

  const actor = log.user ? authorName(log.user) : "System";
  const poll = polls.find((item) => item.pollId === log.pollId);
  const metadata = log.metadata && typeof log.metadata === "object" ? log.metadata as Record<string, unknown> : {};
  const item = {
    kind: "event" as const,
    id: `audit-${log.auditLogId}`,
    poll_id: toId(log.pollId),
    poll_type: poll?.type,
    at: log.createdAt.toISOString(),
  };

  if (log.action === "vote_submitted" || log.action === "vote_changed") {
    const optionIds = Array.isArray(metadata.option_ids) ? metadata.option_ids.map(String) : [];
    const optionNames = poll?.options
      .filter((option) => optionIds.includes(String(option.optionId)))
      .map(optionLabel);
    return [{
      ...item,
      title: log.action === "vote_changed" ? "Vote updated" : "Vote submitted",
      body: `${actor} ${log.action === "vote_changed" ? "updated their vote" : "voted"}${optionNames?.length ? ` for ${optionNames.join(", ")}` : ""}.`,
    }];
  }

  if (log.action === "topic_suggested") {
    return [{
      ...item,
      title: "Topic suggested",
      body: `${actor} suggested "${String(metadata.suggestion ?? "a topic")}".`,
    }];
  }

  if (log.action === "session_cancelled") {
    return [{ ...item, title: "Session cancelled", body: `${actor} cancelled the session.` }];
  }

  if (log.action === "session_rescheduled") {
    return [{ ...item, title: "Rescheduling started", body: `${actor} reopened timing for this session.` }];
  }

  if (log.action === "scheduling_failed") {
    return [{ ...item, title: "Scheduling failed", body: "Google Calendar could not create or update the invite." }];
  }

  return [{ ...item, title: readableAction(log.action), body: `${actor} made an update.` }];
}

function readableAction(action: string) {
  return action.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}
