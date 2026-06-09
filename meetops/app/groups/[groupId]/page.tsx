import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { RoleBadge } from "@/components/common/Badge";
import { ButtonLink } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { PollCard } from "@/components/polls/PollCard";
import { SessionCard } from "@/components/sessions/SessionCard";
import { getGroup, getGroupSessions, getSessionPolls, getUser } from "@/lib/mock-data";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const group = getGroup(groupId);

  if (!group) {
    return <AuthenticatedPage><PageHeader title="Group not found" /></AuthenticatedPage>;
  }

  const groupSessions = getGroupSessions(group.id);
  const groupPolls = groupSessions.flatMap((session) => getSessionPolls(session.id));
  const owner = getUser(group.meetingOwnerId);

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title={group.name}
          subtitle={group.description}
          badge={<RoleBadge role={group.role} />}
          primaryAction={<ButtonLink href={`/sessions/new?groupId=${group.id}`} tone="primary">Create session</ButtonLink>}
          secondaryActions={group.role === "admin" ? <ButtonLink href={`/groups/${group.id}/settings`}>Settings</ButtonLink> : null}
        />
        <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
          <div className="space-y-6">
            <section>
              <SectionTitle title="Upcoming sessions" />
              <div className="space-y-3">
                {groupSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </section>
            <section>
              <SectionTitle title="Active polls" />
              <div className="space-y-3">
                {groupPolls.filter((poll) => poll.status === "active").map((poll) => (
                  <PollCard key={poll.id} poll={poll} />
                ))}
              </div>
            </section>
          </div>
          <aside className="space-y-4">
            <Card>
              <SectionTitle title="Group info" />
              <Info label="Members" value={String(group.memberCount)} />
              <Info label="Admins" value={String(group.adminCount)} />
              <Info label="Current role" value={group.role === "admin" ? "Admin" : "Member"} />
            </Card>
            <Card>
              <SectionTitle title="Meeting owner" />
              <Info label="Account" value={owner?.email ?? "Fallback to host"} />
              <Info label="Calendar" value={owner?.hasCalendarScope ? "Calendar connected" : "Needs reconnect"} />
            </Card>
            {group.role === "admin" ? (
              <Card>
                <SectionTitle title="Invite code" />
                <Info label="Code" value={group.inviteCode} />
                <Info label="Usage" value={`${group.inviteUsedCount} / ${group.inviteMaxUses} used`} />
              </Card>
            ) : null}
            <Card>
              <SectionTitle title="Quick actions" />
              <div className="space-y-2">
                <ButtonLink href={`/sessions/new?groupId=${group.id}`} tone="primary" className="w-full">Create session</ButtonLink>
                <ButtonLink href="/groups/join" className="w-full">Join settings</ButtonLink>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </AuthenticatedPage>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-zinc-100 py-3 first:border-t-0 first:pt-0">
      <div className="text-xs font-medium uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-sm text-zinc-900">{value}</div>
    </div>
  );
}
