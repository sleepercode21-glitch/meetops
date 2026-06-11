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
      order by option_id asc, start_at asc
    `;

    return dataResponse(recommendationsFromResponses(rows).slice(0, 5));
  } catch (error) {
    return errorResponse(error);
  }
}

function recommendationsFromResponses(rows: ResponseRow[]) {
  const byOption = new Map<string, ResponseRow[]>();
  for (const row of rows) {
    const key = row.option_id.toString();
    byOption.set(key, [...(byOption.get(key) ?? []), row]);
  }

  const recommendations: {
    option_id: number;
    start_at: string;
    end_at: string;
    available_count: number;
    duration_minutes: number;
  }[] = [];

  for (const [optionId, optionRows] of byOption) {
    const events = optionRows.flatMap((row) => [
      { at: row.start_at.getTime(), delta: 1 },
      { at: row.end_at.getTime(), delta: -1 },
    ]).sort((a, b) => a.at - b.at || b.delta - a.delta);

    let active = 0;
    for (let index = 0; index < events.length - 1; index += 1) {
      active += events[index].delta;
      const start = events[index].at;
      const end = events[index + 1].at;
      if (active > 0 && end > start) {
        recommendations.push({
          option_id: Number(optionId),
          start_at: new Date(start).toISOString(),
          end_at: new Date(end).toISOString(),
          available_count: active,
          duration_minutes: Math.round((end - start) / 60000),
        });
      }
    }
  }

  return recommendations.sort((a, b) =>
    b.available_count - a.available_count ||
    b.duration_minutes - a.duration_minutes ||
    new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
}
