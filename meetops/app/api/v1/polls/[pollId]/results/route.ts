import { NextRequest } from "next/server";
import { dataResponse, errorResponse } from "@/lib/api/errors";
import { requirePollAccess } from "@/lib/api/guards";
import { pollOptionResponse, resultsVisible } from "@/lib/api/poll-utils";
import { parseBigIntParam } from "@/lib/api/validation";
import { requireAuth } from "@/lib/auth/session";

type Context = { params: Promise<{ pollId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireAuth(request);
    const { pollId: id } = await context.params;
    const pollId = parseBigIntParam(id, "pollId");
    const { poll, member } = await requirePollAccess(user.userId, pollId);
    const visible = resultsVisible(poll, user.userId, member.isAdmin);
    const voterIds = new Set(poll.votes.map((vote) => vote.userId.toString()));
    return dataResponse({
      poll_id: Number(poll.pollId),
      type: poll.type,
      status: poll.status,
      results_visible: visible,
      total_voters: visible ? voterIds.size : null,
      options: poll.options.map((option) => pollOptionResponse(option, visible)),
      current_user_votes: poll.votes.filter((vote) => vote.userId === user.userId).map((vote) => Number(vote.optionId)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
