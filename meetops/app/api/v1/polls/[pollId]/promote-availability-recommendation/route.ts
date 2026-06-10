import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollManager } from "@/lib/api/guards";
import { pollOptionResponse } from "@/lib/api/poll-utils";
import { optionalDate, optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    const { poll } = await requirePollManager(user.userId, pollId);
    if (poll.type !== "availability" || poll.status !== "closed") {
      throw new ApiError("INVALID_POLL_STATUS", "Only closed availability polls can promote recommendations.");
    }

    const body = (await request.json()) as { label?: unknown; start_at?: unknown; end_at?: unknown };
    const startAt = optionalDate(body.start_at, "start_at", { required: true });
    const endAt = optionalDate(body.end_at, "end_at", { required: true });
    const label = optionalString(body.label, "label", 255);
    if (!startAt || !endAt || endAt <= startAt) {
      throw new ApiError("VALIDATION_ERROR", "Recommendation must have a valid start and end time.");
    }

    const result = await prisma.$transaction(async (tx) => {
      let timingPoll = await tx.poll.findFirst({
        where: { sessionId: poll.sessionId, type: "final_timing", status: "draft" },
      });
      if (!timingPoll) {
        timingPoll = await tx.poll.create({
          data: {
            sessionId: poll.sessionId,
            createdBy: user.userId,
            type: "final_timing",
            multiChoice: false,
            status: "draft",
          },
        });
        await tx.session.update({ where: { sessionId: poll.sessionId }, data: { status: "polling" } });
        await tx.auditLog.create({
          data: {
            userId: user.userId,
            groupId: poll.session.groupId,
            sessionId: poll.sessionId,
            pollId: timingPoll.pollId,
            action: "poll_created",
            metadata: { poll_type: "final_timing", source: "availability_recommendation" },
          },
        });
      }

      const optionLabel = label || startAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
      const option = await tx.pollOption.create({
        data: { pollId: timingPoll.pollId, label: optionLabel, startAt, endAt },
        include: { _count: { select: { votes: true } } },
      });
      await tx.auditLog.create({
        data: {
          userId: user.userId,
          groupId: poll.session.groupId,
          sessionId: poll.sessionId,
          pollId: timingPoll.pollId,
          action: "poll_option_created",
          metadata: { source_availability_poll_id: Number(pollId), source: "availability_overlap" },
        },
      });
      return { timingPoll, option };
    });

    return dataResponse({
      poll_id: Number(result.timingPoll.pollId),
      option: pollOptionResponse(result.option, true),
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
