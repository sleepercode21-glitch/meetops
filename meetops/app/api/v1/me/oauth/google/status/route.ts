import { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/lib/api/errors";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const account = await prisma.oAuthAccount.findUnique({
      where: {
        userId_provider: {
          userId: user.userId,
          provider: "google",
        },
      },
      select: {
        provider: true,
        scope: true,
        accessTokenExpiresAt: true,
      },
    });

    return dataResponse({
      provider: "google",
      connected: Boolean(account),
      calendar_events_scope_granted:
        account?.scope?.includes(
          "https://www.googleapis.com/auth/calendar.events",
        ) ?? false,
      access_token_expires_at:
        account?.accessTokenExpiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
