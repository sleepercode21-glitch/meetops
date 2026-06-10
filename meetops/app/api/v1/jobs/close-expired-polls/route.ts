import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { optionalInteger } from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { scheduleSession } from "@/lib/scheduling";

export async function POST(request: NextRequest) {
  try {
    assertJobAuth(request);
    const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
    const limit = optionalInteger(body.limit, "limit", { min: 1, max: 500 }) ?? 50;
    return dataResponse(await closeExpiredPolls(limit));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    assertJobAuth(request);
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = optionalInteger(limitParam ? Number(limitParam) : undefined, "limit", { min: 1, max: 500 }) ?? 50;
    return dataResponse(await closeExpiredPolls(limit));
  } catch (error) {
    return errorResponse(error);
  }
}

function assertJobAuth(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    throw new ApiError("FORBIDDEN", "Invalid job authorization.");
  }
}

async function closeExpiredPolls(limit: number) {
  const polls = await prisma.poll.findMany({
    where: { status: "active", deadline: { lte: new Date() } },
    include: { session: true },
    take: limit,
    orderBy: { deadline: "asc" },
  });
  let closed = 0;
  let skipped = 0;
  let finalTimingProcessed = 0;
  let scheduled = 0;
  let needsHostDecision = 0;
  let schedulingFailed = 0;
  for (const poll of polls) {
    const updated = await prisma.poll.updateMany({
      where: { pollId: poll.pollId, status: "active" },
      data: { status: "closed", closedAt: new Date() },
    });
    if (updated.count !== 1) {
      skipped += 1;
      continue;
    }
    closed += 1;
    await prisma.auditLog.create({
      data: { groupId: poll.session.groupId, sessionId: poll.sessionId, pollId: poll.pollId, action: "poll_closed", metadata: { source: "cron" } },
    });
    if (poll.type === "final_timing") {
      finalTimingProcessed += 1;
      const result = await scheduleSession({ sessionId: poll.sessionId, pollId: poll.pollId, source: "final_timing_poll_closed" });
      if (result.outcome === "scheduled") scheduled += 1;
      else if (result.outcome === "needs_host_decision") needsHostDecision += 1;
      else if (result.outcome === "failed") schedulingFailed += 1;
    }
  }
  return {
    processed: polls.length,
    closed,
    skipped,
    final_timing_processed: finalTimingProcessed,
    scheduled,
    needs_host_decision: needsHostDecision,
    scheduling_failed: schedulingFailed,
  };
}
