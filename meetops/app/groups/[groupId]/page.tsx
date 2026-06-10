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
      <div className="space-y-6">
        <PageHeader
          title={group.name}
          subtitle={`${group.description ?? "Private group sessions and polls."} ${memberCount} ${memberCount === 1 ? "member" : "members"} · You are ${role === "admin" ? "Admin" : "Member"}`}
          badge={<RoleBadge role={role} />}
          primaryAction={<ButtonLink href={`/groups/${group.group_id}/sessions/new`} tone="primary">Host Session</ButtonLink>}
        />
        <div className="flex gap-2 border-b border-zinc-200 text-sm">
          <Tab href={`/groups/${group.group_id}`} active>Sessions</Tab>
          <Tab href={`/groups/${group.group_id}/members`}>Members</Tab>
          {role === "admin" ? (
            <Tab href={`/groups/${group.group_id}/settings`}>Settings</Tab>
          ) : null}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
          <div className="space-y-6">
            <section>
              <SectionTitle title="Upcoming Sessions" subtitle="Only scheduled future sessions appear here." />
              <div className="space-y-3">
                {upcomingSessions.length ? upcomingSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                )) : (
                  <EmptyPanel text="No scheduled future sessions." />
                )}
              </div>
            </section>
            <section>
              <SectionTitle title="Planning Now" subtitle="Drafts, polls, host decisions, and scheduling work." />
              <div className="space-y-3">
                {activePlanningSessions.length ? activePlanningSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                )) : (
                  <EmptyPanel text="No active planning sessions." />
                )}
              </div>
            </section>
            <section>
              <SectionTitle
                title="Active polls"
                action={<RealtimeSessionRefresh enabled={liveEnabled} />}
              />
              <div className="space-y-3">
                {activePolls.length ? activePolls.map((poll) => (
                  <PollCard key={poll.id} poll={poll} />
                )) : (
                  <EmptyPanel text="No open polls." />
                )}
              </div>
            </section>
          </div>
          <aside className="space-y-4">
            <Card>
              <SectionTitle title="Group info" />
              <Info
                label="Members"
                value={`${memberCount} ${memberCount === 1 ? "person" : "people"} in this group.`}
              />
              <Info label="Current role" value={role === "admin" ? "Admin" : "Member"} />
              <Info label="Invite status" value={group.invite_enabled ? "Enabled" : "Disabled"} />
            </Card>
            <Card>
              <SectionTitle title="Meeting owner" />
              <Info label="Account" value={owner?.email ?? "Fallback to host"} />
              <Info label="Calendar" value={owner?.calendar_events_scope_granted ? "Calendar connected" : "Needs reconnect"} />
            </Card>
            {role === "admin" ? (
              <Card>
                <SectionTitle title="Invite code" />
                <Info label="Code" value={group.invite_code ?? "Disabled"} />
                <Info label="Usage" value={`${group.invite_used_count} / ${group.invite_max_uses} used`} />
              </Card>
            ) : null}
            <Card>
              <SectionTitle title="Quick actions" />
              <div className="space-y-2">
                <ButtonLink href={`/groups/${group.group_id}/sessions/new`} tone="primary" className="w-full">Host Session</ButtonLink>
                <ButtonLink href="/groups/join" className="w-full">Join another group</ButtonLink>
              </div>
            </Card>
          </aside>
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

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-t border-zinc-100 py-3 first:border-t-0 first:pt-0">
      <div className="text-xs font-medium uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-sm text-zinc-900">{value}</div>
    </div>
  );
}
