import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { ButtonLink } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { GroupCard } from "@/components/groups/GroupCard";
import { PollCard } from "@/components/polls/PollCard";
import { SessionCard } from "@/components/sessions/SessionCard";
import { groups, polls, sessions } from "@/lib/mock-data";

export default function DashboardPage() {
  const upcoming = sessions.filter((session) => session.status === "scheduled");
  const activePolls = polls.filter((poll) => poll.status === "active");
  const needsAction = sessions.filter((session) =>
    ["needs_host_decision", "scheduling_failed"].includes(session.status),
  );
  const hosted = sessions.filter((session) => session.hostId === "u1");

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          subtitle="Sessions, polls, and actions across your groups."
          primaryAction={<ButtonLink href="/sessions/new" tone="primary">Create session</ButtonLink>}
          secondaryActions={<ButtonLink href="/groups/join">Join group</ButtonLink>}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Upcoming sessions" value={upcoming.length} />
          <StatCard label="Active polls" value={activePolls.length} />
          <StatCard label="Needs my action" value={needsAction.length} />
          <StatCard label="Groups" value={groups.length} />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
          <div className="space-y-6">
            {needsAction.length ? (
              <section>
                <SectionTitle title="Action required" />
                <div className="space-y-3">
                  {needsAction.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
              </section>
            ) : null}
            <section>
              <SectionTitle title="Upcoming sessions" />
              <div className="space-y-3">
                {upcoming.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </section>
            <section>
              <SectionTitle title="Active polls" />
              <div className="space-y-3">
                {activePolls.map((poll) => (
                  <PollCard key={poll.id} poll={poll} />
                ))}
              </div>
            </section>
          </div>
          <aside className="space-y-6">
            <section>
              <SectionTitle title="My groups" />
              <div className="space-y-3">
                {groups.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            </section>
            <section>
              <SectionTitle title="My hosted sessions" />
              <div className="space-y-3">
                {hosted.slice(0, 3).map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AuthenticatedPage>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="text-3xl font-semibold text-zinc-950">{value}</div>
      <div className="mt-1 text-sm text-zinc-500">{label}</div>
    </Card>
  );
}
