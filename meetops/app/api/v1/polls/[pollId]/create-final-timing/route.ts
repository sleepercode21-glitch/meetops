import { NextRequest } from "next/server";
import { ApiError, dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollManager } from "@/lib/api/guards";
import { parseBigIntParam, requiredDate } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };

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

    const body = (await request.json()) as { option_ids?: unknown; windows?: unknown; deadline?: unknown };
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

    const selectedOptions = optionIds.length ? poll.options
      .filter((option) => optionIds.some((optionId) => optionId === option.optionId))
      .sort((a, b) => optionIds.findIndex((id) => id === a.optionId) - optionIds.findIndex((id) => id === b.optionId)) : [];

    if (selectedOptions.length !== optionIds.length) {
      throw new ApiError("INVALID_POLL_OPTION", "Every option must belong to this availability poll.");
    }
    if (selectedOptions.some((option) => !option.startAt || !option.endAt)) {
      throw new ApiError("INVALID_POLL_OPTION", "Availability options must have start and end times.");
    }

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

      for (const option of selectedOptions) {
        await tx.pollOption.create({
          data: {
            pollId: finalPoll.pollId,
            label: option.label,
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
        data: { status: "polling" },
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
            source: "availability_results",
            source_poll_id: Number(pollId),
            source_option_ids: optionIds.map(Number),
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
