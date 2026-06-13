import { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/lib/api/errors";
import { requireGroupAdmin, requireGroupMember } from "@/lib/api/guards";
import { calendarScopeGranted, toId, toIso } from "@/lib/api/formatters";
import { optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { cancelCalendarEventForSession } from "@/lib/scheduling";

type Context = {
  params: Promise<{ groupId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { groupId: groupIdParam } = await context.params;
    const groupId = parseBigIntParam(groupIdParam, "groupId");
    const membership = await requireGroupMember(user.userId, groupId);

    const group = await prisma.group.findUniqueOrThrow({
      where: { groupId },
      include: {
        meetingOwner: {
          include: {
            oauthAccounts: {
              where: { provider: "google" },
              take: 1,
            },
          },
        },
      },
    });

    const meetingOwner = group.meetingOwner;
    const googleAccount = meetingOwner?.oauthAccounts[0] ?? null;

    return dataResponse({
      group_id: toId(group.groupId),
      name: group.name,
      description: group.description,
      invite_code: membership.isAdmin ? group.inviteCode : undefined,
      invite_enabled: group.inviteEnabled,
      invite_max_uses: group.inviteMaxUses,
      invite_used_count: group.inviteUsedCount,
      invite_code_expires_at: toIso(group.inviteCodeExpiresAt),
      default_meeting_owner: meetingOwner
        ? {
            user_id: toId(meetingOwner.userId),
            email: meetingOwner.email,
            firstname: meetingOwner.firstname,
            lastname: meetingOwner.lastname,
            calendar_connected: Boolean(googleAccount),
            calendar_events_scope_granted: calendarScopeGranted(googleAccount),
          }
        : null,
      current_user_membership: {
        is_admin: membership.isAdmin,
        joined_at: membership.joinedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { groupId: groupIdParam } = await context.params;
    const groupId = parseBigIntParam(groupIdParam, "groupId");
    await requireGroupAdmin(user.userId, groupId);

    const body = (await request.json()) as {
      name?: unknown;
      description?: unknown;
    };
    const name = optionalString(body.name, "name", 60);
    const description = optionalString(body.description, "description", 500, {
      allowNull: true,
    });

    const group = await prisma.group.update({
      where: { groupId },
      data: {
        ...(name !== undefined ? { name: name ?? "" } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    });

    return dataResponse({
      group_id: toId(group.groupId),
      name: group.name,
      description: group.description,
      updated_at: group.updatedAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { groupId: groupIdParam } = await context.params;
    const groupId = parseBigIntParam(groupIdParam, "groupId");
    await requireGroupAdmin(user.userId, groupId);

    const sessionsWithCalendarEvents = await prisma.session.findMany({
      where: {
        groupId,
        calendarEventId: { not: null },
      },
      select: { sessionId: true },
      orderBy: { createdAt: "asc" },
    });

    const calendarCancellationFailures: Array<{ session_id: number; message: string }> = [];
    for (const session of sessionsWithCalendarEvents) {
      const cancellation = await cancelCalendarEventForSession({
        sessionId: session.sessionId,
        actorUserId: user.userId,
        reason: "group_deleted",
      });
      if (cancellation.outcome === "failed") {
        calendarCancellationFailures.push({
          session_id: Number(session.sessionId),
          message: cancellation.message,
        });
      }
    }

    const sessionsToCancel = await prisma.session.findMany({
      where: {
        groupId,
        status: { notIn: ["cancelled", "completed"] },
      },
      select: { sessionId: true },
      orderBy: { createdAt: "asc" },
    });

    await prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: {
          groupId,
          status: { notIn: ["cancelled", "completed"] },
        },
        data: {
          status: "cancelled",
          calendarEventId: null,
          meetLink: null,
          schedulingError: null,
        },
      });

      await tx.poll.updateMany({
        where: {
          session: { groupId },
          status: { in: ["draft", "active"] },
        },
        data: {
          status: "cancelled",
          closedAt: new Date(),
        },
      });

      if (sessionsToCancel.length > 0) {
        await tx.auditLog.createMany({
          data: sessionsToCancel.map((session) => ({
            userId: user.userId,
            groupId,
            sessionId: session.sessionId,
            action: "session_cancelled",
            metadata: {
              reason: "group_deleted",
              group_deleted: true,
            },
          })),
        });
      }

      await tx.group.delete({ where: { groupId } });
    });

    return dataResponse({
      group_id: toId(groupId),
      deleted: true,
      sessions_cancelled: sessionsToCancel.length,
      calendar_events_found: sessionsWithCalendarEvents.length,
      calendar_events_cancelled: sessionsWithCalendarEvents.length - calendarCancellationFailures.length,
      calendar_cancellation_failures: calendarCancellationFailures,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
