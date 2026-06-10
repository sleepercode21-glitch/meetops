import { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/lib/api/errors";
import { requireGroupAdmin, requireGroupMember } from "@/lib/api/guards";
import { calendarScopeGranted, toId, toIso } from "@/lib/api/formatters";
import { optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

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
