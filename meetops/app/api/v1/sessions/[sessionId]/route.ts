import type { CalendarInvitePolicy, SessionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { sessionDetail } from "@/lib/api/formatters";
import { requireHostOrAdmin, requireSessionAccess } from "@/lib/api/guards";
import {
  optionalEnum,
  optionalString,
  parseBigIntParam,
} from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const calendarInvitePolicies = [
  "all_members",
  "interested_members",
  "app_only",
] as const satisfies readonly CalendarInvitePolicy[];

const mutableStatuses = new Set<SessionStatus>([
  "draft",
  "interest_check",
  "topic_selection",
  "availability_collection",
  "polling",
  "needs_host_decision",
  "scheduling_failed",
]);

type Context = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: sessionIdParam } = await context.params;
    const sessionId = parseBigIntParam(sessionIdParam, "sessionId");
    const { session, member } = await requireSessionAccess(user.userId, sessionId);

    return dataResponse(
      sessionDetail(session, session.hostId === user.userId || member.isAdmin),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: sessionIdParam } = await context.params;
    const sessionId = parseBigIntParam(sessionIdParam, "sessionId");
    const { session } = await requireHostOrAdmin(user.userId, sessionId);

    if (!mutableStatuses.has(session.status)) {
      throw new ApiError(
        "INVALID_SESSION_STATUS",
        "This session cannot be edited in its current status.",
      );
    }

    const body = (await request.json()) as {
      topic?: unknown;
      description?: unknown;
      calendar_invite_policy?: unknown;
    };
    const topic = optionalString(body.topic, "topic", 100);
    const description = optionalString(body.description, "description", 1000, {
      allowNull: true,
    });
    const calendarInvitePolicy = optionalEnum(
      body.calendar_invite_policy,
      "calendar_invite_policy",
      calendarInvitePolicies,
    );

    const updated = await prisma.session.update({
      where: { sessionId },
      data: {
        ...(topic !== undefined ? { topic } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(calendarInvitePolicy !== undefined
          ? { calendarInvitePolicy }
          : {}),
      },
    });

    return dataResponse({
      session_id: Number(updated.sessionId),
      topic: updated.topic,
      description: updated.description,
      calendar_invite_policy: updated.calendarInvitePolicy,
      status: updated.status,
      updated_at: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
