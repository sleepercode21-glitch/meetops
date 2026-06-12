import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { RoleBadge } from "@/components/common/Badge";
import { ButtonLink } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { PollCard } from "@/components/polls/PollCard";
import { RealtimeSessionRefresh } from "@/components/sessions/RealtimeSessionRefresh";
import { SessionCard } from "@/components/sessions/SessionCard";
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
          {role === "admin" ? (
            <Tab href={`/groups/${group.group_id}/settings`}>Settings</Tab>
          ) : null}
        </div>
        <div className="space-y-5">
          <section>
            <SectionTitle
              title="Active polls"
              subtitle="Open votes and availability checks that need member input."
              action={<RealtimeSessionRefresh enabled={liveEnabled} intervalMs={1000} />}
            />
            <div className="space-y-3">
              {activePolls.length ? activePolls.map((poll) => (
                <PollCard key={poll.id} poll={poll} />
              )) : (
                <EmptyPanel text="No open polls." />
              )}
            </div>
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            <section>
              <SectionTitle title="Planning" subtitle="Drafts, polls, host decisions, and scheduling work." />
              <div className="space-y-3">
                {activePlanningSessions.length ? activePlanningSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                )) : (
                  <EmptyPanel text="No active planning sessions." />
                )}
              </div>
            </section>
            <section>
              <SectionTitle title="Scheduled" subtitle="Confirmed upcoming sessions." />
              <div className="space-y-3">
                {upcomingSessions.length ? upcomingSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                )) : (
                  <EmptyPanel text="No scheduled future sessions." />
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AuthenticatedPage>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <Card>
      <p className="text-sm text-zinc-600">{text}</p>
    </Card>
  );
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
