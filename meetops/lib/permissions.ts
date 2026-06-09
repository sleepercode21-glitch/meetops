import type { Group, Poll, Session, User } from "@/types/domain";

export function canManageGroup(group?: Group) {
  return group?.role === "admin";
}

export function canManageSession(user: User, session?: Session, group?: Group) {
  return Boolean(session && (group?.role === "admin" || session.hostId === user.id));
}

export function canCreatePoll(user: User, session?: Session, group?: Group) {
  return canManageSession(user, session, group) && !isTerminal(session?.status);
}

export function canEditDraftPoll(
  user: User,
  poll?: Poll,
  session?: Session,
  group?: Group,
) {
  return poll?.status === "draft" && canManageSession(user, session, group);
}

export function canPublishPoll(
  user: User,
  poll?: Poll,
  session?: Session,
  group?: Group,
) {
  return canEditDraftPoll(user, poll, session, group) && Boolean(poll?.options.length);
}

export function canVote(poll?: Poll, session?: Session, group?: Group) {
  return Boolean(
    poll?.status === "active" &&
      group &&
      !isTerminal(session?.status) &&
      (!poll.deadline || new Date(poll.deadline).getTime() > Date.now()),
  );
}

export function canSubmitSuggestion(poll?: Poll, session?: Session, group?: Group) {
  return Boolean(poll?.acceptsSuggestions && group && !isTerminal(session?.status));
}

export function canHandleHostDecision(
  user: User,
  session?: Session,
  group?: Group,
) {
  return session?.status === "needs_host_decision" && canManageSession(user, session, group);
}

export function canRetryScheduling(user: User, session?: Session, group?: Group) {
  return session?.status === "scheduling_failed" && canManageSession(user, session, group);
}

export function canViewAuditLog(group?: Group) {
  return group?.role === "admin";
}

function isTerminal(status?: Session["status"]) {
  return status === "cancelled" || status === "completed";
}
