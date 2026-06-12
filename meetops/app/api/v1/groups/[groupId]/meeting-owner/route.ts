import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { calendarScopeGranted, toId } from "@/lib/api/formatters";
import { requireGroupAdmin } from "@/lib/api/guards";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ groupId: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { groupId: groupIdParam } = await context.params;
    const groupId = parseBigIntParam(groupIdParam, "groupId");
    await requireGroupAdmin(user.userId, groupId);

    const body = (await request.json()) as {
      default_meeting_owner?: unknown;
    };

    if (
      body.default_meeting_owner === undefined ||
      body.default_meeting_owner === null
    ) {
      const group = await prisma.group.update({
        where: { groupId },
        data: { defaultMeetingOwner: null },
      });
      return dataResponse({
        group_id: toId(group.groupId),
        default_meeting_owner: null,
      });
    }

    if (
      typeof body.default_meeting_owner !== "number" ||
      !Number.isInteger(body.default_meeting_owner)
    ) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "default_meeting_owner must be a numeric user id.",
      );
    }

    const targetUserId = BigInt(body.default_meeting_owner);
    const membership = await prisma.member.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
      include: {
        user: {
          include: {
            oauthAccounts: {
              where: { provider: "google" },
              take: 1,
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ApiError(
        "NOT_GROUP_MEMBER",
        "Default meeting owner must be a group member.",
      );
    }
    const googleAccount = membership.user.oauthAccounts[0] ?? null;
    if (!googleAccount) {
      throw new ApiError(
        "GOOGLE_TOKEN_MISSING",
        "Default meeting owner has not connected Google.",
      );
    }
    if (!calendarScopeGranted(googleAccount)) {
      throw new ApiError(
        "GOOGLE_TOKEN_MISSING",
        "Default meeting owner has not granted Google Calendar event access.",
      );
    }

    const group = await prisma.group.update({
      where: { groupId },
      data: { defaultMeetingOwner: targetUserId },
    });

    return dataResponse({
      group_id: toId(group.groupId),
      default_meeting_owner: {
        user_id: toId(membership.user.userId),
        email: membership.user.email,
        calendar_connected: true,
        calendar_events_scope_granted: true,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
