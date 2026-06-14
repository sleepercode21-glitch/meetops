import { NextRequest } from "next/server";
import { CalendarInvitePolicy, Prisma } from "@prisma/client";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollManager } from "@/lib/api/guards";
import { optionalEnum, parseBigIntParam, requiredDate } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };
const calendarInvitePolicies = [
  "all_members",
  "interested_members",
  "app_only",
] as const satisfies readonly CalendarInvitePolicy[];

type ResponseRow = {
  option_id: bigint;
  start_at: Date;
  end_at: Date;
};

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    const { poll } = await requirePollManager(user.userId, pollId);

    if (poll.type !== "availability" || poll.status !== "closed") {
      throw new ApiError(
        "INVALID_POLL_STATUS",
        "Create the final timing poll after closing an availability poll.",
      );
    }

    const body = (await request.json()) as { option_ids?: unknown; windows?: unknown; deadline?: unknown; calendar_invite_policy?: unknown };
    const optionIds = Array.isArray(body.option_ids) ? [...new Set(body.option_ids.map((value) => {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new ApiError("VALIDATION_ERROR", "option_ids must contain numeric IDs.");
      }
      return BigInt(value);
    }))] : [];
    const windows = parseWindows(body.windows);
    if (optionIds.length + windows.length < 1 || optionIds.length + windows.length > 5) {
      throw new ApiError("VALIDATION_ERROR", "Choose 1 to 5 times for the final timing poll.");
    }

    const deadline = requiredDate(body.deadline, "deadline");
    if (deadline <= new Date()) {
      throw new ApiError("VALIDATION_ERROR", "deadline must be in the future.");
    }
    const calendarInvitePolicy = optionalEnum(
      body.calendar_invite_policy,
      "calendar_invite_policy",
      calendarInvitePolicies,
    ) ?? "all_members";

    const selectedOptions = optionIds.length ? poll.options
      .filter((option) => optionIds.some((optionId) => optionId === option.optionId))
      .sort((a, b) => optionIds.findIndex((id) => id === a.optionId) - optionIds.findIndex((id) => id === b.optionId)) : [];

    if (selectedOptions.length !== optionIds.length) {
      throw new ApiError("INVALID_POLL_OPTION", "Every option must belong to this availability poll.");
    }
    if (selectedOptions.some((option) => !option.startAt || !option.endAt)) {
      throw new ApiError("INVALID_POLL_OPTION", "Availability options must have start and end times.");
    }
    const selectedOptionWindows = optionIds.length
      ? await bestWindowsForOptions(pollId, optionIds, selectedOptions)
      : [];

    const created = await prisma.$transaction(async (tx) => {
      await tx.poll.updateMany({
        where: {
          sessionId: poll.sessionId,
          type: "final_timing",
          status: { in: ["draft", "active"] },
        },
        data: { status: "superseded" },
      });

      const finalPoll = await tx.poll.create({
        data: {
          sessionId: poll.sessionId,
          createdBy: user.userId,
          type: "final_timing",
          status: "active",
          multiChoice: false,
          deadline,
          publishedAt: new Date(),
        },
      });

      for (const option of selectedOptionWindows) {
        await tx.pollOption.create({
          data: {
            pollId: finalPoll.pollId,
            label: generatedOptionLabel(option.startAt, option.endAt),
            startAt: option.startAt,
            endAt: option.endAt,
          },
        });
      }
      for (const window of windows) {
        await tx.pollOption.create({
          data: {
            pollId: finalPoll.pollId,
            label: generatedOptionLabel(window.startAt, window.endAt),
            startAt: window.startAt,
            endAt: window.endAt,
          },
        });
      }

      await tx.session.update({
        where: { sessionId: poll.sessionId },
        data: { status: "polling", calendarInvitePolicy },
      });
      await tx.auditLog.create({
        data: {
          userId: user.userId,
          groupId: poll.session.groupId,
          sessionId: poll.sessionId,
          pollId: finalPoll.pollId,
          action: "poll_created",
          metadata: {
            poll_type: "final_timing",
            calendar_invite_policy: calendarInvitePolicy,
            source: "availability_results",
            source_poll_id: Number(pollId),
            source_option_ids: optionIds.map(Number),
            source_option_windows: selectedOptionWindows.map((window) => ({ start_at: window.startAt.toISOString(), end_at: window.endAt.toISOString() })),
            source_windows: windows.map((window) => ({ start_at: window.startAt.toISOString(), end_at: window.endAt.toISOString() })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.userId,
          groupId: poll.session.groupId,
          sessionId: poll.sessionId,
          pollId: finalPoll.pollId,
          action: "poll_published",
          metadata: { poll_type: "final_timing", source: "availability_results" },
        },
      });

      return finalPoll;
    });

    return dataResponse({
      poll_id: Number(created.pollId),
      session_id: Number(created.sessionId),
      type: created.type,
      status: created.status,
      multi_choice: created.multiChoice,
      deadline: created.deadline?.toISOString() ?? null,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

async function bestWindowsForOptions(
  pollId: bigint,
  optionIds: bigint[],
  selectedOptions: { optionId: bigint; startAt: Date | null; endAt: Date | null }[],
) {
  const rows = await prisma.$queryRaw<ResponseRow[]>`
    select option_id, start_at, end_at
    from availability_responses
    where poll_id = ${pollId}
      and option_id in (${Prisma.join(optionIds)})
    order by option_id asc, start_at asc
  `;
  const recommendations = recommendationsFromResponses(rows);

  return selectedOptions.map((option) => {
    const recommended = recommendations.find((item) => item.optionId === option.optionId.toString());
    return {
      startAt: recommended?.startAt ?? option.startAt!,
      endAt: recommended?.endAt ?? option.endAt!,
    };
  });
}

function recommendationsFromResponses(rows: ResponseRow[]) {
  const byOption = new Map<string, ResponseRow[]>();
  for (const row of rows) {
    const key = row.option_id.toString();
    byOption.set(key, [...(byOption.get(key) ?? []), row]);
  }

  const recommendations: {
    optionId: string;
    startAt: Date;
    endAt: Date;
    availableCount: number;
    durationMs: number;
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
          optionId,
          startAt: new Date(start),
          endAt: new Date(end),
          availableCount: active,
          durationMs: end - start,
        });
      }
    }
  }

  return recommendations.sort((a, b) =>
    a.optionId.localeCompare(b.optionId) ||
    b.availableCount - a.availableCount ||
    b.durationMs - a.durationMs ||
    a.startAt.getTime() - b.startAt.getTime(),
  );
}

function parseWindows(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new ApiError("VALIDATION_ERROR", "windows must be an array.");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new ApiError("VALIDATION_ERROR", "Each window must be an object.");
    }
    const raw = item as { start_at?: unknown; end_at?: unknown };
    const startAt = requiredDate(raw.start_at, "start_at");
    const endAt = requiredDate(raw.end_at, "end_at");
    if (endAt <= startAt) {
      throw new ApiError("VALIDATION_ERROR", "end_at must be after start_at.");
    }
    return { startAt, endAt };
  });
}

function generatedOptionLabel(startAt: Date, endAt: Date) {
  return `${startAt.toISOString()} - ${endAt.toISOString()}`;
}
