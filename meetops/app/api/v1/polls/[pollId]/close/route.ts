import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollManager } from "@/lib/api/guards";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { scheduleSession } from "@/lib/scheduling";

type Context = { params: Promise<{ pollId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    const { poll } = await requirePollManager(user.userId, pollId);
    if (poll.status !== "active") {
      throw new ApiError("INVALID_POLL_STATUS", "Only active polls can be closed.");
    }
    const closedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const closed = await tx.poll.update({ where: { pollId }, data: { status: "closed", closedAt } });
      await tx.auditLog.create({
        data: { userId: user.userId, groupId: poll.session.groupId, sessionId: poll.sessionId, pollId, action: "poll_closed", metadata: {} },
      });
      return closed;
    });
    const scheduling = poll.type === "final_timing"
      ? await scheduleSession({ sessionId: poll.sessionId, pollId, source: "final_timing_poll_closed", actorUserId: user.userId })
      : null;
    return dataResponse({
      poll_id: Number(updated.pollId),
      status: updated.status,
      closed_at: updated.closedAt?.toISOString() ?? null,
      scheduling_triggered: poll.type === "final_timing",
      session: scheduling ? schedulingResponse(scheduling) : undefined,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function schedulingResponse(
  scheduling:
    | Awaited<ReturnType<typeof scheduleSession>>,
) {
  if (scheduling.outcome === "scheduled") {
    return {
      session_id: scheduling.session_id,
      status: scheduling.status,
      selected_option_id: scheduling.selected_option_id,
      scheduled_start_time: scheduling.scheduled_start_time,
      scheduled_end_time: scheduling.scheduled_end_time,
      meet_link: scheduling.meet_link,
    };
  }
  if (scheduling.outcome === "needs_host_decision") {
    return {
      status: "needs_host_decision",
      reason: scheduling.reason,
      tied_option_ids: scheduling.tied_option_ids,
    };
  }
  if (scheduling.outcome === "failed") {
    return {
      status: "scheduling_failed",
      reason: scheduling.code,
      message: scheduling.message,
    };
  }
  return {
    status: "unchanged",
    reason: scheduling.reason,
  };
}
