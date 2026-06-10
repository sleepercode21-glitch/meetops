import type { AuditAction, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { errorResponse, listResponse } from "@/lib/api/errors";
import { requireGroupAdmin } from "@/lib/api/guards";
import { paginationFromUrl, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ groupId: string }> };

const auditActions = [
  "session_created",
  "poll_created",
  "poll_option_created",
  "poll_option_updated",
  "poll_option_deleted",
  "poll_published",
  "poll_closed",
  "vote_submitted",
  "vote_changed",
  "topic_suggested",
  "session_scheduled",
  "session_cancelled",
  "session_rescheduled",
  "scheduling_failed",
  "calendar_event_created",
  "calendar_event_updated",
  "calendar_event_cancelled",
  "calendar_attendees_updated",
  "member_removed",
  "member_role_updated",
] as const satisfies readonly AuditAction[];

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { groupId: id } = await context.params;
    const groupId = parseBigIntParam(id, "groupId");
    await requireGroupAdmin(user.userId, groupId);
    const { limit, offset } = paginationFromUrl(request.url, { limit: 50, offset: 0 });
    const params = request.nextUrl.searchParams;
    const sessionId = params.get("session_id");
    const pollId = params.get("poll_id");
    const action = params.get("action");
    const where: Prisma.AuditLogWhereInput = {
      groupId,
      ...(sessionId ? { sessionId: parseBigIntParam(sessionId, "session_id") } : {}),
      ...(pollId ? { pollId: parseBigIntParam(pollId, "poll_id") } : {}),
      ...(action && auditActions.includes(action as AuditAction)
        ? { action: action as AuditAction }
        : {}),
    };
    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
      prisma.auditLog.count({ where }),
    ]);
    return listResponse(logs.map((log) => ({
      audit_log_id: Number(log.auditLogId),
      user_id: log.userId ? Number(log.userId) : null,
      group_id: log.groupId ? Number(log.groupId) : null,
      session_id: log.sessionId ? Number(log.sessionId) : null,
      poll_id: log.pollId ? Number(log.pollId) : null,
      action: log.action,
      metadata: log.metadata,
      created_at: log.createdAt.toISOString(),
    })), { limit, offset, total });
  } catch (error) {
    return errorResponse(error);
  }
}
