import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollManager } from "@/lib/api/guards";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };
type ResponseRow = {
  option_id: bigint;
  start_at: Date;
  end_at: Date;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    const { poll } = await requirePollManager(user.userId, pollId);
    if (poll.type !== "availability") {
      throw new ApiError("INVALID_POLL_STATUS", "Recommendations are only available for availability polls.");
    }

    const rows = await prisma.$queryRaw<ResponseRow[]>`
      select option_id, start_at, end_at
      from availability_responses
      where poll_id = ${pollId}
      order by start_at asc
    `;
    const recommendations = computeRecommendations(rows).slice(0, 5);
    return dataResponse(recommendations);
  } catch (error) {
    return errorResponse(error);
  }
}

function computeRecommendations(rows: ResponseRow[]) {
  const byOption = new Map<string, ResponseRow[]>();
  for (const row of rows) {
    const key = row.option_id.toString();
    byOption.set(key, [...(byOption.get(key) ?? []), row]);
  }

  const segments: {
    source_option_id: number;
    start_at: string;
    end_at: string;
    available_count: number;
    duration_minutes: number;
  }[] = [];

  for (const [optionId, optionRows] of byOption) {
    const events = optionRows.flatMap((row) => [
      { time: row.start_at.getTime(), delta: 1 },
      { time: row.end_at.getTime(), delta: -1 },
    ]).sort((a, b) => a.time === b.time ? b.delta - a.delta : a.time - b.time);

    let count = 0;
    for (let index = 0; index < events.length - 1; index += 1) {
      count += events[index].delta;
      const start = events[index].time;
      const end = events[index + 1].time;
      if (count > 0 && end > start) {
        segments.push({
          source_option_id: Number(optionId),
          start_at: new Date(start).toISOString(),
          end_at: new Date(end).toISOString(),
          available_count: count,
          duration_minutes: Math.round((end - start) / 60000),
        });
      }
    }
  }

  return segments.sort((a, b) =>
    b.available_count - a.available_count ||
    b.duration_minutes - a.duration_minutes ||
    a.start_at.localeCompare(b.start_at),
  );
}
