import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { ButtonLink } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/States";
import { GroupCard } from "@/components/groups/GroupCard";
import { RealtimeSessionRefresh } from "@/components/sessions/RealtimeSessionRefresh";
import { SessionCard } from "@/components/sessions/SessionCard";
import { getCurrentUser, getGroupSessions, getGroups } from "@/lib/web-api";

export default async function DashboardPage() {
  const [currentUser, groups] = await Promise.all([getCurrentUser(), getGroups()]);
  const sessions = (await Promise.all(groups.map((group) => getGroupSessions(group.id)))).flatMap(
    ({ sessions: groupSessions }) => groupSessions,
  );
  const activeSessions = sessions.filter((session) => !["cancelled", "completed", "scheduled"].includes(session.status));
  const scheduledSessions = sessions.filter((session) => session.status === "scheduled");
  const needsAttention = sessions.filter((session) => ["needs_host_decision", "scheduling_failed"].includes(session.status));

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          subtitle={`${groups.length} groups · ${activeSessions.length} planning · ${scheduledSessions.length} scheduled · ${needsAttention.length} need action`}
          badge={<RealtimeSessionRefresh enabled intervalMs={15000} />}
          primaryAction={<ButtonLink href="/groups/join" tone="primary">Join Group</ButtonLink>}
          secondaryActions={
            <>
              {currentUser.platformOwner ? <ButtonLink href="/platform/users">Users</ButtonLink> : null}
              <ButtonLink href="/groups/new">Create Group</ButtonLink>
            </>
          }
        />

        {currentUser.platformOwner ? (
          <Card className="border-teal-100 bg-teal-50/70">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-teal-950">Platform owner tools</h2>
                <p className="mt-1 text-sm text-teal-900">
                  Review every registered user, profile details, timezone, calendar connection, and activity.
                </p>
              </div>
              <ButtonLink href="/platform/users" tone="primary" className="w-full sm:w-auto">
                Open Users
              </ButtonLink>
            </div>
          </Card>
        ) : null}

        {needsAttention.length ? (
          <section>
            <SectionTitle title="Needs attention" subtitle="Open these first. They are blocked until a host/admin decides." />
            <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
              {needsAttention.slice(0, 4).map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </section>
        ) : null}

        {activeSessions.length || scheduledSessions.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <section>
              <SectionTitle title="Planning now" subtitle="Drafts, votes, availability checks, and timing polls." />
              <div className="grid auto-rows-fr gap-3">
                {activeSessions.slice(0, 3).map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
                {!activeSessions.length ? <QuietEmpty text="No planning sessions right now." /> : null}
              </div>
            </section>
            <section>
              <SectionTitle title="Upcoming" subtitle="Scheduled sessions with confirmed times." />
              <div className="grid auto-rows-fr gap-3">
                {scheduledSessions.slice(0, 3).map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
                {!scheduledSessions.length ? <QuietEmpty text="No scheduled sessions yet." /> : null}
              </div>
            </section>
          </div>
        ) : groups.length ? (
          <Card className="border-dashed bg-white/70">
            <h2 className="font-semibold text-zinc-950">Nothing needs attention right now</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Open a group to host a session, review members, or check session history.
            </p>
          </Card>
        ) : null}

        <SectionTitle title="My groups" subtitle="Open a group to host sessions, vote, manage members, or review history." />
        {groups.length ? (
          <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No groups yet"
            body="Join a group using an invite code, or create a new group for your community."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="/groups/join" tone="primary">Join Group</ButtonLink>
                <ButtonLink href="/groups/new">Create Group</ButtonLink>
              </div>
            }
          />
        )}
      </div>
    </AuthenticatedPage>
  );
}

function QuietEmpty({ text }: { text: string }) {
  return (
    <Card className="flex h-full min-h-24 items-center border-dashed bg-white/70">
      <p className="text-sm text-zinc-600">{text}</p>
    </Card>
  );
}
