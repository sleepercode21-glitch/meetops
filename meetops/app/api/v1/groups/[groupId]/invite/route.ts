import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { toIso } from "@/lib/api/formatters";
import { requireGroupAdmin } from "@/lib/api/guards";
import { uniqueInviteCode } from "@/lib/api/invite-codes";
import {
  optionalBoolean,
  optionalFutureDate,
  optionalInteger,
  parseBigIntParam,
} from "@/lib/api/validation";
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
      invite_enabled?: unknown;
      invite_max_uses?: unknown;
      invite_code_expires_at?: unknown;
      regenerate_invite_code?: unknown;
    };

    const inviteEnabled = optionalBoolean(
      body.invite_enabled,
      "invite_enabled",
    );
    const inviteMaxUses = optionalInteger(
      body.invite_max_uses,
      "invite_max_uses",
      { min: 1, max: 10000 },
    );
    const inviteCodeExpiresAt = optionalFutureDate(
      body.invite_code_expires_at,
      "invite_code_expires_at",
    );
    const regenerateInviteCode = optionalBoolean(
      body.regenerate_invite_code,
      "regenerate_invite_code",
    );

    const group = await prisma.$transaction(async (tx) => {
      const existing = await tx.group.findUniqueOrThrow({ where: { groupId } });
      if (
        inviteMaxUses !== undefined &&
        inviteMaxUses < existing.inviteUsedCount
      ) {
        throw new ApiError(
          "VALIDATION_ERROR",
          "invite_max_uses cannot be lower than invite_used_count.",
        );
      }

      return tx.group.update({
        where: { groupId },
        data: {
          ...(inviteEnabled !== undefined
            ? {
                inviteEnabled,
                inviteCode:
                  inviteEnabled && !existing.inviteCode
                    ? await uniqueInviteCode(tx)
                    : existing.inviteCode,
              }
            : {}),
          ...(inviteMaxUses !== undefined ? { inviteMaxUses } : {}),
          ...(body.invite_code_expires_at !== undefined
            ? { inviteCodeExpiresAt }
            : {}),
          ...(regenerateInviteCode
            ? { inviteCode: await uniqueInviteCode(tx), inviteUsedCount: 0 }
            : {}),
        },
      });
    });

    return dataResponse({
      invite_code: group.inviteCode,
      invite_enabled: group.inviteEnabled,
      invite_max_uses: group.inviteMaxUses,
      invite_used_count: group.inviteUsedCount,
      invite_code_expires_at: toIso(group.inviteCodeExpiresAt),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
