import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollManager } from "@/lib/api/guards";
import { pollOptionResponse } from "@/lib/api/poll-utils";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ optionId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { optionId: id } = await context.params;
    const optionId = parseBigIntParam(id, "optionId");
    const sourceOption = await prisma.pollOption.findUniqueOrThrow({
      where: { optionId },
      include: { poll: { include: { session: true } } },
    });
    const { poll } = await requirePollManager(user.userId, sourceOption.pollId);

    if (poll.type !== "availability" || poll.status !== "closed") {
      throw new ApiError(
        "INVALID_POLL_OPTION",
        "Only closed availability poll options can be promoted to final timing.",
      );
    }
    if (!sourceOption.startAt || !sourceOption.endAt) {
      throw new ApiError("VALIDATION_ERROR", "Availability option must have start and end times.");
    }
    const startAt = sourceOption.startAt;
    const endAt = sourceOption.endAt;

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
        await tx.session.update({
          where: { sessionId: poll.sessionId },
          data: { status: "polling" },
        });
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

      const label = sourceOption.label || startAt.toISOString();
      const existing = await tx.pollOption.findFirst({
        where: { pollId: timingPoll.pollId, label },
        include: { _count: { select: { votes: true } } },
      });
      if (existing) return { timingPoll, option: existing };

      const option = await tx.pollOption.create({
        data: {
          pollId: timingPoll.pollId,
          label,
          startAt,
          endAt,
        },
        include: { _count: { select: { votes: true } } },
      });
      await tx.auditLog.create({
        data: {
          userId: user.userId,
          groupId: poll.session.groupId,
          sessionId: poll.sessionId,
          pollId: timingPoll.pollId,
          action: "poll_option_created",
          metadata: {
            source_availability_option_id: Number(optionId),
            source_availability_poll_id: Number(poll.pollId),
          },
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
