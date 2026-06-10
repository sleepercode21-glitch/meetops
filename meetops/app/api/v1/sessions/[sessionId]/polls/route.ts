import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requireHostOrAdmin, requireSessionAccess } from "@/lib/api/guards";
import { pollResponse, pollTypes, statusForPollType } from "@/lib/api/poll-utils";
import { optionalBoolean, optionalDate, optionalEnum, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { closeExpiredPollsForSession } from "@/lib/poll-expiration";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ sessionId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: id } = await context.params;
    const sessionId = parseBigIntParam(id, "sessionId");
    const { session, member } = await requireSessionAccess(user.userId, sessionId);
    await closeExpiredPollsForSession(sessionId);
    const polls = await prisma.poll.findMany({
      where: { sessionId },
      include: {
        session: { select: { hostId: true } },
        options: { include: { _count: { select: { votes: true } } }, orderBy: { createdAt: "asc" } },
        votes: true,
        suggestions: { include: { user: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return dataResponse(polls.map((poll) => pollResponse(poll, user.userId, member.isAdmin || session.hostId === user.userId)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: id } = await context.params;
    const sessionId = parseBigIntParam(id, "sessionId");
    const { session } = await requireHostOrAdmin(user.userId, sessionId);
    if (session.status === "cancelled" || session.status === "completed") {
      throw new ApiError("INVALID_SESSION_STATUS", "Session cannot accept new polls.");
    }
    const body = (await request.json()) as { type?: unknown; multi_choice?: unknown; deadline?: unknown };
    const type = optionalEnum(body.type, "type", pollTypes);
    if (!type) {
      throw new ApiError("VALIDATION_ERROR", "Poll type is required.");
    }
    const multiChoice = optionalBoolean(body.multi_choice, "multi_choice") ?? false;
    const deadline = optionalDate(body.deadline, "deadline") ?? null;
    const poll = await prisma.$transaction(async (tx) => {
      const created = await tx.poll.create({
        data: { sessionId, createdBy: user.userId, type, multiChoice, deadline },
      });
      await tx.session.update({ where: { sessionId }, data: { status: statusForPollType(type) } });
      await tx.auditLog.create({
        data: { userId: user.userId, groupId: session.groupId, sessionId, pollId: created.pollId, action: "poll_created", metadata: { poll_type: type } },
      });
      return created;
    });
    return dataResponse({
      poll_id: Number(poll.pollId),
      session_id: Number(poll.sessionId),
      type: poll.type,
      status: poll.status,
      multi_choice: poll.multiChoice,
      deadline: poll.deadline?.toISOString() ?? null,
      created_by: Number(poll.createdBy),
      created_at: poll.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
