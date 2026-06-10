import type { SessionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requireHostOrAdmin } from "@/lib/api/guards";
import { optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const cancellableStatuses = new Set<SessionStatus>([
  "draft",
  "interest_check",
  "topic_selection",
  "availability_collection",
  "polling",
  "needs_host_decision",
  "scheduling_failed",
  "rescheduling",
  "scheduled",
]);

type Context = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: sessionIdParam } = await context.params;
    const sessionId = parseBigIntParam(sessionIdParam, "sessionId");
    const { session } = await requireHostOrAdmin(user.userId, sessionId);

    if (!cancellableStatuses.has(session.status)) {
      throw new ApiError(
        "INVALID_SESSION_STATUS",
        "This session cannot be cancelled in its current status.",
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      reason?: unknown;
    };
    const reason = optionalString(body.reason, "reason", 500, {
      allowNull: true,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.session.update({
        where: { sessionId },
        data: { status: "cancelled" },
      });

      await tx.poll.updateMany({
        where: {
          sessionId,
          status: { in: ["draft", "active"] },
        },
        data: {
          status: "cancelled",
          closedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.userId,
          groupId: session.groupId,
          sessionId,
          action: "session_cancelled",
          metadata: { reason },
        },
      });

      return cancelled;
    });

    return dataResponse({
      session_id: Number(updated.sessionId),
      status: updated.status,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
