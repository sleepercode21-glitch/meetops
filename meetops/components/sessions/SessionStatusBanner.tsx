import { ActionRequiredBanner } from "@/components/common/ActionRequiredBanner";
import { ButtonLink } from "@/components/common/Buttons";
import { formatDateRange } from "@/lib/date-time";
import type { Session } from "@/types/domain";

export function SessionStatusBanner({ session }: { session: Session }) {
  if (session.status === "needs_host_decision") {
    return (
      <ActionRequiredBanner
        title="Host decision needed"
        body="The final timing poll ended in a tie or received no votes. Choose a time manually or create another poll."
        href={`/sessions/${session.id}/reschedule`}
        actionLabel="Choose time"
      />
    );
  }

  if (session.status === "scheduling_failed") {
    return (
      <ActionRequiredBanner
        title="Scheduling failed"
        body="The app could not create or update the Google Calendar event and Meet link."
        href={`/sessions/${session.id}/reschedule`}
        actionLabel="Retry scheduling"
        tone="red"
      />
    );
  }

  if (session.status === "scheduled") {
    return (
      <ActionRequiredBanner
        title="Session scheduled"
        body={`${formatDateRange(session.scheduledStartTime, session.scheduledEndTime)}. The Meet link is ready for members.`}
        href={session.meetLink ?? "#"}
        actionLabel="Open Meet"
        tone="green"
      />
    );
  }

  if (session.status === "polling") {
    return (
      <ActionRequiredBanner
        title="Poll in progress"
        body="Voting is open. Results are final after the poll closes."
        href={`#active-polls`}
        actionLabel="Vote now"
        tone="blue"
      />
    );
  }

  if (session.status === "draft") {
    return (
      <ActionRequiredBanner
        title="Session draft"
        body="Create a poll to collect interest, topics, availability, or final timing votes."
        href={`/sessions/${session.id}/polls/new`}
        actionLabel="Create poll"
        tone="neutral"
      />
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="font-semibold text-zinc-950">Session status</div>
      <p className="mt-1 text-sm text-zinc-600">
        This session is preserved with its current state and available actions.
      </p>
      <ButtonLink href={`/sessions/${session.id}/edit`} className="mt-3">
        Edit session
      </ButtonLink>
    </div>
  );
}
