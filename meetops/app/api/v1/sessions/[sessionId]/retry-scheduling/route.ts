import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requireHostOrAdmin } from "@/lib/api/guards";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { scheduleSession } from "@/lib/scheduling";

type Context = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: id } = await context.params;
    const sessionId = parseBigIntParam(id, "sessionId");
    const { session } = await requireHostOrAdmin(user.userId, sessionId);
    if (session.status !== "scheduling_failed") {
      throw new ApiError("INVALID_SESSION_STATUS", "Only failed scheduling can be retried.");
    }
    const result = await scheduleSession({
      sessionId,
      source: "retry",
      selectedOptionId: session.selectedOptionId,
      explicitStartAt: session.scheduledStartTime,
      explicitEndAt: session.scheduledEndTime,
      actorUserId: user.userId,
    });
    if (result.outcome === "failed") {
      throw new ApiError("GOOGLE_CALENDAR_CREATE_FAILED", result.message);
    }
    return dataResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
