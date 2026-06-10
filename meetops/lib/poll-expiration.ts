import { prisma } from "@/lib/prisma";
import { scheduleSession } from "@/lib/scheduling";

export type CloseExpiredPollsResult = {
  processed: number;
  closed: number;
  skipped: number;
  final_timing_processed: number;
  scheduled: number;
  needs_host_decision: number;
  scheduling_failed: number;
};

export async function closeExpiredPolls(limit = 50, source = "lazy") {
  const polls = await prisma.poll.findMany({
    where: { status: "active", deadline: { lte: new Date() } },
    include: { session: true },
    take: limit,
    orderBy: { deadline: "asc" },
  });
  return closePollRows(polls, source);
}

export async function closeExpiredPollsForSession(sessionId: bigint, source = "lazy") {
  const polls = await prisma.poll.findMany({
    where: { sessionId, status: "active", deadline: { lte: new Date() } },
    include: { session: true },
    orderBy: { deadline: "asc" },
  });
  return closePollRows(polls, source);
}

export async function closeExpiredPollIfNeeded(pollId: bigint, source = "lazy") {
  const poll = await prisma.poll.findFirst({
    where: { pollId, status: "active", deadline: { lte: new Date() } },
    include: { session: true },
  });
  return closePollRows(poll ? [poll] : [], source);
}

async function closePollRows(
  polls: {
    pollId: bigint;
    sessionId: bigint;
    type: string;
    session: { groupId: bigint };
  }[],
  source: string,
): Promise<CloseExpiredPollsResult> {
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
      data: {
        groupId: poll.session.groupId,
        sessionId: poll.sessionId,
        pollId: poll.pollId,
        action: "poll_closed",
        metadata: { source },
      },
    });
    if (poll.type === "final_timing") {
      finalTimingProcessed += 1;
      const result = await scheduleSession({
        sessionId: poll.sessionId,
        pollId: poll.pollId,
        source: "final_timing_poll_closed",
      });
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
