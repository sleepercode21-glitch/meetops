import { NextRequest } from "next/server";
import { ApiError, errorResponse, listResponse } from "@/lib/api/errors";
import { calendarScopeGranted, toId } from "@/lib/api/formatters";
import { paginationFromUrl } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { isPlatformOwnerEmail, isPlatformOwnerUserId } from "@/lib/platform-owner";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireAuth(request);
    if (!(await isPlatformOwnerUserId(viewer.userId))) {
      throw new ApiError("FORBIDDEN", "Platform owner permission required.");
    }

    const { limit, offset } = paginationFromUrl(request.url);
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        include: {
          oauthAccounts: {
            where: { provider: "google" },
            take: 1,
          },
          memberships: {
            include: {
              group: {
                select: {
                  groupId: true,
                  name: true,
                },
              },
            },
            orderBy: [{ isAdmin: "desc" }, { joinedAt: "desc" }],
          },
          _count: {
            select: {
              hostedSessions: true,
              ownedMeetings: true,
              pollVotes: true,
              suggestions: true,
              sessionComments: true,
              auditLogs: true,
            },
          },
        },
        orderBy: { joinedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count(),
    ]);

    return listResponse(
      users.map((user) => {
        const googleAccount = user.oauthAccounts[0] ?? null;
        const adminMemberships = user.memberships.filter((membership) => membership.isAdmin);
        return {
          user_id: toId(user.userId),
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          profile_photo: user.profilePhoto,
          timezone: user.timezone,
          platform_owner: isPlatformOwnerEmail(user.email),
          joined_at: user.joinedAt.toISOString(),
          updated_at: user.updatedAt.toISOString(),
          google: googleAccount
            ? {
                connected: true,
                calendar_events_scope_granted: calendarScopeGranted(googleAccount),
                scope: googleAccount.scope,
                token_type: googleAccount.tokenType,
                access_token_expires_at: googleAccount.accessTokenExpiresAt?.toISOString() ?? null,
                connected_at: googleAccount.createdAt.toISOString(),
                updated_at: googleAccount.updatedAt.toISOString(),
              }
            : {
                connected: false,
                calendar_events_scope_granted: false,
                scope: null,
                token_type: null,
                access_token_expires_at: null,
                connected_at: null,
                updated_at: null,
              },
          memberships: user.memberships.map((membership) => ({
            group_id: toId(membership.groupId),
            group_name: membership.group.name,
            is_admin: membership.isAdmin,
            joined_at: membership.joinedAt.toISOString(),
          })),
          counts: {
            groups: user.memberships.length,
            admin_groups: adminMemberships.length,
            hosted_sessions: user._count.hostedSessions,
            meeting_owner_sessions: user._count.ownedMeetings,
            votes: user._count.pollVotes,
            suggestions: user._count.suggestions,
            comments: user._count.sessionComments,
            audit_events: user._count.auditLogs,
          },
        };
      }),
      { limit, offset, total },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
