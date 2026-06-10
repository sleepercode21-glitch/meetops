import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollAccess } from "@/lib/api/guards";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { closeExpiredPollIfNeeded } from "@/lib/poll-expiration";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    await closeExpiredPollIfNeeded(pollId);
    const { poll } = await requirePollAccess(user.userId, pollId);
    validateVoteState(poll.status, poll.deadline, poll.session.status);
    const body = (await request.json()) as { option_ids?: unknown };
    if (!Array.isArray(body.option_ids)) {
      throw new ApiError("VALIDATION_ERROR", "option_ids must be an array.");
    }
    const optionIds = [...new Set(body.option_ids.map((value) => {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new ApiError("VALIDATION_ERROR", "option_ids must contain numeric IDs.");
      }
      return BigInt(value);
    }))];
    if ((!poll.multiChoice && optionIds.length !== 1) || (poll.multiChoice && optionIds.length < 1)) {
      throw new ApiError("VALIDATION_ERROR", poll.multiChoice ? "Select at least one option." : "Select exactly one option.");
    }
    const validOptionIds = new Set(poll.options.map((option) => option.optionId.toString()));
    if (optionIds.some((optionId) => !validOptionIds.has(optionId.toString()))) {
      throw new ApiError("INVALID_POLL_OPTION", "Every option must belong to this poll.");
    }
    const previousVotes = await prisma.pollVote.findMany({ where: { pollId, userId: user.userId } });
    const previousSet = new Set(previousVotes.map((vote) => vote.optionId.toString()));
    const nextSet = new Set(optionIds.map((optionId) => optionId.toString()));
    const changed = previousVotes.length !== optionIds.length || previousVotes.some((vote) => !nextSet.has(vote.optionId.toString()));
    await prisma.$transaction(async (tx) => {
      await tx.pollVote.deleteMany({ where: { pollId, userId: user.userId, optionId: { notIn: optionIds } } });
      for (const optionId of optionIds) {
        if (!previousSet.has(optionId.toString())) {
          await tx.pollVote.create({ data: { pollId, userId: user.userId, optionId } });
        }
      }
      if (changed || previousVotes.length === 0) {
        await tx.auditLog.create({
          data: { userId: user.userId, groupId: poll.session.groupId, sessionId: poll.sessionId, pollId, action: previousVotes.length ? "vote_changed" : "vote_submitted", metadata: { option_ids: optionIds.map(Number) } },
        });
      }
    });
    return dataResponse({ poll_id: Number(pollId), user_id: Number(user.userId), option_ids: optionIds.map(Number), updated_at: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    await closeExpiredPollIfNeeded(pollId);
    const { poll } = await requirePollAccess(user.userId, pollId);
    validateVoteState(poll.status, poll.deadline, poll.session.status);
    await prisma.pollVote.deleteMany({ where: { pollId, userId: user.userId } });
    return dataResponse({ poll_id: Number(pollId), user_id: Number(user.userId), option_ids: [] });
  } catch (error) {
    return errorResponse(error);
  }
}

function validateVoteState(pollStatus: string, deadline: Date | null, sessionStatus: string) {
  if (pollStatus !== "active") throw new ApiError("INVALID_POLL_STATUS", "Only active polls accept votes.");
  if (deadline && deadline <= new Date()) throw new ApiError("POLL_EXPIRED", "This poll deadline has passed.");
  if (sessionStatus === "cancelled" || sessionStatus === "completed") throw new ApiError("INVALID_SESSION_STATUS", "This session no longer accepts votes.");
}
