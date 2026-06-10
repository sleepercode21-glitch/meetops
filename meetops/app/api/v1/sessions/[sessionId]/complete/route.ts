import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requireHostOrAdmin } from "@/lib/api/guards";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: sessionIdParam } = await context.params;
    const sessionId = parseBigIntParam(sessionIdParam, "sessionId");
    const { session } = await requireHostOrAdmin(user.userId, sessionId);

    if (session.status !== "scheduled") {
      throw new ApiError(
        "INVALID_SESSION_STATUS",
        "Only scheduled sessions can be marked completed.",
      );
    }

    const updated = await prisma.session.update({
      where: { sessionId },
      data: { status: "completed" },
    });

    return dataResponse({
      session_id: Number(updated.sessionId),
      status: updated.status,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
