import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollManager } from "@/lib/api/guards";
import { optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    const { poll } = await requirePollManager(user.userId, pollId);
    if (poll.status !== "active" && poll.status !== "closed") {
      throw new ApiError("INVALID_POLL_STATUS", "Only active or closed polls can be superseded.");
    }
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = optionalString(body.reason, "reason", 500, { allowNull: true });
    const updated = await prisma.poll.update({ where: { pollId }, data: { status: "superseded" } });
    await prisma.auditLog.create({ data: { userId: user.userId, groupId: poll.session.groupId, sessionId: poll.sessionId, pollId, action: "poll_closed", metadata: { reason, superseded: true } } });
    return dataResponse({ poll_id: Number(updated.pollId), status: updated.status });
  } catch (error) {
    return errorResponse(error);
  }
}
