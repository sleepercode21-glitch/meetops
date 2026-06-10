import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requireGroupAdmin } from "@/lib/api/guards";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ groupId: string; userId: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { groupId: groupIdParam, userId: targetUserIdParam } =
      await context.params;
    const groupId = parseBigIntParam(groupIdParam, "groupId");
    const targetUserId = parseBigIntParam(targetUserIdParam, "userId");
    await requireGroupAdmin(user.userId, groupId);

    const body = (await request.json()) as { is_admin?: unknown };
    if (typeof body.is_admin !== "boolean") {
      throw new ApiError("VALIDATION_ERROR", "is_admin must be a boolean.");
    }
    const isAdmin = body.is_admin;

    const member = await prisma.$transaction(async (tx) => {
      const target = await tx.member.findUnique({
        where: { groupId_userId: { groupId, userId: targetUserId } },
      });
      if (!target) {
        throw new ApiError("NOT_FOUND", "Target member was not found.");
      }

      if (target.isAdmin && !isAdmin) {
        const adminCount = await tx.member.count({
          where: { groupId, isAdmin: true },
        });
        if (adminCount <= 1) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Cannot remove the last group admin.",
          );
        }
      }

      const updated = await tx.member.update({
        where: { groupId_userId: { groupId, userId: targetUserId } },
        data: { isAdmin },
      });

      await tx.auditLog.create({
        data: {
          userId: user.userId,
          groupId,
          action: "member_role_updated",
          metadata: {
            target_user_id: Number(targetUserId),
            is_admin: isAdmin,
          },
        },
      });

      return updated;
    });

    return dataResponse({
      group_id: Number(member.groupId),
      user_id: Number(member.userId),
      is_admin: member.isAdmin,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { groupId: groupIdParam, userId: targetUserIdParam } =
      await context.params;
    const groupId = parseBigIntParam(groupIdParam, "groupId");
    const targetUserId = parseBigIntParam(targetUserIdParam, "userId");
    await requireGroupAdmin(user.userId, groupId);

    await prisma.$transaction(async (tx) => {
      const target = await tx.member.findUnique({
        where: { groupId_userId: { groupId, userId: targetUserId } },
      });
      if (!target) {
        throw new ApiError("NOT_FOUND", "Target member was not found.");
      }

      if (target.isAdmin) {
        const adminCount = await tx.member.count({
          where: { groupId, isAdmin: true },
        });
        if (adminCount <= 1) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Cannot remove the last group admin.",
          );
        }
      }

      await tx.member.delete({
        where: { groupId_userId: { groupId, userId: targetUserId } },
      });

      await tx.auditLog.create({
        data: {
          userId: user.userId,
          groupId,
          action: "member_removed",
          metadata: { target_user_id: Number(targetUserId) },
        },
      });
    });

    return dataResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
