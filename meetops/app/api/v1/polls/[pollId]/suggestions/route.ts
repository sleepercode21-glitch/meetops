import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollAccess } from "@/lib/api/guards";
import { suggestionResponse } from "@/lib/api/poll-utils";
import { optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    await requirePollAccess(user.userId, pollId);
    const suggestions = await prisma.suggestedOption.findMany({
      where: { pollId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return dataResponse(suggestions.map(suggestionResponse));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    const { poll } = await requirePollAccess(user.userId, pollId);
    if (poll.status !== "draft" && poll.status !== "active") {
      throw new ApiError("INVALID_POLL_STATUS", "Suggestions are only open while a poll is draft or active.");
    }
    const body = (await request.json()) as { suggestion?: unknown };
    const suggestion = optionalString(body.suggestion, "suggestion", 255, { required: true }) ?? "";
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.suggestedOption.create({ data: { pollId, suggestedBy: user.userId, suggestion } });
      await tx.auditLog.create({
        data: { userId: user.userId, groupId: poll.session.groupId, sessionId: poll.sessionId, pollId, action: "topic_suggested", metadata: { suggestion } },
      });
      return row;
    });
    return dataResponse({
      suggestion_id: Number(created.suggestionId),
      poll_id: Number(created.pollId),
      suggestion: created.suggestion,
      suggested_by: Number(created.suggestedBy),
      created_at: created.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
