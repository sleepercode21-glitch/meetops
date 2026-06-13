import { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/lib/api/errors";
import { groupSummary, toId, toIso } from "@/lib/api/formatters";
import { uniqueInviteCode } from "@/lib/api/invite-codes";
import {
  optionalBoolean,
  optionalFutureDate,
  optionalInteger,
  optionalString,
} from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (isPlatformOwnerEmail(user.email)) {
      const groups = await prisma.group.findMany({
        include: {
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return dataResponse(
        groups.map((group) => ({
          ...groupSummary(group, { isAdmin: true }),
          platform_owner_access: true,
        })),
      );
    }

    const memberships = await prisma.member.findMany({
      where: { userId: user.userId },
      include: {
        group: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    return dataResponse(
      memberships.map((membership) =>
        groupSummary(membership.group, membership),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = (await request.json()) as {
      name?: unknown;
      description?: unknown;
      invite_enabled?: unknown;
      invite_max_uses?: unknown;
      invite_code_expires_at?: unknown;
    };

    const name = optionalString(body.name, "name", 60, { required: true });
    const description = optionalString(body.description, "description", 500, {
      allowNull: true,
    });
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
    const shouldCreateInvite = inviteEnabled ?? true;
    const platformOwner = isPlatformOwnerEmail(user.email);

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          name: name ?? "",
          description,
          inviteEnabled: shouldCreateInvite,
          inviteMaxUses: inviteMaxUses ?? 50,
          inviteCodeExpiresAt,
          inviteCode: shouldCreateInvite ? await uniqueInviteCode(tx) : null,
          createdBy: user.userId,
        },
      });

      if (!platformOwner) {
        await tx.member.create({
          data: {
            groupId: created.groupId,
            userId: user.userId,
            isAdmin: true,
          },
        });
      }

      return created;
    });

    return dataResponse(toGroupResponse(group), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function toGroupResponse(group: {
  groupId: bigint;
  name: string;
  description: string | null;
  inviteCode: string | null;
  inviteEnabled: boolean;
  inviteMaxUses: number;
  inviteUsedCount: number;
  inviteCodeExpiresAt: Date | null;
  defaultMeetingOwner: bigint | null;
  createdBy: bigint;
  createdAt: Date;
}) {
  return {
    group_id: toId(group.groupId),
    name: group.name,
    description: group.description,
    invite_code: group.inviteCode,
    invite_enabled: group.inviteEnabled,
    invite_max_uses: group.inviteMaxUses,
    invite_used_count: group.inviteUsedCount,
    invite_code_expires_at: toIso(group.inviteCodeExpiresAt),
    default_meeting_owner: toId(group.defaultMeetingOwner),
    created_by: toId(group.createdBy),
    created_at: group.createdAt.toISOString(),
  };
}
