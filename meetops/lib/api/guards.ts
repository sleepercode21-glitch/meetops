import { ApiError } from "@/lib/api/errors";
import { isPlatformOwnerUserId } from "@/lib/platform-owner";
import { prisma } from "@/lib/prisma";

export async function requireGroupMember(userId: bigint, groupId: bigint) {
  const member = await prisma.member.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
  });

  if (!member && !(await isPlatformOwnerUserId(userId))) {
    throw new ApiError("NOT_GROUP_MEMBER", "You are not a member of this group.");
  }

  return member ?? {
    groupId,
    userId,
    joinedAt: new Date(0),
    isAdmin: true,
  };
}

export async function requireGroupAdmin(userId: bigint, groupId: bigint) {
  const member = await requireGroupMember(userId, groupId);
  if (!member.isAdmin) {
    throw new ApiError("GROUP_ADMIN_REQUIRED", "Group admin permission required.");
  }
  return member;
}

export async function getGoogleAccount(userId: bigint) {
  return prisma.oAuthAccount.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "google",
      },
    },
  });
}

export async function requireSessionAccess(userId: bigint, sessionId: bigint) {
  const session = await prisma.session.findUnique({
    where: { sessionId },
    include: {
      host: true,
      meetingOwner: true,
      polls: {
        orderBy: { createdAt: "desc" },
        select: {
          pollId: true,
          type: true,
          status: true,
          deadline: true,
        },
      },
    },
  });

  if (!session) {
    throw new ApiError("NOT_FOUND", "Session was not found.");
  }

  const member = await requireGroupMember(userId, session.groupId);
  return { session, member };
}

export async function requireHostOrAdmin(userId: bigint, sessionId: bigint) {
  const access = await requireSessionAccess(userId, sessionId);
  if (access.session.hostId !== userId && !access.member.isAdmin) {
    throw new ApiError(
      "HOST_OR_ADMIN_REQUIRED",
      "Session host or group admin permission required.",
    );
  }
  return access;
}

export async function requirePollAccess(userId: bigint, pollId: bigint) {
  const poll = await prisma.poll.findUnique({
    where: { pollId },
    include: {
      session: {
        include: {
          host: true,
          meetingOwner: true,
        },
      },
      options: {
        include: {
          _count: { select: { votes: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      suggestions: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
      votes: true,
    },
  });

  if (!poll) {
    throw new ApiError("NOT_FOUND", "Poll was not found.");
  }

  const member = await requireGroupMember(userId, poll.session.groupId);
  return { poll, member };
}

export async function requirePollManager(userId: bigint, pollId: bigint) {
  const access = await requirePollAccess(userId, pollId);
  if (access.poll.session.hostId !== userId && !access.member.isAdmin) {
    throw new ApiError(
      "HOST_OR_ADMIN_REQUIRED",
      "Session host or group admin permission required.",
    );
  }
  return access;
}
