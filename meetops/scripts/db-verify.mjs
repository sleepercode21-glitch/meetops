import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL before running db:verify.");
  }

  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const [
      userCount,
      groupCount,
      sessionCount,
      pollCount,
      optionCount,
      voteCount,
      suggestionCount,
      auditCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.session.count(),
      prisma.poll.count(),
      prisma.pollOption.count(),
      prisma.pollVote.count(),
      prisma.suggestedOption.count(),
      prisma.auditLog.count(),
    ]);

    const activePolls = await prisma.poll.findMany({
      where: { status: "active" },
      select: {
        pollId: true,
        type: true,
        deadline: true,
        session: {
          select: {
            topic: true,
          },
        },
      },
      orderBy: { deadline: "asc" },
    });

    const needsAction = await prisma.session.findMany({
      where: {
        status: { in: ["needs_host_decision", "scheduling_failed"] },
      },
      select: {
        sessionId: true,
        topic: true,
        status: true,
        schedulingError: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    console.log("Database verification passed");
    console.table({
      users: userCount,
      groups: groupCount,
      sessions: sessionCount,
      polls: pollCount,
      poll_options: optionCount,
      poll_votes: voteCount,
      suggested_options: suggestionCount,
      audit_logs: auditCount,
    });

    console.log("Active polls");
    console.table(
      activePolls.map((poll) => ({
        poll_id: poll.pollId.toString(),
        type: poll.type,
        session: poll.session.topic ?? "Untitled session",
        deadline: poll.deadline?.toISOString() ?? "none",
      })),
    );

    console.log("Sessions needing action");
    console.table(
      needsAction.map((session) => ({
        session_id: session.sessionId.toString(),
        topic: session.topic ?? "Untitled session",
        status: session.status,
        error: session.schedulingError ?? "",
      })),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
