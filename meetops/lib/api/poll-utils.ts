import type { Poll, PollOption, PollStatus, PollType, SessionStatus, SuggestedOption, User } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { toId, toIso } from "@/lib/api/formatters";

export const pollTypes = [
  "interest",
  "topic",
  "availability",
  "final_timing",
] as const satisfies readonly PollType[];

export function statusForPollType(type: PollType): SessionStatus {
  if (type === "interest") return "interest_check";
  if (type === "topic") return "topic_selection";
  if (type === "availability") return "availability_collection";
  return "polling";
}

export function resultsVisible(
  poll: Pick<Poll, "status"> & { session: { hostId: bigint } },
  userId: bigint,
  isAdmin: boolean,
) {
  return poll.status === "closed" || poll.session.hostId === userId || isAdmin;
}

export function assertPollDraft(status: PollStatus) {
  if (status !== "draft") {
    throw new ApiError(
      "INVALID_POLL_STATUS",
      "Poll options can only be changed while the poll is a draft.",
    );
  }
}

export function assertTimeOptionValidity({
  pollType,
  startAt,
  endAt,
}: {
  pollType: PollType;
  startAt: Date | null | undefined;
  endAt: Date | null | undefined;
}) {
  const needsTime = pollType === "availability" || pollType === "final_timing";
  if (needsTime && (!startAt || !endAt)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Time-based polls require start_at and end_at.",
    );
  }
  if (needsTime && startAt && startAt <= new Date()) {
    throw new ApiError("VALIDATION_ERROR", "start_at must be in the future.");
  }
  if (startAt && endAt && endAt <= startAt) {
    throw new ApiError("VALIDATION_ERROR", "end_at must be after start_at.");
  }
  if (!needsTime && (startAt || endAt)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Interest and topic poll options cannot include start_at or end_at.",
    );
  }
}

export function normalizeInterestOptionLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized === "interested") return "Interested";
  if (normalized === "maybe") return "Maybe";
  throw new ApiError(
    "VALIDATION_ERROR",
    "Interest polls only support Interested and Maybe options.",
  );
}

export function normalizePollOptionLabel(pollType: PollType, label: string) {
  return pollType === "interest" ? normalizeInterestOptionLabel(label) : label;
}

export function pollOptionResponse(option: Pick<PollOption, "optionId" | "pollId" | "label" | "startAt" | "endAt" | "createdAt" | "updatedAt"> & { _count?: { votes: number } }, showVotes: boolean) {
  return {
    option_id: toId(option.optionId),
    poll_id: toId(option.pollId),
    label: option.label,
    start_at: toIso(option.startAt),
    end_at: toIso(option.endAt),
    vote_count: showVotes ? option._count?.votes ?? 0 : null,
    created_at: option.createdAt.toISOString(),
    updated_at: option.updatedAt.toISOString(),
  };
}

export function suggestionResponse(
  suggestion: Pick<SuggestedOption, "suggestionId" | "pollId" | "suggestion" | "suggestedBy" | "createdAt"> & {
    user?: Pick<User, "userId" | "firstname" | "lastname">;
  },
) {
  return {
    suggestion_id: toId(suggestion.suggestionId),
    poll_id: toId(suggestion.pollId),
    suggestion: suggestion.suggestion,
    suggested_by: suggestion.user
      ? {
          user_id: toId(suggestion.user.userId),
          firstname: suggestion.user.firstname,
          lastname: suggestion.user.lastname,
        }
      : toId(suggestion.suggestedBy),
    created_at: suggestion.createdAt.toISOString(),
  };
}

export function pollResponse(
  poll: Pick<Poll, "pollId" | "sessionId" | "type" | "status" | "multiChoice" | "deadline" | "createdBy" | "createdAt" | "updatedAt" | "publishedAt" | "closedAt"> & {
    session: { hostId: bigint };
    options: (Pick<PollOption, "optionId" | "pollId" | "label" | "startAt" | "endAt" | "createdAt" | "updatedAt"> & { _count?: { votes: number } })[];
    votes?: { optionId: bigint; userId: bigint }[];
    suggestions?: (Pick<SuggestedOption, "suggestionId" | "pollId" | "suggestion" | "suggestedBy" | "createdAt"> & { user?: Pick<User, "userId" | "firstname" | "lastname"> })[];
  },
  userId: bigint,
  isAdmin: boolean,
) {
  const showVotes = resultsVisible(poll, userId, isAdmin);
  return {
    poll_id: toId(poll.pollId),
    session_id: toId(poll.sessionId),
    type: poll.type,
    status: poll.status,
    multi_choice: poll.multiChoice,
    deadline: toIso(poll.deadline),
    created_by: toId(poll.createdBy),
    published_at: toIso(poll.publishedAt),
    closed_at: toIso(poll.closedAt),
    current_user_votes: (poll.votes ?? [])
      .filter((vote) => vote.userId === userId)
      .map((vote) => toId(vote.optionId)),
    results_visible: showVotes,
    options: poll.options.map((option) => pollOptionResponse(option, showVotes)),
    suggestions: (poll.suggestions ?? []).map(suggestionResponse),
    current_user_can_manage: poll.session.hostId === userId || isAdmin,
    created_at: poll.createdAt.toISOString(),
    updated_at: poll.updatedAt.toISOString(),
  };
}
