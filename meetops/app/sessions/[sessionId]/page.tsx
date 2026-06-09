import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { StatusBadge } from "@/components/common/Badge";
import { ButtonLink } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import { PollCard } from "@/components/polls/PollCard";
import { SuggestionPanel } from "@/components/polls/SuggestionPanel";
import { SessionStatusBanner } from "@/components/sessions/SessionStatusBanner";
import { calendarInvitePolicyLabels } from "@/lib/labels";
import {
  currentUser,
  getGroup,
  getPollSuggestions,
  getSession,
  getSessionPolls,
  getUser,
} from "@/lib/mock-data";
import { canManageSession } from "@/lib/permissions";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return <AuthenticatedPage><PageHeader title="Session not found" /></AuthenticatedPage>;
  }

  const group = getGroup(session.groupId);
  const host = getUser(session.hostId);
  const owner = getUser(session.meetingOwnerId ?? group?.meetingOwnerId);
  const sessionPolls = getSessionPolls(session.id);
  const activePolls = sessionPolls.filter((poll) => poll.status === "active");
  const draftPolls = sessionPolls.filter((poll) => poll.status === "draft");
  const closedPolls = sessionPolls.filter((poll) => poll.status === "closed");
  const canManage = canManageSession(currentUser, session, group);
  const pollSuggestions = sessionPolls.flatMap((poll) => getPollSuggestions(poll.id));

  const primaryAction =
    session.status === "scheduled" && session.meetLink ? (
      <ButtonLink href={session.meetLink} tone="primary">Open Meet link</ButtonLink>
    ) : canManage ? (
      <ButtonLink href={`/sessions/${session.id}/polls/new`} tone="primary">Create poll</ButtonLink>
    ) : (
      <ButtonLink href="#active-polls" tone="primary">Vote now</ButtonLink>
    );

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title={session.topic ?? "Untitled session"}
          subtitle={session.description ?? "No description provided"}
          badge={<StatusBadge status={session.status} />}
          breadcrumb={<a href={`/groups/${group?.id}`}>{group?.name}</a>}
          primaryAction={primaryAction}
          secondaryActions={canManage ? <ButtonLink href={`/sessions/${session.id}/edit`}>Edit session</ButtonLink> : null}
        />
        <SessionStatusBanner session={session} />
        <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
          <main className="space-y-6">
            {session.scheduledStartTime ? (
              <Card>
                <SectionTitle title="Scheduled session" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TimeDisplay start={session.scheduledStartTime} end={session.scheduledEndTime} />
                  <Info label="Meeting owner" value={owner?.email ?? "Fallback to host"} />
                  <Info label="Invite policy" value={calendarInvitePolicyLabels[session.calendarInvitePolicy]} />
                  <Info label="Meet link" value={session.meetLink ?? "Not created"} />
                </div>
                {session.meetLink ? (
                  <ButtonLink href={session.meetLink} tone="primary" className="mt-4">Open Meet link</ButtonLink>
                ) : null}
              </Card>
            ) : null}
            <section id="active-polls">
              <SectionTitle title="Active polls" />
              <div className="space-y-3">
                {activePolls.length ? activePolls.map((poll) => <PollCard key={poll.id} poll={poll} />) : <Card><p className="text-sm text-zinc-600">No active polls.</p></Card>}
              </div>
            </section>
            {canManage ? (
              <section>
                <SectionTitle title="Draft polls" subtitle="Draft polls are not visible for voting until published." />
                <div className="space-y-3">
                  {draftPolls.length ? draftPolls.map((poll) => <PollCard key={poll.id} poll={poll} />) : <Card><p className="text-sm text-zinc-600">No draft polls.</p></Card>}
                </div>
              </section>
            ) : null}
            <section>
              <SectionTitle title="Closed polls and history" />
              <div className="space-y-3">
                {closedPolls.map((poll) => <PollCard key={poll.id} poll={poll} />)}
              </div>
            </section>
            <SuggestionPanel suggestions={pollSuggestions} canManage={canManage} />
          </main>
          <aside className="space-y-4">
            <Card>
              <SectionTitle title="Session info" />
              <Info label="Group" value={group?.name ?? "Unknown"} />
              <Info label="Host" value={host?.name ?? "Unknown"} />
              <Info label="Invite policy" value={calendarInvitePolicyLabels[session.calendarInvitePolicy]} />
              <Info label="Status" value={session.status} />
            </Card>
            <Card>
              <SectionTitle title="Meeting owner" />
              <Info label="Account" value={owner?.email ?? "Fallback to host"} />
              <Info label="Permission" value={owner?.hasCalendarScope ? "Calendar connected" : "Needs reconnect"} />
            </Card>
            {canManage ? (
              <Card>
                <SectionTitle title="Host actions" />
                <div className="space-y-2">
                  <ButtonLink href={`/sessions/${session.id}/polls/new`} tone="primary" className="w-full">Create poll</ButtonLink>
                  <ButtonLink href={`/sessions/${session.id}/reschedule`} className="w-full">Reschedule</ButtonLink>
                  <ButtonLink href={`/sessions/${session.id}/edit`} className="w-full">Edit session</ButtonLink>
                </div>
              </Card>
            ) : null}
            {canManage ? (
              <Card>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-950">Technical details</summary>
                  <dl className="mt-3 space-y-2 text-sm">
                    <Info label="session_id" value={session.id} />
                    <Info label="group_id" value={session.groupId} />
                    <Info label="selected_option_id" value={session.selectedOptionId ?? "None"} />
                    <Info label="calendar_event_id" value={session.calendarEventUrl ? "demo-event" : "None"} />
                    <Info label="scheduling_attempt_count" value={String(session.schedulingAttemptCount)} />
                    <Info label="scheduling_error" value={session.schedulingError ?? "None"} />
                  </dl>
                </details>
              </Card>
            ) : null}
          </aside>
        </div>
      </div>
    </AuthenticatedPage>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-zinc-500">{label}</div>
      <div className="mt-1 break-words text-sm text-zinc-900">{value}</div>
    </div>
  );
}
