import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requireHostOrAdmin } from "@/lib/api/guards";
import { optionalDate, optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { scheduleSession } from "@/lib/scheduling";

type Context = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: id } = await context.params;
    const sessionId = parseBigIntParam(id, "sessionId");
    const { session } = await requireHostOrAdmin(user.userId, sessionId);
    if (!["needs_host_decision", "draft", "polling", "rescheduling", "scheduling_failed"].includes(session.status)) {
      throw new ApiError("INVALID_SESSION_STATUS", "This session cannot be manually scheduled.");
    }
    const body = (await request.json()) as { selected_option_id?: unknown; start_at?: unknown; end_at?: unknown; label?: unknown };
    const selectedOptionId = typeof body.selected_option_id === "number" && Number.isInteger(body.selected_option_id)
      ? BigInt(body.selected_option_id)
      : null;
    const startAt = optionalDate(body.start_at, "start_at") ?? null;
    const endAt = optionalDate(body.end_at, "end_at") ?? null;
    if (!selectedOptionId && startAt && startAt <= new Date()) {
      throw new ApiError("VALIDATION_ERROR", "start_at must be in the future.");
    }
    const label = optionalString(body.label, "label", 255, { allowNull: true });
    const result = await scheduleSession({
      sessionId,
      source: "manual_host_selection",
      selectedOptionId,
      explicitStartAt: startAt,
      explicitEndAt: endAt,
      explicitLabel: label,
      actorUserId: user.userId,
    });
    if (result.outcome === "failed") {
      throw new ApiError(result.code === "VALIDATION_ERROR" ? "VALIDATION_ERROR" : "GOOGLE_CALENDAR_CREATE_FAILED", result.message);
    }
    return dataResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
