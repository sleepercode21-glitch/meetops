import { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/lib/api/errors";
import { requireGroupAdmin, requireSessionAccess } from "@/lib/api/guards";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ sessionId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { sessionId: id } = await context.params;
    const sessionId = parseBigIntParam(id, "sessionId");
    const { session } = await requireSessionAccess(user.userId, sessionId);
    await requireGroupAdmin(user.userId, session.groupId);
    const logs = await prisma.auditLog.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });
    return dataResponse(logs.map((log) => ({
      audit_log_id: Number(log.auditLogId),
      action: log.action,
      user_id: log.userId ? Number(log.userId) : null,
      poll_id: log.pollId ? Number(log.pollId) : null,
      metadata: log.metadata,
      created_at: log.createdAt.toISOString(),
    })));
  } catch (error) {
    return errorResponse(error);
  }
}
