import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollManager } from "@/lib/api/guards";
import { assertPollDraft, assertTimeOptionValidity, statusForPollType } from "@/lib/api/poll-utils";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    const { poll } = await requirePollManager(user.userId, pollId);
    assertPollDraft(poll.status);
    if (poll.session.status === "cancelled" || poll.session.status === "completed") {
      throw new ApiError("INVALID_SESSION_STATUS", "Parent session cannot publish polls.");
    }
    if (!poll.deadline || poll.deadline <= new Date()) {
      throw new ApiError("VALIDATION_ERROR", "Poll deadline must be in the future before publishing.");
    }
    if (!poll.options.length) {
      throw new ApiError("POLL_HAS_NO_OPTIONS", "Poll must have at least one option before publishing.");
    }
    for (const option of poll.options) {
      assertTimeOptionValidity({ pollType: poll.type, startAt: option.startAt, endAt: option.endAt });
    }
    const publishedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const active = await tx.poll.update({
        where: { pollId },
        data: { status: "active", publishedAt },
      });
      await tx.session.update({ where: { sessionId: poll.sessionId }, data: { status: statusForPollType(poll.type) } });
      await tx.auditLog.create({
        data: { userId: user.userId, groupId: poll.session.groupId, sessionId: poll.sessionId, pollId, action: "poll_published", metadata: { poll_type: poll.type } },
      });
      return active;
    });
    return dataResponse({ poll_id: Number(updated.pollId), status: updated.status, published_at: updated.publishedAt?.toISOString() ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
