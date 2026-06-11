import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollAccess } from "@/lib/api/guards";
import { parseBigIntParam, requiredDate } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { closeExpiredPollIfNeeded } from "@/lib/poll-expiration";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };

type AvailabilityResponseRow = {
  availability_response_id: bigint;
  poll_id: bigint;
  option_id: bigint;
  user_id: bigint;
  start_at: Date;
  end_at: Date;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    await closeExpiredPollIfNeeded(pollId);
    await requirePollAccess(user.userId, pollId);
    const rows = await prisma.$queryRaw<AvailabilityResponseRow[]>`
      select availability_response_id, poll_id, option_id, user_id, start_at, end_at
      from availability_responses
      where poll_id = ${pollId}
        and user_id = ${user.userId}
      order by start_at asc
    `;
    return dataResponse(rows.map(responseRow));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    await closeExpiredPollIfNeeded(pollId);
    const { poll } = await requirePollAccess(user.userId, pollId);
    if (poll.type !== "availability" || poll.status !== "active") {
      throw new ApiError("INVALID_POLL_STATUS", "Availability can only be submitted while the poll is active.");
    }
    if (poll.session.status === "cancelled" || poll.session.status === "completed") {
      throw new ApiError("INVALID_SESSION_STATUS", "This session no longer accepts availability.");
    }

    const body = (await request.json()) as { responses?: unknown };
    if (!Array.isArray(body.responses)) {
      throw new ApiError("VALIDATION_ERROR", "responses must be an array.");
    }

    const validOptions = new Map(poll.options.map((option) => [option.optionId.toString(), option]));
    const responses = body.responses.map((item) => {
      if (!item || typeof item !== "object") {
        throw new ApiError("VALIDATION_ERROR", "Each response must be an object.");
      }
      const value = item as { option_id?: unknown; start_at?: unknown; end_at?: unknown };
      if (typeof value.option_id !== "number" || !Number.isInteger(value.option_id)) {
        throw new ApiError("VALIDATION_ERROR", "option_id must be a numeric ID.");
      }
      const optionId = BigInt(value.option_id);
      const option = validOptions.get(optionId.toString());
      if (!option) throw new ApiError("INVALID_POLL_OPTION", "Every option must belong to this poll.");
      const startAt = requiredDate(value.start_at, "start_at");
      const endAt = requiredDate(value.end_at, "end_at");
      if (!option.startAt || !option.endAt) {
        throw new ApiError("INVALID_POLL_OPTION", "Availability option is missing its time window.");
      }
      if (startAt < option.startAt || endAt > option.endAt || endAt <= startAt) {
        throw new ApiError("VALIDATION_ERROR", "Availability must stay inside the host's time window.");
      }
      return { optionId, startAt, endAt };
    });

    const optionIds = [...new Set(responses.map((response) => response.optionId.toString()))].map(BigInt);

    await prisma.$transaction(async (tx) => {
      await tx.pollVote.deleteMany({ where: { pollId, userId: user.userId } });
      await tx.$executeRaw`
        delete from availability_responses
        where poll_id = ${pollId}
          and user_id = ${user.userId}
      `;

      for (const optionId of optionIds) {
        await tx.pollVote.create({ data: { pollId, userId: user.userId, optionId } });
      }
      for (const response of responses) {
        await tx.$executeRaw`
          insert into availability_responses (poll_id, option_id, user_id, start_at, end_at, updated_at)
          values (${pollId}, ${response.optionId}, ${user.userId}, ${response.startAt}, ${response.endAt}, now())
          on conflict (option_id, user_id)
          do update set start_at = excluded.start_at, end_at = excluded.end_at, updated_at = now()
        `;
      }

      await tx.auditLog.create({
        data: {
          userId: user.userId,
          groupId: poll.session.groupId,
          sessionId: poll.sessionId,
          pollId,
          action: optionIds.length ? "vote_submitted" : "vote_changed",
          metadata: { availability_option_ids: optionIds.map(Number) },
        },
      });
    });

    return dataResponse({
      poll_id: Number(pollId),
      user_id: Number(user.userId),
      option_ids: optionIds.map(Number),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function responseRow(row: AvailabilityResponseRow) {
  return {
    availability_response_id: Number(row.availability_response_id),
    poll_id: Number(row.poll_id),
    option_id: Number(row.option_id),
    user_id: Number(row.user_id),
    start_at: row.start_at.toISOString(),
    end_at: row.end_at.toISOString(),
  };
}
