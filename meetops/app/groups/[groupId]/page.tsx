import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { RoleBadge } from "@/components/common/Badge";
import { ButtonLink } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { PollCard } from "@/components/polls/PollCard";
import { RealtimeSessionRefresh } from "@/components/sessions/RealtimeSessionRefresh";
import { SessionCard } from "@/components/sessions/SessionCard";
import { sessionStatusLabels } from "@/lib/labels";
import {
  ApiRequestError,
  getGroupDetail,
  getGroupMembers,
  getGroupSessions,
  getSessionPolls,
  groupRole,
} from "@/lib/web-api";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { group, memberCount } = await getAccessibleGroup(groupId);
  const role = groupRole(group.current_user_membership.is_admin);
  const { sessions: groupSessions } = await getGroupSessions(String(group.group_id));
  const visibleSessions = groupSessions.filter((session) => !["cancelled", "completed"].includes(session.status));
  const upcomingSessions = groupSessions.filter((session) => session.status === "scheduled");
  const activePlanningSessions = visibleSessions.filter((session) => session.status !== "scheduled");
  const completedSessions = groupSessions.filter((session) => session.status === "completed");
  const cancelledSessions = groupSessions.filter((session) => session.status === "cancelled");
  const groupPolls = (await Promise.all(
    visibleSessions.map((session) => getSessionPolls(session.id)),
  )).flat();
  const activePolls = groupPolls.filter((poll) => poll.status === "active");
  const liveEnabled = activePolls.length > 0 || activePlanningSessions.length > 0;
  const owner = group.default_meeting_owner;

  return (
    <AuthenticatedPage>
      <div className="space-y-5">
        <PageHeader
          title={group.name}
          subtitle={group.description ?? "Private group sessions and polls."}
          badge={<RoleBadge role={role} />}
          primaryAction={<ButtonLink href={`/groups/${group.group_id}/sessions/new`} tone="primary">Host Session</ButtonLink>}
        />
        <div className="flex flex-wrap gap-2">
          <MetaChip label="Members" value={String(memberCount)} />
          <MetaChip label="Invite" value={group.invite_enabled ? "Enabled" : "Disabled"} />
          <MetaChip label="Meet owner" value={owner?.email ?? "Host fallback"} />
        </div>
        <div className="flex gap-2 border-b border-zinc-200 text-sm">
          <Tab href={`/groups/${group.group_id}`} active>Sessions</Tab>
          <Tab href={`/groups/${group.group_id}/members`}>Members</Tab>
          <Tab href={`/groups/${group.group_id}/history`}>History</Tab>
          {role === "admin" ? (
            <Tab href={`/groups/${group.group_id}/settings`}>Settings</Tab>
          ) : null}
        </div>
        <div className="grid auto-rows-fr gap-3 md:grid-cols-4">
          <OverviewCard label="Open polls" value={activePolls.length} helper="Need votes now" />
          <OverviewCard label="Planning" value={activePlanningSessions.length} helper="Drafts and decisions" />
          <OverviewCard label="Scheduled" value={upcomingSessions.length} helper="Confirmed meets" />
          <OverviewCard label="History" value={completedSessions.length + cancelledSessions.length} helper="Closed sessions" href={`/groups/${group.group_id}/history`} />
        </div>
        <div className="space-y-5">
          <section>
            <SectionTitle
              title="Active polls"
              subtitle="Open votes and availability checks that need member input."
              action={<RealtimeSessionRefresh enabled={liveEnabled} intervalMs={500} />}
            />
            <div className="grid auto-rows-fr gap-3">
              {activePolls.length ? activePolls.map((poll) => (
                <PollCard key={poll.id} poll={poll} />
              )) : (
                <EmptyPanel
                  title="No open polls"
                  body="When a host opens a vote or availability check, it will appear here for members."
                  action={role === "admin" ? <ButtonLink href={`/groups/${group.group_id}/sessions/new`}>Host Session</ButtonLink> : null}
                />
              )}
            </div>
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            <section>
              <SectionTitle title="Planning" subtitle="Drafts, polls, host decisions, and scheduling work." />
              <div className="grid auto-rows-fr gap-3">
                {activePlanningSessions.length ? activePlanningSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                )) : (
                  <EmptyPanel
                    title="No planning sessions"
                    body="Start a session to collect interest, pick a topic, gather availability, or jump straight to timing."
                    action={role === "admin" ? <ButtonLink href={`/groups/${group.group_id}/sessions/new`} tone="primary">Host Session</ButtonLink> : null}
                  />
                )}
              </div>
            </section>
            <section>
              <SectionTitle title="Scheduled" subtitle="Confirmed upcoming sessions." />
              <div className="grid auto-rows-fr gap-3">
                {upcomingSessions.length ? upcomingSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                )) : (
                  <EmptyPanel
                    title="No scheduled sessions"
                    body="Final timing winners and Google Meet links will land here once scheduling is complete."
                  />
                )}
              </div>
            </section>
          </div>
          {groupSessions.length ? (
            <section>
              <SectionTitle
                title="Recent sessions"
                subtitle="A quick read on the latest work in this group."
                action={<ButtonLink href={`/groups/${group.group_id}/history`}>View history</ButtonLink>}
              />
              <div className="grid auto-rows-fr gap-3 lg:grid-cols-3">
                {groupSessions.slice(0, 3).map((session) => (
                  <Card key={session.id} className="flex h-full flex-col p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-zinc-950">{session.topic ?? "Untitled session"}</h3>
                        <p className="mt-1 text-sm text-zinc-600">{sessionStatusLabels[session.status]}</p>
                      </div>
                    </div>
                    <div className="mt-auto pt-4">
                      <ButtonLink href={`/sessions/${session.id}`} className="shrink-0">Open</ButtonLink>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </AuthenticatedPage>
  );
}

function EmptyPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex h-full min-h-24 flex-col gap-3 border-dashed bg-white/70 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-semibold text-zinc-950">{title}</h3>
        <p className="mt-1 text-sm text-zinc-600">{body}</p>
      </div>
      {action}
    </Card>
  );
}

function OverviewCard({
  label,
  value,
  helper,
  href,
}: {
  label: string;
  value: number;
  helper: string;
  href?: string;
}) {
  const content = (
    <Card className="flex h-full flex-col p-4 transition hover:-translate-y-0.5 hover:border-teal-900/20">
      <div className="text-2xl font-semibold text-zinc-950">{value}</div>
      <div className="mt-1 text-sm font-medium text-zinc-900">{label}</div>
      <div className="mt-1 text-xs text-zinc-500">{helper}</div>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 text-sm shadow-sm">
      <span className="text-zinc-500">{label}: </span>
      <span className="font-medium text-zinc-900">{value}</span>
    </div>
  );
}

async function getAccessibleGroup(groupId: string) {
  try {
    const [group, { page }] = await Promise.all([
      getGroupDetail(groupId),
      getGroupMembers(groupId),
    ]);
    return { group, memberCount: page.total };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === 403 || error.status === 404)
    ) {
      redirect("/groups");
    }
    throw error;
  }
}

function Tab({
  href,
  active = false,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ButtonLink
      href={href}
      tone="ghost"
      className={`rounded-b-none border-x-0 border-t-0 px-2.5 ${active ? "border-zinc-950 text-zinc-950" : "border-transparent"}`}
    >
      {children}
    </ButtonLink>
  );
}
