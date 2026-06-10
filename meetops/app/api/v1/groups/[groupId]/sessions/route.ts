import type { CalendarInvitePolicy, SessionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse, listResponse } from "@/lib/api/errors";
import { sessionSummary } from "@/lib/api/formatters";
import { requireGroupMember } from "@/lib/api/guards";
import {
  optionalEnum,
  optionalString,
  paginationFromUrl,
  parseBigIntParam,
} from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const calendarInvitePolicies = [
  "all_members",
  "interested_members",
  "app_only",
] as const satisfies readonly CalendarInvitePolicy[];

const sessionStatuses = [
  "draft",
  "interest_check",
  "topic_selection",
  "availability_collection",
  "polling",
  "needs_host_decision",
  "scheduling",
  "scheduled",
  "scheduling_failed",
  "rescheduling",
  "cancelled",
  "completed",
] as const satisfies readonly SessionStatus[];

type Context = {
  params: Promise<{ groupId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { groupId: groupIdParam } = await context.params;
    const groupId = parseBigIntParam(groupIdParam, "groupId");
    const membership = await requireGroupMember(user.userId, groupId);
    const { limit, offset } = paginationFromUrl(request.url, {
      limit: 20,
      offset: 0,
    });

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") ?? "all";
    if (status !== "all" && !sessionStatuses.includes(status as SessionStatus)) {
      throw new ApiError("VALIDATION_ERROR", "status is invalid.");
    }

    const mine = searchParams.get("mine");
    const upcoming = searchParams.get("upcoming");
    const where = {
      groupId,
      ...(status !== "all" ? { status: status as SessionStatus } : {}),
      ...(mine === "true" ? { hostId: user.userId } : {}),
      ...(upcoming === "true"
        ? {
            status: "scheduled" as SessionStatus,
            scheduledStartTime: { gte: new Date() },
          }
        : {}),
    };

    const [sessions, total] = await prisma.$transaction([
      prisma.session.findMany({
        where,
        include: { host: true },
        orderBy: [{ scheduledStartTime: "asc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.session.count({ where }),
    ]);

    return listResponse(
      sessions.map((session) =>
        sessionSummary(
          session,
          session.hostId === user.userId || membership.isAdmin,
        ),
      ),
      { limit, offset, total },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { groupId: groupIdParam } = await context.params;
    const groupId = parseBigIntParam(groupIdParam, "groupId");
    await requireGroupMember(user.userId, groupId);

    const body = (await request.json()) as {
      topic?: unknown;
      description?: unknown;
      calendar_invite_policy?: unknown;
    };
    const topic = optionalString(body.topic, "topic", 100);
    const description = optionalString(body.description, "description", 1000, {
      allowNull: true,
    });
    const calendarInvitePolicy =
      optionalEnum(
        body.calendar_invite_policy,
        "calendar_invite_policy",
        calendarInvitePolicies,
      ) ?? "app_only";

    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          groupId,
          hostId: user.userId,
          topic,
          description,
          calendarInvitePolicy,
          status: "draft",
        },
        include: { host: true },
      });

      await tx.auditLog.create({
        data: {
          userId: user.userId,
          groupId,
          sessionId: created.sessionId,
          action: "session_created",
          metadata: {
            topic,
            calendar_invite_policy: calendarInvitePolicy,
          },
        },
      });

      return created;
    });

    return dataResponse(sessionSummary(session, true), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
