import { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollManager } from "@/lib/api/guards";
import { assertPollDraft, assertTimeOptionValidity, pollOptionResponse } from "@/lib/api/poll-utils";
import { optionalDate, optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ suggestionId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { suggestionId: id } = await context.params;
    const suggestionId = parseBigIntParam(id, "suggestionId");
    const suggestion = await prisma.suggestedOption.findUniqueOrThrow({ where: { suggestionId } });
    const { poll } = await requirePollManager(user.userId, suggestion.pollId);
    assertPollDraft(poll.status);
    const body = (await request.json().catch(() => ({}))) as { label?: unknown; start_at?: unknown; end_at?: unknown };
    const label = optionalString(body.label, "label", 255) ?? suggestion.suggestion;
    const startAt = optionalDate(body.start_at, "start_at") ?? null;
    const endAt = optionalDate(body.end_at, "end_at") ?? null;
    assertTimeOptionValidity({ pollType: poll.type, startAt, endAt });
    const option = await prisma.$transaction(async (tx) => {
      const created = await tx.pollOption.create({ data: { pollId: poll.pollId, label, startAt, endAt } });
      await tx.auditLog.create({
        data: { userId: user.userId, groupId: poll.session.groupId, sessionId: poll.sessionId, pollId: poll.pollId, action: "poll_option_created", metadata: { source_suggestion_id: Number(suggestionId) } },
      });
      return created;
    });
    return dataResponse(pollOptionResponse(option, true), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
