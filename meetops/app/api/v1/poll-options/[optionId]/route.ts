import { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollManager } from "@/lib/api/guards";
import { assertPollDraft, assertTimeOptionValidity, normalizePollOptionLabel, pollOptionResponse } from "@/lib/api/poll-utils";
import { optionalDate, optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ optionId: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { optionId: id } = await context.params;
    const optionId = parseBigIntParam(id, "optionId");
    const option = await prisma.pollOption.findUniqueOrThrow({ where: { optionId }, include: { poll: { include: { session: true } } } });
    const { poll } = await requirePollManager(user.userId, option.pollId);
    assertPollDraft(poll.status);
    const body = (await request.json()) as { label?: unknown; start_at?: unknown; end_at?: unknown };
    const startAt = optionalDate(body.start_at, "start_at");
    const endAt = optionalDate(body.end_at, "end_at");
    const nextStart = startAt !== undefined ? startAt : option.startAt;
    const nextEnd = endAt !== undefined ? endAt : option.endAt;
    assertTimeOptionValidity({ pollType: poll.type, startAt: nextStart, endAt: nextEnd });
    const rawLabel = optionalString(body.label, "label", 255);
    const label = rawLabel !== undefined
      ? normalizePollOptionLabel(poll.type, rawLabel || generatedOptionLabel(poll.type, nextStart, nextEnd))
      : undefined;
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.pollOption.update({
        where: { optionId },
        data: { ...(label !== undefined ? { label: label ?? "" } : {}), ...(startAt !== undefined ? { startAt } : {}), ...(endAt !== undefined ? { endAt } : {}) },
      });
      await tx.auditLog.create({
        data: { userId: user.userId, groupId: poll.session.groupId, sessionId: poll.sessionId, pollId: poll.pollId, action: "poll_option_updated", metadata: { option_id: Number(optionId) } },
      });
      return changed;
    });
    return dataResponse(pollOptionResponse(updated, true));
  } catch (error) {
    return errorResponse(error);
  }
}

function generatedOptionLabel(pollType: string, startAt: Date | null, endAt: Date | null) {
  if ((pollType === "availability" || pollType === "final_timing") && startAt && endAt) {
    return `${startAt.toISOString()} - ${endAt.toISOString()}`;
  }
  return "Option";
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { optionId: id } = await context.params;
    const optionId = parseBigIntParam(id, "optionId");
    const option = await prisma.pollOption.findUniqueOrThrow({ where: { optionId }, include: { poll: { include: { session: true } } } });
    const { poll } = await requirePollManager(user.userId, option.pollId);
    assertPollDraft(poll.status);
    await prisma.$transaction([
      prisma.pollOption.delete({ where: { optionId } }),
      prisma.auditLog.create({
        data: { userId: user.userId, groupId: poll.session.groupId, sessionId: poll.sessionId, pollId: poll.pollId, action: "poll_option_deleted", metadata: { option_id: Number(optionId) } },
      }),
    ]);
    return dataResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
