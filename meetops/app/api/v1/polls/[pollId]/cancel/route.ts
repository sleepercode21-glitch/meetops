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
    if (poll.status !== "draft" && poll.status !== "active") {
      throw new ApiError("INVALID_POLL_STATUS", "Only draft or active polls can be cancelled.");
    }
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = optionalString(body.reason, "reason", 500, { allowNull: true });
    const updated = await prisma.poll.update({ where: { pollId }, data: { status: "cancelled", closedAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: user.userId, groupId: poll.session.groupId, sessionId: poll.sessionId, pollId, action: "poll_closed", metadata: { reason, cancelled: true } } });
    return dataResponse({ poll_id: Number(updated.pollId), status: updated.status });
  } catch (error) {
    return errorResponse(error);
  }
}
