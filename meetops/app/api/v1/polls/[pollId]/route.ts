import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollAccess, requirePollManager } from "@/lib/api/guards";
import { assertPollDraft, pollResponse, statusForPollType } from "@/lib/api/poll-utils";
import { optionalBoolean, optionalDate, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { closeExpiredPollIfNeeded } from "@/lib/poll-expiration";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    await closeExpiredPollIfNeeded(pollId);
    const { poll, member } = await requirePollAccess(user.userId, pollId);
    return dataResponse(pollResponse(poll, user.userId, member.isAdmin));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    const { poll } = await requirePollManager(user.userId, pollId);
    assertPollDraft(poll.status);
    const body = (await request.json()) as { deadline?: unknown; multi_choice?: unknown };
    const deadline = optionalDate(body.deadline, "deadline");
    const multiChoice = optionalBoolean(body.multi_choice, "multi_choice");
    if (deadline && deadline <= new Date()) {
      throw new ApiError("VALIDATION_ERROR", "Deadline must be in the future.");
    }
    const updated = await prisma.poll.update({
      where: { pollId },
      data: { ...(deadline !== undefined ? { deadline } : {}), ...(multiChoice !== undefined ? { multiChoice } : {}) },
    });
    return dataResponse({
      poll_id: Number(updated.pollId),
      deadline: updated.deadline?.toISOString() ?? null,
      multi_choice: updated.multiChoice,
      status: updated.status,
      updated_at: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    const { poll } = await requirePollManager(user.userId, pollId);
    assertPollDraft(poll.status);

    await prisma.$transaction(async (tx) => {
      await tx.poll.delete({ where: { pollId } });
      const latestPoll = await tx.poll.findFirst({
        where: {
          sessionId: poll.sessionId,
          status: { in: ["draft", "active"] },
        },
        orderBy: { createdAt: "desc" },
      });
      await tx.session.update({
        where: { sessionId: poll.sessionId },
        data: {
          status: latestPoll ? statusForPollType(latestPoll.type) : statusForPollType(poll.type),
        },
      });
    });

    return dataResponse({
      deleted: true,
      poll_id: Number(pollId),
      session_id: Number(poll.sessionId),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
