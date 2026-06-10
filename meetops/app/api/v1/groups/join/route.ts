import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { toId } from "@/lib/api/formatters";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = (await request.json()) as { invite_code?: unknown };

    if (typeof body.invite_code !== "string" || !body.invite_code.trim()) {
      throw new ApiError("VALIDATION_ERROR", "invite_code is required.");
    }

    const inviteCode = body.invite_code.trim().toUpperCase();
    const membership = await prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { inviteCode },
      });

      if (!group) {
        throw new ApiError("INVALID_INVITE_CODE", "Invite code was not found.");
      }
      if (!group.inviteEnabled) {
        throw new ApiError("INVITE_DISABLED", "This invite is disabled.");
      }
      if (
        group.inviteCodeExpiresAt &&
        group.inviteCodeExpiresAt.getTime() <= Date.now()
      ) {
        throw new ApiError("INVITE_EXPIRED", "This invite has expired.");
      }
      if (group.inviteUsedCount >= group.inviteMaxUses) {
        throw new ApiError(
          "INVITE_MAX_USES_REACHED",
          "This invite has reached its use limit.",
        );
      }

      const existingMembership = await tx.member.findUnique({
        where: {
          groupId_userId: {
            groupId: group.groupId,
            userId: user.userId,
          },
        },
      });

      if (existingMembership) {
        throw new ApiError("ALREADY_MEMBER", "You are already in this group.");
      }

      const incremented = await tx.group.updateMany({
        where: {
          groupId: group.groupId,
          inviteEnabled: true,
          inviteUsedCount: { lt: group.inviteMaxUses },
          OR: [
            { inviteCodeExpiresAt: null },
            { inviteCodeExpiresAt: { gt: new Date() } },
          ],
        },
        data: {
          inviteUsedCount: { increment: 1 },
        },
      });

      if (incremented.count !== 1) {
        throw new ApiError(
          "INVITE_MAX_USES_REACHED",
          "This invite is no longer available.",
        );
      }

      const createdMembership = await tx.member.create({
        data: {
          groupId: group.groupId,
          userId: user.userId,
        },
      });

      return {
        group,
        membership: createdMembership,
      };
    });

    return dataResponse({
      group_id: toId(membership.group.groupId),
      name: membership.group.name,
      joined_at: membership.membership.joinedAt.toISOString(),
      is_admin: membership.membership.isAdmin,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
