import { ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { StatusBadge } from "@/components/common/Badge";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import { calendarInvitePolicyLabels } from "@/lib/labels";
import type { Session } from "@/types/domain";

export function SessionCard({ session }: { session: Session }) {
  const needsAction =
    session.status === "needs_host_decision" || session.status === "scheduling_failed";

  return (
    <Card className="flex h-full flex-col transition hover:-translate-y-0.5 hover:border-teal-900/25 hover:shadow-[0_2px_8px_rgba(16,24,20,0.08),0_18px_40px_rgba(16,24,20,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-zinc-950">
              {session.topic ?? "Untitled session"}
            </h2>
            <StatusBadge status={session.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {calendarInvitePolicyLabels[session.calendarInvitePolicy]}
          </p>
        </div>
        {session.meetLink ? (
          <ButtonLink href={session.meetLink} tone="primary">
            Open Meet
          </ButtonLink>
        ) : null}
      </div>
      <p className="mt-4 line-clamp-2 text-sm text-zinc-600">
        {session.description ?? "No description provided"}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="text-sm">
          <div className="text-zinc-500">Host</div>
          <div className="font-medium text-zinc-950">Session host</div>
        </div>
        <TimeDisplay
          start={session.scheduledStartTime}
          end={session.scheduledEndTime}
        />
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <ButtonLink href={`/sessions/${session.id}`} tone={needsAction ? "primary" : "secondary"}>
          {needsAction ? "Review action" : "View session"}
        </ButtonLink>
        {needsAction ? (
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            Host/admin action required
          </span>
        ) : null}
      </div>
    </Card>
  );
}
