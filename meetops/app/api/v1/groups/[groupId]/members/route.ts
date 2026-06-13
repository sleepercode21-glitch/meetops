import { NextRequest } from "next/server";
import { errorResponse, listResponse } from "@/lib/api/errors";
import { calendarScopeGranted, toId } from "@/lib/api/formatters";
import { requireGroupMember } from "@/lib/api/guards";
import { paginationFromUrl, parseBigIntParam } from "@/lib/api/validation";
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
    await requireGroupMember(user.userId, groupId);

    const { limit, offset } = paginationFromUrl(request.url);
    const role = new URL(request.url).searchParams.get("role") ?? "all";
    const roleFilter =
      role === "admin" ? { isAdmin: true } : role === "member" ? { isAdmin: false } : {};

    const where = { groupId, ...roleFilter };
    const [members, total] = await prisma.$transaction([
      prisma.member.findMany({
        where,
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
        orderBy: [{ isAdmin: "desc" }, { joinedAt: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.member.count({ where }),
    ]);

    return listResponse(
      members.map((member) => {
        const googleAccount = member.user.oauthAccounts[0] ?? null;
        return {
          user_id: toId(member.userId),
          email: member.user.email,
          firstname: member.user.firstname,
          lastname: member.user.lastname,
          profile_photo: member.user.profilePhoto,
          timezone: member.user.timezone,
          user_joined_at: member.user.joinedAt.toISOString(),
          profile_updated_at: member.user.updatedAt.toISOString(),
          joined_at: member.joinedAt.toISOString(),
          is_admin: member.isAdmin,
          calendar_connected: Boolean(googleAccount),
          calendar_events_scope_granted: calendarScopeGranted(googleAccount),
          google_connected_at: googleAccount?.createdAt.toISOString() ?? null,
          google_updated_at: googleAccount?.updatedAt.toISOString() ?? null,
        };
      }),
      { limit, offset, total },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
