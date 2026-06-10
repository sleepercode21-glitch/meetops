import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollAccess } from "@/lib/api/guards";
import { optionalDate, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };
type AvailabilityRow = {
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
    await requirePollAccess(user.userId, pollId);
    const rows = await prisma.$queryRaw<AvailabilityRow[]>`
      select availability_response_id, poll_id, option_id, user_id, start_at, end_at
      from availability_responses
      where poll_id = ${pollId} and user_id = ${user.userId}
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
    const { poll } = await requirePollAccess(user.userId, pollId);
    if (poll.type !== "availability" || poll.status !== "active") {
      throw new ApiError("INVALID_POLL_STATUS", "Availability responses are only open during an active availability poll.");
    }

    const body = (await request.json()) as { option_id?: unknown; start_at?: unknown; end_at?: unknown };
    if (typeof body.option_id !== "number" || !Number.isInteger(body.option_id)) {
      throw new ApiError("VALIDATION_ERROR", "option_id must be a numeric ID.");
    }
    const optionId = BigInt(body.option_id);
    const startAt = optionalDate(body.start_at, "start_at", { required: true });
    const endAt = optionalDate(body.end_at, "end_at", { required: true });
    if (!startAt || !endAt || endAt <= startAt) {
      throw new ApiError("VALIDATION_ERROR", "Availability response must have a valid start and end time.");
    }

    const option = await prisma.pollOption.findFirst({
      where: { optionId, pollId },
    });
    if (!option || !option.startAt || !option.endAt) {
      throw new ApiError("INVALID_POLL_OPTION", "Availability window does not belong to this poll.");
    }
    if (startAt < option.startAt || endAt > option.endAt) {
      throw new ApiError("VALIDATION_ERROR", "Your availability must stay inside the host's window.");
    }

    const rows = await prisma.$queryRaw<AvailabilityRow[]>`
      insert into availability_responses (poll_id, option_id, user_id, start_at, end_at, updated_at)
      values (${pollId}, ${optionId}, ${user.userId}, ${startAt}, ${endAt}, now())
      on conflict (option_id, user_id)
      do update set start_at = excluded.start_at, end_at = excluded.end_at, updated_at = now()
      returning availability_response_id, poll_id, option_id, user_id, start_at, end_at
    `;
    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        groupId: poll.session.groupId,
        sessionId: poll.sessionId,
        pollId,
        action: "vote_submitted",
        metadata: { kind: "availability_response", option_id: Number(optionId) },
      },
    });

    return dataResponse(responseRow(rows[0]));
  } catch (error) {
    return errorResponse(error);
  }
}

function responseRow(row: AvailabilityRow) {
  return {
    availability_response_id: Number(row.availability_response_id),
    poll_id: Number(row.poll_id),
    option_id: Number(row.option_id),
    user_id: Number(row.user_id),
    start_at: row.start_at.toISOString(),
    end_at: row.end_at.toISOString(),
  };
}
