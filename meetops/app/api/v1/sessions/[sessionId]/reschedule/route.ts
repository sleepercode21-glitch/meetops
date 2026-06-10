import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requireHostOrAdmin } from "@/lib/api/guards";
import { optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: sessionIdParam } = await context.params;
    const sessionId = parseBigIntParam(sessionIdParam, "sessionId");
    const { session } = await requireHostOrAdmin(user.userId, sessionId);

    if (session.status !== "scheduled" && session.status !== "scheduling_failed") {
      throw new ApiError(
        "INVALID_SESSION_STATUS",
        "Only scheduled or failed sessions can be rescheduled.",
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      reason?: unknown;
    };
    const reason = optionalString(body.reason, "reason", 500, {
      allowNull: true,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const rescheduled = await tx.session.update({
        where: { sessionId },
        data: { status: "rescheduling" },
      });

      await tx.auditLog.create({
        data: {
          userId: user.userId,
          groupId: session.groupId,
          sessionId,
          action: "session_rescheduled",
          metadata: { reason },
        },
      });

      return rescheduled;
    });

    return dataResponse({
      session_id: Number(updated.sessionId),
      status: updated.status,
      calendar_event_id: updated.calendarEventId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
