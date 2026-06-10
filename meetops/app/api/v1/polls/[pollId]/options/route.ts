import { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollManager } from "@/lib/api/guards";
import { assertPollDraft, assertTimeOptionValidity, normalizePollOptionLabel, pollOptionResponse } from "@/lib/api/poll-utils";
import { optionalDate, optionalString, parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ pollId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    const { poll } = await requirePollManager(user.userId, pollId);
    assertPollDraft(poll.status);
    const body = (await request.json()) as { label?: unknown; start_at?: unknown; end_at?: unknown };
    const label = normalizePollOptionLabel(
      poll.type,
      optionalString(body.label, "label", 255, { required: true }) ?? "",
    );
    const startAt = optionalDate(body.start_at, "start_at") ?? null;
    const endAt = optionalDate(body.end_at, "end_at") ?? null;
    assertTimeOptionValidity({ pollType: poll.type, startAt, endAt });
    const option = await prisma.$transaction(async (tx) => {
      const created = await tx.pollOption.create({ data: { pollId, label, startAt, endAt } });
      await tx.auditLog.create({
        data: { userId: user.userId, groupId: poll.session.groupId, sessionId: poll.sessionId, pollId, action: "poll_option_created", metadata: { label } },
      });
      return created;
    });
    return dataResponse(pollOptionResponse(option, true), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
